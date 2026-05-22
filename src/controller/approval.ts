import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  Action,
  ApprovalStatus,
  ApprovalStepScope,
  ApprovalStepStatus,
  ApprovalType,
  MenuCode,
  PlatformPermission,
} from "../generated/prisma/enums";
import { sendError, sendSuccess } from "../utils/httpResponse";
import { logAuditEvent } from "../utils/audit";

type JwtUser = {
  sub: number;
  orgId: number;
  email: string;
  clientType?: "admin" | "mobile";
  adminScope?: "OWN_ADMIN" | "SUPERADMIN";
  actorType?: "employee" | "platform";
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

const getUserContext = (req: Request) => {
  const user = (req as RequestWithUser).user;
  if (!user || !Number.isFinite(user.sub) || !Number.isFinite(user.orgId)) {
    return null;
  }
  return {
    userId: Number(user.sub),
    orgId: Number(user.orgId),
  };
};

const getUserClaims = (req: Request) => (req as RequestWithUser).user ?? null;

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const PLATFORM_ESCALATED_TYPES = new Set<ApprovalType>([
  ApprovalType.OVERTIME,
  ApprovalType.PAYROLL_ADJUSTMENT,
]);

const isSuperadminActor = (req: Request) => {
  const user = getUserClaims(req);
  return (
    !!user &&
    user.clientType === "admin" &&
    user.adminScope === "SUPERADMIN" &&
    user.actorType === "platform" &&
    Number.isFinite(user.sub)
  );
};

export const listApprovals = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const role = (req.query.role as "requester" | "approver" | undefined) ?? "requester";
    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);
    const type = req.query.type as ApprovalType | undefined;
    const status = req.query.status as ApprovalStatus | undefined;
    const superadminActor = isSuperadminActor(req);

    const where =
      role === "approver" && superadminActor
        ? {
            ...(type ? { type } : {}),
            ...(status ? { status } : {}),
            ...(req.query.organizationId
              ? { organizationId: Number(req.query.organizationId) }
              : {}),
            steps: {
              some: {
                scope: ApprovalStepScope.PLATFORM,
                platformApproverId: user.userId,
              },
            },
          }
        : {
            organizationId: user.orgId,
            ...(type ? { type } : {}),
            ...(status ? { status } : {}),
            ...(role === "approver"
              ? { steps: { some: { approverId: user.userId } } }
              : { requesterId: user.userId }),
          };

    const includeRelations: any = {
      steps: {
        orderBy: { stepOrder: "asc" },
      },
    };
    if (superadminActor && role === "approver") {
      includeRelations.organization = {
        select: { id: true, code: true, name: true },
      };
    }

    const [total, items] = await Promise.all([
      prisma.approvalRequest.count({ where }),
      prisma.approvalRequest.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
        include: includeRelations,
      }),
    ]);

    return sendSuccess(res, {
      message: "Approvals fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to fetch approvals",
      error,
    });
  }
};

export const createApproval = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const { type, targetEmployeeId, payload } = req.body as {
      type: ApprovalType;
      targetEmployeeId?: number;
      payload?: Record<string, unknown>;
    };
    if (type === ApprovalType.LEAVE) {
      return sendError(res, {
        status: 400,
        message:
          "LEAVE approval is deprecated in attendance flow. Use /api/leave/requests instead.",
      });
    }

    const resolvedTargetEmployeeId = targetEmployeeId ?? user.userId;
    const target = await prisma.employee.findFirst({
      where: {
        id: resolvedTargetEmployeeId,
        organizationId: user.orgId,
      },
      select: { id: true },
    });
    if (!target) {
      return sendError(res, {
        status: 400,
        message: "Target employee does not belong to your organization",
      });
    }

    const approvers = await prisma.employee.findMany({
      where: {
        id: { not: user.userId },
        organizationId: user.orgId,
        designations: {
          some: {
            designation: {
              menuPermission: {
                some: {
                  menu: { menu: MenuCode.ATTENDANCE },
                  actions: { has: Action.UPDATE },
                },
              },
            },
          },
        },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 5,
    });

    if (!approvers.length) {
      return sendError(res, {
        status: 400,
        message:
          "No approver configured. Assign attendance UPDATE permission to manager/HR designation.",
      });
    }

    const uniqueApprovers = Array.from(new Set(approvers.map((a) => a.id)));
    const platformApprovers = PLATFORM_ESCALATED_TYPES.has(type)
      ? await prisma.platformUser.findMany({
          where: {
            isActive: true,
            permissions: { has: PlatformPermission.APPROVAL_DECIDE },
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take: 1,
        })
      : [];

    if (PLATFORM_ESCALATED_TYPES.has(type) && !platformApprovers.length) {
      return sendError(res, {
        status: 400,
        message: "No platform approver configured for escalated approvals",
      });
    }

    const approval = await prisma.$transaction(async (tx) => {
      const created = await tx.approvalRequest.create({
        data: {
          organizationId: user.orgId,
          requesterId: user.userId,
          targetEmployeeId: resolvedTargetEmployeeId,
          type,
          payload: payload as any,
        },
      });

      await tx.approvalStep.createMany({
        data: [
          ...uniqueApprovers.map((approverId, index) => ({
            requestId: created.id,
            scope: ApprovalStepScope.ORG,
            approverId,
            stepOrder: index + 1,
            status: ApprovalStepStatus.PENDING,
          })),
          ...platformApprovers.map((approver, index) => ({
            requestId: created.id,
            scope: ApprovalStepScope.PLATFORM,
            platformApproverId: approver.id,
            stepOrder: uniqueApprovers.length + index + 1,
            status: ApprovalStepStatus.PENDING,
          })),
        ],
      });

      return tx.approvalRequest.findUnique({
        where: { id: created.id },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
      });
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      actorType: "ORG_USER",
      targetOrganizationId: user.orgId,
      entity: "approval_request",
      entityId: approval?.id,
      action: "CREATE",
      changes: {
        type,
        targetEmployeeId: resolvedTargetEmployeeId,
        totalSteps: uniqueApprovers.length + platformApprovers.length,
        hasPlatformEscalation: platformApprovers.length > 0,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Approval created",
      data: approval,
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to create approval",
      error,
    });
  }
};

export const decideApproval = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const requestId = Number(req.params.id);
    if (!Number.isFinite(requestId)) {
      return sendError(res, { status: 400, message: "Invalid approval id" });
    }

    const { decision, comment } = req.body as {
      decision: "APPROVE" | "REJECT";
      comment?: string;
    };

    const approval = await prisma.approvalRequest.findFirst({
      where: {
        id: requestId,
        ...(isSuperadminActor(req) ? {} : { organizationId: user.orgId }),
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });
    if (!approval) {
      return sendError(res, { status: 404, message: "Approval not found" });
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      return sendError(res, {
        status: 400,
        message: "Approval is already finalized",
      });
    }

    const currentStep = approval.steps.find(
      (step) =>
        step.stepOrder === approval.currentStep &&
        step.status === ApprovalStepStatus.PENDING,
    );
    if (!currentStep) {
      return sendError(res, {
        status: 400,
        message: "Current approval step is invalid",
      });
    }
    if (currentStep.scope === ApprovalStepScope.PLATFORM) {
      if (!isSuperadminActor(req)) {
        return sendError(res, {
          status: 403,
          message: "Current step requires platform approver",
        });
      }
      if (currentStep.platformApproverId !== user.userId) {
        return sendError(res, {
          status: 403,
          message: "You are not allowed to approve this platform step",
        });
      }
    } else if (currentStep.approverId !== user.userId) {
      return sendError(res, {
        status: 403,
        message: "You are not allowed to approve this step",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: currentStep.id },
        data: {
          status:
            decision === "APPROVE"
              ? ApprovalStepStatus.APPROVED
              : ApprovalStepStatus.REJECTED,
          comment,
          actedAt: new Date(),
        },
      });

      if (decision === "REJECT") {
        await tx.approvalRequest.update({
          where: { id: requestId },
          data: { status: ApprovalStatus.REJECTED },
        });
      } else {
        const nextStep = approval.steps.find(
          (step) => step.stepOrder === approval.currentStep + 1,
        );
        if (!nextStep) {
          await tx.approvalRequest.update({
            where: { id: requestId },
            data: { status: ApprovalStatus.APPROVED },
          });
        } else {
          await tx.approvalRequest.update({
            where: { id: requestId },
            data: { currentStep: approval.currentStep + 1 },
          });
        }
      }

      return tx.approvalRequest.findUnique({
        where: { id: requestId },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
      });
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      actorType: isSuperadminActor(req) ? "SUPERADMIN" : "ORG_USER",
      targetOrganizationId: approval.organizationId,
      entity: "approval_request",
      entityId: requestId,
      action: "UPDATE",
      changes: {
        decision,
        currentStepBefore: approval.currentStep,
        statusAfter: updated?.status,
      },
      meta: {
        stepId: currentStep.id,
        stepScope: currentStep.scope,
      },
    });

    return sendSuccess(res, {
      message: "Approval decision applied",
      data: updated,
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to update approval decision",
      error,
    });
  }
};

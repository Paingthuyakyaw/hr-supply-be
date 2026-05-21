import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { sendEmployeeCreatedOnboardingWebhook } from "../utils/onboardingWebhook";
import {
  ContractStatus,
  EmployeeStatus,
  IDDocType,
} from "../generated/prisma/enums";
import { sendError, sendSuccess } from "../utils/httpResponse";
import { logAuditEvent } from "../utils/audit";

type JwtUser = {
  sub: number;
  orgId: number;
  email: string;
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

const EMPLOYEE_STATUS_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  PENDING: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["ON_PROBATION", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"],
  ON_PROBATION: ["ACTIVE", "SUSPENDED", "RESIGNED", "TERMINATED"],
  ON_LEAVE: ["ACTIVE", "RESIGNED", "TERMINATED"],
  SUSPENDED: ["ACTIVE", "RESIGNED", "TERMINATED"],
  RESIGNED: [],
  TERMINATED: [],
  RETIRED: [],
};

const canTransitionEmployeeStatus = (
  fromStatus: EmployeeStatus,
  toStatus: EmployeeStatus,
) => {
  if (fromStatus === toStatus) {
    return true;
  }
  return EMPLOYEE_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
};

export async function getEmployees(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const page = Number(req.query.page ?? 1);
    const size = Number(req.query.size ?? 20);
    const q = String(req.query.q ?? "").trim(); // search name/code/email
    const departmentId = req.query.department_id
      ? Number(req.query.department_id)
      : undefined;

    const where = {
      organizationId: user.orgId,
      ...(q
        ? {
            OR: [
              { full_name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phoneNumber: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(departmentId ? { department_id: departmentId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
        select: {
          id: true,
          full_name: true,
          avatar: true,
          contracts: true,
          code: true,
          email: true,
          phoneNumber: true,
          dob: true,
          employment_type: true,
          status: true,
          location: true,
          date_joined: true,
          updated_at: true,
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Employees fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to fetch employees", error: err });
  }
}

export async function getEmployeeById(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const item = await prisma.employee.findFirst({
      where: {
        id,
        organizationId: user.orgId,
      },
      include: { department: true, positions: true, documents: true },
    });

    if (!item) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    return sendSuccess(res, { message: "Employee fetched", data: item });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to fetch employee", error: err });
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const data = req.body as any;

    const { password, avatarUrl, contracts, documents, ...restData } = data as {
      password?: string;
      avatarUrl?: string;
      contracts?: string[];
      documents?: Array<{
        type: IDDocType;
        frontUrl?: string;
        backUrl?: string;
        front_url?: string;
        back_url?: string;
      }>;
      [key: string]: unknown;
    };

    const generatedTempPassword = password
      ? null
      : randomBytes(9).toString("base64url");
    const rawPassword = password ?? generatedTempPassword;
    const hashedPassword = rawPassword ? await bcrypt.hash(rawPassword, 10) : null;

    const normalizedDocuments = (Array.isArray(documents) ? documents : [])
      .map((doc) => ({
        type: doc.type,
        front_url: doc.frontUrl ?? doc.front_url,
        back_url: doc.backUrl ?? doc.back_url,
      }))
      .filter(
        (doc) =>
          doc.type &&
          (typeof doc.front_url !== "undefined" ||
            typeof doc.back_url !== "undefined"),
      );

    const departmentId = Number(restData.department_id);
    if (!Number.isFinite(departmentId)) {
      return sendError(res, { status: 400, message: "Invalid department_id" });
    }

    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        organizationId: user.orgId,
      },
      select: { id: true },
    });
    if (!department) {
      return sendError(res, {
        status: 400,
        message: "Department does not belong to your organization",
      });
    }

    const item = await prisma.employee.create({
      data: {
        ...restData,
        organizationId: user.orgId,
        avatar: avatarUrl ?? (restData.avatar as string | undefined),
        contracts: Array.isArray(contracts)
          ? contracts.filter((item): item is string => typeof item === "string")
          : [],
        password: hashedPassword,
        ...(normalizedDocuments.length
          ? {
              documents: {
                create: normalizedDocuments.map((doc) => ({
                  type: doc.type,
                  front_url: doc.front_url,
                  back_url: doc.back_url,
                })),
              },
            }
          : {}),
      } as any,
      include: { department: true, positions: true, documents: true },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "employee",
      entityId: item.id,
      action: "CREATE",
      changes: {
        status: item.status,
        contractsCount: item.contracts.length,
        documentsCount: item.documents.length,
      },
    });

    try {
      await sendEmployeeCreatedOnboardingWebhook({
        employeeId: item.id,
        organizationId: item.organizationId,
        departmentId: item.department_id,
        fullName: item.full_name,
        email: item.email,
        code: item.code,
        dateJoined: item.date_joined,
        tempPassword: generatedTempPassword,
      });
    } catch (webhookError) {
      console.error("Failed to send onboarding webhook", webhookError);
    }

    return sendSuccess(res, {
      status: 201,
      message: "Employee created",
      data: item,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to create employee", error: err });
  }
}

export async function updateEmployee(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const exists = await prisma.employee.findFirst({
      where: { id, organizationId: user.orgId },
      select: {
        id: true,
        status: true,
        contracts: true,
      },
    });
    if (!exists) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    const data = req.body as any;
    const { password, avatarUrl, contracts, documents, ...restData } = data as {
      password?: string;
      avatarUrl?: string;
      contracts?: string[];
      status?: EmployeeStatus;
      documents?: Array<{
        type: IDDocType;
        frontUrl?: string;
        backUrl?: string;
        front_url?: string;
        back_url?: string;
      }>;
      [key: string]: unknown;
    };

    const normalizedDocuments = (Array.isArray(documents) ? documents : [])
      .map((doc) => ({
        type: doc.type,
        front_url: doc.frontUrl ?? doc.front_url,
        back_url: doc.backUrl ?? doc.back_url,
      }))
      .filter(
        (doc) =>
          doc.type &&
          (typeof doc.front_url !== "undefined" ||
            typeof doc.back_url !== "undefined"),
      );

    const shouldReplaceDocuments = Array.isArray(documents);
    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
    const incomingStatus = restData.status as EmployeeStatus | undefined;
    if (
      typeof incomingStatus !== "undefined" &&
      !canTransitionEmployeeStatus(exists.status, incomingStatus)
    ) {
      return sendError(res, {
        status: 400,
        message: `Invalid employee status transition: ${exists.status} -> ${incomingStatus}`,
      });
    }
    const incomingDepartmentId =
      typeof restData.department_id !== "undefined"
        ? Number(restData.department_id)
        : undefined;
    if (
      typeof incomingDepartmentId !== "undefined" &&
      (!Number.isFinite(incomingDepartmentId) || incomingDepartmentId <= 0)
    ) {
      return sendError(res, { status: 400, message: "Invalid department_id" });
    }
    if (Number.isFinite(incomingDepartmentId)) {
      const department = await prisma.department.findFirst({
        where: {
          id: incomingDepartmentId,
          organizationId: user.orgId,
        },
        select: { id: true },
      });
      if (!department) {
        return sendError(res, {
          status: 400,
          message: "Department does not belong to your organization",
        });
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...restData,
          organizationId: user.orgId,
          ...(typeof avatarUrl !== "undefined" ? { avatar: avatarUrl } : {}),
          ...(Array.isArray(contracts)
            ? {
                contracts: contracts.filter(
                  (item): item is string => typeof item === "string",
                ),
              }
            : {}),
          ...(typeof hashedPassword !== "undefined"
            ? { password: hashedPassword }
            : {}),
        } as any,
      });

      if (shouldReplaceDocuments) {
        await tx.iD_Document.deleteMany({
          where: { employee_id: id },
        });

        if (normalizedDocuments.length) {
          await tx.iD_Document.createMany({
            data: normalizedDocuments.map((doc) => ({
              employee_id: id,
              type: doc.type,
              front_url: doc.front_url,
              back_url: doc.back_url,
            })),
          });
        }
      }

      return tx.employee.findUnique({
        where: { id },
        include: { department: true, positions: true, documents: true },
      });
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "employee",
      entityId: id,
      action: "UPDATE",
      changes: {
        statusBefore: exists.status,
        statusAfter: item?.status,
        contractsBefore: exists.contracts.length,
        contractsAfter: item?.contracts?.length ?? 0,
        documentsReplaced: shouldReplaceDocuments,
      },
    });

    return sendSuccess(res, { message: "Employee updated", data: item });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to update employee", error: err });
  }
}

export async function transitionEmployeeLifecycle(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const nextStatus = req.body?.status as EmployeeStatus | undefined;
    if (
      !nextStatus ||
      !Object.values(EmployeeStatus).includes(nextStatus as EmployeeStatus)
    ) {
      return sendError(res, {
        status: 400,
        message: "Invalid employee lifecycle status",
      });
    }

    const exists = await prisma.employee.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true, status: true },
    });
    if (!exists) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    if (!canTransitionEmployeeStatus(exists.status, nextStatus)) {
      return sendError(res, {
        status: 400,
        message: `Invalid employee status transition: ${exists.status} -> ${nextStatus}`,
      });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { status: nextStatus },
      include: { department: true, positions: true, documents: true },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "employee",
      entityId: id,
      action: "UPDATE",
      changes: {
        statusBefore: exists.status,
        statusAfter: employee.status,
      },
      meta: {
        event: "employee.lifecycle.transition",
      },
    });

    return sendSuccess(res, {
      message: "Employee lifecycle updated",
      data: employee,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, {
      message: "Failed to update employee lifecycle",
      error: err,
    });
  }
}

export async function deleteEmployee(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const exists = await prisma.employee.findFirst({
      where: { id, organizationId: user.orgId },
      select: {
        id: true,
        status: true,
        contracts: true,
      },
    });
    if (!exists) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    await prisma.employee.delete({ where: { id } });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "employee",
      entityId: id,
      action: "DELETE",
      changes: {
        statusBeforeDelete: exists.status,
        contractsCount: exists.contracts.length,
      },
    });

    return sendSuccess(res, {
      message: "Employee deleted",
      data: { id },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to delete employee", error: err });
  }
}

export async function getEmployeeContracts(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const employeeId = Number(req.params.id);
    if (!Number.isFinite(employeeId)) {
      return sendError(res, { status: 400, message: "Invalid employee id" });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: user.orgId,
      },
      select: { id: true },
    });
    if (!employee) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    const contracts = await prisma.employeeContract.findMany({
      where: { employeeId },
      orderBy: [{ version: "desc" }, { id: "desc" }],
    });

    return sendSuccess(res, {
      message: "Employee contracts fetched",
      data: contracts,
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to fetch employee contracts",
      error,
    });
  }
}

export async function createEmployeeContract(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const employeeId = Number(req.params.id);
    if (!Number.isFinite(employeeId)) {
      return sendError(res, { status: 400, message: "Invalid employee id" });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: user.orgId,
      },
      select: { id: true },
    });
    if (!employee) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    const { fileUrl, expiresAt, reminderDays, notes, status } = req.body as {
      fileUrl: string;
      expiresAt?: string;
      reminderDays?: number;
      notes?: string;
      status?: ContractStatus;
    };

    const currentMaxVersion = await prisma.employeeContract.aggregate({
      where: { employeeId },
      _max: { version: true },
    });

    const contract = await prisma.employeeContract.create({
      data: {
        employeeId,
        fileUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        reminderDays: typeof reminderDays === "number" ? reminderDays : undefined,
        notes,
        status: status ?? ContractStatus.ACTIVE,
        version: (currentMaxVersion._max.version ?? 0) + 1,
      },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "employee_contract",
      entityId: contract.id,
      action: "CREATE",
      changes: {
        employeeId,
        status: contract.status,
        version: contract.version,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Employee contract created",
      data: contract,
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to create employee contract",
      error,
    });
  }
}

export async function updateEmployeeContract(req: Request, res: Response) {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const employeeId = Number(req.params.id);
    const contractId = Number(req.params.contractId);
    if (!Number.isFinite(employeeId) || !Number.isFinite(contractId)) {
      return sendError(res, {
        status: 400,
        message: "Invalid employee id or contract id",
      });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: user.orgId,
      },
      select: { id: true },
    });
    if (!employee) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    const existing = await prisma.employeeContract.findFirst({
      where: {
        id: contractId,
        employeeId,
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });
    if (!existing) {
      return sendError(res, { status: 404, message: "Contract not found" });
    }

    const { fileUrl, expiresAt, reminderDays, notes, status } = req.body as {
      fileUrl?: string;
      expiresAt?: string | null;
      reminderDays?: number | null;
      notes?: string | null;
      status?: ContractStatus;
    };

    const updated = await prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        ...(typeof fileUrl !== "undefined" ? { fileUrl } : {}),
        ...(typeof expiresAt !== "undefined"
          ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
          : {}),
        ...(typeof reminderDays !== "undefined" ? { reminderDays } : {}),
        ...(typeof notes !== "undefined" ? { notes } : {}),
        ...(typeof status !== "undefined" ? { status } : {}),
      },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "employee_contract",
      entityId: updated.id,
      action: "UPDATE",
      changes: {
        statusBefore: existing.status,
        statusAfter: updated.status,
        expiresAtBefore: existing.expiresAt,
        expiresAtAfter: updated.expiresAt,
      },
    });

    return sendSuccess(res, {
      message: "Employee contract updated",
      data: updated,
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to update employee contract",
      error,
    });
  }
}

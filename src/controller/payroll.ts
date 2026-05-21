import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  EmployeeStatus,
  PayrollCalculationType,
  PayrollComponentType,
  PayrollRunStatus,
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

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const toNumber = (value: unknown) => Number(value ?? 0);

export const listPayrollComponents = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const type = req.query.type as PayrollComponentType | undefined;
    const items = await prisma.payrollComponent.findMany({
      where: {
        organizationId: user.orgId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ isActive: "desc" }, { id: "asc" }],
    });

    return sendSuccess(res, {
      message: "Payroll components fetched",
      data: items,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch payroll components", error });
  }
};

export const createPayrollComponent = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const body = req.body as {
      code: string;
      name: string;
      type: PayrollComponentType;
      calculationType: PayrollCalculationType;
      value: number;
      isTaxable?: boolean;
      isActive?: boolean;
    };

    const created = await prisma.payrollComponent.create({
      data: {
        organizationId: user.orgId,
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        type: body.type,
        calculationType: body.calculationType,
        value: body.value,
        isTaxable: typeof body.isTaxable === "boolean" ? body.isTaxable : false,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Payroll component created",
      data: created,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to create payroll component", error });
  }
};

export const updatePayrollComponent = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid payroll component id" });
    }

    const exists = await prisma.payrollComponent.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true },
    });
    if (!exists) {
      return sendError(res, { status: 404, message: "Payroll component not found" });
    }

    const body = req.body as {
      name?: string;
      type?: PayrollComponentType;
      calculationType?: PayrollCalculationType;
      value?: number;
      isTaxable?: boolean;
      isActive?: boolean;
    };

    const updated = await prisma.payrollComponent.update({
      where: { id },
      data: {
        ...(typeof body.name !== "undefined" ? { name: body.name.trim() } : {}),
        ...(typeof body.type !== "undefined" ? { type: body.type } : {}),
        ...(typeof body.calculationType !== "undefined"
          ? { calculationType: body.calculationType }
          : {}),
        ...(typeof body.value !== "undefined" ? { value: body.value } : {}),
        ...(typeof body.isTaxable !== "undefined" ? { isTaxable: body.isTaxable } : {}),
        ...(typeof body.isActive !== "undefined" ? { isActive: body.isActive } : {}),
      },
    });

    return sendSuccess(res, {
      message: "Payroll component updated",
      data: updated,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to update payroll component", error });
  }
};

const calculateComponentAmount = ({
  componentType,
  calculationType,
  componentValue,
  baseSalary,
}: {
  componentType: PayrollComponentType;
  calculationType: PayrollCalculationType;
  componentValue: number;
  baseSalary: number;
}) => {
  if (componentType === PayrollComponentType.EARNING && calculationType === PayrollCalculationType.FIXED) {
    return componentValue;
  }
  if (
    componentType === PayrollComponentType.EARNING &&
    calculationType === PayrollCalculationType.PERCENTAGE
  ) {
    return (baseSalary * componentValue) / 100;
  }
  if (
    componentType === PayrollComponentType.DEDUCTION &&
    calculationType === PayrollCalculationType.FIXED
  ) {
    return componentValue * -1;
  }
  return ((baseSalary * componentValue) / 100) * -1;
};

export const runPayroll = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const { month, notes } = req.body as {
      month: string;
      notes?: string;
    };

    const employees = await prisma.employee.findMany({
      where: {
        organizationId: user.orgId,
        status: { not: EmployeeStatus.TERMINATED },
      },
      select: {
        id: true,
        code: true,
        full_name: true,
        positions: {
          select: {
            position: {
              select: {
                avg_salary: true,
              },
            },
          },
          orderBy: { assigned_at: "asc" },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
    });

    if (!employees.length) {
      return sendError(res, { status: 400, message: "No employees available for payroll" });
    }

    const components = await prisma.payrollComponent.findMany({
      where: { organizationId: user.orgId, isActive: true },
      orderBy: { id: "asc" },
    });

    if (!components.length) {
      return sendError(res, {
        status: 400,
        message: "No active payroll components configured",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.upsert({
        where: {
          organizationId_month: {
            organizationId: user.orgId,
            month,
          },
        },
        update: {
          notes,
          status: PayrollRunStatus.DRAFT,
          createdById: user.userId,
          processedAt: new Date(),
        },
        create: {
          organizationId: user.orgId,
          month,
          notes,
          status: PayrollRunStatus.DRAFT,
          createdById: user.userId,
          processedAt: new Date(),
        },
      });

      await tx.payrollItem.deleteMany({
        where: { payrollRunId: run.id, organizationId: user.orgId },
      });

      const itemsPayload = [];
      for (const employee of employees) {
        const baseSalary = toNumber(employee.positions[0]?.position?.avg_salary ?? 0);
        for (const component of components) {
          const amount = calculateComponentAmount({
            componentType: component.type,
            calculationType: component.calculationType,
            componentValue: toNumber(component.value),
            baseSalary,
          });
          itemsPayload.push({
            organizationId: user.orgId,
            payrollRunId: run.id,
            employeeId: employee.id,
            componentId: component.id,
            amount,
          });
        }
      }

      if (itemsPayload.length) {
        await tx.payrollItem.createMany({ data: itemsPayload });
      }

      const summaryRows = await tx.payrollItem.groupBy({
        by: ["employeeId"],
        where: { payrollRunId: run.id, organizationId: user.orgId },
        _sum: { amount: true },
      });

      return {
        run,
        employees: summaryRows.length,
      };
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "payroll_run",
      entityId: result.run.id,
      action: "CREATE",
      changes: {
        month,
        totalEmployees: result.employees,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Payroll run completed",
      data: result,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to run payroll", error });
  }
};

export const listPayrollRuns = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);
    const status = req.query.status as PayrollRunStatus | undefined;

    const where = {
      organizationId: user.orgId,
      ...(status ? { status } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.payrollRun.count({ where }),
      prisma.payrollRun.findMany({
        where,
        orderBy: [{ id: "desc" }],
        skip: (page - 1) * size,
        take: size,
        include: {
          createdBy: {
            select: { id: true, full_name: true, code: true },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Payroll runs fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch payroll runs", error });
  }
};

export const getPayrollRunSummary = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid payroll run id" });
    }

    const run = await prisma.payrollRun.findFirst({
      where: {
        id,
        organizationId: user.orgId,
      },
      include: {
        items: {
          include: {
            employee: {
              select: { id: true, code: true, full_name: true },
            },
            component: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });
    if (!run) {
      return sendError(res, { status: 404, message: "Payroll run not found" });
    }

    const netByEmployee = new Map<
      number,
      { employeeId: number; employeeCode: string; employeeName: string; netPay: number }
    >();
    for (const item of run.items) {
      const existing = netByEmployee.get(item.employeeId) ?? {
        employeeId: item.employeeId,
        employeeCode: item.employee.code,
        employeeName: item.employee.full_name,
        netPay: 0,
      };
      existing.netPay += toNumber(item.amount);
      netByEmployee.set(item.employeeId, existing);
    }

    const totalNetPay = Array.from(netByEmployee.values()).reduce(
      (sum, row) => sum + row.netPay,
      0,
    );

    return sendSuccess(res, {
      message: "Payroll summary fetched",
      data: {
        run: {
          id: run.id,
          month: run.month,
          status: run.status,
          notes: run.notes,
          processedAt: run.processedAt,
        },
        employees: Array.from(netByEmployee.values()).sort(
          (a, b) => a.employeeId - b.employeeId,
        ),
        totals: {
          employees: netByEmployee.size,
          totalNetPay,
        },
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch payroll summary", error });
  }
};

export const exportPayrollRun = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid payroll run id" });
    }

    const run = await prisma.payrollRun.findFirst({
      where: {
        id,
        organizationId: user.orgId,
      },
      include: {
        items: {
          include: {
            employee: {
              select: { id: true, code: true, full_name: true },
            },
            component: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });
    if (!run) {
      return sendError(res, { status: 404, message: "Payroll run not found" });
    }

    const byEmployee = new Map<
      number,
      { employeeCode: string; employeeName: string; rows: typeof run.items }
    >();
    for (const item of run.items) {
      const current = byEmployee.get(item.employeeId) ?? {
        employeeCode: item.employee.code,
        employeeName: item.employee.full_name,
        rows: [],
      };
      current.rows.push(item);
      byEmployee.set(item.employeeId, current);
    }

    const lines = [
      "employee_code,employee_name,component_code,component_name,component_type,amount",
    ];
    for (const employeeRow of byEmployee.values()) {
      for (const componentRow of employeeRow.rows) {
        lines.push(
          [
            employeeRow.employeeCode,
            employeeRow.employeeName.replace(/,/g, " "),
            componentRow.component.code,
            componentRow.component.name.replace(/,/g, " "),
            componentRow.component.type,
            toNumber(componentRow.amount).toFixed(2),
          ].join(","),
        );
      }
    }

    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: PayrollRunStatus.EXPORTED },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "payroll_run",
      entityId: run.id,
      action: "UPDATE",
      changes: { exported: true },
    });

    return sendSuccess(res, {
      message: "Payroll export generated",
      data: {
        fileName: `payroll-${run.month}.csv`,
        contentType: "text/csv",
        content: lines.join("\n"),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to export payroll", error });
  }
};

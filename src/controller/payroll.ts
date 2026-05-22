import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  EmployeeStatus,
  PayrollEmployeeStatus,
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
const getEmployeeBaseSalary = (employee: {
  positions: Array<{ position: { avg_salary: number | null } }>;
}) => toNumber(employee.positions[0]?.position?.avg_salary ?? 0);

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

const calculateSummaryFromItems = (
  items: Array<{ type: PayrollComponentType; amount: number }>,
) => {
  const totalAllowances = items
    .filter((item) => item.type === PayrollComponentType.EARNING)
    .reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = items
    .filter((item) => item.type === PayrollComponentType.DEDUCTION)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const netPay = totalAllowances - totalDeductions;
  return {
    totalAllowances,
    totalDeductions,
    netPay,
  };
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
      await tx.payrollEmployeeSummary.deleteMany({
        where: { payrollRunId: run.id, organizationId: user.orgId },
      });

      let processedEmployees = 0;
      let pendingEmployees = 0;
      for (const employee of employees) {
        const baseSalary = getEmployeeBaseSalary(employee);
        const itemsPayload: Array<{
          organizationId: number;
          payrollRunId: number;
          employeeId: number;
          componentId: number;
          amount: number;
          type: PayrollComponentType;
        }> = [];
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
            type: component.type,
          });
        }

        const summaryAmount = calculateSummaryFromItems(itemsPayload);
        const summary = await tx.payrollEmployeeSummary.create({
          data: {
            organizationId: user.orgId,
            payrollRunId: run.id,
            employeeId: employee.id,
            basicSalary: baseSalary,
            totalAllowances: summaryAmount.totalAllowances,
            totalDeductions: summaryAmount.totalDeductions,
            netPay: summaryAmount.netPay,
            status:
              baseSalary > 0
                ? PayrollEmployeeStatus.PROCESSED
                : PayrollEmployeeStatus.PENDING,
          },
        });

        if (itemsPayload.length) {
          await tx.payrollItem.createMany({
            data: itemsPayload.map((item) => ({
              organizationId: item.organizationId,
              payrollRunId: item.payrollRunId,
              employeeId: item.employeeId,
              componentId: item.componentId,
              amount: item.amount,
              employeeSummaryId: summary.id,
            })),
          });
        }

        if (summary.status === PayrollEmployeeStatus.PROCESSED) {
          processedEmployees += 1;
        } else {
          pendingEmployees += 1;
        }
      }

      return {
        run,
        employees: employees.length,
        processedEmployees,
        pendingEmployees,
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
        processedEmployees: result.processedEmployees,
        pendingEmployees: result.pendingEmployees,
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

export const getPayrollCalculateOptions = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const requestedMonth = String(req.query.month ?? "");
    const month = /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : new Date().toISOString().slice(0, 7);

    const [employees, components, run] = await Promise.all([
      prisma.employee.findMany({
        where: {
          organizationId: user.orgId,
          status: { not: EmployeeStatus.TERMINATED },
        },
        select: {
          id: true,
          code: true,
          full_name: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
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
      }),
      prisma.payrollComponent.findMany({
        where: { organizationId: user.orgId, isActive: true },
        orderBy: [{ type: "asc" }, { id: "asc" }],
      }),
      prisma.payrollRun.findUnique({
        where: {
          organizationId_month: {
            organizationId: user.orgId,
            month,
          },
        },
        select: { id: true },
      }),
    ]);

    return sendSuccess(res, {
      message: "Payroll calculate options fetched",
      data: {
        month,
        hasPayrollRun: Boolean(run),
        employees: employees.map((employee) => ({
          id: employee.id,
          code: employee.code,
          full_name: employee.full_name,
          department: employee.department,
          baseSalary: getEmployeeBaseSalary(employee),
        })),
        allowances: components.filter(
          (component) => component.type === PayrollComponentType.EARNING,
        ),
        deductions: components.filter(
          (component) => component.type === PayrollComponentType.DEDUCTION,
        ),
      },
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to fetch payroll calculate options",
      error,
    });
  }
};

export const calculateEmployeePayroll = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const employeeId = Number(req.params.employeeId);
    if (!Number.isFinite(employeeId)) {
      return sendError(res, { status: 400, message: "Invalid employee id" });
    }

    const { month, allowances, deductions, notes } = req.body as {
      month: string;
      allowances: Array<{ componentId: number; amount: number }>;
      deductions: Array<{ componentId: number; amount: number }>;
      notes?: string;
    };

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
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
              select: { avg_salary: true },
            },
          },
          orderBy: { assigned_at: "asc" },
          take: 1,
        },
      },
    });
    if (!employee) {
      return sendError(res, { status: 404, message: "Employee not found" });
    }

    const allComponentIds = [
      ...(allowances ?? []).map((item) => item.componentId),
      ...(deductions ?? []).map((item) => item.componentId),
    ];
    const components = await prisma.payrollComponent.findMany({
      where: {
        organizationId: user.orgId,
        id: { in: allComponentIds.length ? allComponentIds : [-1] },
      },
    });
    const componentMap = new Map(components.map((component) => [component.id, component]));
    const builtRows: Array<{
      organizationId: number;
      payrollRunId: number;
      employeeId: number;
      componentId: number;
      amount: number;
      type: PayrollComponentType;
    }> = [];

    for (const allowance of allowances ?? []) {
      const component = componentMap.get(allowance.componentId);
      if (!component || component.type !== PayrollComponentType.EARNING) {
        return sendError(res, {
          status: 400,
          message: `Invalid allowance component: ${allowance.componentId}`,
        });
      }
      builtRows.push({
        organizationId: user.orgId,
        payrollRunId: 0,
        employeeId,
        componentId: component.id,
        amount: toNumber(allowance.amount),
        type: component.type,
      });
    }

    for (const deduction of deductions ?? []) {
      const component = componentMap.get(deduction.componentId);
      if (!component || component.type !== PayrollComponentType.DEDUCTION) {
        return sendError(res, {
          status: 400,
          message: `Invalid deduction component: ${deduction.componentId}`,
        });
      }
      builtRows.push({
        organizationId: user.orgId,
        payrollRunId: 0,
        employeeId,
        componentId: component.id,
        amount: toNumber(deduction.amount) * -1,
        type: component.type,
      });
    }

    const baseSalary = getEmployeeBaseSalary(employee);
    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.upsert({
        where: {
          organizationId_month: {
            organizationId: user.orgId,
            month,
          },
        },
        update: {
          createdById: user.userId,
          notes,
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
        where: {
          organizationId: user.orgId,
          payrollRunId: run.id,
          employeeId,
        },
      });
      await tx.payrollEmployeeSummary.deleteMany({
        where: {
          organizationId: user.orgId,
          payrollRunId: run.id,
          employeeId,
        },
      });

      const summaryAmount = calculateSummaryFromItems(builtRows);
      const summary = await tx.payrollEmployeeSummary.create({
        data: {
          organizationId: user.orgId,
          payrollRunId: run.id,
          employeeId,
          basicSalary: baseSalary,
          totalAllowances: summaryAmount.totalAllowances,
          totalDeductions: summaryAmount.totalDeductions,
          netPay: summaryAmount.netPay,
          status:
            baseSalary > 0
              ? PayrollEmployeeStatus.PROCESSED
              : PayrollEmployeeStatus.PENDING,
          notes,
        },
      });

      if (builtRows.length) {
        await tx.payrollItem.createMany({
          data: builtRows.map((row) => ({
            organizationId: row.organizationId,
            payrollRunId: run.id,
            employeeId: row.employeeId,
            componentId: row.componentId,
            amount: row.amount,
            employeeSummaryId: summary.id,
          })),
        });
      }

      return { run, summary };
    });

    return sendSuccess(res, {
      message: "Employee payroll calculated",
      data: {
        run: {
          id: result.run.id,
          month: result.run.month,
          status: result.run.status,
        },
        summary: result.summary,
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to calculate employee payroll", error });
  }
};

export const getPayrollOverview = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const month = String(req.query.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return sendError(res, { status: 400, message: "month must be YYYY-MM" });
    }

    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);
    const q = String(req.query.q ?? "").trim();
    const status = req.query.status as PayrollEmployeeStatus | undefined;
    const departmentId = req.query.departmentId
      ? Number(req.query.departmentId)
      : undefined;

    const run = await prisma.payrollRun.findUnique({
      where: {
        organizationId_month: {
          organizationId: user.orgId,
          month,
        },
      },
      select: { id: true, month: true, status: true, processedAt: true },
    });
    if (!run) {
      return sendSuccess(res, {
        message: "Payroll overview fetched",
        data: {
          month,
          run: null,
          cards: { totalPayroll: 0, paid: 0, processed: 0, pending: 0 },
          rows: [],
        },
        meta: { page, size, total: 0, totalPages: 0 },
      });
    }

    const allRows = await prisma.payrollEmployeeSummary.findMany({
      where: { organizationId: user.orgId, payrollRunId: run.id },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            full_name: true,
            department: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ id: "desc" }],
    });

    const cards = {
      totalPayroll: allRows.reduce((sum, row) => sum + toNumber(row.netPay), 0),
      paid: allRows.filter((row) => row.status === PayrollEmployeeStatus.PAID).length,
      processed: allRows.filter((row) => row.status === PayrollEmployeeStatus.PROCESSED)
        .length,
      pending: allRows.filter((row) => row.status === PayrollEmployeeStatus.PENDING).length,
    };

    const filtered = allRows.filter((row) => {
      if (status && row.status !== status) return false;
      if (Number.isFinite(departmentId) && row.employee.department?.id !== departmentId) {
        return false;
      }
      if (
        q &&
        !row.employee.full_name.toLowerCase().includes(q.toLowerCase()) &&
        !row.employee.code.toLowerCase().includes(q.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    const paged = filtered.slice((page - 1) * size, (page - 1) * size + size);

    return sendSuccess(res, {
      message: "Payroll overview fetched",
      data: {
        month,
        run,
        cards,
        rows: paged.map((row) => ({
          summaryId: row.id,
          employee: row.employee,
          department: row.employee.department,
          basicSalary: toNumber(row.basicSalary),
          allowances: toNumber(row.totalAllowances),
          deductions: toNumber(row.totalDeductions),
          netPay: toNumber(row.netPay),
          status: row.status,
          paidAt: row.paidAt,
        })),
      },
      meta: {
        page,
        size,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch payroll overview", error });
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

export const getEmployeePayrollDetail = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const employeeId = Number(req.params.employeeId);
    const month = String(req.query.month ?? "");
    if (!Number.isFinite(employeeId)) {
      return sendError(res, { status: 400, message: "Invalid employee id" });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return sendError(res, { status: 400, message: "month must be YYYY-MM" });
    }

    const run = await prisma.payrollRun.findUnique({
      where: {
        organizationId_month: {
          organizationId: user.orgId,
          month,
        },
      },
      select: { id: true, month: true, status: true },
    });
    if (!run) {
      return sendError(res, { status: 404, message: "Payroll run not found for month" });
    }

    const summary = await prisma.payrollEmployeeSummary.findFirst({
      where: {
        organizationId: user.orgId,
        payrollRunId: run.id,
        employeeId,
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            full_name: true,
            department: { select: { id: true, name: true } },
          },
        },
        items: {
          include: {
            component: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!summary) {
      return sendError(res, { status: 404, message: "Payroll detail not found" });
    }

    return sendSuccess(res, {
      message: "Payroll detail fetched",
      data: {
        run,
        summary: {
          id: summary.id,
          basicSalary: toNumber(summary.basicSalary),
          totalAllowances: toNumber(summary.totalAllowances),
          totalDeductions: toNumber(summary.totalDeductions),
          netPay: toNumber(summary.netPay),
          status: summary.status,
          paidAt: summary.paidAt,
          notes: summary.notes,
        },
        employee: summary.employee,
        allowances: summary.items
          .filter((item) => item.component.type === PayrollComponentType.EARNING)
          .map((item) => ({
            componentId: item.component.id,
            code: item.component.code,
            name: item.component.name,
            amount: toNumber(item.amount),
          })),
        deductions: summary.items
          .filter((item) => item.component.type === PayrollComponentType.DEDUCTION)
          .map((item) => ({
            componentId: item.component.id,
            code: item.component.code,
            name: item.component.name,
            amount: Math.abs(toNumber(item.amount)),
          })),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch payroll detail", error });
  }
};

export const markPayrollAsPaid = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const employeeId = Number(req.params.employeeId);
    const month = String(req.body?.month ?? "");
    if (!Number.isFinite(employeeId)) {
      return sendError(res, { status: 400, message: "Invalid employee id" });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return sendError(res, { status: 400, message: "month must be YYYY-MM" });
    }

    const run = await prisma.payrollRun.findUnique({
      where: {
        organizationId_month: {
          organizationId: user.orgId,
          month,
        },
      },
      select: { id: true },
    });
    if (!run) {
      return sendError(res, { status: 404, message: "Payroll run not found for month" });
    }

    const summary = await prisma.payrollEmployeeSummary.findFirst({
      where: {
        organizationId: user.orgId,
        payrollRunId: run.id,
        employeeId,
      },
      select: { id: true, status: true },
    });
    if (!summary) {
      return sendError(res, { status: 404, message: "Payroll detail not found" });
    }

    const updated = await prisma.payrollEmployeeSummary.update({
      where: { id: summary.id },
      data: {
        status: PayrollEmployeeStatus.PAID,
        paidAt: new Date(),
      },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "payroll_employee_summary",
      entityId: updated.id,
      action: "UPDATE",
      changes: {
        statusBefore: summary.status,
        statusAfter: updated.status,
      },
    });

    return sendSuccess(res, {
      message: "Payroll marked as paid",
      data: updated,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to mark payroll as paid", error });
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
        employeeSummaries: {
          include: {
            employee: {
              select: { id: true, code: true, full_name: true },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    }) as any;
    if (!run) {
      return sendError(res, { status: 404, message: "Payroll run not found" });
    }

    const totalNetPay = run.employeeSummaries.reduce(
      (sum: number, row: any) => sum + toNumber(row.netPay),
      0,
    );
    const employees = run.employeeSummaries.map((item: any) => ({
      employeeId: item.employeeId,
      employeeCode: item.employee.code,
      employeeName: item.employee.full_name,
      netPay: toNumber(item.netPay),
      status: item.status,
    }));
    const paidCount = run.employeeSummaries.filter(
      (item: any) => item.status === PayrollEmployeeStatus.PAID,
    ).length;

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
        employees,
        totals: {
          employees: run.employeeSummaries.length,
          totalNetPay,
          paidCount,
          pendingCount: run.employeeSummaries.length - paidCount,
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
        employeeSummaries: {
          include: {
            employee: {
              select: { id: true, code: true, full_name: true },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    }) as any;
    if (!run) {
      return sendError(res, { status: 404, message: "Payroll run not found" });
    }

    const lines = [
      "employee_code,employee_name,basic_salary,allowances,deductions,net_pay,status",
    ];
    for (const row of run.employeeSummaries) {
      lines.push(
        [
          row.employee.code,
          row.employee.full_name.replace(/,/g, " "),
          toNumber(row.basicSalary).toFixed(2),
          toNumber(row.totalAllowances).toFixed(2),
          toNumber(row.totalDeductions).toFixed(2),
          toNumber(row.netPay).toFixed(2),
          row.status,
        ].join(","),
      );
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

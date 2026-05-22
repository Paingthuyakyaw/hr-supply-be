import z from "zod";
import {
  PayrollEmployeeStatus,
  PayrollCalculationType,
  PayrollComponentType,
  PayrollRunStatus,
} from "../generated/prisma/enums";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });
const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}$/, { message: "Month must be YYYY-MM" });

export const payrollComponentListSchema = z.object({
  query: z.object({
    type: z.nativeEnum(PayrollComponentType).optional(),
  }),
});

export const payrollComponentCreateSchema = z.object({
  body: z.object({
    code: z.string().trim().min(2).max(50),
    name: z.string().trim().min(1).max(100),
    type: z.nativeEnum(PayrollComponentType),
    calculationType: z.nativeEnum(PayrollCalculationType),
    value: z.number().positive(),
    isTaxable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const payrollComponentUpdateSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      type: z.nativeEnum(PayrollComponentType).optional(),
      calculationType: z.nativeEnum(PayrollCalculationType).optional(),
      value: z.number().positive().optional(),
      isTaxable: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
});

export const payrollRunCreateSchema = z.object({
  body: z.object({
    month: monthString,
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const payrollRunListSchema = z.object({
  query: z.object({
    status: z.nativeEnum(PayrollRunStatus).optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const payrollRunIdSchema = z.object({
  params: z.object({
    id: idParam,
  }),
});

export const payrollOverviewSchema = z.object({
  query: z.object({
    month: monthString,
    q: z.string().trim().optional(),
    status: z.nativeEnum(PayrollEmployeeStatus).optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const payrollRunCalculateOptionsSchema = z.object({
  query: z.object({
    month: monthString.optional(),
  }),
});

const componentAmountSchema = z.object({
  componentId: z.number().int().positive(),
  amount: z.number().min(0),
});

export const payrollEmployeePayrollSchema = z.object({
  params: z.object({
    employeeId: idParam,
  }),
  body: z.object({
    month: monthString,
    allowances: z.array(componentAmountSchema).optional().default([]),
    deductions: z.array(componentAmountSchema).optional().default([]),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const payrollEmployeePayrollDetailSchema = z.object({
  params: z.object({
    employeeId: idParam,
  }),
  query: z.object({
    month: monthString,
  }),
});

export const payrollEmployeePaySchema = z.object({
  params: z.object({
    employeeId: idParam,
  }),
  body: z.object({
    month: monthString,
  }),
});

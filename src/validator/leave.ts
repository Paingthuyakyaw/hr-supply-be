import z from "zod";
import { LeaveRequestStatus } from "../generated/prisma/enums";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" });

export const leaveListSchema = z.object({
  query: z.object({
    status: z.nativeEnum(LeaveRequestStatus).optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const leaveBalanceListSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(3000).optional(),
  }),
});

export const createLeaveRequestSchema = z.object({
  body: z.object({
    leaveTypeId: z.number().int().positive(),
    startDate: dateString,
    endDate: dateString,
    reason: z.string().trim().max(1000).optional(),
  }),
});

export const cancelLeaveRequestSchema = z.object({
  params: z.object({
    id: idParam,
  }),
});

export const leaveTypeCreateSchema = z.object({
  body: z.object({
    code: z.string().trim().min(2).max(30),
    name: z.string().trim().min(1).max(100),
    annualQuotaDays: z.number().int().min(0).max(366),
    carryForwardLimit: z.number().int().min(0).max(366),
    requiresApproval: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const leaveTypeUpdateSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      annualQuotaDays: z.number().int().min(0).max(366).optional(),
      carryForwardLimit: z.number().int().min(0).max(366).optional(),
      requiresApproval: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
});

export const holidayListSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(3000).optional(),
  }),
});

export const holidayCreateSchema = z.object({
  body: z.object({
    date: dateString,
    name: z.string().trim().min(1).max(100),
    isOptional: z.boolean().optional(),
  }),
});

export const leaveRequestAdminListSchema = z.object({
  query: z.object({
    status: z.nativeEnum(LeaveRequestStatus).optional(),
    employeeId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const leaveDecisionSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().trim().max(1000).optional(),
  }),
});

export const leaveCarryForwardSchema = z.object({
  body: z.object({
    fromYear: z.number().int().min(2000).max(3000).optional(),
  }),
});

import z from "zod";
import { ApprovalStatus, ApprovalType } from "../generated/prisma/enums";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });

export const approvalListSchema = z.object({
  query: z.object({
    role: z.enum(["requester", "approver"]).optional(),
    status: z.nativeEnum(ApprovalStatus).optional(),
    type: z
      .enum([ApprovalType.OVERTIME, ApprovalType.PAYROLL_ADJUSTMENT])
      .optional(),
    organizationId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" });
const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}$/, { message: "Month must be YYYY-MM" });
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Time must be HH:mm" });

const overtimePayloadSchema = z.object({
  workDate: dateString,
  startTime: timeString,
  endTime: timeString,
  totalHours: z.number().positive().max(24),
  reason: z.string().trim().min(1).max(1000),
});

const payrollAdjustmentPayloadSchema = z.object({
  adjustmentType: z.enum(["BONUS", "DEDUCTION", "ALLOWANCE", "CORRECTION"]),
  amount: z.number().positive(),
  currency: z.string().trim().length(3).toUpperCase(),
  effectiveMonth: monthString,
  reason: z.string().trim().min(1).max(1000),
});

const approvalBaseSchema = z.object({
  targetEmployeeId: z.number().int().positive().optional(),
});

const overtimeApprovalSchema = approvalBaseSchema.extend({
  type: z.literal(ApprovalType.OVERTIME),
  payload: overtimePayloadSchema,
});

const payrollAdjustmentApprovalSchema = approvalBaseSchema.extend({
  type: z.literal(ApprovalType.PAYROLL_ADJUSTMENT),
  payload: payrollAdjustmentPayloadSchema,
});

export const createApprovalSchema = z.object({
  body: z.discriminatedUnion("type", [
    overtimeApprovalSchema,
    payrollAdjustmentApprovalSchema,
  ]),
});

export const decideApprovalSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().max(1000).optional(),
  }),
});


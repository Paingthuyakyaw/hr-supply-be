import z from "zod";
import { ContractStatus } from "../generated/prisma/enums";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });
const contractIdParam = z
  .string()
  .regex(/^\d+$/, { message: "contractId must be a positive integer" });

export const employeeContractListSchema = z.object({
  params: z.object({
    id: idParam,
  }),
});

export const createEmployeeContractSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z.object({
    fileUrl: z.string().trim().min(1),
    status: z.nativeEnum(ContractStatus).optional(),
    expiresAt: z.string().datetime().optional(),
    reminderDays: z.number().int().min(1).max(365).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const updateEmployeeContractSchema = z.object({
  params: z.object({
    id: idParam,
    contractId: contractIdParam,
  }),
  body: z
    .object({
      fileUrl: z.string().trim().min(1).optional(),
      status: z.nativeEnum(ContractStatus).optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      reminderDays: z.number().int().min(1).max(365).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    })
    .refine(
      (value) =>
        typeof value.fileUrl !== "undefined" ||
        typeof value.status !== "undefined" ||
        typeof value.expiresAt !== "undefined" ||
        typeof value.reminderDays !== "undefined" ||
        typeof value.notes !== "undefined",
      { message: "At least one field is required for update" },
    ),
});

import z from "zod";
import { EmployeeStatus } from "../generated/prisma/enums";

const idParam = z
  .string()
  .regex(/^\d+$/, { message: "id must be a positive integer" });

export const employeeLifecycleTransitionSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z.object({
    status: z.nativeEnum(EmployeeStatus),
  }),
});

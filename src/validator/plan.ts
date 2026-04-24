import z from "zod";
import { Action, MenuCode } from "../generated/prisma/enums";

const permissionItemSchema = z.object({
  menu: z.nativeEnum(MenuCode, {
    message: "Invalid menu code",
  }),
  actions: z
    .array(z.nativeEnum(Action, { message: "Invalid action" }))
    .min(1, { message: "At least one action is required" }),
});

export const editPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, { message: "ID must be required" }),
  }),
  body: z.object({
    code: z.string().min(1, { message: "Code must be required" }),
    name: z.string().min(1, { message: "Name must be required" }),
    permission: z.array(permissionItemSchema).optional(),
  }),
});

export const createPlanSchema = z.object({
  body: z.object({
    code: z.string().min(1, { message: "Code must be required" }),
    name: z.string().min(1, { message: "Name must be required" }),
    permission: z.array(permissionItemSchema).optional(),
  }),
});

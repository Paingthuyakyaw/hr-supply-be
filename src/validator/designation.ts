import z from "zod";
import { Action, MenuCode } from "../generated/prisma/enums";

const idSchema = z
  .string()
  .regex(/^\d+$/, { message: "id must be a positive integer" });

const employeeIdSchema = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+$/, { message: "employeeIds must contain valid ids" }),
]);

const permissionSchema = z.object({
  menu: z.nativeEnum(MenuCode, { message: "Invalid menu code" }),
  actions: z
    .array(z.nativeEnum(Action, { message: "Invalid action" }))
    .min(1, { message: "At least one action is required" }),
});

export const designationListSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const designationIdParamSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
});

export const createDesignationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    permissions: z.array(permissionSchema).optional(),
    employeeIds: z.array(employeeIdSchema).optional(),
  }),
});

export const updateDesignationSchema = z.object({
  params: z.object({
    id: idSchema,
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      permissions: z.array(permissionSchema).optional(),
      employeeIds: z.array(employeeIdSchema).optional(),
    })
    .refine(
      (body) =>
        typeof body.name !== "undefined" ||
        typeof body.permissions !== "undefined" ||
        typeof body.employeeIds !== "undefined",
      { message: "At least one field is required for update" },
    ),
});

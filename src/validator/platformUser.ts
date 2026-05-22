import z from "zod";
import { PlatformPermission } from "../generated/prisma/enums";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });

export const platformUserListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
    q: z.string().trim().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

export const createPlatformUserSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    fullName: z.string().trim().min(2).max(120),
    password: z.string().min(6).max(128),
    isActive: z.boolean().optional(),
    permissions: z.array(z.nativeEnum(PlatformPermission)).min(1),
  }),
});

export const updatePlatformUserSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z
    .object({
      fullName: z.string().trim().min(2).max(120).optional(),
      password: z.string().min(6).max(128).optional(),
      isActive: z.boolean().optional(),
      permissions: z.array(z.nativeEnum(PlatformPermission)).min(1).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
});

export const platformUserIdParamSchema = z.object({
  params: z.object({
    id: idParam,
  }),
});

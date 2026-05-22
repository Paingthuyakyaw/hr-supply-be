import z from "zod";

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  }),
});

export const mobileLoginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1),
    password: z.string().min(1),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

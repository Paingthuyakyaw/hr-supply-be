import z from "zod";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });

export const approveOrganizationSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z.object({
    ownerEmail: z.string().trim().email().optional(),
    ownerName: z.string().trim().min(2).max(120).optional(),
  }),
});

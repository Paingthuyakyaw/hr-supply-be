import z from "zod";

export const editPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, { message: "ID must be required" }),
  }),
  body: z.object({
    code: z.string().min(1, { message: "Code must be required" }),
    name: z.string().min(1, { message: "Name must be required" }),
  }),
});

export const createPlanSchema = z.object({
  body: z.object({
    code: z.string().min(1, { message: "Code must be required" }),
    name: z.string().min(1, { message: "Name must be required" }),
  }),
});

import z from "zod";

const uploadPurposeSchema = z.enum([
  "employee_avatar",
  "employee_id_front",
  "employee_id_back",
  "employee_contract",
]);

const uploadPolicy = {
  employee_avatar: {
    maxBytes: 3 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    folder: "employees/avatar",
  },
  employee_id_front: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    folder: "employees/id/front",
  },
  employee_id_back: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    folder: "employees/id/back",
  },
  employee_contract: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    folder: "employees/contracts",
  },
} as const;

export type UploadPurpose = keyof typeof uploadPolicy;

export const uploadPresignSchema = z.object({
  body: z.object({
    purpose: uploadPurposeSchema,
    fileName: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    size: z.coerce.number().int().positive(),
  }),
});

export const getUploadPolicy = (purpose: UploadPurpose) => uploadPolicy[purpose];

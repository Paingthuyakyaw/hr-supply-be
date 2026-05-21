import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/httpResponse";
import { createPresignedUpload } from "../utils/r2";
import { getUploadPolicy, type UploadPurpose } from "../validator/upload";

export const createUploadPresign = async (req: Request, res: Response) => {
  try {
    const { purpose, fileName, contentType, size } = req.body as {
      purpose: UploadPurpose;
      fileName: string;
      contentType: string;
      size: number;
    };

    const policy = getUploadPolicy(purpose);
    if (!(policy.mimeTypes as readonly string[]).includes(contentType)) {
      return sendError(res, {
        status: 400,
        message: "Unsupported file type for selected purpose",
      });
    }

    if (size > policy.maxBytes) {
      return sendError(res, {
        status: 400,
        message: `File size exceeds limit (${policy.maxBytes} bytes)`,
      });
    }

    const presign = await createPresignedUpload({
      folder: policy.folder,
      filename: fileName,
      contentType,
    });

    return sendSuccess(res, {
      message: "Upload URL created",
      data: presign,
    });
  } catch (error) {
    return sendError(res, {
      status: 500,
      message: "Failed to generate upload URL",
      error,
    });
  }
};

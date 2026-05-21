import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
const expiresIn = Number(process.env.R2_PRESIGN_EXPIRES_IN ?? 300);

const ensureR2Env = () => {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 environment variables are missing");
  }
};

const buildPublicUrl = (objectKey: string) => {
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/${objectKey}`;
  }

  // Works when bucket is configured to be publicly readable.
  return `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${objectKey}`;
};

const getFileExtension = (filename: string) => {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDotIndex).toLowerCase();
};

const getR2Client = () => {
  ensureR2Env();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
};

export const createPresignedUpload = async ({
  folder,
  filename,
  contentType,
}: {
  folder: string;
  filename: string;
  contentType: string;
}) => {
  ensureR2Env();
  const extension = getFileExtension(filename);
  const objectKey = `${folder}/${Date.now()}-${randomUUID()}${extension}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, {
    expiresIn,
  });

  return {
    objectKey,
    uploadUrl,
    fileUrl: buildPublicUrl(objectKey),
    expiresIn,
  };
};

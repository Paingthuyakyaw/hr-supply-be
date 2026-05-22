import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const DEFAULT_SETUP_TOKEN_TTL_MINUTES = Number(
  process.env.ORG_SETUP_TOKEN_TTL_MINUTES ?? 30,
);
const REQUEST_TIMEOUT_MS = Number(
  process.env.ORG_ONBOARDING_WEBHOOK_TIMEOUT_MS ?? 5000,
);

const buildSetupLink = (rawToken: string, organizationId: number, email: string) => {
  const setupBaseUrl = process.env.ORG_SETUP_LINK_BASE_URL;
  if (!setupBaseUrl) return null;
  const url = new URL(setupBaseUrl);
  url.searchParams.set("token", rawToken);
  url.searchParams.set("orgId", String(organizationId));
  url.searchParams.set("email", email);
  return url.toString();
};

export const createOnboardingToken = () => {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + DEFAULT_SETUP_TOKEN_TTL_MINUTES * 60 * 1000,
  );
  return { rawToken, tokenHash, expiresAt };
};

export const hashOnboardingToken = (rawToken: string) =>
  createHash("sha256").update(rawToken).digest("hex");

export const sendOrganizationOnboardingWebhook = async (payload: {
  organizationId: number;
  organizationName: string;
  ownerEmail: string;
  ownerName: string;
  setupToken: string;
  expiresAt: Date;
}) => {
  const webhookUrl =
    process.env.N8N_ORG_ONBOARDING_WEBHOOK_URL ?? process.env.N8N_ONBOARDING_WEBHOOK_URL;
  if (!webhookUrl) return;

  const setupLink = buildSetupLink(
    payload.setupToken,
    payload.organizationId,
    payload.ownerEmail,
  );
  if (!setupLink) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_ONBOARDING_SECRET
          ? { "x-onboarding-secret": process.env.N8N_ONBOARDING_SECRET }
          : {}),
      },
      body: JSON.stringify({
        event: "organization.owner.setup",
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        ownerEmail: payload.ownerEmail,
        ownerName: payload.ownerName,
        setupLink,
        expiresAt: payload.expiresAt.toISOString(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawBody = await response.text().catch(() => "");
      throw new Error(
        `Organization onboarding webhook failed with status ${response.status}. ${rawBody}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
};

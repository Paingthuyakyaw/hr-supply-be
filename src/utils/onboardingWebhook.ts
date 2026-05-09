type EmployeeCreatedOnboardingPayload = {
  event: "employee.created";
  employeeId: number;
  organizationId: number;
  departmentId: number;
  fullName: string;
  email: string | null;
  code: string;
  dateJoined: string;
  probationDays: number;
  setupLink: string | null;
  tempPassword: string | null;
};

const DEFAULT_PROBATION_DAYS = Number(process.env.ONBOARDING_PROBATION_DAYS ?? 90);
const REQUEST_TIMEOUT_MS = Number(process.env.ONBOARDING_WEBHOOK_TIMEOUT_MS ?? 5000);

const buildSetupLink = (employeeId: number, email: string | null) => {
  const setupBaseUrl = process.env.ONBOARDING_SETUP_LINK_BASE_URL;
  if (!setupBaseUrl) return null;

  const url = new URL(setupBaseUrl);
  url.searchParams.set("employeeId", String(employeeId));
  if (email) {
    url.searchParams.set("email", email);
  }
  return url.toString();
};

export const sendEmployeeCreatedOnboardingWebhook = async (payload: {
  employeeId: number;
  organizationId: number;
  departmentId: number;
  fullName: string;
  email: string | null;
  code: string;
  dateJoined: Date;
  tempPassword: string | null;
}) => {
  const webhookUrl = process.env.N8N_ONBOARDING_WEBHOOK_URL;
  if (!webhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const requestBody: EmployeeCreatedOnboardingPayload = {
      event: "employee.created",
      employeeId: payload.employeeId,
      organizationId: payload.organizationId,
      departmentId: payload.departmentId,
      fullName: payload.fullName,
      email: payload.email,
      code: payload.code,
      dateJoined: payload.dateJoined.toISOString(),
      probationDays: DEFAULT_PROBATION_DAYS,
      setupLink: buildSetupLink(payload.employeeId, payload.email),
      tempPassword: payload.tempPassword,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_ONBOARDING_SECRET
          ? { "x-onboarding-secret": process.env.N8N_ONBOARDING_SECRET }
          : {}),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawBody = await response.text().catch(() => "");
      throw new Error(
        `Onboarding webhook failed with status ${response.status}. ${rawBody}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
};

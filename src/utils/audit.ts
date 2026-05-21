type AuditAction = "CREATE" | "UPDATE" | "DELETE";

type AuditEventPayload = {
  actorId?: number | null;
  actorOrgId?: number | null;
  entity: string;
  entityId?: number | string | null;
  action: AuditAction;
  changes?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export const logAuditEvent = (payload: AuditEventPayload) => {
  const event = {
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Structured stdout log, ready for Datadog/CloudWatch/ELK ingestion.
  console.info("[AUDIT]", JSON.stringify(event));
};

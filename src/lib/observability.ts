type LogLevel = "info" | "warn" | "error";

export function getCorrelationId(request: Request) {
  return (
    request.headers.get("x-correlation-id") ??
    request.headers.get("x-request-id") ??
    crypto.randomUUID()
  );
}

export function withCorrelationId<T extends Response>(response: T, correlationId: string): T {
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export function logApiEvent(
  level: LogLevel,
  event: string,
  payload: Record<string, unknown> = {},
) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  });

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

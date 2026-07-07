export function getRequestMeta(req: any): { ipAddress?: string; userAgent?: string } {
  if (!req) return {};
  const ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || undefined;
  const ua = req.headers?.["user-agent"] || undefined;
  return { ipAddress: ip, userAgent: ua };
}

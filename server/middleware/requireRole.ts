import { TRPCError } from "@trpc/server";

export function requireRole(user: { role?: string } | null, roles: string[]) {
  if (!user || !user.role || !roles.includes(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Permiso denegado. Requiere rol: " + roles.join(", "),
    });
  }
}

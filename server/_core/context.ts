import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import type { OrgRole } from "../../shared/leads";
import { ACTIVE_ORG_COOKIE_NAME } from "../../shared/const";
import { sdk } from "./sdk";

/**
 * User enriquecido con los campos de org activa que se resuelven
 * en el context (cookie active_org_id + orgRole de la membresia).
 * El tipo User del schema no tiene estos campos; los agregamos
 * via intersection para que las queries internas (canUserAccessLead,
 * listVisibleLeadRows) puedan filtrar correctamente.
 */
export type AuthenticatedUser = User & {
  activeOrgId: number | null;
  activeOrgRole: OrgRole | null;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  /**
   * ID de la organización activa del usuario. Se resuelve desde
   * la cookie `active_org_id`. Es null si el usuario no está
   * autenticado, no tiene membresías, o no ha seleccionado org.
   * Los procedures con `orgProcedure` lanzan error si es null.
   */
  activeOrganizationId: number | null;
};

/**
 * Lee la cookie active_org_id del request. La cookie es
 * legible por el cliente (no httpOnly) porque el frontend
 * la necesita para mostrar el OrgSwitcher y validar antes
 * de hacer fetch.
 */
function readActiveOrgIdFromCookie(req: CreateExpressContextOptions["req"]): number | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parseCookieHeader(cookieHeader);
  const raw = cookies[ACTIVE_ORG_COOKIE_NAME];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    if (user) {
      console.log(`[Context] User authenticated: ${user.name} (${user.role})`);
    } else {
      console.log(`[Context] No user found in request`);
    }
  } catch (error: any) {
    const isSessionCookieError = error?.message === "Invalid session cookie";
    if (!isSessionCookieError) {
      console.error(`[Context] Auth error:`, error);
    }
    user = null;
  }

  const activeOrganizationId = user
    ? readActiveOrgIdFromCookie(opts.req)
    : null;

  // Resolver el rol del user dentro de la org activa (para que
  // canUserAccessLead distinga owner/admin de agent/viewer).
  // Se hace lazy: si la cookie no es valida o el user no es
  // miembro, activeOrgRole queda null.
  let activeOrgRole: "owner" | "admin" | "agent" | "viewer" | null = null;
  if (user && activeOrganizationId) {
    try {
      const { getDb } = await import("../db");
      const conn = await getDb();
      if (conn) {
        const { organizationMembers } = await import("../../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        const [member] = await conn
          .select({ orgRole: organizationMembers.orgRole })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, user.id),
              eq(organizationMembers.organizationId, activeOrganizationId),
              eq(organizationMembers.status, "active")
            )
          )
          .limit(1);
        activeOrgRole = ((member?.orgRole ?? null) as OrgRole) ?? null;
      }
    } catch (err) {
      // No romper el request si la DB no responde
      console.warn("[Context] No se pudo resolver activeOrgRole:", err);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user: user
      ? ({
          ...user,
          activeOrgId: activeOrganizationId,
          activeOrgRole,
        } as AuthenticatedUser)
      : user,
    activeOrganizationId,
  };
}

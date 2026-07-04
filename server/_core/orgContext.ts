import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { organizationMembers } from "../../drizzle/schema";
import { NO_ACTIVE_ORG_ERR_MSG } from "../../shared/const";

/**
 * Verifica que el usuario autenticado es miembro activo de
 * la organización `activeOrganizationId` presente en el
 * contexto. Devuelve el id validado o lanza UNAUTHORIZED
 * si la cookie no coincide con una membresía real.
 *
 * Se usa dentro del middleware de `orgProcedure` para
 * impedir que un usuario manipule la cookie y lea datos
 * de una organización a la que no pertenece.
 */
export async function assertActiveOrgMembership(
  userId: number,
  activeOrganizationId: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [row] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, activeOrganizationId),
        eq(organizationMembers.status, "active")
      )
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: NO_ACTIVE_ORG_ERR_MSG,
    });
  }
  return activeOrganizationId;
}

/**
 * Devuelve la primera organización activa del usuario,
 * ordenando por id ASC (la org con id=1 es la default
 * del backfill). Se usa como fallback cuando el usuario
 * tiene membresías pero no hay cookie `active_org_id`.
 */
export async function getFirstActiveOrgForUser(
  userId: number
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "active")
      )
    )
    .orderBy(organizationMembers.organizationId)
    .limit(1);
  return row?.organizationId ?? null;
}

/**
 * Cuenta las membresías activas del usuario. Se usa en el
 * login para decidir si auto-seleccionar la primera org
 * o devolver la lista para que el usuario elija.
 */
export async function countActiveMemberships(
  userId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "active")
      )
    );
  return rows.length;
}

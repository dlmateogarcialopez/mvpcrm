import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { logAudit } from "../db";
import { getRequestMeta } from "../middleware/auditContext";
import {
  protectedProcedure,
  orgProcedure,
  superadminProcedure,
  router,
} from "../_core/trpc";
import {
  addMemberToOrganization,
  createInvitation,
  createOrganization,
  deleteOrganizationById,
  getInvitationByToken,
  getOrganizationById,
  getOrganizationMember,
  getOrganizationSettings,
  listAllOrganizationsWithCounts,
  listOrganizationMembers,
  listOrganizationsForUser,
  listPendingInvitations,
  markInvitationAccepted,
  removeOrganizationMember,
  updateOrganization,
  updateOrganizationMember,
  updateOrganizationSettings,
  updateUserTelegramChatId,
} from "../db";
import {
  countActiveMemberships,
  getFirstActiveOrgForUser,
} from "../_core/orgContext";
import { ACTIVE_ORG_COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getActiveOrgCookieOptions } from "../_core/cookies";
import { orgRoleValues } from "../../shared/leads";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const orgRoleSchema = z.enum([
  orgRoleValues[0],
  orgRoleValues[1],
  orgRoleValues[2],
  orgRoleValues[3],
] as [string, ...string[]]);

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones");

/**
 * Router de organizaciones (multi-tenant).
 *
 * Expone:
 *  - myOrganizations: lista las orgs del usuario autenticado
 *  - select: cambia la org activa (setea cookie active_org_id)
 *  - current: settings de la org activa
 *  - create: solo superadmin crea nuevas orgs
 *  - update: solo owner de la org o superadmin
 *  - updateSettings: solo owner o admin
 *  - members: lista los miembros de la org activa
 *  - invite: solo admin/owner; crea invitation + (en fase 3) envía email
 *  - removeMember: solo owner
 *  - acceptInvitation: público, valida token
 *  - getInvitation: público, devuelve datos básicos de la invitación
 */
export const organizationsRouter = router({
  /**
   * Devuelve las organizaciones a las que pertenece el usuario
   * autenticado. Si el usuario no tiene orgs, devuelve [].
   * Usado en el login para mostrar el OrgSwitcher / selector.
   */
  myOrganizations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return listOrganizationsForUser(ctx.user.id);
  }),

  /**
   * Devuelve la primera org del usuario (o null). Usado por el
   * login para auto-seleccionar cuando el usuario tiene una sola org.
   */
  firstForCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    return getFirstActiveOrgForUser(ctx.user.id);
  }),

  /**
   * Cuenta las membresías activas del usuario. Usado por el
   * login para decidir si auto-seleccionar o pedir que elija.
   */
  countForCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return 0;
    return countActiveMemberships(ctx.user.id);
  }),

  /**
   * Cambia la organización activa del usuario. Setea la
   * cookie `active_org_id` que el middleware orgContext lee.
   * Solo permite seleccionar orgs a las que el usuario pertenece.
   */
  select: protectedProcedure
    .input(z.object({ organizationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const member = await getOrganizationMember(
        ctx.user.id,
        input.organizationId
      );
      if (!member || member.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No perteneces a esta organización.",
        });
      }
      const cookieOptions = getActiveOrgCookieOptions(ctx.req);
      ctx.res.cookie(ACTIVE_ORG_COOKIE_NAME, String(input.organizationId), {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      return { success: true, organizationId: input.organizationId };
    }),

  /**
   * Limpia la cookie de org activa (logout de org).
   * El usuario sigue autenticado, solo se deselecciona la org.
   */
  clearActive: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const cookieOptions = getActiveOrgCookieOptions(ctx.req);
    ctx.res.clearCookie(ACTIVE_ORG_COOKIE_NAME, {
      ...cookieOptions,
      maxAge: -1,
    });
    return { success: true };
  }),

  /**
   * Actualiza el telegramChatId de un usuario de la organización.
   */
  updateMemberTelegram: orgProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        telegramChatId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
      if (!me || (me.orgRole !== "owner" && me.orgRole !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo admin/owner pueden editar datos de miembros.",
        });
      }
      await updateUserTelegramChatId(input.userId, input.telegramChatId);
      return { success: true };
    }),

  /**
   * Invitación pública: cualquier usuario autenticado con link
   * puede aceptar una invitación pendiente.
   */
  currentSettings: orgProcedure.query(async ({ ctx }) => {
    const settings = await getOrganizationSettings(ctx.organizationId);
    if (!settings) {
      // Fallback defensivo: si no hay fila, devolver defaults
      // para que la UI no rompa. La org default siempre tiene fila.
      return {
        id: 0,
        organizationId: ctx.organizationId,
        displayName: null,
        primaryColor: null,
        logoUrl: null,
        faviconUrl: null,
        pricing: null,
        scoring: null,
        meta: null,
        integrations: null,
        updatedAt: new Date(),
      };
    }
    return settings;
  }),

  /**
   * Lista los miembros de la org activa. Solo admin/owner de
   * la org pueden ver la lista completa.
   */
  members: orgProcedure.query(async ({ ctx }) => {
    const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
    if (!me || (me.orgRole !== "owner" && me.orgRole !== "admin")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Solo administradores pueden ver la lista de miembros.",
      });
    }
    return listOrganizationMembers(ctx.organizationId);
  }),

  /**
   * Miembros de la organización que tienen telegramChatId configurado.
   * Se usa en el selector de destinatarios de reglas de automatización.
   * Devuelve userId, name, email, y telegramChatId de cada miembro con Telegram.
   */
  membersWithTelegram: orgProcedure.query(async ({ ctx }) => {
    const all = await listOrganizationMembers(ctx.organizationId);
    return all
      .filter(
        m => m.user.telegramChatId && m.user.telegramChatId.trim().length > 0
      )
      .map(m => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        telegramChatId: m.user.telegramChatId,
      }));
  }),

  /**
   * Invitaciones pendientes de la org activa. Solo admin/owner.
   */
  pendingInvitations: orgProcedure.query(async ({ ctx }) => {
    const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
    if (!me || (me.orgRole !== "owner" && me.orgRole !== "admin")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Solo administradores pueden ver invitaciones.",
      });
    }
    return listPendingInvitations(ctx.organizationId);
  }),

  /**
   * Crea una nueva organización. Solo superadmin.
   * El usuario que la crea queda automáticamente como owner.
   */
  create: superadminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(200),
        slug: slugSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = await createOrganization({
        name: input.name,
        slug: input.slug,
        createdByUserId: ctx.user.id,
      });
      await logAudit({
        organizationId: created.id,
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email ?? null,
        actorName: ctx.user.name ?? null,
        action: "create",
        entityType: "org",
        entityId: String(created.id),
        entityName: input.name,
        summary: `Creó la organización "${input.name}"`,
      });
      return created;
    }),

  /**
   * Actualiza el nombre o estado de la org activa. Solo owner.
   */
  update: orgProcedure
    .input(
      z.object({
        name: z.string().min(2).max(200).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
      if (!me || me.orgRole !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el owner puede modificar la organización.",
        });
      }
      const updated = await updateOrganization({
        id: ctx.organizationId,
        name: input.name,
        status: input.status,
      });
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada.",
        });
      }
      return updated;
    }),

  /**
   * Actualiza los settings de la org activa (branding, pricing,
   * scoring, integraciones). Solo admin/owner.
   */
  updateSettings: orgProcedure
    .input(
      z.object({
        displayName: z.string().max(200).nullable().optional(),
        primaryColor: z.string().max(20).nullable().optional(),
        logoUrl: z.string().url().nullable().optional(),
        faviconUrl: z.string().url().nullable().optional(),
        pricing: z.record(z.string(), z.unknown()).nullable().optional(),
        scoring: z.record(z.string(), z.unknown()).nullable().optional(),
        meta: z.record(z.string(), z.unknown()).nullable().optional(),
        integrations: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
      if (!me || (me.orgRole !== "owner" && me.orgRole !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo administradores pueden modificar la configuración.",
        });
      }
      const updated = await updateOrganizationSettings({
        organizationId: ctx.organizationId,
        displayName: input.displayName,
        primaryColor: input.primaryColor,
        logoUrl: input.logoUrl,
        faviconUrl: input.faviconUrl,
        pricing: input.pricing ?? undefined,
        scoring: input.scoring ?? undefined,
        meta: input.meta ?? undefined,
        integrations: input.integrations ?? undefined,
      });
      return updated;
    }),

  /**
   * Invita a un usuario por email. Crea una fila en
   * organization_invitations con un token único. El envío de
   * email real se hace en fase 3 (frontend de invitaciones);
   * por ahora el token se devuelve para testing.
   *
   * Si el email ya pertenece a un usuario registrado, además
   * crea la membresía directamente (link mágico).
   */
  invite: orgProcedure
    .input(
      z.object({
        email: z.string().email(),
        orgRole: orgRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
      if (!me || (me.orgRole !== "owner" && me.orgRole !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo administradores pueden invitar usuarios.",
        });
      }
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);
      const invitation = await createInvitation({
        organizationId: ctx.organizationId,
        email: input.email,
        orgRole: input.orgRole as "owner" | "admin" | "agent" | "viewer",
        invitedByUserId: ctx.user.id,
        token,
        expiresAt,
      });
      return invitation;
    }),

  /**
   * Cambia el rol de un miembro dentro de la org activa. Solo owner.
   */
  updateMemberRole: orgProcedure
    .input(
      z.object({
        memberId: z.number().int().positive(),
        orgRole: orgRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
      if (!me || me.orgRole !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el owner puede cambiar roles.",
        });
      }
      const updated = await updateOrganizationMember({
        id: input.memberId,
        orgRole: input.orgRole as "owner" | "admin" | "agent" | "viewer",
      });
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada.",
        });
      }
      if (input.name || input.status) {
        await logAudit({
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email ?? null,
          actorName: ctx.user.name ?? null,
          action: "update",
          entityType: "org",
          entityId: String(ctx.organizationId),
          entityName: updated.name,
          summary: `Actualizó la organización "${updated.name}"`,
          details: input,
        });
      }
      return updated;
    }),

  /**
   * Remueve un miembro de la org activa. Solo owner; no se
   * puede remover a sí mismo (para evitar dejar la org sin
   * owners; usar `transferOwnership` en fase futura).
   */
  removeMember: orgProcedure
    .input(z.object({ memberId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const me = await getOrganizationMember(ctx.user.id, ctx.organizationId);
      if (!me || me.orgRole !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el owner puede remover miembros.",
        });
      }
      if (input.memberId === me.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes removerte a ti mismo.",
        });
      }
      await removeOrganizationMember(input.memberId);
      return { success: true };
    }),

  /**
   * Acepta una invitación. Público (no requiere auth). Si
   * el usuario está autenticado, lo agrega a la org; si no,
   * devuelve los datos para que la UI redirija a registro.
   */
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await getInvitationByToken(input.token);
      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitación no encontrada.",
        });
      }
      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La invitación ya fue ${invitation.status}.`,
        });
      }
      if (invitation.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La invitación ha expirado.",
        });
      }
      await addMemberToOrganization({
        organizationId: invitation.organizationId,
        userId: ctx.user.id,
        orgRole: invitation.orgRole as "owner" | "admin" | "agent" | "viewer",
      });
      await markInvitationAccepted(invitation.id);

      // Auto-seleccionar la nueva org
      const cookieOptions = getActiveOrgCookieOptions(ctx.req);
      ctx.res.cookie(
        ACTIVE_ORG_COOKIE_NAME,
        String(invitation.organizationId),
        {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        }
      );

      const org = await getOrganizationById(invitation.organizationId);
      return { success: true, organization: org };
    }),

  /**
   * Devuelve los datos bǭsicos de una invitaci��n por token.
   * Pǧblico (no requiere auth) para que la pǭgina de aceptaci��n
   * pueda mostrar "Te estǭn invitando a X".
   */
  getInvitation: protectedProcedure
    .input(z.object({ token: z.string().min(10) }))
    .query(async ({ input }) => {
      const invitation = await getInvitationByToken(input.token);
      if (!invitation) return null;
      const org = await getOrganizationById(invitation.organizationId);
      return {
        invitation: {
          email: invitation.email,
          orgRole: invitation.orgRole,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        organization: org
          ? {
              id: org.id,
              name: org.name,
              slug: org.slug,
            }
          : null,
      };
    }),

  /**
   * Lista TODAS las organizaciones del sistema. Solo superadmin.
   * Usado en el panel "Organizaciones" de SettingsPage para que
   * el superadmin pueda ver/crear/editar/archivar cualquier org
   * sin tener que pertenecer a ella.
   *
   * Devuelve cada org con: id, name, slug, status, createdAt,
   * y el conteo de miembros activos (memberCount).
   */
  listAll: superadminProcedure.query(async () => {
    return listAllOrganizationsWithCounts();
  }),

  /**
   * Archiva (paused/archived) una org. Solo superadmin.
   * Una org archivada no es seleccionable desde el OrgSwitcher
   * ni acepta nuevas invitaciones.
   */
  archive: superadminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["active", "paused", "archived"]),
      })
    )
    .mutation(async ({ input }) => {
      const updated = await updateOrganization({
        id: input.id,
        status: input.status,
      });
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada.",
        });
      }
      return updated;
    }),

  /**
   * Elimina una organización de forma permanente. Solo el superadmin.
   * Borra todos los datos asociados (cascade FK + leads manualmente).
   * Devuelve `success: false` si la organización no existe.
   */
  delete: superadminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const orgSnapshot = await getOrganizationById(input.id);
      const ok = await deleteOrganizationById(input.id);
      if (!ok) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada.",
        });
      }
      if (orgSnapshot) {
        await logAudit({
          organizationId: input.id,
          actorUserId: ctx.user?.id,
          actorEmail: ctx.user?.email ?? null,
          actorName: ctx.user?.name ?? null,
          action: "delete",
          entityType: "org",
          entityId: String(input.id),
          entityName: orgSnapshot.name,
          summary: `Eliminó la organización "${orgSnapshot.name}"`,
        });
      }
      return { success: true, id: input.id };
    }),
});

import { TRPCError } from "@trpc/server";
import {
  addLeadActivity,
  createLead,
  getDashboardSnapshot,
  getLeadByPublicId,
  listLeads,
  listLeadsForExport,
  updateLead,
  updateLeadStatus,
  type CurrentUser,
} from "../db";
import {
  leadActivityCreateSchema,
  leadCreateSchema,
  leadFiltersSchema,
  leadIdSchema,
  leadStatusUpdateSchema,
  leadUpdateSchema,
} from "../../shared/leadSchemas";
import { protectedProcedure, router } from "../_core/trpc";
import { runLeadAutomation } from "../services/leadAutomation";
import { buildLeadWorkbookBuffer } from "../services/leadExport";

type RouterUser = Pick<CurrentUser, "id" | "role" | "name" | "email">;

function toCurrentUser(user: RouterUser): CurrentUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}

async function loadLeadOrThrow(publicId: string, user: CurrentUser) {
  const lead = await getLeadByPublicId(publicId, user);

  if (!lead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead no encontrado." });
  }

  return lead;
}

export const leadsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    return getDashboardSnapshot(toCurrentUser(ctx.user));
  }),

  list: protectedProcedure.input(leadFiltersSchema).query(async ({ ctx, input }) => {
    return listLeads(input, toCurrentUser(ctx.user));
  }),

  exportSpreadsheet: protectedProcedure.mutation(async ({ ctx }) => {
    const rows = await listLeadsForExport(toCurrentUser(ctx.user));
    const workbook = buildLeadWorkbookBuffer(rows);
    const exportedAt = new Date();
    const stamp = exportedAt.toISOString().slice(0, 19).replace(/[T:]/g, "-");

    return {
      fileName: `crm-leads-${stamp}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rowCount: rows.length,
      exportedAt: exportedAt.toISOString(),
      base64: workbook.toString("base64"),
    };
  }),

  byId: protectedProcedure.input(leadIdSchema).query(async ({ ctx, input }) => {
    return loadLeadOrThrow(input.publicId, toCurrentUser(ctx.user));
  }),

  create: protectedProcedure.input(leadCreateSchema).mutation(async ({ ctx, input }) => {
    const currentUser = toCurrentUser(ctx.user);
    const lead = await createLead(input, currentUser);

    if (!lead) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No fue posible crear el lead." });
    }

    const automation = await runLeadAutomation(lead, ctx.user.id);
    const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

    return {
      lead: refreshedLead,
      automation,
    };
  }),

  update: protectedProcedure.input(leadUpdateSchema).mutation(async ({ ctx, input }) => {
    const currentUser = toCurrentUser(ctx.user);
    const lead = await updateLead(input, currentUser);

    if (!lead) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lead no encontrado o sin permisos para editarlo." });
    }

    const automation = await runLeadAutomation(lead, ctx.user.id);
    const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

    return {
      lead: refreshedLead,
      automation,
    };
  }),

  updateStatus: protectedProcedure.input(leadStatusUpdateSchema).mutation(async ({ ctx, input }) => {
    const currentUser = toCurrentUser(ctx.user);
    const lead = await updateLeadStatus(input, currentUser);

    if (!lead) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lead no encontrado o sin permisos para actualizarlo." });
    }

    const automation = await runLeadAutomation(lead, ctx.user.id);
    const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

    return {
      lead: refreshedLead,
      automation,
    };
  }),

  addActivity: protectedProcedure.input(leadActivityCreateSchema).mutation(async ({ ctx, input }) => {
    const currentUser = toCurrentUser(ctx.user);
    const lead = await addLeadActivity(input, currentUser);

    if (!lead) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lead no encontrado o sin permisos para registrar actividad." });
    }

    return lead;
  }),

  runAutomation: protectedProcedure.input(leadIdSchema).mutation(async ({ ctx, input }) => {
    const currentUser = toCurrentUser(ctx.user);
    const lead = await loadLeadOrThrow(input.publicId, currentUser);
    const automation = await runLeadAutomation(lead, ctx.user.id);
    const refreshedLead = await loadLeadOrThrow(input.publicId, currentUser);

    return {
      lead: refreshedLead,
      automation,
    };
  }),
});

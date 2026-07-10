import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { orgProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { logAudit } from "../db";
import {
  createAccessToken,
  clickToCall,
  sendSms,
} from "../services/telephony/twilio";
import {
  startQueue as startQueueEngine,
  advanceQueue,
  markAnswered as markAnsweredEngine,
  markNoAnswer as markNoAnswerEngine,
  pauseQueue as pauseQueueEngine,
  resumeQueue as resumeQueueEngine,
  cancelQueue as cancelQueueEngine,
  skipLead as skipLeadEngine,
  getCurrentQueueLead,
  requestCallForQueueLead,
} from "../services/dialing/queueEngine";
import {
  dialAttempts,
  smsMessages,
  callRecordings,
  dialingQueues,
  dialingQueueLeads,
  leads,
} from "../../drizzle/schema";

const orgId = (ctx: { organizationId: number }) => ctx.organizationId;

export const dialingRouter = router({
  // ──── WebRTC Token ────
  getToken: orgProcedure
    .input(z.object({ identity: z.string().min(1) }))
    .query(async ({ input }) => {
      const token = createAccessToken(input.identity);
      return { token };
    }),

  // ──── Click-to-Call ────
  clickToCall: orgProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        advisorPhone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [lead] = await dbc
        .select()
        .from(leads)
        .where(
          and(eq(leads.id, input.leadId), eq(leads.organizationId, orgId(ctx)))
        );

      if (!lead) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lead no encontrado.",
        });
      }

      const phone = lead.contactoTelefono || lead.telefono;
      if (!phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El lead no tiene teléfono registrado.",
        });
      }

      const host =
        ctx.req.get("host") ||
        (process.env.NODE_ENV === "production"
          ? "crm.appsbim.online"
          : "localhost:3000");
      const proto =
        ctx.req.get("x-forwarded-proto") ||
        (host.startsWith("localhost") ? "http" : "https");
      const baseUrl = `${proto}://${host}`;
      const { callSid } = await clickToCall(phone, baseUrl);

      await dbc.insert(dialAttempts).values({
        organizationId: orgId(ctx),
        queueId: 0,
        queueLeadId: 0,
        leadId: lead.id,
        userId: ctx.user.id,
        twilioCallSid: callSid,
        status: "initiated",
        initiatedAt: new Date(),
      });

      return { callSid };
    }),

  // ──── Dial Number (keypad) ────
  dialNumber: orgProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(5).max(20),
        advisorPhone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const host =
        ctx.req.get("host") ||
        (process.env.NODE_ENV === "production"
          ? "crm.appsbim.online"
          : "localhost:3000");
      const proto =
        ctx.req.get("x-forwarded-proto") ||
        (host.startsWith("localhost") ? "http" : "https");
      const baseUrl = `${proto}://${host}`;
      const { callSid } = await clickToCall(input.phoneNumber, baseUrl);
      return { callSid };
    }),

  // ──── Send SMS ────
  sendSms: orgProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        body: z.string().min(1),
        mediaUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [lead] = await dbc
        .select()
        .from(leads)
        .where(
          and(eq(leads.id, input.leadId), eq(leads.organizationId, orgId(ctx)))
        );

      if (!lead) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lead no encontrado.",
        });
      }

      const phone = lead.contactoTelefono || lead.telefono;
      if (!phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El lead no tiene teléfono.",
        });
      }

      const { messageSid } = await sendSms(phone, input.body, input.mediaUrl);

      await dbc.insert(smsMessages).values({
        organizationId: orgId(ctx),
        leadId: lead.id,
        twilioMessageSid: messageSid,
        direction: "outbound",
        fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
        toNumber: phone,
        body: input.body,
        mediaUrl: input.mediaUrl || null,
        sentAt: new Date(),
      });

      await dbc
        .update(leads)
        .set({ lastSmsAt: new Date() })
        .where(eq(leads.id, lead.id));

      return { messageSid };
    }),

  sendQuickSms: orgProcedure
    .input(
      z.object({
        toNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, {
          message: "El número debe estar en formato E.164 (ej. +573001234567)",
        }),
        body: z.string().min(1).max(1600),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const { messageSid } = await sendSms(input.toNumber, input.body);

      await dbc.insert(smsMessages).values({
        organizationId: orgId(ctx),
        leadId: null,
        twilioMessageSid: messageSid,
        direction: "outbound",
        fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
        toNumber: input.toNumber,
        body: input.body,
        numMedia: 0,
        mediaUrl: null,
        sentAt: new Date(),
      });

      await logAudit({
        organizationId: orgId(ctx),
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "create",
        entityType: "sms_quick",
        entityId: input.toNumber,
        entityName: input.toNumber,
        summary: 'Envió SMS a "' + input.toNumber + '"',
        details: { toNumber: input.toNumber, body: input.body },
      });

      return { messageSid };
    }),

  // ──── List Call History ────
  listCalls: orgProcedure
    .input(
      z.object({
        leadId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(dialAttempts.organizationId, orgId(ctx))];
      if (input.leadId) conditions.push(eq(dialAttempts.leadId, input.leadId));

      const dbc = await db.getDb();
      return dbc
        .select()
        .from(dialAttempts)
        .where(and(...conditions))
        .orderBy(desc(dialAttempts.createdAt))
        .limit(input.limit);
    }),

  // ──── List SMS Conversations ────
  listSmsConversations: orgProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const raw = await dbc
        .select({
          leadId: smsMessages.leadId,
          fromNumber: smsMessages.fromNumber,
          toNumber: smsMessages.toNumber,
          lastMessage: smsMessages.body,
          lastSentAt: smsMessages.sentAt,
        })
        .from(smsMessages)
        .where(eq(smsMessages.organizationId, orgId(ctx)))
        .orderBy(desc(smsMessages.sentAt))
        .limit(input.limit);

      // deduplicate by leadId (first occurrence = most recent)
      const seen = new Set<number>();
      const result: typeof raw = [];
      for (const r of raw) {
        if (!seen.has(r.leadId)) {
          seen.add(r.leadId);
          result.push(r);
        }
      }
      return result;
    }),

  // ──── List SMS Messages ────
  listSmsMessages: orgProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      return dbc
        .select()
        .from(smsMessages)
        .where(
          and(
            eq(smsMessages.organizationId, orgId(ctx)),
            eq(smsMessages.leadId, input.leadId)
          )
        )
        .orderBy(smsMessages.sentAt)
        .limit(input.limit);
    }),

  // ──── List Recordings ────
  listRecordings: orgProcedure
    .input(
      z.object({
        leadId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const conditions = [eq(callRecordings.organizationId, orgId(ctx))];
      if (input.leadId)
        conditions.push(eq(callRecordings.leadId, input.leadId));

      return dbc
        .select()
        .from(callRecordings)
        .where(and(...conditions))
        .orderBy(desc(callRecordings.createdAt))
        .limit(input.limit);
    }),

  // ──── Get Recording URL ────
  getRecordingUrl: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [rec] = await dbc
        .select()
        .from(callRecordings)
        .where(
          and(
            eq(callRecordings.id, input.id),
            eq(callRecordings.organizationId, orgId(ctx))
          )
        );

      if (!rec) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Grabación no encontrada.",
        });
      }

      if (!rec.filePath) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Archivo de grabación aún no disponible.",
        });
      }

      // En producción, retornar una URL firmada o proxy
      return { url: `/api/recordings/${rec.id}/audio` };
    }),

  // ──── Dialing Queue Operations ────
  listQueues: orgProcedure
    .input(
      z.object({
        status: z
          .enum(["draft", "active", "paused", "completed", "cancelled"])
          .optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(dialingQueues.organizationId, orgId(ctx))];
      if (input.status) conditions.push(eq(dialingQueues.status, input.status));

      const dbc = await db.getDb();
      return dbc
        .select()
        .from(dialingQueues)
        .where(and(...conditions))
        .orderBy(desc(dialingQueues.createdAt));
    }),

  createQueue: orgProcedure
    .input(
      z.object({
        name: z.string().min(3).max(200),
        leadFilter: z.string().optional(),
        maxAttempts: z.number().int().min(1).max(10).default(1),
        retryDelayMinutes: z.number().int().min(1).default(60),
        callDelayMs: z.number().int().min(0).default(3000),
        callerIdNumber: z.string().max(32).optional(),
        whatsappNoAnswerTemplateName: z.string().optional(),
        whatsappNoAnswerTemplateVars: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [queue] = await dbc.insert(dialingQueues).values({
        organizationId: orgId(ctx),
        name: input.name,
        ownerUserId: ctx.user.id,
        leadFilter: input.leadFilter ?? null,
        maxAttempts: input.maxAttempts,
        retryDelayMinutes: input.retryDelayMinutes,
        callDelayMs: input.callDelayMs,
        callerIdNumber: input.callerIdNumber ?? "",
        whatsappNoAnswerTemplateName:
          input.whatsappNoAnswerTemplateName ?? null,
        whatsappNoAnswerTemplateVars:
          input.whatsappNoAnswerTemplateVars ?? null,
        status: "draft",
      });

      await logAudit({
        organizationId: orgId(ctx),
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "create",
        entityType: "dialing_queue",
        entityId: String(queue.insertId),
        entityName: input.name,
        summary: 'Creó la cola de marcación "' + input.name + '"',
      });

      return queue;
    }),

  deleteQueue: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [queue] = await dbc
        .select()
        .from(dialingQueues)
        .where(
          and(
            eq(dialingQueues.id, input.id),
            eq(dialingQueues.organizationId, orgId(ctx))
          )
        );

      if (!queue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cola no encontrada.",
        });
      }

      if (queue.status === "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No se puede eliminar una cola activa. Páusala o cancélala primero.",
        });
      }

      await dbc.delete(dialingQueues).where(eq(dialingQueues.id, input.id));
      await logAudit({
        organizationId: orgId(ctx),
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "delete",
        entityType: "dialing_queue",
        entityId: String(input.id),
        entityName: queue.name,
        summary: 'Eliminó la cola de marcación "' + queue.name + '"',
      });
      return { success: true };
    }),

  // ──── Queue Runtime ────
  startQueue: orgProcedure
    .input(z.object({ queueId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const host = ctx.req.get("host") || "crm.appsbim.online";
      const proto =
        ctx.req.get("x-forwarded-proto") ||
        (host.startsWith("localhost") ? "http" : "https");
      const baseUrl = `${proto}://${host}`;
      await startQueueEngine(input.queueId, orgId(ctx), ctx.user.id, baseUrl);
      const current = await getCurrentQueueLead(input.queueId, orgId(ctx));
      return { current };
    }),

  pauseQueue: orgProcedure
    .input(z.object({ queueId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await pauseQueueEngine(input.queueId, orgId(ctx));
      return { success: true };
    }),

  resumeQueue: orgProcedure
    .input(z.object({ queueId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await resumeQueueEngine(input.queueId, orgId(ctx));
      return { success: true };
    }),

  cancelQueue: orgProcedure
    .input(z.object({ queueId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await cancelQueueEngine(input.queueId, orgId(ctx));
      return { success: true };
    }),

  getCurrentLead: orgProcedure
    .input(z.object({ queueId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return getCurrentQueueLead(input.queueId, orgId(ctx));
    }),

  markAnswered: orgProcedure
    .input(
      z.object({
        queueId: z.number().int().positive(),
        attemptId: z.number().int().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await markAnsweredEngine(
        input.queueId,
        orgId(ctx),
        input.attemptId,
        input.notes
      );
      return { success: true };
    }),

  markNoAnswer: orgProcedure
    .input(
      z.object({
        queueId: z.number().int().positive(),
        attemptId: z.number().int().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await markNoAnswerEngine(
        input.queueId,
        orgId(ctx),
        input.attemptId,
        input.notes
      );
      // Auto-avance
      const next = await advanceQueue(input.queueId, orgId(ctx), ctx.user.id);
      // Si hay siguiente, iniciar llamada
      if (next) {
        const dbc = await db.getDb();
        const [queue] = await dbc
          .select()
          .from(dialingQueues)
          .where(eq(dialingQueues.id, input.queueId));
        // Esperar retardo configurado
        if (queue?.callDelayMs) {
          await new Promise(r => setTimeout(r, queue.callDelayMs));
        }
        await requestCallForQueueLead(input.queueId, orgId(ctx), ctx.user.id);
      }
      const current = await getCurrentQueueLead(input.queueId, orgId(ctx));
      return { success: true, hasNext: !!next, current };
    }),

  skipLead: orgProcedure
    .input(
      z.object({
        queueId: z.number().int().positive(),
        queueLeadId: z.number().int().positive(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await skipLeadEngine(
        input.queueId,
        orgId(ctx),
        input.queueLeadId,
        input.reason
      );
      await advanceQueue(input.queueId, orgId(ctx), ctx.user.id);
      const current = await getCurrentQueueLead(input.queueId, orgId(ctx));
      return { current };
    }),

  requestCall: orgProcedure
    .input(
      z.object({
        queueId: z.number().int().positive(),
        advisorPhone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { callSid } = await requestCallForQueueLead(
        input.queueId,
        orgId(ctx),
        ctx.user.id,
        input.advisorPhone
      );
      return { callSid };
    }),
});

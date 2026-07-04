import { and, eq, asc, desc } from "drizzle-orm";
import * as db from "../../db";
import {
  dialingQueues,
  dialingQueueLeads,
  dialAttempts,
  leads,
} from "../../../drizzle/schema";
import { clickToCall } from "../telephony/twilio";
import { sendWhatsAppTemplate } from "../telephony/whatsapp";
import { sendWhatsAppDirect } from "../telephony/whatsapp";

type QueueRow = typeof dialingQueues.$inferSelect;
type QueueLeadRow = typeof dialingQueueLeads.$inferSelect;
type AttemptRow = typeof dialAttempts.$inferSelect;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function parseLeadFilter(filter: string | null): {
  pipelineId?: number;
  stageId?: number;
  labelIds?: number[];
  manualLeadIds?: number[];
} | null {
  if (!filter) return null;
  try {
    return JSON.parse(filter);
  } catch {
    return null;
  }
}

/**
 * Crea los queue_leads a partir del leadFilter de la cola.
 */
export async function populateQueueLeads(queueId: number, orgId: number) {
  const dbc = await db.getDb();

  const [queue] = await dbc
    .select()
    .from(dialingQueues)
    .where(and(eq(dialingQueues.id, queueId), eq(dialingQueues.organizationId, orgId)));

  if (!queue) throw new Error("Cola no encontrada.");

  const filter = parseLeadFilter(queue.leadFilter);

  // Si hay manualLeadIds, usar esos
  if (filter?.manualLeadIds?.length) {
    const allLeads = await dbc
      .select()
      .from(leads)
      .where(and(
        eq(leads.organizationId, orgId),
        // drizzle-orm: inArray is for array of values
      ))
      .limit(500);
    
    const filtered = allLeads.filter(l => filter.manualLeadIds!.includes(l.id));
    
    for (let i = 0; i < filtered.length; i++) {
      await dbc.insert(dialingQueueLeads).values({
        organizationId: orgId,
        queueId,
        leadId: filtered[i].id,
        position: i + 1,
        status: "pending",
        attempts: 0,
      });
    }
  } else {
    // Por defecto: todos los leads de la org
    const allLeads = await dbc
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.organizationId, orgId))
      .limit(200);

    for (let i = 0; i < allLeads.length; i++) {
      await dbc.insert(dialingQueueLeads).values({
        organizationId: orgId,
        queueId,
        leadId: allLeads[i].id,
        position: i + 1,
        status: "pending",
        attempts: 0,
      });
    }
  }

  const total = await dbc
    .select()
    .from(dialingQueueLeads)
    .where(and(
      eq(dialingQueueLeads.queueId, queueId),
      eq(dialingQueueLeads.organizationId, orgId)
    ));

  await dbc
    .update(dialingQueues)
    .set({ totalLeads: total.length })
    .where(eq(dialingQueues.id, queueId));
}

/**
 * Inicia la cola: la pone en 'active' y crea el primer dial_attempt.
 */
export async function startQueue(queueId: number, orgId: number, userId: number, baseUrl: string) {
  const dbc = await db.getDb();

  const [queue] = await dbc
    .select()
    .from(dialingQueues)
    .where(and(eq(dialingQueues.id, queueId), eq(dialingQueues.organizationId, orgId)));

  if (!queue) throw new Error("Cola no encontrada.");
  if (queue.status !== "draft") throw new Error("La cola ya fue iniciada o completada.");

  // Poblar queue_leads si no están ya
  const existing = await dbc
    .select()
    .from(dialingQueueLeads)
    .where(eq(dialingQueueLeads.queueId, queueId))
    .limit(1);

  if (existing.length === 0) {
    await populateQueueLeads(queueId, orgId);
  }

  const dbc2 = await db.getDb();
  await dbc2
    .update(dialingQueues)
    .set({ status: "active", startedAt: new Date() })
    .where(eq(dialingQueues.id, queueId));

  // Buscar primer lead pendiente y marcarlo como calling
  const [next] = await dbc2
    .select()
    .from(dialingQueueLeads)
    .where(and(
      eq(dialingQueueLeads.queueId, queueId),
      eq(dialingQueueLeads.status, "pending")
    ))
    .orderBy(asc(dialingQueueLeads.position))
    .limit(1);

  if (next) {
    await advanceToLead(queueId, next.id, orgId, userId);
  }

  return queue;
}

/**
 * Avanza la cola al siguiente lead pendiente.
 * Si no hay más, completa la cola.
 */
export async function advanceQueue(queueId: number, orgId: number, userId: number) {
  const dbc = await db.getDb();

  const [next] = await dbc
    .select()
    .from(dialingQueueLeads)
    .where(and(
      eq(dialingQueueLeads.queueId, queueId),
      eq(dialingQueueLeads.status, "pending")
    ))
    .orderBy(asc(dialingQueueLeads.position))
    .limit(1);

  if (!next) {
    await dbc
      .update(dialingQueues)
      .set({ status: "completed", completedAt: new Date(), currentLeadId: null })
      .where(eq(dialingQueues.id, queueId));
    return null;
  }

  await advanceToLead(queueId, next.id, orgId, userId);
  return next;
}

async function advanceToLead(
  queueId: number,
  queueLeadId: number,
  orgId: number,
  userId: number
) {
  const dbc = await db.getDb();

  const [ql] = await dbc
    .select()
    .from(dialingQueueLeads)
    .where(eq(dialingQueueLeads.id, queueLeadId));

  if (!ql) return;

  // Marcar como calling
  await dbc
    .update(dialingQueueLeads)
    .set({ status: "calling" })
    .where(eq(dialingQueueLeads.id, queueLeadId));

  // Crear dial_attempt
  const [attempt] = await dbc
    .insert(dialAttempts)
    .values({
      organizationId: orgId,
      queueId,
      queueLeadId,
      leadId: ql.leadId,
      userId,
      status: "initiated",
      initiatedAt: new Date(),
    });

  // Actualizar currentLeadId de la cola
  await dbc
    .update(dialingQueues)
    .set({ currentLeadId: ql.leadId })
    .where(eq(dialingQueues.id, queueId));

  // Incrementar intentos
  await dbc
    .update(dialingQueueLeads)
    .set({
      attempts: ql.attempts + 1,
      lastAttemptId: Number(attempt.insertId),
      lastAttemptAt: new Date(),
    })
    .where(eq(dialingQueueLeads.id, queueLeadId));
}

/**
 * El agente marca "Sí contestó": no auto-avanza.
 * El agente debe explícitamente avanzar después de colgar.
 */
export async function markAnswered(
  queueId: number,
  orgId: number,
  attemptId: number,
  notes?: string
) {
  const dbc = await db.getDb();

  const [attempt] = await dbc
    .select()
    .from(dialAttempts)
    .where(and(eq(dialAttempts.id, attemptId), eq(dialAttempts.organizationId, orgId)));

  if (!attempt) throw new Error("Intento no encontrado.");

  await dbc
    .update(dialAttempts)
    .set({
      agentMarkedOutcome: "answered",
      agentMarkedAt: new Date(),
      status: "completed",
      endedAt: new Date(),
      notes: notes ?? null,
    })
    .where(eq(dialAttempts.id, attemptId));

  await dbc
    .update(dialingQueueLeads)
    .set({
      status: "answered",
      lastOutcome: "answered",
      completedAt: new Date(),
    })
    .where(eq(dialingQueueLeads.id, attempt.queueLeadId));

  const dbc2 = await db.getDb();
  const completedCount = await dbc2
    .select()
    .from(dialingQueueLeads)
    .where(and(
      eq(dialingQueueLeads.queueId, queueId),
      eq(dialingQueueLeads.status, "completed")
    ));

  await dbc2
    .update(dialingQueues)
    .set({ completedLeads: completedCount.length, currentLeadId: null })
    .where(eq(dialingQueues.id, queueId));

  return attempt;
}

/**
 * El agente marca "No contestó".
 * Envía WhatsApp si configurado, luego auto-avanza al siguiente.
 */
export async function markNoAnswer(
  queueId: number,
  orgId: number,
  attemptId: number,
  notes?: string
) {
  const dbc = await db.getDb();

  const [attempt] = await dbc
    .select()
    .from(dialAttempts)
    .where(and(eq(dialAttempts.id, attemptId), eq(dialAttempts.organizationId, orgId)));

  if (!attempt) throw new Error("Intento no encontrado.");

  await dbc
    .update(dialAttempts)
    .set({
      agentMarkedOutcome: "no_answer",
      agentMarkedAt: new Date(),
      status: "no_answer",
      endedAt: new Date(),
      notes: notes ?? null,
    })
    .where(eq(dialAttempts.id, attemptId));

  await dbc
    .update(dialingQueueLeads)
    .set({
      status: "no_answer",
      lastOutcome: "no_answer",
    })
    .where(eq(dialingQueueLeads.id, attempt.queueLeadId));

  // Enviar WhatsApp si la cola tiene template configurado
  const [queue] = await dbc
    .select()
    .from(dialingQueues)
    .where(eq(dialingQueues.id, queueId));

  if (queue?.whatsappNoAnswerTemplateName) {
    try {
      const [lead] = await dbc
        .select({ telefono: leads.telefono, contactoTelefono: leads.contactoTelefono, contactoNombre: leads.contactoNombre })
        .from(leads)
        .where(eq(leads.id, attempt.leadId));

      if (lead) {
        const phone = lead.contactoTelefono || lead.telefono;
        const vars = queue.whatsappNoAnswerTemplateVars
          ? JSON.parse(queue.whatsappNoAnswerTemplateVars)
          : {};
        await sendWhatsAppTemplate(
          queue.whatsappNoAnswerTemplateName,
          phone,
          "es",
          vars
        );
      }
    } catch (err: any) {
      console.warn("[QueueEngine] WhatsApp template falló:", err?.message);
    }
  } else {
    // Plain text WhatsApp message to the number that didn't answer
    try {
      const [lead] = await dbc
        .select({ telefono: leads.telefono, contactoTelefono: leads.contactoTelefono })
        .from(leads)
        .where(eq(leads.id, attempt.leadId));
      if (lead) {
        const phone = lead.contactoTelefono || lead.telefono;
        if (phone) {
          await sendWhatsAppDirect(phone, "Te escribimos para contactarnos");
        }
      }
    } catch (err: any) {
      console.warn("[QueueEngine] WhatsApp directo falló:", err?.message);
    }
  }

  return attempt;
}

export async function pauseQueue(queueId: number, orgId: number) {
  const dbc = await db.getDb();
  await dbc
    .update(dialingQueues)
    .set({ status: "paused", pausedAt: new Date() })
    .where(and(eq(dialingQueues.id, queueId), eq(dialingQueues.organizationId, orgId)));
}

export async function resumeQueue(queueId: number, orgId: number) {
  const dbc = await db.getDb();
  await dbc
    .update(dialingQueues)
    .set({ status: "active", pausedAt: null })
    .where(and(eq(dialingQueues.id, queueId), eq(dialingQueues.organizationId, orgId)));
}

export async function cancelQueue(queueId: number, orgId: number) {
  const dbc = await db.getDb();
  await dbc
    .update(dialingQueues)
    .set({ status: "cancelled", completedAt: new Date(), currentLeadId: null })
    .where(and(eq(dialingQueues.id, queueId), eq(dialingQueues.organizationId, orgId)));
}

export async function skipLead(queueId: number, orgId: number, queueLeadId: number, reason?: string) {
  const dbc = await db.getDb();
  await dbc
    .update(dialingQueueLeads)
    .set({ status: "skipped", lastOutcome: "skipped" })
    .where(eq(dialingQueueLeads.id, queueLeadId));
}

export async function getCurrentQueueLead(queueId: number, orgId: number) {
  const dbc = await db.getDb();
  const [ql] = await dbc
    .select()
    .from(dialingQueueLeads)
    .where(and(
      eq(dialingQueueLeads.queueId, queueId),
      eq(dialingQueueLeads.status, "calling"),
      eq(dialingQueueLeads.organizationId, orgId)
    ));

  if (!ql) return null;

  const [lead] = await dbc
    .select()
    .from(leads)
    .where(eq(leads.id, ql.leadId));

  const [attempt] = await dbc
    .select()
    .from(dialAttempts)
    .where(eq(dialAttempts.id, ql.lastAttemptId ?? 0))
    .limit(1);

  return { queueLead: ql, lead, attempt };
}

export async function requestCallForQueueLead(
  queueId: number,
  orgId: number,
  userId: number,
  advisorPhone?: string
) {
  const info = await getCurrentQueueLead(queueId, orgId);
  if (!info?.lead) throw new Error("No hay lead activo en la cola.");

  const phone = info.lead.contactoTelefono || info.lead.telefono;
  if (!phone) throw new Error("Lead sin teléfono.");

  // Si el attempt ya tiene un twilioCallSid, no volver a llamar
  if (info.attempt?.twilioCallSid) {
    return { callSid: info.attempt.twilioCallSid };
  }

  // Iniciar click-to-call
  const baseUrl = process.env.NODE_ENV === "production"
    ? "https://crm.appsbim.online"
    : "http://localhost:3000";

  const { callSid } = await clickToCall(phone, baseUrl);

  const dbc = await db.getDb();
  await dbc
    .update(dialAttempts)
    .set({ twilioCallSid: callSid, status: "ringing" })
    .where(eq(dialAttempts.id, info.attempt!.id));

  return { callSid };
}

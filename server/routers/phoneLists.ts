import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, asc, sql } from "drizzle-orm";
import { orgProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { phoneLists, phoneListEntries, leads } from "../../drizzle/schema";
import { sendWhatsAppDirect } from "../services/telephony/whatsapp";

const orgId = (ctx: { organizationId: number }) => ctx.organizationId;

export const phoneListsRouter = router({
  // ──── List CRUD ────
  list: orgProcedure.query(async ({ ctx }) => {
    const dbc = await db.getDb();
    return dbc
      .select()
      .from(phoneLists)
      .where(eq(phoneLists.organizationId, orgId(ctx)))
      .orderBy(desc(phoneLists.updatedAt));
  }),

  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        callDelayMs: z.number().int().min(0).max(30000).default(3000),
        autoMessage: z.string().max(4096).optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [list] = await dbc.insert(phoneLists).values({
        organizationId: orgId(ctx),
        name: input.name,
        ownerUserId: ctx.user.id,
        callDelayMs: input.callDelayMs,
        autoMessage:
          input.autoMessage && input.autoMessage.trim()
            ? input.autoMessage.trim()
            : null,
        status: "idle",
      });
      return list;
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [list] = await dbc
        .select()
        .from(phoneLists)
        .where(
          and(
            eq(phoneLists.id, input.id),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );

      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      if (list.status === "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Detén la marcación antes de eliminar la lista.",
        });
      }

      await dbc.delete(phoneLists).where(eq(phoneLists.id, input.id));
      return { success: true };
    }),

  get: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [list] = await dbc
        .select()
        .from(phoneLists)
        .where(
          and(
            eq(phoneLists.id, input.id),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );

      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      const entries = await dbc
        .select()
        .from(phoneListEntries)
        .where(eq(phoneListEntries.listId, input.id))
        .orderBy(asc(phoneListEntries.position));

      return { list, entries };
    }),

  // ──── Entry CRUD ────
  addEntry: orgProcedure
    .input(
      z.object({
        listId: z.number().int().positive(),
        name: z.string().min(1).max(200),
        phoneNumber: z.string().min(5).max(32),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();

      const [list] = await dbc
        .select()
        .from(phoneLists)
        .where(
          and(
            eq(phoneLists.id, input.listId),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      // Check for duplicate phone in this list
      const [duplicate] = await dbc
        .select({ id: phoneListEntries.id })
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.listId, input.listId),
            eq(phoneListEntries.phoneNumber, input.phoneNumber.trim())
          )
        )
        .limit(1);
      if (duplicate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `El número ${input.phoneNumber} ya existe en esta lista.`,
        });
      }

      // Get next position
      const existing = await dbc
        .select({ pos: phoneListEntries.position })
        .from(phoneListEntries)
        .where(eq(phoneListEntries.listId, input.listId))
        .orderBy(desc(phoneListEntries.position))
        .limit(1);

      const position = (existing[0]?.pos ?? 0) + 1;

      // Try to link to existing lead
      let leadId: number | null = null;
      const [matchingLead] = await dbc
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, orgId(ctx)),
            sql`(${leads.telefono} = ${input.phoneNumber} OR ${leads.contactoTelefono} = ${input.phoneNumber})`
          )
        )
        .limit(1);
      if (matchingLead) leadId = matchingLead.id;

      const [entry] = await dbc.insert(phoneListEntries).values({
        organizationId: orgId(ctx),
        listId: input.listId,
        name: input.name,
        phoneNumber: input.phoneNumber,
        leadId,
        position,
        status: "pending",
      });

      await dbc
        .update(phoneLists)
        .set({ totalEntries: sql`${phoneLists.totalEntries} + 1` })
        .where(eq(phoneLists.id, input.listId));

      return entry;
    }),

  updateEntry: orgProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(200).optional(),
        phoneNumber: z.string().min(5).max(32).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [entry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.id, input.id),
            eq(phoneListEntries.organizationId, orgId(ctx))
          )
        );
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.phoneNumber !== undefined)
        updates.phoneNumber = input.phoneNumber;

      await dbc
        .update(phoneListEntries)
        .set(updates)
        .where(eq(phoneListEntries.id, input.id));

      return { success: true };
    }),

  deleteEntry: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [entry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.id, input.id),
            eq(phoneListEntries.organizationId, orgId(ctx))
          )
        );
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await dbc
        .delete(phoneListEntries)
        .where(eq(phoneListEntries.id, input.id));

      await dbc
        .update(phoneLists)
        .set({ totalEntries: sql`GREATEST(${phoneLists.totalEntries} - 1, 0)` })
        .where(eq(phoneLists.id, entry.listId));

      return { success: true };
    }),

  importCsv: orgProcedure
    .input(
      z.object({
        listId: z.number().int().positive(),
        csvBase64: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();

      const [list] = await dbc
        .select()
        .from(phoneLists)
        .where(
          and(
            eq(phoneLists.id, input.listId),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      // Parse CSV/XLSX with xlsx
      const XLS = await import("xlsx");
      const buf = Buffer.from(input.csvBase64, "base64");
      const wb = XLS.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: string[][] = XLS.utils.sheet_to_json(ws, { header: 1 });

      if (data.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "El archivo debe tener encabezados y al menos una fila de datos.",
        });
      }

      // Detect column indices for "nombre" and "telefono"
      const headers = data[0].map((h: string) =>
        (h || "").toLowerCase().trim()
      );
      const nameIdx = headers.findIndex(
        (h: string) => h === "nombre" || h === "name"
      );
      const phoneIdx = headers.findIndex(
        (h: string) =>
          h === "telefono" ||
          h === "telefono" ||
          h === "phone" ||
          h === "celular" ||
          h === "tel" ||
          h === "numero"
      );

      if (nameIdx === -1 || phoneIdx === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Encabezados requeridos: nombre, telefono",
        });
      }

      // Get current max position
      const existing = await dbc
        .select({ pos: phoneListEntries.position })
        .from(phoneListEntries)
        .where(eq(phoneListEntries.listId, input.listId))
        .orderBy(desc(phoneListEntries.position))
        .limit(1);

      // Get existing phones in this list to dedupe
      const existingPhones = await dbc
        .select({ phone: phoneListEntries.phoneNumber })
        .from(phoneListEntries)
        .where(eq(phoneListEntries.listId, input.listId));
      const phoneSet = new Set(existingPhones.map(p => p.phone.trim()));

      let position = (existing[0]?.pos ?? 0) + 1;
      let imported = 0;
      let skippedDuplicates = 0;
      const duplicateExamples: string[] = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const name = (row[nameIdx] || "").toString().trim();
        const phone = (row[phoneIdx] || "").toString().trim();

        if (!name || !phone) continue;

        // Skip duplicates (compare by trimmed phone number)
        if (phoneSet.has(phone)) {
          skippedDuplicates++;
          if (duplicateExamples.length < 5) {
            duplicateExamples.push(`${name} (${phone})`);
          }
          continue;
        }

        // Try to link to existing lead
        let leadId: number | null = null;
        const [matchingLead] = await dbc
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.organizationId, orgId(ctx)),
              sql`(${leads.telefono} = ${phone} OR ${leads.contactoTelefono} = ${phone})`
            )
          )
          .limit(1);
        if (matchingLead) leadId = matchingLead.id;

        await dbc.insert(phoneListEntries).values({
          organizationId: orgId(ctx),
          listId: input.listId,
          name,
          phoneNumber: phone,
          leadId,
          position,
          status: "pending",
        });

        phoneSet.add(phone);
        position++;
        imported++;
      }

      await dbc
        .update(phoneLists)
        .set({ totalEntries: sql`${phoneLists.totalEntries} + ${imported}` })
        .where(eq(phoneLists.id, input.listId));

      return { imported, skippedDuplicates, duplicateExamples };
    }),

  // ──── Loop Dialing ────
  startLoop: orgProcedure
    .input(z.object({ listId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();

      const [list] = await dbc
        .select()
        .from(phoneLists)
        .where(
          and(
            eq(phoneLists.id, input.listId),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      // Si ya está activa, permitir reiniciar (tolera errores de estado previo)

      // Reset all entries to pending
      await dbc
        .update(phoneListEntries)
        .set({ status: "pending", calledAt: null })
        .where(eq(phoneListEntries.listId, input.listId));

      await dbc
        .update(phoneLists)
        .set({
          status: "active",
          completedEntries: 0,
          currentEntryId: null,
          totalEntries: list.totalEntries,
        })
        .where(eq(phoneLists.id, input.listId));

      // Return first entry
      const [first] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.listId, input.listId),
            eq(phoneListEntries.status, "pending")
          )
        )
        .orderBy(asc(phoneListEntries.position))
        .limit(1);

      return {
        list: { ...list, status: "active" as const },
        firstEntry: first ?? null,
      };
    }),

  pauseLoop: orgProcedure
    .input(z.object({ listId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      await dbc
        .update(phoneLists)
        .set({ status: "paused" })
        .where(
          and(
            eq(phoneLists.id, input.listId),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );
      return { success: true };
    }),

  resumeLoop: orgProcedure
    .input(z.object({ listId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      await dbc
        .update(phoneLists)
        .set({ status: "active" })
        .where(
          and(
            eq(phoneLists.id, input.listId),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );
      return { success: true };
    }),

  stopLoop: orgProcedure
    .input(z.object({ listId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      await dbc
        .update(phoneLists)
        .set({ status: "completed", currentEntryId: null })
        .where(
          and(
            eq(phoneLists.id, input.listId),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );
      return { success: true };
    }),

  getNext: orgProcedure
    .input(z.object({ listId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const dbc = await db.getDb();

      const [entry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.listId, input.listId),
            eq(phoneListEntries.organizationId, orgId(ctx)),
            eq(phoneListEntries.status, "pending")
          )
        )
        .orderBy(asc(phoneListEntries.position))
        .limit(1);

      return { entry: entry ?? null };
    }),

  markAnswered: orgProcedure
    .input(z.object({ entryId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [entry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.id, input.entryId),
            eq(phoneListEntries.organizationId, orgId(ctx))
          )
        );
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await dbc
        .update(phoneListEntries)
        .set({ status: "answered", calledAt: new Date() })
        .where(eq(phoneListEntries.id, input.entryId));

      await dbc
        .update(phoneLists)
        .set({ completedEntries: sql`${phoneLists.completedEntries} + 1` })
        .where(eq(phoneLists.id, entry.listId));

      // Get the next pending entry
      const [nextEntry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.listId, entry.listId),
            eq(phoneListEntries.status, "pending")
          )
        )
        .orderBy(asc(phoneListEntries.position))
        .limit(1);

      return { success: true, nextEntry: nextEntry ?? null };
    }),

  markNoAnswer: orgProcedure
    .input(z.object({ entryId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [entry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.id, input.entryId),
            eq(phoneListEntries.organizationId, orgId(ctx))
          )
        );
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await dbc
        .update(phoneListEntries)
        .set({ status: "no_answer", calledAt: new Date() })
        .where(eq(phoneListEntries.id, input.entryId));

      // Send WhatsApp to the number that didn't answer.
      // Use the list's custom message if set, otherwise fall back to default.
      const [list] = await dbc
        .select()
        .from(phoneLists)
        .where(eq(phoneLists.id, entry.listId))
        .limit(1);

      const message =
        (list?.autoMessage && list.autoMessage.trim()) ||
        "Te escribimos para contactarnos";

      try {
        await sendWhatsAppDirect(entry.phoneNumber, message);
      } catch (err: any) {
        console.warn("[phoneLists.markNoAnswer] WhatsApp falló:", err?.message);
      }

      // Get the next pending entry in the same list
      const [nextEntry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.listId, entry.listId),
            eq(phoneListEntries.status, "pending")
          )
        )
        .orderBy(asc(phoneListEntries.position))
        .limit(1);

      return { success: true, nextEntry: nextEntry ?? null };
    }),

  updateAutoMessage: orgProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        autoMessage: z.string().max(4096).optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();

      const [list] = await dbc
        .select()
        .from(phoneLists)
        .where(
          and(
            eq(phoneLists.id, input.id),
            eq(phoneLists.organizationId, orgId(ctx))
          )
        );
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      await dbc
        .update(phoneLists)
        .set({
          autoMessage:
            input.autoMessage && input.autoMessage.trim()
              ? input.autoMessage.trim()
              : null,
        })
        .where(eq(phoneLists.id, input.id));

      return { success: true };
    }),

  sendManualMessage: orgProcedure
    .input(
      z.object({
        to: z.string().min(5).max(32),
        body: z.string().min(1).max(4096),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await sendWhatsAppDirect(input.to, input.body);
        return {
          success: true,
          messageId: result.messageId,
        };
      } catch (err: any) {
        console.warn(
          "[phoneLists.sendManualMessage] WhatsApp falló:",
          err?.message
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `WhatsApp error: ${err?.message || "unknown"}`,
        });
      }
    }),

  skipEntry: orgProcedure
    .input(z.object({ entryId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const [entry] = await dbc
        .select()
        .from(phoneListEntries)
        .where(
          and(
            eq(phoneListEntries.id, input.entryId),
            eq(phoneListEntries.organizationId, orgId(ctx))
          )
        );
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await dbc
        .update(phoneListEntries)
        .set({ status: "skipped", calledAt: new Date() })
        .where(eq(phoneListEntries.id, input.entryId));

      return { success: true };
    }),

  getProgress: orgProcedure
    .input(z.object({ listId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const dbc = await db.getDb();
      const all = await dbc
        .select()
        .from(phoneListEntries)
        .where(eq(phoneListEntries.listId, input.listId));

      const answered = all.filter(e => e.status === "answered").length;
      const noAnswer = all.filter(e => e.status === "no_answer").length;
      const skipped = all.filter(e => e.status === "skipped").length;
      const pending = all.filter(
        e => e.status === "pending" || e.status === "calling"
      ).length;
      const total = all.length;

      return { answered, noAnswer, skipped, pending, total };
    }),
});

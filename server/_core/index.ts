import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
// import { serveStatic, setupVite } from "./vite"; // Eliminamos el import estático
import {
  handleLeadWebhook,
  handleLeadStatusWebhook,
} from "../webhooks/leads.webhook";
import { twilioWebhooksRouter } from "../routes/twilioWebhooks";
import { eventsRouter } from "../routes/events";
import path from "path";
import fs from "fs";
import { eq } from "drizzle-orm";
import * as db from "../db";
import { callRecordings } from "../../drizzle/schema";
import mysql2 from "mysql2/promise";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[Migration] No DATABASE_URL found. Skipping migrations.");
    return;
  }

  console.log(
    "[Migration] Running programmatic migrations (safe column check)..."
  );
  try {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
      uri: dbUrl,
    });

    // Verificamos si la columna passwordHash ya existe en la tabla users
    const [rows]: any = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'passwordHash'
    `);

    if (Array.isArray(rows) && rows.length === 0) {
      console.log(
        "[Migration] Column 'passwordHash' not found in 'users' table. Adding it..."
      );
      await connection.query("ALTER TABLE `users` ADD `passwordHash` text");
      console.log("[Migration] Column 'passwordHash' added successfully!");
    } else {
      console.log(
        "[Migration] Column 'passwordHash' already exists in 'users' table. No actions needed."
      );
    }

    await connection.end();
  } catch (error) {
    console.error("[Migration] Programmatic migration failed:", error);
  }
}

async function startServer() {
  await runMigrations();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Webhooks para recibir leads externos
  app.post("/api/webhooks/leads", handleLeadWebhook);
  app.post("/api/webhooks/leads/status", handleLeadStatusWebhook);

  // Webhooks Twilio (VoIP + SMS)
  app.use("/webhooks/twilio", twilioWebhooksRouter);

  // Eventos en tiempo real (SSE)
  app.use("/api", eventsRouter);

  // Servir grabaciones de audio de llamadas
  const voipRecordingsDir =
    process.env.VOIP_RECORDINGS_DIR || "/var/lib/voip/recordings";
  app.get("/api/recordings/:id/audio", async (req: any, res: any) => {
    const recordingId = parseInt(req.params.id, 10);
    if (isNaN(recordingId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    try {
      const dbc = await db.getDb();
      const [rec] = await dbc
        .select()
        .from(callRecordings)
        .where(eq(callRecordings.id, recordingId))
        .limit(1);

      if (!rec) {
        return res.status(404).json({ error: "Grabación no encontrada" });
      }

      const filePath =
        rec.filePath ||
        path.join(voipRecordingsDir, `${rec.twilioCallSid}.mp3`);

      if (!fs.existsSync(filePath)) {
        return res
          .status(404)
          .json({ error: "Archivo de audio no disponible" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", fs.statSync(filePath).size);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="grabacion-${rec.id}.mp3"`
      );
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err: any) {
      console.error("[Audio] Error sirviendo grabación:", err?.message);
      res.status(500).json({ error: "Error sirviendo audio" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // En producción no instalamos dependencias de desarrollo (Vite), por eso usamos imports dinámicos
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // ─── Background: real-time after_visit checker (runs every 60s) ───
  // ─── Background: real-time after_visit checker (runs every 15s) ───
  const rawPool = mysql2.createPool(
    process.env.DATABASE_URL ||
      "mysql://mv_user:mv_password@db:3306/cotizador_leads"
  );
  setInterval(async () => {
    console.log("[AfterVisit BG] Tick");
    try {
      const now = Date.now();
      const [rules] = (await rawPool.execute(
        "SELECT * FROM automation_rules WHERE `trigger` = ? AND isActive = ?",
        ["after_visit", 1]
      )) as any;
      if (!Array.isArray(rules) || rules.length === 0) return;
      console.log("[AfterVisit BG] rules:", rules.length);

      const orgIds = [...new Set((rules as any[]).map(r => r.organizationId))];

      for (const orgId of orgIds) {
        const [rows] = (await rawPool.execute(
          "SELECT id, publicId, nombreCliente, estadoLead, fechaVisita FROM leads WHERE organizationId = ? AND fechaVisita < ? AND firedAfterVisitAt IS NULL",
          [orgId, now]
        )) as any;

        const openLeads = (Array.isArray(rows) ? rows : []).filter(
          (l: any) => !["ganado", "perdido"].includes(l.estadoLead)
        );
        console.log(
          `[AfterVisit BG] Org ${orgId}: ${rows.length} raw, ${openLeads.length} open`
        );
        if (openLeads.length === 0) continue;

        const orgRules = (rules as any[]).filter(
          r => r.organizationId === orgId
        );
        try {
          const { getOrgIntegrations } =
            await import("../_core/orgIntegrations");
          const orgIntegrations = await getOrgIntegrations(orgId);
          const { executeRuleAction } =
            await import("../services/leadAutomation");

          for (const lead of openLeads) {
            for (const rule of orgRules) {
              await executeRuleAction(
                rule,
                lead,
                1,
                orgIntegrations ?? undefined
              );
              console.log(`[AfterVisit BG] Fired ${lead.publicId}`);
            }
            await rawPool.execute(
              "UPDATE leads SET firedAfterVisitAt = NOW() WHERE id = ?",
              [lead.id]
            );
            if (orgRules.length > 0) {
              await rawPool.execute(
                "UPDATE automation_rules SET executionCount = executionCount + 1, lastExecutedAt = NOW() WHERE id = ?",
                [orgRules[0].id]
              );
            }
          }
        } catch (e: any) {
          console.warn("[AfterVisit BG] Execute error:", e?.message);
        }
      }
    } catch (e: any) {
      console.warn("[AfterVisit BG] Error:", e?.message);
    }
  }, 15_000);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

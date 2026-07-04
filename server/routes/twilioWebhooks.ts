import { eq } from "drizzle-orm";
import { Router, Request, Response } from "express";
import twilio from "twilio";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { ENV } from "../_core/env";
import { sseHub } from "../services/events/sseHub";
import * as db from "../db";
import { callRecordings } from "../../drizzle/schema";

const VoiceResponse = twilio.twiml.VoiceResponse;
const MessagingResponse = twilio.twiml.MessagingResponse;

const router = Router();

const RECORDINGS_DIR = ENV.voipRecordingsDir || "/var/lib/voip/recordings";

function descargarAudioBackground(recordingUrl: string, callSid: string) {
  const filePath = path.join(RECORDINGS_DIR, `${callSid}.mp3`);

  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

  const file = fs.createWriteStream(filePath);
  const client = recordingUrl.startsWith("https") ? https : http;
  const auth = recordingUrl.includes("api.twilio.com")
    ? `${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`
    : undefined;

  const reqOpts: any = {};
  if (auth) reqOpts.auth = auth;

  client
    .get(
      recordingUrl + (recordingUrl.endsWith(".mp3") ? "" : ".mp3"),
      reqOpts,
      response => {
        response.pipe(file);
        file.on("finish", async () => {
          file.close();
          console.log(
            `[Grabación] Descarga automática completada: ${filePath}`
          );
          // Update DB status to "downloaded"
          try {
            const dbc = await db.getDb();
            await dbc
              .update(callRecordings)
              .set({ status: "downloaded", downloadedAt: new Date() })
              .where(eq(callRecordings.twilioCallSid, callSid));
          } catch (e: any) {
            console.error("[Grabación] Error actualizando DB:", e?.message);
          }
        });
      }
    )
    .on("error", (err: Error) => {
      fs.unlink(filePath, () => {});
      console.error(
        `[Grabación] Error al descargar audio de ${callSid}: ${err.message}`
      );
    });
}

/**
 * POST /webhooks/twilio/voice
 * TwiML dinámico que enruta llamadas entrantes y salientes (WebRTC).
 */
router.post(
  "/voice",
  twilio.webhook({ validate: false }),
  async (req: Request, res: Response) => {
    try {
      const from = (req.body.From as string) || "Desconocido";
      const to = (req.body.To as string) || "Desconocido";
      const routing = (req.query.routing as string) || "webrtc";

      console.log(
        `[Twilio Voice] From: ${from} | To: ${to} | Routing: ${routing}`
      );

      const response = new VoiceResponse();
      const proto = req.get("x-forwarded-proto") || req.protocol || "https";
      const baseUrl = `${proto}://${req.get("host")}`;
      const recordingCallbackUrl = `${baseUrl}/webhooks/twilio/recording`;

      // CASO 0: Asesor llama desde su celular (IVR)
      if (from === ENV.advisorPhoneNumber) {
        const gatherUrl = `${baseUrl}/webhooks/twilio/ivr-dial`;
        const gather = response.gather({
          action: gatherUrl,
          method: "POST",
          finishOnKey: "#",
          numDigits: 15,
          timeout: 10,
        });
        gather.say(
          "Bienvenido al sistema de llamadas. Por favor, marque el número del cliente seguido de la tecla numeral.",
          { language: "es-MX" }
        );
        response.say("No se recibió ninguna marcación. Fin de la llamada.", {
          language: "es-MX",
        });
        res.type("text/xml").send(response.toString());
        return;
      }

      // CASO 1: Llamada saliente WebRTC desde navegador
      if (from.startsWith("client:")) {
        console.log(
          `[Outbound WebRTC] Asesor ${from} llamando al cliente: ${to}`
        );

        const dial = response.dial({
          callerId: ENV.twilioPhoneNumber,
          record: "record-from-answer-dual",
          recordingStatusCallback: recordingCallbackUrl,
          recordingStatusCallbackEvent: "completed",
        });

        if (to.startsWith("client:")) {
          dial.client(to.replace("client:", ""));
        } else {
          dial.number(to);
        }

        // Emitir evento SSE
        sseHub.emit("call", {
          type: "outbound_started",
          from,
          to,
          direction: "outbound",
        });

        res.type("text/xml").send(response.toString());
        return;
      }

      // CASO 2: Llamada entrante (cliente llama al número Twilio)
      console.log(`[Inbound Call] Cliente: ${from}`);

      sseHub.emit("call", {
        type: "incoming",
        from,
        to,
        direction: "inbound",
      });

      response.say(
        "Conectando su llamada con un asesor disponible. Esta conversación será grabada.",
        { language: "es-MX" }
      );

      const dial = response.dial({
        record: "record-from-answer-dual",
        recordingStatusCallback: recordingCallbackUrl,
        recordingStatusCallbackEvent: "completed",
      });

      if (routing.toLowerCase() === "pstn") {
        dial.number(ENV.advisorPhoneNumber);
      } else {
        dial.client("asesor_default");
      }

      res.type("text/xml").send(response.toString());
    } catch (err: any) {
      console.error("[Twilio Voice] Error:", err?.message);
      const errResp = new VoiceResponse();
      errResp.say("Error interno de enrutamiento.", { language: "es-MX" });
      res.type("text/xml").send(errResp.toString());
    }
  }
);

/**
 * POST /webhooks/twilio/ivr-dial
 * Recibe dígitos DTMF del asesor desde su celular y marca al cliente.
 */
router.post(
  "/ivr-dial",
  twilio.webhook({ validate: false }),
  async (req: Request, res: Response) => {
    try {
      let digits = (req.body.Digits as string) || "";
      console.log(`[IVR Dial] Dígitos recibidos: ${digits}`);

      const response = new VoiceResponse();
      if (!digits) {
        response.say("No se recibió ningún número de teléfono.", {
          language: "es-MX",
        });
        res.type("text/xml").send(response.toString());
        return;
      }

      let clientNumber = digits;
      if (clientNumber.startsWith("00")) {
        clientNumber = "+" + clientNumber.slice(2);
      } else if (!clientNumber.startsWith("+") && clientNumber.length === 10) {
        clientNumber = "+57" + clientNumber;
      } else if (!clientNumber.startsWith("+")) {
        clientNumber = "+" + clientNumber;
      }

      const proto = req.get("x-forwarded-proto") || req.protocol || "https";
      const baseUrl = `${proto}://${req.get("host")}`;
      response.say("Conectando con el cliente. Esta llamada será grabada.", {
        language: "es-MX",
      });

      const dial = response.dial({
        callerId: ENV.twilioPhoneNumber,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${baseUrl}/webhooks/twilio/recording`,
        recordingStatusCallbackEvent: "completed",
      });
      dial.number(clientNumber);

      res.type("text/xml").send(response.toString());
    } catch (err: any) {
      console.error("[IVR Dial] Error:", err?.message);
      const errResp = new VoiceResponse();
      errResp.say("Error interno al conectar la llamada.", {
        language: "es-MX",
      });
      res.type("text/xml").send(errResp.toString());
    }
  }
);

/**
 * POST /webhooks/twilio/outbound-bridge
 * TwiML cuando el asesor contesta en click-to-call. Puentea con el cliente.
 */
router.post(
  "/outbound-bridge",
  twilio.webhook({ validate: false }),
  async (req: Request, res: Response) => {
    try {
      const toNumber = (req.query.To as string) || "";
      console.log(`[Click-to-Call Bridge] Conectando con cliente: ${toNumber}`);

      const proto = req.get("x-forwarded-proto") || req.protocol || "https";
      const baseUrl = `${proto}://${req.get("host")}`;
      const response = new VoiceResponse();
      response.say("Conectando con el cliente. Esta llamada será grabada.", {
        language: "es-MX",
      });

      const dial = response.dial({
        callerId: ENV.twilioPhoneNumber,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${baseUrl}/webhooks/twilio/recording`,
        recordingStatusCallbackEvent: "completed",
      });
      dial.number(toNumber);

      res.type("text/xml").send(response.toString());
    } catch (err: any) {
      console.error("[Outbound Bridge] Error:", err?.message);
      const errResp = new VoiceResponse();
      errResp.say("Error al puentear la llamada.", { language: "es-MX" });
      res.type("text/xml").send(errResp.toString());
    }
  }
);

/**
 * POST /webhooks/twilio/status
 * Callback de estado de llamada: actualiza dial_attempts y emite SSE.
 */
router.post(
  "/status",
  twilio.webhook({ validate: false }),
  async (req: Request, res: Response) => {
    try {
      const callSid = req.body.CallSid as string;
      const callStatus = (req.body.CallStatus as string)?.toLowerCase();
      const callDuration = parseInt(req.body.CallDuration || "0", 10);
      const recordingUrl = req.body.RecordingUrl as string | undefined;

      console.log(
        `[Call Status] SID: ${callSid} | Status: ${callStatus} | Duration: ${callDuration}s`
      );

      sseHub.emit("call", {
        type: "status_update",
        callSid,
        status: callStatus,
        duration: callDuration,
        recordingUrl: recordingUrl || null,
      });

      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("[Call Status] Error:", err?.message);
      res.status(500).json({ error: "Error procesando status de llamada" });
    }
  }
);

/**
 * POST /webhooks/twilio/recording
 * Callback de grabación completada. Descarga automática del MP3.
 */
router.post(
  "/recording",
  twilio.webhook({ validate: false }),
  async (req: Request, res: Response) => {
    try {
      const callSid = req.body.CallSid as string;
      const recordingUrl = req.body.RecordingUrl as string | undefined;
      const recordingStatus = req.body.RecordingStatus as string;
      const recordingDuration = req.body.RecordingDuration as string;

      console.log("\n" + "=".repeat(70));
      console.log("REGISTRO DE GRABACIÓN RECIBIDO (DUAL-CHANNEL)");
      console.log(`ID Llamada (Call SID)  : ${callSid}`);
      console.log(`Estado de Grabación    : ${recordingStatus}`);
      console.log(`Duración de Audio      : ${recordingDuration} segundos`);
      console.log(`URL de Grabación (MP3) : ${recordingUrl}`);
      console.log("=".repeat(70) + "\n");

      if (recordingUrl && callSid && recordingStatus === "completed") {
        descargarAudioBackground(recordingUrl, callSid);

        // Store recording metadata in DB
        try {
          const dbc = await db.getDb();
          const filePath = path.join(RECORDINGS_DIR, `${callSid}.mp3`);
          await dbc.insert(callRecordings).values({
            organizationId: 1,
            twilioCallSid: callSid,
            twilioRecordingSid:
              (req.body.RecordingSid as string | undefined) ?? null,
            filePath,
            durationSec: parseInt(recordingDuration || "0", 10),
            status: "pending",
          });
        } catch (dbErr: any) {
          console.error("[Recording] Error guardando en DB:", dbErr?.message);
        }

        sseHub.emit("recording", {
          type: "ready",
          callSid,
          recordingUrl,
          duration: parseInt(recordingDuration || "0", 10),
        });
      }

      res.json({
        status: "success",
        message: "Grabación procesada y programada para descarga",
      });
    } catch (err: any) {
      console.error("[Recording] Error:", err?.message);
      res.status(500).json({ error: "Error procesando grabación" });
    }
  }
);

/**
 * POST /webhooks/twilio/sms
 * Webhook de SMS entrante.
 */
router.post(
  "/sms",
  twilio.webhook({ validate: false }),
  async (req: Request, res: Response) => {
    try {
      const fromNumber = (req.body.From as string) || "Desconocido";
      const body = (req.body.Body as string) || "";
      const numMedia = parseInt(req.body.NumMedia || "0", 10);
      let mediaUrl = "";
      if (numMedia > 0) {
        mediaUrl = (req.body.MediaUrl0 as string) || "";
      }

      console.log(`[SMS Entrante] De: ${fromNumber} | Mensaje: ${body}`);

      sseHub.emit("sms", {
        direction: "inbound",
        from: fromNumber,
        body,
        mediaUrl: mediaUrl || null,
        numMedia,
      });

      const twiml = new MessagingResponse();
      res.type("text/xml").send(twiml.toString());
    } catch (err: any) {
      console.error("[SMS] Error:", err?.message);
      res.type("text/xml").send("<Response></Response>");
    }
  }
);

export { router as twilioWebhooksRouter };

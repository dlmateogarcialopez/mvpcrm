import { Router, Request, Response } from "express";
import { sseHub } from "../services/events/sseHub";

const router = Router();

/**
 * GET /api/dialer-events
 * Server-Sent Events endpoint para actualizaciones en tiempo real
 * de llamadas, SMS y grabaciones sin necesidad de WebSocket.
 */
router.get("/dialer-events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write("event: connected\ndata: {}\n\n");

  const onCall = (data: unknown) => sseHub.broadcast("call", data);
  const onSms = (data: unknown) => sseHub.broadcast("sms", data);
  const onRecording = (data: unknown) => sseHub.broadcast("recording", data);

  sseHub.on("call", onCall);
  sseHub.on("sms", onSms);
  sseHub.on("recording", onRecording);

  sseHub.addClient(res);

  req.on("close", () => {
    sseHub.off("call", onCall);
    sseHub.off("sms", onSms);
    sseHub.off("recording", onRecording);
  });
});

export { router as eventsRouter };

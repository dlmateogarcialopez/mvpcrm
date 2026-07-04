import { EventEmitter } from "events";

class SseHub extends EventEmitter {
  private clients: Set<import("express").Response> = new Set();

  addClient(res: import("express").Response): void {
    this.clients.add(res);
    res.on("close", () => {
      this.clients.delete(res);
    });
  }

  broadcast(eventType: string, data: unknown): void {
    for (const res of this.clients) {
      try {
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        this.clients.delete(res);
      }
    }
  }
}

export const sseHub = new SseHub();

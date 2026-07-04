import { useState } from "react";
import { MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SmsChat } from "./SmsChat";

export function SmsInbox() {
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newLeadId, setNewLeadId] = useState("");

  const convsQuery = trpc.dialing.listSmsConversations.useQuery(
    { limit: 30 },
    { refetchInterval: 10000 }
  );

  if (selectedLead != null) {
    return (
      <div className="flex h-full flex-col">
        <button
          onClick={() => setSelectedLead(null)}
          className="mb-2 text-xs text-primary hover:underline"
        >
          ← Volver a conversaciones
        </button>
        <SmsChat leadId={selectedLead} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span>SMS</span>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            showNew
              ? "bg-muted"
              : "hover:bg-muted"
          }`}
        >
          <Plus className="mr-1 inline h-3 w-3" />
          Nuevo
        </button>
      </div>

      {showNew && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
          <input
            value={newNumber}
            onChange={e => setNewNumber(e.target.value)}
            placeholder="+57XXXXXXXXXX"
            className="rounded border bg-background px-3 py-1.5 text-xs font-mono"
          />
          <input
            value={newLeadId}
            onChange={e => setNewLeadId(e.target.value)}
            placeholder="ID del lead (opcional)"
            className="rounded border bg-background px-3 py-1.5 text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                const id = parseInt(newLeadId, 10);
                if (!isNaN(id)) setSelectedLead(id);
                setShowNew(false);
              }}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              disabled={!newNumber.trim()}
            >
              <Send className="h-3 w-3" />
              Comenzar
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded border px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {convsQuery.data?.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No hay conversaciones aún.
          </p>
        )}
        {convsQuery.data?.map(conv => (
          <button
            key={conv.leadId}
            onClick={() => setSelectedLead(conv.leadId)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {conv.toNumber?.slice(-2) || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{conv.toNumber}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {conv.lastMessage || "Sin mensajes"}
              </p>
            </div>
            {conv.lastSentAt && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {new Date(conv.lastSentAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

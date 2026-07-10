import { useState } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function SmsQuickSend() {
  const [toNumber, setToNumber] = useState("");
  const [body, setBody] = useState("");

  const utils = trpc.useUtils();
  const sendMutation = trpc.dialing.sendQuickSms.useMutation({
    onSuccess: () => {
      toast.success("SMS enviado correctamente");
      setToNumber("");
      setBody("");
      utils.dialing.listSmsConversations.invalidate();
    },
    onError: e => {
      toast.error(e.message || "Error al enviar el SMS");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedNumber = toNumber.trim();
    const trimmedBody = body.trim();
    if (!trimmedNumber || !trimmedBody) {
      toast.error("Completa el número y el mensaje");
      return;
    }
    sendMutation.mutate({ toNumber: trimmedNumber, body: trimmedBody });
  }

  const charCount = body.length;
  const maxChars = 1600;
  const isSending = sendMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Envío rápido de SMS</h3>
      </div>

      <div>
        <label
          htmlFor="quick-sms-to"
          className="text-xs font-medium text-muted-foreground"
        >
          Número de destino
        </label>
        <input
          id="quick-sms-to"
          type="tel"
          placeholder="+573001234567"
          value={toNumber}
          onChange={e => setToNumber(e.target.value)}
          disabled={isSending}
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Formato E.164 con prefijo internacional (ej. +57 para Colombia)
        </p>
      </div>

      <div>
        <label
          htmlFor="quick-sms-body"
          className="text-xs font-medium text-muted-foreground"
        >
          Mensaje
        </label>
        <textarea
          id="quick-sms-body"
          placeholder="Escribe el mensaje a enviar..."
          value={body}
          onChange={e => setBody(e.target.value.slice(0, maxChars))}
          disabled={isSending}
          rows={5}
          className="mt-1 w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary disabled:opacity-50"
        />
        <div className="mt-1 flex justify-end text-xs text-muted-foreground">
          <span className={charCount >= maxChars ? "text-amber-600" : ""}>
            {charCount} / {maxChars}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSending || !toNumber.trim() || !body.trim()}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isSending ? "Enviando..." : "Enviar SMS"}
      </button>
    </form>
  );
}

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface SmsChatProps {
  leadId: number;
}

export function SmsChat({ leadId }: SmsChatProps) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const msgsQuery = trpc.dialing.listSmsMessages.useQuery(
    { leadId, limit: 50 },
    { refetchInterval: 5000 }
  );
  const sendMutation = trpc.dialing.sendSms.useMutation();

  const messages = msgsQuery.data ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await sendMutation.mutateAsync({ leadId, body: text.trim() });
      setText("");
      utils.dialing.listSmsMessages.invalidate({ leadId, limit: 50 });
    } catch (err: any) {
      toast.error(err?.message || "Error al enviar SMS.");
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Sin mensajes aún.
          </p>
        )}
        {messages.map(msg => {
          const isOut = msg.direction === "outbound";
          return (
            <div
              key={msg.id}
              className={`flex ${isOut ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                  isOut
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "border bg-card rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                {msg.mediaUrl && (
                  <img
                    src={msg.mediaUrl}
                    alt="Media"
                    className="mt-1 max-h-40 rounded"
                  />
                )}
                <p
                  className={`mt-1 text-[10px] ${
                    isOut ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {new Date(msg.sentAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t pt-3">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje..."
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

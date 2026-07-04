import { useState } from "react";
import { Phone, MessageSquare, Headphones, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface SoftphoneProps {
  identity: string;
  onCallStateChange?: (state: "idle" | "ringing" | "ongoing" | "ended" | "online" | "offline") => void;
  onIncomingCall?: (from: string) => void;
  onDeviceReady?: (device: any) => void;
}

type CallState = "idle" | "connecting" | "ringing" | "ongoing";

export function Softphone({ identity, onCallStateChange, onIncomingCall, onDeviceReady }: SoftphoneProps) {
  const [status, setStatus] = useState<"offline" | "online" | "connecting">("offline");
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useState<any>(null);

  const tokenQuery = trpc.dialing.getToken.useQuery(
    { identity },
    { enabled: false }
  );

  const connect = async () => {
    setStatus("connecting");
    setError(null);
    try {
      const { token } = await tokenQuery.refetch().then(r => r.data!);
      if (!token) throw new Error("No se recibió el token de Twilio.");

      const { Device } = await import("@twilio/voice-sdk");

      const device = new Device(token, {
        logLevel: 2,
        allowIncomingWhileBusy: true,
      });

      device.on("registered", () => {
        setStatus("online");
        setError(null);
        onCallStateChange?.("online");
        toast.success("Línea VoIP conectada.");
      });

      device.on("unregistered", () => {
        setStatus("offline");
        onCallStateChange?.("offline");
      });

      device.on("error", (e: any) => {
        setError(e?.message || "Error de conexión Twilio");
        setStatus("offline");
      });

      device.on("incoming", (call: any) => {
        setCallState("ringing");
        onIncomingCall?.(call.parameters?.From || "Desconocido");

        call.on("accept", () => setCallState("ongoing"));
        call.on("disconnect", () => {
          setCallState("idle");
          onCallStateChange?.("ended");
        });
        call.on("cancel", () => {
          setCallState("idle");
          onCallStateChange?.("ended");
        });
        call.on("reject", () => {
          setCallState("idle");
          onCallStateChange?.("ended");
        });

        call.accept();
      });

      device.register();
      (deviceRef as any)[1](device);
      onDeviceReady?.(device);
    } catch (err: any) {
      setError(err?.message || "Error al conectar.");
      setStatus("offline");
    }
  };

  const disconnect = () => {
    const device = (deviceRef as any)[0] as any;
    if (device) {
      device.unregister();
      device.destroy();
    }
    setStatus("offline");
    setCallState("idle");
    setError(null);
    onCallStateChange?.("offline");
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Headphones className="h-4 w-4 text-primary" />
        <span>Softphone VoIP</span>
        <span
          className={`ml-auto inline-flex h-2 w-2 rounded-full ${
            status === "online"
              ? "bg-emerald-500"
              : status === "connecting"
                ? "bg-amber-400"
                : "bg-gray-400"
          }`}
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="text-xs text-muted-foreground">
        Identidad: <span className="font-mono font-medium">{identity}</span>
      </div>

      {callState === "ongoing" && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-4 w-1 animate-bounce rounded-full bg-emerald-500"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            En llamada
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {status === "offline" ? (
          <button
            onClick={connect}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Phone className="h-4 w-4" />
            Conectar línea
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Desconectar
          </button>
        )}

        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`rounded-lg border p-2 ${isMuted ? "bg-red-100 dark:bg-red-950" : ""}`}
          disabled={status !== "online"}
          title={isMuted ? "Mic muteado" : "Mic activo"}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setIsSpeaker(!isSpeaker)}
          className="rounded-lg border p-2"
          disabled={status !== "online"}
          title={isSpeaker ? "Altavoz activo" : "Altavoz apagado"}
        >
          {isSpeaker ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

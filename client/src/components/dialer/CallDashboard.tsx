import { Activity, Wifi, WifiOff, Radio } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CallDashboardProps {
  identity: string;
  status: "offline" | "online" | "connecting";
}

export function CallDashboard({ identity, status }: CallDashboardProps) {
  const callsQuery = trpc.dialing.listCalls.useQuery(
    { limit: 5 },
    { refetchInterval: 10000 }
  );
  const recordingsQuery = trpc.dialing.listRecordings.useQuery(
    { limit: 5 },
    { refetchInterval: 10000 }
  );

  const calls = callsQuery.data ?? [];
  const recordings = recordingsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4 text-primary" />
        <span>Dashboard</span>
      </div>

      {/* Estado */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Canal WebRTC
          </p>
          <div className="mt-2 flex items-center gap-2">
            {status === "online" ? (
              <Wifi className="h-5 w-5 text-emerald-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-gray-400" />
            )}
            <span
              className={`text-lg font-bold ${
                status === "online" ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
              }`}
            >
              {status === "online" ? "Conectado" : status === "connecting" ? "Conectando..." : "Desconectado"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Identidad: {identity || "—"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Grabaciones
          </p>
          <p className="mt-2 text-2xl font-bold">{recordings.length}</p>
          <p className="text-xs text-muted-foreground">últimas sesión</p>
        </div>
      </div>

      {/* Últimas llamadas */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Últimas llamadas
        </p>
        {calls.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin historial reciente.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {calls.map(call => (
              <div
                key={call.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
              >
                <span
                  className={`text-xs font-semibold ${
                    call.status === "completed"
                      ? "text-emerald-600"
                      : call.status === "no_answer"
                        ? "text-amber-600"
                        : call.status === "failed"
                          ? "text-red-600"
                          : "text-muted-foreground"
                  }`}
                >
                  {call.status === "completed"
                    ? "Contestó"
                    : call.status === "no_answer"
                      ? "Sin respuesta"
                      : call.status === "busy"
                        ? "Ocupado"
                        : call.status}
                </span>
                {call.durationSec != null && (
                  <span className="text-xs text-muted-foreground">{call.durationSec}s</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

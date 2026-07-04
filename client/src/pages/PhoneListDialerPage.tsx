import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  Pause,
  Play,
  Square,
  SkipForward,
  CheckCircle,
  XCircle,
  Phone,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useActiveBrand } from "@/contexts/BrandContext";
import { Softphone } from "@/components/dialer/Softphone";
import { ActiveCall } from "@/components/dialer/ActiveCall";
import { Button } from "@/components/ui/button";

type LoopStatus = "idle" | "active" | "paused" | "completed";

export default function PhoneListDialerPage() {
  const params = useParams();
  const listId = parseInt(params.id!, 10);
  const brand = useActiveBrand();
  const [_, setLocation] = useLocation();

  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);
  const callTimeLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const VOICEMAIL_THRESHOLD_MS = 25_000;
  const CALL_TIME_LIMIT_MS = 25_000;
  const [softphoneOnline, setSoftphoneOnline] = useState(false);
  const [loopStatus, setLoopStatus] = useState<LoopStatus>("idle");
  const [currentEntry, setCurrentEntry] = useState<{
    id: number;
    name: string;
    phoneNumber: string;
    leadId: number | null;
  } | null>(null);
  const [showCall, setShowCall] = useState(false);
  const [outcomeSelected, setOutcomeSelected] = useState<
    "answered" | "no_answer" | null
  >(null);

  const utils = trpc.useUtils();
  const startMutation = trpc.phoneLists.startLoop.useMutation();
  const pauseMutation = trpc.phoneLists.pauseLoop.useMutation();
  const resumeMutation = trpc.phoneLists.resumeLoop.useMutation();
  const stopMutation = trpc.phoneLists.stopLoop.useMutation();
  const markAnsweredMutation = trpc.phoneLists.markAnswered.useMutation();
  const markNoAnswerMutation = trpc.phoneLists.markNoAnswer.useMutation();
  const skipMutation = trpc.phoneLists.skipEntry.useMutation();
  const progressQuery = trpc.phoneLists.getProgress.useQuery(
    { listId },
    { enabled: !isNaN(listId), refetchInterval: 3000 }
  );

  const progress = progressQuery.data ?? {
    answered: 0,
    noAnswer: 0,
    skipped: 0,
    pending: 0,
    total: 0,
  };

  const moveToNext = async (
    nextEntry?: {
      id: number;
      name: string;
      phoneNumber: string;
      leadId: number | null;
    } | null
  ) => {
    console.log("[Dialer] ===== moveToNext() called =====", { nextEntry });
    setShowCall(false);
    setCurrentEntry(null);
    setOutcomeSelected(null);

    try {
      // If nextEntry is not passed, fetch it
      let next: typeof nextEntry | null = nextEntry;
      if (!next) {
        const fetched = await utils.phoneLists.getNext.fetch({ listId });
        next = fetched?.entry ?? null;
      }

      console.log("[Dialer] getNext result:", next);
      if (!next) {
        console.log("[Dialer] No more entries → completing loop");
        setLoopStatus("completed");
        await stopMutation.mutateAsync({ listId });
        toast.success(
          "Marcación completada. No quedan más contactos pendientes."
        );
        return;
      }

      const listQuery = await utils.phoneLists.get.fetch({ id: listId });
      const delay = listQuery?.list?.callDelayMs ?? 3000;
      console.log(
        `[Dialer] Next entry: id=${next.id}, name=${next.name}, phone=${next.phoneNumber}, delay=${delay}ms`
      );

      delayTimerRef.current = setTimeout(() => {
        console.log("[Dialer] Delay timer fired, calling connectAndCall");
        connectAndCall(next!);
      }, delay);
    } catch (err: any) {
      console.error("[Dialer] moveToNext error:", err);
      toast.error(err?.message || "Error al obtener siguiente.");
    }
  };

  const connectAndCall = async (entry: {
    id: number;
    name: string;
    phoneNumber: string;
    leadId: number | null;
  }) => {
    console.log(
      `[Dialer] ===== connectAndCall(${entry.id}, ${entry.name}, ${entry.phoneNumber}) =====`
    );
    const device = deviceRef.current;
    if (!device) {
      console.error("[Dialer] ERROR: device is null, softphone not connected");
      toast.error("Softphone no conectado. Conectá la línea primero.");
      return;
    }
    console.log(
      "[Dialer] device state:",
      device.state,
      "| identity:",
      device.identity
    );
    try {
      setCurrentEntry(entry);
      setShowCall(true);
      setOutcomeSelected(null);
      console.log(
        "[Dialer] Calling device.connect with To:",
        entry.phoneNumber
      );
      const call = await device.connect({ params: { To: entry.phoneNumber } });
      console.log(
        "[Dialer] device.connect returned a Call object, parameters:",
        call.parameters
      );
      console.log(
        "[Dialer] Call status right after connect:",
        call.status(),
        "| direction:",
        call.direction
      );
      callRef.current = call;
      callStartTimeRef.current = null;

      // Auto-hangup after 25s time limit
      if (callTimeLimitRef.current) clearTimeout(callTimeLimitRef.current);
      callTimeLimitRef.current = setTimeout(() => {
        const cal = callRef.current;
        if (cal) {
          console.log("[Dialer] 25s timer fired, disconnecting call");
          toast.info(
            "Tiempo límite de 25s alcanzado. Colgando automáticamente."
          );
          cal.disconnect();
        }
      }, CALL_TIME_LIMIT_MS);

      call.on("ringing", () => {
        console.log("[Dialer] Call ringing");
      });
      call.on("accept", () => {
        console.log("[Dialer] Call accepted");
        callStartTimeRef.current = new Date();
      });
      call.on("disconnect", () => {
        console.log(
          "[Dialer] Call disconnected, elapsed:",
          callStartTimeRef.current
            ? Date.now() - callStartTimeRef.current.getTime()
            : 0,
          "ms"
        );
        if (callTimeLimitRef.current) clearTimeout(callTimeLimitRef.current);
        callRef.current = null;
        const elapsed = callStartTimeRef.current
          ? Date.now() - callStartTimeRef.current.getTime()
          : 0;

        if (elapsed > 0 && elapsed <= VOICEMAIL_THRESHOLD_MS) {
          console.log(
            "[Dialer] Detected voicemail (elapsed < 25s), marking no_answer"
          );
          setOutcomeSelected("no_answer");
          toast.warning(
            `Posible buzón de voz detectado (${Math.round(elapsed / 1000)}s < ${Math.round(VOICEMAIL_THRESHOLD_MS / 1000)}s). Marcado automáticamente.`
          );
          // Await the mutation to ensure the DB is updated before we advance
          markNoAnswerMutation
            .mutateAsync({ entryId: entry.id })
            .then(result => {
              console.log(
                "[Dialer] markNoAnswer success, scheduling moveToNext in 1.5s with nextEntry:",
                result?.nextEntry
              );
              utils.phoneLists.getProgress.invalidate({ listId });
              setTimeout(() => moveToNext(result?.nextEntry ?? null), 1500);
            })
            .catch(err => {
              console.error("[Dialer] markNoAnswer failed:", err);
              toast.error("Error al marcar como no contestó.");
              setTimeout(() => moveToNext(), 1500);
            });
        } else {
          console.log(
            "[Dialer] Long call (>25s) ended, asking user for outcome"
          );
          toast("La llamada terminó. ¿Contestó o no?", { duration: 5000 });
        }
      });
      call.on("cancel", () => {
        console.log("[Dialer] Call cancelled");
        callRef.current = null;
      });
      call.on("reject", () => {
        console.log("[Dialer] Call rejected");
        callRef.current = null;
      });
    } catch (err: any) {
      toast.error(err?.message || "Error al marcar.");
      console.error("[Dialer] connectAndCall error:", err);
      setShowCall(false);
      // On error, still try to advance to next after a delay
      setTimeout(() => moveToNext(), 2000);
    }
  };

  const handleStart = async () => {
    console.log("[Dialer] ===== handleStart =====");
    if (!softphoneOnline) {
      console.error("[Dialer] ERROR: softphone not online");
      toast.error("Conectá la línea primero en el Softphone.");
      return;
    }
    try {
      const result = await startMutation.mutateAsync({ listId });
      console.log("[Dialer] startMutation result:", result);
      setLoopStatus("active");
      if (result.firstEntry) {
        console.log("[Dialer] First entry found, calling connectAndCall");
        connectAndCall(result.firstEntry);
      } else {
        console.log("[Dialer] No first entry");
        toast.info("La lista no tiene contactos.");
      }
    } catch (err: any) {
      console.error("[Dialer] handleStart error:", err);
      toast.error(err?.message || "Error al iniciar.");
    }
  };

  const handleMarkAnswered = async () => {
    if (!currentEntry) return;
    setOutcomeSelected("answered");
    try {
      await markAnsweredMutation.mutateAsync({ entryId: currentEntry.id });
      toast.success("Marcado como contestado.");
      utils.phoneLists.getProgress.invalidate({ listId });
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  const handleMarkNoAnswer = async () => {
    if (!currentEntry) return;
    setOutcomeSelected("no_answer");
    try {
      const result = await markNoAnswerMutation.mutateAsync({
        entryId: currentEntry.id,
      });
      utils.phoneLists.getProgress.invalidate({ listId });
      toast.success("Marcado como no contestó. WhatsApp enviado al cliente.");
      setTimeout(() => moveToNext(result?.nextEntry ?? null), 1500);
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  const handleSkip = async () => {
    if (!currentEntry) return;
    try {
      await skipMutation.mutateAsync({ entryId: currentEntry.id });
      utils.phoneLists.getProgress.invalidate({ listId });
      moveToNext();
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  const handleHangup = () => {
    if (callTimeLimitRef.current) clearTimeout(callTimeLimitRef.current);
    callRef.current?.disconnect();
    callRef.current = null;
  };

  const handleNext = () => {
    if (outcomeSelected) {
      moveToNext();
    } else {
      toast("Seleccioná Sí contestó o No contestó primero.", {
        duration: 3000,
      });
    }
  };

  const handlePause = async () => {
    try {
      if (loopStatus === "active") {
        await pauseMutation.mutateAsync({ listId });
        setLoopStatus("paused");
        if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        toast.info("Marcación pausada.");
      } else {
        await resumeMutation.mutateAsync({ listId });
        setLoopStatus("active");
        toast.info("Marcación reanudada.");
      }
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  const handleStop = async () => {
    if (!confirm("¿Detener la marcación definitivamente?")) return;
    try {
      await stopMutation.mutateAsync({ listId });
      setLoopStatus("completed");
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      callRef.current?.disconnect();
      setCurrentEntry(null);
      setShowCall(false);
      toast.success("Marcación detenida.");
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (callTimeLimitRef.current) clearTimeout(callTimeLimitRef.current);
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/phone-lists/${listId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Marcación en bucle {brand.displayName || brand.organizationName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {loopStatus === "active"
              ? "Marcando automáticamente..."
              : loopStatus === "paused"
                ? "Pausada"
                : loopStatus === "completed"
                  ? "Completada"
                  : "Lista para iniciar"}
          </p>
        </div>
        {loopStatus !== "idle" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={loopStatus === "completed"}
            >
              {loopStatus === "paused" ? (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  Reanudar
                </>
              ) : (
                <>
                  <Pause className="mr-1.5 h-4 w-4" />
                  Pausar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="text-red-600 hover:text-red-700"
              disabled={loopStatus === "completed"}
            >
              <Square className="mr-1.5 h-4 w-4" />
              Detener
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Softphone
            identity={
              brand.organizationName?.replace(/[^a-zA-Z0-9]/g, "_") || "admin"
            }
            onCallStateChange={state => {
              if (state === "online" || state === "offline")
                setSoftphoneOnline(state === "online");
            }}
            onDeviceReady={device => {
              deviceRef.current = device;
            }}
          />

          {loopStatus === "idle" && (
            <Button
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleStart}
              disabled={!softphoneOnline}
            >
              <Play className="mr-2 h-5 w-5" />
              Iniciar marcación automática
            </Button>
          )}

          {showCall && currentEntry && (
            <>
              <ActiveCall
                phoneNumber={currentEntry.phoneNumber}
                leadName={currentEntry.name}
                onHangup={handleHangup}
                onEnded={() => setShowCall(false)}
              />

              {/* Outcome buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  variant={
                    outcomeSelected === "answered" ? "default" : "outline"
                  }
                  className={`h-14 text-base font-semibold ${
                    outcomeSelected === "answered"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                  }`}
                  onClick={handleMarkAnswered}
                  disabled={outcomeSelected !== null}
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Sí contestó
                </Button>
                <Button
                  size="lg"
                  variant={
                    outcomeSelected === "no_answer" ? "default" : "outline"
                  }
                  className={`h-14 text-base font-semibold ${
                    outcomeSelected === "no_answer"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
                  }`}
                  onClick={handleMarkNoAnswer}
                  disabled={outcomeSelected !== null}
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  No contestó
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleSkip}
                  disabled={!currentEntry}
                >
                  <SkipForward className="mr-1.5 h-4 w-4" />
                  Saltar contacto
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-primary"
                  onClick={handleNext}
                  disabled={!outcomeSelected}
                >
                  Siguiente →
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Progress sidebar */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">
              Progreso:{" "}
              {progress.answered + progress.noAnswer + progress.skipped} de{" "}
              {progress.total}
            </h3>

            <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="flex h-full">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{
                    width: `${progress.total ? (progress.answered / progress.total) * 100 : 0}%`,
                  }}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{
                    width: `${progress.total ? (progress.noAnswer / progress.total) * 100 : 0}%`,
                  }}
                />
                <div
                  className="bg-gray-300 transition-all dark:bg-gray-600"
                  style={{
                    width: `${progress.total ? (progress.skipped / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center text-sm">
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {progress.answered}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Contestaron
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {progress.noAnswer}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sin respuesta
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-2xl font-bold text-muted-foreground">
                  {progress.skipped}
                </p>
                <p className="text-xs text-muted-foreground">Saltados</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-2xl font-bold">{progress.pending}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

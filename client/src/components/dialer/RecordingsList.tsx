import { useState } from "react";
import { Download, Music, Play, Pause } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function RecordingsList() {
  const query = trpc.dialing.listRecordings.useQuery(
    { limit: 30 },
    { refetchInterval: 15000 }
  );

  const [playingId, setPlayingId] = useState<number | null>(null);
  const recordings = query.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Music className="h-4 w-4 text-primary" />
        <span>Grabaciones</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {recordings.length} archivo(s)
        </span>
      </div>

      {recordings.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No hay grabaciones aún. Las llamadas completadas y grabadas aparecerán
          aquí.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {recordings.map(rec => {
            const isPlaying = playingId === rec.id;
            const canPlay = rec.status === "downloaded" && rec.id;
            return (
              <div
                key={rec.id}
                className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Music className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {rec.twilioCallSid || `Grabación #${rec.id}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {rec.durationSec}s
                      {rec.status === "downloaded"
                        ? " · Descargada"
                        : rec.status === "pending"
                          ? " · Pendiente"
                          : " · Fallida"}
                    </p>
                  </div>
                  {canPlay && (
                    <audio
                      id={`audio-${rec.id}`}
                      src={`/api/recordings/${rec.id}/audio`}
                      preload="none"
                      onEnded={() => setPlayingId(null)}
                      onPause={() => setPlayingId(null)}
                    />
                  )}
                  {canPlay && (
                    <button
                      onClick={() => {
                        const audio = document.getElementById(
                          `audio-${rec.id}`
                        ) as HTMLAudioElement | null;
                        if (!audio) return;
                        if (isPlaying) {
                          audio.pause();
                          setPlayingId(null);
                        } else {
                          document
                            .querySelectorAll("audio")
                            .forEach(a => a.pause());
                          audio.play().catch(err => {
                            console.error("Audio play error:", err);
                            toast?.error?.("No se pudo reproducir el audio.");
                          });
                          setPlayingId(rec.id);
                        }
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                      title={isPlaying ? "Pausar" : "Reproducir"}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {canPlay && (
                    <a
                      href={`/api/recordings/${rec.id}/audio`}
                      download={`grabacion-${rec.twilioCallSid || rec.id}.mp3`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      title="Descargar MP3"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

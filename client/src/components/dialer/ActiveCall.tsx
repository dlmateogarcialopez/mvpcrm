import { useEffect, useState, useRef } from "react";
import { PhoneOff, Clock } from "lucide-react";

interface ActiveCallProps {
  phoneNumber: string;
  leadName?: string;
  onHangup: () => void;
  onEnded: () => void;
  duration?: number;
}

export function ActiveCall({ phoneNumber, leadName, onHangup, onEnded, duration: externalDuration }: ActiveCallProps) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const displayDuration = externalDuration ?? elapsed;

  const mm = Math.floor(displayDuration / 60)
    .toString()
    .padStart(2, "0");
  const ss = (displayDuration % 60).toString().padStart(2, "0");

  const handleHangup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onHangup();
    onEnded();
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-6 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <Clock className="h-3.5 w-3.5" />
        Llamada en curso
      </div>

      <p className="font-mono text-3xl font-bold tabular-nums tracking-wider">
        {mm}:{ss}
      </p>

      {leadName && (
        <p className="text-sm font-medium">{leadName}</p>
      )}

      <p className="font-mono text-sm text-muted-foreground">{phoneNumber}</p>

      <div className="flex gap-1 mt-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-5 w-1 animate-pulse rounded-full bg-emerald-500"
            style={{
              animationDelay: `${i * 0.15}s`,
              animationDuration: "0.8s",
            }}
          />
        ))}
      </div>

      <button
        onClick={handleHangup}
        className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-red-700"
      >
        <PhoneOff className="h-5 w-5" />
        Colgar
      </button>
    </div>
  );
}

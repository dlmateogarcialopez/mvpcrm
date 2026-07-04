import { useEffect, useRef, useState } from "react";
import { Delete, Phone as PhoneIcon } from "lucide-react";

interface DialerKeypadProps {
  onDial: (number: string, mode: "webrtc" | "clicktocall") => void;
  disabled?: boolean;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const ALLOWED_CHARS = /^[\d\s\-+()]*$/;

export function DialerKeypad({ onDial, disabled }: DialerKeypadProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const press = (digit: string) => {
    if (disabled) return;
    setValue(v => v + digit);
    inputRef.current?.focus();
  };

  const backspace = () => {
    if (disabled) return;
    setValue(v => v.slice(0, -1));
    inputRef.current?.focus();
  };

  const clear = () => {
    if (disabled) return;
    setValue("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        clear();
        return;
      }

      if (
        /^[\d]$/.test(e.key) ||
        e.key === "*" ||
        e.key === "#" ||
        e.key === "+"
      ) {
        press(e.key);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!ALLOWED_CHARS.test(raw)) return;
    setValue(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onDial(value.trim(), "webrtc");
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const cleaned = pasted.replace(/[^\d\s\-+()]/g, "");
    setValue(v => v + cleaned);
  };

  const dial = () => {
    if (!value.trim() || disabled) return;
    onDial(value.trim(), "webrtc");
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <PhoneIcon className="h-4 w-4 text-primary" />
        <span>Dialer</span>
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => inputRef.current?.select()}
          placeholder="+57XXXXXXXXXX"
          disabled={disabled}
          className="w-full rounded-lg border bg-muted/40 px-3 py-3 pr-10 text-center font-mono text-lg font-medium tracking-wide focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpiar"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Delete className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.flat().map(key => (
          <button
            type="button"
            key={key}
            onClick={() => press(key)}
            disabled={disabled}
            className="h-12 rounded-lg border bg-card font-mono text-lg font-medium shadow-sm transition-colors hover:border-primary hover:text-primary active:scale-95 disabled:opacity-40"
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={backspace}
        disabled={disabled || value.length === 0}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        Borrar
      </button>

      <button
        type="button"
        onClick={dial}
        disabled={disabled || !value.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PhoneIcon className="h-4 w-4" />
        Marcar
      </button>
    </div>
  );
}

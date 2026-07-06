import { useState } from "react";
import { Edit3, Check, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface EditableTextProps {
  storageKey: string;
  defaultText: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export function EditableText({
  storageKey,
  defaultText,
  className = "",
  as: Tag = "span",
}: EditableTextProps) {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const isSuperAdmin = meQuery.data?.role === "superadmin";

  const layoutQuery = trpc.leads.getFormLayout.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const utils = trpc.useUtils();
  const saveMutation = trpc.leads.saveFormLayout.useMutation({
    onSuccess: () => {
      utils.leads.getFormLayout.invalidate();
      toast.success("Texto guardado");
    },
    onError: e => toast.error(e.message),
  });

  const currentText =
    ((layoutQuery.data as any)?.textOverrides?.[storageKey]) ?? defaultText;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentText);

  function startEdit() {
    setDraft(currentText);
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    const existing: Record<string, string> = {
      ...((layoutQuery.data as any)?.textOverrides ?? {}),
    };
    if (trimmed && trimmed !== defaultText) {
      existing[storageKey] = trimmed;
    } else {
      delete existing[storageKey];
    }
    saveMutation.mutate({
      overrides: {
        textOverrides: existing,
        hiddenFields: (layoutQuery.data as any)?.hiddenFields,
        fieldLabels: (layoutQuery.data as any)?.fieldLabels,
        fieldRequired: (layoutQuery.data as any)?.fieldRequired,
      },
    });
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  if (!isSuperAdmin || !editing) {
    return (
      <Tag className={className}>
        {currentText}
        {isSuperAdmin && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center justify-center ml-1.5 rounded-full p-0.5 text-muted-foreground/40 hover:text-primary hover:bg-muted/50 transition align-middle"
            title="Editar texto"
          >
            <Edit3 className="h-3 w-3" />
          </button>
        )}
      </Tag>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className={`rounded border bg-background px-2 py-0.5 text-sm outline-none transition focus:border-primary ${className}`}
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
      />
      <button
        type="button"
        onClick={save}
        disabled={saveMutation.isPending}
        className="rounded-full p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
        title="Guardar"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={cancel}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-red-500"
        title="Cancelar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

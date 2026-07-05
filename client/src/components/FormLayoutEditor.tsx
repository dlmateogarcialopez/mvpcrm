import { useState } from "react";
import {
  Eye,
  EyeOff,
  Settings,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface FormLayoutOverrides {
  hiddenFields?: string[];
  fieldLabels?: Record<string, string>;
  fieldRequired?: Record<string, boolean>;
}

interface DefaultField {
  key: string;
  label: string;
  type: string;
  block: string;
  required?: boolean;
}

const STEP1_FIELDS: DefaultField[] = [
  { key: "nombreCliente", label: "Contacto principal", type: "text", block: "contacto", required: true },
  { key: "telefono", label: "Teléfono", type: "text", block: "contacto", required: true },
  { key: "correo", label: "Correo", type: "email", block: "contacto", required: true },
  { key: "partyKind", label: "Tipo de registro", type: "select", block: "clasificacion" },
  { key: "nombreEmpresa", label: "Empresa", type: "text", block: "clasificacion" },
  { key: "ciudad", label: "Ciudad", type: "text", block: "clasificacion" },
  { key: "canalOrigen", label: "Canal de origen", type: "select", block: "clasificacion" },
  { key: "fechaVisita", label: "Fecha del evento", type: "datetime", block: "contexto" },
  { key: "tipoEvento", label: "Motivo de viaje", type: "select", block: "contexto" },
];

const BLOCK_LABELS: Record<string, string> = {
  contacto: "Bloque de contacto",
  clasificacion: "Clasificación comercial",
  contexto: "Contexto de la oportunidad",
};

export function FormLayoutEditor({
  currentOverrides,
  onSaved,
}: {
  currentOverrides: FormLayoutOverrides | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(
    new Set(currentOverrides?.hiddenFields ?? [])
  );
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>(
    currentOverrides?.fieldLabels ?? {}
  );
  const [fieldRequired, setFieldRequired] = useState<Record<string, boolean>>(
    currentOverrides?.fieldRequired ?? {}
  );

  const saveMutation = trpc.leads.saveFormLayout.useMutation({
    onSuccess: () => {
      toast.success("Campos del formulario guardados");
      onSaved();
    },
    onError: e => toast.error(e.message),
  });

  function handleOpen() {
    setHiddenFields(new Set(currentOverrides?.hiddenFields ?? []));
    setFieldLabels(currentOverrides?.fieldLabels ?? {});
    setFieldRequired(currentOverrides?.fieldRequired ?? {});
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function toggleHidden(key: string) {
    setHiddenFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateLabel(key: string, value: string) {
    setFieldLabels(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  function toggleRequired(key: string) {
    setFieldRequired(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }

  function handleSave() {
    const overrides: FormLayoutOverrides = {};
    if (hiddenFields.size > 0) overrides.hiddenFields = [...hiddenFields];
    if (Object.keys(fieldLabels).length > 0) overrides.fieldLabels = fieldLabels;
    if (Object.keys(fieldRequired).length > 0) overrides.fieldRequired = fieldRequired;
    saveMutation.mutate({ overrides });
  }

  function handleReset() {
    setHiddenFields(new Set());
    setFieldLabels({});
    setFieldRequired({});
  }

  const blocks = ["contacto", "clasificacion", "contexto"];

  const hasChanges =
    hiddenFields.size !==
      new Set(currentOverrides?.hiddenFields ?? []).size ||
    JSON.stringify(fieldLabels) !==
      JSON.stringify(currentOverrides?.fieldLabels ?? {}) ||
    JSON.stringify(fieldRequired) !==
      JSON.stringify(currentOverrides?.fieldRequired ?? {});

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
        title="Gestionar campos del paso 1"
      >
        <Settings className="h-3.5 w-3.5" />
        Campos
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="mx-4 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Gestionar campos — Paso 1
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mostrá u ocultá campos, renombrá etiquetas y definí cuáles son
                  obligatorios.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {blocks.map(blockKey => {
                const blockFields = STEP1_FIELDS.filter(
                  f => f.block === blockKey
                );
                // Sort: visible first, hidden last
                const sorted = [
                  ...blockFields.filter(f => !hiddenFields.has(f.key)),
                  ...blockFields.filter(f => hiddenFields.has(f.key)),
                ];

                return (
                  <div key={blockKey}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {BLOCK_LABELS[blockKey]}
                    </p>
                    <div className="space-y-1.5">
                      {sorted.map(f => {
                        const isHidden = hiddenFields.has(f.key);
                        const label =
                          fieldLabels[f.key] ?? f.label;
                        const required =
                          fieldRequired[f.key] ?? f.required ?? false;

                        return (
                          <div
                            key={f.key}
                            className={`flex items-center gap-2 rounded-lg border p-2 ${
                              isHidden
                                ? "bg-muted/20 opacity-50"
                                : "bg-background"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleHidden(f.key)}
                              className={
                                isHidden
                                  ? "text-muted-foreground hover:text-foreground"
                                  : "text-primary hover:text-primary/80"
                              }
                              title={isHidden ? "Mostrar campo" : "Ocultar campo"}
                            >
                              {isHidden ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <input
                              type="text"
                              value={label}
                              onChange={e =>
                                updateLabel(f.key, e.target.value)
                              }
                              className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                              disabled={isHidden}
                            />

                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase w-16 text-center">
                              {f.type}
                            </span>

                            <label className="flex items-center gap-1 text-[10px]">
                              <input
                                type="checkbox"
                                checked={required}
                                onChange={() => toggleRequired(f.key)}
                                disabled={isHidden}
                              />
                              req
                            </label>

                            <button
                              type="button"
                              onClick={() => {
                                setFieldLabels(prev => {
                                  const next = { ...prev };
                                  delete next[f.key];
                                  return next;
                                });
                              }}
                              className="text-muted-foreground hover:text-red-500"
                              title="Restaurar etiqueta por defecto"
                              disabled={!fieldLabels[f.key]}
                            >
                              <Undo2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
              >
                <Undo2 className="inline h-3 w-3 mr-1" />
                Restaurar defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !hasChanges}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

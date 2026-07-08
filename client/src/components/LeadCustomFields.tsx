import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Check,
  X,
  Settings,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

export interface CustomFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  options?: string[];
  required?: boolean;
  order: number;
  block?: string;
}

interface LeadCustomFieldsProps {
  fieldDefs: CustomFieldDef[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  readOnly?: boolean;
  isSuperAdmin?: boolean;
}

export function LeadCustomFields({
  fieldDefs,
  values,
  onChange,
  readOnly,
  isSuperAdmin,
}: LeadCustomFieldsProps) {
  if (fieldDefs.length === 0) return null;

  const sorted = [...fieldDefs].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Campos personalizados
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {sorted.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium flex items-center gap-1">
              {f.label}
              {f.required && (
                <span className="text-red-500">*</span>
              )}
            </label>
            {f.type === "select" ? (
              <select
                value={values[f.key] ?? ""}
                onChange={e => onChange(f.key, e.target.value)}
                disabled={readOnly}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {(f.options ?? []).map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : f.type === "date" ? (
              <input
                type="date"
                value={values[f.key] ?? ""}
                onChange={e => onChange(f.key, e.target.value)}
                disabled={readOnly}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            ) : f.type === "number" ? (
              <input
                type="number"
                value={values[f.key] ?? ""}
                onChange={e => onChange(f.key, e.target.value)}
                disabled={readOnly}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            ) : (
              <input
                type="text"
                value={values[f.key] ?? ""}
                onChange={e => onChange(f.key, e.target.value)}
                disabled={readOnly}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeadFieldDefinitionsEditor({
  fieldDefs,
  onSave,
  isSuperAdmin,
}: {
  fieldDefs: CustomFieldDef[];
  onSave: (defs: CustomFieldDef[]) => void;
  isSuperAdmin?: boolean;
}) {
  const [fields, setFields] = useState<CustomFieldDef[]>(() =>
    [...fieldDefs].sort((a, b) => a.order - b.order)
  );
  const [editing, setEditing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const saveMutation = trpc.leads.saveLeadFieldDefs.useMutation({
    onSuccess: () => {
      toast.success("Campos guardados correctamente");
      setEditing(false);
      onSave(fields);
    },
    onError: e => toast.error(e.message),
  });

  function addField() {
    const next = [...fields];
    const key = `cf_${Date.now()}`;
    next.push({
      key,
      label: "",
      type: "text",
      order: next.length,
    });
    setFields(next);
  }

  function updateField(index: number, patch: Partial<CustomFieldDef>) {
    setFields(prev => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields(prev => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((f, i) => (f.order = i));
    setFields(next);
  }

  function handleSave() {
    const valid = fields.filter(f => f.label.trim());
    saveMutation.mutate({ fields: valid });
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Definición de campos personalizados
        </h3>
        <button
          type="button"
          onClick={() => setShowEditor(!showEditor)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <Settings className="h-3.5 w-3.5" />
          {showEditor ? "Ocultar" : "Configurar"}
        </button>
      </div>

      {showEditor && (
        <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay campos definidos. Agregá campos personalizados para los
              leads de esta organización.
            </p>
          )}

          {fields.map((f, i) => (
            <div key={f.key}>
              <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
                <button
                  type="button"
                  onClick={() => moveField(i, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-primary disabled:opacity-30"
                  title="Mover arriba"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={f.label}
                  onChange={e => updateField(i, { label: e.target.value })}
                  placeholder="Nombre del campo"
                  className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                />
                <select
                  value={f.type}
                  onChange={e => updateField(i, { type: e.target.value as any })}
                  className="rounded border bg-background px-2 py-1 text-sm w-24"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="select">Selector</option>
                  <option value="date">Fecha</option>
                </select>
                <select
                  value={f.block ?? ""}
                  onChange={e =>
                    updateField(i, {
                      block: e.target.value || undefined,
                    })
                  }
                  className="rounded border bg-background px-1 py-1 text-xs w-20"
                >
                  <option value="">Paso 2+</option>
                  <option value="contacto">Contacto</option>
                  <option value="clasificacion">Clasif.</option>
                  <option value="contexto">Contexto</option>
                </select>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={f.required ?? false}
                    onChange={e => updateField(i, { required: e.target.checked })}
                  />
                  Req.
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(i, 1)}
                    disabled={i === fields.length - 1}
                    className="text-muted-foreground hover:text-primary disabled:opacity-30 text-xs"
                    title="Mover abajo"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {f.type === "select" ? (
                <div className="ml-6 mt-2 space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Categorías para "{f.label || "este campo"}":
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(f.options ?? []).map((opt, oi) => (
                      <span
                        key={oi}
                        className="inline-flex items-center gap-1 rounded-full border bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() =>
                            updateField(i, {
                              options: (f.options ?? []).filter(
                                (_, j) => j !== oi
                              ),
                            })
                          }
                          className="text-primary/60 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder="+ agregar"
                      className="w-24 rounded-full border border-dashed bg-background px-2.5 py-1 text-xs outline-none transition focus:border-primary focus:w-36"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            updateField(i, {
                              options: [...(f.options ?? []), val],
                            });
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={addField}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar campo
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

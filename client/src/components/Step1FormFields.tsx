import { useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import type { CustomFieldDef } from "./LeadCustomFields";
import { EditableText } from "./EditableText";

export interface FormLayoutOverrides {
  hiddenFields?: string[];
  fieldLabels?: Record<string, string>;
  fieldRequired?: Record<string, boolean>;
  blockAssignments?: Record<string, { block: string; order: number }>;
  textOverrides?: Record<string, string>;
}

interface BlockField {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "select" | "datetime" | "date";
  block: "contacto" | "clasificacion" | "contexto";
  order: number;
  required?: boolean;
  options?: string[];
  isCustom?: boolean;
  condition?: (ctx: { partyKind: string }) => boolean;
}

const STEP1_BLOCKS = {
  contacto: {
    title: "Bloque de contacto",
    subtitle:
      "Datos directos de la persona que atiende el proceso comercial.",
    gridClass: "",
  },
  clasificacion: {
    title: "Clasificación comercial",
    subtitle:
      "Define si la oportunidad es de persona o empresa, la ciudad de origen y el canal por el que llegó.",
    gridClass: "",
  },
  contexto: {
    title: "Contexto de la oportunidad",
    subtitle:
      "Fecha estimada del evento y tipo de viaje que motiva la cotización.",
    gridClass: "sm:grid-cols-2",
  },
};

const DEFAULT_FIELDS: BlockField[] = [
  { key: "nombreCliente", label: "Contacto principal", type: "text", block: "contacto", order: 0, required: true },
  { key: "telefono", label: "Teléfono", type: "text", block: "contacto", order: 1, required: true },
  { key: "correo", label: "Correo", type: "email", block: "contacto", order: 2, required: true },
  { key: "partyKind", label: "Tipo de registro", type: "select", block: "clasificacion", order: 0 },
  { key: "nombreEmpresa", label: "Empresa", type: "text", block: "clasificacion", order: 1, condition: ctx => ctx.partyKind === "empresa" },
  { key: "ciudad", label: "Ciudad", type: "text", block: "clasificacion", order: 2 },
  { key: "canalOrigen", label: "Canal de origen", type: "select", block: "clasificacion", order: 3 },
  { key: "fechaVisita", label: "Fecha del evento o reunión", type: "datetime", block: "contexto", order: 0 },
  { key: "tipoEvento", label: "Motivo de viaje", type: "select", block: "contexto", order: 1 },
];

function visibleFields(
  block: string,
  overrides: FormLayoutOverrides | null,
  customFields: CustomFieldDef[],
  ctx: { partyKind: string }
): BlockField[] {
  const hidden = new Set(overrides?.hiddenFields ?? []);
  const customMerged: BlockField[] = customFields
    .filter(c => c.block === block)
    .map(c => ({
      key: c.key,
      label: c.label,
      type: c.type === "select" ? "select" : c.type as any,
      block: block as any,
      order: c.order ?? 99,
      required: c.required,
      options: c.options,
      isCustom: true,
    }));

  const stdFields = DEFAULT_FIELDS
    .filter(f => f.block === block && !hidden.has(f.key))
    .map(f => ({
      ...f,
      label: overrides?.fieldLabels?.[f.key] ?? f.label,
      required: overrides?.fieldRequired?.[f.key] ?? f.required,
    }));

  return [...stdFields, ...customMerged]
    .filter(f => !f.condition || f.condition(ctx))
    .sort((a, b) => a.order - b.order);
}

interface Step1FormFieldsProps {
  form: Record<string, any>;
  partyKind: string;
  fieldErrors: Record<string, string | undefined>;
  overrides: FormLayoutOverrides | null;
  customFields: CustomFieldDef[];
  onChange: (key: string, value: any) => void;
  onPartyKindChange: (value: string) => void;
  onLayoutSaved: () => void;
}

export function Step1FormFields({
  form,
  partyKind,
  fieldErrors,
  overrides,
  customFields,
  onChange,
  onPartyKindChange,
  onLayoutSaved,
}: Step1FormFieldsProps) {
  const blocks = ["contacto", "clasificacion", "contexto"] as const;
  const [editingBlock, setEditingBlock] = useState<string | null>(null);

  const [draftHidden, setDraftHidden] = useState<Set<string>>(new Set());
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const [draftRequired, setDraftRequired] = useState<Record<string, boolean>>({});

  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "select" | "date">("text");
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>([]);

  const saveMutation = trpc.leads.saveFormLayout.useMutation({
    onSuccess: () => {
      toast.success("Campos guardados");
      setEditingBlock(null);
      onLayoutSaved();
    },
    onError: e => toast.error(e.message),
  });

  function startEdit(block: string) {
    setDraftHidden(new Set(overrides?.hiddenFields ?? []));
    setDraftLabels({ ...(overrides?.fieldLabels ?? {}) });
    setDraftRequired({ ...(overrides?.fieldRequired ?? {}) });
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldOptions([]);
    setEditingBlock(block);
  }

  function cancelEdit() {
    setEditingBlock(null);
  }

  function toggleHidden(key: string) {
    setDraftHidden(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function updateLabel(key: string, val: string) {
    setDraftLabels(prev => {
      const next = { ...prev };
      val ? (next[key] = val) : delete next[key];
      return next;
    });
  }

  function toggleRequired(key: string) {
    setDraftRequired(prev => {
      const next = { ...prev };
      next[key] ? delete next[key] : (next[key] = true);
      return next;
    });
  }

  const saveCustomMutation = trpc.leads.saveLeadFieldDefs.useMutation({
    onSuccess: () => {
      setNewFieldName("");
      setEditingCustomKey(null);
      toast.success("Campo guardado");
      setEditingBlock(null);
      onLayoutSaved();
    },
    onError: e => toast.error(e.message),
  });

  const [editingCustomKey, setEditingCustomKey] = useState<string | null>(null);
  const [editingCustomLabel, setEditingCustomLabel] = useState("");
  const [editingCustomType, setEditingCustomType] = useState<"text" | "number" | "select" | "date">("text");
  const [editingCustomOptions, setEditingCustomOptions] = useState<string[]>([]);

  function handleSaveBlock() {
    const mergedOverrides: FormLayoutOverrides = {};
    if (draftHidden.size > 0) mergedOverrides.hiddenFields = [...draftHidden];
    if (Object.keys(draftLabels).length > 0) mergedOverrides.fieldLabels = { ...draftLabels };
    if (Object.keys(draftRequired).length > 0) mergedOverrides.fieldRequired = { ...draftRequired };
    saveMutation.mutate({ overrides: mergedOverrides });
  }

  function handleAddField() {
    if (!newFieldName.trim() || !editingBlock) return;
    const key = `cf_${Date.now()}`;
    const allFields: CustomFieldDef[] = [
      ...customFields.map(f => ({ ...f })),
      {
        key,
        label: newFieldName.trim(),
        type: newFieldType,
        block: editingBlock,
        order: 99,
        required: false,
        options: newFieldType === "select" ? newFieldOptions : undefined,
      } as CustomFieldDef,
    ];
    saveCustomMutation.mutate({ fields: allFields });
    setNewFieldOptions([]);
  }

  function handleDeleteCustom(customKey: string) {
    const allFields = customFields.filter(f => f.key !== customKey).map(f => ({ ...f }));
    saveCustomMutation.mutate({ fields: allFields });
  }

  function handleSaveCustomEdit(customKey: string) {
    const allFields = customFields.map(f => {
      if (f.key !== customKey) return { ...f };
      return { ...f, label: editingCustomLabel.trim() || f.label, type: editingCustomType, options: editingCustomType === "select" ? editingCustomOptions : undefined };
    });
    saveCustomMutation.mutate({ fields: allFields });
  }

  function startEditCustom(c: CustomFieldDef) {
    setEditingCustomKey(c.key);
    setEditingCustomLabel(c.label);
    setEditingCustomType(c.type);
    setEditingCustomOptions(c.options ?? []);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          <EditableText storageKey="step1.title" defaultText="1. Contacto y oportunidad" as="span" />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          <EditableText
            storageKey="step1.subtitle"
            defaultText="Primero registra la persona contacto, luego define si la oportunidad es de persona o empresa y finalmente completa el contexto comercial."
            as="span"
          />
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.05fr_0.9fr]">
        {blocks.map(block => {
          const blockDef = STEP1_BLOCKS[block];
          const isEditing = editingBlock === block;
          const fields = visibleFields(block, overrides, customFields, { partyKind });

          return (
            <div key={block} className="rounded-2xl border bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {blockDef.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <EditableText
                      storageKey={`block.${block}.subtitle`}
                      defaultText={blockDef.subtitle}
                      as="span"
                    />
                  </p>
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => startEdit(block)}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
                    title="Editar campos del bloque"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                )}
                {isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveBlock}
                      disabled={saveMutation.isPending}
                      className="rounded-full p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                      title="Guardar"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-red-500"
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="mt-4 space-y-2">
                  {DEFAULT_FIELDS.filter(f => f.block === block).map(f => {
                    const isHidden = draftHidden.has(f.key);
                    const label = draftLabels[f.key] ?? f.label;
                    const required = draftRequired[f.key] ?? f.required ?? false;

                    return (
                      <div
                        key={f.key}
                        className={`flex items-center gap-2 rounded-lg border p-2 ${isHidden ? "bg-muted/20 opacity-50" : "bg-muted/10"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleHidden(f.key)}
                          className={isHidden ? "text-muted-foreground hover:text-foreground" : "text-primary hover:text-primary/80"}
                          title={isHidden ? "Mostrar" : "Ocultar"}
                        >
                          {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <input
                          type="text"
                          value={label}
                          onChange={e => updateLabel(f.key, e.target.value)}
                          disabled={isHidden}
                          className="flex-1 rounded border bg-background px-2 py-1 text-sm disabled:opacity-50"
                        />
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase w-16 text-center shrink-0">
                          {f.type === "email" ? "text" : f.type}
                        </span>
                        <label className="flex items-center gap-1 text-[10px] shrink-0">
                          <input
                            type="checkbox"
                            checked={required}
                            onChange={() => toggleRequired(f.key)}
                            disabled={isHidden}
                          />
                          req
                        </label>
                      </div>
                    );
                  })}

                  {customFields.filter(c => c.block === block).map(c => (
                    <div
                      key={c.key}
                      className="flex items-center gap-2 rounded-lg border bg-muted/10 p-2"
                    >
                      {editingCustomKey === c.key ? (
                        <div className="w-full space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingCustomLabel}
                              onChange={e => setEditingCustomLabel(e.target.value)}
                              className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                              autoFocus
                            />
                            <select
                              value={editingCustomType}
                              onChange={e => setEditingCustomType(e.target.value as any)}
                              className="rounded border bg-background px-1.5 py-1 text-xs w-20 shrink-0"
                            >
                              <option value="text">Texto</option>
                              <option value="number">Número</option>
                              <option value="select">Selector</option>
                              <option value="date">Fecha</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleSaveCustomEdit(c.key)}
                              className="rounded-full p-1 text-emerald-600 hover:bg-emerald-50 shrink-0"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCustomKey(null)}
                              className="rounded-full p-1 text-muted-foreground hover:bg-muted shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {editingCustomType === "select" ? (
                            <div className="flex flex-wrap items-center gap-1.5 pl-1">
                              {editingCustomOptions.map((opt, oi) => (
                                <span
                                  key={oi}
                                  className="inline-flex items-center gap-1 rounded-full border bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                                >
                                  {opt}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingCustomOptions(prev =>
                                        prev.filter((_, j) => j !== oi)
                                      )
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
                                      setEditingCustomOptions(prev => [...prev, val]);
                                      (e.target as HTMLInputElement).value = "";
                                    }
                                  }
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <span className="text-primary"><Eye className="h-3.5 w-3.5" /></span>
                          <span className="flex-1 text-sm font-medium truncate">{c.label}</span>
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary uppercase w-16 text-center bg-primary/5 shrink-0">
                            {c.type}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditCustom(c)}
                            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-primary shrink-0"
                            title="Editar"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(c.key)}
                            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-red-500 shrink-0"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/5 p-2">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={e => setNewFieldName(e.target.value)}
                      placeholder="Nuevo campo..."
                      className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                    />
                    <select
                      value={newFieldType}
                      onChange={e => setNewFieldType(e.target.value as any)}
                      className="rounded border bg-background px-1.5 py-1 text-xs w-20 shrink-0"
                    >
                      <option value="text">Texto</option>
                      <option value="number">Número</option>
                      <option value="select">Selector</option>
                      <option value="date">Fecha</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddField}
                      disabled={!newFieldName.trim()}
                      className="rounded-full p-1 text-primary hover:bg-primary/10 disabled:opacity-30 shrink-0"
                      title="Agregar campo"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  </div>
                  {newFieldType === "select" ? (
                    <div className="flex flex-wrap items-center gap-1.5 pl-8">
                      {newFieldOptions.map((opt, oi) => (
                        <span
                          key={oi}
                          className="inline-flex items-center gap-1 rounded-full border bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {opt}
                          <button
                            type="button"
                            onClick={() =>
                              setNewFieldOptions(prev =>
                                prev.filter((_, j) => j !== oi)
                              )
                            }
                            className="text-primary/60 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="+ agregar categoría"
                        className="w-28 rounded-full border border-dashed bg-background px-2.5 py-1 text-xs outline-none transition focus:border-primary focus:w-40"
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) {
                              setNewFieldOptions(prev => [...prev, val]);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className={`mt-4 grid gap-4 ${blockDef.gridClass}`}>
                  {fields.map(f => (
                    <FieldRenderer
                      key={f.key}
                      field={f}
                      value={form[f.key] ?? ""}
                      error={fieldErrors[f.key]}
                      onChange={value => {
                        if (f.key === "partyKind") {
                          onPartyKindChange(value);
                        } else {
                          onChange(f.key, value);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: BlockField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const label = (
    <span className="font-medium">
      {field.label}
      {field.required ? <span className="text-red-500 ml-0.5">*</span> : null}
    </span>
  );

  if (field.type === "select") {
    const options = field.key === "partyKind"
      ? [
          { value: "persona", label: "Persona" },
          { value: "empresa", label: "Empresa" },
        ]
      : field.key === "canalOrigen"
        ? [
            { value: "whatsapp", label: "WhatsApp" },
            { value: "llamada", label: "Llamada" },
            { value: "facebook", label: "Facebook" },
            { value: "instagram", label: "Instagram" },
            { value: "web", label: "Web" },
            { value: "email", label: "Email" },
            { value: "otro", label: "Otro" },
          ]
        : field.key === "tipoEvento"
          ? [
              { value: "social", label: "Social" },
              { value: "corporativo", label: "Corporativo" },
              { value: "otro", label: "Otro" },
            ]
          : (field.options ?? []).map(o => ({ value: o, label: o }));

    return (
      <label className="grid gap-2 text-sm">
        {label}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          {field.key !== "partyKind" && (
            <option value="">— Seleccionar —</option>
          )}
          {options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </label>
    );
  }

  if (field.type === "datetime") {
    return (
      <label className="grid gap-2 text-sm">
        {label}
        <input
          type="datetime-local"
          value={timestampToDatetimeLocal(value)}
          onChange={e => onChange(datetimeLocalToTimestamp(e.target.value))}
          className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
        />
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </label>
    );
  }

  if (field.type === "date") {
    return (
      <label className="grid gap-2 text-sm">
        {label}
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
        />
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </label>
    );
  }

  return (
    <label className="grid gap-2 text-sm">
      {label}
      <input
        type={field.type === "email" ? "email" : "text"}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
        placeholder={
          field.key === "nombreCliente"
            ? "Nombre completo"
            : field.key === "telefono"
              ? "Número de contacto"
              : field.key === "correo"
                ? "Correo electrónico"
                : field.key === "nombreEmpresa"
                  ? "Nombre de la empresa"
                  : field.key === "ciudad"
                    ? "Ciudad de origen"
                    : ""
        }
      />
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}
    </label>
  );
}

function timestampToDatetimeLocal(ts: string | number | null | undefined): string {
  if (!ts) return "";
  const n = typeof ts === "string" ? Number(ts) : ts;
  if (isNaN(n) || n === 0) return "";
  const d = new Date(n);
  return d.toISOString().slice(0, 16);
}

function datetimeLocalToTimestamp(dt: string): string {
  if (!dt) return "";
  const d = new Date(dt);
  return String(d.getTime());
}

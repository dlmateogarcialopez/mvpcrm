import { useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { EditableText } from "./EditableText";

interface PricingLine {
  key: string;
  label: string;
  cantidadKey: string;
  precioKey: string;
  precioDefault: number;
  order: number;
  visible: boolean;
  isStandard?: boolean;
}

interface Section3FormFieldsProps {
  form: Record<string, any>;
  customValues: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onCustomChange: (key: string, value: any) => void;
  onLinesChanged: () => void;
  isSuperAdmin?: boolean;
}

export function Section3FormFields({
  form,
  customValues,
  onChange,
  onCustomChange,
  onLinesChanged,
  isSuperAdmin,
}: Section3FormFieldsProps) {
  const linesQuery = trpc.leads.getPricingFields.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const lines = (linesQuery.data?.lines ?? []) as PricingLine[];
  const visibleLines = lines.filter(l => l.visible);

  const [editing, setEditing] = useState(false);
  const [draftHidden, setDraftHidden] = useState<Set<string>>(new Set());
  const [draftCustom, setDraftCustom] = useState<
    Array<{ key: string; label: string; precioDefault: number; order: number }>
  >([]);
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState(0);

  const saveMutation = trpc.leads.savePricingFields.useMutation({
    onSuccess: () => {
      toast.success("Líneas de cotización guardadas");
      setEditing(false);
      linesQuery.refetch();
      onLinesChanged();
    },
    onError: e => toast.error(e.message),
  });

  function startEdit() {
    const hidden = new Set<string>();
    for (const l of lines) {
      if (l.isStandard && !l.visible) hidden.add(l.key);
    }
    setDraftHidden(hidden);
    setDraftCustom(
      lines
        .filter(l => !l.isStandard)
        .map(l => ({
          key: l.key.replace("cust_", ""),
          label: l.label,
          precioDefault: l.precioDefault,
          order: l.order,
        }))
    );
    setNewLabel("");
    setNewPrice(0);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function toggleHidden(key: string) {
    setDraftHidden(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function addCustomLine() {
    if (!newLabel.trim()) return;
    setDraftCustom(prev => [
      ...prev,
      { key: `cl_${Date.now()}`, label: newLabel.trim(), precioDefault: newPrice, order: prev.length },
    ]);
    setNewLabel("");
    setNewPrice(0);
  }

  function removeCustomLine(index: number) {
    setDraftCustom(prev => prev.filter((_, i) => i !== index));
  }

  function updateCustomLabel(index: number, label: string) {
    setDraftCustom(prev => prev.map((l, i) => (i === index ? { ...l, label } : l)));
  }

  function updateCustomPrice(index: number, precioDefault: number) {
    setDraftCustom(prev => prev.map((l, i) => (i === index ? { ...l, precioDefault } : l)));
  }

  function handleSave() {
    saveMutation.mutate({
      hiddenLines: [...draftHidden],
      customLines: draftCustom.map((cl, i) => ({
        key: cl.key,
        label: cl.label,
        precioDefault: cl.precioDefault,
        order: i,
      })),
    });
  }

  function formatNumber(n: any): string {
    return n ? Number(n).toLocaleString("es-CO") : "0";
  }

  function getQty(line: PricingLine): number {
    if (line.isStandard) return Number(form[line.cantidadKey] ?? 0);
    return Number(customValues[line.cantidadKey] ?? 0);
  }

  function getPrice(line: PricingLine): number {
    if (line.isStandard) return Number(form[line.precioKey] ?? line.precioDefault);
    return Number(customValues[line.precioKey] ?? line.precioDefault);
  }

  function setQty(line: PricingLine, val: number) {
    if (line.isStandard) onChange(line.cantidadKey, val);
    else onCustomChange(line.cantidadKey, val);
  }

  function setPrice(line: PricingLine, val: number) {
    if (line.isStandard) onChange(line.precioKey, val);
    else onCustomChange(line.precioKey, val);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          <EditableText storageKey="step3.title" defaultText="3. Cotización inicial" as="span" />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          <EditableText
            storageKey="step3.subtitle"
            defaultText="Define las líneas de producto o servicio, sus cantidades y precios unitarios. Los subtotales y el valor total se calculan automáticamente."
            as="span"
          />
        </p>
      </div>

      <div className="rounded-2xl border bg-background p-4">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Líneas de cotización
            </p>
          </div>
          {!editing && isSuperAdmin && (
            <button
              type="button"
              onClick={startEdit}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
              title="Gestionar líneas"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleSave}
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

        {editing ? (
          <div className="space-y-2">
            {lines
              .filter(l => l.isStandard)
              .map(l => {
                const isHidden = draftHidden.has(l.key);
                return (
                  <div
                    key={l.key}
                    className={`flex items-center gap-2 rounded-lg border p-2 ${isHidden ? "bg-muted/20 opacity-50" : "bg-muted/10"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleHidden(l.key)}
                      className={isHidden ? "text-muted-foreground hover:text-foreground" : "text-primary hover:text-primary/80"}
                      title={isHidden ? "Mostrar" : "Ocultar"}
                    >
                      {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <span className="flex-1 text-sm font-medium">{l.label}</span>
                    <span className="text-xs text-muted-foreground w-24 text-right">
                      ${l.precioDefault.toLocaleString("es-CO")}
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase w-14 text-center">
                      std
                    </span>
                  </div>
                );
              })}

            {draftCustom.map((cl, i) => (
              <div key={cl.key} className="flex items-center gap-2 rounded-lg border bg-muted/10 p-2">
                <span className="text-primary"><Eye className="h-3.5 w-3.5" /></span>
                <input
                  type="text"
                  value={cl.label}
                  onChange={e => updateCustomLabel(i, e.target.value)}
                  className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                />
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  value={cl.precioDefault}
                  onChange={e => updateCustomPrice(i, Number(e.target.value))}
                  className="w-24 rounded border bg-background px-2 py-1 text-sm text-right"
                  min={0}
                />
                <button
                  type="button"
                  onClick={() => removeCustomLine(i)}
                  className="rounded-full p-1 text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/5 p-2">
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Nueva línea..."
                className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground">$</span>
              <input
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(Number(e.target.value))}
                placeholder="Precio"
                className="w-24 rounded border bg-background px-2 py-1 text-sm text-right"
                min={0}
              />
              <button
                type="button"
                onClick={addCustomLine}
                disabled={!newLabel.trim()}
                className="rounded-full p-1 text-primary hover:bg-primary/10 disabled:opacity-30 shrink-0"
                title="Agregar línea"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : visibleLines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay líneas de cotización visibles. Usá el lápiz para configurar.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleLines.map(l => {
              const qty = getQty(l);
              const price = getPrice(l);
              const subtotal = qty * price;
              return (
                <div
                  key={l.key}
                  className="grid grid-cols-[1fr_8rem_10rem_8rem] gap-2 items-center rounded-lg p-2"
                >
                  <span className="text-sm font-medium">{l.label}</span>
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Cantidad</label>
                    <input
                      type="number"
                      value={qty || ""}
                      onChange={e => setQty(l, Number(e.target.value))}
                      className="w-full rounded border bg-background px-2 py-1 text-sm text-right"
                      min={0}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Precio unitario</label>
                    <input
                      type="number"
                      value={price || ""}
                      onChange={e => setPrice(l, Number(e.target.value))}
                      className="w-full rounded border bg-background px-2 py-1 text-sm text-right"
                      min={0}
                      placeholder={String(l.precioDefault)}
                    />
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] text-muted-foreground block">Subtotal</label>
                    <span className="text-sm font-semibold tabular-nums">
                      ${subtotal.toLocaleString("es-CO")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

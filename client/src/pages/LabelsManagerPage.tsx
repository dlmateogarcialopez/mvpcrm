import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Label {
  id: string;
  name: string;
  color: string;
  description: string;
}

const DEFAULT_LABELS: Label[] = [
  { id: "1", name: "VIP", color: "#fbbf24", description: "Clientes de alto valor" },
  { id: "2", name: "Seguimiento", color: "#60a5fa", description: "Requiere seguimiento" },
  { id: "3", name: "Descuento", color: "#34d399", description: "Aplicar descuento" },
  { id: "4", name: "Urgente", color: "#f87171", description: "Requiere atención inmediata" },
];

export function LabelsManagerPage() {
  const [labels, setLabels] = useState<Label[]>(DEFAULT_LABELS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const handleAddLabel = () => {
    const newLabel: Label = {
      id: Date.now().toString(),
      name: "Nueva Etiqueta",
      color: "#6b7280",
      description: "",
    };
    setLabels([...labels, newLabel]);
  };

  const handleDeleteLabel = (id: string) => {
    setLabels(labels.filter(l => l.id !== id));
  };

  const handleEditStart = (label: Label) => {
    setEditingId(label.id);
    setEditingName(label.name);
    setEditingColor(label.color);
    setEditingDescription(label.description);
  };

  const handleEditSave = () => {
    setLabels(
      labels.map(l =>
        l.id === editingId
          ? { ...l, name: editingName, color: editingColor, description: editingDescription }
          : l
      )
    );
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestor de Etiquetas</h1>
        <p className="text-muted-foreground">
          Crea y personaliza etiquetas para organizar y categorizar tus leads.
        </p>
      </div>

      {/* Botón de Agregar */}
      <Button onClick={handleAddLabel} className="gap-2">
        <Plus className="h-4 w-4" />
        Crear Nueva Etiqueta
      </Button>

      {/* Grid de Etiquetas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {labels.map(label => (
          <div
            key={label.id}
            className="rounded-2xl border bg-card p-4 shadow-sm transition hover:shadow-md"
          >
            {editingId === label.id ? (
              <div className="space-y-3">
                <Input
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  placeholder="Nombre de la etiqueta"
                />
                <Textarea
                  value={editingDescription}
                  onChange={e => setEditingDescription(e.target.value)}
                  placeholder="Descripción (opcional)"
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Color:</label>
                  <input
                    type="color"
                    value={editingColor}
                    onChange={e => setEditingColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEditSave} className="flex-1">
                    <Check className="h-4 w-4 mr-1" />
                    Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEditCancel} className="flex-1">
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <h3 className="font-semibold">{label.name}</h3>
                </div>
                {label.description && (
                  <p className="text-sm text-muted-foreground">{label.description}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditStart(label)}
                    className="flex-1"
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteLabel(label.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

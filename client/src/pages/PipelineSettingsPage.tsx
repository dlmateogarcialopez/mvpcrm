import { useState } from "react";
import { Plus, Trash2, Edit2, GripVertical, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: "1", name: "Nuevo", color: "#3b82f6", order: 1 },
  { id: "2", name: "Contactado", color: "#8b5cf6", order: 2 },
  { id: "3", name: "Propuesta", color: "#f59e0b", order: 3 },
  { id: "4", name: "Negociación", color: "#ef4444", order: 4 },
  { id: "5", name: "Ganado", color: "#10b981", order: 5 },
];

export function PipelineSettingsPage() {
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_STAGES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");

  const handleAddStage = () => {
    const newStage: PipelineStage = {
      id: Date.now().toString(),
      name: "Nueva Etapa",
      color: "#6b7280",
      order: Math.max(...stages.map(s => s.order), 0) + 1,
    };
    setStages([...stages, newStage]);
  };

  const handleDeleteStage = (id: string) => {
    setStages(stages.filter(s => s.id !== id));
  };

  const handleEditStart = (stage: PipelineStage) => {
    setEditingId(stage.id);
    setEditingName(stage.name);
    setEditingColor(stage.color);
  };

  const handleEditSave = () => {
    setStages(
      stages.map(s =>
        s.id === editingId ? { ...s, name: editingName, color: editingColor } : s
      )
    );
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const moveStage = (id: string, direction: "up" | "down") => {
    const index = stages.findIndex(s => s.id === id);
    if (direction === "up" && index > 0) {
      const newStages = [...stages];
      [newStages[index], newStages[index - 1]] = [newStages[index - 1], newStages[index]];
      setStages(newStages);
    } else if (direction === "down" && index < stages.length - 1) {
      const newStages = [...stages];
      [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
      setStages(newStages);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Personalizar Embudo de Ventas</h1>
        <p className="text-muted-foreground">
          Define las etapas del ciclo de ventas que mejor se adapten a tu proceso comercial.
        </p>
      </div>

      {/* Botón de Agregar */}
      <Button onClick={handleAddStage} className="gap-2">
        <Plus className="h-4 w-4" />
        Agregar Nueva Etapa
      </Button>

      {/* Lista de Etapas */}
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm"
          >
            {/* Icono de Arrastrar */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => moveStage(stage.id, "up")}
                disabled={index === 0}
                className="rounded p-1 transition hover:bg-muted disabled:opacity-50"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button
                onClick={() => moveStage(stage.id, "down")}
                disabled={index === stages.length - 1}
                className="rounded p-1 transition hover:bg-muted disabled:opacity-50"
              >
                <GripVertical className="h-4 w-4 rotate-180" />
              </button>
            </div>

            {/* Contenido */}
            {editingId === stage.id ? (
              <>
                {/* Modo Edición */}
                <div className="flex flex-1 items-center gap-3">
                  <Input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    placeholder="Nombre de la etapa"
                    className="flex-1"
                  />
                  <input
                    type="color"
                    value={editingColor}
                    onChange={e => setEditingColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded border"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={handleEditCancel}>
                  <X className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleEditSave}>
                  <Check className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {/* Modo Vista */}
                <div
                  className="h-8 w-8 shrink-0 rounded-full border-2"
                  style={{ backgroundColor: stage.color, borderColor: stage.color }}
                />
                <div className="flex-1">
                  <p className="font-medium">{stage.name}</p>
                  <p className="text-xs text-muted-foreground">{stage.color}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditStart(stage)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteStage(stage.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Vista Previa del Embudo */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="mb-4 font-semibold">Vista Previa del Embudo</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {stages.map(stage => (
            <div
              key={stage.id}
              className="flex shrink-0 flex-col items-center gap-2"
            >
              <div
                className="h-16 w-24 rounded-lg border-2 flex items-center justify-center text-center text-xs font-medium"
                style={{ borderColor: stage.color, backgroundColor: stage.color + "20" }}
              >
                {stage.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botón de Guardar */}
      <div className="flex gap-3">
        <Button className="flex-1">Guardar Cambios</Button>
        <Button variant="outline" className="flex-1">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

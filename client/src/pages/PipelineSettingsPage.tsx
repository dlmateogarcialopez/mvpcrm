import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Check,
  X,
  Power,
  PowerOff,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface PipelineStage {
  id: number;
  name: string;
  displayName: string;
  color: string;
  order: number;
  isActive: boolean | null;
}

const DEFAULT_COLOR = "#3b82f6";

export function PipelineSettingsPage() {
  const utils = trpc.useUtils();
  const stagesQuery = trpc.pipeline.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const leadCountsQuery = trpc.pipeline.leadCounts.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const stages: PipelineStage[] = (stagesQuery.data ?? []) as PipelineStage[];
  const leadCounts: Record<string, number> =
    (leadCountsQuery.data as Record<string, number>) ?? {};

  const createMutation = trpc.pipeline.create.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.leadCounts.invalidate();
      toast.success("Fase creada");
    },
    onError: e => toast.error(`Error al crear: ${e.message}`),
  });

  const updateMutation = trpc.pipeline.update.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.leadCounts.invalidate();
      toast.success("Fase actualizada");
    },
    onError: e => toast.error(`Error al actualizar: ${e.message}`),
  });

  const deleteMutation = trpc.pipeline.delete.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.leadCounts.invalidate();
      toast.success("Fase eliminada");
    },
    onError: e => toast.error(`Error al eliminar: ${e.message}`),
  });

  const reorderMutation = trpc.pipeline.reorder.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
    },
    onError: e => toast.error(`Error al reordenar: ${e.message}`),
  });

  const toggleMutation = trpc.pipeline.toggleActive.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.listActive.invalidate();
      toast.success("Estado de la fase actualizado");
    },
    onError: e => toast.error(`Error al cambiar estado: ${e.message}`),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState("");
  const [editingColor, setEditingColor] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createColor, setCreateColor] = useState(DEFAULT_COLOR);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Resetear forms al cerrar
  useEffect(() => {
    if (!showCreate) {
      setCreateName("");
      setCreateDisplayName("");
      setCreateColor(DEFAULT_COLOR);
    }
  }, [showCreate]);

  const handleEditStart = (stage: PipelineStage) => {
    setEditingId(stage.id);
    setEditingName(stage.name);
    setEditingDisplayName(stage.displayName);
    setEditingColor(stage.color);
  };

  const handleEditSave = () => {
    if (editingId === null) return;
    if (!editingName.trim() || !editingDisplayName.trim()) {
      toast.error("El nombre interno y el visible son obligatorios");
      return;
    }
    updateMutation.mutate({
      id: editingId,
      name: editingName.trim(),
      displayName: editingDisplayName.trim(),
      color: editingColor,
    });
    setEditingId(null);
  };

  const handleEditCancel = () => setEditingId(null);

  const handleDelete = (stage: PipelineStage) => {
    const count = leadCounts[stage.name] ?? 0;
    if (count > 0) {
      toast.error(
        `La fase "${stage.displayName}" tiene ${count} lead(s). Muévelos a otra fase antes de eliminarla.`
      );
      return;
    }
    if (!confirm(`¿Eliminar la fase "${stage.displayName}"?`)) return;
    deleteMutation.mutate({ id: stage.id });
  };

  const handleToggleActive = (stage: PipelineStage) => {
    toggleMutation.mutate({
      id: stage.id,
      isActive: !(stage.isActive ?? true),
    });
  };

  const handleCreate = () => {
    if (!createName.trim() || !createDisplayName.trim()) {
      toast.error("El nombre interno y el visible son obligatorios");
      return;
    }
    createMutation.mutate({
      name: createName.trim(),
      displayName: createDisplayName.trim(),
      color: createColor,
    });
    setShowCreate(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex(s => s.id === active.id);
    const newIndex = stages.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = arrayMove(stages, oldIndex, newIndex);
    reorderMutation.mutate({ orderedIds: newOrder.map(s => s.id) });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Personalizar Embudo de Ventas
        </h1>
        <p className="text-muted-foreground">
          Crea, edita, activa y reordena las fases del ciclo de ventas. Arrastra
          y suelta para definir el orden del embudo.
        </p>
      </div>

      {/* Botón de Agregar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setShowCreate(s => !s)}
          className="gap-2"
          variant={showCreate ? "outline" : "default"}
        >
          {showCreate ? (
            <>
              <X className="h-4 w-4" /> Cancelar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Nueva fase
            </>
          )}
        </Button>
        {stages.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {stages.length} fase(s) configurada(s) ·{" "}
            {stages.filter(s => s.isActive !== false).length} activa(s)
          </span>
        )}
      </div>

      {/* Form de creación */}
      {showCreate && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Crear nueva fase</h2>
          <p className="text-xs text-muted-foreground">
            El <strong>nombre interno</strong> se usa en el motor de
            automatizaciones y no debe cambiar después si tienes reglas que lo
            referencien. El <strong>nombre visible</strong> es el que ven los
            usuarios en el embudo.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre interno *
              </label>
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="ej. anotado"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre visible *
              </label>
              <Input
                value={createDisplayName}
                onChange={e => setCreateDisplayName(e.target.value)}
                placeholder="ej. Anotado"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={createColor}
                  onChange={e => setCreateColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded border"
                />
                <span className="text-xs text-muted-foreground">
                  {createColor}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" /> Guardar fase
          </Button>
        </div>
      )}

      {/* Lista drag & drop */}
      {stagesQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          Cargando fases...
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          Aún no hay fases configuradas. Crea la primera con el botón superior.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={stages.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {stages.map(stage => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  isEditing={editingId === stage.id}
                  editName={editingName}
                  editDisplayName={editingDisplayName}
                  editColor={editingColor}
                  onEditNameChange={setEditingName}
                  onEditDisplayNameChange={setEditingDisplayName}
                  onEditColorChange={setEditingColor}
                  onEditStart={() => handleEditStart(stage)}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                  onDelete={() => handleDelete(stage)}
                  onToggleActive={() => handleToggleActive(stage)}
                  leadCount={leadCounts[stage.name] ?? 0}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Vista Previa del Embudo */}
      {stages.length > 0 && (
        <div className="rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Vista previa del embudo</h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" /> Solo se muestran las fases activas
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {stages
              .filter(s => s.isActive !== false)
              .map(stage => (
                <div
                  key={stage.id}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="h-16 w-28 rounded-lg border-2 flex items-center justify-center text-center text-xs font-semibold"
                    style={{
                      borderColor: stage.color,
                      backgroundColor: stage.color + "20",
                      color: stage.color,
                    }}
                  >
                    {stage.displayName}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {leadCounts[stage.name] ?? 0} lead(s)
                  </span>
                </div>
              ))}
            {stages.filter(s => s.isActive !== false).length === 0 && (
              <span className="text-sm text-muted-foreground italic">
                No hay fases activas. Activa al menos una para visualizar el
                embudo.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SortableStageRowProps {
  stage: PipelineStage;
  isEditing: boolean;
  editName: string;
  editDisplayName: string;
  editColor: string;
  onEditNameChange: (v: string) => void;
  onEditDisplayNameChange: (v: string) => void;
  onEditColorChange: (v: string) => void;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  leadCount: number;
}

function SortableStageRow({
  stage,
  isEditing,
  editName,
  editDisplayName,
  editColor,
  onEditNameChange,
  onEditDisplayNameChange,
  onEditColorChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDelete,
  onToggleActive,
  leadCount,
}: SortableStageRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-2xl border p-4 transition ${
        stage.isActive === false ? "bg-muted/30 opacity-70" : "bg-card"
      } ${isDragging ? "shadow-lg ring-2 ring-primary" : "shadow-sm"}`}
    >
      {/* Handle de drag */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing rounded p-1 text-muted-foreground hover:bg-muted touch-none"
        {...attributes}
        {...listeners}
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Color + nombre */}
      {isEditing ? (
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="color"
            value={editColor}
            onChange={e => onEditColorChange(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded border"
          />
          <Input
            value={editName}
            onChange={e => onEditNameChange(e.target.value)}
            placeholder="Nombre interno"
            className="w-40"
          />
          <Input
            value={editDisplayName}
            onChange={e => onEditDisplayNameChange(e.target.value)}
            placeholder="Nombre visible"
            className="flex-1 min-w-[180px]"
          />
          <Button size="sm" variant="outline" onClick={onEditCancel}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={onEditSave}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div
            className="h-10 w-10 shrink-0 rounded-full border-2"
            style={{
              backgroundColor: stage.color,
              borderColor: stage.color,
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{stage.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">
              interno:{" "}
              <code className="rounded bg-muted px-1 py-0.5">{stage.name}</code>
              {" · "}
              {leadCount} lead(s) en esta fase
            </p>
          </div>

          <Button
            size="sm"
            variant={stage.isActive === false ? "default" : "outline"}
            onClick={onToggleActive}
            title={stage.isActive === false ? "Activar" : "Desactivar"}
          >
            {stage.isActive === false ? (
              <>
                <Power className="h-4 w-4 mr-1" /> Inactiva
              </>
            ) : (
              <>
                <PowerOff className="h-4 w-4 mr-1" /> Activa
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onEditStart}
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            title="Eliminar"
            disabled={leadCount > 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

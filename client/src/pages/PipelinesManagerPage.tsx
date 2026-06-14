import { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Kanban,
  Power,
  PowerOff,
  Settings2,
  ChevronRight,
  Copy,
  MoreVertical,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface Pipeline {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  order: number | null;
  isActive: boolean | null;
  activeStageCount: number;
  totalStageCount: number;
  leadCount: number;
}

export function PipelinesManagerPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const pipelinesQuery = trpc.pipelines.listWithStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const allPipelinesQuery = trpc.pipelines.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const pipelines = (pipelinesQuery.data ?? []) as Pipeline[];
  const allPipelines = (allPipelinesQuery.data ?? []) as Array<{
    id: number;
    name: string;
  }>;

  const createMutation = trpc.pipelines.create.useMutation({
    onSuccess: () => {
      utils.pipelines.list.invalidate();
      utils.pipelines.listWithStats.invalidate();
      utils.pipelines.listActive.invalidate();
      toast.success("Embudo creado");
    },
    onError: e => toast.error(`Error al crear: ${e.message}`),
  });

  const updateMutation = trpc.pipelines.update.useMutation({
    onSuccess: () => {
      utils.pipelines.list.invalidate();
      utils.pipelines.listWithStats.invalidate();
      utils.pipelines.listActive.invalidate();
      toast.success("Embudo actualizado");
    },
    onError: e => toast.error(`Error al actualizar: ${e.message}`),
  });

  const deleteMutation = trpc.pipelines.delete.useMutation({
    onSuccess: () => {
      utils.pipelines.list.invalidate();
      utils.pipelines.listWithStats.invalidate();
      utils.pipelines.listActive.invalidate();
      toast.success("Embudo eliminado");
    },
    onError: e => toast.error(`Error al eliminar: ${e.message}`),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createColor, setCreateColor] = useState("#3b82f6");
  const [createCopyFromId, setCreateCopyFromId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    color: "",
  });

  const handleCreate = () => {
    if (!createName.trim()) {
      toast.error("El nombre del embudo es obligatorio");
      return;
    }
    createMutation.mutate({
      name: createName.trim(),
      description: createDescription.trim() || null,
      color: createColor,
      copyFromPipelineId: createCopyFromId,
    });
    setShowCreate(false);
    setCreateName("");
    setCreateDescription("");
    setCreateColor("#3b82f6");
    setCreateCopyFromId(null);
  };

  const handleEditStart = (p: Pipeline) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      description: p.description ?? "",
      color: p.color ?? "#3b82f6",
    });
  };

  const handleEditSave = () => {
    if (editingId === null) return;
    if (!editForm.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    updateMutation.mutate({
      id: editingId,
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      color: editForm.color,
    });
    setEditingId(null);
  };

  const handleToggleActive = (p: Pipeline) => {
    updateMutation.mutate({ id: p.id, isActive: !(p.isActive ?? true) });
  };

  const handleDelete = (p: Pipeline) => {
    if (p.leadCount > 0) {
      toast.error(
        `El embudo "${p.name}" tiene ${p.leadCount} lead(s). Elimínalos o reasígnalos antes.`
      );
      return;
    }
    if (!confirm(`¿Eliminar el embudo "${p.name}" y todas sus fases?`)) return;
    deleteMutation.mutate({ id: p.id });
  };

  const handleOpen = (p: Pipeline) => {
    setLocation(`/embudo?pipeline=${p.id}`);
  };

  const handleConfigurePhases = (p: Pipeline) => {
    setLocation(`/embudos/${p.id}/configurar`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Embudos de Ventas</h1>
        <p className="text-muted-foreground">
          Crea y gestiona distintos embudos. Cada embudo tiene sus propias
          fases. Los mismos leads pueden estar en diferentes fases dentro de
          cada embudo.
        </p>
      </div>

      {/* Botón crear */}
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
            <Plus className="h-4 w-4" /> Nuevo embudo
          </>
        )}
      </Button>

      {/* Form de creación */}
      {showCreate && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Crear nuevo embudo</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre del embudo *
              </label>
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="ej. Ventas B2B"
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
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Descripción
              </label>
              <Input
                value={createDescription}
                onChange={e => setCreateDescription(e.target.value)}
                placeholder="Embudo para leads corporativos (opcional)"
              />
            </div>
            {allPipelines.length > 0 && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Copiar fases del embudo (opcional)
                </label>
                <select
                  value={createCopyFromId ?? ""}
                  onChange={e =>
                    setCreateCopyFromId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="rounded border bg-background px-3 py-2 w-full"
                >
                  <option value="">— Empezar sin fases —</option>
                  {allPipelines.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Las fases copiadas iniciarán como "Normal". Podrás cambiar su
                  tipo (Ganado / Perdido / Pausado) después.
                </p>
              </div>
            )}
          </div>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" /> Crear embudo
          </Button>
        </div>
      )}

      {/* Lista de tarjetas */}
      {pipelinesQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          Cargando embudos...
        </div>
      ) : pipelines.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          Aún no hay embudos configurados. Crea el primero con el botón
          superior.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map(p => (
            <PipelineCard
              key={p.id}
              pipeline={p}
              isEditing={editingId === p.id}
              editForm={editForm}
              onEditNameChange={v => setEditForm({ ...editForm, name: v })}
              onEditDescriptionChange={v =>
                setEditForm({ ...editForm, description: v })
              }
              onEditColorChange={v => setEditForm({ ...editForm, color: v })}
              onEditStart={() => handleEditStart(p)}
              onEditSave={handleEditSave}
              onEditCancel={() => setEditingId(null)}
              onDelete={() => handleDelete(p)}
              onToggleActive={() => handleToggleActive(p)}
              onOpen={() => handleOpen(p)}
              onConfigurePhases={() => handleConfigurePhases(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PipelineCardProps {
  pipeline: Pipeline;
  isEditing: boolean;
  editForm: { name: string; description: string; color: string };
  onEditNameChange: (v: string) => void;
  onEditDescriptionChange: (v: string) => void;
  onEditColorChange: (v: string) => void;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onOpen: () => void;
  onConfigurePhases: () => void;
}

function PipelineCard({
  pipeline,
  isEditing,
  editForm,
  onEditNameChange,
  onEditDescriptionChange,
  onEditColorChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDelete,
  onToggleActive,
  onOpen,
  onConfigurePhases,
}: PipelineCardProps) {
  const isActive = pipeline.isActive !== false;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`group rounded-2xl border-2 bg-card p-5 shadow-sm transition hover:shadow-md ${
        !isActive ? "opacity-60 grayscale" : ""
      }`}
      style={{ borderColor: pipeline.color ?? "#3b82f6" }}
    >
      {isEditing ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={editForm.color}
              onChange={e => onEditColorChange(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border"
            />
            <Input
              value={editForm.name}
              onChange={e => onEditNameChange(e.target.value)}
              placeholder="Nombre del embudo"
              autoFocus
            />
          </div>
          <Input
            value={editForm.description}
            onChange={e => onEditDescriptionChange(e.target.value)}
            placeholder="Descripción"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onEditSave} className="flex-1">
              <Check className="h-4 w-4 mr-1" /> Guardar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onEditCancel}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div
              className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: (pipeline.color ?? "#3b82f6") + "20",
              }}
            >
              <Kanban
                className="h-6 w-6"
                style={{ color: pipeline.color ?? "#3b82f6" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold text-lg truncate"
                style={{ color: pipeline.color ?? "#3b82f6" }}
              >
                {pipeline.name}
              </h3>
              {pipeline.description ? (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {pipeline.description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Sin descripción
                </p>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Acciones del embudo"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 z-50 mt-1 w-48 rounded-lg border bg-white shadow-lg overflow-hidden"
                  onMouseDown={e => e.preventDefault()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onEditStart();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Edit2 className="h-4 w-4" /> Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleActive();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                  >
                    {isActive ? (
                      <>
                        <PowerOff className="h-4 w-4" /> Desactivar
                      </>
                    ) : (
                      <>
                        <Power className="h-4 w-4" /> Activar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pipeline.leadCount > 0}
                    title={
                      pipeline.leadCount > 0
                        ? `El embudo tiene ${pipeline.leadCount} lead(s).`
                        : undefined
                    }
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-2xl font-bold">{pipeline.activeStageCount}</p>
              <p className="text-xs text-muted-foreground">fases activas</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-2xl font-bold">{pipeline.leadCount}</p>
              <p className="text-xs text-muted-foreground">leads</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={onOpen} className="w-full gap-2">
              Ver embudo <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={onConfigurePhases}
              variant="outline"
              className="w-full gap-2"
            >
              <Settings2 className="h-4 w-4" /> Configurar fases
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

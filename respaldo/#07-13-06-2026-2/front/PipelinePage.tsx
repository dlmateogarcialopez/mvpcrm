import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Filter,
  Plus,
  Settings2,
  GripVertical,
  MoreVertical,
  Pencil,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc, type Lead } from "../lib/trpc";
import { toast } from "sonner";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

interface PipelineStage {
  id: number;
  name: string;
  displayName: string;
  color: string;
  order: number;
  isActive: boolean | null;
}

/* ============== Tarjeta de lead (arrastrable entre columnas) ============== */

function DraggableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: lead.publicId,
      data: { type: "lead", lead },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const [, setLocation] = useLocation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setLocation(`/leads/${lead.publicId}`)}
      className={`group relative rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md cursor-grab active:cursor-grabbing ${
        isDragging ? "z-50 shadow-lg border-primary/50" : ""
      }`}
    >
      <div className="space-y-2 pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{lead.nombreCliente}</p>
            <p className="truncate text-xs text-muted-foreground">
              {lead.nombreEmpresa || "Sin empresa"}
            </p>
          </div>
          {lead.alertPending && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {lead.ciudad || "Sin ciudad"}
          </span>
          <span className="font-semibold">
            {formatCurrency(lead.valorTotal || 0)}
          </span>
        </div>
        {lead.agenteResponsable && (
          <p className="text-xs text-muted-foreground">
            👤 {lead.agenteResponsable}
          </p>
        )}
      </div>
    </div>
  );
}

/* ============== Tarjeta de fase (sortable horizontal + menú de acciones) ============== */

interface SortableStageColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  stats: { count: number; value: number };
  onAddClick: () => void;
  onRename: (id: number, displayName: string) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
  onDelete: (id: number, displayName: string) => void;
  isDraggingOverlay?: boolean;
}

function SortableStageColumn({
  stage,
  leads,
  stats,
  onAddClick,
  onRename,
  onToggleActive,
  onDelete,
  isDraggingOverlay = false,
}: SortableStageColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage.id,
    data: { type: "stage", stage },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${stage.id}`,
    data: { type: "drop-stage", stageId: stage.id, stageName: stage.name },
  });

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(stage.displayName);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = stage.isActive !== false;
  const leadsCount = stats.count;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    backgroundColor: stage.color + "10",
    borderColor: stage.color,
  };

  const handleSaveRename = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.error("El nombre visible no puede estar vacío");
      return;
    }
    if (trimmed !== stage.displayName) {
      onRename(stage.id, trimmed);
    }
    setEditingName(false);
  };

  const handleCancelRename = () => {
    setDraftName(stage.displayName);
    setEditingName(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col rounded-2xl border-2 p-4 transition-colors ${
        isOver ? "ring-2 ring-primary ring-offset-2" : ""
      } ${isDragging ? "shadow-2xl" : ""} ${
        isDraggingOverlay ? "shadow-2xl cursor-grabbing" : ""
      } ${!isActive ? "opacity-60 grayscale" : ""}`}
    >
      {/* Cabecera con handle de arrastre de fase + menú */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          {/* Handle de drag de la fase (separado del body para no chocar con drag de leads) */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing rounded p-1 text-muted-foreground hover:bg-black/5 touch-none"
            {...attributes}
            {...listeners}
            aria-label="Arrastrar fase"
            title="Arrastrar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {editingName ? (
            <div className="flex flex-1 items-center gap-1">
              <Input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSaveRename();
                  if (e.key === "Escape") handleCancelRename();
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveRename}
                className="h-7 px-2"
              >
                ✓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelRename}
                className="h-7 px-2"
              >
                ✕
              </Button>
            </div>
          ) : (
            <>
              <h3
                className="flex-1 font-semibold truncate"
                style={{ color: stage.color }}
              >
                {stage.displayName}
              </h3>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(o => !o)}
                  onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
                  className="rounded p-1 text-muted-foreground hover:bg-black/5"
                  aria-label="Acciones de la fase"
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
                        setDraftName(stage.displayName);
                        setEditingName(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" /> Renombrar
                    </button>
                    <button
                      type="button"
                      disabled={leadsCount > 0}
                      title={
                        leadsCount > 0
                          ? `Mueve los ${leadsCount} lead(s) antes de desactivar`
                          : undefined
                      }
                      onClick={() => {
                        onToggleActive(stage.id, isActive);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
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
                      disabled={leadsCount > 0}
                      title={
                        leadsCount > 0
                          ? `La fase tiene ${leadsCount} lead(s). Muévelos primero.`
                          : undefined
                      }
                      onClick={() => {
                        onDelete(stage.id, stage.displayName);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{leadsCount} oportunidades</p>
          <p className="font-medium text-foreground">
            {formatCurrency(stats.value)}
          </p>
        </div>
      </div>

      {/* Lista de leads (droppable) */}
      <div
        ref={setDropRef}
        className={`flex-1 space-y-2 min-h-[100px] rounded-xl p-1 transition-colors ${
          isOver ? "bg-white/40" : ""
        }`}
      >
        {leads.map(lead => (
          <DraggableLeadCard key={lead.publicId} lead={lead} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground pointer-events-none">
            Sin oportunidades
          </div>
        )}
      </div>

      {/* Botón agregar */}
      <button
        onClick={onAddClick}
        className="mt-4 w-full rounded-xl border-2 border-dashed p-2 text-sm font-medium text-muted-foreground transition hover:bg-black/5"
      >
        <Plus className="mx-auto h-4 w-4" />
      </button>
    </div>
  );
}

/* ============== Página principal ============== */

export function PipelinePage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const stagesQuery = trpc.pipeline.listActive.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const leadCountsQuery = trpc.pipeline.leadCounts.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateStatusMutation = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.pipeline.leadCounts.invalidate();
      toast.success("Estado actualizado correctamente");
    },
    onError: error =>
      toast.error(`Error al actualizar estado: ${error.message}`),
  });

  const updateMutation = trpc.pipeline.update.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.listActive.invalidate();
      toast.success("Fase renombrada");
    },
    onError: e => toast.error(`Error al renombrar: ${e.message}`),
  });

  const toggleMutation = trpc.pipeline.toggleActive.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.listActive.invalidate();
      toast.success("Estado de la fase actualizado");
    },
    onError: e => toast.error(`Error al cambiar estado: ${e.message}`),
  });

  const deleteMutation = trpc.pipeline.delete.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.listActive.invalidate();
      utils.pipeline.leadCounts.invalidate();
      toast.success("Fase eliminada");
    },
    onError: e => toast.error(`Error al eliminar: ${e.message}`),
  });

  const reorderMutation = trpc.pipeline.reorder.useMutation({
    onSuccess: () => {
      utils.pipeline.list.invalidate();
      utils.pipeline.listActive.invalidate();
    },
    onError: e => toast.error(`Error al reordenar: ${e.message}`),
  });

  const leadsQuery = trpc.leads.list.useQuery(
    {
      query: "",
      estadoLead: "todos",
      prioridad: "todas",
      canalOrigen: "todos",
      tipoEvento: "todos",
      ciudad: "",
      agenteUserId: "todos",
      soloAlertas: false,
      assignedToMe: false,
      sortBy: "updatedAt",
      sortOrder: "desc",
    },
    { refetchOnWindowFocus: false }
  );

  const stages = (stagesQuery.data ?? []) as PipelineStage[];
  const leadCounts: Record<string, number> =
    (leadCountsQuery.data as Record<string, number>) ?? {};
  const leads = (leadsQuery.data ?? []) as Lead[];

  /* ----- Estado de drag ----- */
  const [activeStageId, setActiveStageId] = useState<number | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  /* ----- Datos derivados ----- */
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    for (const s of stages) grouped[s.name] = [];
    for (const l of leads) {
      const key = (l.estadoLead as string) || "nuevo";
      if (grouped[key]) grouped[key].push(l);
      else if (grouped["nuevo"]) grouped["nuevo"].push(l);
    }
    return grouped;
  }, [leads, stages]);

  const stageStats = useMemo(() => {
    const stats: Record<number, { count: number; value: number }> = {};
    for (const s of stages) {
      const arr = leadsByStage[s.name] || [];
      stats[s.id] = {
        count: arr.length,
        value: arr.reduce((sum, l) => sum + (l.valorTotal || 0), 0),
      };
    }
    return stats;
  }, [leadsByStage, stages]);

  const totalValue = useMemo(
    () => leads.reduce((sum, l) => sum + (l.valorTotal || 0), 0),
    [leads]
  );

  /* ----- Handlers ----- */
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as
      | { type?: "stage" | "lead" }
      | undefined;
    if (data?.type === "stage") {
      setActiveStageId(Number(event.active.id));
    } else {
      setActiveLeadId(String(event.active.id));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeData = active.data.current as
      | { type?: "stage" | "lead" }
      | undefined;
    const overData = over?.data.current as
      | { type?: "drop-stage"; stageName?: string }
      | undefined;

    setActiveStageId(null);
    setActiveLeadId(null);

    if (!over) return;

    // Drag de fase
    if (activeData?.type === "stage") {
      const oldIndex = stages.findIndex(s => s.id === active.id);
      const newIndex = stages.findIndex(s => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const newOrder = arrayMove(stages, oldIndex, newIndex);
      reorderMutation.mutate({ orderedIds: newOrder.map(s => s.id) });
      return;
    }

    // Drag de lead
    if (activeData?.type === "lead" || !activeData) {
      const leadId = String(active.id);
      const newStatus = overData?.stageName ?? (over.id as string);
      const lead = leads.find(l => l.publicId === leadId);
      if (lead && (lead.estadoLead as string) !== newStatus) {
        updateStatusMutation.mutate({
          publicId: leadId,
          estadoLead: newStatus as any,
        });
      }
    }
  };

  const handleRename = (id: number, displayName: string) => {
    updateMutation.mutate({ id, displayName });
  };
  const handleToggleActive = (id: number, isActive: boolean) => {
    toggleMutation.mutate({ id, isActive });
  };
  const handleDelete = (id: number, displayName: string) => {
    if (!confirm(`¿Eliminar la fase "${displayName}"?`)) return;
    deleteMutation.mutate({ id });
  };

  /* ----- Renderizado ----- */
  const activeStage = activeStageId
    ? (stages.find(s => s.id === activeStageId) ?? null)
    : null;
  const activeLead = activeLeadId
    ? (leads.find(l => l.publicId === activeLeadId) ?? null)
    : null;

  if (stagesQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <p className="text-sm text-muted-foreground">Cargando embudo...</p>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Embudo Comercial
          </h1>
          <p className="text-muted-foreground">
            No hay fases configuradas. Ve a Personalizar Embudo para crear las
            primeras.
          </p>
        </div>
        <Button
          onClick={() => setLocation("/configuracion/embudo")}
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" /> Configurar fases
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado con botón Personalizar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Embudo Comercial
          </h1>
          <p className="text-muted-foreground">
            Visualiza el progreso de tus oportunidades por etapa de venta. Cada
            columna representa un estado del ciclo comercial.
          </p>
        </div>
        <Button
          onClick={() => setLocation("/configuracion/embudo")}
          variant="outline"
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" /> Personalizar Embudo
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Total de Oportunidades
          </p>
          <p className="mt-2 text-2xl font-bold">{leads.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Valor Total en Embudo
          </p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Promedio por Oportunidad
          </p>
          <p className="mt-2 text-2xl font-bold">
            {leads.length > 0
              ? formatCurrency(totalValue / leads.length)
              : "$0"}
          </p>
        </div>
      </div>

      {/* Embudo drag & drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={stages.map(s => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="overflow-x-auto pb-4">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${stages.length}, minmax(300px, 1fr))`,
              }}
            >
              {stages.map(stage => (
                <SortableStageColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsByStage[stage.name] || []}
                  stats={stageStats[stage.id]}
                  onAddClick={() =>
                    setLocation(`/leads?new=true&stage=${stage.name}`)
                  }
                  onRename={handleRename}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        </SortableContext>

        {/* Overlay de arrastre (cualquier tipo) */}
        <DragOverlay>
          {activeStage ? (
            <div
              className="rounded-2xl border-2 p-4 shadow-2xl cursor-grabbing rotate-1"
              style={{
                backgroundColor: activeStage.color + "20",
                borderColor: activeStage.color,
                width: 300,
              }}
            >
              <h3
                className="font-semibold"
                style={{ color: activeStage.color }}
              >
                {activeStage.displayName}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Moviendo fase...
              </p>
            </div>
          ) : activeLead ? (
            <div className="w-[300px] rotate-3 opacity-80 cursor-grabbing">
              <div className="rounded-xl border bg-white p-3 shadow-xl border-primary/50">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">
                        {activeLead.nombreCliente}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeLead.nombreEmpresa || "Sin empresa"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      {formatCurrency(activeLead.valorTotal || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        💡 <strong>Consejo:</strong> Arrastra el ícono{" "}
        <GripVertical className="inline h-3 w-3" /> de la cabecera de una fase
        para reordenar. Arrastra las tarjetas de leads entre columnas para
        cambiar su estado. Usa el menú{" "}
        <MoreVertical className="inline h-3 w-3" /> de cada fase para renombrar,
        activar/desactivar o eliminar.
      </div>
    </div>
  );
}

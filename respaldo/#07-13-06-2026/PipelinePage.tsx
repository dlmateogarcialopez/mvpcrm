import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Filter, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { trpc, type Lead } from "../lib/trpc";
import { leadStatusLabels, normalizeLeadStatus } from "../../../shared/leads";
import { 
  DndContext, 
  DragEndEvent, 
  useDraggable, 
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

const PIPELINE_STAGES = [
  { id: "nuevo", label: "Nuevo", color: "bg-blue-50 border-blue-200" },
  { id: "contactado", label: "Contactado", color: "bg-purple-50 border-purple-200" },
  { id: "calificado", label: "Calificado", color: "bg-indigo-50 border-indigo-200" },
  { id: "propuesta", label: "Propuesta Enviada", color: "bg-yellow-50 border-yellow-200" },
  { id: "negociacion", label: "Negociación", color: "bg-orange-50 border-orange-200" },
  { id: "ganado", label: "Ganado", color: "bg-green-50 border-green-200" },
  { id: "perdido", label: "Perdido", color: "bg-red-50 border-red-200" },
  { id: "pausado", label: "Pausado", color: "bg-gray-50 border-gray-200" },
];

// Componente para la Tarjeta Arrastrable
function DraggableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.publicId,
    data: lead,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const [_, setLocation] = useLocation();

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
          <span className="text-muted-foreground">{lead.ciudad || "Sin ciudad"}</span>
          <span className="font-semibold">{formatCurrency(lead.valorTotal || 0)}</span>
        </div>
        {lead.agenteResponsable && (
          <p className="text-xs text-muted-foreground">👤 {lead.agenteResponsable}</p>
        )}
      </div>
    </div>
  );
}

// Componente para la Columna Receptora
function DroppableStage({ 
  stage, 
  children, 
  stats, 
  expandedStage, 
  setExpandedStage,
  onAddClick 
}: { 
  stage: typeof PIPELINE_STAGES[0];
  children: React.ReactNode;
  stats: { count: number; value: number };
  expandedStage: string | null;
  setExpandedStage: (id: string | null) => void;
  onAddClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`flex flex-col rounded-2xl border-2 p-4 transition-colors ${stage.color} ${
        isOver ? "ring-2 ring-primary ring-offset-2 scale-[1.02]" : ""
      }`}
    >
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{stage.label}</h3>
          <button
            onClick={onAddClick}
            className="rounded p-1 transition hover:bg-black/5"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expandedStage === stage.id ? "rotate-180" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedStage(expandedStage === stage.id ? null : stage.id);
              }}
            />
          </button>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{stats.count} oportunidades</p>
          <p className="font-medium text-foreground">{formatCurrency(stats.value)}</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 min-h-[100px]">
        {children}
      </div>

      <button 
        onClick={onAddClick}
        className="mt-4 w-full rounded-xl border-2 border-dashed p-2 text-sm font-medium text-muted-foreground transition hover:bg-black/5"
      >
        <Plus className="mx-auto h-4 w-4" />
      </button>
    </div>
  );
}

export function PipelinePage() {
  const [_, setLocation] = useLocation();
  const utils = trpc.useUtils();
  
  const leadsQuery = trpc.leads.list.useQuery({
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
  }, {
    refetchOnWindowFocus: false,
  });

  const updateStatusMutation = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      toast.success("Estado actualizado correctamente");
    },
    onError: (error) => {
      toast.error(`Error al actualizar estado: ${error.message}`);
    }
  });

  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const leads = leadsQuery.data ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const pipelineData = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    PIPELINE_STAGES.forEach(stage => {
      grouped[stage.id] = [];
    });

    leads.forEach(lead => {
      const status = normalizeLeadStatus(lead.estadoLead as any || "nuevo");
      if (grouped[status]) {
        grouped[status].push(lead);
      } else {
        grouped["nuevo"].push(lead);
      }
    });

    return grouped;
  }, [leads]);

  const totalValue = useMemo(() => {
    return leads.reduce((sum, lead) => sum + (lead.valorTotal || 0), 0);
  }, [leads]);

  const stageStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach(stage => {
      const stageLeads = pipelineData[stage.id] || [];
      stats[stage.id] = {
        count: stageLeads.length,
        value: stageLeads.reduce((sum, lead) => sum + (lead.valorTotal || 0), 0),
      };
    });
    return stats;
  }, [pipelineData]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as any;
    const lead = leads.find(l => l.publicId === leadId);

    if (lead && normalizeLeadStatus(lead.estadoLead as any) !== newStatus) {
      updateStatusMutation.mutate({
        publicId: leadId,
        estadoLead: newStatus,
      });
    }
  };

  const activeLead = activeId ? leads.find(l => l.publicId === activeId) : null;

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Embudo Comercial</h1>
        <p className="text-muted-foreground">
          Visualiza el progreso de tus oportunidades por etapa de venta. Cada columna representa un estado del ciclo comercial.
        </p>
      </div>

      {/* Resumen General */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total de Oportunidades</p>
          <p className="mt-2 text-2xl font-bold">{leads.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Valor Total en Embudo</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Promedio por Oportunidad</p>
          <p className="mt-2 text-2xl font-bold">
            {leads.length > 0 ? formatCurrency(totalValue / leads.length) : "$0"}
          </p>
        </div>
      </div>

      {/* Vista de Embudo */}
      <DndContext 
        sensors={sensors} 
        onDragStart={({ active }) => setActiveId(active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div 
            className="grid gap-4" 
            style={{ gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(300px, 1fr))` }}
          >
            {PIPELINE_STAGES.map(stage => (
              <DroppableStage
                key={stage.id}
                stage={stage}
                stats={stageStats[stage.id]}
                expandedStage={expandedStage}
                setExpandedStage={setExpandedStage}
                onAddClick={() => setLocation(`/leads?new=true&stage=${stage.id}`)}
              >
                {pipelineData[stage.id].map(lead => (
                  <DraggableLeadCard key={lead.publicId} lead={lead} />
                ))}
                {pipelineData[stage.id].length === 0 && !updateStatusMutation.isPending && (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground pointer-events-none">
                    Sin oportunidades
                  </div>
                )}
              </DroppableStage>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="w-[300px] rotate-3 opacity-80 cursor-grabbing">
              <div className="rounded-xl border bg-white p-3 shadow-xl border-primary/50">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{activeLead.nombreCliente}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeLead.nombreEmpresa || "Sin empresa"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{formatCurrency(activeLead.valorTotal || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Nota de Información */}
      <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        💡 <strong>Consejo:</strong> Arrastra las oportunidades entre columnas para cambiar su estado. Los cambios se guardan automáticamente.
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Layers, Plus, X, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface Assignment {
  pipelineId: number;
  pipelineName: string;
  pipelineColor: string | null;
  stageId: number;
  stageName: string;
  stageDisplayName: string;
  stageColor: string | null;
  stageKind: string;
  movedAt: Date;
}

interface LeadPipelineAssignmentsPanelProps {
  publicId: string;
}

export function LeadPipelineAssignmentsPanel({
  publicId,
}: LeadPipelineAssignmentsPanelProps) {
  const utils = trpc.useUtils();

  const assignmentsQuery = trpc.leads.leadPipelineAssignments.useQuery(
    { publicId },
    { refetchOnWindowFocus: false }
  );
  const pipelinesQuery = trpc.pipelines.listActive.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const assignments = (assignmentsQuery.data ?? []) as Assignment[];
  const allPipelines = (pipelinesQuery.data ?? []) as Array<{
    id: number;
    name: string;
    color: string | null;
  }>;

  // Pipelines donde el lead aún NO está asignado
  const availablePipelines = useMemo(() => {
    const assignedIds = new Set(assignments.map(a => a.pipelineId));
    return allPipelines.filter(p => !assignedIds.has(p.id));
  }, [assignments, allPipelines]);

  const [showAdd, setShowAdd] = useState(false);
  const [newPipelineId, setNewPipelineId] = useState<number | null>(null);
  const [newStageId, setNewStageId] = useState<number | null>(null);

  // Stages del pipeline destino (solo activas)
  const newStagesQuery = trpc.pipeline.listActive.useQuery(
    newPipelineId ? { pipelineId: newPipelineId } : undefined,
    { refetchOnWindowFocus: false, enabled: !!newPipelineId }
  );
  const newStages = (newStagesQuery.data ?? []) as Array<{
    id: number;
    name: string;
    displayName: string;
    color: string | null;
    kind: string;
  }>;

  // Cuando cambia el pipeline destino, resetear stage
  useMemo(() => {
    setNewStageId(null);
  }, [newPipelineId]);

  const addMutation = trpc.leads.addToPipeline.useMutation({
    onSuccess: () => {
      utils.leads.leadPipelineAssignments.invalidate({ publicId });
      toast.success("Lead añadido al embudo");
      setShowAdd(false);
      setNewPipelineId(null);
      setNewStageId(null);
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const changeStageMutation = trpc.leads.addToPipeline.useMutation({
    onSuccess: () => {
      utils.leads.leadPipelineAssignments.invalidate({ publicId });
      toast.success("Fase actualizada");
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const removeMutation = trpc.leads.removeFromPipeline.useMutation({
    onSuccess: () => {
      utils.leads.leadPipelineAssignments.invalidate({ publicId });
      toast.success("Lead quitado del embudo");
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const handleRemove = (a: Assignment) => {
    if (!confirm(`¿Quitar al lead de "${a.pipelineName}"?`)) return;
    removeMutation.mutate({ publicId, pipelineId: a.pipelineId });
  };

  const handleAdd = () => {
    if (!newPipelineId || !newStageId) {
      toast.error("Selecciona embudo y fase");
      return;
    }
    addMutation.mutate({
      publicId,
      pipelineId: newPipelineId,
      stageId: newStageId,
    });
  };

  const handleChangeStage = (a: Assignment, stageId: number) => {
    changeStageMutation.mutate({
      publicId,
      pipelineId: a.pipelineId,
      stageId,
    });
  };

  // Stages del pipeline de la asignación (para el selector de cambio de fase)
  const AssignmentStagesSelect = ({
    pipelineId,
    currentStageId,
    onChange,
  }: {
    pipelineId: number;
    currentStageId: number;
    onChange: (stageId: number) => void;
  }) => {
    const stagesQuery = trpc.pipeline.listActive.useQuery(
      { pipelineId },
      { refetchOnWindowFocus: false }
    );
    const stages = (stagesQuery.data ?? []) as Array<{
      id: number;
      name: string;
      displayName: string;
      color: string | null;
    }>;

    return (
      <select
        value={currentStageId}
        onChange={e => onChange(Number(e.target.value))}
        className="rounded border bg-background px-2 py-1 text-sm flex-1"
        disabled={stagesQuery.isLoading || changeStageMutation.isPending}
      >
        {stages.map(s => (
          <option key={s.id} value={s.id}>
            {s.displayName}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Embudos donde aparece este lead
        </h3>
        {availablePipelines.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(s => !s)}
            className="gap-1"
          >
            {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showAdd ? "Cancelar" : "Añadir a otro embudo"}
          </Button>
        )}
      </div>

      {/* Modal de añadir embudo */}
      {showAdd && (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
          <h4 className="text-sm font-medium">Añadir a otro embudo</h4>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Embudo destino
              </label>
              <select
                value={newPipelineId ?? ""}
                onChange={e => setNewPipelineId(Number(e.target.value))}
                className="rounded border bg-background px-3 py-2 w-full"
              >
                <option value="">— Selecciona un embudo —</option>
                {availablePipelines.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Fase inicial
              </label>
              <select
                value={newStageId ?? ""}
                onChange={e => setNewStageId(Number(e.target.value))}
                className="rounded border bg-background px-3 py-2 w-full"
                disabled={!newPipelineId || newStagesQuery.isLoading}
              >
                <option value="">— Selecciona una fase —</option>
                {newStages.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newPipelineId || !newStageId || addMutation.isPending}
            >
              <Plus className="h-3 w-3 mr-1" /> Añadir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAdd(false);
                setNewPipelineId(null);
                setNewStageId(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de asignaciones */}
      {assignmentsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando...</div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Este lead no está asignado a ningún embudo todavía.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div
              key={a.pipelineId}
              className="flex items-center gap-2 rounded-xl border bg-background p-3"
            >
              <div
                className="h-10 w-1 rounded-full shrink-0"
                style={{ backgroundColor: a.pipelineColor ?? "#3b82f6" }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.pipelineName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Fase actual:{" "}
                  <span style={{ color: a.stageColor ?? "inherit" }}>
                    {a.stageDisplayName}
                  </span>
                  {a.stageKind === "won" && " ✅"}
                  {a.stageKind === "lost" && " ❌"}
                  {a.stageKind === "paused" && " ⏸️"}
                </p>
              </div>
              <AssignmentStagesSelect
                pipelineId={a.pipelineId}
                currentStageId={a.stageId}
                onChange={newStageId => handleChangeStage(a, newStageId)}
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleRemove(a)}
                title="Quitar del embudo"
                disabled={removeMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

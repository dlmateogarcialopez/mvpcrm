import { useState, useMemo } from "react";
import {
  BarChart3,
  Clock,
  Filter,
  Layers,
  Save,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface Pipeline {
  id: number;
  name: string;
  color: string | null;
}

interface PipelineStage {
  id: number;
  name: string;
  displayName: string;
  color: string | null;
  kind: "open" | "won" | "lost" | "paused";
}

const METRIC_TYPES = [
  {
    value: "funnel",
    label: "Funnel de embudo",
    description:
      "De cada 100 leads que entraron, cuántos llegaron a cada fase.",
    icon: Layers,
  },
  {
    value: "stage_transition",
    label: "Transición entre fases",
    description: "De los leads en una fase A, cuántos pasaron a una fase B.",
    icon: TrendingUp,
  },
  {
    value: "by_segment",
    label: "Por segmento",
    description: "Conversión agrupada por canal, tipo de evento o agente.",
    icon: Filter,
  },
  {
    value: "avg_time",
    label: "Tiempo promedio en fase",
    description:
      "Cuántos días tarda en promedio pasar de una fase a la siguiente.",
    icon: Clock,
  },
  {
    value: "velocity",
    label: "Velocidad del pipeline",
    description: "Tiempo total desde entrada hasta cierre y su distribución.",
    icon: Zap,
  },
  {
    value: "dropoff",
    label: "Drop-off por fase",
    description: "Cuántos leads se cayeron sin avanzar a la siguiente fase.",
    icon: TrendingDown,
  },
];

const SEGMENT_FIELDS = [
  { value: "canalOrigen", label: "Canal de origen" },
  { value: "tipoEvento", label: "Tipo de evento" },
  { value: "agenteResponsable", label: "Agente responsable" },
  { value: "ciudad", label: "Ciudad" },
];

const PERIODS = [
  { value: "month", label: "Mes actual" },
  { value: "last_month", label: "Mes pasado" },
  { value: "quarter", label: "Este trimestre" },
  { value: "year", label: "Este año" },
  { value: "last30", label: "Últimos 30 días" },
  { value: "last90", label: "Últimos 90 días" },
];

function getPeriodDates(period: string): {
  startDate?: string;
  endDate?: string;
} {
  const now = new Date();
  switch (period) {
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString() };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { startDate: start.toISOString() };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start.toISOString() };
    }
    case "last30":
      return {
        startDate: new Date(now.getTime() - 30 * 86400000).toISOString(),
      };
    case "last90":
      return {
        startDate: new Date(now.getTime() - 90 * 86400000).toISOString(),
      };
    default:
      return {};
  }
}

/* ============================================================ */

export function PipelineMetricsPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const pipelinesQuery = trpc.pipelines.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const pipelines = (pipelinesQuery.data ?? []) as Pipeline[];

  const savedViewsQuery = trpc.pipelines.savedViews.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const saveViewMutation = trpc.pipelines.savedViews.create.useMutation({
    onSuccess: () => {
      utils.pipelines.savedViews.list.invalidate();
      toast.success("Vista guardada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteViewMutation = trpc.pipelines.savedViews.delete.useMutation({
    onSuccess: () => {
      utils.pipelines.savedViews.list.invalidate();
      toast.success("Vista eliminada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(
    null
  );
  const [selectedMetric, setSelectedMetric] = useState("funnel");
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [fromStageId, setFromStageId] = useState<number | null>(null);
  const [toStageId, setToStageId] = useState<number | null>(null);
  const [segmentField, setSegmentField] = useState("canalOrigen");

  const { startDate, endDate } = useMemo(
    () => getPeriodDates(selectedPeriod),
    [selectedPeriod]
  );

  const stagesQuery = trpc.pipeline.list.useQuery(
    selectedPipelineId ? { pipelineId: selectedPipelineId } : undefined,
    { refetchOnWindowFocus: false, enabled: !!selectedPipelineId }
  );
  const stages = (stagesQuery.data ?? []) as PipelineStage[];

  const params: any = {};
  if (selectedMetric === "stage_transition") {
    if (fromStageId) params.fromStageId = fromStageId;
    if (toStageId) params.toStageId = toStageId;
  }
  if (selectedMetric === "by_segment") {
    params.segmentField = segmentField;
  }

  const metricQuery = trpc.pipelines.metric.useQuery(
    selectedPipelineId
      ? {
          pipelineId: selectedPipelineId,
          metricType: selectedMetric as any,
          params,
          startDate,
          endDate,
        }
      : (undefined as any),
    { refetchOnWindowFocus: false, enabled: !!selectedPipelineId }
  );

  const result = metricQuery.data ?? null;

  const activePipeline = pipelines.find(p => p.id === selectedPipelineId);

  const handleSave = () => {
    if (!selectedPipelineId) return;
    const name = prompt("Nombre para guardar esta vista:");
    if (!name) return;
    saveViewMutation.mutate({
      name,
      config: {
        pipelineId: selectedPipelineId,
        metricType: selectedMetric,
        params,
        period: selectedPeriod,
      },
    });
  };

  const handleLoadView = (view: any) => {
    const cfg =
      typeof view.config === "string" ? JSON.parse(view.config) : view.config;
    setSelectedPipelineId(cfg.pipelineId);
    setSelectedMetric(cfg.metricType);
    setSelectedPeriod(cfg.period ?? "month");
    if (cfg.params?.fromStageId) setFromStageId(cfg.params.fromStageId);
    if (cfg.params?.toStageId) setToStageId(cfg.params.toStageId);
    if (cfg.params?.segmentField) setSegmentField(cfg.params.segmentField);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7" /> Métricas de Conversión
        </h1>
        <p className="text-muted-foreground">
          Define y visualiza métricas de conversión personalizadas.
        </p>
      </div>

      {/* Builder */}
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <h2 className="font-semibold">¿Qué quieres medir?</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Tipo de métrica
            </label>
            <select
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value)}
              className="rounded border bg-background px-3 py-2 w-full"
            >
              {METRIC_TYPES.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Embudo
            </label>
            <select
              value={selectedPipelineId ?? ""}
              onChange={e => setSelectedPipelineId(Number(e.target.value))}
              className="rounded border bg-background px-3 py-2 w-full"
            >
              <option value="">— Selecciona un embudo —</option>
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Período
            </label>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="rounded border bg-background px-3 py-2 w-full"
            >
              {PERIODS.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {selectedMetric === "stage_transition" ? (
            <div className="space-y-1 md:col-span-1 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Fase origen
                </label>
                <select
                  value={fromStageId ?? ""}
                  onChange={e => setFromStageId(Number(e.target.value))}
                  className="rounded border bg-background px-3 py-2 w-full"
                >
                  <option value="">— Fase —</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Fase destino
                </label>
                <select
                  value={toStageId ?? ""}
                  onChange={e => setToStageId(Number(e.target.value))}
                  className="rounded border bg-background px-3 py-2 w-full"
                >
                  <option value="">— Fase —</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : selectedMetric === "by_segment" ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Segmentar por
              </label>
              <select
                value={segmentField}
                onChange={e => setSegmentField(e.target.value)}
                className="rounded border bg-background px-3 py-2 w-full"
              >
                {SEGMENT_FIELDS.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            variant="outline"
            className="gap-2"
            disabled={!selectedPipelineId}
          >
            <Save className="h-4 w-4" /> Guardar vista
          </Button>
        </div>
      </div>

      {/* Resultados */}
      {metricQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          Calculando métrica...
        </div>
      ) : !result ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          Selecciona un embudo para ver la métrica.
        </div>
      ) : (
        <MetricResultDisplay
          metricType={selectedMetric}
          result={result}
          pipelineColor={activePipeline?.color ?? "#3b82f6"}
        />
      )}

      {/* Vistas guardadas */}
      {savedViewsQuery.data && (savedViewsQuery.data as any[]).length > 0 && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Star className="h-4 w-4" /> Tus vistas guardadas
          </h2>
          <div className="flex flex-wrap gap-2">
            {(savedViewsQuery.data as any[]).map((v: any) => {
              const cfg =
                typeof v.config === "string" ? JSON.parse(v.config) : v.config;
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2"
                >
                  <button
                    onClick={() => handleLoadView(v)}
                    className="text-sm font-medium hover:underline"
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() => deleteViewMutation.mutate(v.id)}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */

function MetricResultDisplay({
  metricType,
  result,
  pipelineColor,
}: {
  metricType: string;
  result: any;
  pipelineColor: string;
}) {
  if (!result) return null;

  const renderBar = (pct: number, color?: string, label?: string) => {
    const c = color ?? pipelineColor;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(pct, 1)}%`,
              backgroundColor: c,
            }}
          />
        </div>
        <span className="text-sm font-medium w-12 text-right">{pct}%</span>
        {label && (
          <span className="text-xs text-muted-foreground w-20 truncate">
            {label}
          </span>
        )}
      </div>
    );
  };

  switch (metricType) {
    case "funnel": {
      const { stages, total } = result as {
        stages: Array<{
          stageId: number;
          stageDisplayName: string;
          stageColor: string | null;
          stageKind: string;
          count: number;
          percentage: number;
        }>;
        total: number;
      };
      const won = stages.find(s => s.stageKind === "won");
      const lost = stages.find(s => s.stageKind === "lost");
      const paused = stages.find(s => s.stageKind === "paused");
      const openStages = stages.filter(
        s => s.stageKind === "open" && s.count === 0
      );

      return (
        <div className="space-y-3">
          {stages.map(s => (
            <div key={s.stageId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  {s.stageDisplayName}
                  {s.stageKind === "won" && " ✅"}
                  {s.stageKind === "lost" && " ❌"}
                  {s.stageKind === "paused" && " ⏸️"}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {s.count} de {total}
                  </span>
                  <span className="font-bold tabular-nums min-w-[4ch] text-right">
                    {s.percentage}%
                  </span>
                </div>
              </div>
              {renderBar(
                s.percentage,
                s.stageColor ?? undefined,
                `${s.count} leads`
              )}
            </div>
          ))}
          <div className="mt-4 rounded-xl bg-muted/30 p-4 text-sm leading-relaxed">
            <p>
              💡 <strong>{total}</strong> leads entraron en el período al embudo
              {won ? (
                <>
                  , <strong>{won.count}</strong> se ganaron (
                  <strong>{won.percentage}%</strong>)
                </>
              ) : null}
              {lost ? (
                <>
                  , <strong>{lost.count}</strong> se perdieron (
                  <strong>{lost.percentage}%</strong>)
                </>
              ) : null}
              {paused && paused.count > 0 ? (
                <>
                  , <strong>{paused.count}</strong> están en pausa (
                  <strong>{paused.percentage}%</strong>)
                </>
              ) : null}
              .
            </p>
            {openStages.length > 0 ? (
              <p className="mt-1">
                📉 Las fases{" "}
                <strong>
                  {openStages.map(s => s.stageDisplayName).join(", ")}
                </strong>{" "}
                tienen 0% de conversión. Son oportunidades de mejora.
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    case "stage_transition": {
      const { fromCount, toCount, percentage } = result as {
        fromCount: number;
        toCount: number;
        percentage: number;
      };
      return (
        <div className="space-y-3">
          <div className="text-center text-3xl font-bold">{percentage}%</div>
          <div className="text-center text-sm text-muted-foreground">
            {toCount} de {fromCount} leads pasaron de una fase a la otra
          </div>
          {renderBar(percentage, "#22c55e")}
        </div>
      );
    }

    case "by_segment": {
      const segments = result as Array<{
        label: string;
        total: number;
        won: number;
        percentage: number;
      }>;
      return (
        <div className="space-y-3">
          {segments.map(s => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{s.label}</span>
                <span className="font-medium">
                  {s.won}/{s.total}
                </span>
              </div>
              {renderBar(s.percentage, undefined, `${s.won} ganados`)}
            </div>
          ))}
        </div>
      );
    }

    case "avg_time": {
      const transitions = result as Array<{
        fromStage: string;
        toStage: string;
        avgDays: number | null;
        count: number;
      }>;
      return (
        <div className="space-y-3">
          {transitions.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm rounded-lg bg-muted/20 p-2"
            >
              <span>
                {t.fromStage} → {t.toStage}
              </span>
              <span className="font-medium">
                {t.avgDays != null
                  ? `${t.avgDays} días (${t.count} leads)`
                  : "Sin datos"}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case "velocity": {
      const v = result as {
        min: number | null;
        max: number | null;
        avg: number | null;
        median: number | null;
        distribution: Array<{ label: string; count: number; pct: number }>;
        count: number;
      };
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-muted/30 p-2">
              <p className="text-sm text-muted-foreground">Más rápido</p>
              <p className="text-lg font-bold">{v.min ?? "—"} d</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-2">
              <p className="text-sm text-muted-foreground">Más lento</p>
              <p className="text-lg font-bold">{v.max ?? "—"} d</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-2">
              <p className="text-sm text-muted-foreground">Promedio</p>
              <p className="text-lg font-bold">{v.avg ?? "—"} d</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-2">
              <p className="text-sm text-muted-foreground">Mediana</p>
              <p className="text-lg font-bold">{v.median ?? "—"} d</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {v.count} leads cerrados analizados
          </p>
          {v.distribution.map((d, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{d.label}</span>
                <span className="font-medium">{d.count} leads</span>
              </div>
              {renderBar(d.pct, "#6366f1", `${d.pct}%`)}
            </div>
          ))}
        </div>
      );
    }

    case "dropoff": {
      const steps = result as Array<{
        fromStage: string;
        toStage: string;
        entered: number;
        advanced: number;
        dropped: number;
        dropRate: number;
      }>;
      return (
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {s.fromStage} → {s.toStage}
                </span>
                <span className="font-medium text-red-600">
                  {s.dropped} caídos ({s.dropRate}%)
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Entraron {s.entered}, avanzaron {s.advanced}
              </div>
              {renderBar(
                s.dropRate,
                s.dropRate > 50
                  ? "#ef4444"
                  : s.dropRate > 30
                    ? "#f59e0b"
                    : "#22c55e",
                undefined
              )}
            </div>
          ))}
        </div>
      );
    }

    default:
      return <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>;
  }
}

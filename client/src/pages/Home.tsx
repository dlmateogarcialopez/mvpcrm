import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, CalendarClock, CircleDollarSign, Clock3, KanbanSquare, Loader2, ShieldAlert, Trophy, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatDateTime(value: number | Date | null | undefined) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function priorityBadge(priority: string) {
  if (priority === "rojo") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "amarillo") return "bg-amber-100 text-amber-800 border-amber-200";
  if (priority === "verde") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Barra de progreso relativa al máximo del grupo
function ProgressBar({ value, max, tone = "bg-primary" }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
      <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const dashboardQuery = trpc.leads.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-3xl border bg-card">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando resumen comercial...
        </div>
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-destructive">
        <h1 className="text-xl font-semibold">No fue posible cargar el resumen comercial</h1>
        <p className="mt-2 text-sm text-destructive/80">
          Revisa la conexión del proyecto o intenta recargar la página para volver a consultar el estado operativo.
        </p>
      </div>
    );
  }

  const { summary, pipeline, byAgent, byCity, upcomingVisits, urgentRows, overdueRows, unattendedRows, recentRows } = dashboardQuery.data;

  const pipelineHighlights = pipeline.filter(bucket => bucket.count > 0);
  const topAgents = byAgent.slice(0, 5);
  const topCities = byCity.slice(0, 5);

  const maxAgentValue = topAgents.reduce((m, a) => Math.max(m, a.value), 0);
  const maxCityValue = topCities.reduce((m, c) => Math.max(m, c.value), 0);
  const maxPipelineValue = pipeline.reduce((m, b) => Math.max(m, b.value), 0);

  const comisionPorcentaje = dashboardQuery.data.settings.comisionPorcentaje ?? 0;

  const metrics = [
    {
      label: "Seguimiento activo",
      value: summary.abiertos,
      helper: `${summary.total} oportunidades registradas en total`,
      icon: KanbanSquare,
      tone: "from-sky-500/10 via-white to-sky-500/5",
    },
    {
      label: "Ingreso abierto estimado",
      value: formatCurrency(summary.pipelineValue),
      helper: "Ingreso potencial de oportunidades abiertas",
      icon: CircleDollarSign,
      tone: "from-emerald-500/10 via-white to-emerald-500/5",
    },
    {
      label: "Cierres ganados",
      value: formatCurrency(summary.wonValue),
      helper: `${summary.ganados} oportunidades marcadas como ganadas`,
      icon: Trophy,
      tone: "from-violet-500/10 via-white to-violet-500/5",
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(summary.averageTicket),
      helper: "Valor medio por oportunidad registrada",
      icon: ShieldAlert,
      tone: "from-amber-500/10 via-white to-amber-500/5",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="overflow-hidden rounded-[28px] border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-sm">
        <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-200">
              Panel interno de operación comercial
            </span>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Prioriza, cotiza y da seguimiento a las oportunidades desde un solo flujo operativo.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Este MVP concentra lo que más pesa en la operación comercial diaria: seguimiento pendiente,
                oportunidades por cerrar, ingresos ganados y comisión estimada. La idea es operar rápido, con pocas
                pantallas y prioridades visibles para no enfriar oportunidades.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setLocation("/leads")}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Gestionar oportunidades
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setLocation("/configuracion")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Revisar configuración
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Seguimiento pendiente</p>
                <p className="mt-2 text-2xl font-semibold text-white">{unattendedRows.length}</p>
                <p className="mt-1 text-sm text-slate-300">Oportunidades sin gestión reciente que conviene reactivar hoy.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Cierres y conversión</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.conversionRate}%</p>
                <p className="mt-1 text-sm text-slate-300">Tasa de conversión acumulada con {summary.ganados} ventas cerradas.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Meta del mes</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.progressToGoal}%</p>
                <p className="mt-1 text-sm text-slate-300">
                  {formatCurrency(summary.wonValue)} ganados frente a una meta de {formatCurrency(dashboardQuery.data.settings.metaIngresosMensual)}.
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.max(summary.progressToGoal, 4)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:grid-cols-2">
            {metrics.map(metric => (
              <article key={metric.label} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${metric.tone} p-4 text-slate-950 shadow-sm`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/5 p-2.5">
                    <metric.icon className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">{metric.helper}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comisión proyectada ── */}
      {comisionPorcentaje > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-[20px] border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Comisión ganada
            </div>
            <p className="mt-3 text-xl font-semibold">{formatCurrency(summary.projectedWonCommission)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Sobre {formatCurrency(summary.wonValue)} cerrados · {comisionPorcentaje}%</p>
          </article>
          <article className="rounded-[20px] border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5" />
              Comisión potencial
            </div>
            <p className="mt-3 text-xl font-semibold">{formatCurrency(summary.projectedPipelineCommission)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Sobre {formatCurrency(summary.pipelineValue)} en embudo · {comisionPorcentaje}%</p>
          </article>
          <article className="rounded-[20px] border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" />
              Tasa de conversión
            </div>
            <p className="mt-3 text-xl font-semibold">{summary.conversionRate}%</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.ganados} ganadas de {summary.total} registradas</p>
          </article>
          <article className="rounded-[20px] border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Alertas activas
            </div>
            <p className="mt-3 text-xl font-semibold">{summary.alertas + summary.vencidos}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.vencidos} vencidas · {summary.alertas} con alerta pendiente</p>
          </article>
        </section>
      )}

      {/* ── Visitas + Recientes ── */}
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-[24px] border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Próximas visitas</h2>
                <p className="text-sm text-muted-foreground">Agenda comercial inmediata para no perder el ritmo.</p>
              </div>
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-5 space-y-3">
              {upcomingVisits.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No hay visitas futuras registradas todavía.
                </div>
              ) : (
                upcomingVisits.map(lead => (
                  <button
                    key={lead.publicId}
                    type="button"
                    onClick={() => setLocation(`/leads?lead=${lead.publicId}`)}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition hover:border-primary/30 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{lead.nombreCliente}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadge(lead.prioridad)}`}>
                          {lead.prioridad}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{lead.publicId} · {lead.agenteResponsable || "Sin asignar"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatDateTime(lead.fechaVisita)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{lead.diasHastaVisita ?? "-"} días restantes</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[24px] border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Oportunidades recientes</h2>
                <p className="text-sm text-muted-foreground">Actividad actualizada para revisar cambios y avances del equipo.</p>
              </div>
              <Clock3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border">
              <div className="hidden grid-cols-[1.2fr_0.7fr_0.6fr_0.7fr] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                <span>Oportunidad</span>
                <span>Estado</span>
                <span>Prioridad</span>
                <span className="text-right">Valor</span>
              </div>
              <div className="divide-y">
                {recentRows.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">Aún no hay actividad reciente registrada.</div>
                ) : (
                  recentRows.map(lead => (
                    <button
                      key={lead.publicId}
                      type="button"
                      onClick={() => setLocation(`/leads?lead=${lead.publicId}`)}
                      className="grid w-full grid-cols-[1fr_auto] gap-2 px-4 py-3 text-left text-sm transition hover:bg-muted/30 sm:grid-cols-[1.2fr_0.7fr_0.6fr_0.7fr] sm:gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{lead.nombreCliente}</p>
                        <p className="truncate text-xs text-muted-foreground">{lead.publicId}</p>
                      </div>
                      <span className="hidden truncate text-muted-foreground sm:block">{statusLabel(lead.estadoLead)}</span>
                      <span className="hidden sm:block">
                        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${priorityBadge(lead.prioridad)}`}>
                          {lead.prioridad}
                        </span>
                      </span>
                      <span className="text-right font-medium">{formatCurrency(lead.valorTotal)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[24px] border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Atención prioritaria</h2>
                <p className="text-sm text-muted-foreground">Oportunidades calientes o de alto valor que exigen respuesta pronta.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-5 space-y-3">
              {urgentRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No hay oportunidades urgentes en este momento.
                </div>
              ) : (
                urgentRows.map(lead => (
                  <button
                    key={lead.publicId}
                    type="button"
                    onClick={() => setLocation(`/leads?lead=${lead.publicId}`)}
                    className="w-full rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-left transition hover:bg-amber-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{lead.nombreCliente}</p>
                        <p className="text-xs text-slate-600">{lead.publicId} · Puntaje {lead.scoreTotal}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadge(lead.prioridad)}`}>
                        {lead.prioridad}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-700">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Valor</p>
                        <p className="font-medium">{formatCurrency(lead.valorTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Visita</p>
                        <p className="font-medium">{formatDateTime(lead.fechaVisita)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[24px] border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">Alertas operativas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Los seis casos más delicados entre vencimientos y falta de gestión.</p>
            <div className="mt-5 space-y-3">
              {[...overdueRows, ...unattendedRows].slice(0, 6).map(lead => (
                <button
                  key={`${lead.publicId}-${lead.updatedAt}`}
                  type="button"
                  onClick={() => setLocation(`/leads?lead=${lead.publicId}`)}
                  className="w-full rounded-2xl border p-4 text-left transition hover:border-primary/25 hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{lead.nombreCliente}</p>
                      <p className="text-xs text-muted-foreground">{lead.publicId} · {statusLabel(lead.estadoLead)}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadge(lead.prioridad)}`}>
                      {lead.prioridad}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {lead.isOverdue ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">Gestión vencida</span> : null}
                    {(lead.horasDesdeUltimaGestion ?? 0) >= 24 ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Sin gestión reciente</span>
                    ) : null}
                  </div>
                </button>
              ))}
              {overdueRows.length === 0 && unattendedRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No hay alertas operativas activas.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {/* ── Reportes avanzados: Embudo + Agentes + Ciudades ── */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Embudo comercial */}
        <section className="rounded-[24px] border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Embudo comercial</h2>
              <p className="text-sm text-muted-foreground">Estados activos para entender dónde se concentran las oportunidades abiertas.</p>
            </div>
            <KanbanSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-5 space-y-3">
            {(pipelineHighlights.length > 0 ? pipelineHighlights : pipeline).map(bucket => (
              <div key={bucket.status} className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{bucket.label}</p>
                    <p className="text-sm text-muted-foreground">{bucket.count} oportunidades en este tramo</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatCurrency(bucket.value)}</p>
                </div>
                <ProgressBar value={bucket.value} max={maxPipelineValue} tone="bg-sky-500" />
              </div>
            ))}
          </div>
        </section>

        {/* Reporte por responsable */}
        <section className="rounded-[24px] border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Oportunidades abiertas por responsable</h2>
              <p className="text-sm text-muted-foreground">Quién tiene hoy más valor en curso para mover a cierre.</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-5 space-y-3">
            {topAgents.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                Todavía no hay responsables con oportunidades abiertas.
              </div>
            ) : (
              topAgents.map((agent, index) => (
                <div key={agent.name} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <p className="truncate font-medium">{agent.name}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{agent.count} oportunidades activas</p>
                    </div>
                    <div className="text-right">
                      <p className="shrink-0 text-sm font-semibold">{formatCurrency(agent.value)}</p>
                      {comisionPorcentaje > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Comisión proyectada</p>
                          <p className="text-xs font-medium text-muted-foreground">
                            {formatCurrency(agent.value * comisionPorcentaje / 100)}
                          </p>
                        </div>
                      )}
                      {agent.count > 0 && agent.closedCount !== undefined && (
                        <div className="mt-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversión</p>
                          <p className="text-xs font-medium text-muted-foreground">
                            {agent.closedCount} cerradas
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <ProgressBar value={agent.value} max={maxAgentValue} tone="bg-violet-500" />
                </div>
              ))
            )}
          </div>
          {topAgents.length > 0 && (
            <div className="mt-4 rounded-2xl border border-dashed bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
              Total en embudo: <span className="font-medium text-foreground">{formatCurrency(topAgents.reduce((s, a) => s + a.value, 0))}</span>
              {comisionPorcentaje > 0 && (
                <> · Comisión potencial: <span className="font-medium text-foreground">{formatCurrency(topAgents.reduce((s, a) => s + a.value, 0) * comisionPorcentaje / 100)}</span></>
              )}
            </div>
          )}
        </section>

        {/* Reporte por ciudad */}
        <section className="rounded-[24px] border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Ciudades activas</h2>
              <p className="text-sm text-muted-foreground">Dónde se están moviendo las oportunidades en curso para decidir el foco comercial.</p>
            </div>
            <Trophy className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-5 space-y-3">
            {topCities.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                Aún no hay ciudades con oportunidades abiertas.
              </div>
            ) : (
              topCities.map((city, index) => (
                <div key={city.city} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <p className="truncate font-medium">{city.city}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{city.count} oportunidades activas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor total</p>
                      <p className="shrink-0 text-sm font-semibold">{formatCurrency(city.value)}</p>
                    </div>
                  </div>
                  <ProgressBar value={city.value} max={maxCityValue} tone="bg-emerald-500" />
                </div>
              ))
            )}
          </div>
          {topCities.length > 0 && (
            <div className="mt-4 rounded-2xl border border-dashed bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
              Total en embudo: <span className="font-medium text-foreground">{formatCurrency(topCities.reduce((s, c) => s + c.value, 0))}</span>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

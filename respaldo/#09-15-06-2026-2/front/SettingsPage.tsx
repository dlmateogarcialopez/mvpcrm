import { AlertTriangle, CheckCircle2, Loader2, Save, Settings2, ShieldCheck, UserCog2, Users, X, Kanban, Tag, MessageSquare, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { appSettingsInputSchema, type AppSettingsInput } from "../../../shared/leadSchemas";
import { appRoleLabels, appRoleValues, defaultBusinessSettings, type AppRole } from "../../../shared/leads";
import { getSettingsFieldLocks, getSettingsImpactCards } from "../lib/settings-page.logic";
import { trpc } from "../lib/trpc";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Sin ingreso reciente";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildInitialSettings(): AppSettingsInput {
  return {
    configName: "Configuración principal",
    precioMultiple: defaultBusinessSettings.precioMultiple,
    precioJunior: defaultBusinessSettings.precioJunior,
    precioSenior: defaultBusinessSettings.precioSenior,
    precioParqueadero: defaultBusinessSettings.precioParqueadero,
    ticketPromedioReferencia: defaultBusinessSettings.ticketPromedioReferencia,
    minimoPersonasAmarillo: defaultBusinessSettings.minimoPersonasAmarillo,
    minimoPersonasRojo: defaultBusinessSettings.minimoPersonasRojo,
    minimoValorAmarillo: defaultBusinessSettings.minimoValorAmarillo,
    minimoValorRojo: defaultBusinessSettings.minimoValorRojo,
    diasUrgenciaAlta: defaultBusinessSettings.diasUrgenciaAlta,
    horasLeadCaliente: defaultBusinessSettings.horasLeadCaliente,
    scoreAltoThreshold: defaultBusinessSettings.scoreAltoThreshold,
    metaIngresosMensual: defaultBusinessSettings.metaIngresosMensual,
    comisionPorcentaje: defaultBusinessSettings.comisionPorcentaje,
    calendarSyncEnabled: false,
    googleCalendarId: "",
    emailAlertsEnabled: false,
    smsAlertsEnabled: false,
    alertEmailTo: "",
    alertSmsTo: "",
  };
}

const pricingFields: Array<{ key: keyof AppSettingsInput; label: string; currency?: boolean }> = [
  { key: "precioMultiple", label: "Múltiple", currency: true },
  { key: "precioJunior", label: "Junior", currency: true },
  { key: "precioSenior", label: "Senior", currency: true },
  { key: "precioParqueadero", label: "Parqueadero", currency: true },
  { key: "ticketPromedioReferencia", label: "Ticket promedio de referencia", currency: true },
  { key: "metaIngresosMensual", label: "Meta mensual de ingresos", currency: true },
  { key: "comisionPorcentaje", label: "Comisión comercial (%)" },
];

const scoringFields: Array<{ key: keyof AppSettingsInput; label: string; hint?: string }> = [
  { key: "minimoPersonasAmarillo", label: "Mínimo personas amarillo", hint: "Debe ser menor que el umbral rojo" },
  { key: "minimoPersonasRojo", label: "Mínimo personas rojo", hint: "Debe ser mayor que el umbral amarillo" },
  { key: "minimoValorAmarillo", label: "Mínimo valor amarillo", hint: "Debe ser menor que el umbral rojo" },
  { key: "minimoValorRojo", label: "Mínimo valor rojo", hint: "Debe ser mayor que el umbral amarillo" },
  { key: "diasUrgenciaAlta", label: "Días para urgencia alta", hint: "Entre 1 y 30 días" },
  { key: "horasLeadCaliente", label: "Horas para oportunidad caliente", hint: "Entre 1 y 168 horas" },
  { key: "scoreAltoThreshold", label: "Puntaje para oportunidad caliente", hint: "Entre 1 y 200 puntos" },
];

const roleCapabilities = [
  {
    role: "Invitado",
    scope: "Captura y consulta básica",
    permissions: ["Crear sus propias oportunidades", "Consultar sus oportunidades", "Seguir la ruta comercial sugerida"],
  },
  {
    role: "Agente",
    scope: "Ejecución diaria de oportunidades",
    permissions: ["Actualizar estado y seguimiento", "Registrar actividades y notas", "Mover oportunidades asignadas"],
  },
  {
    role: "Administrador",
    scope: "Coordinación comercial",
    permissions: ["Ver la operación completa", "Ajustar reglas y metas", "Supervisar responsables y alertas"],
  },
  {
    role: "Superadministrador",
    scope: "Gobierno del CRM",
    permissions: ["Control total de permisos", "Configuración sensible", "Visión integral del sistema"],
  },
] as const;

// ─── Diálogo de confirmación modal ───────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  sensitiveChanges: string[];
  impactCards: Array<{ title: string; description: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmSensitiveDialog({ open, sensitiveChanges, impactCards, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] border bg-background p-0 shadow-2xl backdrop:bg-black/50"
      onCancel={onCancel}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Confirmar cambios sensibles</h2>
              <p className="text-sm text-muted-foreground">Revisa el impacto antes de guardar.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-2 transition hover:bg-muted"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-foreground">Cambios que afectan la operación comercial:</p>
          <ul className="space-y-2">
            {sensitiveChanges.map(change => (
              <li key={change} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {change}
              </li>
            ))}
          </ul>
        </div>

        {impactCards.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-medium text-foreground">Impacto operativo esperado:</p>
            <div className="space-y-2">
              {impactCards.map(card => (
                <div key={card.title} className="rounded-2xl border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{card.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-medium transition hover:bg-muted"
          >
            Cancelar y revisar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-medium text-white transition hover:bg-amber-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar y guardar
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ─── Validación inline de umbrales ───────────────────────────────────────────
function getThresholdErrors(form: AppSettingsInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (form.minimoPersonasRojo < form.minimoPersonasAmarillo) {
    errors.minimoPersonasRojo = "El umbral rojo debe ser mayor o igual al amarillo.";
  }
  if (form.minimoValorRojo < form.minimoValorAmarillo) {
    errors.minimoValorRojo = "El umbral rojo de valor debe ser mayor o igual al amarillo.";
  }
  if (form.diasUrgenciaAlta < 1 || form.diasUrgenciaAlta > 30) {
    errors.diasUrgenciaAlta = "Debe estar entre 1 y 30 días.";
  }
  if (form.horasLeadCaliente < 1 || form.horasLeadCaliente > 168) {
    errors.horasLeadCaliente = "Debe estar entre 1 y 168 horas.";
  }
  if (form.scoreAltoThreshold < 1 || form.scoreAltoThreshold > 200) {
    errors.scoreAltoThreshold = "Debe estar entre 1 y 200 puntos.";
  }

  return errors;
}

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.get.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const teamQuery = trpc.settings.team.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const historyQuery = trpc.settings.history.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const [form, setForm] = useState<AppSettingsInput>(() => buildInitialSettings());
  const [roleDrafts, setRoleDrafts] = useState<Record<number, AppRole>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("agent");

  const createUserMutation = trpc.auth.createUser.useMutation({
    onSuccess: async () => {
      toast.success("Colaborador creado exitosamente.");
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("agent");
      setShowAddUserForm(false);
      await utils.settings.team.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "No fue posible crear el colaborador.");
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) return;

    setForm({
      configName: settingsQuery.data.configName,
      precioMultiple: settingsQuery.data.precioMultiple,
      precioJunior: settingsQuery.data.precioJunior,
      precioSenior: settingsQuery.data.precioSenior,
      precioParqueadero: settingsQuery.data.precioParqueadero,
      ticketPromedioReferencia: settingsQuery.data.ticketPromedioReferencia,
      minimoPersonasAmarillo: settingsQuery.data.minimoPersonasAmarillo,
      minimoPersonasRojo: settingsQuery.data.minimoPersonasRojo,
      minimoValorAmarillo: settingsQuery.data.minimoValorAmarillo,
      minimoValorRojo: settingsQuery.data.minimoValorRojo,
      diasUrgenciaAlta: settingsQuery.data.diasUrgenciaAlta,
      horasLeadCaliente: settingsQuery.data.horasLeadCaliente,
      scoreAltoThreshold: settingsQuery.data.scoreAltoThreshold,
      metaIngresosMensual: settingsQuery.data.metaIngresosMensual,
      comisionPorcentaje: settingsQuery.data.comisionPorcentaje,
      calendarSyncEnabled: settingsQuery.data.calendarSyncEnabled,
      googleCalendarId: settingsQuery.data.googleCalendarId ?? "",
      emailAlertsEnabled: settingsQuery.data.emailAlertsEnabled,
      smsAlertsEnabled: settingsQuery.data.smsAlertsEnabled,
      alertEmailTo: settingsQuery.data.alertEmailTo ?? "",
      alertSmsTo: settingsQuery.data.alertSmsTo ?? "",
    });
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!teamQuery.data) return;

    setRoleDrafts(current => {
      const next = { ...current };
      for (const member of teamQuery.data) {
        next[member.id] = current[member.id] ?? member.role;
      }
      return next;
    });
  }, [teamQuery.data]);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Configuración actualizada correctamente.");
      await Promise.all([utils.settings.get.invalidate(), utils.settings.history.invalidate(), utils.leads.dashboard.invalidate()]);
    },
    onError: error => {
      toast.error(error.message || "No fue posible guardar la configuración.");
    },
  });

  const updateRoleMutation = trpc.settings.updateUserRole.useMutation({
    onSuccess: async updatedUser => {
      toast.success(`Rol actualizado para ${updatedUser.name}.`);
      await Promise.all([utils.settings.team.invalidate(), utils.leads.list.invalidate()]);
    },
    onError: error => {
      toast.error(error.message || "No fue posible actualizar el rol del usuario.");
    },
  });

  const pendingRoleUserId = updateRoleMutation.variables?.userId ?? null;
  const teamSummary = useMemo(() => {
    const rows = teamQuery.data ?? [];
    return {
      total: rows.length,
      activeAgents: rows.filter(member => member.role === "agent").length,
      managers: rows.filter(member => member.role === "admin" || member.role === "superadmin").length,
    };
  }, [teamQuery.data]);

  const thresholdErrors = useMemo(() => getThresholdErrors(form), [form]);
  const hasThresholdErrors = Object.keys(thresholdErrors).length > 0;

  const scoringRuleCards = useMemo(
    () => [
      {
        title: "Pisos por volumen",
        description: `La prioridad sube a amarillo desde ${form.minimoPersonasAmarillo} personas y a rojo desde ${form.minimoPersonasRojo} personas.`,
        hasError: Boolean(thresholdErrors.minimoPersonasRojo),
      },
      {
        title: "Pisos por valor potencial",
        description: `La prioridad escala a amarillo desde ${formatCurrency(form.minimoValorAmarillo)} y a rojo desde ${formatCurrency(form.minimoValorRojo)}.`,
        hasError: Boolean(thresholdErrors.minimoValorRojo),
      },
      {
        title: "Escalados por urgencia",
        description: `Una visita en ${form.diasUrgenciaAlta} días o menos y una oportunidad con menos de ${form.horasLeadCaliente} horas puede subir la prioridad automáticamente.`,
        hasError: Boolean(thresholdErrors.diasUrgenciaAlta || thresholdErrors.horasLeadCaliente),
      },
      {
        title: "Oportunidad caliente por puntaje",
        description: `Cuando el puntaje total llega a ${form.scoreAltoThreshold} puntos o más, el sistema la trata como oportunidad caliente para priorización operativa.`,
        hasError: Boolean(thresholdErrors.scoreAltoThreshold),
      },
    ],
    [form.diasUrgenciaAlta, form.horasLeadCaliente, form.minimoPersonasAmarillo, form.minimoPersonasRojo, form.minimoValorAmarillo, form.minimoValorRojo, form.scoreAltoThreshold, thresholdErrors],
  );

  const scoringTraceLines = useMemo(
    () => [
      `1. El sistema calcula un puntaje base con cantidad, valor total, ticket promedio, urgencia y recencia de la oportunidad.`,
      `2. Si la oportunidad supera ${form.minimoPersonasAmarillo} personas o ${formatCurrency(form.minimoValorAmarillo)}, nunca queda por debajo de amarillo.`,
      `3. Si llega a ${form.minimoPersonasRojo} personas o ${formatCurrency(form.minimoValorRojo)}, nunca queda por debajo de rojo.`,
      `4. Una visita en ${form.diasUrgenciaAlta} días o menos puede subir un nivel la prioridad, igual que una oportunidad muy reciente con puntaje de ${form.scoreAltoThreshold}+ dentro de ${form.horasLeadCaliente} horas.`,
      "5. Este mismo criterio ya se refleja en el listado de oportunidades, el panel de la oportunidad y el resumen comercial.",
    ],
    [form.diasUrgenciaAlta, form.horasLeadCaliente, form.minimoPersonasAmarillo, form.minimoPersonasRojo, form.minimoValorAmarillo, form.minimoValorRojo, form.scoreAltoThreshold],
  );

  const pendingChanges = useMemo(() => {
    const current = settingsQuery.data;
    if (!current) return [] as string[];

    const changes: string[] = [];
    if (form.metaIngresosMensual !== current.metaIngresosMensual) changes.push("Meta mensual actualizada");
    if (form.comisionPorcentaje !== current.comisionPorcentaje) changes.push("Comisión comercial actualizada");
    if (form.scoreAltoThreshold !== current.scoreAltoThreshold) changes.push("Puntaje de oportunidad caliente ajustado");
    if (form.diasUrgenciaAlta !== current.diasUrgenciaAlta) changes.push("Regla de urgencia de visita modificada");
    if (form.calendarSyncEnabled !== current.calendarSyncEnabled) changes.push("Cambio en la sincronización con Google Calendar");
    if ((form.googleCalendarId ?? "") !== (current.googleCalendarId ?? "")) changes.push("ID del calendario cambiado");
    if (form.emailAlertsEnabled !== current.emailAlertsEnabled) changes.push("Cambio en alertas por correo");
    if ((form.alertEmailTo ?? "") !== (current.alertEmailTo ?? "")) changes.push("Correo de alertas cambiado");
    if (form.smsAlertsEnabled !== current.smsAlertsEnabled) changes.push("Cambio en alertas SMS");
    if ((form.alertSmsTo ?? "") !== (current.alertSmsTo ?? "")) changes.push("Número de alertas SMS cambiado");
    return changes;
  }, [form, settingsQuery.data]);

  const sensitiveChanges = useMemo(
    () =>
      pendingChanges.filter(change =>
        ["sincronización", "calendario", "alertas", "comisión", "Meta mensual"].some(keyword =>
          change.toLowerCase().includes(keyword.toLowerCase()),
        ),
      ),
    [pendingChanges],
  );

  const latestHistoryEntry = historyQuery.data?.[0] ?? null;
  const impactCards = useMemo(() => getSettingsImpactCards(pendingChanges), [pendingChanges]);
  const { calendarFieldLocked, emailFieldLocked, smsFieldLocked } = useMemo(() => getSettingsFieldLocks(form), [form]);

  function updateField<K extends keyof AppSettingsInput>(key: K, value: AppSettingsInput[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function doSave() {
    const parsed = appSettingsInputSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const message = Object.values(fieldErrors).flat().find(Boolean);
      toast.error(message || "Revisa la configuración antes de guardar.");
      return;
    }

    await updateMutation.mutateAsync({
      ...parsed.data,
      googleCalendarId: parsed.data.googleCalendarId?.trim() || null,
      alertEmailTo: parsed.data.alertEmailTo?.trim() || null,
      alertSmsTo: parsed.data.alertSmsTo?.trim() || null,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (hasThresholdErrors) {
      toast.error("Corrige los errores en los umbrales de puntaje antes de guardar.");
      return;
    }

    const parsed = appSettingsInputSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const message = Object.values(fieldErrors).flat().find(Boolean);
      toast.error(message || "Revisa la configuración antes de guardar.");
      return;
    }

    if (sensitiveChanges.length > 0) {
      setPendingSubmit(true);
      setShowConfirmDialog(true);
      return;
    }

    await doSave();
  }

  async function handleConfirmSave() {
    setShowConfirmDialog(false);
    setPendingSubmit(false);
    await doSave();
  }

  function handleCancelSave() {
    setShowConfirmDialog(false);
    setPendingSubmit(false);
    toast.info("Guardado cancelado. Revisa los cambios sensibles antes de confirmar.");
  }

  async function handleRoleUpdate(userId: number) {
    const nextRole = roleDrafts[userId];
    if (!nextRole) return;

    await updateRoleMutation.mutateAsync({
      userId,
      role: nextRole,
    });
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="rounded-[24px] border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando la configuración operativa de Máquina de ventas...
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmSensitiveDialog
        open={showConfirmDialog}
        sensitiveChanges={sensitiveChanges}
        impactCards={impactCards}
        onConfirm={handleConfirmSave}
        onCancel={handleCancelSave}
      />

      <div className="space-y-6">
        <section className="rounded-[24px] border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Settings2 className="h-4 w-4" />
                Control operativo
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Configuración comercial de Máquina de ventas</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Ajusta precios, puntajes, meta de ingresos, comisión y estructura del equipo sin tocar código. La idea es mantener el CRM simple, pero realmente operable para ventas.
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground lg:max-w-sm">
              <p>Los cambios se reflejan en el tablero, en la prioridad del embudo y ahora también en el catálogo oficial de responsables comerciales.</p>
              <div className="mt-3 rounded-xl bg-background/70 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">Último cambio registrado</p>
                {historyQuery.isLoading ? (
                  <p className="mt-1">Cargando bitácora reciente...</p>
                ) : latestHistoryEntry ? (
                  <>
                    <p className="mt-1 text-foreground">{latestHistoryEntry.summary}</p>
                    <p className="mt-1">{latestHistoryEntry.changedByName} · {new Date(latestHistoryEntry.changedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </>
                ) : (
                  <p className="mt-1">Todavía no hay cambios sensibles registrados en la bitácora.</p>
                )}
              </div>
            </div>
          </div>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Nombre de la configuración</span>
              <input
                value={form.configName}
                onChange={event => updateField("configName", event.target.value)}
                className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                placeholder="Configuración principal"
              />
            </label>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Economía comercial</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {pricingFields.map(field => {
                    const value = Number(form[field.key] ?? 0);
                    return (
                      <label key={field.key} className="grid gap-2 text-sm">
                        <span className="font-medium">{field.label}</span>
                        <input
                          type="number"
                          min={0}
                          step={field.key === "comisionPorcentaje" ? 0.1 : 1}
                          value={value}
                          onChange={event => updateField(field.key, Number(event.target.value) as never)}
                          className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        />
                        {field.currency ? <span className="text-xs text-muted-foreground">{formatCurrency(value)}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Módulo de puntaje y prioridad</h2>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                      Ajusta aquí los criterios editables que definen el semáforo comercial. La meta es que cualquier líder comercial entienda qué regla mueve la prioridad sin entrar al código.
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground lg:max-w-sm">
                    Trazabilidad básica activa: el mismo criterio se explica en configuración y también en el panel de la oportunidad.
                  </div>
                </div>

                {hasThresholdErrors && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Hay errores en los umbrales de puntaje. Corrígelos antes de guardar para que la priorización funcione correctamente.</span>
                  </div>
                )}

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {scoringRuleCards.map(card => (
                    <article
                      key={card.title}
                      className={`rounded-2xl border p-4 ${card.hasError ? "border-destructive/30 bg-destructive/5" : "bg-muted/10"}`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{card.title}</p>
                        {card.hasError && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {scoringFields.map(field => {
                    const error = thresholdErrors[field.key];
                    return (
                      <label key={field.key} className="grid gap-2 text-sm">
                        <span className="font-medium">{field.label}</span>
                        <input
                          type="number"
                          min={0}
                          value={Number(form[field.key] ?? 0)}
                          onChange={event => updateField(field.key, Number(event.target.value) as never)}
                          className={`h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary ${error ? "border-destructive focus:border-destructive" : ""}`}
                        />
                        {error ? (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {error}
                          </span>
                        ) : field.hint ? (
                          <span className="text-xs text-muted-foreground">{field.hint}</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-dashed p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cómo se decide hoy la prioridad</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {scoringTraceLines.map(line => (
                      <p key={line} className="rounded-xl bg-muted/30 px-3 py-2">{line}</p>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Perfiles y permisos visibles</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La misma aplicación sirve para ambos perfiles comerciales, pero el alcance operativo cambia según el rol autenticado.
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  El backend ya aplica restricciones; esta matriz deja claro qué esperar en operación.
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {roleCapabilities.map(item => (
                  <article key={item.role} className="rounded-2xl border bg-muted/10 p-4">
                    <p className="text-sm font-semibold">{item.role}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-primary">{item.scope}</p>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {item.permissions.map(permission => (
                        <li key={permission}>• {permission}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Users className="h-4 w-4" />
                    Equipo comercial
                  </div>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight">Catálogo oficial de responsables y permisos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Desde aquí administras quién participa en la operación y con qué alcance. Este catálogo alimenta la asignación de oportunidades en la vista comercial.
                  </p>
                </div>
                <div className="grid gap-2 text-sm md:min-w-64">
                  <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Usuarios registrados</p>
                    <p className="mt-1 font-semibold">{teamSummary.total}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Agentes</p>
                      <p className="mt-1 font-semibold">{teamSummary.activeAgents}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Líderes</p>
                      <p className="mt-1 font-semibold">{teamSummary.managers}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between items-center border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Miembros del equipo</h3>
                <button
                  type="button"
                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
                >
                  {showAddUserForm ? "Cerrar formulario" : "Añadir Colaborador"}
                </button>
              </div>

              {showAddUserForm && (
                <div className="mt-3 rounded-2xl border bg-card p-4 shadow-sm space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">Registrar nuevo colaborador</h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-1.5 text-xs">
                      <span className="font-medium text-slate-400">Nombre completo</span>
                      <input
                        required
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="h-10 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        placeholder="Ej. Juan Pérez"
                      />
                    </label>

                    <label className="grid gap-1.5 text-xs">
                      <span className="font-medium text-slate-400">Correo electrónico</span>
                      <input
                        required
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="h-10 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        placeholder="Ej. juan@correo.com"
                      />
                    </label>

                    <label className="grid gap-1.5 text-xs">
                      <span className="font-medium text-slate-400">Contraseña inicial</span>
                      <input
                        required
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="h-10 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        placeholder="Mín. 6 caracteres"
                      />
                    </label>

                    <label className="grid gap-1.5 text-xs">
                      <span className="font-medium text-slate-400">Rol asignado</span>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as AppRole)}
                        className="h-10 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                      >
                        {appRoleValues.map((role) => (
                          <option key={role} value={role}>
                            {appRoleLabels[role]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddUserForm(false)}
                      className="inline-flex h-9 items-center justify-center rounded-xl border px-4 text-xs font-semibold transition hover:bg-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={createUserMutation.isPending}
                      onClick={() => {
                        if (!newUserName || !newUserEmail || !newUserPassword) {
                          toast.warning("Por favor, completa todos los campos.");
                          return;
                        }
                        if (newUserPassword.length < 6) {
                          toast.warning("La contraseña debe tener al menos 6 caracteres.");
                          return;
                        }
                        createUserMutation.mutate({
                          name: newUserName,
                          email: newUserEmail,
                          password: newUserPassword,
                          role: newUserRole,
                        });
                      }}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    >
                      {createUserMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Guardar Colaborador
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {teamQuery.isLoading ? (
                  <div className="flex items-center gap-3 rounded-2xl border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando equipo comercial...
                  </div>
                ) : teamQuery.isError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
                    No fue posible cargar el catálogo del equipo.
                  </div>
                ) : (teamQuery.data ?? []).length === 0 ? (
                  <div className="rounded-2xl border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                    Aún no hay usuarios registrados en la operación.
                  </div>
                ) : (
                  (teamQuery.data ?? []).map(member => {
                    const selectedRole = roleDrafts[member.id] ?? member.role;
                    const isUpdating = updateRoleMutation.isPending && pendingRoleUserId === member.id;
                    const hasRoleChange = selectedRole !== member.role;

                    return (
                      <article key={member.id} className="grid gap-4 rounded-2xl border bg-muted/10 p-4 lg:grid-cols-[1.2fr_0.9fr_0.7fr] lg:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{member.name}</p>
                            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{member.roleLabel}</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{member.email ?? "Sin correo visible"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Último ingreso: {formatDateTime(member.lastSignedIn)}</p>
                        </div>

                        <label className="grid gap-2 text-sm">
                          <span className="font-medium">Rol operativo</span>
                          <select
                            value={selectedRole}
                            onChange={event =>
                              setRoleDrafts(current => ({
                                ...current,
                                [member.id]: event.target.value as AppRole,
                              }))
                            }
                            disabled={!member.canEdit || isUpdating}
                            className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {appRoleValues.map(role => (
                              <option key={role} value={role}>
                                {appRoleLabels[role]}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="flex flex-col gap-2 lg:items-end">
                          <button
                            type="button"
                            onClick={() => handleRoleUpdate(member.id)}
                            disabled={!member.canEdit || !hasRoleChange || isUpdating}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog2 className="h-4 w-4" />}
                            Guardar rol
                          </button>
                          <p className="text-xs text-muted-foreground lg:text-right">
                            {member.canEdit
                              ? "Puedes ajustar este rol según la operación comercial."
                              : "Este usuario queda protegido por sus permisos actuales o por ser tu propia sesión."}
                          </p>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bitácora reciente de Configuración</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Este resumen deja visible qué cambio sensible se aplicó, quién lo guardó y cuáles campos quedaron afectados.
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Histórico simple para auditoría operativa del MVP.
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {historyQuery.isLoading ? (
                  <div className="flex items-center gap-3 rounded-2xl border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando historial reciente de Configuración...
                  </div>
                ) : historyQuery.isError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
                    No fue posible cargar la bitácora reciente de Configuración.
                  </div>
                ) : (historyQuery.data ?? []).length === 0 ? (
                  <div className="rounded-2xl border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                    Aún no se han guardado cambios sensibles en la Configuración.
                  </div>
                ) : (
                  (historyQuery.data ?? []).map(entry => (
                    <article key={entry.id} className="rounded-2xl border bg-muted/10 p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-medium">{entry.summary}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.changedByName}
                            {entry.changedByEmail ? ` · ${entry.changedByEmail}` : ""}
                            {` · ${new Date(entry.changedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}`}
                          </p>
                        </div>
                        <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                          {entry.changeCount} campo{entry.changeCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.fields.map(field => (
                          <span key={`${entry.id}-${field.field}`} className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                            {field.label}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-2xl border p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Integraciones opcionales</h2>
                <div className="mt-4 grid gap-4">
                  <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">Sincronización con Google Calendar</p>
                      <p className="text-muted-foreground">Se deja lista para una siguiente activación, sin volver compleja la arquitectura del MVP.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.calendarSyncEnabled}
                      onChange={event => updateField("calendarSyncEnabled", event.target.checked)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">ID del calendario</span>
                    <input
                      value={form.googleCalendarId ?? ""}
                      onChange={event => updateField("googleCalendarId", event.target.value)}
                      disabled={calendarFieldLocked}
                      className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-muted-foreground"
                      placeholder="equipo-comercial@group.calendar.google.com"
                    />
                    <span className="text-xs text-muted-foreground">
                      {calendarFieldLocked
                        ? "Activa la sincronización para habilitar este campo sensible y registrar el calendario operativo."
                        : "Este ID se usará como destino oficial de la agenda comercial sincronizada."}
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">Alertas por correo</p>
                      <p className="text-muted-foreground">Útil para vencimientos, seguimientos pendientes y oportunidades calientes.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.emailAlertsEnabled}
                      onChange={event => updateField("emailAlertsEnabled", event.target.checked)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Correo de alertas</span>
                    <input
                      value={form.alertEmailTo ?? ""}
                      onChange={event => updateField("alertEmailTo", event.target.value)}
                      disabled={emailFieldLocked}
                      className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-muted-foreground"
                      placeholder="operaciones@empresa.com"
                    />
                    <span className="text-xs text-muted-foreground">
                      {emailFieldLocked
                        ? "Activa alertas por correo para habilitar este destino y evitar configuraciones sensibles a medias."
                        : "Usa un correo operativo visible para el responsable del seguimiento diario."}
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">Alertas SMS</p>
                      <p className="text-muted-foreground">Queda disponible como apoyo operativo, aunque no sea la prioridad de esta etapa del MVP.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.smsAlertsEnabled}
                      onChange={event => updateField("smsAlertsEnabled", event.target.checked)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Número para SMS</span>
                    <input
                      value={form.alertSmsTo ?? ""}
                      onChange={event => updateField("alertSmsTo", event.target.value)}
                      disabled={smsFieldLocked}
                      className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-muted-foreground"
                      placeholder="573001234567"
                    />
                    <span className="text-xs text-muted-foreground">
                      {smsFieldLocked
                        ? "Activa alertas SMS para habilitar este número y proteger la configuración sensible del canal."
                        : "Registra un número con formato internacional para respaldar avisos urgentes del equipo."}
                    </span>
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personalización Visual</h2>
                <div className="mt-4 space-y-3">
                  <a href="/configuracion/embudo" className="flex items-center justify-between rounded-xl border bg-background p-3 text-sm transition hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Kanban className="h-4 w-4 text-primary" />
                      <span>Personalizar Embudo</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                  <a href="/configuracion/etiquetas" className="flex items-center justify-between rounded-xl border bg-background p-3 text-sm transition hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Tag className="h-4 w-4 text-primary" />
                      <span>Gestor de Etiquetas</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                  <a href="/configuracion/canales" className="flex items-center justify-between rounded-xl border bg-background p-3 text-sm transition hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span>Gestor de Canales</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              </section>

              <section className="rounded-2xl border p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notas operativas</h2>
                <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Permisos reales por rol</p>
                        <p className="mt-2">
                          La gestión del equipo ya usa restricciones reales del sistema: un administrador no puede tocar superadministradores y nadie puede cambiar su propio rol desde esta pantalla.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Si activas integraciones externas sin credenciales válidas, el CRM conservará el flujo principal y mostrará respaldo interno donde corresponda. Así protegemos la operación del MVP.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-4 border-t pt-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Meta actual: <span className="font-medium text-foreground">{formatCurrency(form.metaIngresosMensual)}</span>
                </p>
                <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
                  <p className="font-medium text-foreground">Resumen antes de guardar</p>
                  {pendingChanges.length === 0 ? (
                    <p className="mt-2 text-muted-foreground">No hay cambios pendientes frente a la configuración actual.</p>
                  ) : (
                    <div className="mt-2 space-y-2 text-muted-foreground">
                      {pendingChanges.map(change => (
                        <p key={change} className="rounded-xl bg-background px-3 py-2">{change}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border bg-background p-4 text-sm">
                  <p className="font-medium text-foreground">Impacto operativo de este guardado</p>
                  {impactCards.length === 0 ? (
                    <p className="mt-2 text-muted-foreground">Todavía no hay impacto operativo nuevo porque no has cambiado metas, reglas ni canales sensibles.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {impactCards.map(card => (
                        <div key={card.title} className="rounded-2xl border bg-muted/20 p-3">
                          <p className="font-medium text-foreground">{card.title}</p>
                          <p className="mt-1 text-muted-foreground">{card.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    El resumen te muestra si este guardado mueve prioridades, agenda o alertas antes de confirmar cambios sensibles.
                  </p>
                </div>
                {sensitiveChanges.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    Estás tocando campos sensibles de operación. Al guardar, el sistema mostrará un diálogo de confirmación con el impacto operativo esperado antes de aplicar los cambios.
                  </div>
                ) : null}
                {latestHistoryEntry ? (
                  <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Último cambio confirmado</p>
                    <p className="mt-2">{latestHistoryEntry.summary}</p>
                    <p className="mt-1 text-xs">
                      {latestHistoryEntry.changedByName} · {new Date(latestHistoryEntry.changedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || pendingSubmit}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateMutation.isPending || pendingSubmit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar configuración
                </button>
                <p className="text-xs text-muted-foreground lg:max-w-sm lg:text-right">
                  Para cambios sensibles (comisiones, meta, integraciones), el sistema mostrará un diálogo de confirmación con el impacto operativo antes de guardar.
                </p>
              </div>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

import { AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Filter,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  isStructuredLeadReason,
  isSystemLeadActivityType,
  leadCreateSchema,
  leadLostReasonOptions,
  leadPausedReasonOptions,
  summarizeLeadActivityTimeline,
  type LeadCreateInput,
  type LeadFiltersInput,
  type LeadUpdateInput,
} from "../../../shared/leadSchemas";
import {
  computeLeadMetrics,
  defaultBusinessSettings,
  getInitialQualificationChecklist,
  inferLeadPartyKind,
  leadPartyKindLabels,
  leadPartyKindValues,
  leadPriorityLabels,
  leadPriorityValues,
  leadSourceValues,
  leadStatusLabels,
  leadStatusValues,
  leadTravelReasonValues,
  leadTypeLabels,
  normalizeLeadTravelReason,
  type LeadBusinessSettings,
  type LeadPartyKind,
} from "../../../shared/leads";
import { trpc } from "../lib/trpc";

const leadStatusOptions = ["todos", ...leadStatusValues] as const;
const leadPriorityOptions = ["todas", ...leadPriorityValues] as const;
const leadSourceOptions = ["todos", ...leadSourceValues] as const;
const leadTypeOptions = ["todos", ...leadTravelReasonValues] as const;
const leadSortByOptions: Array<{ value: LeadFiltersInput["sortBy"]; label: string }> = [
  { value: "updatedAt", label: "Última actividad" },
  { value: "fechaVisita", label: "Fecha de visita" },
  { value: "valorTotal", label: "Valor potencial" },
  { value: "scoreTotal", label: "Puntaje" },
];
const leadSortOrderOptions: Array<{ value: LeadFiltersInput["sortOrder"]; label: string }> = [
  { value: "desc", label: "Mayor a menor" },
  { value: "asc", label: "Menor a mayor" },
];

type LeadFormInput = LeadCreateInput & Pick<LeadUpdateInput, "estadoLead" | "fechaIngresoLead" | "ultimaGestion">;

const leadSourceLabels: Record<string, string> = {
  otro: "Otro",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  referidos: "Referidos",
  web: "Web",
  llamada: "Llamada",
};

const pipelineGuide = [
  { status: "nuevo", action: "Responder rápido", description: "Entró una oportunidad nueva y lo urgente es validar interés, datos básicos y responsable." },
  { status: "contactado", action: "Confirmar necesidad", description: "Ya hubo primer contacto. Ahora conviene entender fecha, motivo de viaje y presupuesto." },
  { status: "calificado", action: "Preparar propuesta", description: "La oportunidad sí vale la pena. Reúne contexto comercial y deja lista la cotización." },
  { status: "propuesta", action: "Dar seguimiento", description: "La propuesta ya salió. El foco pasa a resolver dudas, objeciones y próximos pasos." },
  { status: "negociacion", action: "Cerrar o destrabar", description: "La oportunidad sigue activa. Registra acuerdos, descuentos y fecha compromiso para cierre." },
  { status: "ganado", action: "Entregar y cobrar", description: "Se cerró la venta. Conserva trazabilidad, agenda y valor final de la oportunidad." },
] as const;

const operatorProfiles = [
  {
    role: "Captura rápida",
    title: "Registrar y agendar en pocos pasos",
    summary: "Úsalo cuando entra una oportunidad nueva y necesitas dejarla lista para que el equipo no pierda tiempo en la primera respuesta.",
    checklist: ["Contacto principal", "Persona o empresa", "Motivo de viaje y fecha", "Próxima acción con responsable"],
  },
  {
    role: "Seguimiento y cierre",
    title: "Mover la oportunidad sin dejar cabos sueltos",
    summary: "Úsalo cuando la oportunidad ya está viva y necesitas claridad sobre etapa, objeciones, valor y fecha compromiso.",
    checklist: ["Etapa actual", "Motivo si se pausa o se pierde", "Valor y prioridad", "Siguiente paso con fecha límite"],
  },
] as const;

const commercialGlossary = [
  { term: "Oportunidad", definition: "Registro comercial completo con contacto, empresa, valor y etapa actual del proceso." },
  { term: "Próxima acción", definition: "Siguiente movimiento concreto que el equipo debe ejecutar para no enfriar la oportunidad." },
  { term: "Fecha compromiso", definition: "Límite visible para resolver seguimiento, propuesta o cierre." },
  { term: "Etapa", definition: "Momento del proceso comercial que define qué hacer ahora y qué medir después." },
] as const;

function formatCurrency(value: number | null | undefined) {
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

function toDatetimeLocalValue(value: number | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return isNaN(time) ? null : time;
}

function priorityBadge(priority: string) {
  if (priority === "rojo") return "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200";
  if (priority === "amarillo") return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100";
  if (priority === "verde") return "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200";
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

function settingsToBusinessSettings(settings?: Partial<LeadBusinessSettings> | null): LeadBusinessSettings {
  return {
    precioMultiple: settings?.precioMultiple ?? defaultBusinessSettings.precioMultiple,
    precioJunior: settings?.precioJunior ?? defaultBusinessSettings.precioJunior,
    precioSenior: settings?.precioSenior ?? defaultBusinessSettings.precioSenior,
    precioParqueadero: settings?.precioParqueadero ?? defaultBusinessSettings.precioParqueadero,
    ticketPromedioReferencia: settings?.ticketPromedioReferencia ?? defaultBusinessSettings.ticketPromedioReferencia,
    minimoPersonasAmarillo: settings?.minimoPersonasAmarillo ?? defaultBusinessSettings.minimoPersonasAmarillo,
    minimoPersonasRojo: settings?.minimoPersonasRojo ?? defaultBusinessSettings.minimoPersonasRojo,
    minimoValorAmarillo: settings?.minimoValorAmarillo ?? defaultBusinessSettings.minimoValorAmarillo,
    minimoValorRojo: settings?.minimoValorRojo ?? defaultBusinessSettings.minimoValorRojo,
    diasUrgenciaAlta: settings?.diasUrgenciaAlta ?? defaultBusinessSettings.diasUrgenciaAlta,
    horasLeadCaliente: settings?.horasLeadCaliente ?? defaultBusinessSettings.horasLeadCaliente,
    scoreAltoThreshold: settings?.scoreAltoThreshold ?? defaultBusinessSettings.scoreAltoThreshold,
    metaIngresosMensual: settings?.metaIngresosMensual ?? defaultBusinessSettings.metaIngresosMensual,
    comisionPorcentaje: settings?.comisionPorcentaje ?? defaultBusinessSettings.comisionPorcentaje,
  };
}

function buildInitialForm(settings?: Partial<LeadBusinessSettings> | null): LeadFormInput {
  const businessSettings = settingsToBusinessSettings(settings);
  const now = Date.now();
  const tomorrow = now + 24 * 60 * 60 * 1000;

  return {
    nombreCliente: "",
    nombreEmpresa: "",
    ciudad: "",
    telefono: "",
    correo: "",
    fechaVisita: tomorrow,
    motivoVisita: "",
    leadPartyKind: "persona",
    tipoEvento: "social",
    objecionPrincipal: "",
    cantidadMultiple: 0,
    cantidadJunior: 0,
    cantidadSenior: 0,
    cantidadParqueadero: 0,
    precioMultiple: businessSettings.precioMultiple,
    precioJunior: businessSettings.precioJunior,
    precioSenior: businessSettings.precioSenior,
    precioParqueadero: businessSettings.precioParqueadero,
    estadoLead: "nuevo",
    canalOrigen: "whatsapp",
    agenteUserId: null,
    agenteResponsable: "",
    fechaIngresoLead: now,
    fechaLimiteGestion: null,
    ultimaGestion: null,
    proximaAccion: "",
    notasInternas: "",
    motivoPerdido: "",
    motivoPausa: "",
  };
}

function parseLeadFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("lead") ?? "";
}

function syncLeadQueryParam(leadId?: string) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (leadId) {
    url.searchParams.set("lead", leadId);
  } else {
    url.searchParams.delete("lead");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function downloadBase64File(base64: string, fileName: string, mimeType: string) {
  if (typeof window === "undefined") {
    return;
  }

  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export default function LeadsPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.get.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const teamQuery = trpc.settings.team.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [filters, setFilters] = useState<LeadFiltersInput>({
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
  });
  const [selectedLeadId, setSelectedLeadId] = useState<string>(() => parseLeadFromUrl());
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<LeadFormInput>(() => buildInitialForm());
  const [partyKind, setPartyKind] = useState<LeadPartyKind>(() => inferLeadPartyKind(buildInitialForm()));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LeadFormInput, string>>>({});
  const [activityTitle, setActivityTitle] = useState("Seguimiento manual");
  const [activityDescription, setActivityDescription] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  const leadsQuery = trpc.leads.list.useQuery(filters, {
    refetchOnWindowFocus: false,
  });
  const selectedLeadQuery = trpc.leads.byId.useQuery(
    { publicId: selectedLeadId },
    {
      enabled: !!selectedLeadId,
      refetchOnWindowFocus: false,
    },
  );

  const assigneeOptions = useMemo(
    () => (teamQuery.data ?? []).filter(member => member.role !== "guest"),
    [teamQuery.data],
  );

  useEffect(() => {
    if (settingsQuery.data && mode === "create") {
      setForm(current => ({
        ...current,
        precioMultiple: settingsQuery.data.precioMultiple,
        precioJunior: settingsQuery.data.precioJunior,
        precioSenior: settingsQuery.data.precioSenior,
        precioParqueadero: settingsQuery.data.precioParqueadero,
      }));
    }
  }, [mode, settingsQuery.data]);

  useEffect(() => {
    if (selectedLeadQuery.data && mode === "edit") {
      const lead = selectedLeadQuery.data;
      setPartyKind(inferLeadPartyKind(lead));
      setForm({
        nombreCliente: lead.nombreCliente,
        nombreEmpresa: lead.nombreEmpresa ?? "",
        ciudad: lead.ciudad ?? "",
        telefono: lead.telefono,
        correo: lead.correo,
        fechaVisita: lead.fechaVisita,
        motivoVisita: lead.motivoVisita,
        leadPartyKind: inferLeadPartyKind(lead),
        tipoEvento: normalizeLeadTravelReason(lead.tipoEvento),
        objecionPrincipal: lead.objecionPrincipal,
        cantidadMultiple: lead.cantidadMultiple,
        cantidadJunior: lead.cantidadJunior,
        cantidadSenior: lead.cantidadSenior,
        cantidadParqueadero: lead.cantidadParqueadero,
        precioMultiple: lead.precioMultiple,
        precioJunior: lead.precioJunior,
        precioSenior: lead.precioSenior,
        precioParqueadero: lead.precioParqueadero,
        estadoLead: lead.estadoLead,
        canalOrigen: lead.canalOrigen,
        agenteUserId: lead.agenteUserId,
        agenteResponsable: lead.agenteResponsable ?? "",
        fechaIngresoLead: lead.fechaIngresoLead,
        fechaLimiteGestion: lead.fechaLimiteGestion,
        ultimaGestion: lead.ultimaGestion,
        proximaAccion: lead.proximaAccion ?? "",
        notasInternas: lead.notasInternas ?? "",
        motivoPerdido: lead.motivoPerdido ?? "",
        motivoPausa: lead.motivoPausa ?? "",
      });
    }
  }, [mode, selectedLeadQuery.data]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      const stage = params.get("stage");
      const validStage = stage && leadStatusValues.includes(stage as any) ? (stage as LeadStatus) : undefined;
      
      startCreateMode(validStage);
      
      // Limpiar la URL sin recargar para que no se repita la acción al refrescar
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [settingsQuery.data]); // Dependemos de settings para que startCreateMode tenga la data correcta

  const createMutation = trpc.leads.create.useMutation({
    onSuccess: async result => {
      toast.success(`Oportunidad ${result.lead?.publicId ?? "creada"} registrada correctamente.`);
      await Promise.all([utils.leads.dashboard.invalidate(), utils.leads.list.invalidate()]);
      if (result.lead?.publicId) {
        setSelectedLeadId(result.lead.publicId);
        setMode("edit");
        syncLeadQueryParam(result.lead.publicId);
        setFieldErrors({});
      }
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: async result => {
      toast.success(`Oportunidad ${result.lead?.publicId ?? "actualizada"} guardada correctamente.`);
      await Promise.all([
        utils.leads.dashboard.invalidate(),
        utils.leads.list.invalidate(),
        selectedLeadId ? utils.leads.byId.invalidate({ publicId: selectedLeadId }) : Promise.resolve(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const updateStatusMutation = trpc.leads.updateStatus.useMutation({
    onSuccess: async result => {
      toast.success(`Estado de la oportunidad ${result.lead?.publicId ?? "actualizada"} actualizado.`);
      await Promise.all([
        utils.leads.dashboard.invalidate(),
        utils.leads.list.invalidate(),
        selectedLeadId ? utils.leads.byId.invalidate({ publicId: selectedLeadId }) : Promise.resolve(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const addActivityMutation = trpc.leads.addActivity.useMutation({
    onSuccess: async () => {
      toast.success("Actividad registrada correctamente.");
      setActivityDescription("");
      await Promise.all([
        utils.leads.dashboard.invalidate(),
        utils.leads.list.invalidate(),
        selectedLeadId ? utils.leads.byId.invalidate({ publicId: selectedLeadId }) : Promise.resolve(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const automationMutation = trpc.leads.runAutomation.useMutation({
    onSuccess: async () => {
      toast.success("Automatización ejecutada con la configuración actual.");
      await Promise.all([
        utils.leads.dashboard.invalidate(),
        utils.leads.list.invalidate(),
        selectedLeadId ? utils.leads.byId.invalidate({ publicId: selectedLeadId }) : Promise.resolve(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const exportSpreadsheetMutation = trpc.leads.exportSpreadsheet.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.fileName, result.mimeType);
      toast.success(`Excel generado con ${result.rowCount} registros.`);
    },
    onError: error => toast.error(error.message),
  });

  const pricingPreview = useMemo(() => {
    const totalPersonas = form.cantidadMultiple + form.cantidadJunior + form.cantidadSenior;
    const subtotalMultiple = form.cantidadMultiple * form.precioMultiple;
    const subtotalJunior = form.cantidadJunior * form.precioJunior;
    const subtotalSenior = form.cantidadSenior * form.precioSenior;
    const subtotalParqueadero = form.cantidadParqueadero * form.precioParqueadero;
    const valorTotal = subtotalMultiple + subtotalJunior + subtotalSenior + subtotalParqueadero;
    const ticketPromedio = totalPersonas > 0 ? Math.round(valorTotal / totalPersonas) : 0;
    return {
      totalPersonas,
      subtotalMultiple,
      subtotalJunior,
      subtotalSenior,
      subtotalParqueadero,
      valorTotal,
      ticketPromedio,
    };
  }, [form]);

  const leadRows = leadsQuery.data ?? [];
  const selectedLead = selectedLeadQuery.data;
  const selectedStageGuide = selectedLead ? pipelineGuide.find(stage => stage.status === selectedLead.estadoLead) ?? null : null;
  const activities = Array.isArray(selectedLead?.activities) ? selectedLead.activities : [];
  const activityTimelineSummary = useMemo(() => summarizeLeadActivityTimeline(activities), [activities]);
  const latestSensitiveChange = useMemo(
    () => activities.find(activity => activity.activityType === "sensitive_fields_changed") ?? null,
    [activities],
  );
  const businessSettings = useMemo(() => settingsToBusinessSettings(settingsQuery.data), [settingsQuery.data]);
  const formQualificationPreview = useMemo(() => {
    const totalUnidadesCotizadas = form.cantidadMultiple + form.cantidadJunior + form.cantidadSenior + form.cantidadParqueadero;
    const metrics = computeLeadMetrics({
      cantidadMultiple: form.cantidadMultiple,
      cantidadJunior: form.cantidadJunior,
      cantidadSenior: form.cantidadSenior,
      cantidadParqueadero: form.cantidadParqueadero,
      precioMultiple: form.precioMultiple,
      precioJunior: form.precioJunior,
      precioSenior: form.precioSenior,
      precioParqueadero: form.precioParqueadero,
      fechaVisita: form.fechaVisita,
      fechaIngresoLead: form.fechaIngresoLead ?? Date.now(),
      ultimaGestion: form.ultimaGestion,
      ahora: form.fechaIngresoLead ?? Date.now(),
      scoreAltoThreshold: businessSettings.scoreAltoThreshold,
      minimoPersonasAmarillo: businessSettings.minimoPersonasAmarillo,
      minimoPersonasRojo: businessSettings.minimoPersonasRojo,
      minimoValorAmarillo: businessSettings.minimoValorAmarillo,
      minimoValorRojo: businessSettings.minimoValorRojo,
    });

    const qualificationChecklist = getInitialQualificationChecklist({
      nombreCliente: form.nombreCliente,
      telefono: form.telefono,
      correo: form.correo,
      fechaVisita: form.fechaVisita,
      motivoVisita: form.motivoVisita,
      objecionPrincipal: form.objecionPrincipal,
      cantidadMultiple: form.cantidadMultiple,
      cantidadJunior: form.cantidadJunior,
      cantidadSenior: form.cantidadSenior,
      cantidadParqueadero: form.cantidadParqueadero,
      precioMultiple: form.precioMultiple,
      precioJunior: form.precioJunior,
      precioSenior: form.precioSenior,
      precioParqueadero: form.precioParqueadero,
    });

    const checklist = [
      ...qualificationChecklist.items.map(item => ({
        label: item.label,
        ready: item.complete,
        description: item.description,
      })),
      {
        label: "Próximo paso definido",
        ready: (form.proximaAccion ?? "").trim().length > 0,
        description: (form.proximaAccion ?? "").trim().length > 0
          ? "Ya hay una siguiente acción concreta para mover la oportunidad."
          : "Define la próxima acción para que la oportunidad no quede sin seguimiento.",
      },
    ] as const;

    return {
      metrics,
      checklist,
      totalUnidadesCotizadas,
      completedItems: checklist.filter(item => item.ready).length,
      readyToSave: qualificationChecklist.ready && (form.proximaAccion ?? "").trim().length > 0,
      qualificationChecklist,
    };
  }, [businessSettings, form]);
  const selectedLeadPriorityRules = useMemo(() => {
    if (!selectedLead) {
      return [] as string[];
    }

    return computeLeadMetrics({
      cantidadMultiple: selectedLead.cantidadMultiple,
      cantidadJunior: selectedLead.cantidadJunior,
      cantidadSenior: selectedLead.cantidadSenior,
      cantidadParqueadero: selectedLead.cantidadParqueadero,
      precioMultiple: selectedLead.precioMultiple,
      precioJunior: selectedLead.precioJunior,
      precioSenior: selectedLead.precioSenior,
      precioParqueadero: selectedLead.precioParqueadero,
      fechaVisita: selectedLead.fechaVisita,
      ultimaGestion: selectedLead.ultimaGestion,
      fechaIngresoLead: selectedLead.fechaIngresoLead,
      ahora: selectedLead.ultimaGestion ?? selectedLead.fechaIngresoLead ?? Date.now(),
      scoreAltoThreshold: businessSettings.scoreAltoThreshold,
      minimoPersonasAmarillo: businessSettings.minimoPersonasAmarillo,
      minimoPersonasRojo: businessSettings.minimoPersonasRojo,
      minimoValorAmarillo: businessSettings.minimoValorAmarillo,
      minimoValorRojo: businessSettings.minimoValorRojo,
    }).reglasAplicadas;
  }, [businessSettings, selectedLead]);
  const formDisabled = createMutation.isPending || updateMutation.isPending;

  function updateField<K extends keyof LeadCreateInput>(key: K, value: LeadCreateInput[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => (current[key] ? { ...current, [key]: undefined } : current));
  }

  function handleAssigneeChange(nextValue: string) {
    const selectedAssignee = assigneeOptions.find(member => member.id === Number(nextValue));
    updateField("agenteUserId", nextValue ? Number(nextValue) : null);
    updateField("agenteResponsable", selectedAssignee?.name ?? "");
  }

  function startCreateMode(initialStage?: LeadStatus) {
    const initialForm = buildInitialForm(settingsQuery.data);
    if (initialStage) {
      initialForm.estadoLead = initialStage;
    }
    setMode("create");
    setSelectedLeadId("");
    setPartyKind(inferLeadPartyKind(initialForm));
    setForm(initialForm);
    setFieldErrors({});
    syncLeadQueryParam();
    setDetailPanelOpen(true);
    setTimeout(() => {
      const formEl = document.getElementById("lead-editor-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
        const firstInput = formEl.querySelector("input") as HTMLElement;
        if (firstInput) firstInput.focus();
      }
    }, 50);
  }

  function startEditMode(leadId: string) {
    setSelectedLeadId(leadId);
    setMode("edit");
    setFieldErrors({});
    syncLeadQueryParam(leadId);
    setDetailPanelOpen(true);
  }

  function validateForm() {
    const parsed = leadCreateSchema.safeParse(form);
    const nextErrors: Partial<Record<keyof LeadFormInput, string>> = {};

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors as Partial<Record<keyof LeadFormInput, string[]>>;
      for (const [key, value] of Object.entries(flattened) as Array<[keyof LeadFormInput, string[] | undefined]>) {
        if (value?.[0]) {
          nextErrors[key] = value[0];
        }
      }
    }

    const totalUnidades = form.cantidadMultiple + form.cantidadJunior + form.cantidadSenior + form.cantidadParqueadero;
    if (totalUnidades <= 0) {
      nextErrors.cantidadMultiple = "Debes registrar al menos una unidad para valorar la oportunidad.";
    }

    if (partyKind === "empresa" && !(form.nombreEmpresa ?? "").trim()) {
      nextErrors.nombreEmpresa = "Si eliges empresa, debes registrar el nombre de la empresa o cuenta.";
    }

    if (form.estadoLead === "perdido" && !isStructuredLeadReason(form.motivoPerdido, leadLostReasonOptions)) {
      nextErrors.motivoPerdido = "Debes seleccionar un motivo de pérdida del catálogo.";
    }

    if (form.estadoLead === "pausado" && !isStructuredLeadReason(form.motivoPausa, leadPausedReasonOptions)) {
      nextErrors.motivoPausa = "Debes seleccionar un motivo de pausa del catálogo.";
    }

    setFieldErrors(nextErrors);
    
    const errorKeys = Object.keys(nextErrors) as Array<keyof LeadFormInput>;
    if (errorKeys.length > 0) {
      const firstKey = errorKeys[0];
      const errorMessage = nextErrors[firstKey];
      return `Por favor revisa el campo "${firstKey}": ${errorMessage}`;
    }
    
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const normalizedForm: LeadFormInput = {
      ...form,
      nombreEmpresa: partyKind === "persona" ? "" : form.nombreEmpresa,
      tipoEvento: normalizeLeadTravelReason(form.tipoEvento),
    };

    if (mode === "edit" && selectedLeadId) {
      const payload: LeadUpdateInput = {
        ...normalizedForm,
        publicId: selectedLeadId,
      };
      await updateMutation.mutateAsync(payload);
      return;
    }

    const { estadoLead: _estadoLead, fechaIngresoLead: _fechaIngresoLead, ultimaGestion: _ultimaGestion, ...createPayload } = normalizedForm;
    await createMutation.mutateAsync(createPayload satisfies LeadCreateInput);
  }

  async function handleQuickStatus(status: (typeof leadStatusValues)[number]) {
    if (!selectedLeadId || !selectedLead) return;

    if (status === "perdido" && !isStructuredLeadReason(selectedLead.motivoPerdido, leadLostReasonOptions)) {
      toast.error("Antes de marcar como perdido, selecciona un motivo de pérdida del catálogo en el formulario.");
      setMode("edit");
      return;
    }

    if (status === "pausado" && !isStructuredLeadReason(selectedLead.motivoPausa, leadPausedReasonOptions)) {
      toast.error("Antes de pausar, selecciona un motivo de pausa del catálogo en el formulario.");
      setMode("edit");
      return;
    }

    await updateStatusMutation.mutateAsync({
      publicId: selectedLeadId,
      estadoLead: status,
      proximaAccion: selectedLead.proximaAccion,
      notasInternas: selectedLead.notasInternas,
      fechaLimiteGestion: selectedLead.fechaLimiteGestion,
      ultimaGestion: Date.now(),
      motivoPerdido: selectedLead.motivoPerdido,
      motivoPausa: selectedLead.motivoPausa,
    });
  }

  async function handleAddActivity() {
    if (!selectedLeadId) return;
    if (!activityTitle.trim()) {
      toast.error("Debes indicar un título para la actividad.");
      return;
    }

    await addActivityMutation.mutateAsync({
      publicId: selectedLeadId,
      title: activityTitle,
      description: activityDescription,
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.02fr_1.18fr]">
      <div className="space-y-6">
        <section className="rounded-[24px] border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Operación comercial diaria</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Registra oportunidades, cotiza rápido y deja claro cuál es el próximo paso para que ninguna se enfríe.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => exportSpreadsheetMutation.mutate()}
                disabled={exportSpreadsheetMutation.isPending || leadRows.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportSpreadsheetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Excel
              </button>
              <button
                type="button"
                onClick={startCreateMode}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                Nueva oportunidad
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed bg-primary/5 p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Ruta comercial sugerida</p>
                <h2 className="mt-1 text-base font-semibold">Qué significa cada etapa del proceso comercial</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Este resumen está pensado para que cualquier usuario entienda qué hacer después con una oportunidad sin depender de capacitación técnica.
                </p>
              </div>
              <p className="text-sm text-muted-foreground lg:max-w-sm">
                Si una oportunidad queda pausada o perdida, registra el motivo. Si sigue activa, usa la próxima acción y la fecha límite para no dejarla enfriar.
              </p>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              {pipelineGuide.map(stage => (
                <article key={stage.status} className="rounded-2xl border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{leadStatusLabels[stage.status]}</span>
                    <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{stage.action}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{stage.description}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {operatorProfiles.map(profile => (
                <article key={profile.role} className="rounded-2xl border bg-background px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{profile.role}</p>
                  <h3 className="mt-2 text-sm font-semibold">{profile.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{profile.summary}</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {profile.checklist.map(item => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Glosario comercial corto</p>
                  <h3 className="mt-1 text-sm font-semibold">Mismo lenguaje para captura, seguimiento y cierre</h3>
                </div>
                <p className="text-xs text-muted-foreground">Mantiene el mismo significado en portada, listado, detalle y exportación.</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {commercialGlossary.map(item => (
                  <article key={item.term} className="rounded-2xl border bg-muted/20 px-3 py-3">
                    <p className="text-sm font-semibold">{item.term}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.definition}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setFiltersExpanded(v => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border bg-muted/20 px-4 py-3 text-sm font-medium transition hover:bg-muted/30 xl:hidden"
            >
              <span className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros de búsqueda</span>
              {filtersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          <div className={`mt-3 grid gap-3 rounded-2xl border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-4 ${filtersExpanded ? "block" : "hidden xl:grid"}`}>
            <label className="xl:col-span-2">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Search className="h-3.5 w-3.5" /> Buscar
              </span>
              <input
                value={filters.query}
                onChange={event => setFilters(current => ({ ...current, query: event.target.value }))}
                placeholder="Busca por cliente, empresa, correo, teléfono o ID CRM"
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Ciudad</span>
              <input
                value={filters.ciudad}
                onChange={event => setFilters(current => ({ ...current, ciudad: event.target.value }))}
                placeholder="Filtrar por ciudad"
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> Estado
              </span>
              <select
                value={filters.estadoLead}
                onChange={event => setFilters(current => ({ ...current, estadoLead: event.target.value as LeadFiltersInput["estadoLead"] }))}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                {leadStatusOptions.map(option => (
                  <option key={option} value={option}>
                    {option === "todos" ? "Todos" : leadStatusLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Prioridad</span>
              <select
                value={filters.prioridad}
                onChange={event => setFilters(current => ({ ...current, prioridad: event.target.value as LeadFiltersInput["prioridad"] }))}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                {leadPriorityOptions.map(option => (
                  <option key={option} value={option}>
                    {option === "todas" ? "Todas" : leadPriorityLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Canal</span>
              <select
                value={filters.canalOrigen}
                onChange={event => setFilters(current => ({ ...current, canalOrigen: event.target.value as LeadFiltersInput["canalOrigen"] }))}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                {leadSourceOptions.map(option => (
                  <option key={option} value={option}>
                    {option === "todos" ? "Todos" : leadSourceLabels[option] ?? option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo de viaje</span>
              <select
                value={filters.tipoEvento}
                onChange={event => setFilters(current => ({ ...current, tipoEvento: event.target.value as LeadFiltersInput["tipoEvento"] }))}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                {leadTypeOptions.map(option => (
                  <option key={option} value={option}>
                    {option === "todos" ? "Todos" : leadTypeLabels[option] ?? option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Responsable</span>
              <select
                value={filters.agenteUserId === "todos" ? "todos" : String(filters.agenteUserId)}
                onChange={event =>
                  setFilters(current => ({
                    ...current,
                    agenteUserId: event.target.value === "todos" ? "todos" : Number(event.target.value),
                  }))
                }
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                <option value="todos">Todos</option>
                {assigneeOptions.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordenar por</span>
              <select
                value={filters.sortBy}
                onChange={event => setFilters(current => ({ ...current, sortBy: event.target.value as LeadFiltersInput["sortBy"] }))}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                {leadSortByOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Sentido</span>
              <select
                value={filters.sortOrder}
                onChange={event => setFilters(current => ({ ...current, sortOrder: event.target.value as LeadFiltersInput["sortOrder"] }))}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
              >
                {leadSortOrderOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 text-sm md:col-span-2 xl:col-span-2 xl:hidden"><button type="button" onClick={() => setFiltersExpanded(false)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition hover:bg-muted xl:hidden"><X className="h-4 w-4" /> Cerrar filtros</button></div>
            <div className="grid gap-2 text-sm md:col-span-2 xl:col-span-2">
              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-3">
                <input
                  type="checkbox"
                  checked={filters.soloAlertas}
                  onChange={event => setFilters(current => ({ ...current, soloAlertas: event.target.checked }))}
                />
                Solo pendientes
              </label>
              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-3">
                <input
                  type="checkbox"
                  checked={filters.assignedToMe}
                  onChange={event => setFilters(current => ({ ...current, assignedToMe: event.target.checked }))}
                />
                Mis oportunidades
              </label>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border">
            <div className="hidden grid-cols-[1.45fr_0.8fr_1fr_0.95fr_0.7fr_0.8fr] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">             <span>Oportunidad</span>
              <span>Ciudad</span>
              <span>Próximo paso</span>
              <span>Responsable</span>
              <span>Prioridad</span>
              <span className="text-right">Valor</span>
            </div>
            <div className="divide-y bg-card">
              {leadsQuery.isLoading ? (
                <div className="flex items-center gap-3 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando embudo comercial...
                </div>
              ) : leadsQuery.isError ? (
                <div className="px-4 py-10 text-sm text-destructive">
                  No fue posible cargar el listado de oportunidades. Intenta nuevamente.
                </div>
              ) : leadRows.length === 0 ? (
                <div className="px-4 py-10 text-sm text-muted-foreground">No hay oportunidades que coincidan con los filtros actuales.</div>
              ) : (
                leadRows.map(lead => (
                  <button
                    key={lead.publicId}
                    type="button"
                    onClick={() => startEditMode(lead.publicId)}
                    className={`grid w-full grid-cols-[1fr_auto] gap-2 px-4 py-3 text-left text-sm transition hover:bg-muted/30 sm:grid-cols-[1.45fr_0.8fr_1fr_0.95fr_0.7fr_0.8fr] sm:gap-3 ${selectedLeadId === lead.publicId ? "bg-muted/40" : ""}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{lead.nombreCliente}</p>
                        {lead.alertPending ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        ID CRM {lead.publicId} · {inferLeadPartyKind(lead) === "empresa" ? lead.nombreEmpresa || "Empresa sin nombre" : "Persona"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground sm:hidden">{lead.ciudad || "Sin ciudad"} · {leadStatusLabels[lead.estadoLead]}</p>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p className="truncate">{lead.ciudad || "Sin ciudad"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {leadSourceLabels[lead.canalOrigen] ?? lead.canalOrigen} · {leadTypeLabels[normalizeLeadTravelReason(lead.tipoEvento)] ?? lead.tipoEvento}
                      </p>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p className="truncate">{lead.proximaAccion || "Sin próxima acción"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {leadStatusLabels[lead.estadoLead]} · {formatDateTime(lead.fechaLimiteGestion ?? lead.fechaVisita)}
                      </p>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p className="truncate font-medium">{lead.agenteResponsable || "Sin asignar"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.ultimaGestion ? `Última gestión ${formatDateTime(lead.ultimaGestion)}` : "Sin gestión registrada"}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${priorityBadge(lead.prioridad)}`}>
                        {leadPriorityLabels[lead.prioridad]}
                      </span>
                        <p className="mt-2 text-xs text-muted-foreground">Puntaje {lead.scoreTotal}</p>

                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(lead.valorTotal)}</p>
                      <p className="hidden text-xs text-muted-foreground sm:block">Visita {formatDateTime(lead.fechaVisita)}</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium sm:hidden ${priorityBadge(lead.prioridad)}`}>
                        {leadPriorityLabels[lead.prioridad]}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Resumen comercial</h2>
              <p className="text-sm text-muted-foreground">Revisa valor estimado, ticket y comisión antes de guardar o actualizar la oportunidad.</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-right text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Comisión estimada</p>
              <p className="font-semibold">{formatCurrency((pricingPreview.valorTotal * businessSettings.comisionPorcentaje) / 100)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Asistentes", pricingPreview.totalPersonas.toString()],
              ["Múltiple", formatCurrency(pricingPreview.subtotalMultiple)],
              ["Junior", formatCurrency(pricingPreview.subtotalJunior)],
              ["Senior", formatCurrency(pricingPreview.subtotalSenior)],
              ["Parqueadero", formatCurrency(pricingPreview.subtotalParqueadero)],
              ["Valor total", formatCurrency(pricingPreview.valorTotal)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className={`space-y-6 ${detailPanelOpen ? "block" : "hidden xl:block"}`}>
        <section className="rounded-[24px] border bg-card p-5 shadow-sm">
          <div className="mb-4 xl:hidden">
            <button
              type="button"
              onClick={() => setDetailPanelOpen(false)}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              <X className="h-4 w-4" /> Volver al listado
            </button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Resumen comercial</h2>
              <p className="text-sm text-muted-foreground">Consulta contacto, siguiente paso, valor, prioridad e historial de la oportunidad seleccionada desde un solo lugar.</p>
            </div>
            {selectedLeadId ? (
              <button
                type="button"
                onClick={() => automationMutation.mutate({ publicId: selectedLeadId })}
                disabled={automationMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {automationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Actualizar alertas y agenda
              </button>
            ) : null}
          </div>

          <div className="mt-5 rounded-2xl border bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">ID único CRM</p>
            <p className="mt-1 text-sm font-semibold tracking-wide text-foreground">
              {selectedLeadQuery.data?.publicId ?? "Se asigna automáticamente al crear el registro"}
            </p>
          </div>

          <form id="lead-editor-form" className="mt-5 space-y-5" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-dashed bg-primary/5 p-4 text-sm">
              <p className="font-medium text-foreground">Cómo usar este formulario</p>
              <p className="mt-1 text-muted-foreground">
                Primero captura contacto y contexto, luego arma la cotización y termina dejando claro el responsable, el próximo paso y la fecha compromiso.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">1. Contacto y oportunidad</p>
                <p className="mt-1 text-sm text-muted-foreground">Primero registra a la persona contacto, luego define si la oportunidad es de persona o empresa y finalmente completa el contexto comercial.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.05fr_1.05fr_0.9fr]">
                <div className="rounded-2xl border bg-background p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Bloque de contacto</p>
                    <p className="mt-1 text-sm text-muted-foreground">Datos directos de la persona que atiende el proceso comercial.</p>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Contacto principal</span>
                      <input
                        value={form.nombreCliente}
                        onChange={event => updateField("nombreCliente", event.target.value)}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        placeholder="Nombre completo"
                      />
                      {fieldErrors.nombreCliente ? <span className="text-xs text-destructive">{fieldErrors.nombreCliente}</span> : null}
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Teléfono</span>
                      <input
                        value={form.telefono}
                        onChange={event => updateField("telefono", event.target.value)}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        placeholder="3001234567"
                      />
                      {fieldErrors.telefono ? <span className="text-xs text-destructive">{fieldErrors.telefono}</span> : null}
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Correo</span>
                      <input
                        type="email"
                        value={form.correo}
                        onChange={event => updateField("correo", event.target.value)}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        placeholder="cliente@empresa.com"
                      />
                      {fieldErrors.correo ? <span className="text-xs text-destructive">{fieldErrors.correo}</span> : null}
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Clasificación comercial</p>
                    <p className="mt-1 text-sm text-muted-foreground">Define si la oportunidad se atiende como persona natural o como empresa para ordenar la operación.</p>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Tipo de registro</span>
                      <select
                        value={partyKind}
                        onChange={event => {
                          const nextKind = event.target.value as LeadPartyKind;
                          setPartyKind(nextKind);
                          if (nextKind === "persona") {
                            updateField("nombreEmpresa", "");
                          }
                        }}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                      >
                        {leadPartyKindValues.map(option => (
                          <option key={option} value={option}>
                            {leadPartyKindLabels[option]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {partyKind === "empresa" ? (
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Empresa</span>
                        <input
                          value={form.nombreEmpresa ?? ""}
                          onChange={event => updateField("nombreEmpresa", event.target.value)}
                          className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                          placeholder="Nombre de la empresa o cuenta"
                        />
                        {fieldErrors.nombreEmpresa ? <span className="text-xs text-destructive">{fieldErrors.nombreEmpresa}</span> : null}
                      </label>
                    ) : (
                      <div className="rounded-2xl border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                        El registro se tratará como persona. El nombre de empresa quedará vacío para mantener la segmentación limpia.
                      </div>
                    )}
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Ciudad</span>
                      <input
                        value={form.ciudad ?? ""}
                        onChange={event => updateField("ciudad", event.target.value)}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                        placeholder="Ciudad"
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Canal de origen</span>
                      <select
                        value={form.canalOrigen}
                        onChange={event => updateField("canalOrigen", event.target.value as LeadCreateInput["canalOrigen"])}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                      >
                        {leadSourceValues.map(option => (
                          <option key={option} value={option}>
                            {leadSourceLabels[option] ?? option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Contexto de la oportunidad</p>
                    <p className="mt-1 text-sm text-muted-foreground">Datos operativos que ubican el momento comercial de la oportunidad.</p>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Fecha del evento o reunión</span>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocalValue(form.fechaVisita)}
                        onChange={event => updateField("fechaVisita", fromDatetimeLocalValue(event.target.value) ?? Date.now())}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Motivo de viaje</span>
                      <select
                        value={form.tipoEvento}
                        onChange={event => updateField("tipoEvento", event.target.value as LeadCreateInput["tipoEvento"])}
                        className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                      >
                        {leadTravelReasonValues.map(option => (
                          <option key={option} value={option}>
                            {leadTypeLabels[option] ?? option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">2. Necesidad comercial</p>
                <p className="mt-1 text-sm text-muted-foreground">Deja claro qué quiere cotizar el cliente y qué está frenando el cierre.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className="font-medium">Qué quiere cotizar</span>
                <textarea
                  value={form.motivoVisita}
                  onChange={event => updateField("motivoVisita", event.target.value)}
                  className="min-h-24 rounded-xl border bg-background px-3 py-3 outline-none transition focus:border-primary"
                  placeholder="Resume el evento, servicio o necesidad comercial que quiere cotizar"
                />
                {fieldErrors.motivoVisita ? <span className="text-xs text-destructive">{fieldErrors.motivoVisita}</span> : null}
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className="font-medium">Qué está frenando el cierre</span>
                <textarea
                  value={form.objecionPrincipal}
                  onChange={event => updateField("objecionPrincipal", event.target.value)}
                  className="min-h-24 rounded-xl border bg-background px-3 py-3 outline-none transition focus:border-primary"
                  placeholder="Precio, tiempos, aprobaciones, competencia o cualquier factor que hoy frene el cierre"
                />
                {fieldErrors.objecionPrincipal ? <span className="text-xs text-destructive">{fieldErrors.objecionPrincipal}</span> : null}
              </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">3. Cotización inicial</p>
                <p className="mt-1 text-sm text-muted-foreground">Completa cantidades y precios para estimar valor, ticket y comisión de la oportunidad.</p>
              </div>
              <div className="rounded-2xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Cotización inicial
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                {[
                  ["cantidadMultiple", "Cantidad múltiple"],
                  ["cantidadJunior", "Cantidad junior"],
                  ["cantidadSenior", "Cantidad senior"],
                  ["cantidadParqueadero", "Parqueaderos"],
                ].map(([key, label]) => (
                  <label key={key} className="grid gap-2 text-sm">
                    <span className="font-medium">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={Number(form[key as keyof LeadCreateInput] ?? 0)}
                      onChange={event => updateField(key as keyof LeadCreateInput, Number(event.target.value) as never)}
                      className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                    />
                  </label>
                ))}
                {[
                  ["precioMultiple", "Precio múltiple"],
                  ["precioJunior", "Precio junior"],
                  ["precioSenior", "Precio senior"],
                  ["precioParqueadero", "Precio parqueadero"],
                ].map(([key, label]) => (
                  <label key={key} className="grid gap-2 text-sm">
                    <span className="font-medium">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={Number(form[key as keyof LeadCreateInput] ?? 0)}
                      onChange={event => updateField(key as keyof LeadCreateInput, Number(event.target.value) as never)}
                      className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                    />
                  </label>
                ))}
              </div>
              {fieldErrors.cantidadMultiple ? <p className="mt-3 text-xs text-destructive">{fieldErrors.cantidadMultiple}</p> : null}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">4. Puntaje inicial</p>
                <p className="mt-1 text-sm text-muted-foreground">Antes de guardar, revisa con qué fuerza entra la oportunidad: prioridad, puntaje, reglas activas y contexto mínimo para dar seguimiento.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium">Prioridad al guardar</p>
                        <p className="text-xs text-muted-foreground">Se calcula con puntaje, volumen, valor y urgencia usando la configuración activa.</p>

                    </div>
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                        formQualificationPreview.metrics.prioridad === "rojo"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : formQualificationPreview.metrics.prioridad === "amarillo"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : formQualificationPreview.metrics.prioridad === "verde"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-700",
                      ].join(" ")}
                    >
                      {formQualificationPreview.metrics.prioridadLabel} · Puntaje {formQualificationPreview.metrics.scoreTotal} pts
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-muted-foreground">{formQualificationPreview.metrics.explicacionBreve}</p>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Personas</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formQualificationPreview.metrics.totalPersonas}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor potencial</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(formQualificationPreview.metrics.valorTotal)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ticket promedio</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(formQualificationPreview.metrics.ticketPromedio)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background px-4 py-3 text-sm">
                    <p className="font-medium text-foreground">Reglas que explican la prioridad</p>
                    {formQualificationPreview.metrics.reglasAplicadas.length ? (
                      <div className="mt-2 space-y-2 text-muted-foreground">
                        {formQualificationPreview.metrics.reglasAplicadas.map(rule => (
                          <p key={rule}>• {rule}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">Por ahora la prioridad sale directo del puntaje base, sin reglas adicionales.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">Checklist rápido antes de guardar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Completos {formQualificationPreview.completedItems}/{formQualificationPreview.checklist.length}. Úsalo para confirmar si la oportunidad ya tiene lo mínimo para seguimiento real.
                  </p>

                  <div className="mt-4 space-y-2">
                    {formQualificationPreview.checklist.map(item => (
                      <div key={item.label} className="flex items-start justify-between gap-3 rounded-2xl border bg-background px-3 py-3 text-sm">
                        <div>
                          <p className="text-foreground">{item.label}</p>
                          {item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
                        </div>
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                          ].join(" ")}
                        >
                          {item.ready ? "Listo" : "Falta"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
                    {formQualificationPreview.readyToSave ? (
                      <p>La oportunidad ya tiene contexto suficiente para arrancar seguimiento con responsable, próximo paso y prioridad explicada.</p>
                    ) : (
                      <p>Puedes guardar ahora, pero la oportunidad quedará con menos contexto para seguimiento y cierre. Completa los puntos marcados en amarillo.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">5. Seguimiento y cierre</p>
                <p className="mt-1 text-sm text-muted-foreground">Asigna responsable, deja el próximo paso y registra la fecha compromiso para no perder el ritmo comercial.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm xl:col-span-1">
                <span className="font-medium">Estado al crear</span>
                <span className="text-foreground">Nuevo</span>
                  <p className="text-xs text-muted-foreground">El sistema registra automáticamente la fecha de ingreso y la primera actividad al guardar la oportunidad.</p>

              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Agente responsable</span>
                <select
                  value={form.agenteUserId ? String(form.agenteUserId) : ""}
                  onChange={event => handleAssigneeChange(event.target.value)}
                  className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                >
                  <option value="">{teamQuery.isLoading ? "Cargando responsables..." : "Asignar automáticamente"}</option>
                  {assigneeOptions.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.roleLabel}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                    Si no eliges un responsable, el sistema mantendrá la asignación automática según permisos y contexto de la oportunidad.

                </span>
              </label>
              <label className="grid gap-2 text-sm xl:col-span-2">
                <span className="font-medium">Próximo paso acordado</span>
                <input
                  value={form.proximaAccion ?? ""}
                  onChange={event => updateField("proximaAccion", event.target.value)}
                  className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                  placeholder="Ejemplo: llamar mañana, enviar propuesta o confirmar visita"
                />
              </label>
              <label className="grid gap-2 text-sm xl:col-span-2">
                <span className="font-medium">Fecha compromiso</span>
                <input
                  type="datetime-local"
                  value={toDatetimeLocalValue(form.fechaLimiteGestion)}
                  onChange={event => updateField("fechaLimiteGestion", fromDatetimeLocalValue(event.target.value))}
                  className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                />
              </label>
              <div className="grid gap-2 rounded-2xl border border-dashed border-border/70 bg-background px-4 py-3 text-sm xl:col-span-2">
                <span className="font-medium">Resumen del flujo</span>
                  <p className="text-muted-foreground">Al guardar, el sistema deja la oportunidad en Nuevo, registra la fecha de ingreso y crea la primera gestión. Después podrás moverla por etapas y registrar avances desde el panel de trabajo.</p>

              </div>
              </div>
            </div>

            {form.estadoLead === "perdido" ? (
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Motivo de pérdida</span>
                <select
                  value={form.motivoPerdido ?? ""}
                  onChange={event => updateField("motivoPerdido", event.target.value)}
                  className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
                >
                  <option value="">Selecciona un motivo</option>
                  {leadLostReasonOptions.map(reason => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Este catálogo estandariza por qué se cayó una oportunidad y mejora el análisis comercial.</p>
                {fieldErrors.motivoPerdido ? <span className="text-xs text-destructive">{fieldErrors.motivoPerdido}</span> : null}
              </label>
            ) : null}

            {form.estadoLead === "pausado" ? (
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Motivo de pausa</span>
                <select
                  value={form.motivoPausa ?? ""}
                  onChange={event => updateField("motivoPausa", event.target.value)}
                  className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary"
                >
                  <option value="">Selecciona un motivo</option>
                  {leadPausedReasonOptions.map(reason => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Usa una razón estandarizada para saber qué oportunidades se pueden retomar y cuáles siguen bloqueadas.</p>
                {fieldErrors.motivoPausa ? <span className="text-xs text-destructive">{fieldErrors.motivoPausa}</span> : null}
              </label>
            ) : null}

            <label className="grid gap-2 text-sm">
              <span className="font-medium">Notas internas</span>
              <textarea
                value={form.notasInternas ?? ""}
                onChange={event => updateField("notasInternas", event.target.value)}
                className="min-h-28 rounded-xl border bg-background px-3 py-3 outline-none transition focus:border-primary"
                placeholder="Anota acuerdos, riesgos y contexto útil para la siguiente gestión"
              />
            </label>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {(["contactado", "propuesta", "ganado"] as const).map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleQuickStatus(status)}
                    disabled={!selectedLeadId || updateStatusMutation.isPending}
                    className="rounded-xl border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Marcar como {leadStatusLabels[status].toLowerCase()}                 </button>
                ))}
              </div>
              <div className="flex gap-2">
                {mode === "edit" ? (
                  <button
                    type="button"
                    onClick={startCreateMode}
                    className="inline-flex h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-medium transition hover:bg-muted"
                  >
                    Cancelar edición
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={formDisabled}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formDisabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {mode === "edit" ? "Guardar cambios" : "Guardar oportunidad"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-[24px] border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Resumen comercial</h2>
              <p className="text-sm text-muted-foreground">Consulta contacto, siguiente paso, valor, prioridad e historial de la oportunidad seleccionada desde un solo lugar.</p>
            </div>
            {selectedLead ? (
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadge(selectedLead.prioridad)}`}>
                  {leadPriorityLabels[selectedLead.prioridad]}
                </span>
                <span className="rounded-full border px-2.5 py-1 text-xs font-medium">{leadStatusLabels[selectedLead.estadoLead]}</span>
              </div>
            ) : null}
          </div>

          {!selectedLeadId ? (
            <div className="mt-5 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              Selecciona una oportunidad del listado o crea una nueva para ver su resumen comercial.
            </div>
          ) : selectedLeadQuery.isLoading ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando panel de la oportunidad...
            </div>
          ) : selectedLead ? (
            <div className="mt-5 space-y-5">
              {selectedStageGuide ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Resumen accionable por etapa</p>
                      <h3 className="mt-1 text-base font-semibold">{leadStatusLabels[selectedLead.estadoLead]}: {selectedStageGuide.action}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{selectedStageGuide.description}</p>
                    </div>
                    <div className="rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground lg:max-w-sm">
                      <p><span className="font-medium text-foreground">Próxima acción:</span> {selectedLead.proximaAccion || "Definir el siguiente paso antes de cerrar el día."}</p>
                      <p className="mt-2"><span className="font-medium text-foreground">Fecha compromiso:</span> {formatDateTime(selectedLead.fechaLimiteGestion)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" /> Responsable
                  </div>
                  <p className="mt-2 text-sm font-semibold">{selectedLead.agenteResponsable || "Sin asignar"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedLead.nombreEmpresa || "Cuenta sin empresa registrada"}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" /> Próxima visita
                  </div>
                  <p className="mt-2 text-sm font-semibold">{formatDateTime(selectedLead.fechaVisita)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Motivo de viaje: {leadTypeLabels[normalizeLeadTravelReason(selectedLead.tipoEvento)] ?? selectedLead.tipoEvento}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" /> Última gestión
                  </div>
                  <p className="mt-2 text-sm font-semibold">{formatDateTime(selectedLead.ultimaGestion)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Próxima acción: {selectedLead.proximaAccion || "Sin definir"}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">Este indicador se actualiza automáticamente cuando el equipo guarda cambios, registra avances o el sistema ejecuta una acción sobre la oportunidad.</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valor total
                  </div>
                  <p className="mt-2 text-sm font-semibold">{formatCurrency(selectedLead.valorTotal)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Prioridad sustentada por {selectedLead.scoreTotal} puntos.</p>

                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border p-4 text-sm">
                  <h3 className="font-semibold">Contacto principal</h3>
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p className="font-medium text-foreground">{selectedLead.contacto?.nombre || selectedLead.nombreCliente}</p>
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {selectedLead.contacto?.telefono || selectedLead.telefono}</p>
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {selectedLead.contacto?.correo || selectedLead.correo}</p>
                  </div>
                </div>
                <div className="rounded-2xl border p-4 text-sm">
                  <h3 className="font-semibold">Clasificación comercial</h3>
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p className="font-medium text-foreground">{leadPartyKindLabels[inferLeadPartyKind(selectedLead)]}</p>
                    <p>{inferLeadPartyKind(selectedLead) === "empresa" ? `Empresa: ${selectedLead.empresa?.nombre || selectedLead.nombreEmpresa || "Empresa sin nombre"}` : "Registro atendido como persona natural."}</p>
                    <p>Ciudad: {selectedLead.empresa?.ciudad || selectedLead.ciudad || "Sin ciudad"}</p>
                    <p>Canal: {leadSourceLabels[selectedLead.canalOrigen] ?? selectedLead.canalOrigen}</p>
                  </div>
                </div>
                <div className="rounded-2xl border p-4 text-sm md:col-span-2 xl:col-span-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="font-semibold">Actualizar oportunidad sin salir de esta vista</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Actualiza responsable, próximo paso, fecha compromiso y notas sin cambiar de pantalla.</p>
                    </div>
                    <button
                      type="submit"
                      form="lead-editor-form"
                      disabled={formDisabled}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {formDisabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Guardar cambios rápidos
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-2">
                      <span className="font-medium">Responsable</span>
                      <select
                        value={form.agenteUserId ? String(form.agenteUserId) : ""}
                        onChange={event => handleAssigneeChange(event.target.value)}
                        disabled={formDisabled}
                        className="h-10 rounded-xl border bg-background px-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">{teamQuery.isLoading ? "Cargando responsables..." : "Asignar automáticamente"}</option>
                        {assigneeOptions.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.name} · {member.roleLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                        <span className="font-medium">Próximo paso</span>

                      <input
                        value={form.proximaAccion ?? ""}
                        onChange={event => updateField("proximaAccion", event.target.value)}
                        disabled={formDisabled}
                        className="h-10 rounded-xl border bg-background px-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Qué debe pasar para acercar el cierre"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="font-medium">Fecha compromiso</span>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocalValue(form.fechaLimiteGestion)}
                        onChange={event => updateField("fechaLimiteGestion", fromDatetimeLocalValue(event.target.value))}
                        disabled={formDisabled}
                        className="h-10 rounded-xl border bg-background px-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="font-medium">Notas internas</span>
                      <textarea
                        value={form.notasInternas ?? ""}
                        onChange={event => updateField("notasInternas", event.target.value)}
                        disabled={formDisabled}
                        className="min-h-24 rounded-xl border bg-background px-3 py-3 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Anota acuerdos, riesgos o contexto para la próxima gestión"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Por qué esta oportunidad tiene esta prioridad</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                          {selectedLead.prioridadExplicacion || `El puntaje actual ubica esta oportunidad en prioridad ${leadPriorityLabels[selectedLead.prioridad].toLowerCase()}.`}


                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border px-2.5 py-1 text-xs font-medium">Base: {leadPriorityLabels[selectedLead.prioridadBase]}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadge(selectedLead.prioridad)}`}>
                      Final: {leadPriorityLabels[selectedLead.prioridad]}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cantidad</p>
                    <p className="mt-1 text-base font-semibold">{selectedLead.scoreCantidad} pts</p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedLead.totalPersonas} personas incluidas en la oportunidad.</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</p>
                    <p className="mt-1 text-base font-semibold">{selectedLead.scoreValorTotal} pts</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(selectedLead.valorTotal)} de valor potencial.</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ticket</p>
                    <p className="mt-1 text-base font-semibold">{selectedLead.scoreTicketPromedio} pts</p>
                    <p className="mt-1 text-xs text-muted-foreground">Promedio estimado por persona: {formatCurrency(selectedLead.ticketPromedio)}.</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Urgencia</p>
                    <p className="mt-1 text-base font-semibold">{selectedLead.scoreUrgencia} pts</p>
                    <p className="mt-1 text-xs text-muted-foreground">Visita programada para {formatDateTime(selectedLead.fechaVisita)}.</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recencia</p>
                    <p className="mt-1 text-base font-semibold">{selectedLead.scoreRecencia} pts</p>
                      <p className="mt-1 text-xs text-muted-foreground">Oportunidad registrada {formatDateTime(selectedLead.fechaIngresoLead)}.</p>

                  </div>
                  <div className="rounded-2xl bg-primary/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Puntaje total</p>
                    <p className="mt-1 text-base font-semibold">{selectedLead.scoreTotal} pts</p>
                      <p className="mt-1 text-xs text-muted-foreground">La prioridad final se define con el puntaje y las reglas operativas vigentes.</p>

                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-dashed p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reglas aplicadas</p>
                  {selectedLeadPriorityRules.length > 0 ? (
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {selectedLeadPriorityRules.map(rule => (
                        <p key={rule} className="rounded-xl bg-muted/30 px-3 py-2">{rule}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">En esta oportunidad no se aplicaron escalados adicionales; la prioridad actual sale directamente del puntaje total calculado.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <h3 className="font-semibold">Registrar gestión</h3>
                <div className="mt-4 grid gap-3">
                  <input
                    value={activityTitle}
                    onChange={event => setActivityTitle(event.target.value)}
                    className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-primary"
                    placeholder="Ejemplo: llamada, visita, propuesta enviada"
                  />
                  <textarea
                    value={activityDescription}
                    onChange={event => setActivityDescription(event.target.value)}
                    className="min-h-24 rounded-xl border bg-background px-3 py-3 outline-none transition focus:border-primary"
                    placeholder="Resume qué pasó, qué se acordó y cuál es el siguiente paso"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddActivity}
                      disabled={addActivityMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {addActivityMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Guardar gestión
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                      <h3 className="font-semibold">Historial de la oportunidad</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Distingue gestiones del equipo y eventos automáticos del sistema para entender qué pasó y cuándo pasó.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">Equipo comercial</span>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Sistema</span>
                  </div>
                </div>
                {activities.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl bg-muted/30 p-3 text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Eventos del sistema</p>
                      <p className="mt-1 text-base font-semibold">{activityTimelineSummary.systemCount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Incluye cambios de estado, automatizaciones, alertas y registros automáticos.</p>
                    </div>
                    <div className="rounded-2xl bg-muted/30 p-3 text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Automatizaciones</p>
                      <p className="mt-1 text-base font-semibold">{activityTimelineSummary.automationCount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Sincronizaciones de agenda y alertas disparadas desde el sistema con la configuración actual.</p>
                    </div>
                    <div className="rounded-2xl bg-muted/30 p-3 text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cambios sensibles</p>
                      <p className="mt-1 text-base font-semibold">{activityTimelineSummary.sensitiveChangesCount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Resume ajustes relevantes como fecha de visita, compromiso, prioridad o valor estimado.</p>
                    </div>
                    <div className="rounded-2xl border border-dashed p-3 text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estado de agenda</p>
                      <p className="mt-1 font-semibold">
                        {selectedLead.calendarSyncStatus === "synced"
                          ? "Sincronizado"
                          : selectedLead.calendarSyncStatus === "error"
                            ? "Con error"
                            : "Inactivo"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedLead.calendarSyncMessage || "Todavía no hay un resultado reciente de sincronización para esta oportunidad."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-dashed p-3 text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Último ajuste sensible</p>
                      <p className="mt-1 font-semibold">{latestSensitiveChange ? formatDateTime(latestSensitiveChange.createdAt) : "Sin cambios sensibles"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{latestSensitiveChange?.description || "Cuando un cambio operativo afecte datos clave, quedará visible aquí para todo el equipo."}</p>
                    </div>
                    <div className="rounded-2xl border border-dashed p-3 text-sm md:col-span-2 xl:col-span-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Señal de alertas</p>
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          {selectedLead.lastAlertAt
                            ? `Última alerta: ${formatDateTime(selectedLead.lastAlertAt)}`
                            : selectedLead.alertPending
                              ? "Pendiente por enviar"
                              : "Sin alerta reciente"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {selectedLead.alertLastChannel
                          ? `Canal usado: ${selectedLead.alertLastChannel}`
                          : selectedLead.alertPending
                            ? "La oportunidad sigue marcada para alertar en la próxima automatización."
                            : "No hay una alerta enviada recientemente para esta oportunidad."}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedLead.alertLastMessage || "Cuando una alerta salga por correo o notificación, aquí quedará el último resultado visible para el equipo."}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  {activities.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Todavía no hay avances registrados para esta oportunidad.
                    </div>
                  ) : (
                    activities.map(activity => {
                      const isSystemActivity = isSystemLeadActivityType(activity.activityType);

                      return (
                        <div key={activity.id} className="rounded-2xl border bg-muted/20 p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{activity.title}</p>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                  isSystemActivity
                                    ? "border-slate-200 bg-slate-100 text-slate-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {isSystemActivity ? "Sistema" : "Equipo"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
                          </div>
                          <p className="mt-2 text-muted-foreground">{activity.description || "Sin descripción adicional."}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              No fue posible recuperar el panel de la oportunidad seleccionada.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

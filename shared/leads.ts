export const appRoleValues = ["guest", "agent", "admin", "superadmin"] as const;

export type AppRole = (typeof appRoleValues)[number];

export const appRoleLabels: Record<AppRole, string> = {
  guest: "Invitado",
  agent: "Agente",
  admin: "Administrador",
  superadmin: "Superadministrador",
};

export const leadStatusValues = [
  "nuevo",
  "contactado",
  "calificado",
  "propuesta",
  "negociacion",
  "seguimiento",
  "cotizado",
  "ganado",
  "perdido",
  "pausado",
] as const;

export type LeadStatus = (typeof leadStatusValues)[number];

export const leadStatusLabels: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  propuesta: "Propuesta enviada",
  negociacion: "Negociación",
  seguimiento: "Seguimiento",
  cotizado: "Cotizado",
  ganado: "Ganado",
  perdido: "Perdido",
  pausado: "Pausado",
};

export const leadPrimaryPipelineValues = [
  "nuevo",
  "contactado",
  "calificado",
  "propuesta",
  "negociacion",
  "ganado",
  "perdido",
  "pausado",
] as const satisfies readonly LeadStatus[];

export const leadPriorityValues = ["gris", "verde", "amarillo", "rojo"] as const;

export type LeadPriority = (typeof leadPriorityValues)[number];

export const calendarSyncStatusValues = ["disabled", "pending", "synced", "error"] as const;

export type CalendarSyncStatus = (typeof calendarSyncStatusValues)[number];

export const leadSourceValues = [
  "whatsapp",
  "instagram",
  "facebook",
  "web",
  "llamada",
  "referido",
  "otro",
] as const;

export type LeadSource = (typeof leadSourceValues)[number];

export const leadSourceLabels: Record<LeadSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  web: "Sitio web",
  llamada: "Llamada",
  referido: "Referido",
  otro: "Otro",
};

export const leadTypeValues = ["corporativo", "social", "experiencia", "reunion", "otro"] as const;

export type LeadType = (typeof leadTypeValues)[number];

export const leadTravelReasonValues = ["social", "corporativo", "experiencia"] as const satisfies readonly LeadType[];

export type LeadTravelReason = (typeof leadTravelReasonValues)[number];

export const leadTypeLabels: Record<LeadType, string> = {
  corporativo: "Empresarial",
  social: "Familiar",
  experiencia: "Educativo",
  reunion: "Empresarial",
  otro: "Familiar",
};

export const leadPartyKindValues = ["persona", "empresa"] as const;

export type LeadPartyKind = (typeof leadPartyKindValues)[number];

export const leadPartyKindLabels: Record<LeadPartyKind, string> = {
  persona: "Persona",
  empresa: "Empresa",
};

export function normalizeLeadTravelReason(value: string | null | undefined): LeadTravelReason {
  if (value === "corporativo" || value === "social" || value === "experiencia") {
    return value;
  }

  if (value === "reunion") {
    return "corporativo";
  }

  return "social";
}

export function inferLeadPartyKind(input: { nombreEmpresa?: string | null; empresaNombre?: string | null }): LeadPartyKind {
  const companyName = (input.empresaNombre ?? input.nombreEmpresa ?? "").trim();
  return companyName ? "empresa" : "persona";
}

export type LeadComputationInput = {
  cantidadMultiple: number;
  cantidadJunior: number;
  cantidadSenior: number;
  cantidadParqueadero: number;
  precioMultiple: number;
  precioJunior: number;
  precioSenior: number;
  precioParqueadero: number;
  fechaVisita?: number | string | Date | null;
  ultimaGestion?: number | string | Date | null;
  fechaIngresoLead?: number | string | Date | null;
  ahora?: number | string | Date;
  scoreAltoThreshold?: number;
  minimoPersonasAmarillo?: number;
  minimoPersonasRojo?: number;
  minimoValorAmarillo?: number;
  minimoValorRojo?: number;
};

export type LeadBusinessSettings = {
  precioMultiple: number;
  precioJunior: number;
  precioSenior: number;
  precioParqueadero: number;
  ticketPromedioReferencia: number;
  minimoPersonasAmarillo: number;
  minimoPersonasRojo: number;
  minimoValorAmarillo: number;
  minimoValorRojo: number;
  diasUrgenciaAlta: number;
  horasLeadCaliente: number;
  scoreAltoThreshold: number;
  metaIngresosMensual: number;
  comisionPorcentaje: number;
};

export const defaultBusinessSettings: LeadBusinessSettings = {
  precioMultiple: 99000,
  precioJunior: 69000,
  precioSenior: 69000,
  precioParqueadero: 8000,
  ticketPromedioReferencia: 500000,
  minimoPersonasAmarillo: 100,
  minimoPersonasRojo: 200,
  minimoValorAmarillo: 20000000,
  minimoValorRojo: 35000000,
  diasUrgenciaAlta: 2,
  horasLeadCaliente: 1,
  scoreAltoThreshold: 65,
  metaIngresosMensual: 50000000,
  comisionPorcentaje: 5,
};

export const leadPriorityLabels: Record<LeadPriority, string> = {
  gris: "Gris",
  verde: "Verde",
  amarillo: "Amarillo",
  rojo: "Rojo",
};

export const leadPriorityColors: Record<LeadPriority, string> = {
  gris: "#6B7280",
  verde: "#16A34A",
  amarillo: "#CA8A04",
  rojo: "#DC2626",
};

const priorityRank: Record<LeadPriority, number> = {
  gris: 0,
  verde: 1,
  amarillo: 2,
  rojo: 3,
};

function toSafeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function toTimestamp(value: number | string | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function floorDaysUntil(fromMs: number, targetMs: number | null): number | null {
  if (!targetMs) {
    return null;
  }

  return Math.max(0, Math.floor((targetMs - fromMs) / (1000 * 60 * 60 * 24)));
}

function floorHoursSince(fromMs: number, targetMs: number | null): number | null {
  if (!targetMs) {
    return null;
  }

  return Math.max(0, Math.floor((fromMs - targetMs) / (1000 * 60 * 60)));
}

export function normalizeLeadStatus(status: LeadStatus): LeadStatus {
  if (status === "cotizado") {
    return "propuesta";
  }

  if (status === "seguimiento") {
    return "negociacion";
  }

  return status;
}

export function scoreByCantidad(totalPersonas: number): number {
  if (totalPersonas >= 1000) return 47;
  if (totalPersonas >= 500) return 45;
  if (totalPersonas >= 200) return 43;
  if (totalPersonas >= 100) return 40;
  if (totalPersonas >= 50) return 35;
  if (totalPersonas >= 30) return 30;
  if (totalPersonas >= 20) return 25;
  if (totalPersonas >= 10) return 20;
  if (totalPersonas >= 6) return 14;
  if (totalPersonas >= 4) return 10;
  if (totalPersonas === 3) return 5;
  if (totalPersonas >= 1) return 3;
  return 0;
}

export function scoreByValorTotal(valorTotal: number): number {
  if (valorTotal >= 50000000) return 40;
  if (valorTotal >= 35000000) return 37;
  if (valorTotal >= 20000000) return 35;
  if (valorTotal >= 10000000) return 33;
  if (valorTotal >= 5000000) return 30;
  if (valorTotal >= 2500000) return 25;
  if (valorTotal >= 1000000) return 20;
  if (valorTotal >= 600000) return 14;
  if (valorTotal >= 400000) return 10;
  if (valorTotal >= 250000) return 5;
  if (valorTotal > 0) return 2;
  return 0;
}

export function scoreByTicketPromedio(ticketPromedio: number): number {
  if (ticketPromedio >= 95000) return 15;
  if (ticketPromedio >= 90000) return 13;
  if (ticketPromedio >= 85000) return 11;
  if (ticketPromedio >= 80000) return 9;
  if (ticketPromedio >= 75000) return 6;
  if (ticketPromedio >= 69000) return 3;
  return 0;
}

export function scoreByUrgencia(diasHastaVisita: number | null): number {
  if (diasHastaVisita === null) return 0;
  if (diasHastaVisita <= 2) return 10;
  if (diasHastaVisita <= 5) return 8;
  if (diasHastaVisita <= 10) return 5;
  if (diasHastaVisita <= 20) return 3;
  return 1;
}

export function scoreByRecencia(horasDesdeIngreso: number | null): number {
  if (horasDesdeIngreso === null) return 1;
  if (horasDesdeIngreso <= 1) return 5;
  if (horasDesdeIngreso <= 6) return 4;
  if (horasDesdeIngreso <= 24) return 3;
  if (horasDesdeIngreso <= 48) return 2;
  return 1;
}

export function priorityFromScore(scoreTotal: number): LeadPriority {
  if (scoreTotal >= 90) return "rojo";
  if (scoreTotal >= 65) return "amarillo";
  if (scoreTotal >= 40) return "verde";
  return "gris";
}

export function raisePriority(priority: LeadPriority): LeadPriority {
  if (priority === "gris") return "verde";
  if (priority === "verde") return "amarillo";
  if (priority === "amarillo") return "rojo";
  return "rojo";
}

export function ensureMinimumPriority(current: LeadPriority, minimum: LeadPriority): LeadPriority {
  return priorityRank[current] >= priorityRank[minimum] ? current : minimum;
}

export function estimateLeadCommission(valorTotal: number, comisionPorcentaje: number) {
  const safeValue = Math.max(0, Math.round(toSafeNumber(valorTotal)));
  const safePercentage = Math.max(0, Math.min(100, toSafeNumber(comisionPorcentaje)));
  return Math.round((safeValue * safePercentage) / 100);
}

export type LeadInitialQualificationChecklistInput = {
  nombreCliente?: string | null;
  telefono?: string | null;
  correo?: string | null;
  fechaVisita?: number | string | Date | null;
  motivoVisita?: string | null;
  objecionPrincipal?: string | null;
  cantidadMultiple?: number | string | null;
  cantidadJunior?: number | string | null;
  cantidadSenior?: number | string | null;
  cantidadParqueadero?: number | string | null;
  precioMultiple?: number | string | null;
  precioJunior?: number | string | null;
  precioSenior?: number | string | null;
  precioParqueadero?: number | string | null;
};

export function getInitialQualificationChecklist(input: LeadInitialQualificationChecklistInput) {
  const nombreCliente = input.nombreCliente?.trim() ?? "";
  const telefono = input.telefono?.trim() ?? "";
  const correo = input.correo?.trim() ?? "";
  const motivoVisita = input.motivoVisita?.trim() ?? "";
  const objecionPrincipal = input.objecionPrincipal?.trim() ?? "";
  const fechaVisitaMs = toTimestamp(input.fechaVisita);

  const cantidadMultiple = Math.max(0, Math.floor(toSafeNumber(input.cantidadMultiple)));
  const cantidadJunior = Math.max(0, Math.floor(toSafeNumber(input.cantidadJunior)));
  const cantidadSenior = Math.max(0, Math.floor(toSafeNumber(input.cantidadSenior)));
  const cantidadParqueadero = Math.max(0, Math.floor(toSafeNumber(input.cantidadParqueadero)));
  const precioMultiple = Math.max(0, Math.round(toSafeNumber(input.precioMultiple)));
  const precioJunior = Math.max(0, Math.round(toSafeNumber(input.precioJunior)));
  const precioSenior = Math.max(0, Math.round(toSafeNumber(input.precioSenior)));
  const precioParqueadero = Math.max(0, Math.round(toSafeNumber(input.precioParqueadero)));
  const totalPersonas = cantidadMultiple + cantidadJunior + cantidadSenior;
  const valorTotal =
    cantidadMultiple * precioMultiple +
    cantidadJunior * precioJunior +
    cantidadSenior * precioSenior +
    cantidadParqueadero * precioParqueadero;

  const contactoCompleto = nombreCliente.length >= 3 && telefono.length >= 7 && /.+@.+\..+/.test(correo);
  const visitaCompleta = Boolean(fechaVisitaMs && fechaVisitaMs > 0);
  const motivoCompleto = motivoVisita.length >= 3;
  const objecionCompleta = objecionPrincipal.length >= 2;
  const cotizacionCompleta = totalPersonas > 0 && valorTotal > 0;

  const items = [
    {
      id: "contacto",
      label: "Contacto principal",
      complete: contactoCompleto,
      description: contactoCompleto
        ? "Cliente, teléfono y correo listos para seguimiento."
        : "Completa nombre, teléfono y correo válidos para continuar.",
    },
    {
      id: "visita",
      label: "Fecha de visita",
      complete: visitaCompleta,
      description: visitaCompleta
        ? "La visita ya tiene una fecha objetivo para priorizarla."
        : "Define la fecha de visita para activar urgencia y seguimiento.",
    },
    {
      id: "motivo",
      label: "Motivo comercial",
      complete: motivoCompleto,
      description: motivoCompleto
        ? "Ya hay contexto suficiente sobre qué necesita el cliente."
        : "Describe brevemente qué busca el cliente o qué debes cotizar.",
    },
    {
      id: "objecion",
      label: "Objeción principal",
      complete: objecionCompleta,
      description: objecionCompleta
        ? "Ya existe una alerta comercial para preparar el cierre."
        : "Registra la principal barrera para anticipar la negociación.",
    },
    {
      id: "cotizacion",
      label: "Cotización inicial",
      complete: cotizacionCompleta,
      description: cotizacionCompleta
        ? `Ya existe una estimación inicial para ${totalPersonas} personas.`
        : "Completa cantidades y precios para obtener una estimación inicial.",
    },
  ] as const;

  const completeCount = items.filter((item) => item.complete).length;
  const totalCount = items.length;
  const ready = completeCount === totalCount;

  return {
    items,
    completeCount,
    totalCount,
    ready,
    totalPersonas,
    valorTotal,
    summary: ready
      ? "Lead listo para calificación inicial y siguiente acción comercial."
      : `Checklist inicial: ${completeCount} de ${totalCount} puntos completos.`,
  };
}

export function computeLeadMetrics(input: LeadComputationInput) {
  const cantidadMultiple = Math.max(0, Math.floor(toSafeNumber(input.cantidadMultiple)));
  const cantidadJunior = Math.max(0, Math.floor(toSafeNumber(input.cantidadJunior)));
  const cantidadSenior = Math.max(0, Math.floor(toSafeNumber(input.cantidadSenior)));
  const cantidadParqueadero = Math.max(0, Math.floor(toSafeNumber(input.cantidadParqueadero)));
  const precioMultiple = Math.max(0, Math.round(toSafeNumber(input.precioMultiple)));
  const precioJunior = Math.max(0, Math.round(toSafeNumber(input.precioJunior)));
  const precioSenior = Math.max(0, Math.round(toSafeNumber(input.precioSenior)));
  const precioParqueadero = Math.max(0, Math.round(toSafeNumber(input.precioParqueadero)));

  const subtotalMultiple = cantidadMultiple * precioMultiple;
  const subtotalJunior = cantidadJunior * precioJunior;
  const subtotalSenior = cantidadSenior * precioSenior;
  const subtotalParqueadero = cantidadParqueadero * precioParqueadero;
  const totalPersonas = cantidadMultiple + cantidadJunior + cantidadSenior;
  const valorTotal = subtotalMultiple + subtotalJunior + subtotalSenior + subtotalParqueadero;
  const ticketPromedio = totalPersonas > 0 ? Math.round(valorTotal / totalPersonas) : 0;

  const ahoraMs = toTimestamp(input.ahora) ?? Date.now();
  const fechaVisitaMs = toTimestamp(input.fechaVisita);
  const fechaIngresoLeadMs = toTimestamp(input.fechaIngresoLead);
  const ultimaGestionMs = toTimestamp(input.ultimaGestion);

  const diasHastaVisita = floorDaysUntil(ahoraMs, fechaVisitaMs);
  const horasDesdeIngreso = floorHoursSince(ahoraMs, fechaIngresoLeadMs);
  const horasDesdeUltimaGestion = floorHoursSince(ahoraMs, ultimaGestionMs);

  const scoreCantidad = scoreByCantidad(totalPersonas);
  const scoreValorTotal = scoreByValorTotal(valorTotal);
  const scoreTicketPromedio = scoreByTicketPromedio(ticketPromedio);
  const scoreUrgencia = scoreByUrgencia(diasHastaVisita);
  const scoreRecencia = scoreByRecencia(horasDesdeIngreso);
  const scoreTotal = scoreCantidad + scoreValorTotal + scoreTicketPromedio + scoreUrgencia + scoreRecencia;

  const reglasAplicadas: string[] = [];
  const prioridadBase = priorityFromScore(scoreTotal);
  let prioridad = prioridadBase;
  const scoreAltoThreshold = Math.max(1, Math.round(toSafeNumber(input.scoreAltoThreshold) || defaultBusinessSettings.scoreAltoThreshold));
  const minimoPersonasAmarillo = Math.max(1, Math.round(toSafeNumber(input.minimoPersonasAmarillo) || defaultBusinessSettings.minimoPersonasAmarillo));
  const minimoPersonasRojo = Math.max(minimoPersonasAmarillo, Math.round(toSafeNumber(input.minimoPersonasRojo) || defaultBusinessSettings.minimoPersonasRojo));
  const minimoValorAmarillo = Math.max(1, Math.round(toSafeNumber(input.minimoValorAmarillo) || defaultBusinessSettings.minimoValorAmarillo));
  const minimoValorRojo = Math.max(minimoValorAmarillo, Math.round(toSafeNumber(input.minimoValorRojo) || defaultBusinessSettings.minimoValorRojo));

  if (totalPersonas >= minimoPersonasRojo) {
    prioridad = ensureMinimumPriority(prioridad, "rojo");
    reglasAplicadas.push(`Prioridad mínima roja por ${minimoPersonasRojo} o más personas.`);
  } else if (totalPersonas >= minimoPersonasAmarillo) {
    prioridad = ensureMinimumPriority(prioridad, "amarillo");
    reglasAplicadas.push(`Prioridad mínima amarilla por ${minimoPersonasAmarillo} o más personas.`);
  }

  if (valorTotal >= minimoValorRojo) {
    prioridad = ensureMinimumPriority(prioridad, "rojo");
    reglasAplicadas.push(`Prioridad mínima roja por valor total igual o superior a ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(minimoValorRojo)}.`);
  } else if (valorTotal >= minimoValorAmarillo) {
    prioridad = ensureMinimumPriority(prioridad, "amarillo");
    reglasAplicadas.push(`Prioridad mínima amarilla por valor total igual o superior a ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(minimoValorAmarillo)}.`);
  }

  if (diasHastaVisita !== null && diasHastaVisita <= 2) {
    prioridad = raisePriority(prioridad);
    reglasAplicadas.push("Se sube un nivel por visita en 2 días o menos.");
  }

  if (horasDesdeIngreso !== null && horasDesdeIngreso <= 1 && scoreTotal >= scoreAltoThreshold) {
    prioridad = raisePriority(prioridad);
    reglasAplicadas.push("Se sube un nivel por lead muy reciente con score alto.");
  }

  const explicacionBreve =
    reglasAplicadas[0] ??
    (prioridad === prioridadBase
      ? `Prioridad ${leadPriorityLabels[prioridad].toLowerCase()} definida por score ${scoreTotal}.`
      : `Prioridad ajustada desde ${leadPriorityLabels[prioridadBase].toLowerCase()} a ${leadPriorityLabels[prioridad].toLowerCase()}.`);

  return {
    cantidadMultiple,
    cantidadJunior,
    cantidadSenior,
    cantidadParqueadero,
    precioMultiple,
    precioJunior,
    precioSenior,
    precioParqueadero,
    subtotalMultiple,
    subtotalJunior,
    subtotalSenior,
    subtotalParqueadero,
    totalPersonas,
    valorTotal,
    ticketPromedio,
    fechaVisitaMs,
    fechaIngresoLeadMs,
    ultimaGestionMs,
    diasHastaVisita,
    horasDesdeIngreso,
    horasDesdeUltimaGestion,
    scoreCantidad,
    scoreValorTotal,
    scoreTicketPromedio,
    scoreUrgencia,
    scoreRecencia,
    scoreTotal,
    prioridadBase,
    prioridad,
    prioridadLabel: leadPriorityLabels[prioridad],
    prioridadColor: leadPriorityColors[prioridad],
    reglasAplicadas,
    explicacionBreve,
  };
}

export function getLeadAlertFlags(
  metrics: ReturnType<typeof computeLeadMetrics>,
  fechaLimiteGestion?: number | string | Date | null,
  estadoLead?: LeadStatus | null,
) {
  const ahoraMs = Date.now();
  const fechaLimiteGestionMs = toTimestamp(fechaLimiteGestion);
  const estadoActual = normalizeLeadStatus(estadoLead ?? "nuevo");
  const vencido = fechaLimiteGestionMs !== null && fechaLimiteGestionMs < ahoraMs;
  const sinGestion = metrics.horasDesdeUltimaGestion !== null && metrics.horasDesdeUltimaGestion >= 24;
  const visitaProximaSinGestion = metrics.diasHastaVisita !== null && metrics.diasHastaVisita <= 2 && sinGestion;
  const altaPrioridadSinCierre = ["amarillo", "rojo"].includes(metrics.prioridad) && !["ganado", "perdido"].includes(estadoActual);

  return {
    vencido,
    sinGestion,
    visitaProximaSinGestion,
    altaPrioridadSinCierre,
    requiereAtencion: vencido || sinGestion || visitaProximaSinGestion || altaPrioridadSinCierre,
  };
}

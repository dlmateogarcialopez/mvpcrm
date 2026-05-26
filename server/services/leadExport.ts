import * as XLSX from "xlsx";
import { inferLeadPartyKind, leadPartyKindLabels, leadTypeLabels, normalizeLeadTravelReason } from "../../shared/leads";

export type LeadExportRow = {
  id?: number;
  publicId: string;
  nombreCliente?: string | null;
  nombreEmpresa?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
  correo?: string | null;
  estadoLead?: string | null;
  prioridad?: string | null;
  temperatura?: string | null;
  canalOrigen?: string | null;
  tipoEvento?: string | null;
  motivoVisita?: string | null;
  objecionPrincipal?: string | null;
  cantidadMultiple?: number | null;
  cantidadJunior?: number | null;
  cantidadSenior?: number | null;
  cantidadParqueadero?: number | null;
  precioMultiple?: number | null;
  precioJunior?: number | null;
  precioSenior?: number | null;
  precioParqueadero?: number | null;
  subtotalMultiple?: number | null;
  subtotalJunior?: number | null;
  subtotalSenior?: number | null;
  subtotalParqueadero?: number | null;
  totalPersonas?: number | null;
  valorTotal?: number | null;
  ticketPromedio?: number | null;
  scoreCantidad?: number | null;
  scoreValorTotal?: number | null;
  scoreTicketPromedio?: number | null;
  scoreUrgencia?: number | null;
  scoreRecencia?: number | null;
  scoreTotal?: number | null;
  agenteResponsable?: string | null;
  agenteUserId?: number | null;
  fechaIngresoLead?: number | null;
  fechaVisita?: number | null;
  fechaLimiteGestion?: number | null;
  ultimaGestion?: number | null;
  proximaAccion?: string | null;
  notasInternas?: string | null;
  motivoPerdido?: string | null;
  motivoPausa?: string | null;
  lastActivityAt?: number | null;
  calendarEventId?: string | null;
  calendarEventUrl?: string | null;
  calendarSyncStatus?: string | null;
  calendarSyncMessage?: string | null;
  alertPending?: boolean | null;
  alertLastChannel?: string | null;
  alertLastMessage?: string | null;
  lastAlertAt?: number | null;
  closedAt?: number | null;
  diasHastaVisita?: number | null;
  horasDesdeUltimaGestion?: number | null;
  diasParaCierre?: number | null;
  isClosed?: boolean | null;
  createdByUserId?: number | null;
  updatedByUserId?: number | null;
  createdAt?: Date | string | number | null;
  updatedAt?: Date | string | number | null;
};

type ExportColumn = {
  header: string;
  width: number;
  value: (row: LeadExportRow) => string | number | boolean | null;
};

function formatTimestamp(value: number | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatDateValue(value: Date | string | number | null | undefined) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return formatTimestamp(value);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function formatPartyKind(row: LeadExportRow) {
  return leadPartyKindLabels[inferLeadPartyKind({ nombreEmpresa: row.nombreEmpresa })];
}

function formatTravelReason(value: string | null | undefined) {
  const normalized = normalizeLeadTravelReason(value);
  return leadTypeLabels[normalized] ?? normalized;
}

const exportColumns: ExportColumn[] = [
  { header: "ID CRM", width: 18, value: row => row.publicId },
  { header: "ID interno", width: 12, value: row => row.id ?? "" },
  { header: "Cliente", width: 28, value: row => row.nombreCliente ?? "" },
  { header: "Empresa", width: 28, value: row => row.nombreEmpresa ?? "" },
  { header: "Ciudad", width: 20, value: row => row.ciudad ?? "" },
  { header: "Teléfono", width: 18, value: row => row.telefono ?? "" },
  { header: "Correo", width: 30, value: row => row.correo ?? "" },
  { header: "Estado", width: 16, value: row => row.estadoLead ?? "" },
  { header: "Prioridad", width: 16, value: row => row.prioridad ?? "" },
  { header: "Temperatura", width: 16, value: row => row.temperatura ?? "" },
  { header: "Canal de origen", width: 18, value: row => row.canalOrigen ?? "" },
  { header: "Clasificación comercial", width: 22, value: row => formatPartyKind(row) },
  { header: "Motivo de viaje", width: 18, value: row => formatTravelReason(row.tipoEvento) },
  { header: "Motivo de visita", width: 36, value: row => row.motivoVisita ?? "" },
  { header: "Objeción principal", width: 36, value: row => row.objecionPrincipal ?? "" },
  { header: "Cantidad múltiple", width: 18, value: row => row.cantidadMultiple ?? 0 },
  { header: "Cantidad junior", width: 18, value: row => row.cantidadJunior ?? 0 },
  { header: "Cantidad senior", width: 18, value: row => row.cantidadSenior ?? 0 },
  { header: "Cantidad parqueadero", width: 21, value: row => row.cantidadParqueadero ?? 0 },
  { header: "Precio múltiple", width: 16, value: row => row.precioMultiple ?? 0 },
  { header: "Precio junior", width: 16, value: row => row.precioJunior ?? 0 },
  { header: "Precio senior", width: 16, value: row => row.precioSenior ?? 0 },
  { header: "Precio parqueadero", width: 20, value: row => row.precioParqueadero ?? 0 },
  { header: "Subtotal múltiple", width: 18, value: row => row.subtotalMultiple ?? 0 },
  { header: "Subtotal junior", width: 18, value: row => row.subtotalJunior ?? 0 },
  { header: "Subtotal senior", width: 18, value: row => row.subtotalSenior ?? 0 },
  { header: "Subtotal parqueadero", width: 21, value: row => row.subtotalParqueadero ?? 0 },
  { header: "Total personas", width: 16, value: row => row.totalPersonas ?? 0 },
  { header: "Valor total", width: 16, value: row => row.valorTotal ?? 0 },
  { header: "Ticket promedio", width: 18, value: row => row.ticketPromedio ?? 0 },
  { header: "Score cantidad", width: 16, value: row => row.scoreCantidad ?? 0 },
  { header: "Score valor total", width: 18, value: row => row.scoreValorTotal ?? 0 },
  { header: "Score ticket promedio", width: 22, value: row => row.scoreTicketPromedio ?? 0 },
  { header: "Score urgencia", width: 16, value: row => row.scoreUrgencia ?? 0 },
  { header: "Score recencia", width: 16, value: row => row.scoreRecencia ?? 0 },
  { header: "Score total", width: 16, value: row => row.scoreTotal ?? 0 },
  { header: "Agente responsable", width: 24, value: row => row.agenteResponsable ?? "" },
  { header: "ID agente responsable", width: 20, value: row => row.agenteUserId ?? "" },
  { header: "Fecha ingreso lead", width: 26, value: row => formatTimestamp(row.fechaIngresoLead) },
  { header: "Fecha visita", width: 26, value: row => formatTimestamp(row.fechaVisita) },
  { header: "Fecha límite gestión", width: 26, value: row => formatTimestamp(row.fechaLimiteGestion) },
  { header: "Última gestión", width: 26, value: row => formatTimestamp(row.ultimaGestion) },
  { header: "Próxima acción", width: 28, value: row => row.proximaAccion ?? "" },
  { header: "Notas internas", width: 40, value: row => row.notasInternas ?? "" },
  { header: "Motivo perdido", width: 28, value: row => row.motivoPerdido ?? "" },
  { header: "Motivo pausa", width: 28, value: row => row.motivoPausa ?? "" },
  { header: "Última actividad", width: 26, value: row => formatTimestamp(row.lastActivityAt) },
  { header: "Calendar event id", width: 24, value: row => row.calendarEventId ?? "" },
  { header: "Calendar event url", width: 36, value: row => row.calendarEventUrl ?? "" },
  { header: "Estado sincronización calendario", width: 28, value: row => row.calendarSyncStatus ?? "" },
  { header: "Mensaje sincronización calendario", width: 40, value: row => row.calendarSyncMessage ?? "" },
  { header: "Alerta pendiente", width: 16, value: row => row.alertPending ?? false },
  { header: "Último canal alerta", width: 18, value: row => row.alertLastChannel ?? "" },
  { header: "Último mensaje alerta", width: 40, value: row => row.alertLastMessage ?? "" },
  { header: "Última alerta", width: 26, value: row => formatTimestamp(row.lastAlertAt) },
  { header: "Cierre", width: 26, value: row => formatTimestamp(row.closedAt) },
  { header: "Días hasta visita", width: 16, value: row => row.diasHastaVisita ?? "" },
  { header: "Horas desde última gestión", width: 22, value: row => row.horasDesdeUltimaGestion ?? "" },
  { header: "Días para cierre", width: 16, value: row => row.diasParaCierre ?? "" },
  { header: "Registro cerrado", width: 16, value: row => row.isClosed ?? false },
  { header: "Creado por usuario", width: 18, value: row => row.createdByUserId ?? "" },
  { header: "Actualizado por usuario", width: 22, value: row => row.updatedByUserId ?? "" },
  { header: "Creado en", width: 26, value: row => formatDateValue(row.createdAt) },
  { header: "Actualizado en", width: 26, value: row => formatDateValue(row.updatedAt) },
];

export function buildLeadWorkbookBuffer(rows: LeadExportRow[]) {
  const sheetRows = [
    exportColumns.map(column => column.header),
    ...rows.map(row => exportColumns.map(column => column.value(row))),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet["!cols"] = exportColumns.map(column => ({ wch: column.width }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "CRM Leads");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
    compression: true,
  });
}

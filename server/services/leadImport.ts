import * as XLSX from "xlsx";

/**
 * Whitelist de campos válidos del sistema para importación.
 * Cada campo tiene una lista de sinónimos que el sistema acepta.
 */
export const LEAD_IMPORT_FIELDS: Record<
  string,
  { label: string; synonyms: string[]; type: "string" | "number" | "date" }
> = {
  nombreCliente: {
    label: "Nombre Cliente",
    synonyms: [
      "nombre",
      "nombre cliente",
      "cliente",
      "name",
      "contacto",
      "contacto nombre",
    ],
    type: "string",
  },
  telefono: {
    label: "Teléfono",
    synonyms: ["teléfono", "telefono", "phone", "celular", "móvil", "movil"],
    type: "string",
  },
  correo: {
    label: "Correo",
    synonyms: ["correo", "email", "mail", "e-mail"],
    type: "string",
  },
  nombreEmpresa: {
    label: "Nombre Empresa",
    synonyms: ["empresa", "compañía", "compania", "company"],
    type: "string",
  },
  ciudad: {
    label: "Ciudad",
    synonyms: ["ciudad", "city", "ubicación", "ubicacion"],
    type: "string",
  },
  fechaVisita: {
    label: "Fecha de Visita",
    synonyms: [
      "fecha visita",
      "fecha de visita",
      "fecha evento",
      "fecha del evento",
    ],
    type: "date",
  },
  motivoVisita: {
    label: "Motivo de Visita",
    synonyms: ["motivo", "motivo visita", "motivo de visita", "razón", "razon"],
    type: "string",
  },
  tipoEvento: {
    label: "Tipo de Evento",
    synonyms: ["tipo evento", "tipo de evento", "evento", "tipo"],
    type: "string",
  },
  objecionPrincipal: {
    label: "Objeción Principal",
    synonyms: [
      "objeción",
      "objecion",
      "objeción principal",
      "objecion principal",
    ],
    type: "string",
  },
  cantidadMultiple: {
    label: "Cantidad Múltiple",
    synonyms: [
      "cantidad múltiple",
      "cantidad multiple",
      "cantidad",
      "qty",
      "múltiple",
      "multiple",
    ],
    type: "number",
  },
  cantidadJunior: {
    label: "Cantidad Junior",
    synonyms: ["cantidad junior", "qty junior", "junior"],
    type: "number",
  },
  cantidadSenior: {
    label: "Cantidad Senior",
    synonyms: ["cantidad senior", "qty senior", "senior"],
    type: "number",
  },
  cantidadParqueadero: {
    label: "Cantidad Parqueadero",
    synonyms: [
      "cantidad parqueadero",
      "parqueadero",
      "parqueaderos",
      "estacionamiento",
    ],
    type: "number",
  },
  precioMultiple: {
    label: "Precio Múltiple",
    synonyms: ["precio múltiple", "precio multiple", "precio"],
    type: "number",
  },
  precioJunior: {
    label: "Precio Junior",
    synonyms: ["precio junior"],
    type: "number",
  },
  precioSenior: {
    label: "Precio Senior",
    synonyms: ["precio senior"],
    type: "number",
  },
  precioParqueadero: {
    label: "Precio Parqueadero",
    synonyms: ["precio parqueadero"],
    type: "number",
  },
  estadoLead: {
    label: "Estado",
    synonyms: [
      "estado",
      "estado lead",
      "estado del lead",
      "fase",
      "etapa",
      "status",
    ],
    type: "string",
  },
  canalOrigen: {
    label: "Canal de Origen",
    synonyms: ["canal", "origen", "canal origen", "fuente", "source"],
    type: "string",
  },
  agenteResponsable: {
    label: "Agente Responsable",
    synonyms: ["agente", "responsable", "agente responsable", "vendedor"],
    type: "string",
  },
  fechaIngresoLead: {
    label: "Fecha de Ingreso",
    synonyms: [
      "fecha ingreso",
      "fecha de ingreso",
      "fecha creación",
      "fecha de creación",
    ],
    type: "date",
  },
  fechaLimiteGestion: {
    label: "Fecha Límite de Gestión",
    synonyms: [
      "fecha límite",
      "fecha limite",
      "fecha límite gestión",
      "fecha límite de gestión",
      "deadline",
    ],
    type: "date",
  },
  motivoPerdido: {
    label: "Motivo de Pérdida",
    synonyms: [
      "motivo perdido",
      "motivo de pérdida",
      "motivo de perdida",
      "razón pérdida",
    ],
    type: "string",
  },
  motivoPausa: {
    label: "Motivo de Pausa",
    synonyms: ["motivo pausa", "motivo de pausa"],
    type: "string",
  },
  notasInternas: {
    label: "Notas Internas",
    synonyms: ["notas", "notas internas", "observaciones", "comentarios"],
    type: "string",
  },
};

const CATALOG_VALID_STATES = [
  "nuevo",
  "contactado",
  "calificado",
  "propuesta",
  "negociacion",
  "ganado",
  "perdido",
  "pausado",
];
const CATALOG_VALID_CHANNELS = [
  "web",
  "whatsapp",
  "facebook",
  "instagram",
  "referido",
  "telefono",
  "email",
  "otro",
];

export type CellStatus = "ok" | "warning" | "error";

export interface ParsedCell {
  raw: any;
  status: CellStatus;
  reason?: string;
}

export interface ParsedRow {
  index: number;
  data: Record<string, ParsedCell>;
  status: CellStatus;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  recognized: Array<{
    systemField: string;
    label: string;
    excelColumn: string;
  }>;
  missing: string[];
  unknown: string[];
  rows: ParsedRow[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
}

/**
 * Normaliza un string para comparación: minúsculas, sin tildes, sin espacios extra.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parsea un buffer de Excel y devuelve un ValidationResult con mapeo automático.
 */
export function validateLeadImport(
  buffer: Buffer,
  manualMapping?: Record<string, string>
): ValidationResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return {
      recognized: [],
      missing: Object.keys(LEAD_IMPORT_FIELDS),
      unknown: [],
      rows: [],
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
    };
  }
  const sheet = workbook.Sheets[firstSheet];
  const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (json.length === 0) {
    return {
      recognized: [],
      missing: Object.keys(LEAD_IMPORT_FIELDS),
      unknown: [],
      rows: [],
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
    };
  }

  const headers: string[] = (json[0] || []).map((h: any) => String(h ?? ""));
  const dataRows: any[][] = json.slice(1);

  // Mapeo automático: excel column → system field
  const recognized: Array<{
    systemField: string;
    label: string;
    excelColumn: string;
  }> = [];
  const usedHeaders = new Set<string>();
  const columnToField: Record<string, string> = {};

  for (const [field, def] of Object.entries(LEAD_IMPORT_FIELDS)) {
    // Si el usuario dio un mapeo manual, usarlo
    if (manualMapping) {
      const excelCol = Object.entries(manualMapping).find(
        ([, f]) => f === field
      )?.[0];
      if (excelCol && headers.includes(excelCol)) {
        columnToField[excelCol] = field;
        recognized.push({
          systemField: field,
          label: def.label,
          excelColumn: excelCol,
        });
        usedHeaders.add(excelCol);
        continue;
      }
    }
    // Mapeo automático por sinónimo
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const normHeader = normalize(header);
      const allSynonyms = [field, ...def.synonyms].map(normalize);
      if (allSynonyms.includes(normHeader)) {
        columnToField[header] = field;
        recognized.push({
          systemField: field,
          label: def.label,
          excelColumn: header,
        });
        usedHeaders.add(header);
        break;
      }
    }
  }

  // Columnas desconocidas
  const unknown = headers.filter(h => h && !usedHeaders.has(h));

  // Columnas faltantes (campos del sistema que no se mapearon)
  const recognizedFields = new Set(recognized.map(r => r.systemField));
  const missing = Object.keys(LEAD_IMPORT_FIELDS).filter(
    f => !recognizedFields.has(f)
  );

  // Parsear filas
  const rows: ParsedRow[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every(c => c === null || c === undefined || c === ""))
      continue;

    const data: Record<string, ParsedCell> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [excelCol, fieldName] of Object.entries(columnToField)) {
      const colIndex = headers.indexOf(excelCol);
      const raw = colIndex >= 0 ? row[colIndex] : undefined;
      const def = LEAD_IMPORT_FIELDS[fieldName];

      // Validación básica
      let status: CellStatus = "ok";
      let reason: string | undefined;
      let normalizedValue: any = raw;

      // Validador por campo
      if (
        def.type === "number" &&
        raw !== undefined &&
        raw !== null &&
        raw !== ""
      ) {
        const n = typeof raw === "number" ? raw : parseFloat(String(raw));
        if (Number.isNaN(n)) {
          status = "error";
          reason = `Valor numérico inválido: ${raw}`;
        } else {
          normalizedValue = n;
        }
      } else if (
        def.type === "date" &&
        raw !== undefined &&
        raw !== null &&
        raw !== ""
      ) {
        // Excel puede dar fechas como número (serial) o string ISO
        if (typeof raw === "number") {
          normalizedValue = Math.round((raw - 25569) * 86400 * 1000);
        } else {
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) {
            status = "error";
            reason = `Fecha inválida: ${raw}`;
          } else {
            normalizedValue = d.getTime();
          }
        }
      } else if (fieldName === "estadoLead" && raw) {
        const normState = normalize(String(raw));
        const match = CATALOG_VALID_STATES.find(
          s => normalize(s) === normState
        );
        if (!match) {
          status = "warning";
          reason = `Estado no reconocido: ${raw}. Se usará "nuevo" por defecto.`;
          normalizedValue = "nuevo";
        } else {
          normalizedValue = match;
        }
      } else if (fieldName === "canalOrigen" && raw) {
        const normChannel = normalize(String(raw));
        const match = CATALOG_VALID_CHANNELS.find(
          c => normalize(c) === normChannel
        );
        if (!match) {
          status = "warning";
          reason = `Canal no reconocido: ${raw}. Se usará "otro" por defecto.`;
          normalizedValue = "otro";
        } else {
          normalizedValue = match;
        }
      }

      data[fieldName] = { raw: normalizedValue, status, reason };
      if (status === "error") errors.push(`${def.label}: ${reason}`);
      else if (status === "warning") warnings.push(`${def.label}: ${reason}`);
    }

    // Validación global de la fila
    const telefono = data.telefono?.raw;
    const correo = data.correo?.raw;
    const nombre = data.nombreCliente?.raw;

    if (!nombre || String(nombre).trim() === "") {
      errors.push("Falta nombre del cliente");
    }
    if (!telefono && !correo) {
      errors.push("Falta al menos teléfono o correo");
    }

    let rowStatus: CellStatus = "ok";
    if (errors.length > 0) rowStatus = "error";
    else if (warnings.length > 0) rowStatus = "warning";

    rows.push({
      index: i,
      data,
      status: rowStatus,
      errors,
      warnings,
    });
  }

  const validCount = rows.filter(r => r.status === "ok").length;
  const warningCount = rows.filter(r => r.status === "warning").length;
  const errorCount = rows.filter(r => r.status === "error").length;

  return {
    recognized,
    missing,
    unknown,
    rows,
    totalRows: rows.length,
    validCount,
    warningCount,
    errorCount,
  };
}

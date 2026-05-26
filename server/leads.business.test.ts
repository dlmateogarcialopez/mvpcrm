import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isStructuredLeadReason,
  isSystemLeadActivityType,
  leadCreateSchema,
  leadFiltersSchema,
  leadLostReasonOptions,
  leadPausedReasonOptions,
  systemLeadActivityTypes,
} from "../shared/leadSchemas";
import {
  computeLeadMetrics,
  estimateLeadCommission,
  getLeadAlertFlags,
  normalizeLeadStatus,
} from "../shared/leads";

afterEach(() => {
  vi.useRealTimers();
});

describe("lead business rules", () => {
  it("calcula importes y ticket promedio correctamente", () => {
    const metrics = computeLeadMetrics({
      cantidadMultiple: 10,
      cantidadJunior: 5,
      cantidadSenior: 5,
      cantidadParqueadero: 2,
      precioMultiple: 100000,
      precioJunior: 70000,
      precioSenior: 70000,
      precioParqueadero: 10000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-10T12:00:00.000Z"),
      fechaVisita: new Date("2026-04-15T15:00:00.000Z"),
    });

    expect(metrics.totalPersonas).toBe(20);
    expect(metrics.valorTotal).toBe(1720000);
    expect(metrics.ticketPromedio).toBe(86000);
    expect(metrics.diasHastaVisita).toBe(5);
    expect(metrics.horasDesdeIngreso).toBe(3);
  });

  it("fuerza prioridad roja para operaciones grandes por cantidad y valor", () => {
    const metrics = computeLeadMetrics({
      cantidadMultiple: 120,
      cantidadJunior: 40,
      cantidadSenior: 40,
      cantidadParqueadero: 10,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-09T15:00:00.000Z"),
      fechaVisita: new Date("2026-04-20T15:00:00.000Z"),
    });

    expect(metrics.totalPersonas).toBe(200);
    expect(metrics.prioridad).toBe("rojo");
    expect(metrics.reglasAplicadas).toContain("Prioridad mínima roja por 200 o más personas.");
    expect(metrics.explicacionBreve).toContain("Prioridad mínima roja");
  });

  it("sube la prioridad cuando la visita está en dos días o menos", () => {
    const metrics = computeLeadMetrics({
      cantidadMultiple: 8,
      cantidadJunior: 2,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-08T15:00:00.000Z"),
      fechaVisita: new Date("2026-04-12T15:00:00.000Z"),
    });

    expect(metrics.prioridadBase).toBe("verde");
    expect(metrics.prioridad).toBe("amarillo");
    expect(metrics.reglasAplicadas).toContain("Se sube un nivel por visita en 2 días o menos.");
  });

  it("marca alertas para lead vencido, sin gestión y con visita próxima", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T15:00:00.000Z"));

    const metrics = computeLeadMetrics({
      cantidadMultiple: 5,
      cantidadJunior: 0,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-08T10:00:00.000Z"),
      ultimaGestion: new Date("2026-04-09T10:00:00.000Z"),
      fechaVisita: new Date("2026-04-11T15:00:00.000Z"),
    });

    const flags = getLeadAlertFlags(metrics, new Date("2026-04-10T14:00:00.000Z"), "seguimiento");

    expect(flags.vencido).toBe(true);
    expect(flags.sinGestion).toBe(true);
    expect(flags.visitaProximaSinGestion).toBe(true);
    expect(flags.requiereAtencion).toBe(true);
    expect(normalizeLeadStatus("seguimiento")).toBe("negociacion");
  });

  it("calcula la comisión estimada sin exceder límites inválidos", () => {
    expect(estimateLeadCommission(25000000, 5)).toBe(1250000);
    expect(estimateLeadCommission(25000000, 500)).toBe(25000000);
    expect(estimateLeadCommission(-1000, 5)).toBe(0);
  });

  it("acepta un lead válido con la validación compartida del CRM", () => {
    const parsed = leadCreateSchema.safeParse({
      nombreCliente: "Clínica Central",
      nombreEmpresa: "Clínica Central SAS",
      ciudad: "Bogotá",
      telefono: "3001234567",
      correo: "operaciones@clinicacentral.com",
      fechaVisita: new Date("2026-04-15T15:00:00.000Z").getTime(),
      motivoVisita: "Revisión comercial para campaña institucional.",
      tipoEvento: "corporativo",
      objecionPrincipal: "Comparación con un proveedor actual.",
      cantidadMultiple: 8,
      cantidadJunior: 2,
      cantidadSenior: 1,
      cantidadParqueadero: 1,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      estadoLead: "nuevo",
      canalOrigen: "referido",
      agenteResponsable: "Equipo comercial",
      fechaIngresoLead: new Date("2026-04-10T15:00:00.000Z").getTime(),
      fechaLimiteGestion: null,
      ultimaGestion: null,
      proximaAccion: "Enviar propuesta económica",
      notasInternas: "Cliente con decisión en comité.",
      motivoPerdido: "",
      motivoPausa: "",
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza datos mínimos inválidos del formulario para evitar guardados incompletos", () => {
    const parsed = leadCreateSchema.safeParse({
      nombreCliente: "A",
      nombreEmpresa: "",
      ciudad: "",
      telefono: "123",
      correo: "correo-invalido",
      fechaVisita: 0,
      motivoVisita: "",
      tipoEvento: "otro",
      objecionPrincipal: "",
      cantidadMultiple: 0,
      cantidadJunior: 0,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      canalOrigen: "otro",
      fechaLimiteGestion: null,
      proximaAccion: "",
      notasInternas: "",
      motivoPerdido: "",
      motivoPausa: "",
    });

    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      expect(fields.nombreCliente?.[0]).toBeDefined();
      expect(fields.telefono?.[0]).toBeDefined();
      expect(fields.correo?.[0]).toBeDefined();
      expect(fields.fechaVisita?.[0]).toBeDefined();
      expect(fields.motivoVisita?.[0]).toBeDefined();
      expect(fields.objecionPrincipal?.[0]).toBeDefined();
    }
  });

  it("normaliza filtros del pipeline con defaults seguros", () => {
    const parsed = leadFiltersSchema.parse({
      query: "  carlos  ",
      estadoLead: "todos",
      prioridad: "todas",
    });

    expect(parsed.query).toBe("carlos");
    expect(parsed.canalOrigen).toBe("todos");
    expect(parsed.tipoEvento).toBe("todos");
    expect(parsed.ciudad).toBe("");
    expect(parsed.sortBy).toBe("updatedAt");
    expect(parsed.sortOrder).toBe("desc");
  });

  it("acepta filtros operativos de ciudad y orden para el tablero comercial", () => {
    const parsed = leadFiltersSchema.parse({
      query: "  norte  ",
      estadoLead: "seguimiento",
      prioridad: "amarillo",
      canalOrigen: "whatsapp",
      tipoEvento: "corporativo",
      ciudad: "  Medellín  ",
      agenteUserId: 12,
      soloAlertas: true,
      assignedToMe: true,
      sortBy: "valorTotal",
      sortOrder: "asc",
    });

    expect(parsed.query).toBe("norte");
    expect(parsed.ciudad).toBe("Medellín");
    expect(parsed.agenteUserId).toBe(12);
    expect(parsed.soloAlertas).toBe(true);
    expect(parsed.assignedToMe).toBe(true);
    expect(parsed.sortBy).toBe("valorTotal");
    expect(parsed.sortOrder).toBe("asc");
  });

  it("distingue actividades automáticas del sistema frente a avances del equipo", () => {
    expect(systemLeadActivityTypes).toContain("status_changed");
    expect(systemLeadActivityTypes).toContain("sensitive_fields_changed");
    expect(isSystemLeadActivityType("status_changed")).toBe(true);
    expect(isSystemLeadActivityType("lead_updated")).toBe(true);
    expect(isSystemLeadActivityType("sensitive_fields_changed")).toBe(true);
    expect(isSystemLeadActivityType("manual_note")).toBe(false);
    expect(isSystemLeadActivityType("call_logged")).toBe(false);
  });

  it("valida motivos estructurados para estados perdido y pausado", () => {
    expect(leadLostReasonOptions).toContain("Precio fuera de presupuesto");
    expect(leadPausedReasonOptions).toContain("Pendiente aprobación interna");
    expect(isStructuredLeadReason(" Precio fuera de presupuesto ", leadLostReasonOptions)).toBe(true);
    expect(isStructuredLeadReason("Pendiente aprobación interna", leadPausedReasonOptions)).toBe(true);
    expect(isStructuredLeadReason("Otro motivo libre", leadLostReasonOptions)).toBe(false);
    expect(isStructuredLeadReason("", leadPausedReasonOptions)).toBe(false);
  });
});

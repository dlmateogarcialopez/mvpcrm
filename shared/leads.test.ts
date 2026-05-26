import { describe, expect, it, vi } from "vitest";
import {
  appRoleLabels,
  computeLeadMetrics,
  getInitialQualificationChecklist,
  getLeadAlertFlags,
  leadPrimaryPipelineValues,
  leadStatusLabels,
} from "./leads";
import { leadCreateSchema } from "./leadSchemas";

describe("shared/leads role labels", () => {
  it("mantiene etiquetas claras para los perfiles visibles del CRM", () => {
    expect(appRoleLabels.guest).toBe("Invitado");
    expect(appRoleLabels.agent).toBe("Agente");
    expect(appRoleLabels.admin).toBe("Administrador");
    expect(appRoleLabels.superadmin).toBe("Superadministrador");
  });
});

describe("shared/leads pipeline labels", () => {
  it("mantiene una ruta comercial simple y ordenada para el embudo principal", () => {
    expect(leadPrimaryPipelineValues).toEqual([
      "nuevo",
      "contactado",
      "calificado",
      "propuesta",
      "negociacion",
      "ganado",
      "perdido",
      "pausado",
    ]);
    expect(leadStatusLabels.propuesta).toBe("Propuesta enviada");
    expect(leadStatusLabels.negociacion).toBe("Negociación");
  });
});

describe("shared/leads computeLeadMetrics", () => {
  it("calcula subtotales, total y ticket promedio correctamente", () => {
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

    expect(metrics.subtotalMultiple).toBe(1000000);
    expect(metrics.subtotalJunior).toBe(350000);
    expect(metrics.subtotalSenior).toBe(350000);
    expect(metrics.subtotalParqueadero).toBe(20000);
    expect(metrics.totalPersonas).toBe(20);
    expect(metrics.valorTotal).toBe(1720000);
    expect(metrics.ticketPromedio).toBe(86000);
    expect(metrics.diasHastaVisita).toBe(5);
    expect(metrics.horasDesdeIngreso).toBe(3);
  });

  it("fuerza prioridad roja cuando hay 200 o más personas", () => {
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
  });

  it("eleva la prioridad por visita muy próxima incluso si la base no es roja", () => {
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

  it("respeta los umbrales configurables de personas y valor para recalcular la prioridad base", () => {
    const metrics = computeLeadMetrics({
      cantidadMultiple: 16,
      cantidadJunior: 4,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 100000,
      precioJunior: 70000,
      precioSenior: 70000,
      precioParqueadero: 10000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-09T15:00:00.000Z"),
      fechaVisita: new Date("2026-04-18T15:00:00.000Z"),
      minimoPersonasAmarillo: 25,
      minimoPersonasRojo: 40,
      minimoValorAmarillo: 2500000,
      minimoValorRojo: 3500000,
    });

    expect(metrics.totalPersonas).toBe(20);
    expect(metrics.valorTotal).toBe(1880000);
    expect(metrics.prioridadBase).toBe("amarillo");
    expect(metrics.prioridad).toBe("amarillo");
    expect(metrics.reglasAplicadas).toEqual([]);
  });

  it("eleva la prioridad por lead muy reciente con score alto", () => {
    const metrics = computeLeadMetrics({
      cantidadMultiple: 90,
      cantidadJunior: 20,
      cantidadSenior: 10,
      cantidadParqueadero: 5,
      precioMultiple: 120000,
      precioJunior: 80000,
      precioSenior: 80000,
      precioParqueadero: 10000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-10T14:20:00.000Z"),
      fechaVisita: new Date("2026-04-18T15:00:00.000Z"),
      scoreAltoThreshold: 65,
    });

    expect(metrics.scoreTotal).toBeGreaterThanOrEqual(65);
    expect(metrics.horasDesdeIngreso).toBe(0);
    expect(metrics.prioridad).toBe("rojo");
    expect(metrics.reglasAplicadas).toContain("Se sube un nivel por lead muy reciente con score alto.");
  });

  it("no agrega reglas cuando la prioridad final sale directamente del score base", () => {
    const metrics = computeLeadMetrics({
      cantidadMultiple: 18,
      cantidadJunior: 4,
      cantidadSenior: 2,
      cantidadParqueadero: 1,
      precioMultiple: 110000,
      precioJunior: 75000,
      precioSenior: 75000,
      precioParqueadero: 10000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-08T15:00:00.000Z"),
      ultimaGestion: new Date("2026-04-10T10:00:00.000Z"),
      fechaVisita: new Date("2026-04-18T15:00:00.000Z"),
      scoreAltoThreshold: 80,
    });

    expect(metrics.prioridadBase).toBe(metrics.prioridad);
    expect(metrics.reglasAplicadas).toEqual([]);
    expect(metrics.explicacionBreve).toContain("Prioridad");
  });
});

describe("shared/leads initial qualification checklist", () => {
  it("resume correctamente los puntos faltantes cuando el lead aún no está listo para calificación inicial", () => {
    const checklist = getInitialQualificationChecklist({
      nombreCliente: "Lu",
      telefono: "12345",
      correo: "correo-invalido",
      fechaVisita: null,
      motivoVisita: "",
      objecionPrincipal: "",
      cantidadMultiple: 0,
      cantidadJunior: 0,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
    });

    expect(checklist.ready).toBe(false);
    expect(checklist.completeCount).toBe(0);
    expect(checklist.totalCount).toBe(5);
    expect(checklist.items.find((item) => item.id === "contacto")?.complete).toBe(false);
    expect(checklist.items.find((item) => item.id === "cotizacion")?.description).toContain("cantidades y precios");
    expect(checklist.summary).toContain("0 de 5");
  });

  it("marca listo el checklist cuando el lead ya tiene contacto, visita, contexto y cotización inicial", () => {
    const checklist = getInitialQualificationChecklist({
      nombreCliente: "Laura Gómez",
      telefono: "3001234567",
      correo: "laura@boutique.co",
      fechaVisita: new Date("2026-04-18T15:00:00.000Z"),
      motivoVisita: "Cotizar catering para lanzamiento de producto",
      objecionPrincipal: "Presupuesto ajustado",
      cantidadMultiple: 12,
      cantidadJunior: 4,
      cantidadSenior: 2,
      cantidadParqueadero: 1,
      precioMultiple: 110000,
      precioJunior: 75000,
      precioSenior: 75000,
      precioParqueadero: 10000,
    });

    expect(checklist.ready).toBe(true);
    expect(checklist.completeCount).toBe(5);
    expect(checklist.totalPersonas).toBe(18);
    expect(checklist.valorTotal).toBe(1780000);
    expect(checklist.items.every((item) => item.complete)).toBe(true);
    expect(checklist.summary).toContain("Lead listo para calificación inicial");
  });
});

describe("shared/leadSchemas create form", () => {
  it("exige los datos mínimos que el formulario reorganizado presenta como obligatorios", () => {
    const result = leadCreateSchema.safeParse({
      nombreCliente: "Al",
      telefono: "123",
      correo: "correo-invalido",
      fechaVisita: 0,
      motivoVisita: "",
      tipoEvento: "corporativo",
      objecionPrincipal: "",
      cantidadMultiple: 0,
      cantidadJunior: 0,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      canalOrigen: "whatsapp",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.nombreCliente).toBeTruthy();
    expect(result.error?.flatten().fieldErrors.telefono).toBeTruthy();
    expect(result.error?.flatten().fieldErrors.correo).toBeTruthy();
    expect(result.error?.flatten().fieldErrors.fechaVisita).toBeTruthy();
    expect(result.error?.flatten().fieldErrors.motivoVisita).toBeTruthy();
    expect(result.error?.flatten().fieldErrors.objecionPrincipal).toBeTruthy();
  });

  it("acepta un lead listo para calificación inicial cuando ya hay contacto, visita y motivo comercial", () => {
    const result = leadCreateSchema.safeParse({
      nombreCliente: "Laura Gómez",
      nombreEmpresa: "Boutique Centro",
      ciudad: "Bogotá",
      telefono: "3001234567",
      correo: "laura@boutique.co",
      fechaVisita: new Date("2026-04-18T15:00:00.000Z").getTime(),
      motivoVisita: "Cotizar catering para lanzamiento de producto",
      tipoEvento: "corporativo",
      objecionPrincipal: "Presupuesto ajustado",
      cantidadMultiple: 12,
      cantidadJunior: 4,
      cantidadSenior: 2,
      cantidadParqueadero: 1,
      precioMultiple: 110000,
      precioJunior: 75000,
      precioSenior: 75000,
      precioParqueadero: 10000,
      canalOrigen: "instagram",
      proximaAccion: "Enviar propuesta hoy antes de las 5 pm",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("El esquema debía aceptar un lead completo para la calificación inicial.");
    }
    expect(result.data.nombreCliente).toBe("Laura Gómez");
    expect(result.data.proximaAccion).toContain("propuesta");
  });
});

describe("shared/leads getLeadAlertFlags", () => {
  it("marca atención requerida para leads de alta prioridad aún no cerrados", () => {
    const metrics = computeLeadMetrics({
      cantidadMultiple: 120,
      cantidadJunior: 0,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-10T10:00:00.000Z"),
      fechaVisita: new Date("2026-04-20T15:00:00.000Z"),
    });

    const flags = getLeadAlertFlags(metrics, null, "nuevo");

    expect(flags.altaPrioridadSinCierre).toBe(true);
    expect(flags.requiereAtencion).toBe(true);
  });

  it("detecta leads vencidos y sin gestión usando el reloj del sistema", () => {
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

    vi.useRealTimers();
  });

  it("no exige atención cuando el lead ya está cerrado y no tiene otras alertas activas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T15:00:00.000Z"));

    const metrics = computeLeadMetrics({
      cantidadMultiple: 4,
      cantidadJunior: 0,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      precioMultiple: 99000,
      precioJunior: 69000,
      precioSenior: 69000,
      precioParqueadero: 8000,
      ahora: new Date("2026-04-10T15:00:00.000Z"),
      fechaIngresoLead: new Date("2026-04-09T15:00:00.000Z"),
      ultimaGestion: new Date("2026-04-10T14:00:00.000Z"),
      fechaVisita: new Date("2026-04-20T15:00:00.000Z"),
    });

    const flags = getLeadAlertFlags(metrics, new Date("2026-04-12T15:00:00.000Z"), "ganado");

    expect(flags.altaPrioridadSinCierre).toBe(false);
    expect(flags.vencido).toBe(false);
    expect(flags.sinGestion).toBe(false);
    expect(flags.visitaProximaSinGestion).toBe(false);
    expect(flags.requiereAtencion).toBe(false);

    vi.useRealTimers();
  });
});

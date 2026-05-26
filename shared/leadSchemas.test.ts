import { describe, expect, it } from "vitest";
import { appSettingsInputSchema, leadCreateSchema, summarizeLeadActivityTimeline } from "./leadSchemas";

describe("shared/leadSchemas appSettingsInputSchema", () => {
  const validSettings = {
    configName: "Configuración comercial principal",
    precioMultiple: 120000,
    precioJunior: 85000,
    precioSenior: 95000,
    precioParqueadero: 15000,
    ticketPromedioReferencia: 90000,
    minimoPersonasAmarillo: 25,
    minimoPersonasRojo: 60,
    minimoValorAmarillo: 2500000,
    minimoValorRojo: 6000000,
    diasUrgenciaAlta: 3,
    horasLeadCaliente: 24,
    scoreAltoThreshold: 80,
    metaIngresosMensual: 50000000,
    comisionPorcentaje: 5,
    calendarSyncEnabled: false,
    googleCalendarId: "",
    emailAlertsEnabled: false,
    smsAlertsEnabled: false,
    alertEmailTo: "",
    alertSmsTo: "",
  };

  it("acepta una configuración operativa válida sin integraciones activas", () => {
    const result = appSettingsInputSchema.safeParse(validSettings);

    expect(result.success).toBe(true);
  });

  it("rechaza umbrales rojos por debajo de los umbrales amarillos", () => {
    const result = appSettingsInputSchema.safeParse({
      ...validSettings,
      minimoPersonasAmarillo: 30,
      minimoPersonasRojo: 20,
      minimoValorAmarillo: 3000000,
      minimoValorRojo: 2500000,
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.minimoPersonasRojo).toContain(
      "El umbral rojo de personas no puede quedar por debajo del amarillo.",
    );
    expect(result.error?.flatten().fieldErrors.minimoValorRojo).toContain(
      "El umbral rojo de valor no puede quedar por debajo del amarillo.",
    );
  });

  it("exige ID de calendario cuando se activa la sincronización", () => {
    const result = appSettingsInputSchema.safeParse({
      ...validSettings,
      calendarSyncEnabled: true,
      googleCalendarId: " ",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.googleCalendarId).toContain(
      "Activa Calendar solo si también defines el ID del calendario.",
    );
  });

  it("exige un correo válido cuando se activan las alertas por email", () => {
    const missingEmail = appSettingsInputSchema.safeParse({
      ...validSettings,
      emailAlertsEnabled: true,
      alertEmailTo: "",
    });
    const invalidEmail = appSettingsInputSchema.safeParse({
      ...validSettings,
      alertEmailTo: "ventas-interno",
    });

    expect(missingEmail.success).toBe(false);
    expect(missingEmail.error?.flatten().fieldErrors.alertEmailTo).toContain(
      "Activa alertas por correo solo si defines un correo destino.",
    );
    expect(invalidEmail.success).toBe(false);
    expect(invalidEmail.error?.flatten().fieldErrors.alertEmailTo).toContain(
      "Ingresa un correo válido para las alertas.",
    );
  });

  it("exige un número válido cuando se activan las alertas SMS", () => {
    const missingSms = appSettingsInputSchema.safeParse({
      ...validSettings,
      smsAlertsEnabled: true,
      alertSmsTo: "",
    });
    const invalidSms = appSettingsInputSchema.safeParse({
      ...validSettings,
      alertSmsTo: "300-ABC",
    });

    expect(missingSms.success).toBe(false);
    expect(missingSms.error?.flatten().fieldErrors.alertSmsTo).toContain(
      "Activa SMS solo si defines un número destino.",
    );
    expect(invalidSms.success).toBe(false);
    expect(invalidSms.error?.flatten().fieldErrors.alertSmsTo).toContain(
      "El número de SMS debe tener entre 10 y 15 dígitos.",
    );
  });
});


describe("shared/leadSchemas leadCreateSchema", () => {
  const validLead = {
    nombreCliente: "María Gómez",
    nombreEmpresa: "Eventos Andinos",
    ciudad: "Bogotá",
    telefono: "3001234567",
    correo: "maria@eventosandinos.com",
    canalOrigen: "whatsapp",
    fechaVisita: new Date("2026-04-15T15:00:00.000Z").getTime(),
    motivoVisita: "Cotización para salida pedagógica.",
    tipoEvento: "experiencia",
    objecionPrincipal: "Esperando aprobación presupuestal.",
    cantidadMultiple: 8,
    cantidadJunior: 2,
    cantidadSenior: 1,
    cantidadParqueadero: 1,
    precioMultiple: 99000,
    precioJunior: 69000,
    precioSenior: 69000,
    precioParqueadero: 8000,
    fechaLimiteGestion: new Date("2026-04-13T15:00:00.000Z").getTime(),
    proximaAccion: "Enviar propuesta final.",
    notasInternas: "Cliente con decisión esta semana.",
    motivoPerdido: "",
    motivoPausa: "",
    leadPartyKind: "empresa",
  } as const;

  it("acepta un lead empresarial válido y mantiene el motivo de viaje dentro del catálogo visible", () => {
    const result = leadCreateSchema.safeParse(validLead);

    expect(result.success).toBe(true);
    expect(result.data?.leadPartyKind).toBe("empresa");
    expect(result.data?.tipoEvento).toBe("experiencia");
  });

  it("rechaza registros empresariales sin nombre de empresa", () => {
    const result = leadCreateSchema.safeParse({
      ...validLead,
      nombreEmpresa: "",
      leadPartyKind: "empresa",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.nombreEmpresa).toContain(
      "Si eliges empresa, debes registrar el nombre de la empresa o cuenta.",
    );
  });

  it("rechaza motivos de viaje fuera de las opciones familiar, empresarial y educativo", () => {
    const result = leadCreateSchema.safeParse({
      ...validLead,
      leadPartyKind: "persona",
      nombreEmpresa: "",
      tipoEvento: "otro",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.tipoEvento).toBeDefined();
  });
});

describe("shared/leadSchemas summarizeLeadActivityTimeline", () => {
  it("resume eventos del sistema, automatizaciones y cambios sensibles", () => {
    const summary = summarizeLeadActivityTimeline([
      { activityType: "lead_created", createdAt: 1710000000000 },
      { activityType: "calendar_sync", createdAt: 1710000001000 },
      { activityType: "alert_sent", createdAt: 1710000002000 },
      { activityType: "sensitive_fields_changed", createdAt: 1710000003000 },
      { activityType: "note_added", createdAt: 1710000004000 },
    ]);

    expect(summary.systemCount).toBe(4);
    expect(summary.automationCount).toBe(2);
    expect(summary.sensitiveChangesCount).toBe(1);
    expect(summary.latestAutomationAt).toBe(1710000002000);
    expect(summary.latestSensitiveChangeAt).toBe(1710000003000);
  });

  it("ignora fechas inválidas sin romper el resumen", () => {
    const summary = summarizeLeadActivityTimeline([
      { activityType: "sensitive_fields_changed", createdAt: "fecha-invalida" },
      { activityType: "calendar_sync", createdAt: null },
    ]);

    expect(summary.systemCount).toBe(2);
    expect(summary.automationCount).toBe(1);
    expect(summary.sensitiveChangesCount).toBe(1);
    expect(summary.latestAutomationAt).toBeNull();
    expect(summary.latestSensitiveChangeAt).toBeNull();
  });
});

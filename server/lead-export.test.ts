import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildLeadWorkbookBuffer, type LeadExportRow } from "./services/leadExport";

describe("buildLeadWorkbookBuffer", () => {
  it("genera un archivo Excel estructurado con el ID CRM único y los campos principales", () => {
    const rows: LeadExportRow[] = [
      {
        id: 17,
        publicId: "LD-2026-00017",
        nombreCliente: "María Gómez",
        nombreEmpresa: "Eventos Andinos",
        ciudad: "Bogotá",
        telefono: "3001234567",
        correo: "maria@eventosandinos.com",
        estadoLead: "propuesta",
        prioridad: "rojo",
        temperatura: "caliente",
        canalOrigen: "whatsapp",
        tipoEvento: "corporativo",
        motivoVisita: "Cotización desayuno empresarial",
        objecionPrincipal: "Presupuesto ajustado",
        cantidadMultiple: 120,
        cantidadJunior: 40,
        cantidadSenior: 10,
        cantidadParqueadero: 8,
        precioMultiple: 99000,
        precioJunior: 69000,
        precioSenior: 69000,
        precioParqueadero: 8000,
        subtotalMultiple: 11880000,
        subtotalJunior: 2760000,
        subtotalSenior: 690000,
        subtotalParqueadero: 64000,
        totalPersonas: 170,
        valorTotal: 15394000,
        ticketPromedio: 90552,
        scoreCantidad: 30,
        scoreValorTotal: 28,
        scoreTicketPromedio: 10,
        scoreUrgencia: 12,
        scoreRecencia: 8,
        scoreTotal: 88,
        agenteResponsable: "Laura Pérez",
        agenteUserId: 9,
        fechaIngresoLead: 1775000000000,
        fechaVisita: 1775086400000,
        fechaLimiteGestion: 1775043200000,
        ultimaGestion: 1775010800000,
        proximaAccion: "Llamar para confirmar aforo y menú",
        notasInternas: "Cliente pidió dos alternativas de montaje.",
        motivoPerdido: "",
        motivoPausa: "",
        lastActivityAt: 1775010800000,
        calendarEventId: "evt_123",
        calendarEventUrl: "https://calendar.test/event/evt_123",
        calendarSyncStatus: "success",
        calendarSyncMessage: "Sincronizado",
        alertPending: true,
        alertLastChannel: "email",
        alertLastMessage: "Seguimiento pendiente para hoy",
        lastAlertAt: 1775014400000,
        diasHastaVisita: 2,
        horasDesdeUltimaGestion: 5,
        diasParaCierre: 3,
        isClosed: false,
        createdByUserId: 2,
        updatedByUserId: 9,
        createdAt: new Date("2026-04-10T10:00:00.000Z"),
        updatedAt: new Date("2026-04-10T15:30:00.000Z"),
      },
    ];

    const buffer = buildLeadWorkbookBuffer(rows);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(sheet, {
      header: 1,
      raw: false,
    });

    expect(workbook.SheetNames[0]).toBe("CRM Leads");
    expect(matrix[0]).toContain("ID CRM");
    expect(matrix[0]).toContain("Cliente");
    expect(matrix[0]).toContain("Clasificación comercial");
    expect(matrix[0]).toContain("Motivo de viaje");
    expect(matrix[0]).toContain("Valor total");
    expect(matrix[1]?.[0]).toBe("LD-2026-00017");
    expect(matrix[1]).toContain("María Gómez");
    expect(matrix[1]).toContain("Eventos Andinos");
    expect(matrix[1]).toContain("Empresa");
    expect(matrix[1]).toContain("Empresarial");
    expect(matrix[1]).toContain("15394000");
  });

  it("normaliza la clasificación comercial y el motivo de viaje aunque lleguen valores históricos", () => {
    const rows: LeadExportRow[] = [
      {
        publicId: "LD-2026-00018",
        nombreCliente: "Andrés Ríos",
        nombreEmpresa: "",
        tipoEvento: "reunion",
        createdAt: new Date("2026-04-10T10:00:00.000Z"),
        updatedAt: new Date("2026-04-10T15:30:00.000Z"),
      },
    ];

    const buffer = buildLeadWorkbookBuffer(rows);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(sheet, {
      header: 1,
      raw: false,
    });

    expect(matrix[1]).toContain("Persona");
    expect(matrix[1]).toContain("Empresarial");
  });
});

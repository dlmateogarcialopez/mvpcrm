import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// Servir archivos estáticos del build
const publicDir = path.join(__dirname, "dist", "public");
app.use(express.static(publicDir));

// Mock API para tRPC
app.use(express.json());

// Datos mock
const mockUser = {
  id: 1,
  openId: "test-user-123",
  name: "Usuario Demo",
  email: "demo@example.com",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSettings = {
  id: 1,
  configName: "Configuración principal",
  precioMultiple: 150000,
  precioJunior: 100000,
  precioSenior: 200000,
  precioParqueadero: 50000,
  ticketPromedioReferencia: 125000,
  minimoPersonasAmarillo: 5,
  minimoPersonasRojo: 15,
  minimoValorAmarillo: 1000000,
  minimoValorRojo: 3000000,
  diasUrgenciaAlta: 7,
  horasLeadCaliente: 24,
  scoreAltoThreshold: 80,
  metaIngresosMensual: 50000000,
  comisionPorcentaje: 15,
  calendarSyncEnabled: false,
  googleCalendarId: "",
  emailAlertsEnabled: false,
  smsAlertsEnabled: false,
  alertEmailTo: "",
  alertSmsTo: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLeads = [
  {
    id: 1,
    publicId: "LEAD-001",
    nombreCliente: "Juan García",
    telefono: "3001234567",
    correo: "juan@example.com",
    nombreEmpresa: "Empresa A",
    ciudad: "Bogotá",
    canalOrigen: "referencia",
    tipoEvento: "viaje_negocios",
    estadoLead: "nuevo",
    proximaAccion: "Llamar mañana",
    fechaVisita: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    fechaLimiteGestion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    valorTotal: 2500000,
    cantidadMultiple: 5,
    cantidadJunior: 3,
    cantidadSenior: 2,
    cantidadParqueadero: 2,
    prioridad: "rojo",
    prioridadBase: "amarillo",
    scoreTotal: 85,
    scoreCantidad: 25,
    scoreValorTotal: 30,
    scoreTicketPromedio: 20,
    scoreUrgencia: 10,
    scoreRecencia: 0,
    agenteResponsable: "Carlos López",
    agenteUserId: 2,
    ultimaGestion: new Date(Date.now() - 2 * 60 * 60 * 1000),
    alertPending: false,
    lastAlertAt: null,
    alertLastChannel: null,
    alertLastMessage: null,
    calendarSyncStatus: "inactive",
    calendarSyncMessage: null,
    notasInternas: "Cliente muy interesado",
    motivoPerdido: null,
    motivoPausa: null,
    totalPersonas: 10,
    ticketPromedio: 250000,
    diasHastaVisita: 7,
    horasDesdeUltimaGestion: 2,
    isClosed: false,
    isOverdue: false,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    fechaIngresoLead: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    id: 2,
    publicId: "LEAD-002",
    nombreCliente: "María Rodríguez",
    telefono: "3009876543",
    correo: "maria@example.com",
    nombreEmpresa: "Empresa B",
    ciudad: "Medellín",
    canalOrigen: "web",
    tipoEvento: "evento_corporativo",
    estadoLead: "contactado",
    proximaAccion: "Enviar propuesta",
    fechaVisita: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    fechaLimiteGestion: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    valorTotal: 5000000,
    cantidadMultiple: 10,
    cantidadJunior: 5,
    cantidadSenior: 5,
    cantidadParqueadero: 3,
    prioridad: "amarillo",
    prioridadBase: "amarillo",
    scoreTotal: 65,
    scoreCantidad: 30,
    scoreValorTotal: 25,
    scoreTicketPromedio: 10,
    scoreUrgencia: 0,
    scoreRecencia: 0,
    agenteResponsable: "Ana Martínez",
    agenteUserId: 3,
    ultimaGestion: new Date(Date.now() - 24 * 60 * 60 * 1000),
    alertPending: false,
    lastAlertAt: null,
    alertLastChannel: null,
    alertLastMessage: null,
    calendarSyncStatus: "inactive",
    calendarSyncMessage: null,
    notasInternas: "Espera aprobación de presupuesto",
    motivoPerdido: null,
    motivoPausa: null,
    totalPersonas: 20,
    ticketPromedio: 250000,
    diasHastaVisita: 14,
    horasDesdeUltimaGestion: 24,
    isClosed: false,
    isOverdue: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    fechaIngresoLead: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
];

// Mock endpoints de tRPC
app.post("/api/trpc/*", (req, res) => {
  const path = req.path;

  // Rutas de autenticación
  if (path.includes("auth.me")) {
    return res.json({ result: { data: mockUser } });
  }

  // Rutas de settings
  if (path.includes("settings.get")) {
    return res.json({ result: { data: mockSettings } });
  }

  if (path.includes("settings.team")) {
    return res.json({
      result: {
        data: [
          { id: 2, name: "Carlos López", role: "agent", email: "carlos@example.com" },
          { id: 3, name: "Ana Martínez", role: "agent", email: "ana@example.com" },
        ],
      },
    });
  }

  if (path.includes("settings.history")) {
    return res.json({ result: { data: [] } });
  }

  if (path.includes("settings.update")) {
    return res.json({ result: { data: mockSettings } });
  }

  // Rutas de leads
  if (path.includes("leads.list")) {
    return res.json({ result: { data: mockLeads } });
  }

  if (path.includes("leads.get")) {
    return res.json({ result: { data: mockLeads[0] } });
  }

  if (path.includes("leads.dashboard")) {
    return res.json({
      result: {
        data: {
          summary: {
            totalLeads: mockLeads.length,
            closedLeads: 0,
            closedRevenue: 0,
            estimatedCommission: 1125000,
          },
          pipeline: [
            { status: "nuevo", count: 1, value: 2500000 },
            { status: "contactado", count: 1, value: 5000000 },
          ],
          byAgent: [
            { name: "Carlos López", count: 1, value: 2500000, closedCount: 0 },
            { name: "Ana Martínez", count: 1, value: 5000000, closedCount: 0 },
          ],
          byCity: [
            { city: "Bogotá", count: 1, value: 2500000 },
            { city: "Medellín", count: 1, value: 5000000 },
          ],
          upcomingVisits: mockLeads,
          urgentRows: mockLeads.slice(0, 1),
          overdueRows: [],
          unattendedRows: [],
          recentRows: mockLeads,
        },
      },
    });
  }

  // Rutas de automatización (NUEVAS)
  if (path.includes("automation.listStages")) {
    return res.json({
      result: {
        data: [
          { id: "1", name: "Nuevo", color: "#3b82f6", order: 1 },
          { id: "2", name: "Contactado", color: "#8b5cf6", order: 2 },
          { id: "3", name: "Propuesta", color: "#f59e0b", order: 3 },
          { id: "4", name: "Negociación", color: "#ef4444", order: 4 },
          { id: "5", name: "Ganado", color: "#10b981", order: 5 },
        ],
      },
    });
  }

  if (path.includes("automation.listLabels")) {
    return res.json({
      result: {
        data: [
          { id: "1", name: "VIP", color: "#fbbf24", description: "Clientes de alto valor" },
          { id: "2", name: "Seguimiento", color: "#60a5fa", description: "Requiere seguimiento" },
          { id: "3", name: "Descuento", color: "#34d399", description: "Aplicar descuento" },
          { id: "4", name: "Urgente", color: "#f87171", description: "Requiere atención inmediata" },
        ],
      },
    });
  }

  if (path.includes("automation.listChannels")) {
    return res.json({
      result: {
        data: [
          { id: "1", name: "WhatsApp", icon: "MessageSquare", isActive: true },
          { id: "2", name: "Email", icon: "Mail", isActive: true },
          { id: "3", name: "Facebook", icon: "Facebook", isActive: true },
          { id: "4", name: "Instagram", icon: "Instagram", isActive: true },
        ],
      },
    });
  }

  if (path.includes("automation.listRules")) {
    return res.json({
      result: {
        data: [
          { id: "1", name: "Asignar leads nuevos", trigger: "lead_created", action: "assign_agent", isActive: true, executionCount: 45 },
          { id: "2", name: "Alerta Telegram VIP", trigger: "label_added", action: "send_telegram", isActive: true, executionCount: 12 },
        ],
      },
    });
  }

  if (path.includes("automation.listCampaigns")) {
    return res.json({
      result: {
        data: [
          { id: "1", name: "Bienvenida", subject: "Hola!", status: "sent", totalSent: 100, totalOpened: 45, totalClicked: 10 },
        ],
      },
    });
  }

  // Default response
  res.json({ result: { data: null } });
});

// Servir index.html para rutas no encontradas (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ Servidor mock v5-Pro corriendo en http://localhost:${PORT}`);
  console.log(`📊 Accede a la aplicación en http://localhost:${PORT}`);
  console.log(`\n🔑 Usuario demo: ${mockUser.email}`);
  console.log(`📝 Rol: ${mockUser.role}\n`);
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const {
  getCommercialTeamMock,
  getAppSettingsHistoryMock,
  updateUserRoleMock,
  getAppSettingsMock,
  updateAppSettingsMock,
} = vi.hoisted(() => ({
  getCommercialTeamMock: vi.fn(),
  getAppSettingsHistoryMock: vi.fn(),
  updateUserRoleMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  updateAppSettingsMock: vi.fn(),
}));

vi.mock("./db", () => ({
  getAppSettings: getAppSettingsMock,
  getAppSettingsHistory: getAppSettingsHistoryMock,
  getCommercialTeam: getCommercialTeamMock,
  updateAppSettings: updateAppSettingsMock,
  updateUserRole: updateUserRoleMock,
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: AuthenticatedUser["role"] = "admin" as AuthenticatedUser["role"]): TrpcContext {
  const user = {
    id: 99,
    openId: "settings-test-user",
    email: "settings@example.com",
    name: "Settings Test",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthenticatedUser;

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };
}

describe("settings router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppSettingsMock.mockResolvedValue({
      configName: "Máquina de ventas",
      precioMultiple: 1,
      precioJunior: 1,
      precioSenior: 1,
      precioParqueadero: 1,
      metaIngresosMensual: 1000000,
      comisionPorcentaje: 5,
      calendarSyncEnabled: false,
      calendarDefaultDurationMinutes: 60,
      resendAudienceId: null,
      notifyOnNewLead: true,
      notifyOnCriticalLead: true,
      defaultCity: "Bogotá",
    });
    updateAppSettingsMock.mockResolvedValue({ success: true });
    getAppSettingsHistoryMock.mockResolvedValue([]);
  });

  it("expone el catálogo del equipo comercial para el usuario autenticado", async () => {
    const team = [
      {
        id: 1,
        name: "Laura Agente",
        email: "laura@example.com",
        role: "agent",
        roleLabel: "Agente",
        lastSignedIn: Date.now(),
        canEdit: true,
      },
    ];
    getCommercialTeamMock.mockResolvedValue(team);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.settings.team();

    expect(result).toEqual(team);
    expect(getCommercialTeamMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, role: "admin" }),
    );
  });

  it("expone la bitácora reciente de Configuración para el usuario autenticado", async () => {
    const history = [
      {
        id: 1,
        changedAt: Date.now(),
        changedByName: "Laura Admin",
        changedByEmail: "laura@example.com",
        summary: "Meta mensual y comisión actualizadas",
        changeCount: 2,
        fields: [
          { field: "metaIngresosMensual", label: "Meta de ingresos mensual" },
          { field: "comisionPorcentaje", label: "Comisión" },
        ],
      },
    ];
    getAppSettingsHistoryMock.mockResolvedValue(history);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.settings.history();

    expect(result).toEqual(history);
    expect(getAppSettingsHistoryMock).toHaveBeenCalledWith();
  });

  it("delegates role updates to the backend helper when the caller is admin", async () => {
    updateUserRoleMock.mockResolvedValue({
      success: true,
      user: {
        id: 7,
        role: "agent",
      },
    });

    const caller = appRouter.createCaller(createContext("admin" as AuthenticatedUser["role"]));
    const input = { userId: 7, role: "agent" as const };
    const result = await caller.settings.updateUserRole(input);

    expect(result).toEqual({
      success: true,
      user: {
        id: 7,
        role: "agent",
      },
    });
    expect(updateUserRoleMock).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ id: 99, role: "admin" }),
    );
  });

  it("bloquea el cambio de rol cuando el usuario no tiene permisos de administrador", async () => {
    const caller = appRouter.createCaller(createContext("agent" as AuthenticatedUser["role"]));

    await expect(caller.settings.updateUserRole({ userId: 7, role: "agent" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(updateUserRoleMock).not.toHaveBeenCalled();
  });

  it("propaga el bloqueo de autoedición de rol definido por la capa de datos", async () => {
    updateUserRoleMock.mockRejectedValue(new Error("No puedes modificar tu propio rol desde esta pantalla."));

    const caller = appRouter.createCaller(createContext("admin" as AuthenticatedUser["role"]));

    await expect(caller.settings.updateUserRole({ userId: 99, role: "agent" })).rejects.toThrow(
      "No puedes modificar tu propio rol desde esta pantalla.",
    );
    expect(updateUserRoleMock).toHaveBeenCalledWith(
      { userId: 99, role: "agent" },
      expect.objectContaining({ id: 99, role: "admin" }),
    );
  });

  it("propaga la restricción de superadmin cuando un admin intenta gestionar ese rol", async () => {
    updateUserRoleMock.mockRejectedValue(new Error("Solo un superadministrador puede gestionar ese rol."));

    const caller = appRouter.createCaller(createContext("admin" as AuthenticatedUser["role"]));

    await expect(caller.settings.updateUserRole({ userId: 7, role: "superadmin" })).rejects.toThrow(
      "Solo un superadministrador puede gestionar ese rol.",
    );
    expect(updateUserRoleMock).toHaveBeenCalledWith(
      { userId: 7, role: "superadmin" },
      expect.objectContaining({ id: 99, role: "admin" }),
    );
  });
});

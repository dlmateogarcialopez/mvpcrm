import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Microcopy visible de Configuración", () => {
  it("expone el resumen del último cambio y la bitácora reciente en SettingsPage", () => {
    const source = readProjectFile("client/src/pages/SettingsPage.tsx");

    const requiredVisibleCopy = [
      "Último cambio registrado",
      "Último cambio confirmado",
      "Bitácora reciente de Configuración",
      "Este resumen deja visible qué cambio sensible se aplicó, quién lo guardó y cuáles campos quedaron afectados.",
      "Histórico simple para auditoría operativa del MVP.",
      "Cargando historial reciente de Configuración...",
      "No fue posible cargar la bitácora reciente de Configuración.",
      "Aún no se han guardado cambios sensibles en la Configuración.",
      "Impacto operativo de este guardado",
      "El resumen te muestra si este guardado mueve prioridades, agenda o alertas antes de confirmar cambios sensibles.",
      "Activa la sincronización para habilitar este campo sensible y registrar el calendario operativo.",
      "Activa alertas por correo para habilitar este destino y evitar configuraciones sensibles a medias.",
      "Activa alertas SMS para habilitar este número y proteger la configuración sensible del canal.",
    ];

    requiredVisibleCopy.forEach(copy => {
      expect(source).toContain(copy);
    });
  });

  it("protege los campos sensibles con bloqueos contextuales en el código fuente", () => {
    const source = readProjectFile("client/src/pages/SettingsPage.tsx");

    expect(source).toContain('disabled={calendarFieldLocked}');
    expect(source).toContain('disabled={emailFieldLocked}');
    expect(source).toContain('disabled={smsFieldLocked}');
    expect(source).toContain('const impactCards = useMemo(() => getSettingsImpactCards(pendingChanges), [pendingChanges]);');
  });
});

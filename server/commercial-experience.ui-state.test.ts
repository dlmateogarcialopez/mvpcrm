import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const homeSource = read("client/src/pages/Home.tsx");
const leadsSource = read("client/src/pages/LeadsPage.tsx");
const settingsSource = read("client/src/pages/SettingsPage.tsx");
const notFoundSource = read("client/src/pages/NotFound.tsx");
const errorBoundarySource = read("client/src/components/ErrorBoundary.tsx");

describe("experiencia comercial visible del MVP", () => {
  it("mantiene estados críticos claros y orientados a ingresos en las pantallas principales", () => {
    expect(homeSource).toContain("Cargando resumen comercial...");
    expect(homeSource).toContain("ingresos ganados y comisión estimada");
    expect(homeSource).toContain("Próximas visitas");

    expect(leadsSource).toContain("Registrar y agendar en pocos pasos");
    expect(leadsSource).toContain("Entregar y cobrar");
    expect(leadsSource).toContain("Resumen comercial");
    expect(leadsSource).toContain("Actualizar alertas y agenda");

    expect(settingsSource).toContain("Configuración comercial de Máquina de ventas");
    expect(settingsSource).toContain("La misma aplicación sirve para ambos perfiles comerciales");
    expect(settingsSource).toContain("Impacto operativo de este guardado");
    expect(settingsSource).toContain("Cargando la configuración operativa de Máquina de ventas...");
  });

  it("mantiene estados globales consistentes con el lenguaje comercial del producto", () => {
    expect(notFoundSource).toContain("Esta vista no está disponible");
    expect(notFoundSource).toContain("Vuelve al resumen comercial para retomar la operación.");
    expect(notFoundSource).toContain("Ir al resumen comercial");

    expect(errorBoundarySource).toContain("La operación se interrumpió de forma inesperada.");
    expect(errorBoundarySource).toContain("Reintentar la operación");
  });
});

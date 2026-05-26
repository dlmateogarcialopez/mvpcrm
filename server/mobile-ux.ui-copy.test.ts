import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Optimizaciones mobile y modal de confirmación", () => {
  it("LeadsPage incluye el botón de filtros colapsables para mobile", () => {
    const source = readProjectFile("client/src/pages/LeadsPage.tsx");

    expect(source).toContain("Filtros de búsqueda");
    expect(source).toContain("filtersExpanded");
    expect(source).toContain("Cerrar filtros");
    expect(source).toContain("Volver al listado");
    expect(source).toContain("detailPanelOpen");
  });

  it("LeadsPage oculta columnas secundarias en mobile y muestra info clave compacta", () => {
    const source = readProjectFile("client/src/pages/LeadsPage.tsx");

    // Columnas ocultas en mobile (sm:block)
    expect(source).toContain("hidden sm:block");
    // Encabezado de tabla oculto en mobile (sm:grid)
    expect(source).toContain("sm:grid");
    // Info compacta visible solo en mobile
    expect(source).toContain("sm:hidden");
  });

  it("SettingsPage usa diálogo modal en lugar de window.confirm para cambios sensibles", () => {
    const source = readProjectFile("client/src/pages/SettingsPage.tsx");

    // Debe tener el estado del modal (showConfirmDialog)
    expect(source).toContain("showConfirmDialog");
    // No debe usar window.confirm
    expect(source).not.toContain("window.confirm");
    // Debe tener el botón de confirmación en el modal
    expect(source).toContain("Confirmar y guardar");
    // Debe tener el botón de cancelación
    expect(source).toContain("Cancelar y revisar");
  });

  it("SettingsPage muestra validaciones de umbrales con feedback inline", () => {
    const source = readProjectFile("client/src/pages/SettingsPage.tsx");

    expect(source).toContain("thresholdErrors");
    expect(source).toContain("minimoPersonasRojo");
    expect(source).toContain("minimoValorRojo");
    expect(source).toContain("diasUrgenciaAlta");
    expect(source).toContain("horasLeadCaliente");
    expect(source).toContain("scoreAltoThreshold");
    expect(source).toContain("hasThresholdErrors");
  });

  it("Home incluye barras de progreso en el reporte por agente con comisión proyectada", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");

    expect(source).toContain("Oportunidades abiertas por responsable");
    expect(source).toContain("Comisión proyectada");
    // Componente de barra de progreso
    expect(source).toContain("ProgressBar");
    // Tono de color para agentes
    expect(source).toContain("bg-violet-500");
  });

  it("Home incluye métricas de valor total en el reporte por ciudad", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");

    expect(source).toContain("Dónde se están moviendo las oportunidades en curso para decidir el foco comercial.");
    expect(source).toContain("Valor total");
    // Tono de color para ciudades
    expect(source).toContain("bg-emerald-500");
  });

  it("Home muestra el indicador de Conversión en el reporte por agente", () => {
    const source = readProjectFile("client/src/pages/Home.tsx");

    expect(source).toContain("Conversión");
  });
});

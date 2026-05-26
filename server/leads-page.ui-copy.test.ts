import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const visibleClientFiles = [
  "client/src/pages/Home.tsx",
  "client/src/pages/LeadsPage.tsx",
  "client/src/components/DashboardLayout.tsx",
  "client/src/components/ErrorBoundary.tsx",
  "client/src/pages/NotFound.tsx",
] as const;

describe("Microcopy visible del CRM", () => {
  it("expone en LeadsPage el botón de exportación, el identificador único del CRM y el lenguaje comercial principal", () => {
    const source = readProjectFile("client/src/pages/LeadsPage.tsx");

    expect(source).toContain("Operación comercial diaria");
    expect(source).toContain("Exportar Excel");
    expect(source).toContain("ID CRM");
    expect(source).toContain("ID único CRM");
    expect(source).toContain("exportSpreadsheetMutation");
    expect(source).toContain("Qué significa cada etapa del proceso comercial");
    expect(source).toContain("Captura rápida");
    expect(source).toContain("oportunidad nueva");
    expect(source).toContain("Seguimiento y cierre");
    expect(source).toContain("Glosario comercial corto");
    expect(source).toContain("4. Puntaje inicial");
    expect(source).toContain("Prioridad al guardar");
    expect(source).toContain("Reglas que explican la prioridad");
  });

  it("mantiene evidencia explícita del panel de trabajo y del bloque de puntaje inicial en LeadsPage", () => {
    const source = readProjectFile("client/src/pages/LeadsPage.tsx");

    const requiredVisibleCopy = [
      "Oportunidad",
      "Próximo paso",
      "Cargando embudo comercial...",
      "No hay oportunidades que coincidan con los filtros actuales.",
      "Resumen comercial",
      "ver su resumen comercial",
      "Bloque de contacto",
      "Clasificación comercial",
      "Contexto de la oportunidad",
      "Actualizar oportunidad sin salir de esta vista",
      "Guardar cambios rápidos",
      "Prioridad sustentada por {selectedLead.scoreTotal} puntos.",
      "4. Puntaje inicial",
      "Prioridad al guardar",
      "Se calcula con puntaje, volumen, valor y urgencia usando la configuración activa.",
      "Reglas que explican la prioridad",
      "Checklist rápido antes de guardar",
    ];

    requiredVisibleCopy.forEach(copy => {
      expect(source).toContain(copy);
    });
  });

  it("mantiene los estados del detalle y las acciones rápidas con lenguaje comercial consistente", () => {
    const source = readProjectFile("client/src/pages/LeadsPage.tsx");

    const requiredDetailCopy = [
      "Consulta contacto, siguiente paso, valor, prioridad e historial de la oportunidad seleccionada desde un solo lugar.",
      "Selecciona una oportunidad del listado o crea una nueva para ver su resumen comercial.",
      "Cargando panel de la oportunidad...",
      "No fue posible recuperar el panel de la oportunidad seleccionada.",
      "Contacto principal",
      "Clasificación comercial",
      "Guardar cambios rápidos",
      "Marcar como {leadStatusLabels[status].toLowerCase()}",
      "Resumen del flujo",
      "Resumen accionable por etapa",
      "Próxima acción:",
      "Fecha compromiso:",
      "Después podrás moverla por etapas y registrar avances desde el panel de trabajo.",
      "Por qué esta oportunidad tiene esta prioridad",
      "Base: {leadPriorityLabels[selectedLead.prioridadBase]}",
      "Final: {leadPriorityLabels[selectedLead.prioridad]}",
      "Puntaje total",
      "Estado de agenda",
      "Sincronizaciones de agenda y alertas disparadas desde el sistema con la configuración actual.",
      "Motivo de viaje:",
      "etapa actual del proceso",
      "no enfriar la oportunidad",
    ];

    requiredDetailCopy.forEach(copy => {
      expect(source).toContain(copy);
    });
  });

  it("evita la reaparición de textos visibles antiguos en las zonas principales de LeadsPage", () => {
    const source = readProjectFile("client/src/pages/LeadsPage.tsx");

    const forbiddenVisibleCopy = [
      "Nuevo negocio",
      "Mis negocios",
      "No hay negocios que coincidan con los filtros actuales.",
      "Resumen de cotización",
      "4. Calificación inicial",
      "Calificación total",
      "Mover negocio sin salir del panel",
      "Historial del negocio",
      "Cargando panel del negocio...",
      "Guardar negocio",
      "Panel de trabajo",
      "ver su panel de trabajo",
      "Mover oportunidad sin salir del panel",
      "Guardar panel",
      "Puntaje total:",
      "Estado de calendar",
      "Calendar sync",
    ];

    forbiddenVisibleCopy.forEach(copy => {
      expect(source).not.toContain(copy);
    });
  });

  it("bloquea términos visibles antiguos en páginas y componentes principales del cliente", () => {
    const sources = visibleClientFiles.map(path => readProjectFile(path));

    const forbiddenCrossUiCopy = [
      "Nuevo negocio",
      "Mis negocios",
      "No hay negocios que coincidan con los filtros actuales.",
      "Resumen de cotización",
      "Calificación inicial",
      "Calificación total",
      "panel del negocio",
      "dashboard operativo",
      "Recargar portada",
      "Qué podrás probar",
      "Volver al resumen",
      "Recargar la aplicación",
    ];

    sources.forEach(source => {
      forbiddenCrossUiCopy.forEach(copy => {
        expect(source).not.toContain(copy);
      });
    });
  });

  it("mantiene los estados globales y el acceso con lenguaje comercial consistente", () => {
    const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");
    const notFoundSource = readProjectFile("client/src/pages/NotFound.tsx");
    const errorBoundarySource = readProjectFile("client/src/components/ErrorBoundary.tsx");

    expect(layoutSource).toContain("Entrar a Máquina de ventas");
    expect(layoutSource).toContain("Qué podrás operar");
    expect(layoutSource).toContain("Embudo y prioridad comercial");
    expect(layoutSource).not.toContain("Recargar portada");
    expect(layoutSource).not.toContain("Qué podrás probar");

    expect(notFoundSource).toContain("Esta vista no está disponible");
    expect(notFoundSource).toContain("Ir al resumen comercial");
    expect(notFoundSource).not.toContain("La sección que intentas abrir no está activa en este momento.");
    expect(notFoundSource).not.toContain("Volver al resumen");

    expect(errorBoundarySource).toContain("La operación se interrumpió de forma inesperada.");
    expect(errorBoundarySource).toContain("Reintentar la operación");
    expect(errorBoundarySource).not.toContain("Ocurrió un error inesperado en la operación.");
    expect(errorBoundarySource).not.toContain("Recargar la aplicación");
  });
});

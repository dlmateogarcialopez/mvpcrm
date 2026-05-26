import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("Home microcopy comercial", () => {
  it("mantiene el lenguaje comercial unificado en la vista principal", () => {
    expect(homeSource).toContain("Cargando resumen comercial...");
    expect(homeSource).toContain("oportunidades marcadas como ganadas");
    expect(homeSource).toContain("Estados activos para entender dónde se concentran las oportunidades abiertas.");
    expect(homeSource).toContain("Oportunidades abiertas por responsable");
    expect(homeSource).toContain("Todavía no hay responsables con oportunidades abiertas.");
    expect(homeSource).toContain("Dónde se están moviendo las oportunidades en curso para decidir el foco comercial.");
    expect(homeSource).toContain("Aún no hay ciudades con oportunidades abiertas.");

    expect(homeSource).not.toContain("Cargando tablero operativo...");
    expect(homeSource).not.toContain("negocios marcados como ganados");
    expect(homeSource).not.toContain("dónde se concentra el negocio abierto");
    expect(homeSource).not.toContain("Negocio abierto por responsable");
    expect(homeSource).not.toContain("Todavía no hay responsables con negocio abierto.");
    expect(homeSource).not.toContain("Dónde se está moviendo el negocio en curso para decidir el foco comercial.");
    expect(homeSource).not.toContain("Aún no hay ciudades con negocio abierto.");
  });
});

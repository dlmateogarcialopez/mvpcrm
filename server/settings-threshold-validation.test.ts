import { describe, expect, it } from "vitest";

// Replica de la función getThresholdErrors de SettingsPage
// para validar la lógica de umbrales sin depender del DOM
interface ThresholdForm {
  minimoPersonasAmarillo: number;
  minimoPersonasRojo: number;
  minimoValorAmarillo: number;
  minimoValorRojo: number;
  diasUrgenciaAlta: number;
  horasLeadCaliente: number;
  scoreAltoThreshold: number;
}

function getThresholdErrors(form: ThresholdForm): Record<string, string> {
  const errors: Record<string, string> = {};

  if (form.minimoPersonasRojo < form.minimoPersonasAmarillo) {
    errors.minimoPersonasRojo = "El umbral rojo debe ser mayor o igual al amarillo.";
  }
  if (form.minimoValorRojo < form.minimoValorAmarillo) {
    errors.minimoValorRojo = "El umbral rojo de valor debe ser mayor o igual al amarillo.";
  }
  if (form.diasUrgenciaAlta < 1 || form.diasUrgenciaAlta > 30) {
    errors.diasUrgenciaAlta = "Debe estar entre 1 y 30 días.";
  }
  if (form.horasLeadCaliente < 1 || form.horasLeadCaliente > 168) {
    errors.horasLeadCaliente = "Debe estar entre 1 y 168 horas.";
  }
  if (form.scoreAltoThreshold < 1 || form.scoreAltoThreshold > 200) {
    errors.scoreAltoThreshold = "Debe estar entre 1 y 200 puntos.";
  }

  return errors;
}

describe("Validaciones de umbrales de puntaje y prioridad", () => {
  it("no genera errores con valores válidos y coherentes", () => {
    const errors = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });

    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("detecta cuando el umbral rojo de personas es menor que el amarillo", () => {
    const errors = getThresholdErrors({
      minimoPersonasAmarillo: 20,
      minimoPersonasRojo: 10, // inválido: rojo < amarillo
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });

    expect(errors.minimoPersonasRojo).toBeDefined();
    expect(errors.minimoPersonasRojo).toContain("mayor o igual al amarillo");
  });

  it("acepta umbrales iguales (amarillo === rojo) como válidos", () => {
    const errors = getThresholdErrors({
      minimoPersonasAmarillo: 10,
      minimoPersonasRojo: 10, // igual es válido
      minimoValorAmarillo: 2_000_000,
      minimoValorRojo: 2_000_000,
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });

    expect(errors.minimoPersonasRojo).toBeUndefined();
    expect(errors.minimoValorRojo).toBeUndefined();
  });

  it("detecta cuando el umbral rojo de valor es menor que el amarillo", () => {
    const errors = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 5_000_000,
      minimoValorRojo: 1_000_000, // inválido: rojo < amarillo
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });

    expect(errors.minimoValorRojo).toBeDefined();
    expect(errors.minimoValorRojo).toContain("mayor o igual al amarillo");
  });

  it("detecta días de urgencia fuera de rango (menor a 1)", () => {
    const errors = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 0, // inválido
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });

    expect(errors.diasUrgenciaAlta).toBeDefined();
    expect(errors.diasUrgenciaAlta).toContain("entre 1 y 30");
  });

  it("detecta días de urgencia fuera de rango (mayor a 30)", () => {
    const errors = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 31, // inválido
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });

    expect(errors.diasUrgenciaAlta).toBeDefined();
  });

  it("acepta el límite exacto de días de urgencia (1 y 30)", () => {
    const errorsMin = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 1,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });
    const errorsMax = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 30,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 80,
    });

    expect(errorsMin.diasUrgenciaAlta).toBeUndefined();
    expect(errorsMax.diasUrgenciaAlta).toBeUndefined();
  });

  it("detecta horas de oportunidad caliente fuera de rango", () => {
    const errorsLow = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 0, // inválido
      scoreAltoThreshold: 80,
    });
    const errorsHigh = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 169, // inválido
      scoreAltoThreshold: 80,
    });

    expect(errorsLow.horasLeadCaliente).toBeDefined();
    expect(errorsHigh.horasLeadCaliente).toBeDefined();
  });

  it("detecta puntaje de oportunidad caliente fuera de rango", () => {
    const errorsLow = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 0, // inválido
    });
    const errorsHigh = getThresholdErrors({
      minimoPersonasAmarillo: 5,
      minimoPersonasRojo: 15,
      minimoValorAmarillo: 1_000_000,
      minimoValorRojo: 3_000_000,
      diasUrgenciaAlta: 7,
      horasLeadCaliente: 24,
      scoreAltoThreshold: 201, // inválido
    });

    expect(errorsLow.scoreAltoThreshold).toBeDefined();
    expect(errorsHigh.scoreAltoThreshold).toBeDefined();
  });

  it("puede acumular múltiples errores simultáneamente", () => {
    const errors = getThresholdErrors({
      minimoPersonasAmarillo: 20,
      minimoPersonasRojo: 5, // inválido
      minimoValorAmarillo: 5_000_000,
      minimoValorRojo: 1_000_000, // inválido
      diasUrgenciaAlta: 0, // inválido
      horasLeadCaliente: 200, // inválido
      scoreAltoThreshold: 0, // inválido
    });

    expect(Object.keys(errors)).toHaveLength(5);
  });
});

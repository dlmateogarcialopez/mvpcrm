import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const visibleClientFiles = [
  "client/src/pages/Home.tsx",
  "client/src/pages/LeadsPage.tsx",
  "client/src/pages/SettingsPage.tsx",
  "client/src/components/DashboardLayout.tsx",
  "client/src/pages/NotFound.tsx",
  "client/src/components/ErrorBoundary.tsx",
] as const;

const forbiddenExactPhrases = [
  "Nuevo negocio",
  "Mis negocios",
  "Resumen de cotización",
  "panel del negocio",
  "negocio abierto",
  "Recargar portada",
  "Qué podrás probar",
  "Volver al resumen",
  "dashboard operativo",
] as const;

const forbiddenVisibleWordPatterns = [
  /\bnegocio\b/i,
  /\bnegocios\b/i,
  /\blead nuevo\b/i,
  /\blead\b/i,
  /\bleads\b/i,
  /\bscore\b/i,
  /\bpipeline\b/i,
] as const;

const allowedLiteralPatterns = [
  /^lead$/i,
  /^leads$/i,
  /^lead-editor-form$/i,
  /^scoreTotal$/,
  /^scoreCantidad$/,
  /^scoreValorTotal$/,
  /^scoreTicketPromedio$/,
  /^scoreUrgencia$/,
  /^scoreRecencia$/,
  /^selectedLead$/,
  /^estadoLead$/,
  /^fechaIngresoLead$/,
  /^ultimaGestion$/,
  /^leadRows$/,
  /^leadStatusLabels$/,
  /^leadPriorityLabels$/,
  /^utils\.leads\./,
  /^trpc\.leads\./,
  /^\.\.?\//,
  /^@\//,
  /^\.{3}\//,
  /^\/leads$/,
  /^\/leads\?lead=\$\{.*\}$/,
  /^leadSchemas$/,
  /^leads$/,
] as const;

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function normalizeSegment(value: string) {
  return value
    .replace(/\$\{[\s\S]*?\}/g, "${valor}")
    .replace(/\{[\s\S]*?\}/g, "{valor}")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyClassString(segment: string) {
  return segment.includes("${") && /(rounded|border|text-|bg-|px-|py-|mt-|mb-|grid|flex|min-|max-|w-|h-)/.test(segment);
}

function extractQuotedSegments(source: string) {
  const matches = source.match(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g) ?? [];

  return matches
    .map(segment => normalizeSegment(segment.slice(1, -1)))
    .filter(Boolean)
    .filter(segment => !segment.includes("className="))
    .filter(segment => !segment.startsWith("${"))
    .filter(segment => !isLikelyClassString(segment))
    .filter(segment => !allowedLiteralPatterns.some(pattern => pattern.test(segment)));
}

function extractJsxTextSegments(source: string) {
  const matches = source.match(/>\s*([^<>{\n][^<>\n]*)\s*</g) ?? [];

  return matches
    .map(segment => normalizeSegment(segment.slice(1, -1)))
    .filter(Boolean)
    .filter(segment => !segment.startsWith("{"));
}

describe("Barrido de microcopy visible del CRM", () => {
  it("evita la reaparición de términos prohibidos en strings visibles de archivos clave", () => {
    const segments = visibleClientFiles.flatMap(path => {
      const source = readProjectFile(path);
      return [...extractQuotedSegments(source), ...extractJsxTextSegments(source)].map(segment => ({ path, segment }));
    });

    forbiddenExactPhrases.forEach(phrase => {
      const match = segments.find(entry => entry.segment.includes(phrase));
      expect(match, `Se encontró la frase visible prohibida \"${phrase}\" en ${match?.path ?? "ningún archivo"}.`).toBeUndefined();
    });

    forbiddenVisibleWordPatterns.forEach(pattern => {
      const match = segments.find(entry => pattern.test(entry.segment));
      expect(match, `Se encontró un término visible prohibido (${pattern}) en ${match?.path ?? "ningún archivo"}: ${match?.segment ?? ""}`).toBeUndefined();
    });
  });
});

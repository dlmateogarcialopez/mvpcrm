import { useState, useMemo, useRef } from "react";
import {
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

type DuplicateAction = "update" | "create" | "skip";

interface ValidationResult {
  recognized: Array<{
    systemField: string;
    label: string;
    excelColumn: string;
  }>;
  missing: string[];
  unknown: string[];
  rows: Array<{
    index: number;
    status: "ok" | "warning" | "error";
    errors: string[];
    warnings: string[];
    data: Record<string, { raw: any; status: string; reason?: string }>;
  }>;
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  availableFields: Array<{ key: string; label: string; type: string }>;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBlobUrl(base64: string, mime: string, fileName: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImportExportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [manualMapping, setManualMapping] = useState<Record<string, string>>(
    {}
  );
  const [duplicateAction, setDuplicateAction] =
    useState<DuplicateAction>("skip");
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplateQuery = trpc.leads.downloadTemplate.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );
  const exportSpreadsheetMutation = trpc.leads.exportSpreadsheet.useMutation({
    onSuccess: (data: any) => {
      base64ToBlobUrl(data.base64, data.mimeType, data.fileName);
      toast.success(`${data.rowCount} leads exportados`);
    },
    onError: (e: any) => toast.error(`Error al exportar: ${e.message}`),
  });

  const validateMutation = trpc.leads.validateExcelImport.useMutation({
    onSuccess: (data: any) => {
      setValidation(data as ValidationResult);
      setShowPreview(true);
    },
    onError: (e: any) => toast.error(`Error al validar: ${e.message}`),
  });

  const executeMutation = trpc.leads.executeExcelImport.useMutation({
    onSuccess: (data: any) => {
      const msg = `Importación completada: ${data.created} creados, ${data.updated} actualizados, ${data.skipped} saltados.`;
      if (data.errors.length > 0) {
        toast.warning(`${msg} ${data.errors.length} errores.`);
      } else {
        toast.success(msg);
      }
      handleReset();
    },
    onError: (e: any) => toast.error(`Error al importar: ${e.message}`),
  });

  const handleDownloadTemplate = () => {
    if (downloadTemplateQuery.data) {
      const d = downloadTemplateQuery.data as any;
      base64ToBlobUrl(d.base64, d.mimeType, d.fileName);
      toast.success("Plantilla descargada");
    }
  };

  const handleExportAll = () => {
    exportSpreadsheetMutation.mutate(undefined);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setValidation(null);
    setManualMapping({});
    setShowPreview(false);

    // Leer y validar
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const base64 = bufferToBase64(buffer);
      validateMutation.mutate({ base64 });
    };
    reader.readAsArrayBuffer(f);
  };

  const handleReset = () => {
    setFile(null);
    setValidation(null);
    setManualMapping({});
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = () => {
    if (!file || !validation) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = bufferToBase64(reader.result as ArrayBuffer);
      executeMutation.mutate({
        base64,
        manualMapping:
          Object.keys(manualMapping).length > 0 ? manualMapping : undefined,
        duplicateAction,
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const unknownColumns = validation?.unknown ?? [];
  const missingColumns = validation?.missing ?? [];
  const recognizedColumns = validation?.recognized ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="h-7 w-7" /> Importar / Exportar
        </h1>
        <p className="text-muted-foreground">
          Descarga la plantilla, importa leads desde Excel con validación, o
          exporta los leads existentes.
        </p>
      </div>

      {/* Sección 1: Descargar plantilla */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> 1. Descargar plantilla
        </h2>
        <p className="text-sm text-muted-foreground">
          Genera un Excel con los 24 campos del sistema y una fila de ejemplo.
          Úsalo como base para armar tu archivo.
        </p>
        <Button
          onClick={handleDownloadTemplate}
          disabled={downloadTemplateQuery.isLoading}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {downloadTemplateQuery.isLoading
            ? "Generando..."
            : "Generar plantilla"}
        </Button>
      </div>

      {/* Sección 2: Importar */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4" /> 2. Importar desde Excel
        </h2>
        <p className="text-sm text-muted-foreground">
          Sube un archivo .xlsx. El sistema validará las columnas y los datos
          antes de importar nada.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="excel-file-input"
          />
          <Button asChild variant="outline" className="gap-2 cursor-pointer">
            <label htmlFor="excel-file-input">
              <Upload className="h-4 w-4" /> Seleccionar archivo
            </label>
          </Button>
          {file && (
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span className="font-medium">{file.name}</span>
              <button
                onClick={handleReset}
                className="text-muted-foreground hover:text-red-600"
                title="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {validateMutation.isPending && (
            <span className="text-sm text-muted-foreground">Validando...</span>
          )}
        </div>

        {validation && (
          <div className="space-y-3 mt-3">
            {/* Resumen de validación */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-2xl font-bold">{validation.totalRows}</p>
                <p className="text-xs text-muted-foreground">filas totales</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-2 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {validation.validCount}
                </p>
                <p className="text-xs text-muted-foreground">válidas</p>
              </div>
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-2 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {validation.warningCount}
                </p>
                <p className="text-xs text-muted-foreground">advertencias</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {validation.errorCount}
                </p>
                <p className="text-xs text-muted-foreground">errores</p>
              </div>
            </div>

            {/* Columnas reconocidas */}
            <div className="rounded-lg border bg-muted/10 p-3">
              <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {recognizedColumns.length}{" "}
                columnas reconocidas
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {recognizedColumns
                  .map(r => `${r.excelColumn} → ${r.label}`)
                  .join(", ")}
              </p>
            </div>

            {/* Columnas faltantes */}
            {missingColumns.length > 0 && (
              <div className="rounded-lg border bg-yellow-50/50 dark:bg-yellow-950/20 p-3">
                <p className="text-xs font-semibold text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {missingColumns.length}{" "}
                  columnas faltantes
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Estas columnas del sistema no están en tu archivo. Se crearán
                  vacías:{" "}
                  {missingColumns
                    .map(
                      f =>
                        validation.availableFields.find(a => a.key === f)?.label
                    )
                    .join(", ")}
                </p>
              </div>
            )}

            {/* Columnas desconocidas (con selector de mapeo) */}
            {unknownColumns.length > 0 && (
              <div className="rounded-lg border bg-red-50/50 dark:bg-red-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {unknownColumns.length}{" "}
                  columnas desconocidas
                </p>
                <p className="text-xs text-muted-foreground">
                  Estas columnas no coinciden con ningún campo del sistema.
                  Asigna cada una a un campo o déjala como "Ignorar" para que se
                  descarte.
                </p>
                <div className="space-y-1">
                  {unknownColumns.map(col => (
                    <div key={col} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{col}</span>
                      <span className="text-muted-foreground">→</span>
                      <select
                        value={manualMapping[col] ?? ""}
                        onChange={e => {
                          setManualMapping(prev => {
                            const next = { ...prev };
                            if (e.target.value) {
                              next[col] = e.target.value;
                            } else {
                              delete next[col];
                            }
                            return next;
                          });
                          // Re-validar con el nuevo mapeo
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              const base64 = bufferToBase64(
                                reader.result as ArrayBuffer
                              );
                              validateMutation.mutate({
                                base64,
                                manualMapping: {
                                  ...manualMapping,
                                  [col]: e.target.value,
                                },
                              });
                            };
                            reader.readAsArrayBuffer(file);
                          }
                        }}
                        className="rounded border bg-background px-2 py-1 text-sm"
                      >
                        <option value="">— Ignorar —</option>
                        {validation.availableFields
                          .filter(
                            f =>
                              !recognizedColumns.find(
                                r => r.systemField === f.key
                              )
                          )
                          .map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selector de acción para duplicados */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold">
                Si un lead ya existe (mismo teléfono o correo):
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { v: "skip" as const, label: "Saltar" },
                    { v: "update" as const, label: "Actualizar" },
                    { v: "create" as const, label: "Crear nuevo" },
                  ] as const
                ).map(opt => (
                  <label
                    key={opt.v}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                      duplicateAction === opt.v
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={duplicateAction === opt.v}
                      onChange={() => setDuplicateAction(opt.v)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Botón de previsualizar / importar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Button
                onClick={() => setShowPreview(s => !s)}
                variant="outline"
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Ocultar" : "Ver"} vista previa
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  executeMutation.isPending ||
                  validation.errorCount === validation.totalRows
                }
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                {executeMutation.isPending
                  ? "Importando..."
                  : `Importar ${
                      validation.totalRows - validation.errorCount
                    } filas`}
              </Button>
            </div>

            {/* Tabla de preview */}
            {showPreview && (
              <div className="rounded-lg border max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">Estado</th>
                      {recognizedColumns.map(r => (
                        <th key={r.systemField} className="px-2 py-1 text-left">
                          {r.label}
                        </th>
                      ))}
                      <th className="px-2 py-1 text-left">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.rows.slice(0, 50).map(row => (
                      <tr
                        key={row.index}
                        className={
                          row.status === "error"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : row.status === "warning"
                              ? "bg-yellow-50 dark:bg-yellow-950/20"
                              : "bg-green-50/30 dark:bg-green-950/10"
                        }
                      >
                        <td className="px-2 py-1">{row.index + 2}</td>
                        <td className="px-2 py-1">
                          {row.status === "ok" && (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          )}
                          {row.status === "warning" && (
                            <AlertTriangle className="h-3 w-3 text-yellow-600" />
                          )}
                          {row.status === "error" && (
                            <AlertCircle className="h-3 w-3 text-red-600" />
                          )}
                        </td>
                        {recognizedColumns.map(r => (
                          <td
                            key={r.systemField}
                            className="px-2 py-1 truncate max-w-32"
                          >
                            {String(row.data[r.systemField]?.raw ?? "")}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-muted-foreground">
                          {[...row.errors, ...row.warnings]
                            .slice(0, 2)
                            .join(" • ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validation.rows.length > 50 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    Mostrando 50 de {validation.rows.length} filas.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sección 3: Exportar */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> 3. Exportar leads a Excel
        </h2>
        <p className="text-sm text-muted-foreground">
          Descarga un Excel con todos los leads que tienes acceso (respeta tus
          permisos).
        </p>
        <Button
          onClick={handleExportAll}
          disabled={exportSpreadsheetMutation.isPending}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {exportSpreadsheetMutation.isPending
            ? "Exportando..."
            : "Exportar todos los leads"}
        </Button>
      </div>
    </div>
  );
}

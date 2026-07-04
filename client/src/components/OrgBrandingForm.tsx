import { useEffect, useState } from "react";
import {
  Loader2,
  Palette,
  Eye,
  Image as ImageIcon,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useActiveBrand, useRefreshBrand } from "@/contexts/BrandContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BrandingFormState {
  displayName: string;
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PRESET_COLORS = [
  { name: "Violeta", value: "#5B21B6" },
  { name: "Indigo", value: "#4338CA" },
  { name: "Azul", value: "#1D4ED8" },
  { name: "Cyan", value: "#0E7490" },
  { name: "Esmeralda", value: "#047857" },
  { name: "Verde", value: "#16A34A" },
  { name: "Ámbar", value: "#B45309" },
  { name: "Naranja", value: "#C2410C" },
  { name: "Rojo", value: "#B91C1C" },
  { name: "Rosa", value: "#BE185D" },
  { name: "Pizarra", value: "#334155" },
  { name: "Negro", value: "#0F172A" },
];

/**
 * Form de branding de la organización activa. Solo el owner
 * (y admin en fase futura) puede editar.
 *
 * Cambia:
 *  - displayName: nombre a mostrar en la UI
 *  - primaryColor: color primario (afecta botones, badges,
 *    sidebar accent). Live preview aplicado al instante.
 *  - logoUrl: URL de logo (opcional, se muestra en sidebar
 *    y en el login)
 *  - faviconUrl: URL del favicon (opcional)
 *
 * Mientras se tipea, el sidebar y los CTAs principales
 * se actualizan en vivo (porque el BrandContext re-aplica
 * las CSS vars cuando cambia la query). Al guardar, se
 * persiste en organization_settings.
 */
export function OrgBrandingForm() {
  const brand = useActiveBrand();
  const refreshBrand = useRefreshBrand();
  const utils = trpc.useUtils();

  const currentSettingsQuery = trpc.organizations.currentSettings.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );
  const updateMutation = trpc.organizations.updateSettings.useMutation();

  const [form, setForm] = useState<BrandingFormState>({
    displayName: "",
    primaryColor: "#5B21B6",
    logoUrl: "",
    faviconUrl: "",
  });
  const [logoError, setLogoError] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState<string | null>(null);

  // Inicializar el form cuando llegan los settings del server
  useEffect(() => {
    if (currentSettingsQuery.data) {
      setForm({
        displayName: currentSettingsQuery.data.displayName ?? "",
        primaryColor:
          currentSettingsQuery.data.primaryColor ?? "#5B21B6",
        logoUrl: currentSettingsQuery.data.logoUrl ?? "",
        faviconUrl: currentSettingsQuery.data.faviconUrl ?? "",
      });
    }
  }, [currentSettingsQuery.data]);

  const handleSave = async () => {
    if (!HEX_RE.test(form.primaryColor)) {
      toast.error("El color debe estar en formato hexadecimal (#RGB o #RRGGBB).");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        displayName: form.displayName.trim() || null,
        primaryColor: form.primaryColor,
        logoUrl: form.logoUrl.trim() || null,
        faviconUrl: form.faviconUrl.trim() || null,
      });
      await refreshBrand();
      toast.success("Branding actualizado. Refrescando...");
      // Invalidar queries que dependen del branding
      await utils.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible guardar el branding.");
    }
  };

  const handleReset = () => {
    if (currentSettingsQuery.data) {
      setForm({
        displayName: currentSettingsQuery.data.displayName ?? "",
        primaryColor:
          currentSettingsQuery.data.primaryColor ?? "#5B21B6",
        logoUrl: currentSettingsQuery.data.logoUrl ?? "",
        faviconUrl: currentSettingsQuery.data.faviconUrl ?? "",
      });
    }
  };

  if (currentSettingsQuery.isLoading) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando branding...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <Palette className="h-4 w-4" />
            Identidad de la organización
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Personaliza cómo se ve esta organización
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Estos ajustes se aplican únicamente a esta organización. El color
            primario afecta botones, badges y acentos. El nombre se muestra en
            el sidebar y los reportes. Los cambios se ven al instante y se
            guardan al confirmar.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <div className="rounded-2xl border bg-muted/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Organización activa
            </p>
            <p className="mt-1 font-semibold">
              {brand.organizationName ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Columna izquierda: campos editables */}
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="branding-display-name">Nombre a mostrar</Label>
            <Input
              id="branding-display-name"
              placeholder={brand.organizationName ?? "Mi organización"}
              value={form.displayName}
              onChange={e =>
                setForm(s => ({ ...s, displayName: e.target.value }))
              }
              maxLength={200}
            />
            <p className="text-[10px] text-muted-foreground">
              Aparece en el sidebar, reportes y mensajes del sistema.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="branding-primary-color">Color primario</Label>
            <div className="flex items-center gap-2">
              <div
                className="h-11 w-14 shrink-0 rounded-xl border"
                style={{ backgroundColor: form.primaryColor }}
                aria-label="Vista previa del color"
              />
              <Input
                id="branding-primary-color"
                placeholder="#5B21B6"
                value={form.primaryColor}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    primaryColor: e.target.value.startsWith("#")
                      ? e.target.value
                      : `#${e.target.value}`,
                  }))
                }
                className="font-mono"
                maxLength={7}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Formato hexadecimal (ej. <code>#5B21B6</code>).
            </p>

            {/* Paleta de presets */}
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Colores predefinidos
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESET_COLORS.map(preset => {
                  const isActive =
                    form.primaryColor.toLowerCase() ===
                    preset.value.toLowerCase();
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.name}
                      onClick={() =>
                        setForm(s => ({ ...s, primaryColor: preset.value }))
                      }
                      className="group relative h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: preset.value,
                        borderColor: isActive ? "white" : "transparent",
                        boxShadow: isActive
                          ? `0 0 0 2px ${preset.value}`
                          : undefined,
                      }}
                    >
                      {isActive && (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="branding-logo-url">Logo (URL)</Label>
            <Input
              id="branding-logo-url"
              placeholder="https://misitio.com/logo.png"
              value={form.logoUrl}
              onChange={e => {
                setForm(s => ({ ...s, logoUrl: e.target.value }));
                setLogoError(null);
              }}
              onBlur={() => {
                if (form.logoUrl && !/^https?:\/\//.test(form.logoUrl)) {
                  setLogoError("La URL debe comenzar con http:// o https://");
                }
              }}
              maxLength={500}
            />
            {logoError && (
              <p className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {logoError}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Aparece en el sidebar y en el login. PNG o SVG, recomendado
              cuadrado 256×256px.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="branding-favicon-url">Favicon (URL)</Label>
            <Input
              id="branding-favicon-url"
              placeholder="https://misitio.com/favicon.ico"
              value={form.faviconUrl}
              onChange={e => {
                setForm(s => ({ ...s, faviconUrl: e.target.value }));
                setFaviconError(null);
              }}
              onBlur={() => {
                if (form.faviconUrl && !/^https?:\/\//.test(form.faviconUrl)) {
                  setFaviconError("La URL debe comenzar con http:// o https://");
                }
              }}
              maxLength={500}
            />
            {faviconError && (
              <p className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {faviconError}
              </p>
            )}
          </div>
        </div>

        {/* Columna derecha: live preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Vista previa
          </div>

          <div
            className="rounded-2xl border p-4 transition-colors"
            style={{ backgroundColor: "var(--org-primary-soft)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: form.primaryColor }}
              >
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt=""
                    className="h-10 w-10 rounded-xl object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  (form.displayName || brand.organizationName || "O")
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {form.displayName || brand.organizationName || "Mi organización"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Así se ve en el sidebar
                </p>
              </div>
            </div>
          </div>

          {/* Mockup de un botón primario */}
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Botón primario
            </p>
            <button
              type="button"
              className="mt-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: form.primaryColor }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Acción principal
            </button>

            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Badge con color
            </p>
            <span
              className="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: form.primaryColor }}
            >
              Etiqueta
            </span>

            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Link
            </p>
            <a
              href="#"
              className="mt-2 inline-block text-sm font-medium hover:underline"
              style={{ color: form.primaryColor }}
              onClick={e => e.preventDefault()}
            >
              Ver detalles →
            </a>
          </div>

          {/* Mockup de card con borde primary */}
          <div className="rounded-2xl border-2 bg-background p-4" style={{ borderColor: form.primaryColor }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: form.primaryColor }}>
              <ImageIcon className="h-3.5 w-3.5" />
              Tarjeta destacada
            </div>
            <p className="mt-2 text-sm font-semibold">Vista de borde primario</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Algunos componentes usan el color como borde de acento.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={updateMutation.isPending}
        >
          Descartar cambios
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          )}
          Guardar branding
        </Button>
      </div>
    </section>
  );
}

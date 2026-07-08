import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type BrandColor = string;

export interface ActiveBrand {
  organizationId: number | null;
  organizationName: string | null;
  displayName: string | null;
  primaryColor: BrandColor;
  logoUrl: string | null;
  faviconUrl: string | null;
  loading: boolean;
}

const DEFAULT_BRAND: ActiveBrand = {
  organizationId: null,
  organizationName: null,
  displayName: null,
  primaryColor: "#5B21B6",
  logoUrl: null,
  faviconUrl: null,
  loading: true,
};

const BrandContext = createContext<ActiveBrand>(DEFAULT_BRAND);

/**
 * Helper para mapear cualquier color hex a sus triadas
 * (foreground + variantes suaves). Usado por la UI para
 * pintar badges, hover states, etc. coherentes con el
 * primary color de la org activa.
 *
 * Devuelve { fg: color legible sobre el bg, soft: bg
 * translúcido al 12% para hovers suaves }.
 */
export function brandColorVariants(primary: BrandColor): {
  fg: string;
  soft: string;
  ring: string;
} {
  // Si el color no es hex, devolver defaults razonables
  if (!primary.startsWith("#") || primary.length < 7) {
    return { fg: "#ffffff", soft: "rgba(91, 33, 182, 0.12)", ring: "rgba(91, 33, 182, 0.5)" };
  }
  return {
    fg: "#ffffff",
    soft: `${primary}22`, // hex + alpha 13% (0x22 ≈ 13%)
    ring: `${primary}80`, // hex + alpha 50%
  };
}

interface BrandProviderProps {
  children: React.ReactNode;
}

/**
 * Lee los settings de la organización activa (cookie
 * `active_org_id`) y aplica el branding como CSS variables
 * en <html>:
 *   --org-primary   → color primario de la org
 *   --org-primary-fg → color legible sobre el primary
 *   --org-primary-soft → primary translúcido para hovers
 *   --org-display-name → nombre a mostrar en la UI
 *
 * Mientras carga, mantiene los defaults. Si no hay org
 * activa, devuelve defaults también (caso del selector
 * o pre-login).
 */
export function BrandProvider({ children }: BrandProviderProps) {
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const [brand, setBrand] = useState<ActiveBrand>(DEFAULT_BRAND);
  const clearActiveMutation = trpc.organizations.clearActive.useMutation();

  // Query al backend. Solo corre si el usuario está autenticado;
  // el DashboardLayout ya redirige a /login cuando no hay user,
  // así que en la práctica esto siempre tendrá datos (o un
  // 401 que se ignora silenciosamente).
  const settingsQuery = trpc.organizations.currentSettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 min; la org no cambia de branding tan seguido
    retry: false,
  });
  const orgsQuery = trpc.organizations.myOrganizations.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Combinar settings + lista de orgs para resolver el nombre
  // de la org activa (settings.displayName puede ser null;
  // en ese caso caemos al nombre en organization_members).
  // Si estamos en /select-org, forzamos organizationId: null
  // aunque el server haya devuelto una orgId stale (cookie que
  // no se limpió). El clearActive está en un useEffect separado
  // (ver abajo) para no ejecutarse en un refetch de datos.
  useEffect(() => {
    if (settingsQuery.error || orgsQuery.error) {
      // Si no hay org activa, mantenemos los defaults silenciosamente
      setBrand(prev => ({ ...prev, loading: false }));
      return;
    }
    if (!settingsQuery.data || !orgsQuery.data) {
      setBrand(prev => ({ ...prev, loading: prev.loading }));
      return;
    }
    const settings = settingsQuery.data;
    const isSelectOrgPage = location === "/select-org";
    const effectiveOrgId = isSelectOrgPage ? null : settings.organizationId;
    const activeOrg = effectiveOrgId
      ? orgsQuery.data.find(o => o.id === effectiveOrgId)
      : undefined;
    setBrand({
      organizationId: effectiveOrgId,
      organizationName: activeOrg?.name ?? null,
      displayName: settings.displayName ?? activeOrg?.name ?? null,
      primaryColor: settings.primaryColor ?? "#5B21B6",
      logoUrl: settings.logoUrl ?? null,
      faviconUrl: settings.faviconUrl ?? null,
      loading: false,
    });
  }, [
    settingsQuery.data,
    settingsQuery.error,
    orgsQuery.data,
    orgsQuery.error,
    location,
  ]);

  // Limpiar la cookie stale solo cuando el user NAVEGA a /select-org
  // (no en cada refetch de currentSettings). Esto evita el race con
  // el flujo de selección: cuando el user hace click en una org
  // desde /select-org, mutaAsync setea la cookie, refreshBrand
  // dispara un refetch, location todavía es /select-org pero
  // settingsQuery.data ya tiene la nueva orgId. Si disparara
  // clearActive en cada refetch, borraría la cookie que se acaba
  // de setear. Con esta separación, clearActive solo corre cuando
  // location cambia explícitamente a /select-org (navegación).
  useEffect(() => {
    if (location === "/select-org" && settingsQuery.data?.organizationId) {
      clearActiveMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Aplicar CSS variables al <html>
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--org-primary", brand.primaryColor);
    const variants = brandColorVariants(brand.primaryColor);
    root.style.setProperty("--org-primary-fg", variants.fg);
    root.style.setProperty("--org-primary-soft", variants.soft);
    root.style.setProperty("--org-primary-ring", variants.ring);
    if (brand.displayName) {
      root.dataset.orgName = brand.displayName;
    } else {
      delete root.dataset.orgName;
    }
  }, [brand]);

  // Cleanup al desmontar: restaurar defaults
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.style.removeProperty("--org-primary");
      root.style.removeProperty("--org-primary-fg");
      root.style.removeProperty("--org-primary-soft");
      root.style.removeProperty("--org-primary-ring");
      delete root.dataset.orgName;
    };
  }, []);

  const value = useMemo(() => brand, [brand]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useActiveBrand(): ActiveBrand {
  return useContext(BrandContext);
}

/**
 * Helper para refrescar el branding cuando se cambia de org
 * (usado por el OrgSwitcher después de `organizations.select`).
 */
export function useRefreshBrand() {
  const utils = trpc.useUtils();
  return async () => {
    await Promise.all([
      utils.organizations.currentSettings.invalidate(),
      utils.organizations.myOrganizations.invalidate(),
    ]);
    // Forzar refetch del sidebar (si cachea el org)
    await utils.invalidate();
  };
}

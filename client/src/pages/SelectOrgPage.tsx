import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, Check, ChevronRight, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useRefreshBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

/**
 * Pantalla que se muestra después del login cuando el usuario
 * pertenece a 2+ organizaciones. El usuario elige con cuál
 * quiere trabajar.
 *
 * Se accede también cuando la cookie `active_org_id` se
 * pierde (sesión reiniciada parcialmente) o el usuario es
 * removido de la org activa.
 */
export default function SelectOrgPage() {
  const [, setLocation] = useLocation();
  const refreshBrand = useRefreshBrand();
  const { user, loading: userLoading, logout } = useAuth();
  const utils = trpc.useUtils();

  const myOrgsQuery = trpc.organizations.myOrganizations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const selectMutation = trpc.organizations.select.useMutation();
  const [pendingOrgId, setPendingOrgId] = useState<number | null>(null);

  // Si no hay usuario, ir a /login
  useEffect(() => {
    if (!userLoading && !user) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  // Si solo hay 1 org, auto-seleccionar y redirigir
  useEffect(() => {
    if (myOrgsQuery.data && myOrgsQuery.data.length === 1) {
      handleSelect(myOrgsQuery.data[0].id);
    }
  }, [myOrgsQuery.data]);

  const handleSelect = async (orgId: number) => {
    setPendingOrgId(orgId);
    try {
      // Primero navegar a "/" para que cuando llegue el refetch de
      // currentSettings al main useEffect de BrandContext, la location
      // ya no sea "/select-org" (eso forzaba effectiveOrgId = null
      // y el brand quedaba en null, dejando el sidebar deshabilitado).
      setLocation("/");
      await selectMutation.mutateAsync({ organizationId: orgId });
      // El refresh de queries debe ir después de que la navegación se
      // confirmó y la cookie esté seteada, para que el refetch incluya
      // la nueva cookie y el brand se actualice con la nueva org.
      await refreshBrand();
      await utils.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible entrar a la organización.");
    } finally {
      setPendingOrgId(null);
    }
  };

  if (userLoading || myOrgsQuery.isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (myOrgsQuery.error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-destructive/30 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-destructive">
            No se pudieron cargar tus organizaciones
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {myOrgsQuery.error.message}
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => myOrgsQuery.refetch()}>
              Reintentar
            </Button>
            <Button variant="ghost" onClick={() => logout()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const orgs = myOrgsQuery.data ?? [];

  if (orgs.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Building2 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            No perteneces a ninguna organización
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pídele al superadministrador que te invite a una organización para
            poder acceder al sistema.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Hola, {user.name?.split(" ")[0] || "bienvenido"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Elige la organización con la que quieres trabajar.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {orgs.map(org => {
            const isPending = pendingOrgId === org.id;
            // Para el preview de color usamos el settings del org si
            // está disponible (poco probable en este punto porque no
            // hay org activa); sino un color neutral.
            const previewColor = "#5B21B6";
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSelect(org.id)}
                disabled={selectMutation.isPending}
                className="group relative flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white transition-transform group-hover:scale-105"
                  style={{ backgroundColor: previewColor }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">
                    {org.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs uppercase tracking-wider text-muted-foreground">
                    {org.orgRole} · /{org.slug}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <p className="text-xs text-muted-foreground">
            {orgs.length} {orgs.length === 1 ? "organización" : "organizaciones"} disponibles
          </p>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}

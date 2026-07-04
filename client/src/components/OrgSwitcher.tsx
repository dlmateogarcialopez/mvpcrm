import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useActiveBrand, useRefreshBrand } from "@/contexts/BrandContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Switcher de organización activa. Se muestra en el sidebar
 * (en el header). Solo aparece si el usuario pertenece a más
 * de una org O si es superadmin (puede crear nuevas orgs).
 *
 * Para usuarios con una sola org, el switcher se muestra en
 * modo "solo lectura" (muestra el nombre + ícono) para que
 * el usuario siempre vea en qué org está trabajando.
 */
export function OrgSwitcher() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const refreshBrand = useRefreshBrand();
  const brand = useActiveBrand();

  const myOrgsQuery = trpc.organizations.myOrganizations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const selectMutation = trpc.organizations.select.useMutation();
  const createMutation = trpc.organizations.create.useMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");

  const orgs = myOrgsQuery.data ?? [];
  const isSuperadmin = brand.organizationId !== null; // cualquier user con org puede ver; el superadmin tiene un item extra abajo

  // Auto-redirect a /select-org si el user pertenece a varias
  // orgs y la URL actual no es una página que muestre contexto
  // de org (login, accept-invitation, etc).
  useEffect(() => {
    if (myOrgsQuery.data && myOrgsQuery.data.length > 1 && !brand.organizationId) {
      // No hay org activa y hay varias: forzar selector
      setLocation("/select-org");
    }
  }, [myOrgsQuery.data, brand.organizationId, setLocation]);

  const handleSelect = async (orgId: number) => {
    if (orgId === brand.organizationId) return;
    try {
      await selectMutation.mutateAsync({ organizationId: orgId });
      await refreshBrand();
      // Invalidar queries que filtran por org
      await utils.invalidate();
      toast.success("Organización cambiada.");
    } catch (err: any) {
      toast.error(err?.message || "No fue posible cambiar de organización.");
    }
  };

  const handleCreate = async () => {
    if (!newOrgName.trim() || newOrgName.trim().length < 2) {
      toast.warning("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim() || undefined,
      });
      toast.success("Organización creada. Recargando...");
      setCreateOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      await myOrgsQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible crear la organización.");
    }
  };

  // Estado de carga inicial
  if (myOrgsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-2 text-xs text-sidebar-foreground/60">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Cargando organización...</span>
      </div>
    );
  }

  // Sin orgs
  if (orgs.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="leading-snug">
          No perteneces a ninguna organización. Contacta al superadmin.
        </span>
      </div>
    );
  }

  // Una sola org: mostrar en modo solo-lectura
  if (orgs.length === 1) {
    const org = orgs[0];
    const initial = org.name?.charAt(0).toUpperCase() ?? "O";
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
          style={{ backgroundColor: brand.primaryColor }}
        >
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={org.name}
              className="h-7 w-7 rounded-lg object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">
            {brand.displayName || org.name}
          </p>
          <p className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
            {org.orgRole}
          </p>
        </div>
      </div>
    );
  }

  // Varias orgs: dropdown con selector
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/40 focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: brand.primaryColor }}
            >
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt=""
                  className="h-7 w-7 rounded-lg object-cover"
                />
              ) : (
                (brand.displayName || orgs.find(o => o.id === brand.organizationId)?.name || "O")
                  .charAt(0)
                  .toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">
                {brand.displayName ||
                  orgs.find(o => o.id === brand.organizationId)?.name ||
                  "Seleccionar organización"}
              </p>
              <p className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                {orgs.length} organizaciones
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-72 max-h-[420px] overflow-y-auto"
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Cambiar de organización
          </DropdownMenuLabel>
          {orgs.map(org => {
            const isActive = org.id === brand.organizationId;
            return (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => handleSelect(org.id)}
                className="cursor-pointer"
              >
                <div className="flex w-full items-center gap-2.5">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                    style={{
                      backgroundColor: isActive ? brand.primaryColor : "#9ca3af",
                    }}
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{org.name}</p>
                    <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                      {org.orgRole}
                    </p>
                  </div>
                  {isActive && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
          {isSuperadmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setCreateOpen(true);
                }}
                className="cursor-pointer text-primary focus:text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>Crear nueva organización</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nueva organización</DialogTitle>
            <DialogDescription>
              Cada organización es un espacio aislado con sus propios leads,
              embudos, automatizaciones y configuración.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="new-org-name">Nombre</Label>
              <Input
                id="new-org-name"
                placeholder="Ej. Tienda de Ropa Centro"
                value={newOrgName}
                onChange={(e) => {
                  setNewOrgName(e.target.value);
                  if (!newOrgSlug) {
                    setNewOrgSlug(
                      e.target.value
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9\s-]/g, "")
                        .replace(/\s+/g, "-")
                        .slice(0, 80)
                    );
                  }
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-org-slug">Slug (opcional)</Label>
              <Input
                id="new-org-slug"
                placeholder="tienda-ropa-centro"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase())}
              />
              <p className="text-[10px] text-muted-foreground">
                Solo letras minúsculas, números y guiones. Se usa para URLs.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newOrgName.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Crear organización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

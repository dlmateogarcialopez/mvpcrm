import { useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Lock,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useActiveBrand, useRefreshBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  paused: "Pausada",
  archived: "Archivada",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  archived: "bg-slate-500/10 text-slate-700 border-slate-500/20",
};

/**
 * Panel de gestión de organizaciones. Solo el superadmin ve
 * este panel — para usuarios normales, el OrgSwitcher del
 * sidebar es suficiente.
 *
 * Permite:
 *  - Listar TODAS las orgs del sistema (no solo las del
 *    usuario, via organizations.listAll).
 *  - Crear una nueva org (botón + dialog).
 *  - Cambiar status de una org (pausar/reactivar/archivar).
 *  - Ver conteo de miembros por org.
 *  - Click en una org para entrar a ella (vía organizations.select).
 */
export function OrgListPanel() {
  const { user } = useAuth();
  const brand = useActiveBrand();
  const refreshBrand = useRefreshBrand();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const isSuperadmin = user?.role === "superadmin";
  const allOrgsQuery = trpc.organizations.listAll.useQuery(undefined, {
    enabled: isSuperadmin,
    refetchOnWindowFocus: false,
  });
  const myOrgsQuery = trpc.organizations.myOrganizations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.organizations.create.useMutation();
  const archiveMutation = trpc.organizations.archive.useMutation();
  const selectMutation = trpc.organizations.select.useMutation();
  const deleteMutation = trpc.organizations.delete.useMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{
    id: number;
    name: string;
    currentStatus: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    isCurrent: boolean;
  } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      toast.warning("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        name: newName.trim(),
        slug: newSlug.trim() || undefined,
      });
      toast.success(`Organización "${result.name}" creada.`);
      setCreateOpen(false);
      setNewName("");
      setNewSlug("");
      await allOrgsQuery.refetch();
      await myOrgsQuery.refetch();
      // Auto-entrar a la org recién creada
      await selectMutation.mutateAsync({ organizationId: result.id });
      await refreshBrand();
      await utils.invalidate();
      setLocation("/configuracion");
    } catch (err: any) {
      toast.error(err?.message || "No fue posible crear la organización.");
    }
  };

  const handleChangeStatus = async (
    id: number,
    newStatus: "active" | "paused" | "archived"
  ) => {
    try {
      await archiveMutation.mutateAsync({ id, status: newStatus });
      toast.success(
        newStatus === "active"
          ? "Organización reactivada."
          : newStatus === "paused"
            ? "Organización pausada."
            : "Organización archivada."
      );
      setArchiveTarget(null);
      await allOrgsQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible cambiar el estado.");
    }
  };

  const handleEnterOrg = async (orgId: number) => {
    try {
      await selectMutation.mutateAsync({ organizationId: orgId });
      await refreshBrand();
      await utils.invalidate();
      setLocation("/");
    } catch (err: any) {
      toast.error(err?.message || "No fue posible entrar a la organización.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      toast.success(`Organización "${deleteTarget.name}" eliminada.`);
      setDeleteTarget(null);
      await allOrgsQuery.refetch();
      await myOrgsQuery.refetch();
      await utils.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible eliminar la organización.");
    }
  };

  if (!isSuperadmin) {
    // No mostrar el panel a usuarios no-superadmin.
    return null;
  }

  const allOrgs = allOrgsQuery.data ?? [];
  const filtered = allOrgs.filter(o => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return o.name.toLowerCase().includes(s) || o.slug.toLowerCase().includes(s);
  });

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <Building2 className="h-4 w-4" />
            Organizaciones del sistema
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Gestiona todas las organizaciones
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Como superadmin, puedes crear nuevas organizaciones, pausarlas
            temporalmente o archivarlas. Solo el superadmin ve este panel.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva organización
        </Button>
      </div>

      <div className="mt-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o slug..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {allOrgsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando organizaciones...
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            {search
              ? "No hay organizaciones que coincidan con la búsqueda."
              : "No hay organizaciones todavía. Crea la primera."}
          </p>
        ) : (
          filtered.map(org => {
            const isCurrent = org.id === brand.organizationId;
            return (
              <div
                key={org.id}
                className="flex items-center gap-3 rounded-xl border bg-background p-3"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                  style={{
                    backgroundColor: org.id === 1 ? "#5B21B6" : "#94a3b8",
                  }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{org.name}</p>
                    {isCurrent && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                        Actual
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">/{org.slug}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {org.memberCount}{" "}
                      {org.memberCount === 1 ? "miembro" : "miembros"}
                    </span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        STATUS_COLORS[org.status] ?? ""
                      }`}
                    >
                      {STATUS_LABELS[org.status] ?? org.status}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!isCurrent && org.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEnterOrg(org.id)}
                    >
                      Entrar
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Acciones"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {org.status === "active" && (
                        <DropdownMenuItem
                          onSelect={() =>
                            setArchiveTarget({
                              id: org.id,
                              name: org.name,
                              currentStatus: org.status,
                            })
                          }
                        >
                          <Pause className="mr-2 h-3.5 w-3.5" />
                          Pausar
                        </DropdownMenuItem>
                      )}
                      {org.status === "paused" && (
                        <DropdownMenuItem
                          onSelect={() => handleChangeStatus(org.id, "active")}
                        >
                          <Play className="mr-2 h-3.5 w-3.5" />
                          Reactivar
                        </DropdownMenuItem>
                      )}
                      {org.status !== "archived" && (
                        <DropdownMenuItem
                          onSelect={() =>
                            setArchiveTarget({
                              id: org.id,
                              name: org.name,
                              currentStatus: org.status,
                            })
                          }
                          className="text-destructive focus:text-destructive"
                        >
                          <X className="mr-2 h-3.5 w-3.5" />
                          Archivar
                        </DropdownMenuItem>
                      )}
                      {org.status === "archived" && (
                        <DropdownMenuItem
                          onSelect={() => handleChangeStatus(org.id, "active")}
                        >
                          <Play className="mr-2 h-3.5 w-3.5" />
                          Reactivar
                        </DropdownMenuItem>
                      )}
                      {!isCurrent && (
                        <DropdownMenuItem
                          onSelect={() =>
                            setDeleteTarget({
                              id: org.id,
                              name: org.name,
                              isCurrent: false,
                            })
                          }
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dialog de crear */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nueva organización</DialogTitle>
            <DialogDescription>
              Cada organización es un espacio aislado con sus propios leads,
              embudos, automatizaciones, configuración y equipo. El superadmin
              queda automáticamente como owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="org-name">Nombre</Label>
              <Input
                id="org-name"
                placeholder="Ej. Tienda de Ropa Centro"
                value={newName}
                onChange={e => {
                  setNewName(e.target.value);
                  if (!newSlug) {
                    setNewSlug(
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
              <Label htmlFor="org-slug">Slug (opcional)</Label>
              <Input
                id="org-slug"
                placeholder="tienda-ropa-centro"
                value={newSlug}
                onChange={e => setNewSlug(e.target.value.toLowerCase())}
              />
              <p className="text-[10px] text-muted-foreground">
                Solo letras minúsculas, números y guiones. Se genera
                automáticamente desde el nombre.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newName.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Crear y entrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de archivar/pausar */}
      <Dialog
        open={!!archiveTarget}
        onOpenChange={open => !open && setArchiveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {archiveTarget?.currentStatus === "active"
                ? `Pausar "${archiveTarget?.name}"`
                : `Archivar "${archiveTarget?.name}"`}
            </DialogTitle>
            <DialogDescription>
              {archiveTarget?.currentStatus === "active"
                ? "La organización quedará inactiva. Los miembros no podrán acceder hasta que la reactives."
                : "La organización se moverá al archivo. Los datos se conservan pero no es accesible."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setArchiveTarget(null)}
              disabled={archiveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!archiveTarget) return;
                const newStatus =
                  archiveTarget.currentStatus === "active"
                    ? "paused"
                    : "archived";
                handleChangeStatus(archiveTarget.id, newStatus);
              }}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              {archiveTarget?.currentStatus === "active"
                ? "Pausar"
                : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de eliminar */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar "{deleteTarget?.name}"</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los leads,
              embudos, automatizaciones, miembros, llamadas, SMS y grabaciones
              asociados a esta organización.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

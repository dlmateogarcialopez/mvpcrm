import { useState } from "react";
import {
  Copy,
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useActiveBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { UserPermissionsEditor } from "@/components/UserPermissionsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OrgRole = "owner" | "admin" | "agent" | "viewer";

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  agent: "Agente",
  viewer: "Visualizador",
};

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Control total: settings, miembros, facturación.",
  admin: "Gestiona miembros y configuración, no puede eliminar la org.",
  agent: "Opera el CRM: leads, embudos, automatizaciones.",
  viewer: "Solo lectura. Útil para auditores o supervisores.",
};

function TelegramChatEditor({
  userId,
  currentValue,
  memberName,
}: {
  userId: number;
  currentValue: string | null;
  memberName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue ?? "");
  const utils = trpc.useUtils();
  const mutation = trpc.organizations.updateMemberTelegram.useMutation({
    onSuccess: () => {
      utils.organizations.members.invalidate();
      utils.organizations.membersWithTelegram.invalidate();
      setEditing(false);
    },
  });

  const handleSave = () => {
    const trimmed = value.trim();
    mutation.mutate({
      userId,
      telegramChatId: trimmed || null,
    });
  };

  return (
    <div className="mt-1 text-xs">
      <span className="text-muted-foreground">Telegram: </span>
      {editing ? (
        <span className="inline-flex items-center gap-1">
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Chat ID de Telegram"
            className="w-36 rounded border bg-background px-1.5 py-0.5 text-xs"
          />
          <button onClick={handleSave} className="text-primary hover:underline">
            Guardar
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setValue(currentValue ?? "");
            }}
            className="text-muted-foreground hover:underline"
          >
            Cancelar
          </button>
        </span>
      ) : (
        <span>
          {currentValue ? (
            <>
              <span className="font-mono">{currentValue}</span>{" "}
              <button
                onClick={() => setEditing(true)}
                className="text-primary hover:underline"
              >
                editar
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-primary hover:underline"
            >
              Agregar chat ID
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * Panel de gestión de miembros de la organización activa.
 * - Lista los miembros con su rol.
 * - Permite invitar usuarios nuevos (genera un token que
 *   debe ser entregado por el admin vía link; el envío de
 *   email real se hace en una fase futura).
 * - Permite cambiar el rol de un miembro (owner only).
 * - Permite remover un miembro (owner only; no se puede
 *   remover a sí mismo).
 *
 * Si el usuario no es owner ni admin, el panel se muestra
 * en modo solo-lectura.
 */
export function OrgMembersPanel() {
  const brand = useActiveBrand();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const orgsQuery = trpc.organizations.myOrganizations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const membersQuery = trpc.organizations.members.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const pendingQuery = trpc.organizations.pendingInvitations.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  // Catálogo de permisos disponibles en el sistema + permisos
  // del usuario actualmente en edición.
  const permissionsCatalogQuery = trpc.permissions.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // State declarations (some are used in queries above)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("agent");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: number;
    name: string | null;
  } | null>(null);
  const [editingPermissionsFor, setEditingPermissionsFor] = useState<{
    id: number;
    name: string | null;
  } | null>(null);
  const [editedPermissionIds, setEditedPermissionIds] = useState<number[]>([]);

  // User permissions query (after state, uses editingPermissionsFor)
  const userPermissionsQuery = trpc.permissions.listForUser.useQuery(
    editingPermissionsFor?.id ?? 0,
    {
      enabled: !!editingPermissionsFor,
      refetchOnWindowFocus: false,
    }
  );

  const inviteMutation = trpc.organizations.invite.useMutation();
  const removeMemberMutation = trpc.organizations.removeMember.useMutation();
  const updateRoleMutation = trpc.organizations.updateMemberRole.useMutation();
  const setPermissionsInOrgMutation =
    trpc.permissions.setForUserInActiveOrg.useMutation();

  const me = orgsQuery.data?.find(o => o.id === brand.organizationId);
  const canManage = me?.orgRole === "owner" || me?.orgRole === "admin";
  const isOwner = me?.orgRole === "owner";

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.warning("Ingresa un email válido.");
      return;
    }
    try {
      const result = await inviteMutation.mutateAsync({
        email: inviteEmail.trim().toLowerCase(),
        orgRole: inviteRole,
      });
      // Construir URL de aceptación (modo dev: front local)
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/accept-invitation?token=${result.token}`;
      setLastInviteUrl(url);
      toast.success("Invitación creada. Comparte el link con el usuario.");
      setInviteEmail("");
      setInviteRole("agent");
      await pendingQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible crear la invitación.");
    }
  };

  const handleChangeRole = async (memberId: number, orgRole: OrgRole) => {
    try {
      await updateRoleMutation.mutateAsync({ memberId, orgRole });
      toast.success("Rol actualizado.");
      await membersQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible actualizar el rol.");
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync({
        memberId: memberToRemove.id,
      });
      toast.success("Miembro removido.");
      setMemberToRemove(null);
      await membersQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible remover al miembro.");
    }
  };

  const handleSavePermissions = async (permissionIds: number[]) => {
    if (!editingPermissionsFor) return;
    try {
      await setPermissionsInOrgMutation.mutateAsync({
        userId: editingPermissionsFor.id,
        permissionIds,
      });
      toast.success("Permisos actualizados.");
      setEditingPermissionsFor(null);
      await membersQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || "No fue posible guardar los permisos.");
    }
  };

  const copyInviteUrl = () => {
    if (!lastInviteUrl) return;
    navigator.clipboard
      .writeText(lastInviteUrl)
      .then(() => toast.success("Link copiado al portapapeles."))
      .catch(() => toast.warning("No se pudo copiar. Cópialo manualmente."));
  };

  if (!brand.organizationId) {
    return null;
  }

  if (membersQuery.error) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-destructive">
          No se pudieron cargar los miembros: {membersQuery.error.message}
        </p>
      </section>
    );
  }

  const members = membersQuery.data ?? [];
  const pending = pendingQuery.data ?? [];

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <Users className="h-4 w-4" />
            Equipo de la organización
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Miembros e invitaciones
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gestiona quién participa en{" "}
            {brand.displayName || brand.organizationName} y con qué alcance
            dentro de esta organización. Los cambios solo afectan a esta org.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invitar miembro
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="mt-4 rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <p>
            Solo administradores pueden invitar, cambiar roles o remover
            miembros. Tu rol actual en esta org: <strong>{me?.orgRole}</strong>.
          </p>
        </div>
      )}

      <Tabs defaultValue="members" className="mt-6">
        <TabsList>
          <TabsTrigger value="members">Miembros ({members.length})</TabsTrigger>
          {canManage && (
            <TabsTrigger value="pending">
              Invitaciones ({pending.length})
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="permissions">
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              Permisos
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="mt-4 space-y-2">
          {membersQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando miembros...
            </div>
          ) : members.length === 0 ? (
            <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              No hay miembros en esta organización.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map(member => {
                const initial = (member.user.name || member.user.email || "U")
                  .charAt(0)
                  .toUpperCase();
                const role = member.orgRole as OrgRole;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl border bg-background p-3"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: brand.primaryColor }}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {member.user.name || member.user.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email} ·{" "}
                        <span className="uppercase tracking-wider">
                          {ROLE_LABELS[role]}
                        </span>
                      </p>
                      {canManage && (
                        <TelegramChatEditor
                          userId={member.userId}
                          currentValue={member.user.telegramChatId ?? null}
                          memberName={member.user.name || member.user.email}
                        />
                      )}
                    </div>
                    {isOwner && member.userId !== user?.id ? (
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
                          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Cambiar rol a
                          </div>
                          {(["admin", "agent", "viewer"] as OrgRole[]).map(
                            r => (
                              <DropdownMenuItem
                                key={r}
                                onSelect={() => handleChangeRole(member.id, r)}
                                disabled={r === role}
                              >
                                {r === "admin" ? (
                                  <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                ) : r === "agent" ? (
                                  <UserCog2 className="mr-2 h-3.5 w-3.5" />
                                ) : (
                                  <Shield className="mr-2 h-3.5 w-3.5" />
                                )}
                                {ROLE_LABELS[r]}
                                {r === role && " (actual)"}
                              </DropdownMenuItem>
                            )
                          )}
                          <div className="my-1 border-t" />
                          <DropdownMenuItem
                            onSelect={() =>
                              setMemberToRemove({
                                id: member.id,
                                name: member.user.name || member.user.email,
                              })
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Remover de la org
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {member.userId === user?.id ? "(tú)" : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="pending" className="mt-4 space-y-2">
            {pendingQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando invitaciones...
              </div>
            ) : pending.length === 0 ? (
              <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                No hay invitaciones pendientes. Usa "Invitar miembro" para crear
                una nueva.
              </p>
            ) : (
              <div className="space-y-2">
                {pending.map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 rounded-xl border bg-background p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {inv.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Rol:{" "}
                        <strong>{ROLE_LABELS[inv.orgRole as OrgRole]}</strong> ·
                        Expira{" "}
                        {new Date(inv.expiresAt).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      Pendiente
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="permissions" className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Como <strong>owner</strong> puedes asignar permisos granulares a
              cada miembro. Estos permisos se aplican solo dentro de esta
              organización. Los usuarios con rol "agent" o "admin" no usan
              permisos (tienen acceso completo al CRM por su rol global).
            </p>
            <div className="mt-3 space-y-2">
              {members
                .filter(m => m.user.role === "custom")
                .map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl border bg-background p-3"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: brand.primaryColor }}
                    >
                      {(member.user.name || member.user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {member.user.name || member.user.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email} · Permisos personalizados
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPermissionsFor({
                          id: member.userId,
                          name: member.user.name || member.user.email,
                        });
                        // Pre-cargar los IDs efectivos desde el catálogo
                        // cruzando con los permission keys del user. Si la
                        // query no está lista, arranca con [].
                        const currentKeys =
                          (userPermissionsQuery.data as unknown as
                            | string[]
                            | undefined) ?? [];
                        const currentIds = currentKeys
                          .map(key => {
                            const found = permissionsCatalogQuery.data?.find(
                              p => p.key === key
                            );
                            return found?.id;
                          })
                          .filter((x): x is number => typeof x === "number");
                        setEditedPermissionIds(currentIds);
                      }}
                    >
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                      Editar permisos
                    </Button>
                  </div>
                ))}
              {members.filter(m => m.user.role === "custom").length === 0 && (
                <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No hay usuarios con permisos personalizados. Para asignar
                  permisos, crea un usuario con rol <code>custom</code> desde el
                  panel "Equipo comercial" de Configuración.
                </p>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog de invitación */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Invitar a {brand.displayName || brand.organizationName}
            </DialogTitle>
            <DialogDescription>
              El usuario recibirá un link de aceptación. Vence en 7 días.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Email del invitado</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@empresa.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-role">Rol en la organización</Label>
              <Select
                value={inviteRole}
                onValueChange={v => setInviteRole(v as OrgRole)}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["admin", "agent", "viewer"] as OrgRole[]).map(r => (
                    <SelectItem key={r} value={r}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{ROLE_LABELS[r]}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {ROLE_DESCRIPTIONS[r]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lastInviteUrl && (
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="mb-1 text-xs font-semibold">
                  Link de invitación generado:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-background px-2 py-1 text-[10px]">
                    {lastInviteUrl}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyInviteUrl}
                    className="h-7 w-7"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  En una próxima fase este link se enviará automáticamente por
                  email. Por ahora, compártelo manualmente.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setInviteOpen(false);
                setLastInviteUrl(null);
              }}
              disabled={inviteMutation.isPending}
            >
              <X className="mr-2 h-3.5 w-3.5" />
              Cerrar
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Crear invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de remover */}
      <Dialog
        open={!!memberToRemove}
        onOpenChange={open => !open && setMemberToRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Remover a {memberToRemove?.name}?</DialogTitle>
            <DialogDescription>
              La persona ya no podrá acceder a esta organización. Sus permisos
              quedan guardados por si la vuelves a invitar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setMemberToRemove(null)}
              disabled={removeMemberMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de edición de permisos (solo owner) */}
      <Dialog
        open={!!editingPermissionsFor}
        onOpenChange={open => !open && setEditingPermissionsFor(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Permisos de {editingPermissionsFor?.name}</DialogTitle>
            <DialogDescription>
              Marca los permisos que tendrá este usuario dentro de{" "}
              {brand.displayName || brand.organizationName}. Estos permisos se
              aplican solo a esta organización.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {permissionsCatalogQuery.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando catálogo de permisos...
              </div>
            ) : permissionsCatalogQuery.data ? (
              <UserPermissionsEditor
                allPermissions={permissionsCatalogQuery.data.map(p => ({
                  id: p.id,
                  key: p.key,
                  name: p.name,
                  groupName: p.groupName,
                  description: p.description,
                }))}
                selectedIds={editedPermissionIds}
                onChange={setEditedPermissionIds}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No se pudo cargar el catálogo de permisos.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditingPermissionsFor(null)}
              disabled={setPermissionsInOrgMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleSavePermissions(editedPermissionIds)}
              disabled={setPermissionsInOrgMutation.isPending}
            >
              {setPermissionsInOrgMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Guardar permisos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

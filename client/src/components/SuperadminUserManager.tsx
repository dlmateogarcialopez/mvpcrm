import { useState } from "react";
import {
  Edit3,
  Save,
  Trash2,
  Undo2,
  X,
  Shield,
  Search,
  Users,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

export function SuperadminUserManager() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { refetchOnWindowFocus: false, staleTime: Infinity });
  const me = meQuery.data;

  const listQuery = trpc.users.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const users = listQuery.data ?? [];

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Usuario actualizado"); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.users.softDelete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Usuario desactivado"); },
    onError: e => toast.error(e.message),
  });
  const restoreMutation = trpc.users.restore.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Usuario restaurado"); },
    onError: e => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const filtered = users.filter((u: any) => {
    const s = search.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(s) ||
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.role ?? "").toLowerCase().includes(s)
    );
  });

  const roleLabels: Record<string, string> = {
    guest: "Invitado",
    agent: "Agente",
    admin: "Administrador",
    superadmin: "Superadmin",
    custom: "Personalizado",
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Gestión global de usuarios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo visible para superadministradores. Desde aquí podés editar información, desactivar o restaurar usuarios del sistema.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o rol..."
            className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-sm outline-none transition focus:border-primary"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {users.length} usuarios
        </span>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Rol</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u: any) => {
              const isMe = me?.id === u.id;
              const isDeleted = !!u.deletedAt;

              return (
                <tr key={u.id} className={`border-t ${isDeleted ? "bg-muted/20 opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="rounded border bg-background px-2 py-1 text-sm w-full"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{u.name ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className="rounded border bg-background px-2 py-1 text-sm w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">{u.email ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      u.role === "superadmin" ? "border-amber-200 bg-amber-50 text-amber-700" :
                      u.role === "admin" ? "border-blue-200 bg-blue-50 text-blue-700" :
                      "border-slate-200 bg-slate-50 text-slate-600"
                    }`}>
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isDeleted ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-600">
                        Desactivado
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">
                        Activo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === u.id ? (
                        <>
                          <button
                            onClick={() => {
                              updateMutation.mutate({
                                userId: u.id,
                                name: editName,
                                email: editEmail,
                              });
                              setEditingId(null);
                            }}
                            disabled={updateMutation.isPending}
                            className="rounded-full p-1.5 text-emerald-600 hover:bg-emerald-50"
                            title="Guardar"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {!isDeleted && (
                            <button
                              onClick={() => {
                                setEditingId(u.id);
                                setEditName(u.name ?? "");
                                setEditEmail(u.email ?? "");
                              }}
                              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                              title="Editar"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!isDeleted && !isMe && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Desactivar a ${u.name || u.email}? Podrá ser restaurado después.`)) {
                                  deleteMutation.mutate({ userId: u.id });
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-red-500"
                              title="Desactivar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isDeleted && (
                            <button
                              onClick={() => restoreMutation.mutate({ userId: u.id })}
                              disabled={restoreMutation.isPending}
                              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-emerald-500"
                              title="Restaurar"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground p-8 text-center">
            No se encontraron usuarios.
          </p>
        )}
      </div>
    </div>
  );
}

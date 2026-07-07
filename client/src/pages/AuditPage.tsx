import { useState } from "react";
import { History, Search, Calendar, ChevronDown, X } from "lucide-react";
import { trpc } from "../lib/trpc";

const ACTION_LABELS: Record<string, string> = {
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
  soft_delete: "Desactivó",
  restore: "Restauró",
  assign: "Asignó",
  unassign: "Desasignó",
  status_change: "Cambió estado",
  login: "Inició sesión",
  logout: "Cerró sesión",
};

const ACTION_COLORS: Record<string, string> = {
  create: "border-emerald-200 bg-emerald-50 text-emerald-700",
  update: "border-blue-200 bg-blue-50 text-blue-700",
  delete: "border-red-200 bg-red-50 text-red-700",
  soft_delete: "border-orange-200 bg-orange-50 text-orange-700",
  restore: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<number | undefined>();
  const [orgId, setOrgId] = useState<number | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [entityType, setEntityType] = useState<string | undefined>();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const auditQuery = trpc.audit.list.useQuery(
    {
      search: search || undefined,
      userId,
      organizationId: orgId,
      action,
      entityType,
      from: from ? new Date(from).getTime() : undefined,
      to: to ? new Date(to).getTime() + 86399999 : undefined,
      limit: 50,
    },
    { refetchOnWindowFocus: false }
  );

  const usersQuery = trpc.users.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const orgsQuery = trpc.organizations.listAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const entries = auditQuery.data ?? [];

  function clearFilters() {
    setSearch("");
    setUserId(undefined);
    setOrgId(undefined);
    setAction(undefined);
    setEntityType(undefined);
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <History className="h-6 w-6" />
          Auditoría de movimientos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cambios en el sistema realizados por todos los usuarios. Solo visible
          para superadministradores.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por email, nombre o resumen..."
            className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-sm outline-none transition focus:border-primary"
          />
        </div>

        <select
          value={userId ?? ""}
          onChange={e => setUserId(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos los usuarios</option>
          {(usersQuery.data ?? []).map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>

        <select
          value={orgId ?? ""}
          onChange={e => setOrgId(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todas las orgs</option>
          {(orgsQuery.data ?? []).map((o: any) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        <select
          value={action ?? ""}
          onChange={e => setAction(e.target.value || undefined)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
          title="Desde"
        />
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
          title="Hasta"
        />

        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Limpiar
        </button>
      </div>

      {auditQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Cargando auditoría...
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No hay movimientos registrados que coincidan con los filtros.
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Actor</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
                <th className="px-4 py-3 text-left font-medium">Entidad</th>
                <th className="px-4 py-3 text-left font-medium">Resumen</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry: any) => (
                <tr
                  key={entry.id}
                  className="border-t hover:bg-muted/10 cursor-pointer"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleDateString("es-CO", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium">
                      {entry.actorName || entry.actorEmail || "Sistema"}
                    </span>
                    {entry.actorEmail && (
                      <p className="text-xs text-muted-foreground">{entry.actorEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${ACTION_COLORS[entry.action] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {entry.entityType}
                    {entry.entityName && ` · ${entry.entityName}`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {entry.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelectedEntry(null); }}
        >
          <div className="mx-4 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Detalle del movimiento</h2>
              <button
                onClick={() => setSelectedEntry(null)}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha</span>
                <span>{new Date(selectedEntry.createdAt).toLocaleString("es-CO")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actor</span>
                <span>{selectedEntry.actorName || selectedEntry.actorEmail || "Sistema"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Acción</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLORS[selectedEntry.action] ?? ""}`}>
                  {ACTION_LABELS[selectedEntry.action] ?? selectedEntry.action}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entidad</span>
                <span>{selectedEntry.entityType} · {selectedEntry.entityId}</span>
              </div>
              {selectedEntry.details && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-xs">Detalles</span>
                  <pre className="mt-1 rounded-lg bg-muted/30 p-3 text-xs overflow-x-auto max-h-60">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedEntry.details), null, 2);
                      } catch {
                        return selectedEntry.details;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

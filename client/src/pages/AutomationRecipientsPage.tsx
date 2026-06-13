import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, User, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface Recipient {
  id: number;
  name: string;
  telegramChatId: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean | null;
}

export function AutomationRecipientsPage() {
  const utils = trpc.useUtils();
  const recipientsQuery = trpc.automation.recipients.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const recipients = recipientsQuery.data ?? [];

  const createMutation = trpc.automation.recipients.create.useMutation({
    onSuccess: () => {
      utils.automation.recipients.list.invalidate();
      toast.success("Destinatario creado");
    },
    onError: error => toast.error(`Error al crear: ${error.message}`),
  });

  const updateMutation = trpc.automation.recipients.update.useMutation({
    onSuccess: () => {
      utils.automation.recipients.list.invalidate();
      toast.success("Destinatario actualizado");
    },
    onError: error => toast.error(`Error al actualizar: ${error.message}`),
  });

  const deleteMutation = trpc.automation.recipients.delete.useMutation({
    onSuccess: () => {
      utils.automation.recipients.list.invalidate();
      toast.success("Destinatario eliminado");
    },
    onError: error => toast.error(`Error al eliminar: ${error.message}`),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{
    name: string;
    telegramChatId: string;
    email: string;
    notes: string;
    isActive: boolean;
  }>({
    name: "",
    telegramChatId: "",
    email: "",
    notes: "",
    isActive: true,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    telegramChatId: "",
    email: "",
    notes: "",
  });

  const resetCreate = () => {
    setCreateForm({ name: "", telegramChatId: "", email: "", notes: "" });
    setShowCreate(false);
  };

  const handleCreate = () => {
    if (!createForm.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!createForm.telegramChatId.trim() && !createForm.email.trim()) {
      toast.error("Indica al menos un chatId de Telegram o un email");
      return;
    }
    createMutation.mutate({
      name: createForm.name.trim(),
      telegramChatId: createForm.telegramChatId.trim() || null,
      email: createForm.email.trim() || null,
      notes: createForm.notes.trim() || null,
      isActive: true,
    });
    resetCreate();
  };

  const handleEditStart = (r: Recipient) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      telegramChatId: r.telegramChatId ?? "",
      email: r.email ?? "",
      notes: r.notes ?? "",
      isActive: r.isActive ?? true,
    });
  };

  const handleEditSave = () => {
    if (editingId === null) return;
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!form.telegramChatId.trim() && !form.email.trim()) {
      toast.error("Indica al menos un chatId de Telegram o un email");
      return;
    }
    updateMutation.mutate({
      id: editingId,
      name: form.name.trim(),
      telegramChatId: form.telegramChatId.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      isActive: form.isActive,
    });
    setEditingId(null);
  };

  const handleEditCancel = () => setEditingId(null);

  const handleToggleActive = (r: Recipient) => {
    updateMutation.mutate({
      id: r.id,
      isActive: !(r.isActive ?? true),
    });
  };

  const handleDelete = (r: Recipient) => {
    if (confirm(`¿Eliminar al destinatario "${r.name}"?`)) {
      deleteMutation.mutate(r.id);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Destinatarios de automatizaciones
        </h1>
        <p className="text-muted-foreground">
          Libreta de personas (no del sistema) que pueden recibir notificaciones
          cuando un lead cambia a GANADO, PERDIDO o PROPUESTA. Solo el
          superadministrador puede gestionar esta lista.
        </p>
      </div>

      <Button
        onClick={() => setShowCreate(s => !s)}
        className="gap-2"
        variant={showCreate ? "outline" : "default"}
      >
        {showCreate ? (
          <>
            <X className="h-4 w-4" /> Cancelar
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" /> Nuevo destinatario
          </>
        )}
      </Button>

      {showCreate && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Crear destinatario</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre *
              </label>
              <Input
                value={createForm.name}
                onChange={e =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="Ej. María González"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Chat ID de Telegram
              </label>
              <Input
                value={createForm.telegramChatId}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    telegramChatId: e.target.value,
                  })
                }
                placeholder="123456789 (opcional)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                value={createForm.email}
                onChange={e =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="maria@empresa.com (opcional)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Notas internas
              </label>
              <Input
                value={createForm.notes}
                onChange={e =>
                  setCreateForm({ ...createForm, notes: e.target.value })
                }
                placeholder="Ej. Director comercial"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            * Al menos uno de los dos canales (Telegram o Email) es obligatorio.
          </p>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" /> Guardar destinatario
          </Button>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {recipientsQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            Cargando destinatarios...
          </div>
        ) : recipients.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            Aún no hay destinatarios configurados. Crea el primero con el botón
            superior.
          </div>
        ) : (
          recipients.map(r => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 transition ${
                r.isActive ? "bg-card" : "bg-muted/30"
              }`}
            >
              {editingId === r.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Nombre *
                      </label>
                      <Input
                        value={form.name}
                        onChange={e =>
                          setForm({ ...form, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Chat ID Telegram
                      </label>
                      <Input
                        value={form.telegramChatId}
                        onChange={e =>
                          setForm({ ...form, telegramChatId: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Notas
                      </label>
                      <Input
                        value={form.notes}
                        onChange={e =>
                          setForm({ ...form, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={e =>
                        setForm({ ...form, isActive: e.target.checked })
                      }
                    />
                    Destinatario activo
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleEditSave}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditCancel}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <User className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {r.telegramChatId ? (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          Telegram: {r.telegramChatId}
                        </span>
                      ) : null}
                      {r.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {r.email}
                        </span>
                      ) : null}
                      {r.notes ? (
                        <span className="italic">— {r.notes}</span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={r.isActive ? "default" : "outline"}
                    onClick={() => handleToggleActive(r)}
                  >
                    {r.isActive ? "Activo" : "Inactivo"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditStart(r)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

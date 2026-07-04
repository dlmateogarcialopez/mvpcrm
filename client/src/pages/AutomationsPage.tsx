import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Play,
  Pause,
  BarChart3,
  Loader2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface Automation {
  id: number;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean | null;
  executionCount: number | null;
  lastExecutedAt?: string | null | Date;
  triggerCondition?: string | null;
  actionData?: string | null;
}

const TRIGGERS = [
  { value: "lead_created", label: "Cuando se crea un lead" },
  { value: "status_changed", label: "Cuando cambia el estado" },
  { value: "label_added", label: "Cuando se añade una etiqueta" },
  { value: "gestion_vencida", label: "Cuando un lead pasa a gestión vencida" },
  {
    value: "proxima_a_vencer",
    label: "Cuando faltan N días para vencer la gestión",
  },
  { value: "daily_schedule", label: "Diariamente a las..." },
  { value: "after_visit", label: "Después de la fecha de visita" },
  {
    value: "opportunity_won",
    label: "Cuando un lead pasa a GANADO",
    superadminOnly: true,
  },
  {
    value: "opportunity_lost",
    label: "Cuando un lead pasa a PERDIDO",
    superadminOnly: true,
  },
  {
    value: "opportunity_proposal_sent",
    label: "Cuando se envía propuesta",
    superadminOnly: true,
  },
];

const ACTIONS = [
  { value: "assign_agent", label: "Asignar a un agente" },
  { value: "send_email", label: "Enviar email" },
  { value: "add_label", label: "Añadir etiqueta" },
  { value: "change_status", label: "Cambiar estado" },
  {
    value: "send_telegram_to_user",
    label: "Enviar Telegram a destinatario",
    superadminOnly: true,
  },
  {
    value: "send_email_to_user",
    label: "Enviar email a destinatario",
    superadminOnly: true,
  },
];

export function AutomationsPage() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const visibleTriggers = useMemo(
    () => TRIGGERS.filter(t => isSuperadmin || !t.superadminOnly),
    [isSuperadmin]
  );
  const visibleActions = useMemo(
    () => ACTIONS.filter(a => isSuperadmin || !a.superadminOnly),
    [isSuperadmin]
  );

  const rulesQuery = trpc.automation.listRules.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const rules = rulesQuery.data ?? [];

  const recipientsQuery = trpc.automation.recipients.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: isSuperadmin,
  });
  const recipients = recipientsQuery.data ?? [];

  const membersTelegramQuery = trpc.organizations.membersWithTelegram.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );
  const membersTelegram = membersTelegramQuery.data ?? [];

  const createRecipientMutation = trpc.automation.recipients.create.useMutation(
    {
      onSuccess: () => {
        utils.automation.recipients.list.invalidate();
        toast.success("Destinatario creado");
      },
      onError: e => toast.error(`Error al crear destinatario: ${e.message}`),
    }
  );

  const createMutation = trpc.automation.createRule.useMutation({
    onSuccess: () => {
      utils.automation.listRules.invalidate();
      toast.success("Automatización creada correctamente");
    },
    onError: error => {
      toast.error(`Error al crear: ${error.message}`);
    },
  });

  const updateMutation = trpc.automation.updateRule.useMutation({
    onSuccess: () => {
      utils.automation.listRules.invalidate();
      toast.success("Automatización actualizada");
    },
    onError: error => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.automation.deleteRule.useMutation({
    onSuccess: () => {
      utils.automation.listRules.invalidate();
      toast.success("Automatización eliminada");
    },
    onError: error => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  const runAllMutation = trpc.automation.runActiveRulesManually.useMutation({
    onSuccess: data => {
      utils.automation.listRules.invalidate();
      toast.success(
        `Reglas ejecutadas: ${data.executed} acciones (${data.rulesEvaluated} reglas evaluadas, ${data.leadsVencidos} leads vencidos).`
      );
    },
    onError: error => {
      toast.error(`Error al ejecutar: ${error.message}`);
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTrigger, setEditingTrigger] = useState("");
  const [editingAction, setEditingAction] = useState("");
  const [editingTriggerCondition, setEditingTriggerCondition] = useState("");
  const [editingActionData, setEditingActionData] = useState("");
  const [editingPipelineId, setEditingPipelineId] = useState<number | null>(
    null
  );
  const [editingStageNames, setEditingStageNames] = useState<string[]>([]);

  // Pipelines y stages para el selector de status_changed
  const pipelinesQuery = trpc.pipeline.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const pipelines = (pipelinesQuery.data as any[] | undefined) ?? [];
  const stagesQuery = trpc.pipeline.list.useQuery(
    editingPipelineId ? { pipelineId: editingPipelineId } : undefined,
    { enabled: editingPipelineId !== null, refetchOnWindowFocus: false }
  );
  const stages = (stagesQuery.data as any[] | undefined) ?? [];

  const handleAddAutomation = () => {
    createMutation.mutate({
      name: "Nueva Automatización",
      trigger: "lead_created",
      triggerCondition: "",
      action: "assign_agent",
      actionData: "",
      isActive: false,
    });
  };

  const handleDeleteAutomation = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateMutation.mutate({
      id,
      isActive: !currentActive,
    });
  };

  const handleEditStart = (automation: Automation) => {
    setEditingId(automation.id);
    setEditingName(automation.name);
    setEditingTrigger(automation.trigger);
    setEditingAction(automation.action);
    setEditingActionData(automation.actionData ?? "");
    // Parsear triggerCondition: puede ser string simple o JSON {pipelineId, stageNames}
    const cond = automation.triggerCondition;
    if (cond && cond.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(cond);
        if (typeof parsed === "object" && parsed !== null) {
          if (typeof parsed.pipelineId === "number") {
            setEditingPipelineId(parsed.pipelineId);
          } else {
            setEditingPipelineId(null);
          }
          if (Array.isArray(parsed.stageNames)) {
            setEditingStageNames(
              parsed.stageNames.filter((n: any) => typeof n === "string")
            );
          } else {
            setEditingStageNames([]);
          }
          setEditingTriggerCondition("");
          return;
        }
      } catch {
        // Fallback to string
      }
    }
    setEditingPipelineId(null);
    setEditingStageNames([]);
    setEditingTriggerCondition(cond ?? "");
  };

  const handleEditSave = () => {
    if (editingId !== null) {
      const usesCondition =
        editingTrigger === "proxima_a_vencer" ||
        editingTrigger === "label_added";

      // Para status_changed, serializar pipeline + stageNames como JSON
      let triggerCondition = usesCondition ? editingTriggerCondition : "";
      if (editingTrigger === "status_changed") {
        if (editingPipelineId && editingStageNames.length > 0) {
          triggerCondition = JSON.stringify({
            pipelineId: editingPipelineId,
            stageNames: editingStageNames,
          });
        } else {
          triggerCondition = ""; // sin filtro = todos
        }
      }

      const usesActionDataRecipient =
        editingAction === "send_telegram_to_user" ||
        editingAction === "send_email_to_user";

      updateMutation.mutate({
        id: editingId,
        name: editingName,
        trigger: editingTrigger,
        action: editingAction,
        triggerCondition,
        actionData: usesActionDataRecipient ? editingActionData : "",
      });
      setEditingId(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Automatizaciones</h1>
        <p className="text-muted-foreground">
          Crea reglas automáticas para optimizar tu flujo de trabajo y aumentar
          la eficiencia del equipo.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Automatizaciones Activas
          </p>
          <p className="mt-2 text-2xl font-bold">
            {rules.filter(a => a.isActive).length}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Ejecuciones Totales
          </p>
          <p className="mt-2 text-2xl font-bold">
            {rules.reduce((sum, a) => sum + (a.executionCount ?? 0), 0)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Tiempo Ahorrado
          </p>
          <p className="mt-2 text-2xl font-bold">~8h</p>
        </div>
      </div>

      {/* Botón de Agregar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleAddAutomation} className="gap-2">
          <Plus className="h-4 w-4" />
          Crear Automatización
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          disabled={
            runAllMutation.isPending ||
            rules.filter(a => a.isActive).length === 0
          }
          onClick={() => runAllMutation.mutate()}
        >
          {runAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Ejecutar todas las reglas ahora
        </Button>
      </div>

      {/* Lista de Automatizaciones */}
      <div className="space-y-3">
        {rules.map(automation => (
          <div
            key={automation.id}
            className={`rounded-2xl border p-4 transition ${
              automation.isActive ? "bg-card" : "bg-muted/30"
            }`}
          >
            {editingId === automation.id ? (
              <div className="space-y-3">
                <Input
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  placeholder="Nombre de la automatización"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={editingTrigger}
                    onChange={e => setEditingTrigger(e.target.value)}
                    className="rounded border bg-background px-3 py-2"
                  >
                    {visibleTriggers.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editingAction}
                    onChange={e => setEditingAction(e.target.value)}
                    className="rounded border bg-background px-3 py-2"
                  >
                    {visibleActions.map(a => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                {editingTrigger === "proxima_a_vencer" && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Días antes del vencimiento
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={editingTriggerCondition}
                        onChange={e =>
                          setEditingTriggerCondition(e.target.value)
                        }
                        placeholder="3"
                      />
                      <span className="text-sm text-muted-foreground">
                        días
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Acepta decimales (ej. 0.5 = 12 h, 1.5 = 1 día y 12 h). Si
                      lo dejas vacío, se usan 3 días.
                    </p>
                  </div>
                )}

                {editingTrigger === "label_added" && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Etiqueta a detectar
                    </label>
                    <Input
                      value={editingTriggerCondition}
                      onChange={e => setEditingTriggerCondition(e.target.value)}
                      placeholder="Etiqueta a detectar (ej. VIP)"
                    />
                  </div>
                )}

                {editingTrigger === "status_changed" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Embudo
                      </label>
                      <select
                        className="rounded-md border bg-background px-3 py-2 text-sm w-full"
                        value={editingPipelineId ?? ""}
                        onChange={e => {
                          const v = e.target.value;
                          setEditingPipelineId(v ? Number(v) : null);
                          setEditingStageNames([]);
                        }}
                      >
                        <option value="">— Cualquiera —</option>
                        {pipelines.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {editingPipelineId && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Fases a detectar
                        </label>
                        {stages.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Cargando fases…
                          </p>
                        ) : (
                          <div className="space-y-1.5 rounded-md border bg-background p-2 max-h-60 overflow-y-auto">
                            {stages.map(s => (
                              <label
                                key={s.id}
                                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={editingStageNames.includes(s.name)}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setEditingStageNames(prev => [
                                        ...prev,
                                        s.name,
                                      ]);
                                    } else {
                                      setEditingStageNames(prev =>
                                        prev.filter(n => n !== s.name)
                                      );
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm">
                                  {s.displayName || s.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Si no seleccionas ninguna fase, se dispara en
                          cualquier cambio de estado.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(editingAction === "send_telegram_to_user" ||
                  editingAction === "send_email_to_user") && (
                  <RecipientPickerSection
                    recipients={recipients}
                    membersTelegram={
                      editingAction === "send_telegram_to_user"
                        ? membersTelegram
                        : []
                    }
                    value={editingActionData}
                    onChange={setEditingActionData}
                    onCreateInline={async payload => {
                      const created =
                        await createRecipientMutation.mutateAsync(payload);
                      return created;
                    }}
                    channel={
                      editingAction === "send_telegram_to_user"
                        ? "telegram"
                        : "email"
                    }
                  />
                )}

                {editingTrigger === "after_visit" &&
                  editingAction === "send_email" && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Mensaje del email
                      </label>
                      <textarea
                        value={editingActionData}
                        onChange={e => setEditingActionData(e.target.value)}
                        placeholder={`Hola,\n\nEsperamos que tu visita haya sido de tu agrado...`}
                        className="min-h-28 rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary w-full resize-y"
                      />
                      <p className="text-xs text-muted-foreground">
                        Si lo dejas vacío, se enviará un mensaje por defecto.
                      </p>
                    </div>
                  )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEditSave} className="flex-1">
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
                <div className="flex-1">
                  <p className="font-medium">{automation.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {TRIGGERS.find(t => t.value === automation.trigger)?.label}
                    {automation.trigger === "proxima_a_vencer" &&
                      automation.triggerCondition && (
                        <span className="font-medium">
                          {" "}
                          ({automation.triggerCondition} días)
                        </span>
                      )}
                    {automation.trigger === "label_added" &&
                      automation.triggerCondition && (
                        <span className="font-medium">
                          {" "}
                          ({automation.triggerCondition})
                        </span>
                      )}
                    {automation.trigger === "status_changed" &&
                      automation.triggerCondition && (
                        <span className="font-medium">
                          {" "}
                          (estado: {automation.triggerCondition})
                        </span>
                      )}{" "}
                    → {ACTIONS.find(a => a.value === automation.action)?.label}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {automation.executionCount ?? 0} ejecuciones
                    </span>
                    {automation.lastExecutedAt && (
                      <span>
                        Última:{" "}
                        {new Date(automation.lastExecutedAt).toLocaleString(
                          "es-CO"
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={automation.isActive ? "default" : "outline"}
                  onClick={() =>
                    handleToggleActive(automation.id, !!automation.isActive)
                  }
                >
                  {automation.isActive ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Activar
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditStart(automation)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteAutomation(automation.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface RecipientLite {
  id: number;
  name: string;
  telegramChatId: string | null;
  email: string | null;
  isActive: boolean | null;
}

interface RecipientPickerSectionProps {
  recipients: RecipientLite[];
  membersTelegram: {
    userId: number;
    name: string;
    email: string | null;
    telegramChatId: string | null;
  }[];
  value: string;
  onChange: (v: string) => void;
  onCreateInline: (payload: {
    name: string;
    telegramChatId: string | null;
    email: string | null;
    notes: string | null;
    isActive: boolean;
  }) => Promise<{ id: number; name: string }>;
  channel: "telegram" | "email";
}

function RecipientPickerSection({
  recipients,
  membersTelegram,
  value,
  onChange,
  onCreateInline,
  channel,
}: RecipientPickerSectionProps) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTelegram, setNewTelegram] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  // Parsear el value a una lista de IDs seleccionados.
  // Acepta formato nuevo: { userIds: [...], recipientIds: [...] }
  // y formato viejo: { userId: N } o { recipientId: N } para retrocompatibilidad.
  const selectedUserIds = useMemo<number[]>(() => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed?.userIds)) {
        return parsed.userIds.filter((n: any) => typeof n === "number");
      }
      if (typeof parsed?.userId === "number") {
        return [parsed.userId];
      }
    } catch {}
    return [];
  }, [value]);

  const selectedRecipientIds = useMemo<number[]>(() => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed?.recipientIds)) {
        return parsed.recipientIds.filter((n: any) => typeof n === "number");
      }
      if (typeof parsed?.recipientId === "number") {
        return [parsed.recipientId];
      }
    } catch {}
    return [];
  }, [value]);

  const toggleUser = (userId: number) => {
    const next = selectedUserIds.includes(userId)
      ? selectedUserIds.filter(id => id !== userId)
      : [...selectedUserIds, userId];
    onChange(
      JSON.stringify({ userIds: next, recipientIds: selectedRecipientIds })
    );
  };

  const toggleRecipient = (recipientId: number) => {
    const next = selectedRecipientIds.includes(recipientId)
      ? selectedRecipientIds.filter(id => id !== recipientId)
      : [...selectedRecipientIds, recipientId];
    onChange(JSON.stringify({ userIds: selectedUserIds, recipientIds: next }));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (channel === "telegram" && !newTelegram.trim()) return;
    if (channel === "email" && !newEmail.trim()) return;
    setSaving(true);
    try {
      const created = await onCreateInline({
        name: newName.trim(),
        telegramChatId: channel === "telegram" ? newTelegram.trim() : null,
        email: channel === "email" ? newEmail.trim() : null,
        notes: null,
        isActive: true,
      });
      // Si era el primer destinatario seleccionado, automáticamente lo agregamos a la lista.
      const nextRecipients =
        selectedRecipientIds.length === 0
          ? [created.id]
          : [...selectedRecipientIds, created.id];
      onChange(
        JSON.stringify({
          userIds: selectedUserIds,
          recipientIds: nextRecipients,
        })
      );
      setNewName("");
      setNewTelegram("");
      setNewEmail("");
      setShowNew(false);
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = selectedUserIds.length + selectedRecipientIds.length;

  return (
    <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <User className="h-3 w-3" />
        Destinatario {channel === "telegram" ? "(Telegram)" : "(Email)"}
      </label>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {totalSelected === 0
              ? "Ningún destinatario seleccionado"
              : `${totalSelected} destinatario${totalSelected === 1 ? "" : "s"} seleccionado${totalSelected === 1 ? "" : "s"}`}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowNew(s => !s)}
          >
            {showNew ? "Cancelar" : "+ Nuevo destinatario"}
          </Button>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto rounded-xl border bg-background p-3">
          {channel === "telegram" && membersTelegram.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-1">
                👤 Miembros de la organización (Telegram)
              </p>
              {membersTelegram.map(m => (
                <label
                  key={"user_" + m.userId}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(m.userId)}
                    onChange={() => toggleUser(m.userId)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="flex-1 text-sm">
                    {m.name || m.email}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {m.telegramChatId}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {recipients.filter(r =>
            channel === "telegram" ? r.telegramChatId : r.email
          ).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-1">
                📋 Destinatarios predefinidos
              </p>
              {recipients
                .filter(r =>
                  channel === "telegram" ? r.telegramChatId : r.email
                )
                .map(r => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.includes(r.id)}
                      onChange={() => toggleRecipient(r.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="flex-1 text-sm">
                      {r.name}
                      {r.isActive === false && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (inactivo)
                        </span>
                      )}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {channel === "telegram"
                          ? r.telegramChatId || "(sin chatId)"
                          : r.email || "(sin email)"}
                      </span>
                    </span>
                  </label>
                ))}
            </div>
          )}

          {channel === "telegram" && membersTelegram.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">
              No hay miembros con chat ID de Telegram configurado. Configura el
              chat ID de tus miembros en Configuración.
            </p>
          )}
        </div>
      </div>

      {showNew && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre *
              </label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nombre del destinatario"
              />
            </div>
            {channel === "telegram" ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Chat ID *
                </label>
                <Input
                  value={newTelegram}
                  onChange={e => setNewTelegram(e.target.value)}
                  placeholder="123456789"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Email *
                </label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="persona@empresa.com"
                />
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "Creando..." : "Crear y seleccionar"}
          </Button>
        </div>
      )}
    </div>
  );
}

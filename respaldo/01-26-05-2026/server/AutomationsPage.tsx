import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Play, Pause, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean;
  executionCount: number;
  lastExecuted?: string;
}

const TRIGGERS = [
  { value: "lead_created", label: "Cuando se crea un lead" },
  { value: "status_changed", label: "Cuando cambia el estado" },
  { value: "label_added", label: "Cuando se añade una etiqueta" },
  { value: "daily_schedule", label: "Diariamente a las..." },
];

const ACTIONS = [
  { value: "assign_agent", label: "Asignar a un agente" },
  { value: "send_email", label: "Enviar email" },
  { value: "send_telegram", label: "Enviar alerta por Telegram" },
  { value: "add_label", label: "Añadir etiqueta" },
  { value: "change_status", label: "Cambiar estado" },
];

const DEFAULT_AUTOMATIONS: Automation[] = [
  {
    id: "1",
    name: "Asignar leads nuevos",
    trigger: "lead_created",
    action: "assign_agent",
    isActive: true,
    executionCount: 45,
    lastExecuted: "Hace 2 minutos",
  },
  {
    id: "2",
    name: "Alerta para leads urgentes",
    trigger: "status_changed",
    action: "send_telegram",
    isActive: true,
    executionCount: 12,
    lastExecuted: "Hace 1 hora",
  },
];

export function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>(DEFAULT_AUTOMATIONS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTrigger, setEditingTrigger] = useState("");
  const [editingAction, setEditingAction] = useState("");

  const handleAddAutomation = () => {
    const newAutomation: Automation = {
      id: Date.now().toString(),
      name: "Nueva Automatización",
      trigger: "lead_created",
      action: "assign_agent",
      isActive: false,
      executionCount: 0,
    };
    setAutomations([...automations, newAutomation]);
  };

  const handleDeleteAutomation = (id: string) => {
    setAutomations(automations.filter(a => a.id !== id));
  };

  const handleToggleActive = (id: string) => {
    setAutomations(
      automations.map(a =>
        a.id === id ? { ...a, isActive: !a.isActive } : a
      )
    );
  };

  const handleEditStart = (automation: Automation) => {
    setEditingId(automation.id);
    setEditingName(automation.name);
    setEditingTrigger(automation.trigger);
    setEditingAction(automation.action);
  };

  const handleEditSave = () => {
    setAutomations(
      automations.map(a =>
        a.id === editingId
          ? { ...a, name: editingName, trigger: editingTrigger, action: editingAction }
          : a
      )
    );
    setEditingId(null);
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
          Crea reglas automáticas para optimizar tu flujo de trabajo y aumentar la eficiencia del equipo.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Automatizaciones Activas</p>
          <p className="mt-2 text-2xl font-bold">
            {automations.filter(a => a.isActive).length}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Ejecuciones Totales</p>
          <p className="mt-2 text-2xl font-bold">
            {automations.reduce((sum, a) => sum + a.executionCount, 0)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Tiempo Ahorrado</p>
          <p className="mt-2 text-2xl font-bold">~8h</p>
        </div>
      </div>

      {/* Botón de Agregar */}
      <Button onClick={handleAddAutomation} className="gap-2">
        <Plus className="h-4 w-4" />
        Crear Automatización
      </Button>

      {/* Lista de Automatizaciones */}
      <div className="space-y-3">
        {automations.map(automation => (
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
                    {TRIGGERS.map(t => (
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
                    {ACTIONS.map(a => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEditSave} className="flex-1">
                    <Check className="h-4 w-4 mr-1" />
                    Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEditCancel} className="flex-1">
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
                    {TRIGGERS.find(t => t.value === automation.trigger)?.label} →{" "}
                    {ACTIONS.find(a => a.value === automation.action)?.label}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {automation.executionCount} ejecuciones
                    </span>
                    {automation.lastExecuted && <span>{automation.lastExecuted}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={automation.isActive ? "default" : "outline"}
                  onClick={() => handleToggleActive(automation.id)}
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

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Send, BarChart3, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";

interface EmailCampaign {
  id: number;
  name: string;
  subject: string;
  content: string | null;
  targetSegment: string;
  targetSegmentData: string | null;
  status: string | null;
  totalSent: number | null;
  totalOpened: number | null;
  totalClicked: number | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

export function EmailMarketingPage() {
  const utils = trpc.useUtils();

  // Cargar campañas
  const campaignsQuery = trpc.automation.listCampaigns.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const campaigns = (campaignsQuery.data ?? []) as unknown as EmailCampaign[];

  // Cargar etapas de embudo y etiquetas para el selector de segmentos
  const stagesQuery = trpc.automation.listStages.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const stages = stagesQuery.data ?? [];

  const labelsQuery = trpc.automation.listLabels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const labels = labelsQuery.data ?? [];

  // Mutaciones TRPC
  const createMutation = trpc.automation.createCampaign.useMutation({
    onSuccess: () => {
      utils.automation.listCampaigns.invalidate();
      toast.success("Campaña creada correctamente");
      setShowNewCampaignForm(false);
      // Resetear inputs
      setNewCampaignName("");
      setNewCampaignSubject("");
      setNewCampaignContent("");
      setNewCampaignSegment("all");
      setNewCampaignSegmentData("");
    },
    onError: (error) => {
      toast.error(`Error al crear campaña: ${error.message}`);
    },
  });

  const updateMutation = trpc.automation.updateCampaign.useMutation({
    onSuccess: () => {
      utils.automation.listCampaigns.invalidate();
      toast.success("Campaña actualizada");
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(`Error al actualizar campaña: ${error.message}`);
    },
  });

  const deleteMutation = trpc.automation.deleteCampaign.useMutation({
    onSuccess: () => {
      utils.automation.listCampaigns.invalidate();
      toast.success("Campaña eliminada");
    },
    onError: (error) => {
      toast.error(`Error al eliminar campaña: ${error.message}`);
    },
  });

  const sendMutation = trpc.automation.sendCampaign.useMutation({
    onSuccess: (data) => {
      utils.automation.listCampaigns.invalidate();
      toast.success(`¡Campaña enviada! Se procesaron ${data.totalSent} correos.`);
    },
    onError: (error) => {
      toast.error(`Error al enviar campaña: ${error.message}`);
    },
  });

  // Estados del Formulario de Creación
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignSubject, setNewCampaignSubject] = useState("");
  const [newCampaignContent, setNewCampaignContent] = useState("");
  const [newCampaignSegment, setNewCampaignSegment] = useState("all");
  const [newCampaignSegmentData, setNewCampaignSegmentData] = useState("");

  // Estados de Edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSubject, setEditingSubject] = useState("");

  const handleAddCampaign = () => {
    if (!newCampaignName.trim() || !newCampaignSubject.trim()) {
      toast.error("El nombre y el asunto son obligatorios");
      return;
    }

    createMutation.mutate({
      name: newCampaignName,
      subject: newCampaignSubject,
      content: newCampaignContent,
      targetSegment: newCampaignSegment,
      targetSegmentData: newCampaignSegment === "all" ? null : newCampaignSegmentData || null,
    });
  };

  const handleDeleteCampaign = (id: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta campaña?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditStart = (campaign: EmailCampaign) => {
    setEditingId(campaign.id);
    setEditingName(campaign.name);
    setEditingSubject(campaign.subject);
  };

  const handleEditSave = () => {
    if (!editingName.trim() || !editingSubject.trim()) {
      toast.error("El nombre y el asunto son obligatorios");
      return;
    }
    updateMutation.mutate({
      id: editingId!,
      name: editingName,
      subject: editingSubject,
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const getStatusBadge = (status: string | null) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sending: "bg-blue-100 text-blue-800 animate-pulse",
      sent: "bg-green-100 text-green-800",
      paused: "bg-yellow-100 text-yellow-800",
    };
    const labels: Record<string, string> = {
      draft: "Borrador",
      sending: "Enviando...",
      sent: "Enviada",
      paused: "Pausada",
    };
    const currentStatus = status || "draft";
    return (
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${styles[currentStatus] || styles.draft}`}>
        {labels[currentStatus] || labels.draft}
      </span>
    );
  };

  const getSegmentLabel = (segment: string, data: string | null) => {
    if (segment === "all") return "Todos los leads";
    if (segment === "stage") {
      const stage = stages.find(s => String(s.name) === String(data) || String(s.id) === String(data));
      return `Segmento · Etapa: ${stage?.displayName || data || "Sin especificar"}`;
    }
    if (segment === "label") {
      const label = labels.find(l => String(l.id) === String(data) || String(l.name) === String(data));
      return `Segmento · Etiqueta: ${label?.name || data || "Sin especificar"}`;
    }
    return `Segmento · ${segment}`;
  };

  const calculateOpenRate = (campaign: EmailCampaign) => {
    const sent = campaign.totalSent || 0;
    const opened = campaign.totalOpened || 0;
    if (sent === 0) return 0;
    return Math.round((opened / sent) * 100);
  };

  const calculateClickRate = (campaign: EmailCampaign) => {
    const sent = campaign.totalSent || 0;
    const clicked = campaign.totalClicked || 0;
    if (sent === 0) return 0;
    return Math.round((clicked / sent) * 100);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Email Marketing</h1>
        <p className="text-muted-foreground">
          Crea y gestiona campañas de email para mantener a tus leads comprometidos de forma segmentada.
        </p>
      </div>

      {/* Estadísticas Generales */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Campañas Totales</p>
          <p className="mt-2 text-2xl font-bold">{campaigns.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Emails Enviados</p>
          <p className="mt-2 text-2xl font-bold">
            {campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Tasa de Apertura Promedio</p>
          <p className="mt-2 text-2xl font-bold">
            {campaigns.length > 0
              ? Math.round(
                  (campaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0) /
                    Math.max(campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0), 1)) *
                    100
                )
              : 0}
            %
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Tasa de Clics Promedio</p>
          <p className="mt-2 text-2xl font-bold">
            {campaigns.length > 0
              ? Math.round(
                  (campaigns.reduce((sum, c) => sum + (c.totalClicked || 0), 0) /
                    Math.max(campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0), 1)) *
                    100
                )
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Botón de Agregar */}
      {!showNewCampaignForm && (
        <Button onClick={() => setShowNewCampaignForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Crear Nueva Campaña
        </Button>
      )}

      {/* Formulario de Nueva Campaña */}
      {showNewCampaignForm && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-lg">Nueva Campaña de Email</h3>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Nombre de la Campaña (Interno)</label>
            <Input 
              value={newCampaignName} 
              onChange={e => setNewCampaignName(e.target.value)} 
              placeholder="Ej: Seguimiento de Leads Calientes" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Asunto del Correo</label>
            <Input 
              value={newCampaignSubject} 
              onChange={e => setNewCampaignSubject(e.target.value)} 
              placeholder="Ej: Hola {{nombre}}, ¿cómo va todo con tu evento?" 
            />
            <p className="text-[11px] text-muted-foreground">
              Puedes usar variables: <code className="bg-muted px-1 py-0.5 rounded">{"{{nombre}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{empresa}}"}</code>, o <code className="bg-muted px-1 py-0.5 rounded">{"{{valor}}"}</code>.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Contenido del Mensaje</label>
            <Textarea 
              value={newCampaignContent} 
              onChange={e => setNewCampaignContent(e.target.value)} 
              placeholder="Escribe el cuerpo del correo electrónico aquí..." 
              rows={6} 
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Segmento Destinatario</label>
              <select 
                value={newCampaignSegment} 
                onChange={e => {
                  setNewCampaignSegment(e.target.value);
                  setNewCampaignSegmentData("");
                }} 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="all">Todos los leads</option>
                <option value="stage">Por etapa del embudo</option>
                <option value="label">Por etiqueta</option>
              </select>
            </div>

            {newCampaignSegment === "stage" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Seleccionar Etapa</label>
                <select 
                  value={newCampaignSegmentData} 
                  onChange={e => setNewCampaignSegmentData(e.target.value)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="">Selecciona una etapa...</option>
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.name}>{stage.displayName}</option>
                  ))}
                </select>
              </div>
            )}

            {newCampaignSegment === "label" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Seleccionar Etiqueta</label>
                <select 
                  value={newCampaignSegmentData} 
                  onChange={e => setNewCampaignSegmentData(e.target.value)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="">Selecciona una etiqueta...</option>
                  {labels.map(label => (
                    <option key={label.id} value={label.id}>{label.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddCampaign} disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Crear Campaña (Borrador)
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowNewCampaignForm(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de Campañas */}
      <div className="space-y-3">
        {campaignsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-lg">No hay campañas de email</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1">
              Crea tu primera campaña para comunicarte con tus leads y mejorar tus conversiones.
            </p>
          </div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign.id} className="rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
              {editingId === campaign.id ? (
                <div className="space-y-3">
                  <Input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    placeholder="Nombre de la campaña"
                  />
                  <Input
                    value={editingSubject}
                    onChange={e => setEditingSubject(e.target.value)}
                    placeholder="Asunto del email"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleEditSave} disabled={updateMutation.isPending} className="flex-1">
                      {updateMutation.isPending ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleEditCancel} className="flex-1">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold text-base">{campaign.name}</h3>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">
                          {getSegmentLabel(campaign.targetSegment, campaign.targetSegmentData)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{campaign.subject}</p>
                      {campaign.content && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded">
                          {campaign.content}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(campaign.status)}
                  </div>

                  {campaign.status === "sent" && (campaign.totalSent || 0) > 0 && (
                    <div className="grid gap-2 sm:grid-cols-3 text-sm bg-muted/20 p-3 rounded-xl border border-muted-foreground/10">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{campaign.totalSent}</strong> enviados</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-semibold">{calculateOpenRate(campaign)}% abiertos</span>
                        <span className="text-xs text-muted-foreground">({campaign.totalOpened} aperturas)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-semibold">{calculateClickRate(campaign)}% clics</span>
                        <span className="text-xs text-muted-foreground">({campaign.totalClicked} clics)</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {campaign.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => sendMutation.mutate(campaign.id)}
                        disabled={sendMutation.isPending}
                        className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                      >
                        {sendMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Enviar Ahora
                          </>
                        )}
                      </Button>
                    )}
                    {campaign.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditStart(campaign)}
                        disabled={sendMutation.isPending}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      disabled={sendMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

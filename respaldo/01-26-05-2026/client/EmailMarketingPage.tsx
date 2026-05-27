import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Send, BarChart3, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  status: "draft" | "scheduled" | "sent" | "paused";
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  createdAt: string;
}

const DEFAULT_CAMPAIGNS: EmailCampaign[] = [
  {
    id: "1",
    name: "Bienvenida a nuevos leads",
    subject: "Bienvenido a nuestro servicio",
    status: "sent",
    totalSent: 234,
    totalOpened: 89,
    totalClicked: 23,
    createdAt: "2024-04-15",
  },
  {
    id: "2",
    name: "Seguimiento de propuestas",
    subject: "¿Tienes preguntas sobre nuestra propuesta?",
    status: "scheduled",
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    createdAt: "2024-04-18",
  },
];

export function EmailMarketingPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>(DEFAULT_CAMPAIGNS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSubject, setEditingSubject] = useState("");
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);

  const handleAddCampaign = () => {
    const newCampaign: EmailCampaign = {
      id: Date.now().toString(),
      name: "Nueva Campaña",
      subject: "Asunto del email",
      status: "draft",
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setCampaigns([...campaigns, newCampaign]);
    setShowNewCampaignForm(false);
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaigns(campaigns.filter(c => c.id !== id));
  };

  const handleEditStart = (campaign: EmailCampaign) => {
    setEditingId(campaign.id);
    setEditingName(campaign.name);
    setEditingSubject(campaign.subject);
  };

  const handleEditSave = () => {
    setCampaigns(
      campaigns.map(c =>
        c.id === editingId ? { ...c, name: editingName, subject: editingSubject } : c
      )
    );
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      scheduled: "bg-blue-100 text-blue-800",
      sent: "bg-green-100 text-green-800",
      paused: "bg-yellow-100 text-yellow-800",
    };
    const labels: Record<string, string> = {
      draft: "Borrador",
      scheduled: "Programada",
      sent: "Enviada",
      paused: "Pausada",
    };
    return (
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const calculateOpenRate = (campaign: EmailCampaign) => {
    if (campaign.totalSent === 0) return 0;
    return Math.round((campaign.totalOpened / campaign.totalSent) * 100);
  };

  const calculateClickRate = (campaign: EmailCampaign) => {
    if (campaign.totalSent === 0) return 0;
    return Math.round((campaign.totalClicked / campaign.totalSent) * 100);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Email Marketing</h1>
        <p className="text-muted-foreground">
          Crea y gestiona campañas de email para mantener a tus leads comprometidos.
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
            {campaigns.reduce((sum, c) => sum + c.totalSent, 0)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Tasa de Apertura</p>
          <p className="mt-2 text-2xl font-bold">
            {campaigns.length > 0
              ? Math.round(
                  (campaigns.reduce((sum, c) => sum + c.totalOpened, 0) /
                    Math.max(campaigns.reduce((sum, c) => sum + c.totalSent, 0), 1)) *
                    100
                )
              : 0}
            %
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Tasa de Clics</p>
          <p className="mt-2 text-2xl font-bold">
            {campaigns.length > 0
              ? Math.round(
                  (campaigns.reduce((sum, c) => sum + c.totalClicked, 0) /
                    Math.max(campaigns.reduce((sum, c) => sum + c.totalSent, 0), 1)) *
                    100
                )
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Botón de Agregar */}
      <Button onClick={() => setShowNewCampaignForm(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Crear Nueva Campaña
      </Button>

      {/* Formulario de Nueva Campaña */}
      {showNewCampaignForm && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Nueva Campaña de Email</h3>
          <Input placeholder="Nombre de la campaña" />
          <Input placeholder="Asunto del email" />
          <Textarea placeholder="Contenido del email" rows={6} />
          <select className="w-full rounded border bg-background px-3 py-2">
            <option>Todos los leads</option>
            <option>Por etapa del embudo</option>
            <option>Por etiqueta</option>
          </select>
          <div className="flex gap-2">
            <Button onClick={handleAddCampaign} className="flex-1">
              <Send className="h-4 w-4 mr-1" />
              Crear Campaña
            </Button>
            <Button variant="outline" onClick={() => setShowNewCampaignForm(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de Campañas */}
      <div className="space-y-3">
        {campaigns.map(campaign => (
          <div key={campaign.id} className="rounded-2xl border bg-card p-4">
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
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">{campaign.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{campaign.subject}</p>
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>

                {campaign.totalSent > 0 && (
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span>{campaign.totalSent} enviados</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium">{calculateOpenRate(campaign)}% abiertos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium">{calculateClickRate(campaign)}% clics</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    Ver Detalles
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditStart(campaign)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteCampaign(campaign.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

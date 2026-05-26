import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, MessageSquare, Mail, Phone, Globe, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Channel {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
}

const AVAILABLE_ICONS = [
  { name: "MessageSquare", icon: MessageSquare, label: "Mensaje" },
  { name: "Mail", icon: Mail, label: "Email" },
  { name: "Phone", icon: Phone, label: "Teléfono" },
  { name: "Globe", icon: Globe, label: "Web" },
  { name: "Facebook", icon: Facebook, label: "Facebook" },
  { name: "Instagram", icon: Instagram, label: "Instagram" },
];

const DEFAULT_CHANNELS: Channel[] = [
  { id: "1", name: "WhatsApp", icon: "MessageSquare", isActive: true },
  { id: "2", name: "Email", icon: "Mail", isActive: true },
  { id: "3", name: "Teléfono", icon: "Phone", isActive: true },
  { id: "4", name: "Sitio Web", icon: "Globe", isActive: true },
  { id: "5", name: "Facebook", icon: "Facebook", isActive: true },
];

export function ChannelsManagerPage() {
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIcon, setEditingIcon] = useState("");

  const handleAddChannel = () => {
    const newChannel: Channel = {
      id: Date.now().toString(),
      name: "Nuevo Canal",
      icon: "MessageSquare",
      isActive: true,
    };
    setChannels([...channels, newChannel]);
  };

  const handleDeleteChannel = (id: string) => {
    setChannels(channels.filter(c => c.id !== id));
  };

  const handleToggleActive = (id: string) => {
    setChannels(
      channels.map(c =>
        c.id === id ? { ...c, isActive: !c.isActive } : c
      )
    );
  };

  const handleEditStart = (channel: Channel) => {
    setEditingId(channel.id);
    setEditingName(channel.name);
    setEditingIcon(channel.icon);
  };

  const handleEditSave = () => {
    setChannels(
      channels.map(c =>
        c.id === editingId ? { ...c, name: editingName, icon: editingIcon } : c
      )
    );
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const getIconComponent = (iconName: string) => {
    const iconObj = AVAILABLE_ICONS.find(i => i.name === iconName);
    return iconObj ? iconObj.icon : MessageSquare;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestor de Canales</h1>
        <p className="text-muted-foreground">
          Define los canales de comunicación por los que recibes leads.
        </p>
      </div>

      {/* Botón de Agregar */}
      <Button onClick={handleAddChannel} className="gap-2">
        <Plus className="h-4 w-4" />
        Agregar Nuevo Canal
      </Button>

      {/* Lista de Canales */}
      <div className="space-y-3">
        {channels.map(channel => {
          const IconComponent = getIconComponent(channel.icon);
          return (
            <div
              key={channel.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
                channel.isActive ? "bg-card" : "bg-muted/30"
              }`}
            >
              <IconComponent className="h-6 w-6 shrink-0 text-muted-foreground" />

              {editingId === channel.id ? (
                <>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      placeholder="Nombre del canal"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {AVAILABLE_ICONS.map(({ name, icon: Icon, label }) => (
                        <button
                          key={name}
                          onClick={() => setEditingIcon(name)}
                          className={`rounded p-2 transition ${
                            editingIcon === name
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          title={label}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" onClick={handleEditSave}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEditCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-medium">{channel.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {channel.isActive ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={channel.isActive ? "default" : "outline"}
                    onClick={() => handleToggleActive(channel.id)}
                  >
                    {channel.isActive ? "Activo" : "Inactivo"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditStart(channel)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteChannel(channel.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

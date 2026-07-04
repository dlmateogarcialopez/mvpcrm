import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageSquare,
  Plug,
  Save,
  Send,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useActiveBrand, useRefreshBrand } from "@/contexts/BrandContext";
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
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type EmailProvider = "resend" | "smtp";

interface IntegrationsForm {
  googleCalendar: {
    enabled: boolean;
    calendarId: string;
  };
  email: {
    enabled: boolean;
    provider: EmailProvider;
    resendApiKey: string;
    from: string;
    fromName: string;
    smtp: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
    alertTo: string;
  };
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  sms: {
    enabled: boolean;
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioFromNumber: string;
    alertTo: string;
  };
  whatsapp: {
    enabled: boolean;
    phoneNumberId: string;
    wabaId: string;
    accessToken: string;
    templates: string;
  };
}

const EMPTY: IntegrationsForm = {
  googleCalendar: { enabled: false, calendarId: "" },
  email: {
    enabled: false,
    provider: "resend",
    resendApiKey: "",
    from: "",
    fromName: "",
    smtp: { host: "smtp.gmail.com", port: 465, user: "", pass: "" },
    alertTo: "",
  },
  telegram: { enabled: false, botToken: "", chatId: "" },
  sms: {
    enabled: false,
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioFromNumber: "",
    alertTo: "",
  },
  whatsapp: {
    enabled: false,
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
    templates: "",
  },
};

/**
 * Panel de integraciones por organización. Reemplaza la
 * sección legacy "Integraciones opcionales" de SettingsPage
 * que usaba appSettings global.
 *
 * Canales:
 *  - Google Calendar: enabled + calendarId
 *  - Email: provider (Resend o SMTP) + credenciales + from
 *  - Telegram: enabled + botToken + chatId
 *  - SMS (Twilio): habilitado pero no implementado en backend
 *    (placeholder para fase futura)
 *
 * Solo admin/owner de la org pueden editar.
 */
export function OrgIntegrationsPanel() {
  const brand = useActiveBrand();
  const refreshBrand = useRefreshBrand();
  const utils = trpc.useUtils();
  const orgsQuery = trpc.organizations.myOrganizations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const settingsQuery = trpc.organizations.currentSettings.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );
  const updateMutation = trpc.organizations.updateSettings.useMutation();

  const me = orgsQuery.data?.find(o => o.id === brand.organizationId);
  const canManage = me?.orgRole === "owner" || me?.orgRole === "admin";

  const [form, setForm] = useState<IntegrationsForm>(EMPTY);
  const [showSecrets, setShowSecrets] = useState({
    telegram: false,
    email: false,
    sms: false,
  });
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  // Inicializar form cuando llegan los settings del server
  useEffect(() => {
    if (settingsQuery.data?.integrations) {
      try {
        const raw = JSON.parse(settingsQuery.data.integrations);
        setForm({
          googleCalendar: {
            enabled: Boolean(raw.googleCalendar?.enabled),
            calendarId: raw.googleCalendar?.calendarId ?? "",
          },
          email: {
            enabled: Boolean(raw.email?.enabled),
            provider: raw.email?.provider === "smtp" ? "smtp" : "resend",
            resendApiKey: raw.email?.resendApiKey ?? "",
            from: raw.email?.from ?? "",
            fromName: raw.email?.fromName ?? "",
            smtp: {
              host: raw.email?.smtp?.host ?? "smtp.gmail.com",
              port: raw.email?.smtp?.port ?? 465,
              user: raw.email?.smtp?.user ?? "",
              pass: raw.email?.smtp?.pass ?? "",
            },
            alertTo: raw.email?.alertTo ?? "",
          },
          telegram: {
            enabled: Boolean(raw.telegram?.enabled),
            botToken: raw.telegram?.botToken ?? "",
            chatId: raw.telegram?.chatId ?? "",
          },
          sms: {
            enabled: Boolean(raw.sms?.enabled),
            twilioAccountSid: raw.sms?.twilioAccountSid ?? "",
            twilioAuthToken: raw.sms?.twilioAuthToken ?? "",
            twilioFromNumber: raw.sms?.twilioFromNumber ?? "",
            alertTo: raw.sms?.alertTo ?? "",
          },
          whatsapp: {
            enabled: Boolean(raw.whatsapp?.enabled),
            phoneNumberId: raw.whatsapp?.phoneNumberId ?? "",
            wabaId: raw.whatsapp?.wabaId ?? "",
            accessToken: raw.whatsapp?.accessToken ?? "",
            templates: raw.whatsapp?.templates ?? "",
          },
        });
      } catch {
        // JSON inválido, mantener EMPTY
      }
    }
  }, [settingsQuery.data]);

  if (!canManage) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Plug className="h-4 w-4" />
          <p>
            Solo administradores pueden configurar las integraciones de esta
            organización. Tu rol actual: <strong>{me?.orgRole}</strong>.
          </p>
        </div>
      </section>
    );
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        integrations: form as unknown as Record<string, unknown>,
      });
      await refreshBrand();
      toast.success("Integraciones actualizadas. El cambio aplica desde ya.");
    } catch (err: any) {
      toast.error(err?.message || "No fue posible guardar las integraciones.");
    }
  };

  const handleTestChannel = async (channel: string) => {
    setTestingChannel(channel);
    // Simulación: en fase futura, agregar mutations específicas
    // sendTestEmail / sendTestTelegram / sendTestSms
    await new Promise(r => setTimeout(r, 800));
    setTestingChannel(null);
    toast.info(
      `Test de ${channel}: aún no implementado. Los valores se guardaron pero el envío de prueba se agregará en una fase futura.`
    );
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <Plug className="h-4 w-4" />
            Integraciones de la organización
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Conecta canales externos
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configura Google Calendar, Email, Telegram y SMS para {brand.displayName || brand.organizationName}.
            Cada canal puede activarse/desactivarse independientemente. Si
            dejas un canal vacío, el sistema cae a las variables de entorno
            del servidor.
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-2 h-3.5 w-3.5" />
          )}
          Guardar integraciones
        </Button>
      </div>

      <Tabs defaultValue="calendar" className="mt-6">
        <TabsList>
          <TabsTrigger value="calendar">
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="telegram">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="sms">
            <Smartphone className="mr-1.5 h-3.5 w-3.5" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* CALENDAR */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">
                Sincronizar leads con Google Calendar
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Crea eventos automáticamente cuando llega un lead. La cuenta
                de servicio es global; solo el calendarId es por organización.
              </p>
            </div>
            <Switch
              checked={form.googleCalendar.enabled}
              onCheckedChange={v =>
                setForm(s => ({
                  ...s,
                  googleCalendar: { ...s.googleCalendar, enabled: v },
                }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="calendar-id">Google Calendar ID</Label>
            <Input
              id="calendar-id"
              placeholder="abc123@group.calendar.google.com"
              value={form.googleCalendar.calendarId}
              onChange={e =>
                setForm(s => ({
                  ...s,
                  googleCalendar: {
                    ...s.googleCalendar,
                    calendarId: e.target.value,
                  },
                }))
              }
              disabled={!form.googleCalendar.enabled}
            />
            <p className="text-[10px] text-muted-foreground">
              Se encuentra en Google Calendar → Configuración → Integrar
              calendario → ID.
            </p>
          </div>
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="email" className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">Enviar emails transaccionales</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Usado por alertas operativas, campañas y notificaciones de
                cambio de estado.
              </p>
            </div>
            <Switch
              checked={form.email.enabled}
              onCheckedChange={v =>
                setForm(s => ({
                  ...s,
                  email: { ...s.email, enabled: v },
                }))
              }
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email-provider">Proveedor</Label>
            <Select
              value={form.email.provider}
              onValueChange={v =>
                setForm(s => ({
                  ...s,
                  email: { ...s.email, provider: v as EmailProvider },
                }))
              }
              disabled={!form.email.enabled}
            >
              <SelectTrigger id="email-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend (recomendado)</SelectItem>
                <SelectItem value="smtp">SMTP genérico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.email.provider === "resend" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="resend-key">Resend API Key</Label>
              <Input
                id="resend-key"
                type={showSecrets.email ? "text" : "password"}
                placeholder="re_xxxxxxxx"
                value={form.email.resendApiKey}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    email: { ...s.email, resendApiKey: e.target.value },
                  }))
                }
                disabled={!form.email.enabled}
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="smtp-host">Host</Label>
                <Input
                  id="smtp-host"
                  placeholder="smtp.gmail.com"
                  value={form.email.smtp.host}
                  onChange={e =>
                    setForm(s => ({
                      ...s,
                      email: {
                        ...s.email,
                        smtp: { ...s.email.smtp, host: e.target.value },
                      },
                    }))
                  }
                  disabled={!form.email.enabled}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="smtp-port">Puerto</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  placeholder="465"
                  value={form.email.smtp.port}
                  onChange={e =>
                    setForm(s => ({
                      ...s,
                      email: {
                        ...s.email,
                        smtp: {
                          ...s.email.smtp,
                          port: parseInt(e.target.value, 10) || 465,
                        },
                      },
                    }))
                  }
                  disabled={!form.email.enabled}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="smtp-user">Usuario</Label>
                <Input
                  id="smtp-user"
                  placeholder="user@gmail.com"
                  value={form.email.smtp.user}
                  onChange={e =>
                    setForm(s => ({
                      ...s,
                      email: {
                        ...s.email,
                        smtp: { ...s.email.smtp, user: e.target.value },
                      },
                    }))
                  }
                  disabled={!form.email.enabled}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="smtp-pass">Contraseña</Label>
                <Input
                  id="smtp-pass"
                  type={showSecrets.email ? "text" : "password"}
                  placeholder="App password"
                  value={form.email.smtp.pass}
                  onChange={e =>
                    setForm(s => ({
                      ...s,
                      email: {
                        ...s.email,
                        smtp: { ...s.email.smtp, pass: e.target.value },
                      },
                    }))
                  }
                  disabled={!form.email.enabled}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="email-from">From (dirección)</Label>
              <Input
                id="email-from"
                placeholder="ventas@tuempresa.com"
                value={form.email.from}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    email: { ...s.email, from: e.target.value },
                  }))
                }
                disabled={!form.email.enabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email-from-name">From name (opcional)</Label>
              <Input
                id="email-from-name"
                placeholder="Tienda de Ropa"
                value={form.email.fromName}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    email: { ...s.email, fromName: e.target.value },
                  }))
                }
                disabled={!form.email.enabled}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email-alert-to">Email para alertas operativas</Label>
            <Input
              id="email-alert-to"
              type="email"
              placeholder="alertas@tuempresa.com"
              value={form.email.alertTo}
              onChange={e =>
                setForm(s => ({
                  ...s,
                  email: { ...s.email, alertTo: e.target.value },
                }))
              }
              disabled={!form.email.enabled}
            />
            <p className="text-[10px] text-muted-foreground">
              Si vacío, las alertas no se envían por email (caen a
              notificación interna).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTestChannel("email")}
              disabled={!form.email.enabled || testingChannel === "email"}
            >
              {testingChannel === "email" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Enviar email de prueba
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setShowSecrets(s => ({ ...s, email: !s.email }))
              }
            >
              {showSecrets.email ? (
                <EyeOff className="mr-2 h-3.5 w-3.5" />
              ) : (
                <Eye className="mr-2 h-3.5 w-3.5" />
              )}
              {showSecrets.email ? "Ocultar secretos" : "Mostrar secretos"}
            </Button>
          </div>
        </TabsContent>

        {/* TELEGRAM */}
        <TabsContent value="telegram" className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">Enviar alertas a Telegram</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Notificaciones de leads nuevos, urgentes, cerrados o
                perdidos a un canal o chat específico.
              </p>
            </div>
            <Switch
              checked={form.telegram.enabled}
              onCheckedChange={v =>
                setForm(s => ({
                  ...s,
                  telegram: { ...s.telegram, enabled: v },
                }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="telegram-token">Bot Token</Label>
              <Input
                id="telegram-token"
                type={showSecrets.telegram ? "text" : "password"}
                placeholder="123456:ABC-DEF..."
                value={form.telegram.botToken}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    telegram: { ...s.telegram, botToken: e.target.value },
                  }))
                }
                disabled={!form.telegram.enabled}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="telegram-chat">Chat ID</Label>
              <Input
                id="telegram-chat"
                placeholder="-1001234567890"
                value={form.telegram.chatId}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    telegram: { ...s.telegram, chatId: e.target.value },
                  }))
                }
                disabled={!form.telegram.enabled}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Crea el bot con @BotFather en Telegram y obtén el chat ID con
            @userinfobot o @RawDataBot.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTestChannel("telegram")}
              disabled={!form.telegram.enabled || testingChannel === "telegram"}
            >
              {testingChannel === "telegram" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Enviar mensaje de prueba
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setShowSecrets(s => ({ ...s, telegram: !s.telegram }))
              }
            >
              {showSecrets.telegram ? (
                <EyeOff className="mr-2 h-3.5 w-3.5" />
              ) : (
                <Eye className="mr-2 h-3.5 w-3.5" />
              )}
              {showSecrets.telegram ? "Ocultar secretos" : "Mostrar secretos"}
            </Button>
          </div>
        </TabsContent>

        {/* SMS (placeholder, no implementado) */}
        <TabsContent value="sms" className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  SMS via Twilio: en preparación
                </p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  El almacenamiento de credenciales Twilio por organización ya
                  está disponible, pero el envío de SMS aún no está
                  implementado en el motor de automatizaciones. Se
                  agregará en una fase futura.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">Activar SMS (Twilio)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Guarda credenciales; el envío real se habilita cuando se
                implemente el provider.
              </p>
            </div>
            <Switch
              checked={form.sms.enabled}
              onCheckedChange={v =>
                setForm(s => ({ ...s, sms: { ...s.sms, enabled: v } }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sms-sid">Twilio Account SID</Label>
              <Input
                id="sms-sid"
                type={showSecrets.sms ? "text" : "password"}
                placeholder="ACxxxxxx"
                value={form.sms.twilioAccountSid}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    sms: { ...s.sms, twilioAccountSid: e.target.value },
                  }))
                }
                disabled={!form.sms.enabled}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sms-token">Twilio Auth Token</Label>
              <Input
                id="sms-token"
                type={showSecrets.sms ? "text" : "password"}
                placeholder="xxxxxxxx"
                value={form.sms.twilioAuthToken}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    sms: { ...s.sms, twilioAuthToken: e.target.value },
                  }))
                }
                disabled={!form.sms.enabled}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sms-from">From number</Label>
              <Input
                id="sms-from"
                placeholder="+573001234567"
                value={form.sms.twilioFromNumber}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    sms: { ...s.sms, twilioFromNumber: e.target.value },
                  }))
                }
                disabled={!form.sms.enabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sms-alert-to">Alert to (número)</Label>
              <Input
                id="sms-alert-to"
                placeholder="+573001234567"
                value={form.sms.alertTo}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    sms: { ...s.sms, alertTo: e.target.value },
                  }))
                }
                disabled={!form.sms.enabled}
              />
            </div>
          </div>
        </TabsContent>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp" className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  WhatsApp via Meta Cloud API: requiere verificación
                </p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  Necesitás una cuenta de Meta Business verificada, un número de
                  WhatsApp Business y templates pre-aprobados para envíos
                  proactivos fuera de la ventana de 24h.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">Activar WhatsApp</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mensajes automáticos desde plantillas pre-aprobadas.
              </p>
            </div>
            <Switch
              checked={form.whatsapp.enabled}
              onCheckedChange={v =>
                setForm(s => ({ ...s, whatsapp: { ...s.whatsapp, enabled: v } }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="wa-phone-id">Phone Number ID</Label>
              <Input
                id="wa-phone-id"
                placeholder="1234567890"
                value={form.whatsapp.phoneNumberId}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    whatsapp: { ...s.whatsapp, phoneNumberId: e.target.value },
                  }))
                }
                disabled={!form.whatsapp.enabled}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wa-waba-id">WABA ID</Label>
              <Input
                id="wa-waba-id"
                placeholder="9876543210"
                value={form.whatsapp.wabaId}
                onChange={e =>
                  setForm(s => ({
                    ...s,
                    whatsapp: { ...s.whatsapp, wabaId: e.target.value },
                  }))
                }
                disabled={!form.whatsapp.enabled}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wa-token">Access Token</Label>
            <Input
              id="wa-token"
              type={showSecrets.sms ? "text" : "password"}
              placeholder="EAA..."
              value={form.whatsapp.accessToken}
              onChange={e =>
                setForm(s => ({
                  ...s,
                  whatsapp: { ...s.whatsapp, accessToken: e.target.value },
                }))
              }
              disabled={!form.whatsapp.enabled}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wa-templates">Templates (nombres, uno por línea)</Label>
            <textarea
              id="wa-templates"
              rows={3}
              placeholder="saludo_inicial&#10;recordatorio_cita&#10;no_contestamos"
              value={form.whatsapp.templates}
              onChange={e =>
                setForm(s => ({
                  ...s,
                  whatsapp: { ...s.whatsapp, templates: e.target.value },
                }))
              }
              disabled={!form.whatsapp.enabled}
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground">
              Estos nombres deben coincidir exactamente con las plantillas
              aprobadas en Meta Business Manager.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>
            Si dejas un canal vacío, el sistema usa las variables de entorno
            del servidor como fallback.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-2 h-3.5 w-3.5" />
          )}
          Guardar todo
        </Button>
      </div>
    </section>
  );
}

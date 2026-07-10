import { useState, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, Music, Contact } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useActiveBrand } from "@/contexts/BrandContext";
import { trpc } from "@/lib/trpc";
import { Softphone } from "@/components/dialer/Softphone";
import { DialerKeypad } from "@/components/dialer/DialerKeypad";
import { ActiveCall } from "@/components/dialer/ActiveCall";
import { CallDashboard } from "@/components/dialer/CallDashboard";
import { SmsInbox } from "@/components/dialer/SmsInbox";
import { SmsQuickSend } from "@/components/dialer/SmsQuickSend";
import { RecordingsList } from "@/components/dialer/RecordingsList";
import PhoneListsPage from "./PhoneListsPage";

type SoftphoneStatus = "offline" | "online" | "connecting";

export default function DialerPage() {
  const { user } = useAuth();
  const brand = useActiveBrand();
  const identity =
    user?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "_") ||
    "asesor_default";
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const [softphoneStatus, setSoftphoneStatus] =
    useState<SoftphoneStatus>("offline");
  const [activeCall, setActiveCall] = useState<{
    number: string;
    name?: string;
  } | null>(null);

  const dialNumberMutation = trpc.dialing.dialNumber.useMutation();

  const handleDial = useCallback(
    async (number: string, mode: "webrtc" | "clicktocall") => {
      if (!number.trim()) return;

      if (mode === "webrtc") {
        const device = deviceRef.current;
        if (!device) {
          toast.error(
            "El softphone no está conectado. Conectá la línea primero."
          );
          return;
        }
        try {
          setActiveCall({ number });
          const call = await device.connect({ params: { To: number } });
          callRef.current = call;
          call.on("accept", () => toast.success("Llamada establecida."));
          call.on("disconnect", () => {
            callRef.current = null;
            setActiveCall(null);
          });
          call.on("cancel", () => {
            callRef.current = null;
            setActiveCall(null);
          });
          call.on("reject", () => {
            callRef.current = null;
            setActiveCall(null);
          });
        } catch (err: any) {
          setActiveCall(null);
          toast.error(err?.message || "Error al iniciar llamada WebRTC.");
        }
      } else {
        toast.info(`Llamando a tu celular para puentear con ${number}...`);
        try {
          const result = await dialNumberMutation.mutateAsync({
            phoneNumber: number,
          });
          toast.success(`Click-to-Call iniciado: ${result.callSid}`);
          setActiveCall({ number });
        } catch (err: any) {
          toast.error(err?.message || "Error al iniciar click-to-call.");
        }
      }
    },
    [dialNumberMutation]
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Marcación {brand.displayName || brand.organizationName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Llamadas VoIP, SMS y grabaciones
        </p>
      </div>

      <Tabs defaultValue="calls" className="flex-1">
        <TabsList>
          <TabsTrigger value="calls">
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            Llamadas
          </TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="recordings">
            <Music className="mr-1.5 h-3.5 w-3.5" />
            Grabaciones
          </TabsTrigger>
          <TabsTrigger value="lists">
            <Contact className="mr-1.5 h-3.5 w-3.5" />
            Listas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="mt-4 h-full">
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Columna izquierda: Softphone + Keypad + Active Call */}
            <div className="flex flex-col gap-4 lg:col-span-5">
              <Softphone
                identity={identity}
                onCallStateChange={state => {
                  if (state === "ended") setActiveCall(null);
                  if (state === "online" || state === "offline")
                    setSoftphoneStatus(state);
                }}
                onDeviceReady={device => {
                  deviceRef.current = device;
                }}
              />

              {activeCall && (
                <ActiveCall
                  phoneNumber={activeCall.number}
                  leadName={activeCall.name}
                  onHangup={() => {
                    callRef.current?.disconnect();
                    callRef.current = null;
                    setActiveCall(null);
                  }}
                  onEnded={() => setActiveCall(null)}
                />
              )}

              <DialerKeypad
                onDial={handleDial}
                disabled={softphoneStatus !== "online"}
              />
            </div>

            {/* Columna derecha: Dashboard */}
            <div className="flex flex-col gap-4 lg:col-span-7">
              <CallDashboard identity={identity} status={softphoneStatus} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <div className="max-w-3xl">
            <Tabs defaultValue="leads" className="w-full">
              <TabsList>
                <TabsTrigger value="leads">Por leads</TabsTrigger>
                <TabsTrigger value="quick">Envío rápido</TabsTrigger>
              </TabsList>
              <TabsContent value="leads" className="mt-4">
                <SmsInbox />
              </TabsContent>
              <TabsContent value="quick" className="mt-4">
                <SmsQuickSend />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="recordings" className="mt-4">
          <div className="max-w-3xl">
            <RecordingsList />
          </div>
        </TabsContent>

        <TabsContent value="lists" className="mt-4">
          <PhoneListsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

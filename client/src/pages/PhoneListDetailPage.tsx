import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  Plus,
  Trash2,
  Save,
  Upload,
  Download,
  Play,
  ArrowLeft,
  Phone,
  Contact as ContactIcon,
  Edit3,
  X,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useActiveBrand } from "@/contexts/BrandContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as XLS from "xlsx";

export default function PhoneListDetailPage() {
  const params = useParams();
  const listId = parseInt(params.id!, 10);
  const brand = useActiveBrand();
  const [_, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = (format: "csv" | "xlsx") => {
    const sampleData = [
      { nombre: "Mateo García", telefono: "573136043363" },
      { nombre: "Juan Pérez", telefono: "3001234567" },
      { nombre: "María López", telefono: "3109876543" },
    ];

    const ws = XLS.utils.json_to_sheet(sampleData, {
      header: ["nombre", "telefono"],
    });
    const wb = XLS.utils.book_new();
    XLS.utils.book_append_sheet(wb, ws, "Contactos");

    const filename = `plantilla-lista-${listId}.${format}`;
    if (format === "csv") {
      XLS.writeFile(wb, filename, { bookType: "csv" });
    } else {
      XLS.writeFile(wb, filename, { bookType: "xlsx" });
    }
    toast.success(`Plantilla ${format.toUpperCase()} descargada.`);
  };

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [entryName, setEntryName] = useState("");
  const [entryPhone, setEntryPhone] = useState("");
  const [waTarget, setWaTarget] = useState<{ phone: string; name: string } | null>(null);
  const [waMessage, setWaMessage] = useState("Hola, te escribimos para contactarnos.");
  const [editingMessage, setEditingMessage] = useState(false);
  const [editMessageValue, setEditMessageValue] = useState("");

  const utils = trpc.useUtils();
  const query = trpc.phoneLists.get.useQuery(
    { id: listId },
    { enabled: !isNaN(listId) }
  );
  const addMutation = trpc.phoneLists.addEntry.useMutation();
  const sendMessageMutation = trpc.phoneLists.sendManualMessage.useMutation();
  const updateMutation = trpc.phoneLists.updateEntry.useMutation();
  const deleteMutation = trpc.phoneLists.deleteEntry.useMutation();
  const updateAutoMessageMutation = trpc.phoneLists.updateAutoMessage.useMutation();
  const importMutation = trpc.phoneLists.importCsv.useMutation();

  if (isNaN(listId)) return <p className="p-4">Lista inválida.</p>;

  const list = query.data?.list;
  const entries = query.data?.entries ?? [];

  const refresh = () => utils.phoneLists.get.invalidate({ id: listId });

  const handleAdd = async () => {
    if (!entryName.trim() || !entryPhone.trim()) return;
    try {
      await addMutation.mutateAsync({
        listId,
        name: entryName.trim(),
        phoneNumber: entryPhone.trim(),
      });
      toast.success("Contacto agregado.");
      setShowAdd(false);
      setEntryName("");
      setEntryPhone("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al agregar.");
    }
  };

  const handleEdit = (entry: (typeof entries)[0]) => {
    setEditId(entry.id);
    setEntryName(entry.name);
    setEntryPhone(entry.phoneNumber);
  };

  const handleSave = async () => {
    if (editId == null) return;
    try {
      await updateMutation.mutateAsync({
        id: editId,
        name: entryName.trim(),
        phoneNumber: entryPhone.trim(),
      });
      toast.success("Actualizado.");
      setEditId(null);
      setEntryName("");
      setEntryPhone("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Eliminado.");
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar.");
    }
  };

  const openSendWhatsApp = (entry: { phoneNumber: string; name: string }) => {
    setWaTarget({ phone: entry.phoneNumber, name: entry.name });
    setWaMessage(`Hola ${entry.name}, te escribimos para contactarnos.`);
  };

  const closeSendWhatsApp = () => {
    setWaTarget(null);
  };

  const startEditMessage = () => {
    if (!list) return;
    setEditMessageValue(list.autoMessage ?? "Te escribimos para contactarnos.");
    setEditingMessage(true);
  };

  const saveMessage = async () => {
    if (!list) return;
    try {
      await updateAutoMessageMutation.mutateAsync({
        id: list.id,
        autoMessage: editMessageValue,
      });
      toast.success("Mensaje actualizado.");
      setEditingMessage(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar el mensaje.");
    }
  };

  const handleSendWhatsApp = async () => {
    if (!waTarget || !waMessage.trim()) return;
    try {
      const result = await sendMessageMutation.mutateAsync({
        to: waTarget.phone,
        body: waMessage.trim(),
      });
      toast.success(`WhatsApp enviado a ${waTarget.phone}. ID: ${result.messageId.substring(0, 20)}...`);
      closeSendWhatsApp();
    } catch (err: any) {
      toast.error(err?.message || "Error al enviar WhatsApp.");
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await importMutation.mutateAsync({
          listId,
          csvBase64: base64,
        });
        const dupes = result.skippedDuplicates ?? 0;
        const msg =
          dupes > 0
            ? `${result.imported} importados, ${dupes} duplicado(s) omitido(s).`
            : `${result.imported} contactos importados.`;
        toast.success(msg);
        if (dupes > 0 && result.duplicateExamples?.length > 0) {
          toast.info(`Ejemplos: ${result.duplicateExamples.join(", ")}`, {
            duration: 6000,
          });
        }
        refresh();
      } catch (err: any) {
        toast.error(err?.message || "Error al importar.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/phone-lists")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            {list?.name ?? "Cargando..."}
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} contactos
            {brand.displayName && ` · ${brand.displayName}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openSendWhatsApp({ phoneNumber: "", name: "Número personalizado" })}
            className="border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700"
            title="Enviar WhatsApp a un número"
          >
            <MessageCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
            Enviar WA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate("xlsx")}
            title="Descargar plantilla XLSX con el formato esperado"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Plantilla
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate("csv")}
            title="Descargar plantilla CSV con el formato esperado"
          >
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Importar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleCsvUpload}
          />
          <Button
            size="sm"
            onClick={() => {
              setShowAdd(true);
              setEditId(null);
              setEntryName("");
              setEntryPhone("");
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setLocation(`/phone-lists/${listId}/dial`)}
            disabled={entries.length === 0}
          >
            <Play className="mr-1.5 h-4 w-4" />
            Iniciar marcación
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold">
                Mensaje automático al no contestar
              </p>
              {editingMessage ? (
                <div className="mt-2 grid gap-2">
                  <textarea
                    rows={3}
                    value={editMessageValue}
                    onChange={e => setEditMessageValue(e.target.value)}
                    placeholder="Te escribimos para contactarnos."
                    className="flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={saveMessage}
                      disabled={updateAutoMessageMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {updateAutoMessageMutation.isPending ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingMessage(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 rounded border bg-muted/30 px-3 py-2 text-sm">
                    {list?.autoMessage || "Te escribimos para contactarnos."}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Predeterminado: "Te escribimos para contactarnos."
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={startEditMessage}
                  >
                    Editar mensaje
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <ContactIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay contactos en esta lista. Agregá o importá desde CSV.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Lead CRM</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className="border-b transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {entry.position}
                      </td>
                      <td className="px-4 py-2.5">
                        {editId === entry.id ? (
                          <Input
                            value={entryName}
                            onChange={e => setEntryName(e.target.value)}
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span className="font-medium">{entry.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono tracking-wide">
                        {editId === entry.id ? (
                          <Input
                            value={entryPhone}
                            onChange={e => setEntryPhone(e.target.value)}
                            className="h-8 text-sm font-mono"
                          />
                        ) : (
                          entry.phoneNumber
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {entry.leadId ? `Lead #${entry.leadId}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            entry.status === "answered"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                              : entry.status === "no_answer"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                : entry.status === "skipped"
                                  ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {entry.status === "answered"
                            ? "✓ Contestó"
                            : entry.status === "no_answer"
                              ? "✗ No contestó"
                              : entry.status === "skipped"
                                ? "Saltado"
                                : "Pendiente"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {editId === entry.id ? (
                            <>
                              <button
                                onClick={handleSave}
                                className="rounded p-1 hover:text-emerald-600"
                                title="Guardar"
                              >
                                <Save className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="rounded p-1 hover:text-muted-foreground"
                                title="Cancelar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(entry)}
                                className="rounded p-1 text-muted-foreground hover:text-primary"
                                title="Editar"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => openSendWhatsApp(entry)}
                                className="rounded p-1 text-muted-foreground hover:text-emerald-600"
                                title="Enviar WhatsApp"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="rounded p-1 text-muted-foreground hover:text-destructive"
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar contacto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={entryName}
                onChange={e => setEntryName(e.target.value)}
                placeholder="Mateo García"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Teléfono</label>
              <Input
                value={entryPhone}
                onChange={e => setEntryPhone(e.target.value)}
                placeholder="573136043363"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!entryName.trim() || !entryPhone.trim()}
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={waTarget !== null} onOpenChange={(open) => { if (!open) closeSendWhatsApp(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              Enviar WhatsApp
            </DialogTitle>
          </DialogHeader>
          {waTarget && (
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Destinatario</label>
                {waTarget.name !== "Número personalizado" && (
                  <div className="rounded-lg border bg-muted/40 px-3 py-2">
                    <p className="text-sm font-semibold">{waTarget.name}</p>
                    <p className="font-mono text-xs">{waTarget.phone}</p>
                  </div>
                )}
                {waTarget.name === "Número personalizado" && (
                  <Input
                    value={waTarget.phone}
                    onChange={e => setWaTarget({ ...waTarget, phone: e.target.value })}
                    placeholder="+573131234567"
                  />
                )}
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Mensaje</label>
                <textarea
                  rows={5}
                  value={waMessage}
                  onChange={e => setWaMessage(e.target.value)}
                  placeholder="Escribí el mensaje a enviar..."
                  className="flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground">
                  {waMessage.length} / 4096 caracteres
                </p>
              </div>
              {sendMessageMutation.error && (
                <p className="text-xs text-red-600">
                  {sendMessageMutation.error.message}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeSendWhatsApp}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={!waMessage.trim() || sendMessageMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {sendMessageMutation.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { Plus, Trash2, Phone, Contact, Play } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useActiveBrand } from "@/contexts/BrandContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PhoneListsPage() {
  const brand = useActiveBrand();
  const [_, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDelay, setNewDelay] = useState("3000");
  const [newMessage, setNewMessage] = useState("Te escribimos para contactarnos.");

  const utils = trpc.useUtils();
  const query = trpc.phoneLists.list.useQuery();
  const createMutation = trpc.phoneLists.create.useMutation();
  const deleteMutation = trpc.phoneLists.delete.useMutation();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: newName.trim(),
        callDelayMs: parseInt(newDelay, 10) || 3000,
        autoMessage: newMessage,
      });
      toast.success("Lista creada.");
      setShowCreate(false);
      setNewName("");
      setNewDelay("3000");
      setNewMessage("Te escribimos para contactarnos.");
      utils.phoneLists.list.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "Error al crear la lista.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta lista y todos sus contactos?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Lista eliminada.");
      utils.phoneLists.list.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar.");
    }
  };

  const lists = query.data ?? [];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Listas Telefónicas {brand.displayName || brand.organizationName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestioná listas de contactos para marcación automática.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva lista
        </Button>
      </div>

      {lists.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Contact className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tenés listas telefónicas todavía.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowCreate(true)}
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Crear primera lista
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map(list => (
            <Card
              key={list.id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => setLocation(`/phone-lists/${list.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-base">{list.name}</CardTitle>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(list.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Contact className="h-3 w-3" />
                    {list.totalEntries} contactos
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {list.completedEntries} realizados
                  </span>
                  {list.status !== "idle" && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {list.status === "active"
                        ? "En marcación"
                        : list.status === "paused"
                          ? "Pausada"
                          : list.status === "completed"
                            ? "Completada"
                            : list.status}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva lista telefónica</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Prospección Junio"
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Delay entre llamadas (ms)
              </label>
              <Input
                type="number"
                value={newDelay}
                onChange={e => setNewDelay(e.target.value)}
                placeholder="3000"
              />
              <p className="text-xs text-muted-foreground">
                Milisegundos entre una llamada y la siguiente (3000 = 3s).
              </p>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Mensaje automático al no contestar
              </label>
              <textarea
                rows={3}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Te escribimos para contactarnos."
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Se envía automáticamente cuando el contacto no contesta.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

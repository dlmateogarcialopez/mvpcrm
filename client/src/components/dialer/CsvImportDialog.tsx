import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (base64: string) => void;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onImport,
}: CsvImportDialogProps) {
  const [drag, setDrag] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      onImport(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar contactos desde archivo</DialogTitle>
        </DialogHeader>
        <div
          onDragOver={e => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            drag ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
        >
          <p className="text-sm text-muted-foreground">
            Arrastrá un archivo CSV o XLSX con columnas: <strong>nombre</strong>
            , <strong>telefono</strong>
          </p>
          <p className="text-xs text-muted-foreground">o</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,.xlsx,.xls";
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            Seleccionar archivo
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // En Docker, process.cwd() es /app. Los archivos están en /app/dist/public
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `[Error] No se encontró el directorio de build: ${distPath}. Asegúrate de ejecutar el build del cliente primero.`
    );
  }

  app.use(express.static(distPath));

  // Redirigir cualquier otra ruta al index.html (para que el router de React funcione)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

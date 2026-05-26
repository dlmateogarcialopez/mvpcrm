import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno del archivo .env del proyecto ANTES de importar el servicio
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Usar importación dinámica para evitar que hoisting ejecute la importación antes que dotenv
const { sendTelegramAlert } = await import("../server/services/telegram.service.js");

async function runTest() {
  console.log("Iniciando prueba de alerta de Telegram...");
  console.log("Token:", process.env.TELEGRAM_BOT_TOKEN ? "Configurado (comienza con " + process.env.TELEGRAM_BOT_TOKEN.slice(0, 5) + "...)" : "No configurado");
  console.log("Chat ID:", process.env.TELEGRAM_CHAT_ID ? "Configurado (" + process.env.TELEGRAM_CHAT_ID + ")" : "No configurado");

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.error("Error: Faltan credenciales en el archivo .env. Por favor, revísalo.");
    process.exit(1);
  }

  try {
    await sendTelegramAlert({
      type: "new_lead",
      leadName: "Juan Pérez (Test BI Marketing)",
      leadValue: 1500000,
      city: "Bogotá",
      agentName: "Asistente AI",
    });
    console.log("¡Llamada finalizada! Revisa tu chat/grupo en Telegram para ver si llegó el mensaje.");
  } catch (error) {
    console.error("Error al ejecutar la prueba:", error);
  }
}

runTest();

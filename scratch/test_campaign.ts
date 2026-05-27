import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { getCommercialTeam, createEmailCampaign, getEmailCampaign, deleteEmailCampaign } from "../server/db";
import { executeEmailCampaign } from "../server/services/emailCampaign";

async function run() {
  console.log("🚀 Iniciando prueba del módulo de Email Marketing (TSX)...");
  
  try {
    // 1. Obtener un usuario para simular el contexto
    const users = await getCommercialTeam({ id: 1, role: "superadmin" });
    if (users.length === 0) {
      console.log("❌ No se encontraron usuarios en el equipo comercial.");
      return;
    }
    const adminUser = users[0];
    console.log(`👤 Usando usuario de prueba: ${adminUser.name} (${adminUser.role})`);

    // 2. Crear una campaña de prueba
    console.log("📝 Creando campaña de email de prueba en la BD...");
    const [result] = await createEmailCampaign({
      name: "Campaña de Prueba Antigravity",
      subject: "Hola {{nombre}}, bienvenido a {{empresa}}",
      content: "Este es un correo de prueba.\nTu valor estimado de evento es: {{valor}}.",
      targetSegment: "all",
      targetSegmentData: null,
      status: "draft",
    });
    
    // Obtener el ID insertado
    const insertId = result.insertId;
    console.log(`✅ Campaña de prueba creada con ID: ${insertId}`);

    // 3. Ejecutar el envío de la campaña (simulado si no hay API key real)
    console.log("📧 Ejecutando envío de campaña...");
    const sendResult = await executeEmailCampaign(insertId, adminUser.id);
    console.log("🎉 Campaña enviada con éxito!", sendResult);

    // 4. Consultar la campaña en la BD para verificar cambios de estado y conteo
    const campaign = await getEmailCampaign(insertId);
    console.log("📊 Estado de la campaña tras el envío:");
    console.log(`- Nombre: ${campaign?.name}`);
    console.log(`- Estado: ${campaign?.status}`);
    console.log(`- Total Enviados: ${campaign?.totalSent}`);
    console.log(`- Total Abiertos (simulado): ${campaign?.totalOpened}`);
    console.log(`- Total Clics (simulado): ${campaign?.totalClicked}`);
    console.log(`- Fecha de Envío: ${campaign?.sentAt}`);

    // 5. Limpiar (opcional, pero eliminamos para no ensuciar la base de datos de desarrollo)
    await deleteEmailCampaign(insertId);
    console.log("🧹 Campaña de prueba eliminada para limpiar la BD.");

  } catch (error) {
    console.error("❌ Ocurrió un error durante la prueba:", error);
  }
}

run().then(() => process.exit(0));

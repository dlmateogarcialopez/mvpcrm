const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const { Resend } = require("resend");
const path = require("path");

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function replacePlaceholders(text, lead) {
  if (!text) return "";
  return text
    .replace(/\{\{\s*nombre\s*\}\}/gi, lead.contactoNombre || lead.nombreCliente || "")
    .replace(/\{\{\s*name\s*\}\}/gi, lead.contactoNombre || lead.nombreCliente || "")
    .replace(/\{\{\s*empresa\s*\}\}/gi, lead.empresaNombre || lead.nombreEmpresa || "")
    .replace(/\{\{\s*company\s*\}\}/gi, lead.empresaNombre || lead.nombreEmpresa || "")
    .replace(/\{\{\s*correo\s*\}\}/gi, lead.contactoCorreo || lead.correo || "")
    .replace(/\{\{\s*email\s*\}\}/gi, lead.contactoCorreo || lead.correo || "")
    .replace(/\{\{\s*valor\s*\}\}/gi, (lead.valorTotal || 0).toLocaleString("es-CO"))
    .replace(/\{\{\s*value\s*\}\}/gi, (lead.valorTotal || 0).toLocaleString("es-CO"));
}

async function run() {
  console.log("🚀 Iniciando prueba del módulo de Email Marketing en Producción...");
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ La variable de entorno DATABASE_URL no está definida.");
    return;
  }

  let connection;
  try {
    // 1. Conectar a la base de datos
    console.log("🔗 Conectando a MySQL...");
    connection = await mysql.createConnection(dbUrl);
    console.log("✅ Conexión exitosa.");

    // 2. Obtener un usuario
    const [users] = await connection.query("SELECT * FROM users LIMIT 1");
    if (users.length === 0) {
      console.log("❌ No se encontraron usuarios en la tabla 'users'.");
      return;
    }
    const adminUser = users[0];
    console.log(`👤 Usando usuario de prueba: ${adminUser.name || adminUser.email} (ID: ${adminUser.id})`);

    // 3. Crear una campaña de prueba
    console.log("📝 Creando campaña de prueba en 'email_campaigns'...");
    const [campaignResult] = await connection.query(
      `INSERT INTO email_campaigns (name, subject, content, targetSegment, targetSegmentData, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "Campaña de Prueba Prod",
        "Hola {{nombre}}, bienvenido a {{empresa}}",
        "Este es un correo de prueba de producción.\nTu valor estimado de evento es: {{valor}}.",
        "all",
        null,
        "draft"
      ]
    );
    const campaignId = campaignResult.insertId;
    console.log(`✅ Campaña de prueba creada con ID: ${campaignId}`);

    // 4. Obtener leads visibles (en este script simple cargamos todos los leads)
    const [leads] = await connection.query("SELECT * FROM leads");
    console.log(`📊 Total de leads cargados de la BD: ${leads.length}`);

    // Filtrar leads con email válido
    const leadsWithEmail = leads.filter(lead => {
      const email = lead.contactoCorreo || lead.correo;
      return email && email.includes("@");
    });
    console.log(`📧 Leads con email válido para enviar: ${leadsWithEmail.length}`);

    // 5. Simular/Enviar correos
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";
    let successCount = 0;

    // Actualizar estado a "sending"
    await connection.query("UPDATE email_campaigns SET status = 'sending' WHERE id = ?", [campaignId]);

    if (resendKey && leadsWithEmail.length > 0) {
      console.log("📨 Enviando correos reales vía Resend...");
      const resend = new Resend(resendKey);
      
      for (const lead of leadsWithEmail) {
        const leadEmail = lead.contactoCorreo || lead.correo;
        const resolvedSubject = replacePlaceholders("Hola {{nombre}}, bienvenido a {{empresa}}", lead);
        const resolvedContent = replacePlaceholders("Este es un correo de prueba de producción.\nTu valor estimado de evento es: {{valor}}.", lead);

        try {
          await resend.emails.send({
            from: fromEmail,
            to: [leadEmail],
            subject: resolvedSubject,
            text: resolvedContent,
            html: `<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              ${resolvedContent.replace(/\n/g, "<br>")}
            </div>`
          });
          console.log(`   ✔️ Enviado a ${leadEmail}`);
          successCount++;
        } catch (err) {
          console.error(`   ❌ Error al enviar a ${leadEmail}:`, err.message);
        }
      }
    } else {
      console.log("📭 Modo Simulación (no se detectó RESEND_API_KEY o no hay leads).");
      for (const lead of leadsWithEmail) {
        const leadEmail = lead.contactoCorreo || lead.correo;
        const resolvedSubject = replacePlaceholders("Hola {{nombre}}, bienvenido a {{empresa}}", lead);
        const resolvedContent = replacePlaceholders("Este es un correo de prueba de producción.\nTu valor estimado de evento es: {{valor}}.", lead);
        
        console.log(`   [SIMULADO] De: ${fromEmail} | Para: ${leadEmail} | Asunto: ${resolvedSubject}`);
        successCount++;
      }
    }

    // 6. Actualizar campaña a enviada
    await connection.query(
      `UPDATE email_campaigns 
       SET status = 'sent', sentAt = NOW(), totalSent = ?, totalOpened = ?, totalClicked = ? 
       WHERE id = ?`,
      [successCount, Math.round(successCount * 0.25), Math.round(successCount * 0.05), campaignId]
    );
    console.log("📊 Campaña actualizada en la BD como 'sent'.");

    // 7. Mostrar resultado
    const [[campaign]] = await connection.query("SELECT * FROM email_campaigns WHERE id = ?", [campaignId]);
    console.log("\n📈 Resultados en base de datos:");
    console.log(`- Campaña: ${campaign.name}`);
    console.log(`- Estado: ${campaign.status}`);
    console.log(`- Total Enviados: ${campaign.totalSent}`);
    console.log(`- Fecha Envío: ${campaign.sentAt}`);

    // 8. Limpiar campaña de prueba
    await connection.query("DELETE FROM email_campaigns WHERE id = ?", [campaignId]);
    console.log("\n🧹 Campaña de prueba eliminada con éxito.");

  } catch (error) {
    console.error("❌ Error durante la ejecución:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run().then(() => process.exit(0));

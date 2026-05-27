const dotenv = require("dotenv");
const { Resend } = require("resend");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const testRecipient = process.argv[2];

  console.log("🔑 RESEND_API_KEY:", resendKey ? "Configurada (comienza con " + resendKey.slice(0, 5) + ")" : "NO CONFIGURADA");
  console.log("📧 De:", fromEmail);
  console.log("📬 Para:", testRecipient);

  if (!resendKey) {
    console.error("❌ Falta la variable de entorno RESEND_API_KEY.");
    return;
  }

  if (!testRecipient) {
    console.error("❌ Especifica un correo destinatario. Ejemplo: node test_resend_direct.cjs tu-correo@gmail.com");
    return;
  }

  try {
    const resend = new Resend(resendKey);
    console.log("⏳ Enviando correo de prueba...");
    const response = await resend.emails.send({
      from: fromEmail,
      to: [testRecipient],
      subject: "Prueba Directa de Resend - CRM",
      html: "<p>Si estás leyendo esto, la API Key de Resend está funcionando correctamente.</p>"
    });
    console.log("✅ Respuesta de Resend exitosa:", response);
  } catch (error) {
    console.error("❌ Error de Resend:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

run();

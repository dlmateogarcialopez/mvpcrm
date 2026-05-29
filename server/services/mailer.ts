import { Resend } from "resend";
import nodemailer from "nodemailer";

export type MailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
};

export async function sendMail(options: MailOptions): Promise<boolean> {
  const provider = (process.env.EMAIL_PROVIDER || "resend").toLowerCase().trim();
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  if (provider.startsWith("smt")) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "465");
    const user = process.env.SMTP_USER || "sportsinsights92@gmail.com";
    const pass = process.env.SMTP_PASS || "ubyn kcbk mqnv hxti";
    const from = options.from || process.env.EMAIL_FROM || user;

    console.log(`[Mailer] Enviando correo vía SMTP (${host}:${port}) a: ${recipients.join(", ")}`);

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true para puerto 465 (SSL), false para otros (STARTTLS)
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false, // Permite certificados auto-firmados o sin validación de hostname
        },
      });

      await transporter.sendMail({
        from,
        to: recipients.join(", "),
        subject: options.subject,
        text: options.text,
        html: options.html || options.text.replace(/\n/g, "<br>"),
      });

      console.log("[Mailer] Correo enviado exitosamente vía SMTP.");
      return true;
    } catch (error) {
      console.error("[Mailer] Error al enviar correo vía SMTP:", error);
      return false;
    }
  } else {
    const resendKey = process.env.RESEND_API_KEY;
    const from = options.from || process.env.EMAIL_FROM || "onboarding@resend.dev";

    if (!resendKey) {
      // Modo simulación si no hay API key
      console.log(`[SIMULACIÓN ENVIADA - Mailer] De: ${from} | Para: ${recipients.join(", ")} | Asunto: ${options.subject}`);
      return true;
    }

    console.log(`[Mailer] Enviando correo vía Resend a: ${recipients.join(", ")}`);

    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from,
        to: recipients,
        subject: options.subject,
        text: options.text,
        html: options.html || `<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; font-size: 15px;">${options.text.replace(/\n/g, "<br>")}</div>`,
      });

      if (error) {
        console.error("[Mailer] Error de Resend al enviar correo:", error);
        return false;
      }

      console.log("[Mailer] Correo enviado exitosamente vía Resend.");
      return true;
    } catch (error) {
      console.error("[Mailer] Error al enviar correo vía Resend:", error);
      return false;
    }
  }
}

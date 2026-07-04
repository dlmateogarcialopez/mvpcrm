import { Resend } from "resend";
import nodemailer from "nodemailer";
import {
  resolveEmailConfig,
  type OrgIntegrations,
} from "../_core/orgIntegrations";

export type MailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
};

/**
 * Envía un email.
 *
 * Si se pasa `orgIntegrations`, usa la config de email de
 * la org (provider, api key, from, smtp). Si no, cae al
 * env var (backward compatible).
 *
 * El caller puede override el `from` pasando `options.from`
 * explícitamente.
 */
export async function sendMail(
  options: MailOptions,
  orgIntegrations?: OrgIntegrations | null
): Promise<boolean> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const emailConfig = orgIntegrations
    ? resolveEmailConfig(orgIntegrations)
    : null;
  const provider = emailConfig?.provider ??
    ((process.env.EMAIL_PROVIDER || "resend").toLowerCase().trim() as
      | "smtp"
      | "resend");
  const from = options.from ?? emailConfig?.from ?? null;

  if (provider.startsWith("smt")) {
    const smtp = emailConfig?.smtp ?? null;
    const host = smtp?.host ?? process.env.SMTP_HOST ?? "smtp.gmail.com";
    const port =
      smtp?.port ?? parseInt(process.env.SMTP_PORT ?? "465", 10);
    const user = smtp?.user ?? process.env.SMTP_USER ?? "";
    const pass = smtp?.pass ?? process.env.SMTP_PASS ?? "";
    const finalFrom = from ?? user;
    if (!user || !pass) {
      console.warn(
        "[Mailer] SMTP credentials no configuradas. Email no enviado."
      );
      return false;
    }

    console.log(
      `[Mailer] Enviando correo vía SMTP (${host}:${port}) a: ${recipients.join(", ")}`
    );

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from: finalFrom,
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
    const resendKey =
      emailConfig?.resendApiKey ?? process.env.RESEND_API_KEY ?? "";
    const finalFrom =
      from ?? process.env.EMAIL_FROM ?? "onboarding@resend.dev";

    if (!resendKey) {
      // Modo simulación si no hay API key
      console.log(
        `[SIMULACIÓN ENVIADA - Mailer] De: ${finalFrom} | Para: ${recipients.join(", ")} | Asunto: ${options.subject}`
      );
      return true;
    }

    console.log(
      `[Mailer] Enviando correo vía Resend a: ${recipients.join(", ")}`
    );

    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from: finalFrom,
        to: recipients,
        subject: options.subject,
        text: options.text,
        html:
          options.html ||
          `<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; font-size: 15px;">${options.text.replace(/\n/g, "<br>")}</div>`,
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

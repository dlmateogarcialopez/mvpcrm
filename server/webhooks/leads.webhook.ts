import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import * as db from "../db";
import { sendTelegramAlert } from "../services/telegram.service";

/**
 * Webhook para recibir leads desde Facebook, Instagram, ManyChat o cualquier fuente externa.
 * 
 * Ejemplo de payload esperado:
 * {
 *   "source": "facebook" | "instagram" | "manychat" | "zapier",
 *   "customerName": "Juan García",
 *   "customerEmail": "juan@example.com",
 *   "customerPhone": "3001234567",
 *   "companyName": "Empresa XYZ",
 *   "city": "Bogotá",
 *   "message": "Estoy interesado en tus servicios",
 *   "estimatedValue": 2500000,
 *   "customFields": { ... }
 * }
 */

export async function handleLeadWebhook(req: Request, res: Response) {
  try {
    const payload = req.body;

    // Validación básica
    if (!payload.customerName || !payload.customerEmail) {
      return res.status(400).json({
        error: "Missing required fields: customerName, customerEmail",
      });
    }

    // Crear el lead en la base de datos
    const leadData = {
      publicId: `LEAD-${nanoid(8).toUpperCase()}`,
      nombreCliente: payload.customerName,
      correo: payload.customerEmail,
      telefono: payload.customerPhone || "",
      nombreEmpresa: payload.companyName || "Lead desde " + (payload.source || "Externa"),
      ciudad: payload.city || "Sin especificar",
      canalOrigen: payload.source || "externa",
      tipoEvento: "consulta_general",
      estadoLead: "nuevo",
      proximaAccion: "Contactar",
      valorTotal: payload.estimatedValue || 0,
      cantidadMultiple: 0,
      cantidadJunior: 0,
      cantidadSenior: 0,
      cantidadParqueadero: 0,
      prioridad: "amarillo",
      prioridadBase: "amarillo",
      notasInternas: `Lead ingresado desde ${payload.source || "fuente externa"}. Mensaje: ${payload.message || "Sin mensaje"}`,
      agenteResponsable: payload.assignedAgent || null,
      agenteUserId: payload.assignedAgentId || null,
    };

    // Guardar en BD (si tienes la función en db.ts)
    // await db.createLead(leadData);

    // Enviar alerta por Telegram
    await sendTelegramAlert({
      type: "new_lead",
      leadName: payload.customerName,
      leadValue: payload.estimatedValue,
      city: payload.city,
      agentName: payload.assignedAgent,
      details: payload.message,
    });

    // Responder al webhook con éxito
    res.status(201).json({
      success: true,
      message: "Lead recibido y procesado correctamente",
      leadId: leadData.publicId,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Webhook] Lead ingresado desde ${payload.source}:`, leadData.publicId);
  } catch (error) {
    console.error("[Webhook] Error procesando lead:", error);
    res.status(500).json({
      error: "Error procesando el lead",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Webhook para recibir eventos de cambio de estado desde ManyChat o herramientas de automatización.
 */
export async function handleLeadStatusWebhook(req: Request, res: Response) {
  try {
    const { leadId, newStatus, agentName } = req.body;

    if (!leadId || !newStatus) {
      return res.status(400).json({
        error: "Missing required fields: leadId, newStatus",
      });
    }

    // Aquí iría la lógica para actualizar el estado del lead
    // await db.updateLeadStatus(leadId, newStatus);

    // Enviar alerta según el nuevo estado
    if (newStatus === "urgente" || newStatus === "rojo") {
      await sendTelegramAlert({
        type: "urgent_lead",
        leadName: leadId,
        agentName: agentName,
      });
    }

    res.status(200).json({
      success: true,
      message: "Estado del lead actualizado",
    });
  } catch (error) {
    console.error("[Webhook] Error actualizando estado:", error);
    res.status(500).json({ error: "Error actualizando el estado del lead" });
  }
}

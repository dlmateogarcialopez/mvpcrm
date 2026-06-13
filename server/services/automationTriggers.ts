import * as db from "../db";

/**
 * Reemplaza un nombre (de fase) en los JSON `triggerCondition` y `actionData`
 * de las reglas de automatización que lo contengan.
 *
 * Esto cubre:
 * - `triggerCondition` (string o JSON con el campo del estado a detectar)
 * - `actionData` (JSON con `{"recipientId":...}`, `{"name":"..."}`, etc.)
 *
 * @returns número de reglas actualizadas.
 */
export async function renameInAutomationRules(
  oldName: string,
  newName: string
): Promise<number> {
  if (!oldName || oldName === newName) return 0;

  const rules = await db.listAutomationRules();
  let updated = 0;

  for (const rule of rules) {
    let changed = false;
    let nextTriggerCondition = rule.triggerCondition ?? null;
    let nextActionData = rule.actionData ?? null;

    // triggerCondition: puede ser string plano o JSON
    if (rule.triggerCondition) {
      const tcUpdated = updateIfContains(
        rule.triggerCondition,
        oldName,
        newName
      );
      if (tcUpdated.changed) {
        nextTriggerCondition = tcUpdated.value;
        changed = true;
      }
    }

    // actionData: típicamente JSON
    if (rule.actionData) {
      const adUpdated = updateIfContains(rule.actionData, oldName, newName);
      if (adUpdated.changed) {
        nextActionData = adUpdated.value;
        changed = true;
      }
    }

    if (changed) {
      await db.updateAutomationRule(rule.id, {
        triggerCondition: nextTriggerCondition,
        actionData: nextActionData,
      });
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(
      `[AutomationTriggers] Renombrado en cascada: "${oldName}" → "${newName}" en ${updated} regla(s).`
    );
  }
  return updated;
}

/**
 * Reemplaza ocurrencias exactas de `oldName` dentro de `raw`.
 * Si el contenido es JSON, lo deserializa, reemplaza, y re-serializa.
 * Si es texto plano, hace replace literal.
 */
function updateIfContains(
  raw: string,
  oldName: string,
  newName: string
): { value: string; changed: boolean } {
  const trimmed = raw.trim();
  if (!trimmed.includes(oldName)) {
    return { value: raw, changed: false };
  }

  // Intento como JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const replaced = deepReplaceString(parsed, oldName, newName);
      const newJson = JSON.stringify(replaced);
      if (newJson !== trimmed) {
        return { value: newJson, changed: true };
      }
    } catch {
      // fallthrough a texto plano
    }
  }

  // Texto plano: replace literal (preservando mayúsculas, sin regex)
  const replaced = raw.split(oldName).join(newName);
  return { value: replaced, changed: replaced !== raw };
}

/**
 * Recorre un objeto/array y reemplaza strings que coincidan exactamente.
 * NO reemplaza substrings dentro de strings más largos (para no romper emails, etc.).
 */
function deepReplaceString(
  value: unknown,
  oldName: string,
  newName: string
): unknown {
  if (typeof value === "string") {
    return value === oldName ? newName : value;
  }
  if (Array.isArray(value)) {
    return value.map(item => deepReplaceString(item, oldName, newName));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepReplaceString(v, oldName, newName);
    }
    return out;
  }
  return value;
}

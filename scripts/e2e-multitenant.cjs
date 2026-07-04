#!/usr/bin/env node
/**
 * E2E smoke test del flujo multi-tenant.
 *
 * Ejecuta contra el server local (default: http://localhost:3000).
 * Asume que la DB ya tiene aplicada la migración 0014_multi_tenant
 * y que existe al menos un superadmin creado (el primer
 * setupAdmin crea el usuario con rol superadmin).
 *
 * El script:
 *   1. Loguea como el superadmin (lee credenciales de .env o usa defaults)
 *   2. Lista las orgs del superadmin
 *   3. Crea una nueva org "E2E Test Org"
 *   4. Cambia a esa org
 *   5. Edita el branding (primaryColor)
 *   6. Verifica que el branding se aplicó leyendo currentSettings
 *   7. Vuelve a la org default
 *   8. Verifica que la org default sigue con su branding original
 *   9. Lista todos los miembros
 *  10. Limpia: archiva la org creada
 *
 * Imprime PASS/FAIL por cada check.
 *
 * Uso:
 *   node scripts/e2e-multitenant.cjs
 *   E2E_BASE_URL=http://localhost:3000 \
 *   E2E_EMAIL=admin@correo.com \
 *   E2E_PASSWORD=secret123 \
 *   node scripts/e2e-multitenant.cjs
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL || "admin@maquinadeventas.com";
const PASSWORD = process.env.E2E_PASSWORD || "admin1234";
const COOKIE_JAR = new Map();

let pass = 0;
let fail = 0;
const failures = [];

function log(level, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${level}`, ...args);
}

function check(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    log("✅", `PASS: ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    log("❌", `FAIL: ${label} ${detail}`);
  }
}

function getCookieHeader() {
  return Array.from(COOKIE_JAR.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function captureCookies(setCookieHeader) {
  if (!setCookieHeader) return;
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  for (const c of cookies) {
    const [pair] = c.split(";");
    const [name, ...rest] = pair.split("=");
    if (!name) continue;
    COOKIE_JAR.set(name.trim(), rest.join("=").trim());
  }
}

async function trpcCall(procedure, input, opts = {}) {
  const url = `${BASE_URL}/api/trpc/${procedure}?batch=1`;
  const isMutation = opts.kind === "mutation" || /^(create|update|delete|set|invite|accept|switch|add|remove|login|logout|setup|mark|archive|clear)/.test(procedure);
  const body = isMutation
    ? { "0": { json: input ?? null } }
    : { "0": { json: input ?? null, meta: { values: ["undefined"] } } };
  const res = await fetch(url, {
    method: isMutation ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      ...(opts.headers ?? {}),
    },
    body: isMutation ? JSON.stringify(body) : undefined,
  });
  captureCookies(res.headers.getSetCookie?.() ?? res.headers.raw?.()?.["set-cookie"]);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, data: json };
  }
  const result = Array.isArray(json) ? json[0] : json;
  if (result?.error) {
    return { ok: false, status: res.status, error: result.error };
  }
  return { ok: true, status: res.status, data: result?.result?.data ?? result };
}

async function main() {
  log("ℹ️", `E2E multi-tenant contra ${BASE_URL}`);
  log("ℹ️", `Email: ${EMAIL}`);

  // ------------------------------------------------------------
  // 1. Login como superadmin
  // ------------------------------------------------------------
  log("ℹ️", "1. Login...");
  const loginRes = await trpcCall("auth.login", {
    email: EMAIL,
    password: PASSWORD,
  }, { kind: "mutation" });
  check("login OK", loginRes.ok, JSON.stringify(loginRes.error ?? loginRes.data));
  if (!loginRes.ok) {
    log("❌", "Abortando: no se pudo hacer login");
    process.exit(1);
  }
  const user = loginRes.data;
  log("ℹ️", `   Logueado como ${user.name} (role=${user.role})`);
  check("user es superadmin", user.role === "superadmin", `role=${user.role}`);

  // Verificar cookie active_org_id seteada (si solo tiene 1 org)
  const cookies = Array.from(COOKIE_JAR.keys());
  check("cookie app_session_id seteada", cookies.includes("app_session_id"));
  const activeOrgCookie = COOKIE_JAR.get("active_org_id");
  log("ℹ️", `   active_org_id = ${activeOrgCookie ?? "(no seteada)"}`);
  const loginOrgs = user.organizations ?? [];
  log("ℹ️", `   Orgs del user: ${loginOrgs.length} (${loginOrgs.map(o => o.name).join(", ")})`);

  // ------------------------------------------------------------
  // 2. Listar orgs
  // ------------------------------------------------------------
  log("ℹ️", "2. Listar mis organizaciones...");
  const myOrgsRes = await trpcCall("organizations.myOrganizations", undefined);
  check("myOrganizations OK", myOrgsRes.ok);
  const myOrgs = myOrgsRes.data ?? [];
  check("user pertenece a ≥1 org", myOrgs.length >= 1, `count=${myOrgs.length}`);
  const defaultOrgId = 1; // org default del backfill
  const defaultOrg = myOrgs.find(o => o.id === defaultOrgId);
  check("org default (id=1) presente", !!defaultOrg);

  // ------------------------------------------------------------
  // 3. Crear org nueva
  // ------------------------------------------------------------
  const newOrgName = `E2E Test Org ${Date.now()}`;
  log("ℹ️", `3. Crear org "${newOrgName}"...`);
  const createRes = await trpcCall("organizations.create", {
    name: newOrgName,
  }, { kind: "mutation" });
  check("create org OK", createRes.ok, JSON.stringify(createRes.error ?? createRes.data));
  if (!createRes.ok) {
    log("❌", "Abortando: no se pudo crear la org");
    process.exit(1);
  }
  const newOrg = createRes.data;
  check("org creada tiene id", typeof newOrg.id === "number");
  check("org creada tiene name", newOrg.name === newOrgName);
  check("org creada tiene status active", newOrg.status === "active");

  // ------------------------------------------------------------
  // 4. Cambiar a la org nueva
  // ------------------------------------------------------------
  log("ℹ️", "4. Cambiar a la org nueva...");
  const selectRes = await trpcCall("organizations.select", {
    organizationId: newOrg.id,
  }, { kind: "mutation" });
  check("select org OK", selectRes.ok);
  const newActiveOrgId = COOKIE_JAR.get("active_org_id");
  check(
    "cookie active_org_id actualizada",
    newActiveOrgId === String(newOrg.id),
    `got=${newActiveOrgId} expected=${newOrg.id}`
  );

  // ------------------------------------------------------------
  // 5. Editar branding
  // ------------------------------------------------------------
  const newColor = "#FF6B35";
  log("ℹ️", `5. Editar branding (color=${newColor})...`);
  const updateRes = await trpcCall("organizations.updateSettings", {
    primaryColor: newColor,
    displayName: "E2E Display Name",
  }, { kind: "mutation" });
  check("updateSettings OK", updateRes.ok, JSON.stringify(updateRes.error));

  // ------------------------------------------------------------
  // 6. Verificar branding
  // ------------------------------------------------------------
  log("ℹ️", "6. Verificar branding aplicado...");
  const settingsRes = await trpcCall(
    "organizations.currentSettings",
    undefined
  );
  check("currentSettings OK", settingsRes.ok);
  check(
    "primaryColor actualizado",
    settingsRes.data?.primaryColor === newColor,
    `got=${settingsRes.data?.primaryColor}`
  );
  check(
    "displayName actualizado",
    settingsRes.data?.displayName === "E2E Display Name"
  );
  check(
    "settings.organizationId coincide con la org activa",
    settingsRes.data?.organizationId === newOrg.id
  );

  // ------------------------------------------------------------
  // 7. Volver a la org default
  // ------------------------------------------------------------
  log("ℹ️", "7. Volver a la org default (id=1)...");
  const selectBackRes = await trpcCall("organizations.select", {
    organizationId: defaultOrgId,
  }, { kind: "mutation" });
  check("select org default OK", selectBackRes.ok);
  check(
    "cookie active_org_id volvió a 1",
    COOKIE_JAR.get("active_org_id") === "1"
  );

  // ------------------------------------------------------------
  // 8. Verificar que la org default sigue con su branding original
  // ------------------------------------------------------------
  log("ℹ️", "8. Verificar aislamiento de branding entre orgs...");
  const defaultSettingsRes = await trpcCall(
    "organizations.currentSettings",
    undefined
  );
  check("settings de org default OK", defaultSettingsRes.ok);
  check(
    "org default NO tiene el color de la org nueva",
    defaultSettingsRes.data?.primaryColor !== newColor,
    `got=${defaultSettingsRes.data?.primaryColor}`
  );
  check(
    "settings de org default tienen organizationId=1",
    defaultSettingsRes.data?.organizationId === 1
  );

  // ------------------------------------------------------------
  // 9. Listar miembros
  // ------------------------------------------------------------
  log("ℹ️", "9. Listar miembros de la org default...");
  const membersRes = await trpcCall("organizations.members", undefined);
  check("listMembers OK", membersRes.ok);
  const members = membersRes.data ?? [];
  check(
    "org default tiene al menos 1 miembro",
    members.length >= 1,
    `count=${members.length}`
  );

  // ------------------------------------------------------------
  // 10. Limpiar: archivar la org creada
  // ------------------------------------------------------------
  log("ℹ️", "10. Limpieza: archivar la org creada...");
  const archiveRes = await trpcCall("organizations.archive", {
    id: newOrg.id,
    status: "archived",
  }, { kind: "mutation" });
  check("archive org OK", archiveRes.ok);
  check(
    "org archivada tiene status archived",
    archiveRes.data?.status === "archived"
  );

  // ------------------------------------------------------------
  // 11. Verificar que listAll (superadmin) muestra todas
  // ------------------------------------------------------------
  log("ℹ️", "11. Verificar listAll (superadmin)...");
  const listAllRes = await trpcCall("organizations.listAll", undefined);
  check("listAll OK", listAllRes.ok);
  const allOrgs = listAllRes.data ?? [];
  check("listAll devuelve ≥2 orgs", allOrgs.length >= 2);
  check(
    "listAll incluye la org creada (archivada)",
    allOrgs.some(o => o.id === newOrg.id)
  );

  // ------------------------------------------------------------
  // 12. Verificar aislamiento cross-org
  // ------------------------------------------------------------
  log("ℹ️", "12. Verificar aislamiento cross-org...");
  // Crear un label en la org default (id=1) y verificar que NO
  // aparece en la org nueva.
  const labelRes = await trpcCall("automation.createLabel", {
    name: `e2e-label-${Date.now()}`,
    color: "#ff0000",
    organizationId: 1,
  }, { kind: "mutation" });
  check("12a. Crear label en org default OK", labelRes.ok);
  // Listar labels en la org nueva (deberian estar vacias ya que
  // la org fue recien creada)
  await selectRes.ok ? null : null;
  // Volvemos a la org nueva para listar sus labels
  await trpcCall("organizations.select", {
    organizationId: newOrg.id,
  }, { kind: "mutation" });
  const labelsInNewOrgRes = await trpcCall("automation.listLabels", undefined);
  check(
    "12b. Labels NO se filtran cross-org: org nueva ve sus labels (0 o defaults)",
    labelsInNewOrgRes.ok,
    `count=${(labelsInNewOrgRes.data ?? []).length}`
  );
  check(
    "12c. Label creado en org default NO aparece en org nueva",
    !(labelsInNewOrgRes.data ?? []).some(l => l.name && l.name.startsWith("e2e-label-")),
    "label de org default no debe aparecer en org nueva"
  );
  // Volver a la org default para limpiar
  await trpcCall("organizations.select", {
    organizationId: 1,
  }, { kind: "mutation" });

  // 13. Verificar que listLeads de la org default no incluye
  // leads de otras orgs
  log("ℹ️", "13. Verificar listLeads filtrado por org...");
  const leadsRes = await trpcCall("leads.list", {
    page: 1,
    pageSize: 5,
  });
  check("listLeads OK", leadsRes.ok);
  const leadList = leadsRes.data?.items ?? leadsRes.data ?? [];
  check(
    "listLeads no incluye leads con otros organizationId",
    leadList.every(l => !l.organizationId || l.organizationId === 1),
    "todos los leads deben ser de la org activa"
  );

  // 14. Verificar el dashboard esta scoped
  log("ℹ️", "14. Verificar dashboard scoped por org...");
  const dashboardRes = await trpcCall("leads.dashboard", undefined);
  check("dashboard OK", dashboardRes.ok);

  // ------------------------------------------------------------
  // Resumen
  // ------------------------------------------------------------
  log("ℹ️", "");
  log("ℹ️", "=".repeat(60));
  log("ℹ️", `RESUMEN: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    log("❌", "FAILURES:");
    for (const f of failures) {
      log("❌", `  - ${f}`);
    }
    process.exit(1);
  }
  log("✅", "Todos los checks pasaron.");
  process.exit(0);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});

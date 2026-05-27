const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  console.log("🚀 Iniciando script de corrección de esquema en Producción...");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ No DATABASE_URL found in .env");
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbUrl);
    console.log("✅ Conectado a MySQL.");

    // --- 1. Corregir pipeline_stages ---
    console.log("\n🛠️ Analizando tabla pipeline_stages...");
    const [colsStages] = await connection.query("DESCRIBE pipeline_stages");
    const stageFields = colsStages.map(c => c.Field);

    // Agregar displayName si falta
    if (!stageFields.includes("displayName")) {
      console.log("   ➕ Añadiendo columna 'displayName' a pipeline_stages...");
      await connection.query("ALTER TABLE pipeline_stages ADD COLUMN displayName VARCHAR(100) NOT NULL DEFAULT ''");
      console.log("   📝 Sincronizando 'displayName' con el valor de 'name'...");
      await connection.query("UPDATE pipeline_stages SET displayName = name");
      console.log("   ✅ Columna 'displayName' creada e inicializada.");
    } else {
      console.log("   ✔️ La columna 'displayName' ya existe.");
    }

    // Renombrar orderIndex a order si existe orderIndex y no existe order
    if (stageFields.includes("orderIndex") && !stageFields.includes("order")) {
      console.log("   🔄 Renombrando columna 'orderIndex' a 'order' en pipeline_stages...");
      // CHANGE COLUMN es compatible con MySQL antiguo y moderno
      await connection.query("ALTER TABLE pipeline_stages CHANGE COLUMN orderIndex `order` INT DEFAULT 0");
      console.log("   ✅ Columna renombrada exitosamente.");
    } else if (stageFields.includes("order")) {
      console.log("   ✔️ La columna 'order' ya está configurada.");
    }

    // --- 2. Corregir custom_labels ---
    console.log("\n🛠️ Analizando tabla custom_labels...");
    const [colsLabels] = await connection.query("DESCRIBE custom_labels");
    const labelFields = colsLabels.map(c => c.Field);

    // Agregar description si falta
    if (!labelFields.includes("description")) {
      console.log("   ➕ Añadiendo columna 'description' a custom_labels...");
      await connection.query("ALTER TABLE custom_labels ADD COLUMN description TEXT");
      console.log("   ✅ Columna 'description' creada.");
    } else {
      console.log("   ✔️ La columna 'description' ya existe.");
    }

    // --- 3. Corregir custom_channels (por si acaso) ---
    console.log("\n🛠️ Analizando tabla custom_channels...");
    const [colsChannels] = await connection.query("DESCRIBE custom_channels");
    const channelFields = colsChannels.map(c => c.Field);

    if (!channelFields.includes("icon")) {
      console.log("   ➕ Añadiendo columna 'icon' a custom_channels...");
      await connection.query("ALTER TABLE custom_channels ADD COLUMN icon VARCHAR(50) DEFAULT 'MessageSquare'");
      console.log("   ✅ Columna 'icon' creada.");
    } else {
      console.log("   ✔️ La columna 'icon' ya existe.");
    }

    console.log("\n🎉 ¡Esquema de base de datos corregido con éxito!");

  } catch (error) {
    console.error("❌ Ocurrió un error al aplicar las correcciones:", error.message);
  } finally {
    if (connection) await connection.end();
  }
}

run();

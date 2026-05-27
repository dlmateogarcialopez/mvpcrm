const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("No DATABASE_URL found");
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbUrl);
    console.log("✅ Conectado a MySQL.");

    // 1. Describir pipeline_stages
    console.log("\n📋 Columnas en pipeline_stages:");
    const [colsStages] = await connection.query("DESCRIBE pipeline_stages");
    console.table(colsStages);

    // 2. Describir custom_labels
    console.log("\n📋 Columnas en custom_labels:");
    const [colsLabels] = await connection.query("DESCRIBE custom_labels");
    console.table(colsLabels);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (connection) await connection.end();
  }
}

run();

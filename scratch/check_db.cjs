const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  console.log("DATABASE_URL:", dbUrl);
  if (!dbUrl) {
    console.error("No DATABASE_URL found");
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbUrl);
    console.log("✅ Conectado a MySQL.");

    // 1. Mostrar tablas en la base de datos
    const [tables] = await connection.query("SHOW TABLES");
    console.log("📋 Tablas actuales:", tables.map(t => Object.values(t)[0]));

    // 2. Probar consulta pipeline_stages
    try {
      console.log("Testing pipeline_stages query...");
      const [rows] = await connection.query("SELECT * FROM pipeline_stages");
      console.log("✅ pipeline_stages query succeeded. Rows:", rows.length);
    } catch (err) {
      console.error("❌ pipeline_stages query failed:", err.message);
    }

    // 3. Probar consulta custom_labels
    try {
      console.log("Testing custom_labels query...");
      const [rows] = await connection.query("SELECT * FROM custom_labels");
      console.log("✅ custom_labels query succeeded. Rows:", rows.length);
    } catch (err) {
      console.error("❌ custom_labels query failed:", err.message);
    }

  } catch (error) {
    console.error("❌ Error de conexión general:", error.message);
  } finally {
    if (connection) await connection.end();
  }
}

run();

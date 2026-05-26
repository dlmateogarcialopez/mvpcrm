import mysql from "mysql2/promise";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está disponible en el entorno.");
  }

  const connection = await mysql.createConnection(databaseUrl);

  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM users LIKE 'role'");
    const result = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!result) {
      console.log("ROLE_COLUMN_NOT_FOUND");
      return;
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

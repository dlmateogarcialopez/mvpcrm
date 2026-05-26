import mysql from "mysql2/promise";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está disponible en el entorno.");
  }

  const connection = await mysql.createConnection(databaseUrl);

  try {
    await connection.beginTransaction();

    await connection.query("UPDATE users SET role = 'agent' WHERE role = 'user'");

    const [rows] = await connection.query(
      "SELECT role, COUNT(*) AS total FROM users GROUP BY role ORDER BY role ASC",
    );

    await connection.commit();

    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

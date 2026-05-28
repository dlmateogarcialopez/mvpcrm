import mysql from "mysql2/promise";
import crypto from "crypto";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const args = process.argv.slice(2);
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está disponible en el entorno.");
  }

  const connection = await mysql.createConnection(databaseUrl);

  try {
    if (args.length < 2) {
      console.log("\n--- Asistente de Contraseñas / Listado de Usuarios ---");
      console.log("Uso: node set-password.mjs <correo> <nueva_contraseña>\n");

      const [users] = await connection.query("SELECT email, name, role FROM users");
      if (Array.isArray(users) && users.length > 0) {
        console.log("Usuarios registrados en la base de datos:");
        users.forEach(u => {
          console.log(`- Correo: ${u.email || 'Sin correo'} | Nombre: ${u.name || 'Sin nombre'} | Rol: ${u.role}`);
        });
      } else {
        console.log("No se encontraron usuarios registrados en la base de datos.");
      }
      console.log("");
      process.exit(0);
    }

    const [email, password] = args;
    const pwdHash = hashPassword(password);

    // 1. Verificamos si el usuario existe
    const [rows] = await connection.query("SELECT id, name FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    
    if (!Array.isArray(rows) || rows.length === 0) {
      console.error(`Error: No se encontró ningún usuario con el correo: ${email}`);
      process.exit(1);
    }

    const user = rows[0];
    
    // 2. Actualizamos el passwordHash
    await connection.query("UPDATE users SET passwordHash = ? WHERE id = ?", [pwdHash, user.id]);
    
    console.log(`¡Contraseña establecida con éxito para el usuario: ${user.name || email}!`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

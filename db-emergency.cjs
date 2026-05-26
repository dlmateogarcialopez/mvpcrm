const mysql = require('mysql2/promise');

async function init() {
  console.log('🚀 Iniciando creación de tablas de emergencia...');
  
  let connection;
  if (process.env.DATABASE_URL) {
    console.log('🔗 Conectando usando DATABASE_URL...');
    connection = await mysql.createConnection(process.env.DATABASE_URL);
  } else {
    console.log('🔗 Conectando usando credenciales por defecto...');
    connection = await mysql.createConnection({
      host: 'mv-database',
      user: 'mv_user',
      password: 'mv_password',
      database: 'cotizador_leads',
      port: 3306
    });
  }

  try {
    console.log('✅ Conectado a MySQL');

    // 1. Tabla Users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        openId VARCHAR(64) NOT NULL UNIQUE,
        name TEXT,
        email VARCHAR(320),
        loginMethod VARCHAR(64),
        role ENUM('guest', 'agent', 'admin', 'superadmin') DEFAULT 'agent' NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    console.log('✔ Tabla "users" lista');

    // 2. Tabla AppSettings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS appSettings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        configName VARCHAR(120) NOT NULL DEFAULT 'Configuración principal',
        isDefault BOOLEAN NOT NULL DEFAULT true,
        precioMultiple INT NOT NULL DEFAULT 99000,
        precioJunior INT NOT NULL DEFAULT 69000,
        precioSenior INT NOT NULL DEFAULT 69000,
        precioParqueadero INT NOT NULL DEFAULT 8000,
        ticketPromedioReferencia INT NOT NULL DEFAULT 500000,
        minimoPersonasAmarillo INT NOT NULL DEFAULT 100,
        minimoPersonasRojo INT NOT NULL DEFAULT 200,
        minimoValorAmarillo INT NOT NULL DEFAULT 20000000,
        minimoValorRojo INT NOT NULL DEFAULT 35000000,
        diasUrgenciaAlta INT NOT NULL DEFAULT 2,
        horasLeadCaliente INT NOT NULL DEFAULT 1,
        scoreAltoThreshold INT NOT NULL DEFAULT 65,
        metaIngresosMensual INT NOT NULL DEFAULT 50000000,
        comisionPorcentaje INT NOT NULL DEFAULT 5,
        calendarSyncEnabled BOOLEAN NOT NULL DEFAULT false,
        googleCalendarId VARCHAR(255),
        emailAlertsEnabled BOOLEAN NOT NULL DEFAULT false,
        smsAlertsEnabled BOOLEAN NOT NULL DEFAULT false,
        alertEmailTo VARCHAR(320),
        alertSmsTo VARCHAR(32),
        updatedByUserId INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (updatedByUserId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✔ Tabla "appSettings" lista');

    // 3. Tabla Leads
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        publicId VARCHAR(32) NOT NULL UNIQUE,
        contactoNombre VARCHAR(160),
        contactoTelefono VARCHAR(32),
        contactoCorreo VARCHAR(320),
        empresaNombre VARCHAR(160),
        empresaCiudad VARCHAR(120),
        nombreCliente VARCHAR(160) NOT NULL,
        nombreEmpresa VARCHAR(160),
        ciudad VARCHAR(120),
        telefono VARCHAR(32) NOT NULL,
        correo VARCHAR(320) NOT NULL,
        fechaVisita BIGINT NOT NULL,
        motivoVisita TEXT NOT NULL,
        tipoEvento ENUM('corporativo', 'social', 'experiencia', 'reunion', 'otro') NOT NULL DEFAULT 'otro',
        objecionPrincipal TEXT NOT NULL,
        cantidadMultiple INT NOT NULL DEFAULT 0,
        cantidadJunior INT NOT NULL DEFAULT 0,
        cantidadSenior INT NOT NULL DEFAULT 0,
        cantidadParqueadero INT NOT NULL DEFAULT 0,
        precioMultiple INT NOT NULL DEFAULT 99000,
        precioJunior INT NOT NULL DEFAULT 69000,
        precioSenior INT NOT NULL DEFAULT 69000,
        precioParqueadero INT NOT NULL DEFAULT 8000,
        subtotalMultiple INT NOT NULL DEFAULT 0,
        subtotalJunior INT NOT NULL DEFAULT 0,
        subtotalSenior INT NOT NULL DEFAULT 0,
        subtotalParqueadero INT NOT NULL DEFAULT 0,
        totalPersonas INT NOT NULL DEFAULT 0,
        valorTotal INT NOT NULL DEFAULT 0,
        ticketPromedio INT NOT NULL DEFAULT 0,
        scoreCantidad INT NOT NULL DEFAULT 0,
        scoreValorTotal INT NOT NULL DEFAULT 0,
        scoreTicketPromedio INT NOT NULL DEFAULT 0,
        scoreUrgencia INT NOT NULL DEFAULT 0,
        scoreRecencia INT NOT NULL DEFAULT 0,
        scoreTotal INT NOT NULL DEFAULT 0,
        prioridadBase ENUM('gris', 'verde', 'amarillo', 'rojo') NOT NULL DEFAULT 'gris',
        prioridad ENUM('gris', 'verde', 'amarillo', 'rojo') NOT NULL DEFAULT 'gris',
        prioridadExplicacion TEXT,
        estadoLead VARCHAR(50) NOT NULL DEFAULT 'nuevo',
        canalOrigen VARCHAR(100) NOT NULL DEFAULT 'otro',
        labels TEXT,
        agenteUserId INT,
        agenteResponsable VARCHAR(160),
        fechaIngresoLead BIGINT NOT NULL,
        fechaLimiteGestion BIGINT,
        ultimaGestion BIGINT,
        proximaAccion TEXT,
        notasInternas TEXT,
        motivoPerdido VARCHAR(240),
        motivoPausa VARCHAR(240),
        lastActivityAt BIGINT,
        calendarEventId VARCHAR(255),
        calendarEventUrl TEXT,
        calendarSyncStatus ENUM('disabled', 'pending', 'synced', 'error') NOT NULL DEFAULT 'disabled',
        calendarSyncMessage TEXT,
        alertPending BOOLEAN NOT NULL DEFAULT false,
        alertLastChannel VARCHAR(32),
        alertLastMessage TEXT,
        lastAlertAt BIGINT,
        closedAt BIGINT,
        createdByUserId INT NOT NULL,
        updatedByUserId INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (agenteUserId) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (createdByUserId) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (updatedByUserId) REFERENCES users(id) ON DELETE RESTRICT
      )
    `);
    console.log('✔ Tabla "leads" lista');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS settingsChangeLogs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        settingsId INT NOT NULL,
        changedByUserId INT,
        summary VARCHAR(255) NOT NULL,
        changedFields TEXT NOT NULL,
        previousSnapshot TEXT NOT NULL,
        nextSnapshot TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (settingsId) REFERENCES appSettings(id) ON DELETE CASCADE,
        FOREIGN KEY (changedByUserId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✔ Tabla "settingsChangeLogs" lista');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leadCalendarSyncs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leadId INT NOT NULL,
        externalCalendarId VARCHAR(255),
        externalEventId VARCHAR(255),
        syncAction ENUM('create', 'update', 'skip', 'error', 'manual') NOT NULL,
        syncStatus ENUM('pending', 'success', 'error') NOT NULL DEFAULT 'pending',
        requestFingerprint VARCHAR(255),
        message TEXT,
        triggeredByUserId INT,
        syncedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (triggeredByUserId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✔ Tabla "leadCalendarSyncs" lista');

    // Otras tablas necesarias
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pipeline_stages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        displayName VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#3b82f6',
        \`order\` INT DEFAULT 0,
        isActive BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✔ Tabla "pipeline_stages" lista');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS custom_labels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        color VARCHAR(7) DEFAULT '#6b7280',
        description TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✔ Tabla "custom_labels" lista');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS custom_channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) DEFAULT 'MessageSquare',
        isActive BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✔ Tabla "custom_channels" lista');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        \`trigger\` VARCHAR(50) NOT NULL,
        triggerCondition TEXT,
        action VARCHAR(50) NOT NULL,
        actionData TEXT,
        isActive BOOLEAN DEFAULT true,
        executionCount INT DEFAULT 0,
        lastExecutedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✔ Tabla "automation_rules" lista');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        templateId INT,
        content TEXT,
        targetSegment VARCHAR(50) NOT NULL,
        targetSegmentData TEXT,
        status VARCHAR(20) DEFAULT 'draft',
        scheduledAt TIMESTAMP NULL,
        sentAt TIMESTAMP NULL,
        totalSent INT DEFAULT 0,
        totalOpened INT DEFAULT 0,
        totalClicked INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✔ Tabla "email_campaigns" lista');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leadActivities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leadId INT NOT NULL,
        activityType ENUM('lead_created', 'lead_updated', 'status_changed', 'note_added', 'assignment_changed', 'sensitive_fields_changed', 'calendar_sync', 'alert_sent', 'automation') NOT NULL,
        title VARCHAR(160) NOT NULL,
        description TEXT,
        payload TEXT,
        isSystem BOOLEAN NOT NULL DEFAULT false,
        createdByUserId INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE,
        FOREIGN KEY (createdByUserId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✔ Tabla "leadActivities" lista');

    console.log('🎉 ¡Todas las tablas base creadas con éxito!');
  } catch (error) {
    console.error('❌ Error creando las tablas:', error);
  } finally {
    await connection.end();
  }
}

init();

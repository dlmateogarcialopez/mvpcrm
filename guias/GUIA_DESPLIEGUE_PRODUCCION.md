# Guía de Despliegue en Producción — Máquina de Ventas

Esta guía detalla los pasos necesarios para llevar la aplicación desde el entorno de desarrollo a un servidor de producción real.

---

## 1. Estrategia de Despliegue Recomendada

Para este proyecto (Node.js + Express + React), recomendamos un **VPS (Virtual Private Server)** como DigitalOcean, AWS EC2 o Linode, utilizando **PM2** como gestor de procesos y **Nginx** como proxy inverso.

### Requisitos del Servidor
- **SO:** Ubuntu 22.04 LTS o superior.
- **RAM:** Mínimo 1GB (2GB recomendado).
- **Node.js:** v20.x LTS.
- **Base de Datos:** MySQL 8.0 (Local o gestionada como AWS RDS).

---

## 2. Preparación del Servidor (Paso a Paso)

### Paso 1: Instalación de dependencias básicas
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs mysql-server nginx
sudo npm install -g pnpm pm2
```

### Paso 2: Configuración de la Base de Datos
Acceda a MySQL y cree la base de datos de producción:
```sql
CREATE DATABASE crm_produccion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'TuPasswordSeguro';
GRANT ALL PRIVILEGES ON crm_produccion.* TO 'crm_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## 3. Despliegue de la Aplicación

### Paso 1: Subir el código y compilar
Suba el contenido del proyecto al servidor (vía Git o SCP) y ejecute:
```bash
pnpm install
pnpm build
```

### Paso 2: Configurar Variables de Entorno
Cree el archivo `.env` en la carpeta raíz del servidor:
```env
NODE_ENV=production
DATABASE_URL=mysql://crm_user:TuPasswordSeguro@localhost:3306/crm_produccion
PORT=3000
# Importante: Configure sus credenciales reales de OAuth y APIs externas aquí
```

### Paso 3: Ejecutar Migraciones
```bash
pnpm db:push
```

### Paso 4: Iniciar con PM2
```bash
pm2 start dist/index.js --name "maquina-ventas"
pm2 save
pm2 startup
```

---

## 4. Configuración de Nginx (Acceso Público y SSL)

Cree un archivo de configuración para su dominio en `/etc/nginx/sites-available/crm`:

```nginx
server {
    listen 80;
    server_name crm.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Active el sitio y configure SSL con Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t && sudo system_server nginx restart
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d crm.tudominio.com
```

---

## 5. Checklist de Seguridad en Producción

1. **SSL Obligatorio:** Nunca use la aplicación en producción sin HTTPS (Certbot lo resuelve gratis).
2. **Firewall:** Asegúrese de que solo los puertos 80, 443 y 22 (SSH) estén abiertos.
3. **Backups:** Configure un cronjob para respaldar la base de datos MySQL diariamente.
4. **Logs:** Monitoree los errores en tiempo real con `pm2 logs`.

---
**Soporte:** Si el desarrollador encuentra problemas con las dependencias de `mysql2`, asegúrese de que las librerías nativas de MySQL estén instaladas en el sistema operativo (`libmysqlclient-dev`).

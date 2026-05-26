# Guía de Despliegue en Producción — Máquina de Ventas

> **Versión:** 2.0 (Dockerizada)

---

## 1. Estrategia de Despliegue

La **Máquina de Ventas** se despliega como **3 contenedores Docker independientes** en cualquier servidor que soporte Docker. Esta guía cubre el despliegue en un VPS (Virtual Private Server).

### Requisitos del Servidor

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| **SO** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **RAM** | 1 GB | 2 GB |
| **CPU** | 1 vCPU | 2 vCPU |
| **Disco** | 20 GB SSD | 40 GB SSD |
| **Docker** | v24+ | Latest |

### Proveedores Compatibles
- DigitalOcean Droplets
- AWS EC2 / Lightsail
- Linode
- Hetzner Cloud
- Google Cloud Compute Engine

---

## 2. Preparación del Servidor

### Paso 1: Instalar Docker
```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Agregar tu usuario al grupo docker
sudo usermod -aG docker $USER

# Verificar la instalación
docker --version
docker compose version
```

### Paso 2: Configurar Firewall
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 3000  # Aplicación (puerto por defecto)
sudo ufw allow 80    # HTTP (para Nginx/SSL)
sudo ufw allow 443   # HTTPS (para Nginx/SSL)
sudo ufw enable
```

> ⚠️ **NO expongas el puerto 3307 (MySQL) en producción.** Solo debe estar accesible dentro de la red Docker interna.

---

## 3. Despliegue

### Paso 1: Subir el código al servidor
```bash
# Opción A: Clonar desde Git
git clone <url-del-repositorio> /root/mvp
cd /root/mvp

# Opción B: Subir via SCP
scp -r ./MVP usuario@tu-servidor:/root/mvp
```

### Paso 2: Configurar variables de entorno
```bash
cp .env.example .env
nano .env
```

**Variables OBLIGATORIAS en producción:**
```env
NODE_ENV=production
DB_NAME=maquina_ventas
DB_USER=mv_prod_user
DB_PASSWORD=UnaContraseñaMuySegura123!
DB_ROOT_PASSWORD=OtraContraseñaSegura456!
APP_PORT=3000

# OAuth (requerido para autenticación)
OAUTH_SERVER_URL=https://tu-auth-server.com
=tu-owner-open-id
```

### Paso 3: Construir y levantar
```bash
docker compose up --build -d
```

El flag `-d` ejecuta los contenedores en background (detached mode).

### Paso 4: Aplicar migraciones
```bash
docker compose exec backend npx drizzle-kit generate
docker compose exec backend npx drizzle-kit migrate
```

### Paso 5: Verificar que todo funciona
```bash
# Ver el estado de los contenedores
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Verificar que el frontend responde
curl -I http://localhost
```

---

## 4. Configurar SSL (HTTPS) con Nginx + Certbot

Para producción, es **obligatorio** tener SSL. Instala Nginx en el host como proxy:

### Paso 1: Instalar Nginx y Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Paso 2: Crear configuración del dominio
```bash
sudo nano /etc/nginx/sites-available/maquina-ventas
```

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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Paso 3: Activar y obtener SSL
```bash
sudo ln -s /etc/nginx/sites-available/maquina-ventas /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d crm.tudominio.com
```

---

## 5. Mantenimiento

### Actualizar la aplicación
```bash
cd /root/mvp

# Descargar cambios
git pull origin main

# Reconstruir y reiniciar
docker compose up --build -d

# Aplicar nuevas migraciones si las hay
docker compose exec backend npx drizzle-kit generate
docker compose exec backend npx drizzle-kit migrate
```

### Backup de la base de datos
```bash
# Crear un backup manual
docker compose exec db mysqldump -u root -p maquina_ventas > backup_$(date +%Y%m%d).sql

# Automatizar con crontab (diario a las 3:00 AM)
echo "0 3 * * * cd /root/mvp && docker compose exec -T db mysqldump -u root -pOtraContraseñaSegura456! maquina_ventas > /root/backups/mv_\$(date +\%Y\%m\%d).sql" | crontab -
```

### Restaurar un backup
```bash
cat backup_20260420.sql | docker compose exec -T db mysql -u root -p maquina_ventas
```

### Ver logs de un servicio específico
```bash
docker compose logs -f backend    # Solo backend
docker compose logs -f frontend   # Solo frontend
docker compose logs -f db         # Solo base de datos
```

### Reiniciar un servicio específico
```bash
docker compose restart backend
```

---

## 6. Checklist de Seguridad

| # | Verificación | Estado |
|---|-------------|--------|
| 1 | ✅ SSL/HTTPS activado con Certbot | |
| 2 | ✅ Puerto 5432 (MySQL) NO expuesto al público | |
| 3 | ✅ Archivo `.env` NO subido al repositorio Git | |
| 4 | ✅ Contraseñas de DB son fuertes y únicas | |
| 5 | ✅ Firewall solo permite puertos 22, 80, 443 | |
| 6 | ✅ Backups automáticos configurados | |
| 7 | ✅ Logs monitoreados (`docker compose logs`) | |

---

## 7. Monitoreo Rápido

```bash
# Estado de todos los servicios
docker compose ps

# Uso de recursos por contenedor
docker stats

# Espacio usado por Docker
docker system df
```

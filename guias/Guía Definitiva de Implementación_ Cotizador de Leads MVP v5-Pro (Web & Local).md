# Guía Definitiva de Implementación: Máquina de Ventas (Web & Local)

## 1. Introducción

Esta guía proporciona instrucciones detalladas y paso a paso para la implementación y configuración del sistema **Máquina de Ventas** en dos entornos principales: **local** (para desarrollo y pruebas en tu máquina) y **web** (para despliegue en la plataforma Vercel). El objetivo es asegurar una funcionalidad del 100% y permitir la personalización visual sin necesidad de modificar el código fuente.

### 1.1. Tecnologías Clave

El proyecto está construido con las siguientes tecnologías:

*   **Frontend**: React 19, TypeScript, TailwindCSS, shadcn/ui
*   **Backend**: Express 4, tRPC 11
*   **Base de Datos**: Drizzle ORM, MySQL
*   **Testing**: Vitest
*   **Gestor de Paquetes**: pnpm
*   **Despliegue Web**: Vercel
*   **Integraciones**: Telegram Bot API, Resend (Email), Webhooks (ManyChat/Facebook)

## 2. Requisitos Previos

Antes de comenzar, asegúrate de que tu entorno de desarrollo tenga instalados los siguientes componentes:

*   **Git**: Para el control de versiones.
*   **Node.js (versión 18 o superior)**: Entorno de ejecución de JavaScript. Se recomienda usar `nvm` para gestionar versiones.
*   **pnpm**: Gestor de paquetes rápido y eficiente. Instálalo globalmente con `npm install -g pnpm`.
*   **MySQL Server**: Base de datos relacional. Puedes instalarlo localmente o usar un servicio en la nube.
*   **Un editor de código**: Visual Studio Code es altamente recomendado.

## 3. Implementación Local

Esta sección detalla cómo configurar y ejecutar el CRM en tu máquina local.

### 3.1. Preparación del Código Fuente

1.  **Descomprime el archivo `CRM-PRO-PARA-LOCAL.zip`** en la ubicación deseada de tu sistema. Esto creará una carpeta con el nombre del proyecto.
2.  **Navega al directorio del proyecto** usando tu terminal:
    ```bash
    cd /ruta/a/tu/proyecto/CRM-PRO-PARA-LOCAL
    ```

### 3.2. Instalación de Dependencias

Ejecuta el siguiente comando para instalar todas las dependencias del proyecto:

```bash
pnpm install
```

### 3.3. Configuración de la Base de Datos MySQL

1.  **Crea una base de datos MySQL** para el proyecto. Puedes usar un cliente como MySQL Workbench, DBeaver o la línea de comandos:
    ```sql
    CREATE DATABASE `crm_leads_pro`;
    ```
2.  **Crea un usuario y asigna permisos** a la nueva base de datos (opcional, pero recomendado para seguridad):
    ```sql
    CREATE USER 'crmuser'@'localhost' IDENTIFIED BY 'tu_password_segura';
    GRANT ALL PRIVILEGES ON `crm_leads_pro`.* TO 'crmuser'@'localhost';
    FLUSH PRIVILEGES;
    ```
3.  **Copia el archivo de configuración de entorno**: En la raíz del proyecto, encontrarás un archivo `env.example`. Cópialo y renómbralo a `.env`:
    ```bash
    cp .env.example .env
    ```
4.  **Edita el archivo `.env`** con tus credenciales de base de datos y otras configuraciones. Asegúrate de que las siguientes variables estén correctamente configuradas:

    ```dotenv
    DATABASE_URL="mysql://crmuser:tu_password_segura@localhost:3306/crm_leads_pro"
    # Otras variables de entorno (ver sección 5)
    ```
    *Asegúrate de reemplazar `crmuser`, `tu_password_segura` y `crm_leads_pro` con tus propios valores.* 

### 3.4. Ejecución de Migraciones de Base de Datos

El proyecto utiliza Drizzle ORM para la gestión de esquemas y migraciones. Ejecuta el siguiente comando para aplicar las migraciones y crear las tablas necesarias en tu base de datos:

```bash
pnpm run db:migrate
```

### 3.5. Inicio de la Aplicación Local

Una vez que las dependencias estén instaladas y la base de datos configurada, puedes iniciar la aplicación:

```bash
pnpm run dev
```

La aplicación estará disponible en `http://localhost:3000` (o el puerto configurado en tu `.env`).

## 4. Implementación Web (Vercel)

Esta sección describe cómo desplegar el CRM en Vercel para un entorno de producción.

### 4.1. Preparación del Código Fuente

1.  **Descomprime el archivo `CRM-PRO-PARA-WEB.zip`** en la ubicación deseada de tu sistema.
2.  **Navega al directorio del proyecto**:
    ```bash
    cd /ruta/a/tu/proyecto/CRM-PRO-PARA-WEB
    ```
3.  **Inicializa un repositorio Git** (si aún no lo has hecho) y conecta con tu proveedor (GitHub, GitLab, Bitbucket):
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git remote add origin <URL_DE_TU_REPOSITORIO>
    git push -u origin master
    ```

### 4.2. Configuración de Vercel

1.  **Conecta tu repositorio**: En el dashboard de Vercel, importa tu proyecto desde el repositorio Git donde subiste el código.
2.  **Configura las Variables de Entorno**: Este es un paso CRÍTICO. En la configuración del proyecto en Vercel, ve a la sección 
"Environment Variables" y añade todas las variables de entorno necesarias. Estas deben coincidir con las del archivo `.env` local, pero con los valores correspondientes a tu entorno de producción (por ejemplo, la URL de la base de datos en la nube).

    **Variables de Entorno Esenciales para Vercel:**
    *   `DATABASE_URL`: URL de conexión a tu base de datos MySQL en la nube (por ejemplo, PlanetScale, Neon, AWS RDS).
    *   `NEXTAUTH_SECRET`: Una cadena aleatoria larga y segura para NextAuth. Puedes generarla con `openssl rand -base64 32`.
    *   `NEXTAUTH_URL`: La URL de tu despliegue en Vercel (por ejemplo, `https://tu-proyecto.vercel.app`).
    *   `TELEGRAM_BOT_TOKEN`: Token de tu bot de Telegram para el servicio de alertas.
    *   `TELEGRAM_CHAT_ID`: ID del chat o grupo de Telegram donde se enviarán las alertas.
    *   `RESEND_API_KEY`: Clave API de Resend para el envío de correos electrónicos.
    *   `WEBHOOK_SECRET`: Un secreto para asegurar tus webhooks (Facebook/ManyChat).
    *   `NEXT_PUBLIC_APP_URL`: La URL pública de tu aplicación, similar a `NEXTAUTH_URL`.

    *Asegúrate de que todas las variables de entorno estén configuradas correctamente en Vercel, ya que son cruciales para el funcionamiento de la aplicación en producción.*

3.  **Configuración de Build & Deployment**: Vercel debería detectar automáticamente la configuración de tu proyecto React/Next.js. Asegúrate de que el comando de build sea `pnpm run build` y el directorio de salida sea `build` o `.next` (dependiendo de la configuración de tu proyecto).

### 4.3. Despliegue

Una vez configurado, Vercel desplegará automáticamente tu aplicación cada vez que hagas un `push` a la rama principal de tu repositorio. Puedes monitorear el estado del despliegue en el dashboard de Vercel.

## 5. Variables de Entorno Comunes y Personalización

Además de las variables de base de datos y autenticación, el sistema utiliza otras variables de entorno para la personalización y la integración con servicios externos. Aquí hay una lista de las más importantes que tu desarrollador deberá revisar y ajustar:

*   `NEXT_PUBLIC_APP_NAME`: Nombre de tu aplicación (aparece en el resumen comercial, correos, etc.).
*   `NEXT_PUBLIC_COMPANY_NAME`: Nombre de tu empresa.
*   `NEXT_PUBLIC_COMPANY_EMAIL`: Correo electrónico de contacto de la empresa.
*   `NEXT_PUBLIC_COMPANY_PHONE`: Teléfono de contacto de la empresa.
*   `NEXT_PUBLIC_COMPANY_ADDRESS`: Dirección de la empresa.
*   `NEXT_PUBLIC_DEFAULT_CURRENCY`: Moneda por defecto (ej. `USD`, `EUR`, `COP`).
*   `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`: Clave pública de Stripe (si se integra con pagos).
*   `STRIPE_SECRET_KEY`: Clave secreta de Stripe.
*   `GOOGLE_CLIENT_ID`: ID de cliente de Google para autenticación (si se usa).
*   `GOOGLE_CLIENT_SECRET`: Secreto de cliente de Google.

### 5.1. Personalización Visual sin Código

Una de las características clave de esta versión 
Pro es la capacidad de personalizar visualmente muchos aspectos del CRM sin necesidad de tocar el código. Tu desarrollador debe saber que estas configuraciones se realizan a través de la interfaz de usuario una vez que la aplicación está en funcionamiento.

*   **Personalización de Etapas del Embudo**: Desde el panel de administración, se pueden añadir, editar, reordenar y asignar colores a las etapas del embudo de ventas.
*   **Gestión de Etiquetas/Tags**: Creación, edición y eliminación de etiquetas para organizar oportunidades y tareas.
*   **Gestor de Canales Personalizados**: Definición de los canales por los que llegan las oportunidades (ej. Facebook, Instagram, Web, Referido).
*   **Motor de Automatización Visual ('If X, then Y')**: Configuración de reglas comerciales que se disparan bajo ciertas condiciones (ej. "Si la oportunidad pasa a la etapa 'Calificado', enviar un email de bienvenida").

## 6. Integraciones

El sistema viene pre-integrado con varios servicios. Tu desarrollador deberá configurar las credenciales y URLs necesarias.

### 6.1. Telegram Bot API

Para el servicio de alertas, se requiere un bot de Telegram. El `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` deben configurarse en las variables de entorno.

### 6.2. Resend (Email Marketing)

Para el envío de correos electrónicos transaccionales y de marketing, se utiliza Resend. La `RESEND_API_KEY` es esencial.

### 6.3. Webhooks (Facebook/ManyChat)

El sistema expone endpoints de webhook para integraciones con plataformas como Facebook y ManyChat. La `WEBHOOK_SECRET` debe ser una cadena segura y compartida con estas plataformas para verificar la autenticidad de las solicitudes.

## 7. Solución de Problemas Comunes

*   **Problemas de Conexión a la Base de Datos**: Verifica que el servidor MySQL esté en ejecución y que las credenciales en `DATABASE_URL` sean correctas. Asegúrate de que el puerto (por defecto 3306) no esté bloqueado por un firewall.
*   **Migraciones Fallidas**: Si `pnpm run db:migrate` falla, revisa los logs para errores específicos. Asegúrate de que la base de datos esté vacía o que no haya conflictos de esquema si estás intentando migrar sobre una base de datos existente con datos.
*   **Variables de Entorno Faltantes en Vercel**: Un error común es olvidar configurar todas las variables de entorno en el dashboard de Vercel. La aplicación no funcionará correctamente sin ellas.
*   **Errores de Build en Vercel**: Revisa los logs de despliegue en Vercel. A menudo, los errores de build se deben a dependencias no instaladas correctamente o a problemas de configuración en el `package.json`.

## 8. Conclusión

Siguiendo esta guía, tu desarrollador podrá implementar y configurar la **Máquina de Ventas** de manera eficiente tanto en un entorno local como en la nube con Vercel. La arquitectura del sistema permite una gran flexibilidad y personalización visual, lo que te permitirá adaptar el CRM a tus necesidades específicas sin intervenciones de código.

--- 

**Autor:** Manus AI
**Fecha:** 20 de Abril de 2026

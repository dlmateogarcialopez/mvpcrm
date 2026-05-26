# Máquina de Ventas — Documentación Técnica

> **Versión:** 2.0 (Dockerizada)  
> **Última actualización:** Abril 2026

---

## 📚 Índice de Documentación

| Documento | Descripción |
|-----------|-------------|
| [ARQUITECTURA.md](./ARQUITECTURA.md) | Diseño del sistema, capas, flujo de datos y patrones utilizados |
| [TECNOLOGIAS.md](./TECNOLOGIAS.md) | Stack tecnológico completo con versiones y justificación |
| [INSTALACION.md](./INSTALACION.md) | Guía paso a paso para levantar el proyecto en local (con y sin Docker) |
| [DESPLIEGUE.md](./DESPLIEGUE.md) | Instrucciones de despliegue en producción con Docker Compose |

---

## ¿Qué es la Máquina de Ventas?

La **Máquina de Ventas** es un CRM profesional diseñado para la gestión integral de **oportunidades comerciales**. Permite a equipos de ventas:

- 📋 Registrar y dar seguimiento a oportunidades en un **embudo** visual personalizable.
- 📊 Calcular automáticamente el **puntaje** de cada oportunidad basado en valor, urgencia y recencia.
- 🔔 Recibir alertas en tiempo real por **Telegram** cuando una oportunidad requiere atención.
- 📧 Automatizar emails y acciones con un motor de reglas comerciales.
- 📅 Sincronizar visitas con **Google Calendar**.
- 📤 Exportar oportunidades a **Excel** (.xlsx).
- 🐳 Desplegarse en contenedores Docker (Aplicación unificada + Base de Datos).

---

## 🏗️ Vista Rápida de la Arquitectura

```
┌───────────────────────┐     ┌─────────────────┐
│  Aplicación Unificada │     │    Database     │
│   (Backend + Front)   │────▶│   (MySQL 8.0)   │
│   React 19 + Express  │     │   Drizzle ORM   │
│   Puerto :3000        │     │   Puerto :3307  │
└───────────────────────┘     └─────────────────┘
```

---

## 📜 Glosario Comercial

| Término Técnico (Prohibido) | Término Oficial |
|-----------------------------|----------------|
| Lead / Leads | **Oportunidad / Oportunidades** |
| Pipeline | **Embudo** |
| Score | **Puntaje** |
| Dashboard (CRM) | **Resumen Comercial** |

> ⚠️ **Regla**: Todo texto visible al usuario final o documentación pública debe usar exclusivamente los **Términos Oficiales**.

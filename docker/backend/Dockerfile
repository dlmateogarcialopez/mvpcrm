# ============================================
# Máquina de Ventas — Backend Dockerfile
# Multi-stage build: Builder + Runner
# ============================================

# --- STAGE 1: BUILD ---
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Copiar archivos de dependencias primero (cache de capas)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar todas las dependencias (incluidas devDependencies para el build)
RUN pnpm install --no-frozen-lockfile

# Copiar el resto del código fuente
COPY tsconfig.json ./
COPY drizzle/ ./drizzle/
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY vite.config.ts ./
COPY components.json ./

# Definir argumentos de build para el Frontend (VITE_)
ARG VITE_APP_ID
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_FRONTEND_FORGE_API_URL
ARG VITE_FRONTEND_FORGE_API_KEY

# Hacerlos disponibles durante pnpm build
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL
ENV VITE_FRONTEND_FORGE_API_URL=$VITE_FRONTEND_FORGE_API_URL
ENV VITE_FRONTEND_FORGE_API_KEY=$VITE_FRONTEND_FORGE_API_KEY

# Ejecutar el build (compila backend con esbuild)
RUN pnpm run build

# --- STAGE 2: RUNNER ---
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar pnpm para producción
RUN npm install -g pnpm

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar SOLO dependencias de producción
RUN pnpm install --no-frozen-lockfile --prod


# Copiar artefactos del build
COPY --from=builder /app/dist ./dist

# Copiar archivos de migración de Drizzle y código compartido
COPY drizzle/ ./drizzle/
COPY shared/ ./shared/

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Exponer puerto del backend
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/trpc || exit 1

# Comando de inicio
CMD ["node", "dist/index.js"]

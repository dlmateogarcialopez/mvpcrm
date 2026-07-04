#!/usr/bin/env bash
# ============================================================
# db-backup.sh — Dump de la DB del servidor prod a local
# ============================================================
# Uso:
#   ./scripts/db-backup.sh                    # dump + download
#   ./scripts/db-backup.sh --restore FILE     # restaurar dump local
#
# Variables configurables (env vars):
#   SERVER_HOST      hostname SSH del servidor
#   SERVER_USER      usuario SSH (default: root)
#   SERVER_PORT      puerto SSH (default: 22)
#   DB_CONTAINER     nombre del container MySQL (default: mv-database)
#   DB_NAME          nombre de la base (default: cotizador_leads)
#   DB_USER          usuario MySQL (default: mv_user)
#   DB_PASSWORD      password MySQL (default: mv_password)
#   LOCAL_PORT       puerto mapeado localmente (default: 25060)
# ============================================================

set -euo pipefail

# ── Config ──
SERVER_HOST="${SERVER_HOST:-hostname}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
DB_CONTAINER="${DB_CONTAINER:-mv-database}"
DB_NAME="${DB_NAME:-cotizador_leads}"
DB_USER="${DB_USER:-mv_user}"
DB_PASSWORD="${DB_PASSWORD:-mv_password}"
LOCAL_PORT="${LOCAL_PORT:-25060}"
BACKUP_DIR="${BACKUP_DIR:-./respaldo}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="dump-${DB_NAME}-${TIMESTAMP}.sql.gz"

# ── Helpers ──
green() { printf "\033[1;32m%s\033[0m\n" "$*"; }
red()   { printf "\033[1;31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[1;33m%s\033[0m\n" "$*"; }

# ── Parse args ──
MODE="${1:-dump}"
RESTORE_FILE="${2:-}"

if [ "$MODE" = "--restore" ]; then
  if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
    red "Error: archivo de dump no encontrado: $RESTORE_FILE"
    exit 1
  fi

  yellow "Restaurando dump: $RESTORE_FILE"
  yellow "  → Destino: container local mv-database, db: $DB_NAME"

  # Drop & recreate DB
  powershell.exe -Command "& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' exec -i $DB_CONTAINER mysql -uroot -p$DB_PASSWORD -e \"DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\"" || true

  # Restore
  gunzip -c "$RESTORE_FILE" | powershell.exe -Command "& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' exec -i $DB_CONTAINER mysql -uroot -p$DB_PASSWORD $DB_NAME"

  green "✓ Dump restaurado correctamente"
  exit 0
fi

# ── Modo dump (default) ──
yellow "Iniciando dump de DB del servidor..."
echo "  Server:   $SERVER_USER@$SERVER_HOST:$SERVER_PORT"
echo "  Container: $DB_CONTAINER"
echo "  DB:       $DB_NAME"
echo

# 1) Crear directorio local
mkdir -p "$BACKUP_DIR"

# 2) Dump en el servidor (comprimido con gzip)
yellow "[1/3] Ejecutando mysqldump en el servidor..."
ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" \
  "docker exec $DB_CONTAINER mysqldump --single-transaction --quick --routines --triggers --events \
     -u'$DB_USER' -p'$DB_PASSWORD' $DB_NAME | gzip > /tmp/$DUMP_FILE"

# 3) Verificar tamaño
DUMP_SIZE=$(ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "stat -c%s /tmp/$DUMP_FILE")
green "  → Dump creado en servidor: /tmp/$DUMP_FILE ($DUMP_SIZE bytes)"

# 4) Descargar al local
yellow "[2/3] Descargando a $BACKUP_DIR/$DUMP_FILE..."
scp -P "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST:/tmp/$DUMP_FILE" "$BACKUP_DIR/$DUMP_FILE"
green "  → Descarga completa"

# 5) Cleanup en el servidor
ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "rm /tmp/$DUMP_FILE"
green "  → Archivo temporal del servidor eliminado"

echo
green "✓ Backup completado: $BACKUP_DIR/$DUMP_FILE"
yellow ""
yellow "Para restaurar:"
echo "  ./scripts/db-backup.sh --restore $BACKUP_DIR/$DUMP_FILE"
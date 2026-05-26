#!/bin/bash
set -e

echo "Iniciando MySQL..."
sudo mkdir -p /var/run/mysqld
sudo chown mysql:mysql /var/run/mysqld
sudo /etc/init.d/mysql start 2>&1 || true
sleep 2

echo "Creando base de datos..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS cotizador_leads CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true

echo "Base de datos lista."

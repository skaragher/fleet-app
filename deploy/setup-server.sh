#!/bin/bash
# =============================================================
# Script de déploiement Fleet App - Serveur 193.168.173.181
# À exécuter en root sur le serveur
# =============================================================
set -e

APP_DIR="/var/www/fleet-app"
DB_NAME="fleet_db"
DB_USER="fleet_user"
DB_PASS='Fleet@2026!'

echo "======================================"
echo "  Fleet App - Installation serveur"
echo "======================================"

# ─────────────────────────────────────────
# 1. Mise à jour système
# ─────────────────────────────────────────
echo ""
echo "📦 [1/8] Mise à jour du système..."
apt-get update -y && apt-get upgrade -y

# ─────────────────────────────────────────
# 2. Installation Node.js 20
# ─────────────────────────────────────────
echo ""
echo "🟢 [2/8] Installation Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

# ─────────────────────────────────────────
# 3. Installation PostgreSQL
# ─────────────────────────────────────────
echo ""
echo "🐘 [3/8] Installation PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
fi
systemctl start postgresql
systemctl enable postgresql

# Créer la base de données et l'utilisateur
echo "  → Création de la base de données..."
sudo -u postgres psql -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;" 2>/dev/null || true

sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || echo "  (base déjà existante)"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
echo "  ✅ Base de données prête"

# ─────────────────────────────────────────
# 4. Installation Nginx
# ─────────────────────────────────────────
echo ""
echo "🌐 [4/8] Installation Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
fi
systemctl start nginx
systemctl enable nginx

# ─────────────────────────────────────────
# 5. Installation PM2
# ─────────────────────────────────────────
echo ""
echo "⚙️  [5/8] Installation PM2..."
npm install -g pm2 2>/dev/null || true
echo "PM2: $(pm2 -v)"

# ─────────────────────────────────────────
# 6. Créer le dossier de l'application
# ─────────────────────────────────────────
echo ""
echo "📁 [6/8] Préparation du dossier application..."
mkdir -p "${APP_DIR}/backend"
mkdir -p "${APP_DIR}/frontend"
mkdir -p "${APP_DIR}/backend/uploads/avatars"
mkdir -p "${APP_DIR}/backend/uploads/company-logos"
chmod -R 755 "${APP_DIR}"

echo ""
echo "======================================"
echo "✅ Installation de base terminée !"
echo ""
echo "📋 ÉTAPES SUIVANTES :"
echo "  1. Copier les fichiers de l'application (voir deploy-app.sh)"
echo "  2. Configurer Nginx"
echo "  3. Démarrer le backend"
echo "======================================"

#!/bin/bash
# =============================================================
# Script LOCAL (Windows Git Bash) - Build et upload vers le serveur
# Exécuter depuis la racine du projet fleet-app
# Prérequis : OpenSSH (inclus dans Git Bash / Windows 10+)
# =============================================================

SERVER_IP="193.168.173.181"
SERVER_USER="root"
APP_DIR="/var/www/fleet-app"

echo "======================================"
echo "  Fleet App - Build & Upload"
echo "======================================"

# ─────────────────────────────────────────
# 1. Build du frontend Vue 3
# ─────────────────────────────────────────
echo ""
echo "🔨 [1/4] Build du frontend..."
cd frontend
npm install
npm run build
cd ..
echo "  ✅ Frontend buildé dans frontend/dist/"

# ─────────────────────────────────────────
# 2. Créer les dossiers sur le serveur
# ─────────────────────────────────────────
echo ""
echo "📁 [2/4] Création des dossiers sur le serveur..."
ssh "${SERVER_USER}@${SERVER_IP}" "
  mkdir -p ${APP_DIR}/backend/uploads/avatars
  mkdir -p ${APP_DIR}/backend/uploads/company-logos
  mkdir -p ${APP_DIR}/frontend
  mkdir -p ${APP_DIR}/deploy
  mkdir -p ${APP_DIR}/logs
"

# ─────────────────────────────────────────
# 3. Créer une archive du backend (sans node_modules)
# ─────────────────────────────────────────
echo ""
echo "📦 [3/4] Envoi des fichiers..."

# Archive backend (sans node_modules, sans .env, sans data/)
tar --exclude='backend/node_modules' \
    --exclude='backend/.env' \
    --exclude='backend/data' \
    -czf /tmp/fleet-backend.tar.gz backend/

# Archive frontend dist
tar -czf /tmp/fleet-frontend.tar.gz -C frontend dist

# Upload des archives
scp /tmp/fleet-backend.tar.gz "${SERVER_USER}@${SERVER_IP}:/tmp/"
scp /tmp/fleet-frontend.tar.gz "${SERVER_USER}@${SERVER_IP}:/tmp/"

# Upload des configs
scp deploy/nginx-fleet.conf "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/deploy/"
scp deploy/setup-server.sh "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/deploy/"
scp deploy/deploy-app.sh "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/deploy/"
scp deploy/.env.production "${SERVER_USER}@${SERVER_IP}:${APP_DIR}/backend/.env"

# Décompresser sur le serveur
echo ""
echo "📂 Décompression sur le serveur..."
ssh "${SERVER_USER}@${SERVER_IP}" "
  cd ${APP_DIR}
  tar -xzf /tmp/fleet-backend.tar.gz
  tar -xzf /tmp/fleet-frontend.tar.gz -C ${APP_DIR}/frontend --strip-components=1
  chmod +x ${APP_DIR}/deploy/*.sh
  rm -f /tmp/fleet-backend.tar.gz /tmp/fleet-frontend.tar.gz
  echo '✅ Fichiers décompressés'
"

echo ""
echo "======================================"
echo "✅ Upload terminé !"
echo ""
echo "📋 ÉTAPES SUIVANTES :"
echo ""
echo "1️⃣  Connectez-vous au serveur :"
echo "   ssh ${SERVER_USER}@${SERVER_IP}"
echo ""
echo "2️⃣  Installez les dépendances système (1ère fois) :"
echo "   bash ${APP_DIR}/deploy/setup-server.sh"
echo ""
echo "3️⃣  Déployez l'application :"
echo "   bash ${APP_DIR}/deploy/deploy-app.sh"
echo ""
echo "4️⃣  (Optionnel) Charger les données de test :"
echo "   cd ${APP_DIR}/backend && node prisma/seed.js"
echo ""
echo "5️⃣  Vérification :"
echo "   curl http://${SERVER_IP}/api/health"
echo "   → Doit retourner: {\"status\":\"healthy\",...}"
echo "======================================"

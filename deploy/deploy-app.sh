#!/bin/bash
# =============================================================
# Script de déploiement de l'application Fleet App
# À exécuter en root sur le serveur APRÈS setup-server.sh
# =============================================================
set -e

APP_DIR="/var/www/fleet-app"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

echo "======================================"
echo "  Fleet App - Déploiement application"
echo "======================================"

# ─────────────────────────────────────────
# 1. Backend - Installation des dépendances
# ─────────────────────────────────────────
echo ""
echo "📦 [1/5] Installation des dépendances backend..."
cd "${BACKEND_DIR}"
npm install --omit=dev

# ─────────────────────────────────────────
# 2. Vérification du .env
# ─────────────────────────────────────────
echo ""
echo "⚙️  [2/5] Vérification de la configuration..."
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    echo "❌ ERREUR: Le fichier .env est manquant dans ${BACKEND_DIR}"
    echo "   Copiez le fichier deploy/.env.production vers ${BACKEND_DIR}/.env"
    exit 1
fi
echo "  ✅ .env trouvé"

# ─────────────────────────────────────────
# 3. Prisma - Migration base de données
# ─────────────────────────────────────────
echo ""
echo "🐘 [3/5] Migration de la base de données..."
cd "${BACKEND_DIR}"
npx prisma generate
npx prisma migrate deploy
echo "  ✅ Migrations appliquées"

# Optionnel: seed initial (à commenter si déjà fait)
# echo "  → Initialisation des données (seed)..."
# node prisma/seed.js

# ─────────────────────────────────────────
# 4. Configuration Nginx
# ─────────────────────────────────────────
echo ""
echo "🌐 [4/5] Configuration Nginx..."
cp "${APP_DIR}/deploy/nginx-fleet.conf" /etc/nginx/sites-available/fleet-app
ln -sf /etc/nginx/sites-available/fleet-app /etc/nginx/sites-enabled/fleet-app
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t && systemctl reload nginx
echo "  ✅ Nginx configuré"

# ─────────────────────────────────────────
# 5. Démarrage du backend avec PM2
# ─────────────────────────────────────────
echo ""
echo "🚀 [5/5] Démarrage du backend..."
cd "${BACKEND_DIR}"

# Arrêter l'instance existante si elle tourne
pm2 delete fleet-backend 2>/dev/null || true

# Démarrer avec PM2
pm2 start src/server.js \
    --name "fleet-backend" \
    --interpreter node \
    --env production \
    --max-memory-restart 500M \
    --log "${APP_DIR}/logs/backend.log" \
    --error "${APP_DIR}/logs/backend-error.log"

# Sauvegarder la config PM2 pour redémarrage auto
mkdir -p "${APP_DIR}/logs"
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true

echo ""
echo "======================================"
echo "✅ DÉPLOIEMENT TERMINÉ !"
echo ""
echo "🌍 Application accessible : http://193.168.173.181"
echo "🔌 API backend           : http://193.168.173.181/api"
echo ""
echo "📋 Commandes utiles :"
echo "  pm2 logs fleet-backend     → voir les logs"
echo "  pm2 status                  → état du service"
echo "  pm2 restart fleet-backend  → redémarrer"
echo "======================================"

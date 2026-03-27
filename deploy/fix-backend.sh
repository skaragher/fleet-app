#!/bin/bash
# =============================================================
# Script de RÉPARATION - À exécuter sur le serveur en root
# Résout les problèmes les plus courants
# =============================================================
set -e

APP_DIR="/var/www/fleet-app"
BACKEND_DIR="${APP_DIR}/backend"

echo "======================================"
echo "  Fleet App - Réparation backend"
echo "======================================"

# ─────────────────────────────────────────
# 1. Vérifier le .env
# ─────────────────────────────────────────
echo ""
echo "⚙️  [1] Vérification .env..."
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    echo "❌ .env manquant - copie depuis .env.production..."
    cp "${APP_DIR}/deploy/.env.production" "${BACKEND_DIR}/.env"
    echo "✅ .env copié"
else
    echo "✅ .env présent"
fi

# ─────────────────────────────────────────
# 2. S'assurer que PostgreSQL tourne
# ─────────────────────────────────────────
echo ""
echo "🐘 [2] PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Re-créer l'utilisateur et la base si nécessaire
DB_USER="fleet_user"
DB_PASS='Fleet@2026!'
DB_NAME="fleet_db"

sudo -u postgres psql -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || echo "  (base déjà existante)"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null || true
echo "✅ PostgreSQL OK"

# ─────────────────────────────────────────
# 3. Installer les dépendances Node.js
# ─────────────────────────────────────────
echo ""
echo "📦 [3] Dépendances Node.js..."
cd "${BACKEND_DIR}"
npm install --omit=dev
echo "✅ npm install OK"

# ─────────────────────────────────────────
# 4. Prisma generate + migrate
# ─────────────────────────────────────────
echo ""
echo "🔄 [4] Prisma generate & migrate..."
cd "${BACKEND_DIR}"
npx prisma generate
npx prisma migrate deploy
echo "✅ Prisma OK"

# ─────────────────────────────────────────
# 5. Créer les dossiers uploads
# ─────────────────────────────────────────
echo ""
echo "📁 [5] Dossiers uploads..."
mkdir -p "${BACKEND_DIR}/uploads/avatars"
mkdir -p "${BACKEND_DIR}/uploads/company-logos"
chmod -R 755 "${BACKEND_DIR}/uploads"
echo "✅ Uploads OK"

# ─────────────────────────────────────────
# 6. Redémarrer le backend avec PM2
# ─────────────────────────────────────────
echo ""
echo "🚀 [6] Redémarrage PM2..."
cd "${BACKEND_DIR}"
pm2 delete fleet-backend 2>/dev/null || true
mkdir -p "${APP_DIR}/logs"

pm2 start src/server.js \
    --name "fleet-backend" \
    --env production \
    --max-memory-restart 500M \
    --output "${APP_DIR}/logs/backend.log" \
    --error "${APP_DIR}/logs/backend-error.log"

pm2 save
echo "✅ PM2 démarré"

# ─────────────────────────────────────────
# 7. Reconfigurer Nginx
# ─────────────────────────────────────────
echo ""
echo "🌐 [7] Nginx..."
cp "${APP_DIR}/deploy/nginx-fleet.conf" /etc/nginx/sites-available/fleet-app 2>/dev/null || true
ln -sf /etc/nginx/sites-available/fleet-app /etc/nginx/sites-enabled/fleet-app
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
echo "✅ Nginx OK"

# ─────────────────────────────────────────
# 8. Ouvrir le firewall si actif
# ─────────────────────────────────────────
echo ""
echo "🔥 [8] Firewall..."
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
    ufw allow 22/tcp   2>/dev/null || true
    ufw allow 80/tcp   2>/dev/null || true
    ufw allow 443/tcp  2>/dev/null || true
    ufw allow 3000/tcp 2>/dev/null || true
    echo "✅ Ports 22, 80, 443, 3000 ouverts"
else
    echo "  (firewall inactif - OK)"
fi

# ─────────────────────────────────────────
# 9. Vérification finale
# ─────────────────────────────────────────
echo ""
echo "─── Vérification finale ─────────────"
sleep 3  # Laisser le temps au backend de démarrer

echo "  Test backend direct :"
curl -s http://localhost:3000/health && echo "" || echo "❌ Backend ne répond pas encore"

echo "  Test via Nginx :"
curl -s http://localhost/api/health && echo "" || echo "❌ Nginx ne proxie pas"

echo ""
pm2 status

echo ""
echo "======================================"
echo "✅ RÉPARATION TERMINÉE"
echo "🌍 App : http://193.168.173.181"
echo "======================================"

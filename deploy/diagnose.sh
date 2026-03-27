#!/bin/bash
# =============================================================
# Script de DIAGNOSTIC - À exécuter sur le serveur en root
# =============================================================
echo ""
echo "======================================"
echo "  Fleet App - Diagnostic"
echo "======================================"

APP_DIR="/var/www/fleet-app"

echo ""
echo "─── 1. PM2 Status ───────────────────"
pm2 status 2>/dev/null || echo "❌ PM2 non disponible"

echo ""
echo "─── 2. Logs backend (30 dernières lignes) ───"
pm2 logs fleet-backend --lines 30 --nostream 2>/dev/null || echo "❌ Pas de process fleet-backend"

echo ""
echo "─── 3. Port 3000 ────────────────────"
ss -tlnp | grep 3000 || echo "❌ Rien n'écoute sur le port 3000"

echo ""
echo "─── 4. Nginx Status ─────────────────"
systemctl status nginx --no-pager 2>/dev/null | head -20

echo ""
echo "─── 5. Test backend direct ──────────"
curl -s http://localhost:3000/health 2>/dev/null || echo "❌ Backend ne répond pas sur localhost:3000"

echo ""
echo "─── 6. Test via Nginx ───────────────"
curl -s http://localhost/api/health 2>/dev/null || echo "❌ Nginx ne proxie pas vers le backend"

echo ""
echo "─── 7. Fichier .env ─────────────────"
if [ -f "${APP_DIR}/backend/.env" ]; then
    echo "✅ .env trouvé"
    grep -E "^(NODE_ENV|PORT|DATABASE_URL)" "${APP_DIR}/backend/.env" | sed 's/:.*/: [MASQUÉ]/'
else
    echo "❌ .env MANQUANT dans ${APP_DIR}/backend/"
fi

echo ""
echo "─── 8. PostgreSQL ───────────────────"
systemctl status postgresql --no-pager 2>/dev/null | head -5
sudo -u postgres psql -c "\l" 2>/dev/null | grep fleet || echo "❌ Base 'fleet_db' non trouvée"

echo ""
echo "─── 9. Firewall (ufw) ───────────────"
ufw status 2>/dev/null || echo "ufw non configuré (OK)"

echo ""
echo "─── 10. Fichiers application ─────────"
ls -la "${APP_DIR}/backend/src/server.js" 2>/dev/null || echo "❌ server.js manquant"
ls -la "${APP_DIR}/frontend/index.html" 2>/dev/null || echo "❌ frontend/index.html manquant"

echo ""
echo "======================================"
echo "  Fin du diagnostic"
echo "======================================"

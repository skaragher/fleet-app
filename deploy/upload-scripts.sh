#!/bin/bash
# Upload uniquement les scripts de déploiement (rapide)
SERVER="root@193.168.173.181"
APP_DIR="/var/www/fleet-app"

echo "Envoi des scripts sur le serveur..."
ssh "${SERVER}" "mkdir -p ${APP_DIR}/deploy"
scp deploy/diagnose.sh    "${SERVER}:${APP_DIR}/deploy/"
scp deploy/fix-backend.sh "${SERVER}:${APP_DIR}/deploy/"
scp deploy/nginx-fleet.conf "${SERVER}:${APP_DIR}/deploy/"
scp deploy/.env.production "${SERVER}:${APP_DIR}/backend/.env" 2>/dev/null || \
    echo "  (skip .env - déjà présent ou dossier manquant)"
ssh "${SERVER}" "chmod +x ${APP_DIR}/deploy/*.sh"
echo "✅ Scripts envoyés"
echo ""
echo "Connectez-vous maintenant et lancez le diagnostic :"
echo "  ssh root@193.168.173.181"
echo "  bash ${APP_DIR}/deploy/diagnose.sh"
echo ""
echo "Puis si nécessaire, lancez la réparation :"
echo "  bash ${APP_DIR}/deploy/fix-backend.sh"

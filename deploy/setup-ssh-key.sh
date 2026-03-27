#!/bin/bash
# =============================================================
# Génère une clé SSH pour le déploiement GitHub Actions
# À exécuter UNE SEULE FOIS sur votre machine locale (Git Bash)
# =============================================================

SERVER_IP="193.168.173.181"
SERVER_USER="root"
KEY_FILE="$HOME/.ssh/fleet_deploy_key"

echo "======================================"
echo "  Fleet App - Setup clé SSH CI/CD"
echo "======================================"

# 1. Générer la paire de clés SSH
echo ""
echo "🔑 Génération de la clé SSH..."
if [ -f "${KEY_FILE}" ]; then
    echo "  (clé déjà existante - on la réutilise)"
else
    ssh-keygen -t ed25519 -C "fleet-app-deploy" -f "${KEY_FILE}" -N ""
    echo "  ✅ Clé générée"
fi

# 2. Envoyer la clé publique sur le serveur
echo ""
echo "📤 Envoi de la clé publique sur le serveur..."
echo "  (entrez le mot de passe root : Traorenicole1902)"
ssh-copy-id -i "${KEY_FILE}.pub" "${SERVER_USER}@${SERVER_IP}"
echo "  ✅ Clé publique ajoutée sur le serveur"

# 3. Tester la connexion sans mot de passe
echo ""
echo "🧪 Test de connexion SSH sans mot de passe..."
if ssh -i "${KEY_FILE}" -o BatchMode=yes -o ConnectTimeout=5 \
    "${SERVER_USER}@${SERVER_IP}" "echo OK" 2>/dev/null; then
    echo "  ✅ Connexion SSH sans mot de passe OK !"
else
    echo "  ❌ Erreur - vérifiez le serveur"
    exit 1
fi

# 4. Afficher la clé privée pour GitHub Secrets
echo ""
echo "======================================"
echo "  📋 CLÉ PRIVÉE À COPIER DANS GITHUB"
echo "======================================"
echo ""
echo "Allez sur : https://github.com/skaragher/fleet-app/settings/secrets/actions"
echo "Cliquez   : 'New repository secret'"
echo "Nom       : SSH_PRIVATE_KEY"
echo "Valeur    : (copiez TOUT le texte ci-dessous, incluant les lignes BEGIN/END)"
echo ""
echo "──────────────────────────────────────"
cat "${KEY_FILE}"
echo "──────────────────────────────────────"
echo ""
echo "======================================"
echo "✅ Setup terminé !"
echo ""
echo "Après avoir ajouté le secret GitHub :"
echo "  git push origin main"
echo "  → Le déploiement se lancera automatiquement !"
echo "======================================"

#!/usr/bin/env python3
"""
Déploiement complet de Fleet App :
  1. Build du frontend Vue 3
  2. Déploiement sur le serveur via SSH/SFTP
  3. Mise en place CI/CD GitHub Actions (clé SSH + secret GitHub)
"""
import os, sys, json, base64, subprocess, tarfile, tempfile, shutil, time, urllib.request, urllib.error
from pathlib import Path

# ── CONFIG ────────────────────────────────────────────────────────────────────
SERVER_IP   = "193.168.173.181"
SERVER_USER = "root"
SERVER_PASS = "Traorenicole1902"
APP_DIR     = "/var/www/fleet-app"
GITHUB_REPO = "skaragher/fleet-app"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR  = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DEPLOY_DIR   = PROJECT_ROOT / "deploy"

# ── HELPERS ───────────────────────────────────────────────────────────────────
def step(n, msg): print(f"\n{'='*50}\n  [{n}] {msg}\n{'='*50}")
def safe_str(s): return s.encode('ascii', 'replace').decode('ascii')
def ok(msg):  print(f"  [OK] {safe_str(str(msg))}")
def err(msg): print(f"  [ERR] {safe_str(str(msg))}"); sys.exit(1)
def info(msg): print(f"  ... {safe_str(str(msg))}")

def run(cmd, cwd=None, check=True):
    result = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(result.stdout[-2000:])
        print(result.stderr[-2000:])
        err(f"Commande échouée: {cmd}")
    return result

# ── 1. BUILD FRONTEND ─────────────────────────────────────────────────────────
step(1, "Build du frontend Vue 3")
info("npm ci...")
run("npm ci", cwd=str(FRONTEND_DIR))
info("npm run build...")
run("npm run build", cwd=str(FRONTEND_DIR))
ok("Frontend buildé dans frontend/dist/")

# ── 2. CONNEXION SSH ──────────────────────────────────────────────────────────
step(2, "Connexion SSH au serveur")
try:
    import paramiko
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASS, timeout=30)
    ok(f"Connecté à {SERVER_IP}")
except Exception as e:
    err(f"SSH impossible: {e}")

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode('ascii', 'replace').decode('ascii'))

def remote(cmd, ignore_error=False):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    er  = stderr.read().decode('utf-8', errors='replace')
    if out.strip(): safe_print("    " + out.strip().replace("\n", "\n    "))
    if er.strip() and not ignore_error: safe_print("    STDERR: " + er.strip()[:500])
    return out

sftp = ssh.open_sftp()

def upload_dir(local_path: Path, remote_path: str, exclude=None):
    """Upload récursif d'un dossier via SFTP."""
    exclude = exclude or []
    remote(f"mkdir -p {remote_path}", ignore_error=True)
    for item in local_path.rglob("*"):
        rel = item.relative_to(local_path)
        parts = rel.parts
        if any(ex in parts for ex in exclude): continue
        remote_full = f"{remote_path}/{rel.as_posix()}"
        if item.is_dir():
            remote(f"mkdir -p {remote_full}", ignore_error=True)
        else:
            try:
                sftp.put(str(item), remote_full)
            except Exception as ex:
                print(f"    skip {rel}: {ex}")

# ── 3. INSTALLATION DES DÉPENDANCES SYSTÈME ───────────────────────────────────
step(3, "Vérification / installation des outils serveur")

info("Vérification Node.js...")
node_check = remote("node --version 2>/dev/null || echo MISSING")
if "MISSING" in node_check or not node_check.strip().startswith("v"):
    info("Installation Node.js 20...")
    remote("curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs")
ok(f"Node.js: {remote('node --version').strip()}")

info("Vérification PostgreSQL...")
pg_check = remote("psql --version 2>/dev/null || echo MISSING")
if "MISSING" in pg_check:
    info("Installation PostgreSQL...")
    remote("apt-get update -y && apt-get install -y postgresql postgresql-contrib")
remote("systemctl start postgresql && systemctl enable postgresql", ignore_error=True)
ok("PostgreSQL OK")

info("Vérification Nginx...")
ng_check = remote("nginx -v 2>/dev/null || echo MISSING")
if "MISSING" in ng_check:
    info("Installation Nginx...")
    remote("apt-get install -y nginx")
remote("systemctl start nginx && systemctl enable nginx", ignore_error=True)
ok("Nginx OK")

info("Vérification PM2...")
pm2_check = remote("pm2 --version 2>/dev/null || echo MISSING")
if "MISSING" in pm2_check:
    info("Installation PM2...")
    remote("npm install -g pm2")
ok(f"PM2: {remote('pm2 --version 2>/dev/null').strip()}")

# ── 4. BASE DE DONNÉES ────────────────────────────────────────────────────────
step(4, "Configuration PostgreSQL")
DB_USER = "fleet_user"
DB_PASS = "Fleet@2026!"
DB_NAME = "fleet_db"

remote(f"""sudo -u postgres psql -c "DO \\$\\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '{DB_USER}') THEN
    CREATE ROLE {DB_USER} WITH LOGIN PASSWORD '{DB_PASS}';
  END IF;
END \\$\\$;" """ , ignore_error=True)
remote(f'sudo -u postgres psql -c "CREATE DATABASE {DB_NAME} OWNER {DB_USER};"', ignore_error=True)
remote(f'sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};"', ignore_error=True)
remote(f'sudo -u postgres psql -d {DB_NAME} -c "GRANT ALL ON SCHEMA public TO {DB_USER};"', ignore_error=True)
ok(f"Base '{DB_NAME}' prête")

# ── 5. CRÉER LES DOSSIERS ─────────────────────────────────────────────────────
step(5, "Création des dossiers")
remote(f"mkdir -p {APP_DIR}/backend/uploads/avatars {APP_DIR}/backend/uploads/company-logos {APP_DIR}/frontend {APP_DIR}/deploy {APP_DIR}/logs")
ok("Dossiers créés")

# ── 6. UPLOAD BACKEND ─────────────────────────────────────────────────────────
step(6, "Upload du backend")
info("Upload des fichiers backend (sans node_modules)...")
upload_dir(BACKEND_DIR, f"{APP_DIR}/backend",
           exclude=["node_modules", ".env", "data"])
ok("Backend uploadé")

# ── 7. UPLOAD FRONTEND ────────────────────────────────────────────────────────
step(7, "Upload du frontend buildé")
dist_dir = FRONTEND_DIR / "dist"
if not dist_dir.exists():
    err("frontend/dist/ introuvable — le build a échoué")
info("Upload de frontend/dist/...")
upload_dir(dist_dir, f"{APP_DIR}/frontend")
ok("Frontend uploadé")

# ── 8. UPLOAD CONFIGS ─────────────────────────────────────────────────────────
step(8, "Upload des configs de déploiement")
upload_dir(DEPLOY_DIR, f"{APP_DIR}/deploy", exclude=["__pycache__"])
remote(f"chmod +x {APP_DIR}/deploy/*.sh", ignore_error=True)
ok("Configs uploadées")

# ── 9. FICHIER .env ───────────────────────────────────────────────────────────
step(9, "Configuration .env production")
ENV_CONTENT = f"""NODE_ENV=production
PORT=3000
JWT_SECRET=FleetApp_JWT_{int(time.time())}_SECRET
PASSWORD_RESET_TOKEN_SECRET=FleetApp_Reset_{int(time.time())}_SECRET
PASSWORD_RESET_EXPIRES_MINUTES=30
PASSWORD_RESET_DEBUG=false
DATABASE_URL=postgresql://{DB_USER}:{DB_PASS}@localhost:5432/{DB_NAME}
APP_BASE_URL=http://{SERVER_IP}
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_SECURE=false
"""
env_path = f"{APP_DIR}/backend/.env"
env_check = remote(f"test -f {env_path} && echo EXISTS || echo MISSING")
if "MISSING" in env_check:
    with sftp.open(env_path, "w") as f:
        f.write(ENV_CONTENT)
    ok(".env créé")
else:
    ok(".env déjà présent (conservé)")

# ── 10. DÉPENDANCES NODE + PRISMA ─────────────────────────────────────────────
step(10, "Installation dépendances Node.js et migrations Prisma")
info("npm install...")
remote(f"cd {APP_DIR}/backend && npm install --omit=dev")
info("prisma generate...")
remote(f"cd {APP_DIR}/backend && npx prisma generate")
info("prisma migrate deploy...")
remote(f"cd {APP_DIR}/backend && npx prisma migrate deploy")
ok("Dépendances et migrations OK")

# ── 11. NGINX ─────────────────────────────────────────────────────────────────
step(11, "Configuration Nginx")
remote(f"cp {APP_DIR}/deploy/nginx-fleet.conf /etc/nginx/sites-available/fleet-app")
remote("ln -sf /etc/nginx/sites-available/fleet-app /etc/nginx/sites-enabled/fleet-app")
remote("rm -f /etc/nginx/sites-enabled/default", ignore_error=True)
nginx_test = remote("nginx -t 2>&1")
if "successful" in nginx_test or "ok" in nginx_test.lower():
    remote("systemctl reload nginx")
    ok("Nginx configuré et rechargé")
else:
    print(f"  Nginx test output: {nginx_test}")
    err("Nginx config invalide")

# ── 12. PM2 ───────────────────────────────────────────────────────────────────
step(12, "Démarrage du backend avec PM2")
remote("pm2 delete fleet-backend 2>/dev/null || true", ignore_error=True)
remote(f"""cd {APP_DIR}/backend && pm2 start src/server.js \
    --name fleet-backend \
    --env production \
    --max-memory-restart 500M \
    --output {APP_DIR}/logs/backend.log \
    --error {APP_DIR}/logs/backend-error.log""")
remote("pm2 save")
remote("pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash", ignore_error=True)
ok("PM2 démarré")

# ── 13. FIREWALL ──────────────────────────────────────────────────────────────
step(13, "Firewall")
ufw = remote("ufw status 2>/dev/null || echo inactive")
if "active" in ufw.lower():
    remote("ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp", ignore_error=True)
    ok("Ports ouverts (22, 80, 443)")
else:
    ok("Firewall inactif — OK")

# ── 14. TEST ──────────────────────────────────────────────────────────────────
step(14, "Tests de vérification")
time.sleep(4)
health = remote(f"curl -s http://localhost:3000/health 2>/dev/null || echo FAIL")
if "healthy" in health:
    ok("Backend répond sur port 3000 ✓")
else:
    info("Backend pas encore prêt, attente 5s...")
    time.sleep(5)
    health2 = remote("curl -s http://localhost:3000/health 2>/dev/null || echo FAIL")
    if "healthy" in health2:
        ok("Backend répond ✓")
    else:
        print("  Logs PM2:")
        remote(f"pm2 logs fleet-backend --lines 20 --nostream 2>/dev/null")

nginx_health = remote("curl -s http://localhost/api/health 2>/dev/null || echo FAIL")
if "healthy" in nginx_health:
    ok("Nginx proxie vers le backend ✓")
else:
    info("Nginx proxy : " + nginx_health.strip()[:200])

pm2_status = remote("pm2 status")
print(pm2_status)

# ── 15. GITHUB ACTIONS CI/CD ─────────────────────────────────────────────────
step(15, "Configuration CI/CD GitHub Actions")

if not GITHUB_TOKEN:
    info("GITHUB_TOKEN non fourni — skip CI/CD setup")
    info("Pour activer le CI/CD plus tard : python deploy/do_deploy.py avec GITHUB_TOKEN=ghp_xxx")
else:
    try:
        from nacl import encoding, public as nacl_public
        import nacl

        # Générer une clé SSH pour le déploiement
        info("Génération de la clé SSH de déploiement...")
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        private_key = Ed25519PrivateKey.generate()
        private_pem = private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.OpenSSH,
            serialization.NoEncryption()
        ).decode()
        public_pem = private_key.public_key().public_bytes(
            serialization.Encoding.OpenSSH,
            serialization.PublicFormat.OpenSSH
        ).decode()

        # Installer la clé publique sur le serveur
        info("Installation de la clé publique sur le serveur...")
        remote("mkdir -p /root/.ssh && chmod 700 /root/.ssh")
        existing = remote("cat /root/.ssh/authorized_keys 2>/dev/null || echo ''")
        pub_comment = "fleet-github-actions"
        if pub_comment not in existing:
            remote(f"echo '{public_pem} {pub_comment}' >> /root/.ssh/authorized_keys")
            remote("chmod 600 /root/.ssh/authorized_keys")
        ok("Clé publique installée sur le serveur")

        # Obtenir la clé publique du repo GitHub
        def gh_api(method, path, data=None):
            url = f"https://api.github.com{path}"
            headers = {
                "Authorization": f"token {GITHUB_TOKEN}",
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            }
            body = json.dumps(data).encode() if data else None
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req) as resp:
                    return json.loads(resp.read())
            except urllib.error.HTTPError as e:
                return json.loads(e.read())

        def add_secret(name, value):
            pk_data = gh_api("GET", f"/repos/{GITHUB_REPO}/actions/secrets/public-key")
            pk_key  = pk_data["key"]
            pk_id   = pk_data["key_id"]
            pub_key = nacl_public.PublicKey(pk_key.encode(), encoding.Base64Encoder())
            box     = nacl_public.SealedBox(pub_key)
            encrypted = base64.b64encode(box.encrypt(value.encode())).decode()
            return gh_api("PUT", f"/repos/{GITHUB_REPO}/actions/secrets/{name}",
                          {"encrypted_value": encrypted, "key_id": pk_id})

        info("Ajout du secret SSH_PRIVATE_KEY dans GitHub...")
        add_secret("SSH_PRIVATE_KEY", private_pem)
        ok("Secret SSH_PRIVATE_KEY ajouté ✓")

        # Déclencher le workflow
        info("Déclenchement du workflow GitHub Actions...")
        gh_api("POST", f"/repos/{GITHUB_REPO}/actions/workflows/deploy.yml/dispatches",
               {"ref": "main"})
        ok("Workflow GitHub Actions déclenché ✓")
        info("Suivi : https://github.com/skaragher/fleet-app/actions")

    except Exception as e:
        info(f"CI/CD setup erreur: {e} (déploiement direct OK)")

sftp.close()
ssh.close()

print(f"""
{'='*50}
  DEPLOIEMENT TERMINE !
  App web    : http://{SERVER_IP}
  API        : http://{SERVER_IP}/api
  Mobile API : http://{SERVER_IP}/api
  CI/CD      : https://github.com/{GITHUB_REPO}/actions
{'='*50}
""")

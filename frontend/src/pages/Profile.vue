<template>
  <div class="profile">
    <!-- Header -->
    <header class="page-header">
      <div>
        <h1>Profil</h1>
        <p class="text-muted">Gérez vos informations personnelles et votre compte</p>
      </div>
    </header>

    <!-- Grille principale -->
    <div class="profile-grid">
      <!-- Colonne de gauche - Informations -->
      <div class="profile-sidebar">
        <!-- Carte avatar -->
        <div class="card">
          <div class="avatar-container">
            <div class="avatar-wrapper">
              <img 
                :src="avatarToShow"
                :alt="`Avatar de ${auth.user?.name}`"
                class="avatar"
                @error="onImageError"
                @load="onImageLoad"
              />
              <div class="avatar-overlay">
                <label for="avatarInput" class="avatar-upload">
                  <span class="upload-icon">📷</span>
                </label>
              </div>
            </div>
            <input 
              id="avatarInput" 
              type="file" 
              accept="image/png,image/jpeg,image/webp,image/gif,image/jpg" 
              @change="onAvatarSelected" 
              class="hidden-input"
            />
            <p v-if="pendingAvatarName" class="avatar-selected">
              Fichier sélectionné: {{ pendingAvatarName }}
            </p>
            <button
              v-if="pendingAvatarBase64"
              type="button"
              class="btn btn-primary btn-avatar-update"
              :disabled="avatarUploading"
              @click="updateAvatar"
            >
              <span v-if="avatarUploading" class="spinner"></span>
              {{ avatarUploading ? "Mise à jour..." : "Mettre à jour l'avatar" }}
            </button>
            <p v-if="avatarLoadError" class="avatar-error">
              ⚠️ Erreur de chargement: {{ avatarLoadError }}
            </p>
            <p v-else class="avatar-hint">PNG, JPG ou WEBP • Max 2Mo</p>
          </div>

          <div class="info-list">
            <div class="info-item">
              <span class="info-label">Rôle</span>
              <span class="info-value">
                <span class="role-badge">{{ roleLabel(auth.user?.role) }}</span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">{{ auth.user?.email || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Véhicule</span>
              <span class="info-value">{{ auth.user?.assignedVehicle?.plate || 'Non assigné' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Station</span>
              <span class="info-value">{{ auth.user?.assignedStation?.name || 'Non assignée' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Colonne de droite - Formulaire -->
      <div class="profile-main">
        <div class="card">
          <h2 class="card-title">Modifier le profil</h2>
          
          <form @submit.prevent="submitProfile" class="form">
            <!-- Informations de base -->
            <div class="form-section">
              <h3 class="section-title">Informations de base</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="name">Nom complet</label>
                  <input 
                    id="name"
                    v-model.trim="form.name" 
                    type="text" 
                    required 
                    placeholder="Votre nom"
                  />
                </div>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input 
                    id="email"
                    v-model.trim="form.email" 
                    type="email" 
                    required 
                    placeholder="votre@email.com"
                  />
                </div>
              </div>
            </div>

            <!-- Séparateur -->
            <hr class="divider" />

            <!-- Changement de mot de passe -->
            <div class="form-section">
              <h3 class="section-title">Changer le mot de passe</h3>
              <p class="section-hint">Laissez vide si vous ne souhaitez pas changer</p>

              <div class="form-group">
                <label for="currentPassword">Mot de passe actuel</label>
                <input 
                  id="currentPassword"
                  v-model="form.currentPassword" 
                  type="password" 
                  placeholder="••••••••"
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="newPassword">Nouveau mot de passe</label>
                  <input 
                    id="newPassword"
                    v-model="form.newPassword" 
                    type="password" 
                    placeholder="••••••••"
                  />
                </div>
                <div class="form-group">
                  <label for="confirmPassword">Confirmer</label>
                  <input 
                    id="confirmPassword"
                    v-model="form.confirmPassword" 
                    type="password" 
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <!-- Règles de mot de passe -->
              <div v-if="form.newPassword" class="password-rules">
                <div class="rule" :class="{ valid: passwordChecks.length }">
                  <span class="rule-icon">{{ passwordChecks.length ? '✓' : '○' }}</span>
                  <span>8 caractères minimum</span>
                </div>
                <div class="rule" :class="{ valid: passwordChecks.upper }">
                  <span class="rule-icon">{{ passwordChecks.upper ? '✓' : '○' }}</span>
                  <span>Une majuscule</span>
                </div>
                <div class="rule" :class="{ valid: passwordChecks.lower }">
                  <span class="rule-icon">{{ passwordChecks.lower ? '✓' : '○' }}</span>
                  <span>Une minuscule</span>
                </div>
                <div class="rule" :class="{ valid: passwordChecks.number }">
                  <span class="rule-icon">{{ passwordChecks.number ? '✓' : '○' }}</span>
                  <span>Un chiffre</span>
                </div>
                <div class="rule" :class="{ valid: passwordChecks.special }">
                  <span class="rule-icon">{{ passwordChecks.special ? '✓' : '○' }}</span>
                  <span>Un caractère spécial</span>
                </div>
              </div>
            </div>

            <!-- Messages -->
            <div v-if="error" class="alert error">{{ error }}</div>
            <div v-if="success" class="alert success">{{ success }}</div>

            <!-- Bouton de soumission -->
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner"></span>
                {{ saving ? 'Enregistrement...' : 'Enregistrer les modifications' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Historique des connexions -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Historique des connexions</h2>
            <button class="btn btn-icon" @click="loadLoginHistory" :disabled="loadingHistory">
              <span class="btn-icon">↻</span>
            </button>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>IP</th>
                  <th>Appareil</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in loginHistory" :key="row.id">
                  <td>{{ formatDateTime(row.createdAt) }}</td>
                  <td>
                    <span :class="['badge', row.success ? 'badge-success' : 'badge-error']">
                      {{ row.success ? 'Succès' : 'Échec' }}
                    </span>
                  </td>
                  <td>{{ row.ipAddress || '-' }}</td>
                  <td class="user-agent">{{ row.userAgent || '-' }}</td>
                </tr>
                <tr v-if="!loginHistory.length">
                  <td colspan="4" class="empty">Aucune connexion enregistrée</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useAuthStore } from "../stores/auth";
import api from "../services/api";

const auth = useAuthStore();
const saving = ref(false);
const loadingHistory = ref(false);
const error = ref("");
const success = ref("");
const loginHistory = ref([]);
const avatarLoadError = ref("");
const avatarUploading = ref(false);
const pendingAvatarBase64 = ref("");
const pendingAvatarName = ref("");

const form = reactive({
  name: auth.user?.name || "",
  email: auth.user?.email || "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

// Obtenir l'URL de base de l'API
const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  // Enlever '/api' à la fin si présent
  const baseUrl = apiUrl.replace(/\/api\/?$/, "");
  console.log('API Base URL:', baseUrl);
  return baseUrl;
};

// Construire l'URL complète de l'avatar
const fullAvatarUrl = computed(() => {
  const avatarUrl = auth.user?.avatarUrl;
  
  if (!avatarUrl) {
    console.log('Pas d\'URL d\'avatar');
    return null;
  }

  console.log('URL avatar brute:', avatarUrl);

  // Si c'est déjà une URL complète
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    console.log('URL absolue détectée:', avatarUrl);
    return avatarUrl;
  }

  // Si c'est une data URL
  if (avatarUrl.startsWith('data:')) {
    console.log('Data URL détectée');
    return avatarUrl;
  }

  // Compatibilité: anciennes URLs /uploads/avatars/*
  if (avatarUrl.startsWith('/uploads/avatars/') || avatarUrl.startsWith('uploads/avatars/')) {
    const filename = avatarUrl.split('/').pop();
    if (filename) {
      const baseUrl = getApiBaseUrl();
      const migratedUrl = `${baseUrl}/api/auth/avatar/${filename}`;
      console.log('URL avatar migrée:', migratedUrl);
      return migratedUrl;
    }
  }

  // Construire l'URL complète
  const baseUrl = getApiBaseUrl();
  
  // S'assurer que le chemin commence par un slash
  const path = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
  const fullUrl = `${baseUrl}${path}`;
  
  console.log('URL construite:', fullUrl);
  return fullUrl;
});

// Générer un avatar par défaut avec les initiales
const generateInitialsAvatar = () => {
  const name = auth.user?.name || "User";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  const bgColor = colors[Math.floor(Math.random() * colors.length)];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          font-family="system-ui, -apple-system, sans-serif" font-size="48" fill="white" font-weight="500">
      ${initials}
    </text>
  </svg>`;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// URL à afficher
const avatarToShow = computed(() => {
  if (pendingAvatarBase64.value) {
    return pendingAvatarBase64.value;
  }
  // Toujours essayer de charger l'avatar réel d'abord
  if (fullAvatarUrl.value) {
    return fullAvatarUrl.value;
  }
  // Fallback sur l'avatar par défaut
  return generateInitialsAvatar();
});

const onImageLoad = () => {
  console.log('✅ Avatar chargé avec succès');
  avatarLoadError.value = "";
};

const onImageError = (e) => {
  console.error('❌ Erreur de chargement de l\'avatar:', e);
  console.log('URL qui a échoué:', fullAvatarUrl.value);
  
  // Afficher un message d'erreur plus détaillé
  avatarLoadError.value = `Impossible de charger l'image (${fullAvatarUrl.value || 'URL vide'})`;
  
  // Option: forcer le rechargement avec l'avatar par défaut après un délai
  setTimeout(() => {
    if (avatarLoadError.value) {
      console.log('Forçage de l\'avatar par défaut');
      // On ne fait rien ici car avatarToShow retournera déjà l'avatar par défaut
      // si fullAvatarUrl est null, mais on peut forcer un re-render
    }
  }, 2000);
};

const passwordChecks = computed(() => {
  const pwd = form.newPassword || "";
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
});

const passwordStrong = computed(() => Object.values(passwordChecks.value).every(Boolean));

watch(
  () => auth.user,
  (nextUser) => {
    console.log('User updated:', nextUser);
    form.name = nextUser?.name || "";
    form.email = nextUser?.email || "";
    avatarLoadError.value = "";
  },
  { deep: true, immediate: true }
);

const roleLabel = (role) => {
  const labels = {
    SUPER_ADMIN: "Super Admin",
    FLEET_MANAGER: "Gestionnaire Flotte",
    FUEL_MANAGER: "Gestionnaire Carburant",
    STATION_MANAGER: "Gestionnaire Station",
    VEHICLE_MANAGER: "Gestionnaire Véhicule",
    DRIVER: "Chauffeur",
    VIEWER: "Observateur",
  };
  return labels[role] || role || "-";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const loadLoginHistory = async () => {
  loadingHistory.value = true;
  try {
    const response = await api.get("/auth/me/login-history", { params: { limit: 30 } });
    loginHistory.value = response?.data?.items || [];
  } catch (e) {
    console.error('Erreur chargement historique:', e);
    loginHistory.value = [];
  } finally {
    loadingHistory.value = false;
  }
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      console.log('Fichier lu avec succès');
      resolve(String(reader.result || ""));
    };
    reader.onerror = (e) => {
      console.error('Erreur lecture fichier:', e);
      reject(new Error("Lecture fichier impossible"));
    };
    reader.readAsDataURL(file);
  });

const onAvatarSelected = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;

  console.log('Fichier sélectionné:', file.name, file.size, file.type);

  error.value = "";
  success.value = "";
  avatarLoadError.value = "";

  if (file.size > 2 * 1024 * 1024) {
    error.value = "L'avatar ne doit pas dépasser 2Mo";
    event.target.value = "";
    return;
  }

  avatarUploading.value = true;
  try {
    const avatarBase64 = await readFileAsDataUrl(file);
    pendingAvatarBase64.value = avatarBase64;
    pendingAvatarName.value = file.name;
    success.value = "Image prête. Cliquez sur 'Mettre à jour l'avatar'.";
  } catch (e) {
    console.error('Erreur upload avatar:', e);
    console.error('Détails:', e.response?.data);
    error.value = e?.response?.data?.message || "Erreur lors du téléversement";
  } finally {
    avatarUploading.value = false;
    event.target.value = "";
  }
};

const updateAvatar = async () => {
  if (!pendingAvatarBase64.value) return;

  error.value = "";
  success.value = "";
  avatarUploading.value = true;

  try {
    const response = await api.post("/auth/me/avatar", { avatarBase64: pendingAvatarBase64.value });
    const data = response?.data || {};

    if (data?.user && data?.token) {
      auth.setAuth(data.token, data.user);
      success.value = "Avatar mis à jour avec succès";
      pendingAvatarBase64.value = "";
      pendingAvatarName.value = "";
      avatarLoadError.value = "";
    } else {
      error.value = "Erreur lors de la mise à jour";
    }
  } catch (e) {
    error.value = e?.response?.data?.message || "Erreur lors du téléversement";
  } finally {
    avatarUploading.value = false;
  }
};

const submitProfile = async () => {
  error.value = "";
  success.value = "";

  if (!form.name || !form.email) {
    error.value = "Le nom et l'email sont obligatoires";
    return;
  }

  if (form.newPassword || form.confirmPassword || form.currentPassword) {
    if (!form.currentPassword) {
      error.value = "Le mot de passe actuel est requis";
      return;
    }

    if (!form.newPassword) {
      error.value = "Veuillez saisir le nouveau mot de passe";
      return;
    }

    if (!passwordStrong.value) {
      error.value = "Le mot de passe ne respecte pas les règles de sécurité";
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      error.value = "Les mots de passe ne correspondent pas";
      return;
    }
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      email: form.email,
    };

    if (form.newPassword) {
      payload.currentPassword = form.currentPassword;
      payload.newPassword = form.newPassword;
    }

    console.log('Mise à jour profil:', payload);
    const result = await auth.updateProfile(payload);
    console.log('Résultat mise à jour:', result);

    if (!result.success) {
      error.value = result.error || "Erreur lors de la mise à jour";
      return;
    }

    success.value = result.message || "Profil mis à jour avec succès";
    form.currentPassword = "";
    form.newPassword = "";
    form.confirmPassword = "";
    await loadLoginHistory();
  } catch (e) {
    console.error('Erreur mise à jour profil:', e);
    error.value = "Erreur lors de la mise à jour";
  } finally {
    saving.value = false;
  }
};

// Pour déboguer, afficher l'état de l'utilisateur au montage
onMounted(() => {
  console.log('Auth user au montage:', auth.user);
  console.log('Avatar URL:', auth.user?.avatarUrl);
  loadLoginHistory();
});

// Surveiller les changements dans auth.user
watch(() => auth.user, (newUser) => {
  console.log('Auth user changé:', newUser);
  console.log('Nouvelle URL avatar:', newUser?.avatarUrl);
}, { deep: true, immediate: true });
</script>

<style scoped>
.profile {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  background: #f8fafc;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px;
}

.text-muted {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

/* Grille */
.profile-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

/* Cartes */
.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.card:last-child {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

/* Avatar */
.avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.avatar-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 12px;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.avatar-upload {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.upload-icon {
  font-size: 20px;
}

.avatar-hint {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.avatar-selected {
  margin: 8px 0 0;
  font-size: 12px;
  color: #334155;
  font-weight: 600;
}

.btn-avatar-update {
  margin-top: 8px;
}

.avatar-error {
  font-size: 12px;
  color: #dc2626;
  margin: 8px 0 0;
  padding: 8px 12px;
  background: #fee2e2;
  border-radius: 6px;
  border: 1px solid #fecaca;
  max-width: 200px;
  word-break: break-word;
}

.debug-info {
  position: absolute;
  top: -40px;
  left: 0;
  right: 0;
  background: #1e293b;
  color: white;
  font-size: 10px;
  padding: 4px;
  border-radius: 4px;
  word-break: break-word;
  z-index: 10;
}

.hidden-input {
  display: none;
}

/* Liste d'informations */
.info-list {
  border-top: 1px solid #f1f5f9;
  padding-top: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: #64748b;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
}

.role-badge {
  background: #eef2ff;
  color: #4f46e5;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

/* Formulaire */
.form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px;
}

.section-hint {
  font-size: 13px;
  color: #64748b;
  margin: -8px 0 8px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}

.form-group input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input::placeholder {
  color: #94a3b8;
}

.divider {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 8px 0;
}

/* Règles de mot de passe */
.password-rules {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.rule {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #b91c1c;
}

.rule.valid {
  color: #16a34a;
}

.rule-icon {
  font-size: 14px;
  font-weight: 600;
}

/* Alertes */
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
}

.alert.error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.alert.success {
  background: #dcfce7;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

/* Boutons */
.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.btn-icon:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

.form-actions {
  margin-top: 8px;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Tableau */
.table-container {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

th {
  text-align: left;
  padding: 14px 16px;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

td {
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  color: #334155;
}

tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: #f8fafc;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.badge-success {
  background: #dcfce7;
  color: #16a34a;
}

.badge-error {
  background: #fee2e2;
  color: #dc2626;
}

.user-agent {
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #64748b;
  font-size: 13px;
}

.empty {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
  font-style: italic;
}

/* Responsive */
@media (max-width: 1024px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    max-width: 400px;
    margin: 0 auto;
  }
}

@media (max-width: 768px) {
  .profile {
    padding: 16px;
  }

  .page-header h1 {
    font-size: 24px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .password-rules {
    grid-template-columns: 1fr;
  }

  .user-agent {
    max-width: 200px;
  }
}

@media (max-width: 480px) {
  .profile-sidebar {
    max-width: 100%;
  }

  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .info-value {
    text-align: left;
  }

  .user-agent {
    max-width: 150px;
  }
}
</style>

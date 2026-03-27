<template>
  <div class="settings">
    <!-- Header -->
    <header class="settings-header">
      <div>
        <h1>Paramètres entreprise</h1>
        <p class="settings-subtitle">Personnalisez l'identité visuelle et les informations de votre entreprise</p>
      </div>
      <div class="settings-actions">
        <button class="btn btn-outline" @click="previewSettings" :disabled="!hasChanges">
          <span>👁️</span>
          Aperçu
        </button>
      </div>
    </header>

    <!-- Message de notification -->
    <transition name="fade">
      <div v-if="message" :class="['notification', `notification-${messageType}`]">
        <span>{{ message }}</span>
        <button class="notification-close" @click="message = ''">×</button>
      </div>
    </transition>

    <!-- Grille principale -->
    <div class="settings-grid">
      <!-- Colonne Aperçu -->
      <div class="settings-preview">
        <div class="preview-card">
          <h3 class="preview-title">Aperçu en direct</h3>
          
          <div class="preview-container">
            <!-- Topbar -->
            <div class="preview-topbar" :style="{ backgroundColor: colors.primary }">
              <div class="preview-brand">
                <img 
                  v-if="logoPreview" 
                  :src="logoPreview" 
                  :alt="form.name"
                  class="preview-logo"
                  @error="logoError = true"
                />
                <span v-else class="preview-name">{{ form.name || 'FLEETENERGY' }}</span>
              </div>
              <div class="preview-user">
                <span class="preview-avatar">👤</span>
              </div>
            </div>

            <!-- Contenu simulé -->
            <div class="preview-content">
              <div class="preview-stats">
                <div class="preview-stat"></div>
                <div class="preview-stat"></div>
                <div class="preview-stat"></div>
              </div>
            </div>

            <!-- Footer -->
            <div class="preview-footer" :style="{ backgroundColor: colors.secondary }">
              <div class="preview-footer-content">
                <div>© {{ currentYear }} {{ form.name || 'FLEETENERGY' }}</div>
                <div v-if="form.footerNote" class="preview-note">{{ form.footerNote }}</div>
                <div class="preview-contacts">
                  <span v-if="form.email">{{ form.email }}</span>
                  <span v-if="form.phone">{{ form.phone }}</span>
                </div>
              </div>
            </div>
          </div>

          <p class="preview-hint">Les modifications sont visibles en temps réel</p>
        </div>
      </div>

      <!-- Colonne Formulaire -->
      <div class="settings-form">
        <form @submit.prevent="saveSettings" class="form-card">
          <!-- Section Identité -->
          <div class="form-section">
            <h3 class="form-section-title">Identité</h3>
            
            <div class="form-group">
              <label for="name">Nom de l'entreprise <span class="required">*</span></label>
              <input 
                id="name"
                v-model="form.name" 
                type="text" 
                placeholder="FLEETENERGY"
                :class="{ 'error': errors.name }"
                @input="validateField('name')"
              />
              <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
            </div>

            <div class="form-group">
              <label for="tagline">Slogan</label>
              <input 
                id="tagline"
                v-model="form.tagline" 
                type="text" 
                placeholder="Gestion de flotte et énergie"
              />
            </div>

            <div class="form-group">
              <label for="logo">Logo</label>
              <div class="logo-upload">
                <input 
                  id="logo"
                  v-model="form.logoUrl" 
                  type="text" 
                  placeholder="URL du logo"
                />
                <button 
                  v-if="form.logoUrl" 
                  type="button" 
                  class="btn-icon"
                  @click="form.logoUrl = ''"
                >
                  ✕
                </button>
              </div>
              <div class="logo-upload-actions">
                <input id="logoFile" type="file" accept="image/*" @change="onLogoFileChange" />
                <button
                  type="button"
                  class="btn btn-outline"
                  :disabled="uploadingLogo || !selectedLogoFile"
                  @click="uploadCompanyLogo"
                >
                  {{ uploadingLogo ? "Téléchargement..." : "Télécharger le logo" }}
                </button>
              </div>
              <span class="field-hint">Laissez vide pour utiliser le nom</span>
            </div>
          </div>

          <!-- Section Contact -->
          <div class="form-section">
            <h3 class="form-section-title">Contact</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label for="email">Email</label>
                <input 
                  id="email"
                  v-model="form.email" 
                  type="email" 
                  placeholder="contact@entreprise.com"
                  :class="{ 'error': errors.email }"
                  @input="validateField('email')"
                />
                <span v-if="errors.email" class="error-message">{{ errors.email }}</span>
              </div>

              <div class="form-group">
                <label for="phone">Téléphone</label>
                <input 
                  id="phone"
                  v-model="form.phone" 
                  type="tel" 
                  placeholder="+225 00 00 00 00"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="address">Adresse</label>
              <input 
                id="address"
                v-model="form.address" 
                type="text" 
                placeholder="Ville, rue, numéro..."
              />
            </div>
          </div>

          <!-- Section Apparence -->
          <div class="form-section">
            <h3 class="form-section-title">Apparence</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label for="primaryColor">Couleur principale</label>
                <div class="color-picker">
                  <input 
                    id="primaryColor"
                    v-model="colors.primary" 
                    type="color" 
                  />
                  <input 
                    v-model="colors.primary" 
                    type="text" 
                    placeholder="#2563eb"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="secondaryColor">Couleur secondaire</label>
                <div class="color-picker">
                  <input 
                    id="secondaryColor"
                    v-model="colors.secondary" 
                    type="color" 
                  />
                  <input 
                    v-model="colors.secondary" 
                    type="text" 
                    placeholder="#1e293b"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Section Footer -->
          <div class="form-section">
            <h3 class="form-section-title">Pied de page</h3>
            
            <div class="form-group">
              <label for="footerNote">Mention légale</label>
              <input 
                id="footerNote"
                v-model="form.footerNote" 
                type="text" 
                placeholder="Tous droits réservés"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="resetForm" :disabled="!hasChanges">
              Annuler
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving || !isValid">
              <span v-if="saving" class="spinner"></span>
              {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Aperçu -->
    <transition name="modal">
      <div v-if="showPreview" class="modal-overlay" @click.self="showPreview = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Aperçu des modifications</h3>
            <button class="modal-close" @click="showPreview = false">×</button>
          </div>
          <div class="modal-body">
            <div class="full-preview">
              <div class="full-topbar" :style="{ backgroundColor: colors.primary }">
                <span class="full-brand">{{ form.name || 'FLEETENERGY' }}</span>
                <span class="full-user">Admin</span>
              </div>
              <div class="full-main">
                <p>Contenu de l'application...</p>
              </div>
              <div class="full-footer" :style="{ backgroundColor: colors.secondary }">
                <div>© {{ currentYear }} {{ form.name || 'FLEETENERGY' }}</div>
                <div>{{ form.footerNote || 'Tous droits réservés' }}</div>
                <div class="full-contacts">
                  <span>{{ form.email || 'contact@fleetenergy.com' }}</span>
                  <span>{{ form.phone || '+225 00 00 00 00' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="showPreview = false">Fermer</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from "vue";
import { useCompanyStore } from "../stores/company";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const company = useCompanyStore();
const auth = useAuthStore();
const router = useRouter();

// États
const saving = ref(false);
const message = ref("");
const messageType = ref("success");
const showPreview = ref(false);
const logoError = ref(false);
const selectedLogoFile = ref(null);
const uploadingLogo = ref(false);
const errors = reactive({});

// Formulaire
const form = reactive({
  name: "",
  tagline: "",
  logoUrl: "",
  email: "",
  phone: "",
  address: "",
  footerNote: ""
});

// Couleurs
const colors = reactive({
  primary: "#2563eb",
  secondary: "#1e293b"
});

// Année courante
const currentYear = computed(() => new Date().getFullYear());

// Validation
const isValid = computed(() => {
  return form.name && form.name.length >= 2 && !errors.email;
});

const hasChanges = computed(() => {
  return form.name !== company.settings.name ||
         form.tagline !== company.settings.tagline ||
         form.logoUrl !== company.settings.logoUrl ||
         form.email !== company.settings.email ||
         form.phone !== company.settings.phone ||
         form.address !== company.settings.address ||
         form.footerNote !== company.settings.footerNote ||
         colors.primary !== company.settings.colors?.primary ||
         colors.secondary !== company.settings.colors?.secondary;
});

// URL du logo pour l'aperçu
const logoPreview = computed(() => {
  if (!form.logoUrl || logoError.value) return null;
  if (form.logoUrl.startsWith('http')) return form.logoUrl;
  return form.logoUrl.startsWith('/') ? form.logoUrl : `/${form.logoUrl}`;
});

// Validation des champs
const validateField = (field) => {
  delete errors[field];
  
  if (field === 'name' && form.name && form.name.length < 2) {
    errors.name = "Minimum 2 caractères";
  }
  
  if (field === 'email' && form.email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(form.email)) {
      errors.email = "Email invalide";
    }
  }
};

// Aperçu
const previewSettings = () => {
  showPreview.value = true;
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const onLogoFileChange = (event) => {
  selectedLogoFile.value = event?.target?.files?.[0] || null;
};

const uploadCompanyLogo = async () => {
  if (!selectedLogoFile.value) return;
  uploadingLogo.value = true;
  try {
    const logoBase64 = await fileToBase64(selectedLogoFile.value);
    const result = await company.uploadLogo(logoBase64);
    if (!result.success) {
      messageType.value = "error";
      message.value = result.error || "Erreur lors du téléchargement du logo";
      return;
    }

    form.logoUrl = result.logoUrl || company.settings.logoUrl || "";
    logoError.value = false;
    selectedLogoFile.value = null;
    messageType.value = "success";
    message.value = "Logo téléchargé avec succès";
  } catch {
    messageType.value = "error";
    message.value = "Erreur lors du téléchargement du logo";
  } finally {
    uploadingLogo.value = false;
    setTimeout(() => (message.value = ""), 3000);
  }
};

// Sauvegarde
const saveSettings = async () => {
  validateField('name');
  validateField('email');
  
  if (Object.keys(errors).length > 0) return;

  saving.value = true;
  try {
    const result = await company.saveToServer({
      ...form,
      colors: { ...colors }
    });
    
    messageType.value = result.success ? "success" : "error";
    message.value = result.success 
      ? "Paramètres enregistrés" 
      : result.error || "Erreur lors de l'enregistrement";
  } catch (error) {
    messageType.value = "error";
    message.value = "Erreur de connexion";
  } finally {
    saving.value = false;
    setTimeout(() => (message.value = ""), 3000);
  }
};

// Réinitialisation
const resetForm = () => {
  form.name = company.settings.name || "";
  form.tagline = company.settings.tagline || "";
  form.logoUrl = company.settings.logoUrl || "";
  form.email = company.settings.email || "";
  form.phone = company.settings.phone || "";
  form.address = company.settings.address || "";
  form.footerNote = company.settings.footerNote || "";
  
  if (company.settings.colors) {
    colors.primary = company.settings.colors.primary || "#2563eb";
    colors.secondary = company.settings.colors.secondary || "#1e293b";
  }
  
  Object.keys(errors).forEach(key => delete errors[key]);
  logoError.value = false;
};

// Chargement initial
onMounted(async () => {
  if (auth.user?.role !== "SUPER_ADMIN") {
    router.replace("/unauthorized");
    return;
  }

  await company.loadFromServer();
  resetForm();
});
</script>

<style scoped>
.settings {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
  background: #f9fafb;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.settings-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}

.settings-subtitle {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.settings-actions {
  display: flex;
  gap: 12px;
}

/* Grille */
.settings-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
}

/* Cartes */
.settings-preview {
  position: sticky;
  top: 32px;
  height: fit-content;
}

.preview-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
}

.preview-container {
  background: #f9fafb;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.preview-topbar {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-logo {
  height: 32px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
}

.preview-name {
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.preview-user {
  color: white;
  font-size: 20px;
}

.preview-content {
  padding: 24px;
  background: white;
}

.preview-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.preview-stat {
  height: 60px;
  background: #f3f4f6;
  border-radius: 8px;
}

.preview-footer {
  padding: 16px;
  color: white;
}

.preview-footer-content {
  font-size: 12px;
}

.preview-note {
  margin-top: 4px;
  opacity: 0.8;
}

.preview-contacts {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 11px;
  opacity: 0.7;
}

.preview-hint {
  margin: 12px 0 0;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}

/* Formulaire */
.form-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
}

.form-section {
  margin-bottom: 32px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-group input.error {
  border-color: #dc2626;
  background: #fef2f2;
}

.required {
  color: #dc2626;
  margin-left: 2px;
}

.error-message {
  display: block;
  font-size: 11px;
  color: #dc2626;
  margin-top: 4px;
}

.field-hint {
  display: block;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

/* Logo upload */
.logo-upload {
  display: flex;
  gap: 8px;
}

.logo-upload input {
  flex: 1;
}

.logo-upload-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-icon {
  width: 42px;
  height: 42px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

/* Color picker */
.color-picker {
  display: flex;
  gap: 8px;
}

.color-picker input[type="color"] {
  width: 42px;
  height: 42px;
  padding: 4px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
}

.color-picker input[type="text"] {
  flex: 1;
}

/* Boutons */
.btn {
  padding: 0 16px;
  height: 42px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2563eb;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: white;
  border-color: #d1d5db;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-outline {
  background: white;
  border-color: #d1d5db;
  color: #374151;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

/* Notification */
.notification {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 12px 40px 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.notification-success {
  background: #10b981;
  color: white;
}

.notification-error {
  background: #ef4444;
  color: white;
}

.notification-close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: currentColor;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.7;
}

.notification-close:hover {
  opacity: 1;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid white;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1100;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #111827;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

/* Full preview */
.full-preview {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.full-topbar {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  color: white;
}

.full-brand {
  font-weight: 600;
}

.full-main {
  padding: 40px;
  background: #f9fafb;
  text-align: center;
  color: #6b7280;
}

.full-footer {
  padding: 20px;
  color: white;
  text-align: center;
}

.full-contacts {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.8;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Responsive */
@media (max-width: 1024px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-preview {
    position: static;
    order: 2;
  }
}

@media (max-width: 768px) {
  .settings {
    padding: 20px;
  }

  .settings-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .settings-actions {
    width: 100%;
  }

  .settings-actions .btn {
    flex: 1;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .full-contacts {
    flex-direction: column;
    gap: 4px;
  }
}

@media (max-width: 480px) {
  .settings {
    padding: 16px;
  }

  .preview-contacts {
    flex-direction: column;
    gap: 4px;
  }

  .modal-content {
    margin: 10px;
  }
}
</style>

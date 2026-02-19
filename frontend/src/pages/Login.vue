<template>
  <div class="flottech-auth">
    <!-- Arrière-plan -->
    <div class="energy-bg">
      <div class="energy-flow"></div>
      <div class="grid-overlay"></div>
      <div class="particle-field"></div>
    </div>

    <div class="auth-container">
      <!-- Panneau info -->
      <div class="info-panel">
        <div class="brand-section">
          <div class="logo-container">
            <div class="fuel-icon">⛽</div>
            <div class="icon-glow"></div>
          </div>
          <div class="brand-info">
            <h1 class="brand-title">FLEETENERGY</h1>
            <p class="brand-subtitle">Gestion Intelligente d'Énergie Mobile</p>
          </div>
        </div>

        <div class="hero-content">
          <h2>
            Centralisez le contrôle de votre 
            <span class="highlight">flotte</span> et 
            <span class="highlight">carburant</span>
          </h2>
          <p class="description">
            Plateforme intégrée pour le suivi en temps réel des consommations, 
            des stocks et la maintenance préventive de votre parc.
          </p>
        </div>

        <div class="features-grid">
          <div class="feature-card" v-for="feature in features" :key="feature.id">
            <div class="feature-icon" :style="{ backgroundColor: feature.color + '20' }">
              <span>{{ feature.icon }}</span>
            </div>
            <div class="feature-content">
              <h4>{{ feature.title }}</h4>
              <p>{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Panneau auth -->
      <div class="form-panel">
        <div class="form-wrapper">
          <div class="security-header">
            <div class="security-badge">
              <span class="lock-icon">🔐</span>
              <span class="badge-text">PORTAL SÉCURISÉ</span>
            </div>
            <div class="welcome-message">
              <h3>Accès Gestionnaire</h3>
              <p>Veuillez vous identifier pour continuer</p>
            </div>
          </div>

          <form @submit.prevent="handleLogin" class="auth-form">
            <!-- Email -->
            <div class="form-group">
              <label for="email" class="form-label">
                <span class="label-text">Identifiant</span>
                <span class="label-hint">Votre email professionnel</span>
              </label>
              <div class="input-wrapper" :class="{ 'focused': emailFocused }">
                <div class="input-icon">
                  📧
                </div>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  placeholder="exemple@entreprise.fr"
                  @focus="emailFocused = true"
                  @blur="emailFocused = false"
                  required
                />
                <div class="input-underline"></div>
              </div>
            </div>

            <!-- Password -->
            <div class="form-group">
              <label for="password" class="form-label">
                <span class="label-text">Mot de passe</span>
              </label>
              <div class="input-wrapper" :class="{ 'focused': passwordFocused }">
                <div class="input-icon">🔒</div>
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Votre mot de passe"
                  @focus="passwordFocused = true"
                  @blur="passwordFocused = false"
                  required
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                  :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                >
                  👁️
                </button>
                <div class="input-underline"></div>
              </div>
            </div>

            <button
              type="submit"
              class="submit-button"
              :disabled="auth.loading || !email || !password"
              :class="{ 'loading': auth.loading }"
            >
              <span v-if="!auth.loading">Se connecter</span>
              <span v-else>Chargement...</span>
            </button>

            <!-- Message d'erreur -->
            <Transition name="slide-fade">
              <div v-if="auth.error" class="error-message">
                {{ auth.error }}
                <button @click="auth.error = null">✖</button>
              </div>
            </Transition>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

// Form state
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const emailFocused = ref(false);
const passwordFocused = ref(false);

// Features
const features = ref([
  { id: 1, icon: "📊", title: "Analytics Temps Réel", description: "Suivez les consommations et optimisez vos coûts", color: "#3b82f6" },
  { id: 2, icon: "🛠️", title: "Maintenance Prédictive", description: "Anticipez les interventions et réduisez les temps d'arrêt", color: "#10b981" },
  { id: 3, icon: "⛽", title: "Gestion de Carburant", description: "Contrôle des stocks et suivi des distributions", color: "#f59e0b" },
  { id: 4, icon: "🚚", title: "Suivi de Flotte", description: "Localisation et optimisation des trajets", color: "#8b5cf6" }
]);

// Validate
const validateForm = () => {
  auth.error = null;
  if (!email.value.trim()) { auth.error = "L'email est requis"; return false; }
  if (!password.value.trim()) { auth.error = "Le mot de passe est requis"; return false; }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value.trim())) { auth.error = "Format d'email invalide"; return false; }
  return true;
};

// Login handler
const handleLogin = async () => {
  if (!validateForm()) return;
  
  try {
    await auth.login(email.value, password.value);

    if (!auth.token) {
      auth.error = "Échec de connexion : identifiants incorrects";
      return;
    }

    // Redirection selon rôle
    switch(auth.user?.role) {
      case 'SUPER_ADMIN':
      case 'FLEET_MANAGER':
      case 'VIEWER':
        router.push('/');
        break;
      case 'STATION_MANAGER':
        router.push('/stations');
        break;
      default:
        router.push('/');
        break;
    }

  } catch (err) {
    auth.error = "Erreur lors de la connexion";
    console.error(err);
  }
};
</script>


<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap');

.flottech-auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a14;
  font-family: 'Inter', sans-serif;
  color: #ffffff;
  position: relative;
  overflow: hidden;
  padding: 20px;
}

/* === Arrière-plan énergétique === */
.energy-bg {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

.energy-flow {
  position: absolute;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(59, 130, 246, 0.08) 50%,
    transparent 70%
  );
  animation: flow 15s linear infinite;
  top: -50%;
  left: -50%;
}

@keyframes flow {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
}

.particle-field {
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(1px 1px at 10% 20%, rgba(59, 130, 246, 0.4) 1px, transparent 2px),
    radial-gradient(1px 1px at 30% 50%, rgba(99, 102, 241, 0.3) 1px, transparent 2px),
    radial-gradient(1px 1px at 70% 30%, rgba(14, 165, 233, 0.4) 1px, transparent 2px),
    radial-gradient(1.5px 1.5px at 90% 80%, rgba(6, 182, 212, 0.3) 1px, transparent 2px);
  background-size: 200px 200px;
  animation: particles 20s linear infinite;
}

@keyframes particles {
  from { background-position: 0 0; }
  to { background-position: 200px 200px; }
}

/* === Conteneur principal === */
.auth-container {
  display: flex;
  width: 100%;
  max-width: 1400px;
  min-height: 700px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 32px;
  overflow: hidden;
  z-index: 10;
  box-shadow: 
    0 20px 80px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* === Panneau d'information === */
.info-panel {
  flex: 1.2;
  padding: 60px;
  background: linear-gradient(
    135deg,
    rgba(30, 58, 138, 0.3) 0%,
    rgba(30, 41, 59, 0.5) 100%
  );
  border-right: 1px solid rgba(59, 130, 246, 0.1);
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>

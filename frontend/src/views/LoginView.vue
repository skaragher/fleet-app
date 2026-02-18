<!-- frontend/src/views/LoginView.vue -->
<template>
  <div class="flottech-auth">
    <!-- Arrière-plan énergétique -->
    <AuthBackground />

    <div class="auth-container">
      <!-- Panneau d'information gauche -->
      <div class="info-panel">
        <BrandHeader />
        
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

        <FeatureGrid :features="features" />
      </div>

      <!-- Panneau de formulaire droit -->
      <div class="form-panel">
        <div class="form-wrapper">
          <div class="security-header">
            <SecurityBadge />
            <div class="welcome-message">
              <h3>Accès Gestionnaire</h3>
              <p>Veuillez vous identifier pour continuer</p>
            </div>
          </div>

          <!-- Formulaire de connexion -->
          <LoginForm 
            :loading="auth.loading"
            :error="auth.error"
            @submit="handleSubmit"
            @clear-error="auth.clearError"
          />
        </div>

        <!-- Footer -->
        <div class="form-footer">
          <p class="version">Version 2.4.0</p>
          <div class="legal-links">
            <a href="#" @click.prevent>Conditions d'utilisation</a>
            <span class="separator">•</span>
            <a href="#" @click.prevent>Confidentialité</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import type { Feature } from '@/types/auth.types';

// Composants
import AuthBackground from '@/components/auth/AuthBackground.vue';
import BrandHeader from '@/components/auth/BrandHeader.vue';
import SecurityBadge from '@/components/auth/SecurityBadge.vue';
import FeatureGrid from '@/components/auth/FeatureGrid.vue';
import LoginForm from '@/components/auth/LoginForm.vue';

// Store
const auth = useAuthStore();

// Données des fonctionnalités
const features = ref<Feature[]>([
  { 
    id: 1, 
    icon: "📊", 
    title: "Analytics Temps Réel", 
    description: "Suivez les consommations et optimisez vos coûts", 
    color: "#3b82f6",
    animationDelay: "0s"
  },
  { 
    id: 2, 
    icon: "🛠️", 
    title: "Maintenance Prédictive", 
    description: "Anticipez les interventions et réduisez les temps d'arrêt", 
    color: "#10b981",
    animationDelay: "0.1s"
  },
  { 
    id: 3, 
    icon: "⛽", 
    title: "Gestion de Carburant", 
    description: "Contrôle des stocks et suivi des distributions", 
    color: "#f59e0b",
    animationDelay: "0.2s"
  },
  { 
    id: 4, 
    icon: "🚚", 
    title: "Suivi de Flotte", 
    description: "Localisation et optimisation des trajets", 
    color: "#8b5cf6",
    animationDelay: "0.3s"
  }
]);

// Handler de soumission du formulaire
const handleSubmit = async (credentials: { email: string; password: string; remember: boolean }) => {
  await auth.login(credentials.email, credentials.password, credentials.remember);
};

// Raccourci clavier Ctrl+Enter
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'Enter') {
    const submitEvent = new Event('submit', { bubbles: true });
    const form = document.querySelector('form');
    form?.dispatchEvent(submitEvent);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  
  // Auto-focus sur le champ email
  setTimeout(() => {
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.focus();
  }, 100);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.flottech-auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a14;
  font-family: 'Inter', sans-serif;
  position: relative;
  overflow: hidden;
  padding: 20px;
}

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
  position: relative;

  @media (max-width: 1024px) {
    flex-direction: column;
    max-width: 600px;
    min-height: auto;
  }
}

/* Panneau d'information */
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

  @media (max-width: 1024px) {
    padding: 40px;
    border-right: none;
    border-bottom: 1px solid rgba(59, 130, 246, 0.1);
  }

  @media (max-width: 640px) {
    padding: 30px;
  }
}

.hero-content {
  h2 {
    font-size: 2.2rem;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 20px;
    font-family: 'Outfit', sans-serif;

    @media (max-width: 640px) {
      font-size: 1.8rem;
    }
  }

  .highlight {
    color: #60a5fa;
    position: relative;
    display: inline-block;
    
    &::after {
      content: '';
      position: absolute;
      bottom: 4px;
      left: 0;
      width: 100%;
      height: 8px;
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.3), transparent);
      z-index: -1;
    }
  }

  .description {
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.1rem;
    line-height: 1.6;
    max-width: 500px;

    @media (max-width: 640px) {
      font-size: 1rem;
    }
  }
}

/* Panneau de formulaire */
.form-panel {
  flex: 1;
  padding: 40px;
  background: rgba(10, 15, 30, 0.6);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.05) 0%, transparent 50%);
    pointer-events: none;
  }
}

.form-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 380px;
  margin: 0 auto;
  width: 100%;
}

.security-header {
  margin-bottom: 40px;
  
  .welcome-message {
    margin-top: 20px;
    
    h3 {
      font-size: 1.8rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: white;
      font-family: 'Outfit', sans-serif;
    }
    
    p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.95rem;
    }
  }
}

.form-footer {
  margin-top: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8rem;
  
  .version {
    font-weight: 500;
  }
  
  .legal-links {
    display: flex;
    gap: 8px;
    
    a {
      color: rgba(255, 255, 255, 0.4);
      text-decoration: none;
      transition: color 0.2s;
      
      &:hover {
        color: rgba(255, 255, 255, 0.6);
      }
    }
    
    .separator {
      opacity: 0.5;
    }
  }
}
</style>
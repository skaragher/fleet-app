<!-- src/components/AppInitializer.vue -->
<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isInitializing = ref(true);

onMounted(async () => {
  try {
    console.group('🚀 Initialisation de l\'application');
    
    // Vérifier l'authentification
    if (authStore.token) {
      console.log('🔑 Token trouvé:', authStore.token.substring(0, 20) + '...');
      console.log('👤 Utilisateur:', authStore.user?.name);
      
      // Vérifier la validité du token (optionnel)
      // await authStore.verifyToken();
    } else {
      console.log('👤 Aucun utilisateur connecté');
    }
    
    // Charger d'autres données initiales si nécessaire
    // Exemple : configurations, préférences, etc.
    
    console.log('✅ Initialisation terminée');
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    
    // Nettoyer le localStorage en cas d'erreur
    if (error.message.includes('token') || error.message.includes('invalid')) {
      console.warn('⚠️ Token invalide, nettoyage...');
      authStore.logout();
    }
  } finally {
    isInitializing.value = false;
  }
});
</script>

<template>
  <!-- Écran de chargement pendant l'initialisation -->
  <div v-if="isInitializing" class="app-initializer">
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Chargement de l'application...</div>
    </div>
  </div>
</template>

<style scoped>
.app-initializer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: white;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 20px;
}

.loading-text {
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
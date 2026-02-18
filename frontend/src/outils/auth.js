// src/utils/auth.js
import { useAuthStore } from '../stores/auth';

export const authUtils = {
  // Vérifier si l'utilisateur a un rôle spécifique
  hasRole(role) {
    const authStore = useAuthStore();
    return authStore.user?.role === role;
  },

  // Vérifier si l'utilisateur a un des rôles
  hasAnyRole(roles) {
    const authStore = useAuthStore();
    return roles.includes(authStore.user?.role);
  },

  // Vérifier les permissions
  hasPermission(permission) {
    const authStore = useAuthStore();
    return authStore.user?.permissions?.includes(permission) || false;
  },

  // Initialiser et vérifier l'authentification
  async checkAndInit() {
    const authStore = useAuthStore();
    
    // Initialiser si ce n'est pas déjà fait
    if (!authStore.initialized) {
      authStore.initialize();
    }
    
    // Vérifier la validité
    if (authStore.token) {
      // Optionnel: vérifier auprès du serveur
      // const valid = await authStore.verifyToken();
      // if (!valid) authStore.logout();
      return true;
    }
    
    return false;
  }
};

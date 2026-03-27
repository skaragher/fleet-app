// src/utils/auth.js
import { useAuthStore } from '../stores/auth';

export const authUtils = {
  getAllRoles() {
    const authStore = useAuthStore();
    const primary = authStore.user?.role;
    const extras = Array.isArray(authStore.user?.roles) ? authStore.user.roles : [];
    return Array.from(new Set([primary, ...extras].filter(Boolean)));
  },

  // Vérifier si l'utilisateur a un rôle spécifique
  hasRole(role) {
    return this.getAllRoles().includes(role);
  },

  // Vérifier si l'utilisateur a un des rôles
  hasAnyRole(roles) {
    const userRoles = this.getAllRoles();
    return (roles || []).some((r) => userRoles.includes(r));
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

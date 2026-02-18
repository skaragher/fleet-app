// src/router/guards.js
import { useAuthStore } from "../stores/auth";

export const authGuard = async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Initialiser l'authentification si ce n'est pas déjà fait
  if (!authStore.initialized) {
    await authStore.initialize();
  }
  
  // Vérifier si la route nécessite une authentification
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = authStore.isAuthenticated;
  
  if (requiresAuth && !isAuthenticated) {
    // Rediriger vers login
    next('/login');
  } else if (to.path === '/login' && isAuthenticated) {
    // Si déjà connecté, rediriger vers le dashboard
    next('/');
  } else {
    next();
  }
};

export const roleGuard = (allowedRoles) => {
  return (to, from, next) => {
    const authStore = useAuthStore();
    const userRole = authStore.user?.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      // Rediriger vers une page d'erreur ou le dashboard
      next('/unauthorized');
    } else {
      next();
    }
  };
};

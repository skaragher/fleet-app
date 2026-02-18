// src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Instance axios principale
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// === FONCTIONS UTILITAIRES ===
const getStoredToken = () => localStorage.getItem('token');
const getStoredUser = () => {
  const userStr = localStorage.getItem('user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

const clearAuthStorage = () => {
  console.log('🧹 Clearing auth storage...');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  delete api.defaults.headers.common['Authorization'];
};

const redirectToLogin = () => {
  console.log('🔀 Redirecting to login...');
  // Éviter les boucles infinies
  if (window.location.pathname !== '/login') {
    // Utiliser replace pour éviter de pouvoir revenir en arrière
    window.location.replace('/login');
  }
};

// === INTERCEPTEUR DE REQUÊTE ===
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    
    // Ajouter le token uniquement s'il existe
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Si pas de token mais la requête nécessite une auth, annuler
      if (config.url !== '/auth/login' && !config._skipAuth) {
        console.warn('No token found for authenticated request');
      }
    }
    
    // Ajouter un timestamp pour éviter le cache
    if (!config.params) config.params = {};
    config.params._t = Date.now();
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// === INTERCEPTEUR DE RÉPONSE ===
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const originalRequest = error.config;
    
    if (error.response) {
      const { status } = error.response;
      
      // Gestion des erreurs 401 (Unauthorized)
      if (status === 401) {
        console.warn('🔐 401 Unauthorized - Token invalid or expired');
        
        // Marquer cette requête comme traitée
        if (!originalRequest._retryCount) {
          originalRequest._retryCount = 1;
        } else {
          originalRequest._retryCount++;
        }
        
        // Si c'est la première erreur 401, nettoyer et rediriger
        if (originalRequest._retryCount <= 2) {
          clearAuthStorage();
          
          // Rediriger après un court délai
          setTimeout(() => {
            redirectToLogin();
          }, 500);
        }
      }
      
      // Gestion des erreurs 403 (Forbidden)
      if (status === 403) {
        console.warn('🚫 403 Forbidden - Insufficient permissions');
      }
      
      // Gestion des erreurs 500 (Server Error)
      if (status >= 500) {
        console.error('💥 Server Error', error.response.data);
      }
    } else if (error.request) {
      // La requête a été faite mais pas de réponse
      console.error('🌐 Network Error - No response from server');
    } else {
      // Erreur lors de la configuration de la requête
      console.error('⚙️ Request Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// === FONCTIONS UTILITAIRES POUR L'AUTHENTIFICATION ===
export const authService = {
  // Vérifier si l'utilisateur est authentifié
  isAuthenticated() {
    const token = getStoredToken();
    const user = getStoredUser();
    return !!token && !!user;
  },
  
  // Récupérer l'utilisateur actuel
  getCurrentUser() {
    return getStoredUser();
  },
  
  // Récupérer le token
  getToken() {
    return getStoredToken();
  },
  
  // Sauvegarder les informations d'authentification
  setAuth(token, user) {
    if (!token || !user) {
      console.error('Cannot set auth: token or user is null');
      return false;
    }
    
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Mettre à jour les headers axios
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      console.log('✅ Authentication saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving auth:', error);
      return false;
    }
  },
  
  // Déconnexion
  logout() {
    console.log('👋 Logging out...');
    clearAuthStorage();
    redirectToLogin();
  },
  
  // Vérifier la validité du token (optionnel - requête au serveur)
  async validateToken() {
    const token = getStoredToken();
    if (!token) return false;
    
    try {
      const response = await api.get('/auth/verify', {
        _skipAuth: true, // Éviter la boucle d'interception
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.valid === true;
    } catch (error) {
      console.warn('Token validation failed:', error.message);
      return false;
    }
  }
};

// === EXPORT DES FONCTIONS API ===
export const apiService = {
  // Authentification
  login: (email, password) => api.post('/auth/login', { email, password }),
  verifyToken: () => api.get('/auth/verify'),
  
  // Dashboard
  getDashboard: () => api.get('/dashboard'),
  
  // Véhicules
  getVehicles: (params) => api.get('/vehicles', { params }),
  getVehicle: (id) => api.get(`/vehicles/${id}`),
  
  // Stations
  getStations: (params) => api.get('/stations', { params }),
  getStation: (id) => api.get(`/stations/${id}`),
  
  // Approvisionnements
  getSupplies: (params) => api.get('/fuel/supplies', { params }),
  
  // Ravitaillements
  getDispenses: (params) => api.get('/fuel/dispenses', { params }),
  createDispense: (data) => api.post('/fuel/dispenses', data),
  
  // Entretiens
  getMaintenances: (params) => api.get('/maintenances', { params }),
  createMaintenance: (data) => api.post('/maintenances', data),
  
  // Assurances
  getInsurances: (params) => api.get('/insurances', { params }),
  
  // Visites techniques
  getInspections: (params) => api.get('/inspections', { params }),
  
  // Upload
  uploadFile: (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
};

export default api;
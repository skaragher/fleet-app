import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const authApi = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const parseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("token") || null);
  const user = ref(parseStoredUser());
  const loading = ref(false);
  const error = ref(null);
  const initialized = ref(false);
  const lastCheck = ref(null);

  if (token.value) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token.value}`;
  }

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const userRole = computed(() => user.value?.role || null);
  const isSuperAdmin = computed(() => userRole.value === "SUPER_ADMIN");
  const isFleetManager = computed(() => userRole.value === "FLEET_MANAGER");
  const isStationManager = computed(() => userRole.value === "STATION_MANAGER");
  const isVehicleManager = computed(() => userRole.value === "VEHICLE_MANAGER");
  const isDriver = computed(() => userRole.value === "DRIVER");
  const isViewer = computed(() => userRole.value === "VIEWER");

  const clearError = () => {
    error.value = null;
  };

  const setAuth = (newToken, newUser) => {
    if (!newToken || !newUser) return;

    token.value = newToken;
    user.value = newUser;
    lastCheck.value = Date.now();
    initialized.value = true;

    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
  };

  const setSession = async (newToken, newUser) => {
    setAuth(newToken, newUser);
  };

  const clearAuth = () => {
    token.value = null;
    user.value = null;
    error.value = null;
    lastCheck.value = null;
    initialized.value = true;

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
  };

  const clearStorage = () => {
    clearAuth();
  };

  const verifyToken = async (tokenToVerify = null) => {
    const tokenValue = tokenToVerify || token.value;
    if (!tokenValue) return false;

    try {
      const response = await authApi.get("/auth/verify", {
        headers: {
          Authorization: `Bearer ${tokenValue}`,
        },
      });

      if (response?.data?.valid === false) return false;
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return false;
      return null;
    }
  };

  const initialize = async () => {
    if (initialized.value) return isAuthenticated.value;

    const storedToken = localStorage.getItem("token");
    const storedUser = parseStoredUser();

    if (!storedToken || !storedUser) {
      clearAuth();
      return false;
    }

    setAuth(storedToken, storedUser);

    const tokenState = await verifyToken(storedToken);
    if (tokenState === false) {
      clearAuth();
      return false;
    }

    initialized.value = true;
    return true;
  };

  const login = async (email, password) => {
    loading.value = true;
    error.value = null;

    try {
      clearStorage();

      const response = await authApi.post("/auth/login", {
        email,
        password,
      });

      const responseData = response.data || {};
      const loginOk = responseData.success !== false;
      const nextToken = responseData.token;
      const nextUser = responseData.user;

      if (!loginOk || !nextToken || !nextUser) {
        throw new Error(responseData.message || "Login failed");
      }

      setAuth(nextToken, nextUser);
      return { success: true, user: nextUser };
    } catch (err) {
      let errorMessage = "Erreur de connexion";

      if (err.response) {
        const { status, data } = err.response;
        if (status === 401) {
          errorMessage = data?.message || "Email ou mot de passe incorrect";
        } else if (status === 400 || status === 422) {
          errorMessage = data?.message || "Données invalides";
        } else if (status >= 500) {
          errorMessage = "Erreur serveur. Veuillez réessayer plus tard.";
        } else {
          errorMessage = data?.message || `Erreur ${status}`;
        }
      } else if (err.request) {
        errorMessage = "Serveur inaccessible. Vérifiez votre connexion.";
      } else {
        errorMessage = err.message || "Erreur inattendue";
      }

      error.value = errorMessage;
      return { success: false, error: errorMessage };
    } finally {
      loading.value = false;
    }
  };

  const updateProfile = async (payload) => {
    if (!token.value) {
      return { success: false, error: "Utilisateur non authentifié" };
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await authApi.put("/auth/me", payload || {}, {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      });

      const responseData = response.data || {};
      const nextUser = responseData.user;
      const nextToken = responseData.token || token.value;

      if (!nextUser) {
        throw new Error("Réponse invalide du serveur");
      }

      setAuth(nextToken, nextUser);
      return { success: true, user: nextUser, message: responseData.message || "Profil mis à jour" };
    } catch (err) {
      const message = err?.response?.data?.message || "Erreur lors de la mise à jour du profil";
      error.value = message;
      return { success: false, error: message };
    } finally {
      loading.value = false;
    }
  };

  const logout = () => {
    clearAuth();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  };

  const checkAuth = async () => {
    if (!isAuthenticated.value) return false;

    if (lastCheck.value && Date.now() - lastCheck.value < 30000) {
      return true;
    }

    const tokenState = await verifyToken();
    if (tokenState === false) {
      clearAuth();
      return false;
    }

    lastCheck.value = Date.now();
    return true;
  };

  return {
    token,
    user,
    loading,
    error,
    initialized,
    lastCheck,
    isAuthenticated,
    userRole,
    isSuperAdmin,
    isFleetManager,
    isStationManager,
    isVehicleManager,
    isDriver,
    isViewer,
    initialize,
    login,
    updateProfile,
    logout,
    setAuth,
    setSession,
    clearAuth,
    clearStorage,
    clearError,
    verifyToken,
    checkAuth,
  };
});

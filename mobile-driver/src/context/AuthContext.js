import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi, setApiToken } from "../services/api";

const AUTH_TOKEN_KEY = "@driver_token";
const AUTH_USER_KEY = "@driver_user";
const AUTO_REFRESH_INTERVAL_MS = 30 * 1000;

const AuthContext = createContext(null);

const getAllRoles = (user) => {
  const primary = String(user?.role || "").toUpperCase();
  const extras = Array.isArray(user?.roles) ? user.roles.map((r) => String(r || "").toUpperCase()) : [];
  return Array.from(new Set([primary, ...extras].filter(Boolean)));
};

const hasDriverRole = (user) => getAllRoles(user).includes("DRIVER");

const normalizeDriverMobileUser = (user) => {
  if (!user) return user;
  if (!hasDriverRole(user)) return user;
  const normalizedRoles = Array.from(new Set([...(Array.isArray(user.roles) ? user.roles : []), "DRIVER"]));
  if (String(user.role || "").toUpperCase() === "DRIVER") {
    return { ...user, roles: normalizedRoles };
  }
  return {
    ...user,
    mobileOriginalRole: user.role || null,
    role: "DRIVER",
    roles: normalizedRoles,
  };
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(Date.now());
  const appStateRef = useRef(AppState.currentState);
  const refreshInProgressRef = useRef(false);
  const lastAutoRefreshRef = useRef(Date.now());

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);

        if (storedToken && storedUser) {
          const parsed = JSON.parse(storedUser);
          if (!hasDriverRole(parsed)) {
            await Promise.all([
              AsyncStorage.removeItem(AUTH_TOKEN_KEY),
              AsyncStorage.removeItem(AUTH_USER_KEY),
            ]);
            setApiToken(null);
            return;
          }
          const normalized = normalizeDriverMobileUser(parsed);
          setToken(storedToken);
          setUser(normalized);
          setApiToken(storedToken);
        }
      } catch (e) {
        setError("Impossible de restaurer la session.");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (identifier, password) => {
    setError("");
    const response = await authApi.login(identifier, password);
    const nextToken = response?.data?.token;
    const nextUser = response?.data?.user;

    if (!nextToken || !nextUser) {
      throw new Error("Réponse de connexion invalide.");
    }

    if (!hasDriverRole(nextUser)) {
      throw new Error("Cette application est réservée aux chauffeurs.");
    }
    const mobileUser = normalizeDriverMobileUser(nextUser);

    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, nextToken),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(mobileUser)),
    ]);
    setToken(nextToken);
    setUser(mobileUser);
    setApiToken(nextToken);
  };

  const logout = async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);
    setToken(null);
    setUser(null);
    setApiToken(null);
  };

  const refreshMe = async () => {
    if (!token) return null;
    const response = await authApi.me();
    const me = response?.data?.user;
    if (me) {
      if (!hasDriverRole(me)) {
        await logout();
        return null;
      }
      const mobileUser = normalizeDriverMobileUser(me);
      setUser(mobileUser);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(mobileUser));
    }
    return me || null;
  };

  useEffect(() => {
    if (!token) return undefined;

    const autoRefresh = async () => {
      if (appStateRef.current !== "active") return;
      if (refreshInProgressRef.current) return;

      refreshInProgressRef.current = true;
      try {
        // Déclenche systématiquement le reload des écrans
        setRefreshTick(Date.now());
        lastAutoRefreshRef.current = Date.now();
        // Puis tente la synchronisation du profil (si réseau/API OK)
        await refreshMe();
      } catch {
        // Pas de connexion ou API indisponible: on ignore et on retente au prochain cycle
      } finally {
        refreshInProgressRef.current = false;
      }
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active") {
        const elapsed = Date.now() - lastAutoRefreshRef.current;
        if (elapsed >= AUTO_REFRESH_INTERVAL_MS) {
          autoRefresh();
        }
      }
    });

    const timer = setInterval(autoRefresh, AUTO_REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      error,
      setError,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      refreshMe,
      refreshTick,
    }),
    [token, user, loading, error, refreshTick]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

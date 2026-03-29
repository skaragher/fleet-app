/**
 * useSessionTimeout.js
 * Déconnexion automatique après inactivité.
 * Démarre les timers dès la connexion (watch sur isAuthenticated),
 * les arrête à la déconnexion.
 */

import { ref, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];

export function useSessionTimeout(options = {}) {
  const {
    timeoutMs = 30 * 60 * 1000,  // 30 minutes d'inactivité
    warningMs = 60 * 1000,         // avertissement 1 min avant
    onLogout  = null,
  } = options;

  const router  = useRouter();
  const auth    = useAuthStore();
  const warning = ref(false);

  let timeoutTimer  = null;
  let warningTimer  = null;
  let pingThrottle  = null;
  let listenersActive = false;

  // ── Timers ──────────────────────────────────────────────────────────────────
  function clearTimers() {
    if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
    if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
  }

  function resetTimers() {
    clearTimers();
    warning.value = false;
    if (warningMs > 0 && warningMs < timeoutMs) {
      warningTimer = setTimeout(() => { warning.value = true; }, timeoutMs - warningMs);
    }
    timeoutTimer = setTimeout(forceLogout, timeoutMs);
  }

  // ── Déconnexion ─────────────────────────────────────────────────────────────
  function forceLogout() {
    clearTimers();
    warning.value = false;
    auth.logout?.();
    try { if (typeof onLogout === 'function') onLogout(); } catch {}
    router.push({ path: '/login', query: { reason: 'inactivity' } });
  }

  function stayConnected() { resetTimers(); }

  // ── Activité utilisateur ────────────────────────────────────────────────────
  function pingOtherTabs() {
    if (pingThrottle) return;
    pingThrottle = setTimeout(() => {
      try { localStorage.setItem('__session_ping__', Date.now().toString()); } catch {}
      pingThrottle = null;
    }, 2000);
  }

  function onActivity() { resetTimers(); pingOtherTabs(); }

  function onStorageChange(e) {
    if (e.key === 'token' && !e.newValue) { clearTimers(); router.push('/login'); }
    if (e.key === '__session_ping__') resetTimers();
  }

  // ── Gestion des listeners ───────────────────────────────────────────────────
  function startListeners() {
    if (listenersActive) return;
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener('storage', onStorageChange);
    listenersActive = true;
    resetTimers();
  }

  function stopListeners() {
    if (!listenersActive) return;
    ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
    window.removeEventListener('storage', onStorageChange);
    listenersActive = false;
    clearTimers();
    warning.value = false;
  }

  // ── Watch isAuthenticated ───────────────────────────────────────────────────
  // Démarre les timers à la connexion, les arrête à la déconnexion.
  const stopWatch = watch(
    () => auth.isAuthenticated,
    (authenticated) => {
      if (authenticated) {
        startListeners();
      } else {
        stopListeners();
      }
    },
    { immediate: true }
  );

  // ── Nettoyage ───────────────────────────────────────────────────────────────
  onUnmounted(() => {
    stopWatch();
    stopListeners();
    if (pingThrottle) clearTimeout(pingThrottle);
  });

  return { warning, stayConnected, logout: forceLogout };
}

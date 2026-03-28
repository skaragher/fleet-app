/**
 * useSessionTimeout.js
 * Composable Vue 3 — déconnexion automatique après inactivité.
 * Usage dans App.vue :
 *   const { warning, stayConnected } = useSessionTimeout({ timeoutMs: 30*60*1000, warningMs: 60*1000 })
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];

export function useSessionTimeout(options = {}) {
  const {
    timeoutMs = 30 * 60 * 1000,   // 30 minutes par défaut
    warningMs = 60 * 1000,          // avertissement 1 min avant
    onLogout  = null,
  } = options;

  const router  = useRouter();
  const warning = ref(false);

  let timeoutTimer = null;
  let warningTimer = null;
  let pingThrottle = null;

  function logout() {
    clearTimers();
    warning.value = false;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    try { if (typeof onLogout === 'function') onLogout(); } catch {}
    router.push('/login');
  }

  function resetTimers() {
    clearTimers();
    warning.value = false;
    if (warningMs > 0 && warningMs < timeoutMs) {
      warningTimer = setTimeout(() => { warning.value = true; }, timeoutMs - warningMs);
    }
    timeoutTimer = setTimeout(logout, timeoutMs);
  }

  function clearTimers() {
    if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
    if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
  }

  function stayConnected() { resetTimers(); }

  function onStorageChange(e) {
    if (e.key === 'token' && !e.newValue) { clearTimers(); router.push('/login'); }
    if (e.key === '__session_ping__') resetTimers();
  }

  function pingOtherTabs() {
    if (pingThrottle) return;
    pingThrottle = setTimeout(() => {
      try { localStorage.setItem('__session_ping__', Date.now().toString()); } catch {}
      pingThrottle = null;
    }, 2000);
  }

  function onActivity() { resetTimers(); pingOtherTabs(); }

  onMounted(() => {
    if (!localStorage.getItem('token')) return;
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    window.addEventListener('storage', onStorageChange);
    resetTimers();
  });

  onUnmounted(() => {
    ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
    window.removeEventListener('storage', onStorageChange);
    clearTimers();
    if (pingThrottle) clearTimeout(pingThrottle);
  });

  return { warning, stayConnected, logout };
}

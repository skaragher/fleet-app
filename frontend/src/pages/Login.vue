<template>
  <div class="login-page">
    <main class="login-shell">
      <section class="promo-pane">
        <div class="promo-brand-chip">FLEETENERGY</div>

        <div class="promo-main">
          <div class="promo-logo">⛽</div>
          <h1>Système de Gestion</h1>
          <h2>Flotte & Énergie</h2>
          <div class="promo-dots">
            <span class="dot dot-active"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>

        <div class="promo-grid">
          <article class="promo-card">
            <div class="promo-icon">📅</div>
            <p>Gestion des réunions</p>
          </article>
          <article class="promo-card">
            <div class="promo-icon">📋</div>
            <p>Gestion projet et automatisation</p>
          </article>
          <article class="promo-card">
            <div class="promo-icon">🔒</div>
            <p>Accès sécurisé</p>
          </article>
          <article class="promo-card">
            <div class="promo-icon">🛡️</div>
            <p>Données protégées</p>
          </article>
        </div>
      </section>

      <section class="auth-pane">
        <header class="auth-header">
          <h3>Bienvenue !</h3>
          <p>Connectez-vous pour accéder à votre espace.</p>
        </header>

        <form class="auth-form" @submit.prevent="handleLogin">
          <label for="email">Email</label>
          <div class="input-wrap">
            <span class="input-icon">✉</span>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="nom@entreprise.com"
              autocomplete="username"
              required
            />
          </div>

          <label for="password">Mot de passe</label>
          <div class="input-wrap">
            <span class="input-icon">🔒</span>
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Votre mot de passe"
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="toggle-btn"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
            >
              {{ showPassword ? 'Masquer' : 'Afficher' }}
            </button>
          </div>

          <div class="auth-row">
            <label class="remember-me">
              <input type="checkbox" />
              <span>Se souvenir de moi</span>
            </label>
            <button type="button" class="forgot-link" @click="router.push({ name: 'ForgotPassword' })">
              Mot de passe oublié ?
            </button>
          </div>

          <button type="submit" class="submit-btn" :disabled="auth.loading || !email || !password">
            {{ auth.loading ? 'Connexion...' : 'Se connecter' }}
          </button>

          <Transition name="fade-up">
            <div v-if="auth.error" class="feedback-error">
              <span>{{ auth.error }}</span>
              <button type="button" @click="auth.error = null">×</button>
            </div>
          </Transition>
        </form>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRoute, useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref("");
const password = ref("");
const showPassword = ref(false);

const validateForm = () => {
  auth.error = null;
  if (!email.value.trim()) {
    auth.error = "L'email est requis";
    return false;
  }
  if (!password.value.trim()) {
    auth.error = "Le mot de passe est requis";
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value.trim())) {
    auth.error = "Format d'email invalide";
    return false;
  }

  return true;
};

const handleLogin = async () => {
  if (!validateForm()) return;

  try {
    await auth.login(email.value, password.value);

    if (!auth.token) {
      auth.error = "Échec de connexion : identifiants incorrects";
      return;
    }

    const redirectFromQuery = route.query?.redirect;
    const redirectFromSession = sessionStorage.getItem("post_login_redirect");
    const redirectTarget =
      (typeof redirectFromQuery === "string" && redirectFromQuery.startsWith("/") && redirectFromQuery) ||
      (redirectFromSession && redirectFromSession.startsWith("/") && redirectFromSession) ||
      null;

    if (redirectTarget) {
      sessionStorage.removeItem("post_login_redirect");
      router.push(redirectTarget);
      return;
    }

    switch (auth.user?.role) {
      case "SUPER_ADMIN":
      case "FLEET_MANAGER":
      case "VIEWER":
        router.push("/");
        break;
      case "STATION_MANAGER":
        router.push("/stations");
        break;
      default:
        router.push("/");
        break;
    }
  } catch (err) {
    auth.error = "Erreur lors de la connexion";
    console.error(err);
  }
};

onMounted(() => {
  if (route.query?.reason === "inactive") {
    auth.error = "Session expirée après 10 minutes d'inactivité. Veuillez vous reconnecter.";
  }
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

.login-page {
  min-height: 100vh;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #d8deee;
  font-family: 'Manrope', sans-serif;
}

.login-shell {
  width: 100%;
  max-width: 1220px;
  min-height: min(700px, 92vh);
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  box-shadow: 0 24px 56px -38px rgba(15, 23, 42, 0.45);
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
}

.promo-pane {
  padding: 24px 30px;
  background: #dde3f7;
  color: #1e3a8a;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
}

.promo-brand-chip {
  align-self: flex-start;
  border: 1px solid #c7d2fe;
  background: #ffffff;
  color: #4338ca;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.5px;
  border-radius: 10px;
  padding: 8px 12px;
}

.promo-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.promo-logo {
  width: 108px;
  height: 64px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  background: #ffffff;
  border: 1px solid #c7d2fe;
  box-shadow: 0 14px 24px -20px rgba(30, 64, 175, 0.7);
}

.promo-pane h1 {
  margin: 0;
  font-size: clamp(30px, 3vw, 40px);
  font-weight: 800;
  letter-spacing: -0.5px;
}

.promo-pane h2 {
  margin: -2px 0 4px;
  font-size: clamp(20px, 2vw, 26px);
  color: #4f46e5;
}

.promo-dots {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0 10px;
}

.dot {
  width: 18px;
  height: 8px;
  border-radius: 999px;
  background: #a5b4fc;
}

.dot-active {
  width: 52px;
  background: #4f46e5;
}

.promo-grid {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.promo-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #dbeafe;
  padding: 18px 14px;
  min-height: 105px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

.promo-icon {
  font-size: 24px;
  color: #4f46e5;
}

.promo-card p {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.25;
  font-weight: 600;
  text-align: center;
}

.auth-pane {
  padding: 36px 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #ffffff;
}

.auth-header {
  margin-bottom: 28px;
}

.auth-header h3 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(30px, 2.2vw, 40px);
  font-weight: 800;
}

.auth-header p {
  margin: 6px 0 0;
  color: #475569;
  font-size: clamp(16px, 1.4vw, 22px);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-form label {
  margin-top: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #94a3b8;
  font-size: 18px;
}

.input-wrap input {
  width: 100%;
  height: 50px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  padding: 0 110px 0 34px;
  font-size: 17px;
  color: #0f172a;
  background: #ffffff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-wrap input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.14);
}

.toggle-btn {
  position: absolute;
  right: 12px;
  border: none;
  background: transparent;
  color: #4f46e5;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px;
}

.auth-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.remember-me {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #334155;
}

.remember-me input {
  width: 18px;
  height: 18px;
}

.forgot-link {
  border: none;
  background: transparent;
  color: #4f46e5;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.submit-btn {
  margin-top: 18px;
  height: 52px;
  border: none;
  border-radius: 14px;
  font-size: 20px;
  font-weight: 800;
  color: #ffffff;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
  box-shadow: 0 20px 30px -22px rgba(79, 70, 229, 0.9);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.feedback-error {
  margin-top: 14px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 10px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  gap: 8px;
}

.feedback-error button {
  border: none;
  background: transparent;
  color: #b91c1c;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.25s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 980px) {
  .login-shell {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .promo-pane {
    padding: 24px 20px;
  }

  .promo-main {
    margin-top: 6px;
  }

  .promo-pane h1 {
    font-size: 34px;
  }

  .promo-pane h2 {
    font-size: 22px;
  }

  .promo-grid {
    grid-template-columns: 1fr;
  }

  .promo-card p {
    font-size: 15px;
  }

  .auth-pane {
    padding: 24px 20px;
  }

  .auth-header h3 {
    font-size: 36px;
  }

  .auth-header p {
    font-size: 20px;
  }

  .auth-form label {
    font-size: 18px;
  }

  .submit-btn {
    font-size: 20px;
    height: 50px;
  }
}
</style>

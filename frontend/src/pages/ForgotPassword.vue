<template>
  <div class="login-page">
    <main class="login-shell">
      <section class="promo-pane">
        <div class="promo-brand-chip">FLEETENERGY</div>

        <div class="promo-main">
          <div class="promo-logo">🔑</div>
          <h1>Réinitialisation</h1>
          <h2>Mot de passe</h2>
          <div class="promo-dots">
            <span class="dot dot-active"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>

        <div class="promo-grid">
          <article class="promo-card">
            <div class="promo-icon">✉</div>
            <p>Recevez un lien sécurisé</p>
          </article>
          <article class="promo-card">
            <div class="promo-icon">⏱</div>
            <p>Lien temporaire (expiration)</p>
          </article>
          <article class="promo-card">
            <div class="promo-icon">🛡</div>
            <p>Token stocké de façon sécurisée</p>
          </article>
          <article class="promo-card">
            <div class="promo-icon">✅</div>
            <p>Reprenez l'accès rapidement</p>
          </article>
        </div>
      </section>

      <section class="auth-pane">
        <header class="auth-header">
          <h3>Mot de passe oublié</h3>
          <p>Entrez votre email. Si un compte existe, vous recevrez un lien.</p>
        </header>

        <form class="auth-form" @submit.prevent="submit">
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

          <button type="submit" class="submit-btn" :disabled="loading || !email">
            {{ loading ? "Envoi..." : "Envoyer le lien" }}
          </button>

          <Transition name="fade-up">
            <div v-if="error" class="feedback-error">
              <span>{{ error }}</span>
              <button type="button" @click="error = null">×</button>
            </div>
          </Transition>

          <Transition name="fade-up">
            <div v-if="success" class="feedback-success">
              <span>{{ success }}</span>
              <button type="button" @click="success = null">×</button>
            </div>
          </Transition>

          <div v-if="debugResetUrl" class="debug-box">
            <div class="debug-title">Mode debug</div>
            <div v-if="debugEmailSent === true" class="debug-meta">Email: envoyé</div>
            <div v-else-if="debugEmailSent === false" class="debug-meta">
              Email: non envoyé ({{ debugEmailReason || 'raison inconnue' }})
            </div>
            <div v-if="debugEmailErrorCode || debugEmailErrorMessage" class="debug-meta debug-meta-secondary">
              {{ debugEmailErrorCode || 'error' }}{{ debugEmailErrorMessage ? `: ${debugEmailErrorMessage}` : '' }}
            </div>
            <a class="debug-link" :href="debugResetUrl">{{ debugResetUrl }}</a>
          </div>

          <button type="button" class="secondary-link" @click="router.push({ name: 'Login' })">
            Retour à la connexion
          </button>
        </form>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import api from "../services/api";

const router = useRouter();

const email = ref("");
const loading = ref(false);
const error = ref(null);
const success = ref(null);
const debugResetUrl = ref(null);
const debugEmailSent = ref(null);
const debugEmailReason = ref(null);
const debugEmailErrorCode = ref(null);
const debugEmailErrorMessage = ref(null);

const submit = async () => {
  error.value = null;
  success.value = null;
  debugResetUrl.value = null;
  debugEmailSent.value = null;
  debugEmailReason.value = null;
  debugEmailErrorCode.value = null;
  debugEmailErrorMessage.value = null;

  const clean = email.value.trim();
  if (!clean) {
    error.value = "L'email est requis";
    return;
  }

  loading.value = true;
  try {
    const res = await api.post("/auth/forgot-password", { email: clean }, { _skipAuth: true });
    const message = res?.data?.message || "Si un compte existe, un lien a été envoyé.";
    success.value = message;
    debugResetUrl.value = res?.data?.debugResetUrl || null;
    debugEmailSent.value = typeof res?.data?.debugEmailSent === "boolean" ? res.data.debugEmailSent : null;
    debugEmailReason.value = res?.data?.debugEmailReason || null;
    debugEmailErrorCode.value = res?.data?.debugEmailErrorCode || null;
    debugEmailErrorMessage.value = res?.data?.debugEmailErrorMessage || null;
  } catch (e) {
    if (!e?.response) {
      error.value =
        "Impossible de contacter le serveur. Vérifie que le backend est démarré (PORT 3000) et que VITE_API_URL est correct.";
    } else {
      error.value = e?.response?.data?.message || "Impossible d'envoyer la demande.";
    }
  } finally {
    loading.value = false;
  }
};
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
  display: inline-flex;
  align-self: flex-start;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(30, 58, 138, 0.15);
  font-weight: 800;
  letter-spacing: 0.12em;
  font-size: 12px;
}

.promo-main {
  display: grid;
  gap: 10px;
}

.promo-logo {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: rgba(30, 58, 138, 0.12);
  font-size: 26px;
}

.promo-main h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
}

.promo-main h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  opacity: 0.85;
}

.promo-dots {
  display: inline-flex;
  gap: 8px;
  margin-top: 6px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: rgba(30, 58, 138, 0.25);
}

.dot-active {
  background: rgba(30, 58, 138, 0.75);
}

.promo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.promo-card {
  padding: 12px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(30, 58, 138, 0.12);
  display: flex;
  gap: 10px;
  align-items: center;
}

.promo-icon {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(30, 58, 138, 0.12);
}

.promo-card p {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}

.auth-pane {
  padding: 34px 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.auth-header h3 {
  margin: 0 0 6px 0;
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
}

.auth-header p {
  margin: 0 0 22px 0;
  color: #475569;
  font-weight: 600;
}

.auth-form {
  display: grid;
  gap: 14px;
}

.auth-form label {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  opacity: 0.85;
}

.input-wrap input {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  padding: 0 14px 0 36px;
  font-weight: 600;
  outline: none;
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.input-wrap input:focus {
  border-color: rgba(30, 58, 138, 0.55);
  box-shadow: 0 0 0 4px rgba(30, 58, 138, 0.12);
}

.submit-btn {
  height: 48px;
  border-radius: 14px;
  border: none;
  background: #1e3a8a;
  color: #ffffff;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.12s ease;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.secondary-link {
  height: 44px;
  border-radius: 14px;
  border: 1px solid #cbd5e1;
  background: transparent;
  font-weight: 800;
  cursor: pointer;
  color: #0f172a;
}

.feedback-error,
.feedback-success {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-weight: 700;
}

.feedback-error {
  background: #fef2f2;
  border-color: rgba(239, 68, 68, 0.35);
  color: #b91c1c;
}

.feedback-success {
  background: #f0fdf4;
  border-color: rgba(16, 185, 129, 0.35);
  color: #166534;
}

.feedback-error button,
.feedback-success button {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  font-weight: 900;
}

.debug-box {
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px dashed rgba(30, 58, 138, 0.35);
  background: rgba(30, 58, 138, 0.06);
}

.debug-title {
  font-weight: 900;
  font-size: 12px;
  color: #0f172a;
  margin-bottom: 6px;
}

.debug-meta {
  font-weight: 800;
  font-size: 12px;
  color: #0f172a;
  margin-bottom: 8px;
}

.debug-meta-secondary {
  font-weight: 700;
  color: #334155;
}

.debug-link {
  word-break: break-all;
  color: #1e3a8a;
  font-weight: 800;
  text-decoration: underline;
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.2s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 980px) {
  .login-shell {
    grid-template-columns: 1fr;
  }
  .promo-pane {
    display: none;
  }
}
</style>

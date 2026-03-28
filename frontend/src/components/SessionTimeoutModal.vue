<template>
  <Teleport to="body">
    <div v-if="show" class="session-overlay" role="dialog" aria-modal="true" aria-label="Session sur le point d'expirer">
      <div class="session-modal">
        <div class="session-icon">⏱️</div>
        <h3>Session sur le point d'expirer</h3>
        <p>Votre session va expirer dans <strong>moins d'une minute</strong> en raison d'inactivité.</p>
        <div class="session-actions">
          <button class="btn-stay" @click="$emit('stay')">Rester connecté</button>
          <button class="btn-logout" @click="$emit('logout')">Se déconnecter</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({ show: { type: Boolean, default: false } });
defineEmits(['stay', 'logout']);
</script>

<style scoped>
.session-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
}
.session-modal {
  background: white; border-radius: 1rem; padding: 2rem 2.5rem;
  max-width: 400px; width: 90%; text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.session-icon { font-size: 3rem; margin-bottom: 0.75rem; }
h3 { margin: 0 0 0.75rem; color: #1e3a8a; font-size: 1.1rem; }
p  { color: #475569; font-size: 0.9rem; margin: 0 0 1.5rem; line-height: 1.5; }
.session-actions { display: flex; gap: 0.75rem; justify-content: center; }
.btn-stay   { padding: 0.6rem 1.5rem; background: #1d4ed8; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600; font-size: 0.9rem; }
.btn-stay:hover { background: #1e3a8a; }
.btn-logout { padding: 0.6rem 1.5rem; background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 0.5rem; cursor: pointer; font-size: 0.9rem; }
.btn-logout:hover { background: #f8fafc; }
</style>

<!-- frontend/src/components/auth/SecurityBadge.vue -->
<template>
  <div class="security-badge">
    <span class="lock-icon">🔐</span>
    <span class="badge-text">PORTAL SÉCURISÉ</span>
  </div>
</template>

<script setup lang="ts">
// Composant statique
</script>

<style scoped lang="scss">
.security-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 100px;
  backdrop-filter: blur(10px);
  animation: slideIn 0.6s ease;
  
  .lock-icon {
    font-size: 14px;
  }
  
  .badge-text {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    color: #60a5fa;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
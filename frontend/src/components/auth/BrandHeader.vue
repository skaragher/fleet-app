<template>
  <div class="brand-section">
    <div class="logo-container">
      <div class="fuel-icon">⛽</div>
      <div class="icon-glow"></div>
    </div>
    <div class="brand-info">
      <h1 class="brand-title">FLOTTECH</h1>
      <p class="brand-subtitle">Gestion Intelligente d'Énergie Mobile</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Composant statique
</script>

<style scoped lang="scss">
.brand-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  animation: fadeIn 0.8s ease;
}

.logo-container {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fuel-icon {
  font-size: 36px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.5));
  animation: float 3s ease-in-out infinite;
}

.icon-glow {
  position: absolute;
  width: 80px;
  height: 80px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.brand-info {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 2rem;
  font-weight: 800;
  font-family: 'Outfit', sans-serif;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.brand-subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 1px;
  text-transform: uppercase;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
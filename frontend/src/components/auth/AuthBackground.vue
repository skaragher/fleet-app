<!-- frontend/src/components/auth/AuthBackground.vue -->
<template>
  <div class="auth-background">
    <!-- Flux d'énergie animé -->
    <div class="energy-flow"></div>
    
    <!-- Grille de fond -->
    <div class="grid-overlay"></div>
    
    <!-- Champ de particules -->
    <div class="particle-field"></div>
    
    <!-- Orbes lumineux -->
    <div class="glow-orb glow-orb-1"></div>
    <div class="glow-orb glow-orb-2"></div>
    <div class="glow-orb glow-orb-3"></div>
  </div>
</template>

<script setup lang="ts">
// Pas de logique nécessaire - composant purement visuel
</script>

<style scoped lang="scss">
.auth-background {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

.energy-flow {
  position: absolute;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(59, 130, 246, 0.08) 50%,
    transparent 70%
  );
  animation: flow 15s linear infinite;
  top: -50%;
  left: -50%;
}

@keyframes flow {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
}

.particle-field {
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(1px 1px at 10% 20%, rgba(59, 130, 246, 0.4) 1px, transparent 2px),
    radial-gradient(1px 1px at 30% 50%, rgba(99, 102, 241, 0.3) 1px, transparent 2px),
    radial-gradient(1px 1px at 70% 30%, rgba(14, 165, 233, 0.4) 1px, transparent 2px),
    radial-gradient(1.5px 1.5px at 90% 80%, rgba(6, 182, 212, 0.3) 1px, transparent 2px);
  background-size: 200px 200px;
  animation: particles 20s linear infinite;
}

@keyframes particles {
  from { background-position: 0 0; }
  to { background-position: 200px 200px; }
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: pulse 8s ease-in-out infinite;
  
  &-1 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%);
    top: -100px;
    left: -100px;
  }
  
  &-2 {
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%);
    bottom: -50px;
    right: -50px;
    animation-delay: -4s;
  }
  
  &-3 {
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation-delay: -2s;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}
</style>
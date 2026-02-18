<template>
  <label class="row">
    <div class="label">{{ label }}</div>
    <div><slot /></div>
  </label>
</template>

<script setup>
defineProps({ label: String });
</script>

<style scoped>
.row{ display:grid; grid-template-columns: 160px 1fr; gap:10px; align-items:center; }
.label{ font-size:13px; opacity:.8; }
@media (max-width: 800px){ .row{ grid-template-columns: 1fr; } }
</style>

<template>
  <div class="container">
    <h2 class="main-title">Consommation aux 100 KM</h2>

    <div class="grid-stats">
      <!-- Tableau Global -->
      <div class="card shadow-sm">
        <table class="data-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Type</th>
              <th>Distance Totale</th>
              <th>Consommation Moyenne</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in vehicleStats" :key="v.id" @click="showDetails(v)" class="clickable-row">
              <td><strong>{{ v.plate }}</strong></td>
              <td><span class="badge">{{ v.fuelType }}</span></td>
              <td>{{ v.totalKm.toLocaleString() }} KM</td>
              <td class="consumption-val">{{ v.avgConsumption }} L/100</td>
              <td>
                <span :class="v.avgConsumption > 15 ? 'text-danger' : 'text-success'">
                  {{ v.avgConsumption > 15 ? '⚠️ Élevée' : '✅ Normale' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Panneau Détails (S'affiche au clic) -->
      <div v-if="selectedVehicle" class="card detail-panel animate-fade">
        <div class="panel-header">
          <h3>Détails Mensuels : {{ selectedVehicle.plate }}</h3>
          <button @click="selectedVehicle = null" class="btn-close">×</button>
        </div>
        
        <div class="monthly-list">
          <div v-for="m in monthlyDetails" :key="m.month" class="monthly-item">
            <span class="month-name">{{ m.month }}</span>
            <span class="month-val"><strong>{{ m.liters.toFixed(1) }} L</strong> ({{ m.count }} pleins)</span>
          </div>
        </div>
        
        <div v-if="monthlyDetails.length === 0" class="empty-msg">
          Aucune donnée détaillée pour ce véhicule.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import api from "../services/api";

const vehicleStats = ref([]);
const selectedVehicle = ref(null);
const monthlyDetails = ref([]);

async function loadStats() {
  const res = await api.get("/fuel/stats/consumption");
  vehicleStats.value = res.data;
}

async function showDetails(v) {
  selectedVehicle.value = v;
  const res = await api.get(`/fuel/stats/consumption/${v.id}`);
  monthlyDetails.value = res.data;
}

onMounted(loadStats);
</script>

<style scoped>
.grid-stats { display: grid; grid-template-columns: 1fr 350px; gap: 20px; align-items: start; }
@media (max-width: 900px) { .grid-stats { grid-template-columns: 1fr; } }

.clickable-row { cursor: pointer; transition: background 0.2s; }
.clickable-row:hover { background: #f8fafc; }

.consumption-val { font-weight: 800; color: #1e293b; font-size: 1.1rem; }
.detail-panel { border-left: 5px solid #3b82f6; position: sticky; top: 20px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }

.monthly-item { 
  display: flex; justify-content: space-between; padding: 12px 0; 
  border-bottom: 1px solid #f1f5f9; 
}
.month-name { text-transform: capitalize; color: #64748b; font-weight: 600; }
.btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8; }
.animate-fade { animation: fadeIn 0.3s ease; }

@keyframes fadeIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
</style>

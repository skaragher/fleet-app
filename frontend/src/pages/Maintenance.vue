<template>
  <div class="container">
    <h2 class="main-title">Entretien & Maintenance</h2>

    <div class="grid-layout">
      <!-- FORMULAIRE PLANIFICATION / MODIFICATION -->
      <div v-if="!showCompletionForm" class="card" :class="isEditing ? 'card-orange' : 'card-blue'">
        <div class="card-header">
          <span>{{ isEditing ? '📝 Modification' : '🛠 Planifier un entretien' }}</span>
          <button v-if="isEditing" @click="cancelEdit" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body">
          <div class="compact-form">
            <div class="row">
              <div class="field flex-2">
                <label>Véhicule</label>
                <select v-model="form.vehicleId" @change="handleVehicleChange" class="custom-input">
                  <option value="" disabled>Choisir véhicule...</option>
                  <option v-for="v in activeVehicles" :key="v.id" :value="v.id">{{ v.plate }}</option>
                </select>
              </div>
              <div class="field flex-2">
                <label>Type de maintenance</label>
                <select v-model="form.maintenanceType" class="custom-input highlight-type">
                  <option value="REVISION">REVISION</option>
                  <option value="VIDANGE">VIDANGE</option>
                  <option value="REPARATION">REPARATION</option>
                  <option value="DEPANNAGE">DEPANNAGE</option>
                </select>
              </div>
              <div class="field flex-1">
                <label>Km Compteur <small v-if="selectedVehicle" class="info-km">({{ selectedVehicle.odometerKm }})</small></label>
                <input type="number" v-model.number="form.odometerKm" class="custom-input" />
              </div>
            </div>
            <div class="row mt-20">
              <div class="field flex-1">
                <label>Date prévue</label>
                <input type="date" v-model="form.dueAt" class="custom-input" />
              </div>
              <div class="field flex-1">
                <label>Coût Est.</label>
                <input type="number" v-model.number="form.cost" class="custom-input" />
              </div>
              <div class="field flex-2">
                <label>Description initiale</label>
                <input type="text" v-model="form.description" class="custom-input" placeholder="Notes..." />
              </div>
              <button class="btn-primary" :class="{'btn-orange': isEditing}" @click="processSubmit" :disabled="submitting || !form.vehicleId" style="height: 38px;">
                {{ submitting ? '...' : (isEditing ? 'Valider' : 'Planifier') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- FORMULAIRE DE CLÔTURE (VERT) -->
      <div v-else class="card card-green animate-in">
        <div class="card-header">
          <span>✅ Confirmer l'exécution : {{ plate(completionForm.vehicleId) }}</span>
          <button @click="showCompletionForm = false" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body bg-light-green">
          <div class="compact-form">
            <div class="row">
              <div class="field flex-1">
                <label>Coût Réel (Obligatoire)</label>
                <input type="number" v-model.number="completionForm.cost" class="custom-input border-success" />
              </div>
              <div class="field flex-3">
                <label>Commentaire final (Obligatoire)</label>
                <input type="text" v-model="completionForm.comment" class="custom-input border-success" placeholder="Détails des travaux..." />
              </div>
              <button class="btn-success" @click="submitCompletion" :disabled="submitting || !completionForm.cost || !completionForm.comment">
                {{ submitting ? '...' : 'Valider la réalisation' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TABLEAU -->
      <div class="station-block shadow-sm mt-20">
        <div class="station-banner">
          <span>Historique des opérations</span>
          <div class="pagination-controls">
            <button @click="currentPage--" :disabled="currentPage === 1" class="btn-page">«</button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button @click="currentPage++" :disabled="currentPage === totalPages" class="btn-page">»</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="tank-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Véhicule</th>
                <th>Type / Description</th>
                <th class="text-right">Coût</th>
                <th class="text-center">Statut</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in paginatedItems" :key="it.id">
                <td>{{ it.dueAt ? new Date(it.dueAt).toLocaleDateString() : '—' }}</td>
                <td><strong>{{ plate(it.vehicleId) }}</strong></td>
                <td>
                  <span class="type-tag">{{ it.maintenanceType }}</span><br/>
                  <small>{{ it.description }}</small>
                </td>
                <td class="text-right total-price">{{ it.cost?.toLocaleString() || 0 }} <small>FCFA</small></td>
                <td class="text-center">
                  <span class="badge" :class="it.status === 'DONE' ? 'badge-success' : 'badge-warn'">
                    {{ it.status === 'DONE' ? 'EFFECTUÉ' : 'À FAIRE' }}
                  </span>
                </td>
                <td class="text-center">
                  <div class="action-buttons">
                    <button v-if="it.status !== 'DONE'" @click="openCompletion(it)" class="btn-icon btn-complete">✔️</button>
                    <button @click="editItem(it)" class="btn-icon">✏️</button>
                    <button @click="remove(it.id)" class="btn-icon btn-del">🗑️</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api from "../services/api";

const vehicles = ref([]);
const items = ref([]);
const submitting = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const showCompletionForm = ref(false);
const currentPage = ref(1);
const itemsPerPage = 10;

const initialForm = { vehicleId: "", maintenanceType: "VIDANGE", description: "", cost: 0, odometerKm: 0, dueAt: "", status: "PLANNED" };
const form = ref({ ...initialForm });
const completionForm = ref({ id: null, vehicleId: "", cost: null, comment: "" });

const activeVehicles = computed(() => vehicles.value.filter(v => v.status === 'EN_SERVICE' || v.status === 'ACTIF'));
const selectedVehicle = computed(() => vehicles.value.find(v => v.id === form.value.vehicleId));
const totalPages = computed(() => Math.ceil(items.value.length / itemsPerPage) || 1);
const paginatedItems = computed(() => items.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage));

const plate = (id) => vehicles.value.find(v => v.id === id)?.plate || "—";

async function load() {
  try {
    const [v, m] = await Promise.all([api.get("/vehicles"), api.get("/maintenance")]);
    vehicles.value = v.data;
    items.value = m.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) { console.error("Erreur chargement", e); }
}

function handleVehicleChange() {
  if (selectedVehicle.value) form.value.odometerKm = selectedVehicle.value.odometerKm;
}

function openCompletion(it) {
  completionForm.value = { id: it.id, vehicleId: it.vehicleId, cost: it.cost || 0, comment: "" };
  showCompletionForm.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitCompletion() {
  submitting.value = true;
  try {
    await api.put(`/maintenance/${completionForm.value.id}`, {
      cost: Number(completionForm.value.cost),
      description: completionForm.value.comment,
      status: "DONE",
      doneAt: new Date().toISOString()
    });
    showCompletionForm.value = false;
    await load();
  } catch (e) { alert("Erreur opération"); }
  finally { submitting.value = false; }
}

async function processSubmit() {
  submitting.value = true;
  try {
    const payload = { 
      ...form.value,
      cost: Number(form.value.cost),
      odometerKm: Number(form.value.odometerKm),
      // Crucial: Transformer la date YYYY-MM-DD en ISO string pour le validateur .datetime()
      dueAt: form.value.dueAt ? new Date(form.value.dueAt).toISOString() : null,
      status: form.value.status || "PLANNED"
    };

    if (isEditing.value) await api.put(`/maintenance/${editingId.value}`, payload);
    else await api.post("/maintenance", payload);
    
    cancelEdit();
    await load();
  } catch (e) { 
    console.error(e.response?.data);
    alert("Erreur opération : " + (e.response?.data?.message || "Vérifiez les champs")); 
  }
  finally { submitting.value = false; }
}

function editItem(it) {
  isEditing.value = true;
  editingId.value = it.id;
  // Formatage date pour l'input type="date"
  const dateStr = it.dueAt ? it.dueAt.substring(0, 10) : "";
  form.value = { ...it, dueAt: dateStr };
  showCompletionForm.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() { isEditing.value = false; editingId.value = null; form.value = { ...initialForm }; }
async function remove(id) { if (confirm("Supprimer ?")) { await api.delete(`/maintenance/${id}`); await load(); } }
onMounted(load);
</script>

<style scoped>
/* Les styles restent identiques à la version précédente */
.container { padding: 20px; font-family: 'Segoe UI', sans-serif; background: #f4f7f6; min-height: 100vh; }
.main-title { color: #2c3e50; font-size: 1.5rem; margin-bottom: 20px; border-left: 5px solid #3498db; padding-left: 15px; }
.card { border-radius: 8px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); background: white; border: none; }
.card-blue { border-top: 4px solid #3498db; }
.card-orange { border-top: 4px solid #e67e22; }
.card-green { border-top: 4px solid #27ae60; }
.card-header { padding: 12px 20px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; }
.card-body { padding: 20px; }
.bg-light-green { background: #fafffb; }
.row { display: flex; gap: 15px; align-items: flex-end; }
.mt-20 { margin-top: 20px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.7rem; font-weight: 800; color: #7f8c8d; text-transform: uppercase; }
.flex-1 { flex: 1; } .flex-2 { flex: 2; } .flex-3 { flex: 3; }
.custom-input { padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 0.9rem; }
.border-success { border: 2px solid #27ae60 !important; }
.btn-primary { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
.btn-orange { background: #e67e22; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
.btn-success { background: #27ae60; color: white; border: none; padding: 10px 25px; border-radius: 5px; cursor: pointer; font-weight: bold; }
.btn-success:disabled { background: #bdc3c7; }
.btn-cancel { background: #95a5a6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }
.station-banner { background: #2c3e50; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
.tank-table { width: 100%; border-collapse: collapse; }
.tank-table th { background: #f8f9fa; padding: 12px; font-size: 0.7rem; color: #7f8c8d; text-transform: uppercase; text-align: left; border-bottom: 2px solid #eee; }
.tank-table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 0.85rem; }
.badge { padding: 4px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: bold; }
.badge-warn { background: #fef3c7; color: #92400e; }
.badge-success { background: #d1fae5; color: #065f46; }
.type-tag { background: #e1f5fe; color: #0288d1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.btn-complete { background: #d1fae5 !important; color: #065f46; }
.action-buttons { display: flex; gap: 5px; justify-content: center; }
.btn-icon { border: none; padding: 6px; border-radius: 4px; cursor: pointer; background: #f1f2f6; }
.animate-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
</style>

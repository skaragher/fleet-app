<template>
  <div class="page-container">
    <div class="header-flex">
      <h2 class="title">🚗 Gestion du Parc <span class="badge">{{ items.length }}</span></h2>
      <transition name="shake">
        <div v-if="error" class="error-pill">⚠️ {{ error }}</div>
      </transition>
    </div>

    <div :class="['toolbar-form shadow-sm', { 'edit-mode': editingId }]">
      <div class="input-grid">
        <div class="input-group">
          <label>Plaque *</label>
          <input v-model="form.plate" placeholder="Ex: 1234AB01" />
        </div>
        <div class="input-group">
          <label>Châssis *</label>
          <input v-model="form.chassisNumber" placeholder="N° Châssis" />
        </div>
        <div class="input-group mini">
          <label>Modèle</label>
          <input v-model="form.model" placeholder="Ex: Hilux" />
        </div>
        <div class="input-group mini">
          <label>Carburant</label>
          <select v-model="form.fuelType" :disabled="editingId">
            <option value="DIESEL">DIESEL</option>
            <option value="SUPER">SUPER</option>
            <option value="LUBRIFIANT">LUBRIFIANT</option>
            <option value="HUILE">HUILE</option>
          </select>
        </div>
        <div class="input-group mini">
          <label>Km</label>
          <input type="number" v-model.number="form.odometerKm" />
        </div>
        <div class="input-group mini">
          <label>Statut</label>
          <select v-model="form.status">
            <option value="EN_SERVICE">EN SERVICE</option>
            <option value="EN_REPARATION">EN RÉPARATION</option>
            <option value="HORS_SERVICE">HORS SERVICE</option>
          </select>
        </div>
        
        <div class="actions-btn">
          <button v-if="!editingId" class="btn-save" @click="create">
            ＋ Enregistrer
          </button>
          <template v-else>
            <button class="btn-update" @click="update">💾 Modification</button>
            <button class="btn-cancel" @click="cancelEdit">✕ Quitter</button>
          </template>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Marque/Model</th>
              <th>Carburant</th>
              <th>Kilométrage</th>
              <th>Statut</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in items" :key="v.id" :class="{ 'row-editing': editingId === v.id }">
              <td>
                <div class="primary-td">{{ v.plate }}</div>
                <div class="secondary-td">{{ v.chassisNumber }} ({{ v.make || 'N/A' }})</div>
              </td>
              <td>{{ v.make }} {{ v.model }}</td>
              <td><span :class="['pill-fuel', v.fuelType.toLowerCase()]">{{ v.fuelType }}</span></td>
              <td class="km-cell">{{ v.odometerKm.toLocaleString() }} km</td>
              <td>
                <div class="status-wrapper">
                  <span :class="['status-dot', v.status.toLowerCase()]"></span>
                  <span class="status-text">{{ v.status.replace('_', ' ') }}</span>
                </div>
              </td>
              <td class="text-right">
                <button class="btn-edit" @click="prepareEdit(v)" title="Modifier">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                <button class="btn-del" @click="remove(v.id)" title="Supprimer">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="items.length === 0" class="empty-state">Aucun véhicule dans la base.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import api from "../services/api";

const items = ref([]);
const error = ref("");
const editingId = ref(null);

const initialForm = {
  plate: "",
  make: "",
  model: "",
  fuelType: "DIESEL",
  chassisNumber: "",
  odometerKm: 0,
  status: "EN_SERVICE"
};

const form = ref({ ...initialForm });

async function load() {
  try {
    const res = await api.get("/vehicles");
    items.value = res.data || [];
  } catch (e) { console.error("Erreur de chargement", e); }
}

async function create() {
  error.value = "";
  try {
    // commissioningDate ajouté pour valider vehicleSchema.datetime()
    await api.post("/vehicles", { 
      ...form.value, 
      commissioningDate: new Date().toISOString() 
    });
    form.value = { ...initialForm };
    await load();
  } catch (e) {
    error.value = e.response?.data?.issues?.[0]?.message || e.response?.data?.message || "Erreur de création";
  }
}

function prepareEdit(v) {
  editingId.value = v.id;
  form.value = { ...v };
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingId.value = null;
  form.value = { ...initialForm };
  error.value = "";
}

async function update() {
  error.value = "";
  try {
    await api.put(`/vehicles/${editingId.value}`, form.value);
    cancelEdit();
    await load();
  } catch (e) {
    error.value = "Erreur lors de la mise à jour";
  }
}

async function remove(id) {
  error.value = "";
  if (confirm("Supprimer définitivement ce véhicule ?")) {
    try {
      await api.delete(`/vehicles/${id}`);
      await load();
    } catch (e) {
      // Capturer l'erreur de contrainte d'intégrité (Prisma P2003)
      if (e.response?.status === 400 || e.response?.data?.message?.includes("foreign key")) {
        error.value = "Impossible de supprimer : ce véhicule est lié à des ravitaillements existants.";
      } else {
        error.value = "Erreur lors de la suppression.";
      }
      setTimeout(() => error.value = "", 6000);
    }
  }
}

onMounted(load);
</script>

<style scoped>
.page-container { padding: 16px; font-family: 'Inter', sans-serif; max-width: 1400px; margin: 0 auto; }

/* HEADER */
.header-flex { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; min-height: 45px; }
.title { margin: 0; font-size: 1.25rem; color: #1e293b; font-weight: 800; }
.badge { background: #4338ca; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; margin-left: 8px; }

/* ERREUR & ANIMATION */
.error-pill { background: #fee2e2; color: #b91c1c; padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; border: 1px solid #fecaca; }
.shake-enter-active { animation: shake 0.4s; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

/* TOOLBAR & INPUTS */
.toolbar-form { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 25px; transition: all 0.3s ease; }
.edit-mode { border: 2px solid #10b981 !important; background: #f0fdf4 !important; }

.input-grid { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.input-group { display: flex; flex-direction: column; gap: 5px; flex: 2; min-width: 140px; }
.input-group.mini { flex: 1; min-width: 100px; }
.input-group label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.input-group input, .input-group select { height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 10px; font-size: 13px; background: white; }

/* BOUTONS ACTIONS (TAILLE ÉQUIVALENTE) */
.actions-btn { display: flex; gap: 10px; flex: 1; min-width: 240px; }
.btn-save, .btn-update, .btn-cancel {
  height: 38px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
  transition: 0.2s; border: none; display: flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-save { width: 100%; background: #4338ca; color: white; }
.btn-update { flex: 1; background: #10b981; color: white; }
.btn-cancel { flex: 1; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
.btn-save:hover, .btn-update:hover { filter: brightness(1.1); transform: translateY(-1px); }

/* TABLEAU */
.table-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
.table-scroll { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.data-table th { background: #f8fafc; padding: 14px; text-align: left; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
.data-table td { padding: 14px; border-bottom: 1px solid #f1f5f9; }

.primary-td { font-weight: 700; color: #1e293b; }
.secondary-td { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.pill-fuel { padding: 2px 8px; border-radius: 5px; font-size: 10px; font-weight: 800; }
.pill-fuel.diesel { background: #e0f2fe; color: #0369a1; }
.pill-fuel.super { background: #fee2e2; color: #991b1b; }

.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
.status-dot.en_service { background: #10b981; box-shadow: 0 0 5px #10b981; }
.status-dot.en_reparation { background: #f59e0b; }
.status-dot.hors_service { background: #ef4444; }

.text-right { text-align: right; }
.btn-icon { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 6px; transition: 0.2s; font-size: 1rem; }
.btn-edit { color: #007bff; background: none; border: none; cursor: pointer; }
.btn-del { color: #dc3545; background: none; border: none; cursor: pointer; }
.btn-icon.edit:hover { background: #e0e7ff; }
.btn-icon.trash:hover { background: #fee2e2; }

.row-editing { background-color: #f0f7ff !important; }
.empty-state { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; }

@media (max-width: 900px) {
  .input-group { flex: 1 1 calc(50% - 12px); }
  .actions-btn { flex: 1 1 100%; }
}
</style>
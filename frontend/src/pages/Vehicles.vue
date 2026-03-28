<template>
  <div class="page-container">
    <template v-if="isDriverMobile">
      <div class="mobile-driver-header">
        <h2 class="title">🚗 Mon véhicule</h2>
      </div>

      <div v-if="driverVehicle" class="mobile-driver-card">
        <div class="mobile-driver-line">
          <span>Plaque</span>
          <strong>{{ driverVehicle.plate }}</strong>
        </div>
        <div class="mobile-driver-line">
          <span>Modèle</span>
          <strong>{{ driverVehicle.make || "-" }} {{ driverVehicle.model || "" }}</strong>
        </div>
        <div class="mobile-driver-line">
          <span>Kilométrage</span>
          <strong>{{ Number(driverVehicle.odometerKm || 0).toLocaleString() }} km</strong>
        </div>
        <div class="mobile-driver-line">
          <span>Statut</span>
          <strong>{{ String(driverVehicle.status || "").replaceAll("_", " ") || "-" }}</strong>
        </div>
      </div>

      <div v-if="driverVehicle" class="mobile-driver-card">
        <h3>Dernier ravitaillement</h3>
        <p v-if="driverLastDispense">
          {{ formatDate(driverLastDispense.dispensedAt) }} • {{ Number(driverLastDispense.liters || 0).toLocaleString() }} L
        </p>
        <p v-else class="muted">Aucun ravitaillement trouvé.</p>
      </div>

      <div v-if="driverVehicle" class="mobile-driver-card">
        <h3>Assurance</h3>
        <p v-if="driverLatestInsurance">
          Expire le {{ formatDate(driverLatestInsurance.endAt) }}
        </p>
        <p v-else class="muted">Aucune assurance trouvée.</p>
      </div>

      <div v-if="driverVehicle" class="mobile-driver-card">
        <h3>Visite technique</h3>
        <p v-if="driverLatestInspection">
          Prochaine: {{ formatDate(driverLatestInspection.nextInspect || driverLatestInspection.scheduledAt) }}
        </p>
        <p v-else class="muted">Aucune visite trouvée.</p>
      </div>

      <div v-if="driverVehicle" class="mobile-driver-card">
        <h3>Maintenance</h3>
        <p v-if="driverNextMaintenance">
          {{ driverNextMaintenance.description || "Entretien" }} • {{ formatDate(driverNextMaintenance.dueAt) }}
        </p>
        <p v-else class="muted">Aucune maintenance planifiée.</p>
      </div>

      <div v-if="!driverVehicle" class="empty-state">
        Aucun véhicule assigné à ce compte chauffeur.
      </div>
    </template>

    <template v-else>
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
          <label>Marque</label>
          <input v-model="form.make" placeholder="Ex: Toyota" />
        </div>
        <div class="input-group mini">
          <label>Modèle</label>
          <input v-model="form.model" placeholder="Ex: Hilux" />
        </div>
        <div class="input-group mini">
          <label>Mise en circulation</label>
          <input type="date" v-model="form.commissioningDate" />
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
          <label>Catégorie</label>
          <select v-model="form.category">
            <option :value="null">— Non définie —</option>
            <option value="CITADINE">Citadine (7 L/100km)</option>
            <option value="BERLINE_SUV">Berline / SUV (10 L/100km)</option>
            <option value="PICKUP_4X4">Pick-up / 4x4 (12 L/100km)</option>
            <option value="PETIT_CAMION">Petit camion 3-7t (18 L/100km)</option>
            <option value="POIDS_LOURD">Poids lourd 15-20t (28 L/100km)</option>
            <option value="GROS_PORTEUR">Gros porteur 40t (38 L/100km)</option>
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
              <th>Catégorie</th>
              <th>Mise en circulation</th>
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
              <td><span v-if="v.category" class="pill-category">{{ CATEGORY_LABELS[v.category] }}</span><span v-else class="muted">—</span></td>
              <td>{{ formatDate(v.commissioningDate) }}</td>
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
                <button class="btn-history" @click="loadDriverHistory(v)" title="Historique chauffeurs">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 3v5h5"></path><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path><path d="M12 7v5l3 3"></path></svg>
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

    <div v-if="selectedHistoryVehicle" class="table-card history-card">
      <div class="history-head">
        <h3>Historique chauffeurs - {{ selectedHistoryVehicle.plate }}</h3>
        <button class="btn-cancel" @click="clearDriverHistory">Fermer</button>
      </div>

      <div v-if="historyError" class="error-pill">⚠️ {{ historyError }}</div>
      <div v-else-if="loadingHistory" class="empty-state">Chargement de l'historique...</div>
      <div v-else-if="!vehicleDriverHistory.length" class="empty-state">Aucun historique d'affectation.</div>

      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Chauffeur</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Affecté par</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in vehicleDriverHistory" :key="h.id">
              <td>
                <div class="primary-td">{{ h.user?.name || h.userName || "-" }}</div>
                <div class="secondary-td">{{ h.user?.email || h.userEmail || "-" }}</div>
              </td>
              <td>{{ formatDateTime(h.assignedAt) }}</td>
              <td>{{ h.unassignedAt ? formatDateTime(h.unassignedAt) : "En cours" }}</td>
              <td>{{ h.assignedBy?.name || "Système" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import api from "../services/api";
import { useAuthStore } from "../stores/auth";

const CATEGORY_LABELS = {
  CITADINE:     'Citadine',
  BERLINE_SUV:  'Berline/SUV',
  PICKUP_4X4:   'Pick-up/4x4',
  PETIT_CAMION: 'Pt Camion',
  POIDS_LOURD:  'Poids Lourd',
  GROS_PORTEUR: 'Gros Porteur',
};

const items = ref([]);
const error = ref("");
const editingId = ref(null);
const authStore = useAuthStore();
const viewportWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1200);
const isMobile = computed(() => viewportWidth.value <= 768);
const isDriver = computed(() => authStore.user?.role === "DRIVER");
const isDriverMobile = computed(() => isDriver.value && isMobile.value);
const assignedVehicleId = computed(() => String(authStore.user?.assignedVehicleId || ""));
const driverDispenses = ref([]);
const driverInsurances = ref([]);
const driverInspections = ref([]);
const driverMaintenances = ref([]);
const selectedHistoryVehicle = ref(null);
const vehicleDriverHistory = ref([]);
const loadingHistory = ref(false);
const historyError = ref("");

const initialForm = {
  plate: "",
  make: "",
  model: "",
  commissioningDate: "",
  fuelType: "DIESEL",
  category: null,
  chassisNumber: "",
  odometerKm: 0,
  status: "EN_SERVICE"
};

const form = ref({ ...initialForm });

async function load() {
  try {
    const requests = [api.get("/vehicles")];
    if (isDriver.value) {
      requests.push(api.get("/fuel/dispenses"));
      requests.push(api.get("/insurance"));
      requests.push(api.get("/inspections"));
      requests.push(api.get("/maintenance"));
    }

    const [vehiclesRes, dispensesRes, insurancesRes, inspectionsRes, maintenancesRes] = await Promise.all(requests);
    items.value = vehiclesRes.data || [];
    driverDispenses.value = dispensesRes?.data || [];
    driverInsurances.value = insurancesRes?.data || [];
    driverInspections.value = inspectionsRes?.data || [];
    driverMaintenances.value = maintenancesRes?.data || [];
  } catch (e) { console.error("Erreur de chargement", e); }
}

async function create() {
  error.value = "";
  try {
    await api.post("/vehicles", {
      ...form.value,
      commissioningDate: toIsoDateOrNull(form.value.commissioningDate),
    });
    form.value = { ...initialForm };
    await load();
  } catch (e) {
    error.value = e.response?.data?.issues?.[0]?.message || e.response?.data?.message || "Erreur de création";
  }
}

function prepareEdit(v) {
  editingId.value = v.id;
  form.value = {
    ...v,
    commissioningDate: toInputDate(v.commissioningDate),
  };
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
    await api.put(`/vehicles/${editingId.value}`, {
      ...form.value,
      commissioningDate: toIsoDateOrNull(form.value.commissioningDate),
    });
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

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR");
};

function clearDriverHistory() {
  selectedHistoryVehicle.value = null;
  vehicleDriverHistory.value = [];
  historyError.value = "";
}

async function loadDriverHistory(vehicle) {
  selectedHistoryVehicle.value = vehicle;
  vehicleDriverHistory.value = [];
  historyError.value = "";
  loadingHistory.value = true;
  try {
    const res = await api.get(`/vehicles/${vehicle.id}/driver-history`);
    vehicleDriverHistory.value = res.data || [];
  } catch (e) {
    historyError.value = e?.response?.data?.message || "Impossible de charger l'historique du véhicule.";
  } finally {
    loadingHistory.value = false;
  }
}

const driverVehicle = computed(() => items.value.find((v) => String(v.id) === assignedVehicleId.value) || null);
const driverLastDispense = computed(() =>
  driverDispenses.value
    .filter((d) => String(d.vehicleId || d.vehicle?.id || "") === assignedVehicleId.value)
    .sort((a, b) => new Date(b.dispensedAt || 0) - new Date(a.dispensedAt || 0))[0] || null
);
const driverLatestInsurance = computed(() =>
  driverInsurances.value
    .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId.value)
    .sort((a, b) => new Date(b.endAt || 0) - new Date(a.endAt || 0))[0] || null
);
const driverLatestInspection = computed(() =>
  driverInspections.value
    .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId.value)
    .sort((a, b) => new Date((b.nextInspect || b.scheduledAt || 0)) - new Date((a.nextInspect || a.scheduledAt || 0)))[0] || null
);
const driverNextMaintenance = computed(() =>
  driverMaintenances.value
    .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === assignedVehicleId.value)
    .filter((m) => m.status !== "DONE")
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0))[0] || null
);

const toIsoDateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const toInputDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "-");
const handleResize = () => { viewportWidth.value = window.innerWidth; };

onMounted(() => {
  load();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});
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
.pill-category { padding: 2px 8px; border-radius: 5px; font-size: 10px; font-weight: 700; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }

.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
.status-dot.en_service { background: #10b981; box-shadow: 0 0 5px #10b981; }
.status-dot.en_reparation { background: #f59e0b; }
.status-dot.hors_service { background: #ef4444; }

.text-right { text-align: right; }
.btn-icon { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 6px; transition: 0.2s; font-size: 1rem; }
.btn-edit { color: #007bff; background: none; border: none; cursor: pointer; }
.btn-history { color: #1d4ed8; background: none; border: none; cursor: pointer; margin: 0 8px; }
.btn-del { color: #dc3545; background: none; border: none; cursor: pointer; }
.history-card { margin-top: 16px; padding: 12px; }
.history-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 4px 10px; }
.history-head h3 { margin: 0; font-size: 1rem; color: #1e293b; font-weight: 800; }
.btn-icon.edit:hover { background: #e0e7ff; }
.btn-icon.trash:hover { background: #fee2e2; }

.row-editing { background-color: #f0f7ff !important; }
.empty-state { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; }

.mobile-driver-header {
  margin-bottom: 12px;
}

.mobile-driver-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}

.mobile-driver-card h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #1e293b;
}

.mobile-driver-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}

.mobile-driver-line:last-child {
  border-bottom: none;
}

.mobile-driver-line span {
  color: #64748b;
  font-size: 12px;
}

.mobile-driver-line strong {
  color: #0f172a;
  font-size: 13px;
}

.muted {
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 900px) {
  .input-group { flex: 1 1 calc(50% - 12px); }
  .actions-btn { flex: 1 1 100%; }
}
</style>

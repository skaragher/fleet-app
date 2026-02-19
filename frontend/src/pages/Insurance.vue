<template>
  <div class="insurance">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1>Assurances</h1>
        <p class="date">{{ today }}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" :disabled="loading" @click="loadData">
          <span class="btn-icon">↻</span>
          Actualiser
        </button>
        <button class="btn btn-outline" :disabled="submitting" @click="resetForm">
          <span class="btn-icon">+</span>
          Nouveau
        </button>
      </div>
    </header>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon blue">📄</div>
        <div class="kpi-content">
          <span class="kpi-label">Polices actives</span>
          <span class="kpi-value">{{ activePolicies }}</span>
          <span class="kpi-trend">Total contrats</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon indigo">💰</div>
        <div class="kpi-content">
          <span class="kpi-label">Montant total</span>
          <span class="kpi-value">{{ compactAmount(totalPremium) }}</span>
          <span class="kpi-trend">Somme assurée</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon orange">⏳</div>
        <div class="kpi-content">
          <span class="kpi-label">À renouveler</span>
          <span class="kpi-value">{{ expiringSoon }}</span>
          <span class="kpi-trend">30 prochains jours</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon red">🚨</div>
        <div class="kpi-content">
          <span class="kpi-label">Expirées</span>
          <span class="kpi-value">{{ expiredPolicies }}</span>
          <span class="kpi-trend">Action requise</span>
        </div>
      </div>
    </div>

    <!-- Formulaire -->
    <div class="card">
      <div class="card-header">
        <h2>{{ isEditing ? 'Modifier le contrat' : 'Nouveau contrat' }}</h2>
        <button v-if="isEditing" class="btn btn-text" @click="cancelEdit">
          Annuler
        </button>
      </div>

      <div class="form">
        <div class="form-row">
          <div class="form-group">
            <label>Véhicule <span class="required">*</span></label>
            <select v-model="form.vehicleId" :class="{ error: submitted && !form.vehicleId }" @change="onVehicleChange">
              <option value="" disabled>Sélectionner un véhicule</option>
              <option
                v-for="v in selectableVehicles"
                :key="v.id"
                :value="v.id"
                :disabled="isVehicleInRepair(v)"
              >
                {{ v.plate }} - {{ v.model || 'N/A' }}{{ isVehicleInRepair(v) ? ' (EN RÉPARATION)' : '' }}
              </option>
            </select>
            <div v-if="form.vehicleId" class="field-hint" :class="hasActiveInsurance(form.vehicleId) ? 'warning' : 'success'">
              <span v-if="hasActiveInsurance(form.vehicleId)">
                ⚠️ Assurance active jusqu'au {{ formatDate(getActiveInsurance(form.vehicleId)?.endAt) }}
              </span>
              <span v-else>✅ Aucune assurance active</span>
            </div>
          </div>

          <div class="form-group">
            <label>Assureur <span class="required">*</span></label>
            <select v-model="form.insurerId" :class="{ error: submitted && !form.insurerId }" @change="handleInsurerChange">
              <option value="" disabled>Sélectionner un assureur</option>
              <option v-for="ins in insurers" :key="ins.id" :value="ins.id">{{ ins.name }}</option>
              <option value="NEW">+ Ajouter un assureur</option>
            </select>
          </div>
        </div>

        <!-- Nouvel assureur -->
        <div v-if="showNewInsurerInput" class="form-row">
          <div class="form-group">
            <label>Nom du nouvel assureur</label>
            <div class="input-group">
              <input v-model.trim="newInsurerName" type="text" placeholder="Ex: AXA Assurance" />
              <button class="btn btn-primary" :disabled="!newInsurerName" @click="saveNewInsurer">
                Ajouter
              </button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Type de couverture <span class="required">*</span></label>
            <select v-model="form.insurancesType">
              <option value="TIERS">Tiers Simple</option>
              <option value="INTERMEDIAIRE">Intermédiaire</option>
              <option value="TOUS_RISQUES">Tous Risques</option>
              <option value="RC">Responsabilité Civile</option>
            </select>
          </div>

          <div class="form-group">
            <label>N° de police <span class="required">*</span></label>
            <input v-model.trim="form.policyNo" type="text" placeholder="POL-2025-001" 
                   :class="{ error: submitted && !form.policyNo }" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Date de début <span class="required">*</span></label>
            <input v-model="form.startAt" type="date" @change="calculateEndDate" />
          </div>

          <div class="form-group">
            <label>Durée</label>
            <div class="duration-group">
              <input v-model.number="form.durationValue" type="number" min="1" @input="calculateEndDate" />
              <select v-model="form.durationUnit" @change="calculateEndDate">
                <option value="months">Mois</option>
                <option value="years">Années</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Date d'échéance</label>
            <input v-model="form.endAt" type="date" readonly class="readonly" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Coût annuel (FCFA) <span class="required">*</span></label>
            <input v-model.number="form.premium" type="number" min="0" step="1000" 
                   :class="{ error: submitted && !form.premium }" />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="submitting || !canSubmit" @click="submitForm">
            <span v-if="submitting" class="spinner"></span>
            {{ submitting ? 'Traitement...' : (isEditing ? 'Mettre à jour' : 'Enregistrer le contrat') }}
          </button>
        </div>

        <!-- Messages -->
        <div v-if="error" class="alert error">{{ error }}</div>
        <div v-if="success" class="alert success">{{ success }}</div>
      </div>
    </div>

    <!-- Liste des contrats -->
    <div class="card">
      <div class="card-header">
        <h2>Historique des contrats <span class="badge">{{ filteredItems.length }}</span></h2>
        <button class="btn btn-text" @click="clearFilters">Effacer les filtres</button>
      </div>

      <!-- Filtres -->
      <div class="filters">
        <input v-model="fromDate" type="date" placeholder="Date début" />
        <input v-model="toDate" type="date" placeholder="Date fin" />
        <input v-model.trim="searchPlate" type="text" placeholder="Rechercher une plaque..." />
        <select v-model="statusFilter">
          <option value="ALL">Tous les statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="EXPIRING">À renouveler</option>
          <option value="EXPIRED">Expirées</option>
        </select>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Assureur</th>
              <th>Période</th>
              <th>Statut</th>
              <th>Coût</th>
              <th>Modifiable</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedItems" :key="item.id">
              <td>
                <div class="cell-primary">{{ item.vehicle?.plate || '-' }}</div>
                <div class="cell-secondary">
                  {{ coverageLabel(item.insurancesType) }}
                  <span v-if="isVehicleInRepair(item.vehicle)"> • EN RÉPARATION</span>
                </div>
              </td>
              <td>
                <div class="cell-primary">{{ item.insurer?.name || '-' }}</div>
                <div class="cell-secondary">N° {{ item.policyNo || '-' }}</div>
              </td>
              <td>
                <div class="cell-primary">{{ formatDate(item.startAt) }} → {{ formatDate(item.endAt) }}</div>
              </td>
              <td>
                <span :class="['status', statusClass(item)]">{{ statusLabel(item) }}</span>
              </td>
              <td>
                <div class="cell-primary">{{ formatFCFA(item.premium) }}</div>
              </td>
              <td>
                <span :class="['badge-modifiable', canModify(item.createdAt) ? 'success' : 'error']">
                  {{ canModify(item.createdAt) ? 'Autorisé' : 'Verrouillé' }}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-icon-only" :disabled="!canModify(item.createdAt)" @click="startEdit(item)">
                    ✏️
                  </button>
                  <button class="btn-icon-only" :disabled="!canModify(item.createdAt)" @click="deleteItem(item)">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredItems.length">
              <td colspan="7" class="empty">Aucun contrat trouvé</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <span class="page-info">Page {{ currentPage }} / {{ totalPages }}</span>
        <div class="page-buttons">
          <button :disabled="currentPage === 1" @click="currentPage--">←</button>
          <button :disabled="currentPage === totalPages" @click="currentPage++">→</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import api from "../services/api";

// ==================== ÉTATS ====================
const loading = ref(false);
const submitting = ref(false);
const submitted = ref(false);
const error = ref("");
const success = ref("");

const vehicles = ref([]);
const insurers = ref([]);
const items = ref([]);
const allInsurances = ref([]);
const insuranceHistory = ref({});

const normalizeVehicleStatus = (status) => String(status || "").trim().toUpperCase();
const isVehicleOutOfService = (vehicle) => {
  const s = normalizeVehicleStatus(vehicle?.status);
  return s === "HORS_SERVICE" || s === "HORS SERVICE";
};
const isVehicleInRepair = (vehicle) => {
  const s = normalizeVehicleStatus(vehicle?.status);
  return s === "EN_REPARATION" || s === "EN REPARATION";
};
const isVehicleInService = (vehicle) => {
  const s = normalizeVehicleStatus(vehicle?.status);
  return s === "EN_SERVICE" || s === "EN SERVICE" || s === "ACTIF" || s === "ACTIVE";
};
const selectableVehicles = computed(() => vehicles.value.filter((v) => !isVehicleOutOfService(v)));
const selectedVehicle = computed(() => vehicles.value.find((v) => String(v.id) === String(form.vehicleId)));

const isEditing = ref(false);
const editingId = ref(null);

// Filtres
const fromDate = ref("");
const toDate = ref("");
const searchPlate = ref("");
const statusFilter = ref("ALL");
const currentPage = ref(1);
const pageSize = 10;

// Nouvel assureur
const showNewInsurerInput = ref(false);
const newInsurerName = ref("");

// ==================== FONCTIONS UTILITAIRES ====================
const formatDateInputLocal = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const formatFCFA = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR").format(num) + " FCFA";
};

const compactAmount = (amount) => {
  const n = Number(amount) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return n.toString();
};

const coverageLabel = (type) => {
  const labels = {
    TIERS: "Tiers",
    INTERMEDIAIRE: "Intermédiaire",
    TOUS_RISQUES: "Tous Risques",
    RC: "RC"
  };
  return labels[type] || type;
};

// ==================== DATES ====================
const daysDiff = (date) => {
  if (!date) return 9999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const calculateEndDate = () => {
  if (!form.startAt || !form.durationValue) return;

  const start = parseDateInput(form.startAt);
  const duration = Number(form.durationValue);
  
  if (!start || !duration || duration <= 0) return;

  const year = start.getFullYear();
  const month = start.getMonth();
  const day = start.getDate();
  
  let targetYear = year;
  let targetMonth = month;
  
  if (form.durationUnit === "years") {
    targetYear = year + duration;
  } else {
    const totalMonths = month + duration;
    targetYear = year + Math.floor(totalMonths / 12);
    targetMonth = totalMonths % 12;
  }
  
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  
  const end = new Date(targetYear, targetMonth, targetDay, 12, 0, 0);
  form.endAt = formatDateInputLocal(end);
};

// ==================== FORMULAIRE ====================
const form = reactive({
  vehicleId: "",
  insurerId: "",
  insurancesType: "TIERS",
  policyNo: "",
  premium: 0,
  durationValue: 12,
  durationUnit: "months",
  startAt: formatDateInputLocal(new Date()),
  endAt: "",
});

const canSubmit = computed(() => {
  return form.vehicleId && 
         form.insurerId && 
         form.insurerId !== "NEW" && 
         form.policyNo && 
         form.startAt && 
         form.endAt && 
         form.premium > 0 &&
         isVehicleInService(selectedVehicle.value);
});

// ==================== KPI ====================
const activePolicies = computed(() => items.value.filter(i => daysDiff(i.endAt) >= 0).length);
const expiringSoon = computed(() => items.value.filter(i => {
  const d = daysDiff(i.endAt);
  return d >= 0 && d <= 30;
}).length);
const expiredPolicies = computed(() => items.value.filter(i => daysDiff(i.endAt) < 0).length);
const totalPremium = computed(() => items.value.reduce((acc, i) => acc + (Number(i.premium) || 0), 0));

// ==================== FILTRES ====================
const filteredItems = computed(() => {
  return items.value.filter(item => {
    const plate = (item.vehicle?.plate || "").toLowerCase();
    if (searchPlate.value && !plate.includes(searchPlate.value.toLowerCase())) return false;

    const d = daysDiff(item.endAt);
    if (statusFilter.value === "ACTIVE" && d < 0) return false;
    if (statusFilter.value === "EXPIRING" && !(d >= 0 && d <= 30)) return false;
    if (statusFilter.value === "EXPIRED" && d >= 0) return false;

    const createdAt = item.createdAt ? formatDateInputLocal(item.createdAt) : "";
    if (fromDate.value && createdAt < fromDate.value) return false;
    if (toDate.value && createdAt > toDate.value) return false;

    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize)));
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredItems.value.slice(start, start + pageSize);
});

// ==================== STATUTS ====================
const statusClass = (item) => {
  const d = daysDiff(item.endAt);
  if (d < 0) return "expired";
  if (d <= 30) return "warning";
  return "active";
};

const statusLabel = (item) => {
  const d = daysDiff(item.endAt);
  if (d < 0) return `Expirée (${Math.abs(d)}j)`;
  if (d <= 30) return `${d} jours`;
  return "Active";
};

// ==================== MODIFICATION ====================
const MODIFICATION_HOURS = 72;

const canModify = (createdAt) => {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const diffHours = (Date.now() - created) / (1000 * 60 * 60);
  return diffHours <= MODIFICATION_HOURS;
};

// ==================== VÉHICULES ====================
const getVehicleInsurances = (vehicleId) => insuranceHistory.value[String(vehicleId)] || [];

const hasActiveInsurance = (vehicleId, excludeId = null) => {
  const now = new Date();
  return getVehicleInsurances(vehicleId).some(ins => {
    if (excludeId && ins.id === excludeId) return false;
    const start = new Date(ins.startAt);
    const end = new Date(ins.endAt);
    return now >= start && now <= end;
  });
};

const getActiveInsurance = (vehicleId, excludeId = null) => {
  const now = new Date();
  return getVehicleInsurances(vehicleId).find(ins => {
    if (excludeId && ins.id === excludeId) return false;
    const start = new Date(ins.startAt);
    const end = new Date(ins.endAt);
    return now >= start && now <= end;
  }) || null;
};

// ==================== ACTIONS ====================
const resetForm = () => {
  submitted.value = false;
  form.vehicleId = "";
  form.insurerId = "";
  form.insurancesType = "TIERS";
  form.policyNo = "";
  form.premium = 0;
  form.durationValue = 12;
  form.durationUnit = "months";
  form.startAt = formatDateInputLocal(new Date());
  calculateEndDate();
  showNewInsurerInput.value = false;
  newInsurerName.value = "";
  isEditing.value = false;
  editingId.value = null;
};

const handleInsurerChange = () => {
  showNewInsurerInput.value = form.insurerId === "NEW";
};

const onVehicleChange = () => {
  if (!form.vehicleId) return;
  const active = getActiveInsurance(form.vehicleId, editingId.value);
  if (active?.insurerId && !isEditing.value) {
    form.insurerId = active.insurerId;
  }
};

const clearFilters = () => {
  fromDate.value = "";
  toDate.value = "";
  searchPlate.value = "";
  statusFilter.value = "ALL";
};

// ==================== CRUD ====================
const submitForm = async () => {
  error.value = "";
  success.value = "";
  submitted.value = true;

  if (!canSubmit.value) {
    error.value = "Veuillez remplir tous les champs obligatoires.";
    return;
  }
  if (!isVehicleInService(selectedVehicle.value)) {
    error.value = "Impossible: seules les opérations sur véhicule EN SERVICE sont autorisées.";
    return;
  }

  submitting.value = true;
  try {
    const start = parseDateInput(form.startAt) || new Date(form.startAt);
    const end = parseDateInput(form.endAt) || new Date(form.endAt);

    const payload = {
      vehicleId: form.vehicleId,
      insurerId: form.insurerId,
      insurancesType: form.insurancesType,
      policyNo: form.policyNo.replace(/^POL-/i, ""),
      premium: Number(form.premium),
      durationValue: Number(form.durationValue),
      durationUnit: form.durationUnit,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };

    if (isEditing.value && editingId.value) {
      await api.put(`/insurance/${editingId.value}`, payload);
      success.value = "Contrat mis à jour.";
    } else {
      await api.post("/insurance", payload);
      success.value = "Contrat créé.";
    }

    resetForm();
    await loadData();
  } catch (e) {
    error.value = e?.response?.data?.message || "Une erreur est survenue.";
  } finally {
    submitting.value = false;
  }
};

const startEdit = (item) => {
  isEditing.value = true;
  editingId.value = item.id;
  submitted.value = false;
  form.vehicleId = item.vehicleId || "";
  form.insurerId = item.insurerId || "";
  form.insurancesType = item.insurancesType || "TIERS";
  form.policyNo = item.policyNo || "";
  form.premium = Number(item.premium) || 0;
  form.durationValue = Number(item.durationValue) || 12;
  form.durationUnit = item.durationUnit || "months";
  form.startAt = item.startAt ? item.startAt.substring(0, 10) : formatDateInputLocal(new Date());
  form.endAt = item.endAt ? item.endAt.substring(0, 10) : "";
  if (!form.endAt) calculateEndDate();
};

const cancelEdit = () => resetForm();

const deleteItem = async (item) => {
  if (!canModify(item.createdAt)) return;
  if (!confirm("Supprimer ce contrat ?")) return;

  try {
    await api.delete(`/insurance/${item.id}`);
    success.value = "Contrat supprimé.";
    await loadData();
  } catch (e) {
    error.value = "Erreur lors de la suppression.";
  }
};

const saveNewInsurer = async () => {
  if (!newInsurerName.value.trim()) return;
  
  try {
    const res = await api.post("/insurers", { name: newInsurerName.value.trim() });
    const created = res.data?.data || res.data;
    insurers.value.push(created);
    form.insurerId = created.id;
    showNewInsurerInput.value = false;
    newInsurerName.value = "";
    success.value = "Assureur ajouté.";
  } catch (e) {
    error.value = "Erreur lors de l'ajout.";
  }
};

// ==================== CHARGEMENT ====================
const loadData = async () => {
  loading.value = true;
  error.value = "";
  
  try {
    const [vRes, iRes, pRes] = await Promise.all([
      api.get("/vehicles"),
      api.get("/insurers"),
      api.get("/insurance"),
    ]);
    
    vehicles.value = vRes.data?.data || vRes.data || [];
    insurers.value = iRes.data?.data || iRes.data || [];
    allInsurances.value = pRes.data?.data || pRes.data || [];

    // Construire l'historique
    insuranceHistory.value = {};
    allInsurances.value.forEach(ins => {
      const vid = String(ins.vehicleId || ins.vehicle?.id);
      if (!vid) return;
      if (!insuranceHistory.value[vid]) insuranceHistory.value[vid] = [];
      insuranceHistory.value[vid].push(ins);
    });

    // Construire l'affichage
    const display = [];
    vehicles.value
      .filter((vehicle) => !isVehicleOutOfService(vehicle))
      .forEach(vehicle => {
      const vid = String(vehicle.id);
      const vehicleIns = insuranceHistory.value[vid] || [];
      if (!vehicleIns.length) return;

      const now = new Date();
      const active = vehicleIns.find(ins => {
        const start = new Date(ins.startAt);
        const end = new Date(ins.endAt);
        return now >= start && now <= end;
      });

      const future = vehicleIns
        .filter(ins => new Date(ins.startAt) > now)
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0];

      const toShow = active || future || vehicleIns[0];
      if (!toShow) return;

      const insurer = insurers.value.find(i => String(i.id) === String(toShow.insurerId)) || toShow.insurer;
      display.push({ ...toShow, vehicle, insurer });
    });

    items.value = display;
  } catch (e) {
    error.value = "Impossible de charger les données.";
  } finally {
    loading.value = false;
  }
};

// ==================== INIT ====================
onMounted(() => {
  calculateEndDate();
  loadData();
});

watch([filteredItems, fromDate, toDate, searchPlate, statusFilter], () => {
  currentPage.value = 1;
});

watch(() => form.startAt, calculateEndDate);
watch(() => form.durationValue, calculateEndDate);
watch(() => form.durationUnit, calculateEndDate);
</script>

<style scoped>
.insurance {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  background: #f8fafc;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
}

/* ==================== HEADER ==================== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 28px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px;
}

.date {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* ==================== BOUTONS ==================== */
.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-outline {
  background: white;
  border-color: #e2e8f0;
  color: #475569;
}

.btn-outline:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-text {
  background: transparent;
  border: none;
  color: #64748b;
}

.btn-text:hover:not(:disabled) {
  background: #f1f5f9;
  color: #334155;
}

.btn-icon {
  font-size: 16px;
}

.btn-icon-only {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-icon-only:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

.btn-icon-only:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ==================== KPI ==================== */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.kpi-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.kpi-icon.blue { background: #eff6ff; color: #2563eb; }
.kpi-icon.indigo { background: #eef2ff; color: #4f46e5; }
.kpi-icon.orange { background: #fff7ed; color: #ea580c; }
.kpi-icon.red { background: #fef2f2; color: #dc2626; }

.kpi-content {
  flex: 1;
}

.kpi-label {
  display: block;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.kpi-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.2;
  margin-bottom: 4px;
}

.kpi-trend {
  font-size: 12px;
  color: #94a3b8;
}

/* ==================== CARTES ==================== */
.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.card-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

/* ==================== FORMULAIRE ==================== */
.form {
  max-width: 800px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}

.required {
  color: #ef4444;
  margin-left: 2px;
}

.form-group input,
.form-group select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input.error,
.form-group select.error {
  border-color: #ef4444;
  background: #fef2f2;
}

.form-group input.readonly {
  background: #f8fafc;
  color: #64748b;
  cursor: not-allowed;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-group input {
  flex: 1;
}

.duration-group {
  display: flex;
  gap: 8px;
}

.duration-group input {
  width: 100px;
}

.duration-group select {
  flex: 1;
}

.field-hint {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  margin-top: 2px;
}

.field-hint.warning {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.field-hint.success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.form-actions {
  margin-top: 24px;
}

/* ==================== FILTRES ==================== */
.filters {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.filters input,
.filters select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

/* ==================== TABLEAU ==================== */
.table-container {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 16px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1000px;
}

th {
  text-align: left;
  padding: 16px;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

td {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
}

tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: #f8fafc;
}

.cell-primary {
  font-weight: 500;
  color: #0f172a;
  margin-bottom: 2px;
}

.cell-secondary {
  font-size: 12px;
  color: #64748b;
}

/* ==================== STATUTS ==================== */
.status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status.active {
  background: #d1fae5;
  color: #065f46;
}

.status.warning {
  background: #fef3c7;
  color: #92400e;
}

.status.expired {
  background: #fee2e2;
  color: #b91c1c;
}

.badge-modifiable {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.badge-modifiable.success {
  background: #d1fae5;
  color: #065f46;
}

.badge-modifiable.error {
  background: #fee2e2;
  color: #b91c1c;
}

/* ==================== ACTIONS ==================== */
.action-buttons {
  display: flex;
  gap: 8px;
}

/* ==================== PAGINATION ==================== */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.page-info {
  font-size: 14px;
  color: #64748b;
}

.page-buttons {
  display: flex;
  gap: 8px;
}

.page-buttons button {
  width: 36px;
  height: 36px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.page-buttons button:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

.page-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== MESSAGES ==================== */
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 16px;
}

.alert.error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.alert.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.empty {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
  font-style: italic;
}

/* ==================== CHARGEMENT ==================== */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .insurance {
    padding: 16px;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    flex: 1;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .filters {
    grid-template-columns: 1fr;
  }

  .pagination {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>

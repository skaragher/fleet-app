<template>
  <div class="insurance">
    <!-- Header avec effet de verre -->
    <header class="header glass-effect">
      <div class="header-left">
        <div class="title-with-icon">
          <span class="header-icon">🛡️</span>
          <h1>Gestion des Assurances</h1>
        </div>
        <p class="date">
          <span class="date-icon">📅</span>
          {{ today }}
        </p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" :disabled="loading" @click="loadData">
          <span class="btn-icon" :class="{ 'spin': loading }">↻</span>
          {{ loading ? 'Chargement...' : 'Actualiser' }}
        </button>
        <button class="btn btn-primary" :disabled="submitting" @click="resetForm">
          <span class="btn-icon">+</span>
          Nouveau contrat
        </button>
      </div>
    </header>

    <!-- Formulaire avec design moderne -->
    <div class="card glass-effect" :class="{ 'editing-card': isEditing }">
      <div class="card-header">
        <div class="card-title">
          <span class="card-icon">{{ isEditing ? '✏️' : '➕' }}</span>
          <h2>{{ isEditing ? 'Modification du contrat' : 'Création d\'un nouveau contrat' }}</h2>
        </div>
        <button v-if="isEditing" class="btn btn-ghost" @click="cancelEdit">
          <span class="btn-icon">✕</span>
          Annuler
        </button>
      </div>

      <div class="form">
        <!-- Ligne 1 : Véhicule et Assureur -->
        <div class="form-row">
          <div class="form-group enhanced">
            <label>
              <span class="label-icon">🚗</span>
              Véhicule <span class="required">*</span>
            </label>
            <div class="select-wrapper">
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
              <span class="select-arrow">▼</span>
            </div>
            <div v-if="form.vehicleId" class="field-hint" :class="hasActiveInsurance(form.vehicleId) ? 'warning' : 'success'">
              <span class="hint-icon">{{ hasActiveInsurance(form.vehicleId) ? '⚠️' : '✅' }}</span>
              <span v-if="hasActiveInsurance(form.vehicleId)">
                Assurance active jusqu'au {{ formatDate(getActiveInsurance(form.vehicleId)?.endAt) }}
              </span>
              <span v-else>Aucune assurance active</span>
            </div>
          </div>

          <div class="form-group enhanced">
            <label>
              <span class="label-icon">🏢</span>
              Assureur <span class="required">*</span>
            </label>
            <div class="select-wrapper">
              <select v-model="form.insurerId" :class="{ error: submitted && !form.insurerId }" @change="handleInsurerChange">
                <option value="" disabled>Sélectionner un assureur</option>
                <option v-for="ins in insurers" :key="ins.id" :value="ins.id">{{ ins.name }}</option>
                <option value="NEW" class="add-option">+ Ajouter un assureur</option>
              </select>
              <span class="select-arrow">▼</span>
            </div>
          </div>
        </div>

        <!-- Nouvel assureur (conditionnel) -->
        <div v-if="showNewInsurerInput" class="form-row animate-slide">
          <div class="form-group enhanced">
            <label>Nom du nouvel assureur</label>
            <div class="input-group">
              <input v-model.trim="newInsurerName" type="text" placeholder="Ex: AXA Assurance" class="enhanced-input" />
              <button class="btn btn-success" :disabled="!newInsurerName" @click="saveNewInsurer">
                <span class="btn-icon">✓</span>
                Ajouter
              </button>
            </div>
          </div>
        </div>

        <!-- Ligne 2 : Type et N° police -->
        <div class="form-row">
          <div class="form-group enhanced">
            <label>
              <span class="label-icon">📋</span>
              Type de couverture <span class="required">*</span>
            </label>
            <div class="select-wrapper">
              <select v-model="form.insurancesType">
                <option value="TIERS">🔹 Tiers Simple</option>
                <option value="INTERMEDIAIRE">🔸 Intermédiaire</option>
                <option value="TOUS_RISQUES">🌟 Tous Risques</option>
                <option value="RC">⚖️ Responsabilité Civile</option>
              </select>
              <span class="select-arrow">▼</span>
            </div>
          </div>

          <div class="form-group enhanced">
            <label>
              <span class="label-icon">🔖</span>
              N° de police <span class="required">*</span>
            </label>
            <input v-model.trim="form.policyNo" type="text" placeholder="POL-2025-001" 
                   :class="{ error: submitted && !form.policyNo }" class="enhanced-input" />
          </div>
        </div>

        <!-- Ligne 3 : Dates et durée -->
        <div class="form-row date-row">
          <div class="form-group enhanced">
            <label>
              <span class="label-icon">📅</span>
              Date de début <span class="required">*</span>
            </label>
            <input v-model="form.startAt" type="date" @change="calculateEndDate" class="enhanced-input" />
          </div>

          <div class="form-group enhanced">
            <label>
              <span class="label-icon">⏱️</span>
              Durée
            </label>
            <div class="duration-group">
              <input v-model.number="form.durationValue" type="number" min="1" @input="calculateEndDate" class="enhanced-input" />
              <div class="select-wrapper small">
                <select v-model="form.durationUnit" @change="calculateEndDate">
                  <option value="months">Mois</option>
                  <option value="years">Années</option>
                </select>
                <span class="select-arrow">▼</span>
              </div>
            </div>
          </div>

          <div class="form-group enhanced">
            <label>
              <span class="label-icon">⏰</span>
              Date d'échéance
            </label>
            <input v-model="form.endAt" type="date" readonly class="enhanced-input readonly" />
            <span class="date-hint">Calculée automatiquement</span>
          </div>
        </div>

        <!-- Ligne 4 : Coût -->
        <div class="form-row">
          <div class="form-group enhanced">
            <label>
              <span class="label-icon">💰</span>
              Coût annuel <span class="required">*</span>
            </label>
            <div class="currency-input">
              <input v-model.number="form.premium" type="number" min="0" step="1000" 
                     :class="{ error: submitted && !form.premium }" class="enhanced-input" />
              <span class="currency-suffix">FCFA</span>
            </div>
          </div>
          <div class="form-group"></div> <!-- Espace vide pour l'alignement -->
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button class="btn btn-primary btn-large" :disabled="submitting || !canSubmit" @click="submitForm">
            <span v-if="submitting" class="spinner"></span>
            <span class="btn-icon">{{ isEditing ? '✓' : '💾' }}</span>
            {{ submitting ? 'Traitement en cours...' : (isEditing ? 'Mettre à jour le contrat' : 'Enregistrer le contrat') }}
          </button>
        </div>

        <!-- Messages -->
        <transition name="slide-fade">
          <div v-if="error" class="alert error">
            <span class="alert-icon">❌</span>
            <span>{{ error }}</span>
            <button @click="error = ''" class="alert-close">✕</button>
          </div>
        </transition>
        <transition name="slide-fade">
          <div v-if="success" class="alert success">
            <span class="alert-icon">✅</span>
            <span>{{ success }}</span>
            <button @click="success = ''" class="alert-close">✕</button>
          </div>
        </transition>
      </div>
    </div>

    <!-- Liste des contrats -->
    <div class="card glass-effect">
      <div class="card-header">
        <div class="card-title">
          <span class="card-icon">📊</span>
          <h2>Historique des contrats</h2>
          <span class="badge">{{ filteredItems.length }}</span>
        </div>
        <button class="btn btn-ghost" @click="clearFilters">
          <span class="btn-icon">🗑️</span>
          Effacer les filtres
        </button>
      </div>

      <!-- Filtres améliorés -->
      <div class="filters-enhanced">
        <div class="filter-group">
          <span class="filter-icon">📅</span>
          <input v-model="fromDate" type="date" placeholder="Date début" class="filter-input" />
        </div>
        <div class="filter-group">
          <span class="filter-icon">📅</span>
          <input v-model="toDate" type="date" placeholder="Date fin" class="filter-input" />
        </div>
        <div class="filter-group">
          <span class="filter-icon">🔍</span>
          <input v-model.trim="searchPlate" type="text" placeholder="Rechercher une plaque..." class="filter-input" />
        </div>
        <div class="filter-group">
          <span class="filter-icon">⚡</span>
          <select v-model="statusFilter" class="filter-select">
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">✅ Actives</option>
            <option value="EXPIRING">⚠️ À renouveler</option>
            <option value="EXPIRED">❌ Expirées</option>
          </select>
        </div>
      </div>

      <!-- Table moderne -->
      <div class="table-container enhanced">
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
            <tr v-for="item in paginatedItems" :key="item.id" class="table-row">
              <td>
                <div class="vehicle-cell">
                  <span class="vehicle-plate">{{ item.vehicle?.plate || '-' }}</span>
                  <span class="vehicle-type">{{ coverageLabel(item.insurancesType) }}</span>
                  <span v-if="isVehicleInRepair(item.vehicle)" class="repair-badge">🔧 EN RÉPARATION</span>
                </div>
              </td>
              <td>
                <div class="insurer-cell">
                  <span class="insurer-name">{{ item.insurer?.name || '-' }}</span>
                  <span class="policy-number">N° {{ item.policyNo || '-' }}</span>
                </div>
              </td>
              <td>
                <div class="period-cell">
                  <span class="date-start">{{ formatDate(item.startAt) }}</span>
                  <span class="date-arrow">→</span>
                  <span class="date-end">{{ formatDate(item.endAt) }}</span>
                </div>
              </td>
              <td>
                <span :class="['status-badge', statusClass(item)]">
                  {{ statusLabel(item) }}
                </span>
              </td>
              <td>
                <span class="amount">{{ formatFCFA(item.premium) }}</span>
              </td>
              <td>
                <span :class="['modifiable-badge', canModify(item.createdAt) ? 'success' : 'error']">
                  <span class="badge-icon">{{ canModify(item.createdAt) ? '✓' : '🔒' }}</span>
                  {{ canModify(item.createdAt) ? 'Autorisé' : 'Verrouillé' }}
                </span>
              </td>
              <td>
                <div class="action-group">
                  <button class="action-btn edit" :disabled="!canModify(item.createdAt)" @click="startEdit(item)" title="Modifier">
                    ✏️
                  </button>
                  <button class="action-btn delete" :disabled="!canModify(item.createdAt)" @click="deleteItem(item)" title="Supprimer">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredItems.length">
              <td colspan="7" class="empty-state">
                <div class="empty-content">
                  <span class="empty-icon">📭</span>
                  <h3>Aucun contrat trouvé</h3>
                  <p>Essayez de modifier vos filtres ou créez un nouveau contrat</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination améliorée -->
      <div class="pagination-enhanced">
        <span class="page-info">
          Page <strong>{{ currentPage }}</strong> sur <strong>{{ totalPages }}</strong>
        </span>
        <div class="page-buttons">
          <button :disabled="currentPage === 1" @click="currentPage--" class="page-btn">
            ←
          </button>
          <button :disabled="currentPage === totalPages" @click="currentPage++" class="page-btn">
            →
          </button>
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
  
  const theoreticalEnd = new Date(targetYear, targetMonth, targetDay, 12, 0, 0);
  
  const end = new Date(theoreticalEnd);
  end.setDate(end.getDate() - 1);
  
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

// Date du jour formatée (si pas déjà présente)
const today = computed(() => {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

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
/* ==================== VARIABLES ==================== */
.insurance {
  /* Variables: `:root` ne fonctionne pas bien en `scoped` (l'élément html n'a pas l'attribut scope). */
  --primary: #4361ee;
  --primary-dark: #3a56d4;
  --primary-light: #4895ef;
  --secondary: #3f37c9;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --dark: #1e1b4b;
  --light: #f8fafc;
  --gray: #64748b;
  --gray-light: #e2e8f0;
  --gray-dark: #475569;
  --shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  --shadow-hover: 0 20px 60px rgba(67, 97, 238, 0.12);
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
  --border-radius-xl: 24px;
  --border-radius-pill: 9999px;
  --border-width: 2px;
  --border-color-light: #e2e8f0;
  --border-color-default: #cbd5e1;
  --border-color-focus: #4361ee;
  --border-color-success: #10b981;
  --border-color-warning: #f59e0b;
  --border-color-error: #ef4444;
  --shadow-focus: 0 0 0 4px rgba(67, 97, 238, 0.15);
  --shadow-success: 0 0 0 4px rgba(16, 185, 129, 0.15);
  --shadow-error: 0 0 0 4px rgba(239, 68, 68, 0.15);
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #0f172a;
  background:
    radial-gradient(1200px 600px at 8% -10%, rgba(67, 97, 238, 0.14), transparent 60%),
    radial-gradient(900px 540px at 92% 0%, rgba(247, 37, 133, 0.10), transparent 55%),
    linear-gradient(180deg, #f8fafc 0%, #f3f6ff 100%);
}

/* ==================== GLASS EFFECT ==================== */
.glass-effect {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: var(--shadow);
}

@supports ((backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px))) {
  .glass-effect {
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    background: rgba(255, 255, 255, 0.82);
  }
}

/* ==================== HEADER AMÉLIORÉ ==================== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  margin-bottom: 30px;
  border-radius: var(--border-radius-lg);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: relative;
  overflow: hidden;
  border: 2px solid transparent;
  isolation: isolate;
}

.header::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(135deg, rgba(255,255,255,0.5), transparent);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.header::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  animation: rotate 30s linear infinite;
  z-index: 0;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.header-left,
.header-actions {
  position: relative;
  z-index: 1;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.header-icon {
  font-size: 32px;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
}

.header-left h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.date {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

.date-icon {
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* ==================== KPI AMÉLIORÉS ==================== */
/* ==================== CARTES ==================== */
.card {
  background: white;
  border-radius: var(--border-radius-lg);
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  transition: var(--transition);
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--border-radius-lg);
  padding: 2px;
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.card:hover::before {
  opacity: 1;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
}

.editing-card {
  border: 2px solid transparent;
  background: linear-gradient(white, white) padding-box,
              linear-gradient(135deg, var(--warning), #b5179e) border-box;
  animation: borderPulse 2s infinite;
}

@keyframes borderPulse {
  0% { box-shadow: 0 0 0 0 rgba(247, 37, 133, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(247, 37, 133, 0); }
  100% { box-shadow: 0 0 0 0 rgba(247, 37, 133, 0); }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.card-title h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--dark);
  margin: 0;
}

.badge {
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border-color-light);
}

/* ==================== BOUTONS ==================== */
.btn {
  padding: 10px 20px;
  border-radius: var(--border-radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid transparent;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.3s, height 0.3s;
}

.btn:hover::before {
  width: 200px;
  height: 200px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(67, 97, 238, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(67, 97, 238, 0.4);
}

.btn-outline {
  background: transparent;
  border: 2px solid var(--border-color-light);
  color: #475569;
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: #f8fafc;
  transform: translateY(-1px);
}

.btn-text {
  background: transparent;
  border: 2px solid transparent;
  color: #64748b;
}

.btn-text:hover:not(:disabled) {
  border-color: var(--border-color-light);
  background: #f8fafc;
  color: #334155;
}

.btn-ghost {
  background: transparent;
  border: 2px solid transparent;
  color: var(--gray);
}

.btn-ghost:hover:not(:disabled) {
  border-color: var(--border-color-light);
  background: #f8fafc;
  color: var(--dark);
}

.btn-success {
  background: linear-gradient(135deg, var(--success), #059669);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-icon {
  font-size: 16px;
}

.btn-icon-only {
  width: 38px;
  height: 38px;
  padding: 0;
  border: 2px solid var(--border-color-light);
  background: white;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: var(--transition);
}

.btn-icon-only:hover:not(:disabled) {
  border-color: var(--primary);
  background: #eef2ff;
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(67, 97, 238, 0.2);
}

.btn-icon-only:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--border-color-light);
  background: #f8fafc;
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
  font-weight: 600;
  color: var(--gray);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.required {
  color: var(--danger);
  margin-left: 2px;
}

/* Champs améliorés */
.form-group input,
.form-group select,
.enhanced-input {
  height: 48px;
  padding: 0 16px;
  border: 2px solid var(--border-color-light);
  border-radius: var(--border-radius-md);
  font-size: 15px;
  background: white;
  transition: var(--transition);
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.form-group input:hover,
.form-group select:hover,
.enhanced-input:hover {
  border-color: var(--border-color-default);
  background: #fafafa;
}

.form-group input:focus,
.form-group select:focus,
.enhanced-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
  background: white;
  transform: translateY(-1px);
  animation: borderGlow 1.5s ease-in-out;
}

@keyframes borderGlow {
  0% { border-color: var(--border-color-light); box-shadow: 0 0 0 0 rgba(67, 97, 238, 0.4); }
  50% { border-color: var(--primary); box-shadow: 0 0 0 8px rgba(67, 97, 238, 0.1); }
  100% { border-color: var(--border-color-light); box-shadow: 0 0 0 0 rgba(67, 97, 238, 0); }
}

.form-group input.error,
.form-group select.error,
.enhanced-input.error {
  border-color: var(--danger);
  background: #fff5f5;
}

.form-group input.error:focus,
.enhanced-input.error:focus {
  box-shadow: var(--shadow-error);
}

.form-group input.success,
.enhanced-input.success {
  border-color: var(--success);
  background: #f0fdf4;
}

.form-group input.success:focus,
.enhanced-input.success:focus {
  box-shadow: var(--shadow-success);
}

.form-group input.readonly,
.enhanced-input.readonly {
  background: #f8fafc;
  color: var(--gray);
  border-color: var(--border-color-light);
  cursor: not-allowed;
  opacity: 0.8;
}

/* Select amélioré */
.select-wrapper {
  position: relative;
  border-radius: var(--border-radius-md);
  background: white;
  transition: var(--transition);
}

.select-wrapper select {
  height: 48px;
  padding: 0 16px;
  border: 2px solid var(--border-color-light);
  border-radius: var(--border-radius-md);
  font-size: 15px;
  width: 100%;
  appearance: none;
  background: white;
  cursor: pointer;
  transition: var(--transition);
}

.select-wrapper:hover select {
  border-color: var(--border-color-default);
  background: #fafafa;
}

.select-wrapper select:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
  outline: none;
  background: white;
}

.select-wrapper select.error {
  border-color: var(--danger);
  background: #fff5f5;
}

.select-arrow {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray);
  pointer-events: none;
  font-size: 12px;
  transition: transform 0.2s ease, color 0.2s ease;
}

.select-wrapper:hover .select-arrow {
  color: var(--primary);
  transform: translateY(-50%) scale(1.1);
}

.select-wrapper.small select {
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
}

/* Groupes d'input */
.input-group {
  display: flex;
  gap: 8px;
}

.input-group input {
  flex: 1;
}

.input-group .btn {
  height: 48px;
}

.duration-group {
  display: flex;
  gap: 8px;
}

.duration-group input {
  width: 100px;
}

/* Champs avec devise */
.currency-input {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-input input {
  padding-right: 80px;
}

.currency-suffix {
  position: absolute;
  right: 16px;
  color: var(--gray);
  font-weight: 500;
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--border-color-light);
}

/* Field hints */
.field-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 12px 16px;
  border-radius: var(--border-radius-md);
  margin-top: 8px;
  animation: slideDown 0.3s ease;
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.field-hint.warning {
  background: #fffbeb;
  border-color: #fcd34d;
  color: #92400e;
}

.field-hint.success {
  background: #f0fdf4;
  border-color: #6ee7b7;
  color: #166534;
}

.field-hint::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.field-hint.warning::before {
  background: linear-gradient(135deg, var(--warning), #d97706);
}

.field-hint.success::before {
  background: linear-gradient(135deg, var(--success), #059669);
}

.hint-icon {
  font-size: 14px;
}

.date-hint {
  font-size: 12px;
  color: var(--gray);
  margin-top: 6px;
  display: block;
}

.form-actions {
  margin-top: 24px;
}

/* ==================== FILTRES AMÉLIORÉS ==================== */
.filters-enhanced {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.filter-group {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: var(--border-radius-md);
  transition: var(--transition);
}

.filter-icon {
  position: absolute;
  left: 16px;
  color: var(--gray);
  font-size: 16px;
  z-index: 1;
  transition: color 0.2s ease;
}

.filter-input,
.filter-select {
  width: 100%;
  height: 48px;
  padding: 0 16px 0 44px;
  border: 2px solid var(--border-color-light);
  border-radius: var(--border-radius-md);
  font-size: 14px;
  background: white;
  transition: var(--transition);
}

.filter-input:hover,
.filter-select:hover {
  border-color: var(--border-color-default);
  background: #fafafa;
}

.filter-input:focus,
.filter-select:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
  outline: none;
  background: white;
  transform: translateY(-1px);
}

.filter-group:focus-within .filter-icon {
  color: var(--primary);
}

/* ==================== TABLEAU AMÉLIORÉ ==================== */
.table-container {
  overflow-x: auto;
  border: 2px solid var(--border-color-light);
  border-radius: var(--border-radius-lg);
  margin-bottom: 16px;
  transition: var(--transition);
}

.table-container:hover {
  border-color: var(--border-color-default);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.table-container.enhanced {
  min-width: 100%;
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 1000px;
}

th {
  text-align: left;
  padding: 18px 16px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  font-size: 13px;
  font-weight: 600;
  color: var(--gray);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid var(--border-color-light);
}

td {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  transition: var(--transition);
}

tr:last-child td {
  border-bottom: none;
}

tbody tr {
  transition: var(--transition);
}

tbody tr:hover {
  background: linear-gradient(135deg, #f8fafc, #ffffff);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
}

/* Cellules stylisées */
.cell-primary {
  font-weight: 500;
  color: #0f172a;
  margin-bottom: 2px;
}

.cell-secondary {
  font-size: 12px;
  color: #64748b;
}

.vehicle-cell,
.insurer-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vehicle-plate {
  font-weight: 600;
  color: var(--dark);
  font-size: 15px;
}

.vehicle-type {
  font-size: 12px;
  color: var(--gray);
}

.repair-badge {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  padding: 2px 6px;
  background: #fff3cd;
  color: #856404;
  border-radius: 4px;
  border: 1px solid #fde68a;
  width: fit-content;
}

.insurer-name {
  font-weight: 500;
  color: var(--dark);
}

.policy-number {
  font-size: 12px;
  color: var(--gray);
}

.period-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.date-start,
.date-end {
  font-weight: 500;
  color: var(--dark);
}

.date-arrow {
  color: var(--gray);
  font-size: 12px;
}

.amount {
  font-weight: 600;
  color: var(--primary);
  font-size: 15px;
}

/* ==================== STATUTS ==================== */
.status-badge,
.status {
  display: inline-block;
  padding: 6px 12px;
  border-radius: var(--border-radius-pill);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  min-width: 100px;
  border: 2px solid transparent;
  transition: var(--transition);
}

.status.active,
.status-badge.active {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #065f46;
  border-color: #34d399;
}

.status.warning,
.status-badge.warning {
  background: linear-gradient(135deg, #fed7aa, #fdba74);
  color: #92400e;
  border-color: #f59e0b;
}

.status.expired,
.status-badge.expired {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #b91c1c;
  border-color: #ef4444;
}

.badge-modifiable,
.modifiable-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--border-radius-pill);
  font-size: 12px;
  font-weight: 500;
  border: 2px solid transparent;
}

.badge-modifiable.success,
.modifiable-badge.success {
  background: #d1fae5;
  color: #065f46;
  border-color: #34d399;
}

.badge-modifiable.error,
.modifiable-badge.error {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #ef4444;
}

.badge-icon {
  font-size: 12px;
}

/* ==================== ACTIONS ==================== */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-group {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.action-btn {
  width: 38px;
  height: 38px;
  border: 2px solid var(--border-color-light);
  border-radius: var(--border-radius-md);
  background: white;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.action-btn:hover::before {
  opacity: 0.1;
}

.action-btn.edit {
  color: var(--primary);
}

.action-btn.edit:hover:not(:disabled) {
  border-color: var(--primary);
  background: #eef2ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(67, 97, 238, 0.2);
}

.action-btn.delete {
  color: var(--danger);
}

.action-btn.delete:hover:not(:disabled) {
  border-color: var(--danger);
  background: #fef2f2;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.2);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--border-color-light);
  background: #f8fafc;
  color: var(--gray);
}

/* ==================== PAGINATION ==================== */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.pagination-enhanced {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: var(--border-radius-md);
  border: 2px solid var(--border-color-light);
}

.page-info {
  font-size: 14px;
  color: var(--gray);
}

.page-info strong {
  color: var(--dark);
  font-weight: 600;
}

.page-buttons {
  display: flex;
  gap: 8px;
}

.page-buttons button,
.page-btn {
  width: 42px;
  height: 42px;
  border: 2px solid var(--border-color-light);
  background: white;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  color: var(--dark);
}

.page-buttons button:hover:not(:disabled),
.page-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: #eef2ff;
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(67, 97, 238, 0.2);
}

.page-buttons button:disabled,
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--border-color-light);
  background: #f8fafc;
}

/* ==================== MESSAGES ==================== */
.alert {
  padding: 16px 20px;
  border-radius: var(--border-radius-md);
  font-size: 14px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  overflow: hidden;
  border: 2px solid transparent;
}

.alert.error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.alert.success {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}

.alert::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.alert.error::before {
  background: linear-gradient(135deg, var(--danger), #dc2626);
}

.alert.success::before {
  background: linear-gradient(135deg, var(--success), #059669);
}

.alert-icon {
  font-size: 18px;
}

.alert-close {
  margin-left: auto;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 6px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  transition: var(--transition);
}

.alert-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.05);
  border-color: currentColor;
}

.empty {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
  font-style: italic;
}

.empty-state {
  padding: 60px !important;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--gray);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-content h3 {
  font-size: 18px;
  color: var(--dark);
  margin: 0;
}

.empty-content p {
  font-size: 14px;
  margin: 0;
}

/* ==================== ANIMATIONS ==================== */
.animate-slide {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ==================== CHARGEMENT ==================== */
.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==================== FOCUS ACCESSIBLE ==================== */
.btn:focus-visible,
.btn-icon-only:focus-visible,
.action-btn:focus-visible,
.page-btn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-color: var(--primary);
}

/* ==================== REDUCED MOTION ==================== */
@media (prefers-reduced-motion: reduce) {
  .header::after {
    animation: none;
  }

  * {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 1200px) {
  .filters-enhanced {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1024px) {
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
    padding: 16px 20px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    flex: 1;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .filters,
  .filters-enhanced {
    grid-template-columns: 1fr;
  }

  .pagination,
  .pagination-enhanced {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .page-buttons {
    width: 100%;
    justify-content: center;
  }

  .duration-group {
    flex-wrap: wrap;
  }

  .duration-group input {
    width: 100%;
  }

  .table-container {
    border-radius: var(--border-radius-md);
  }

  th, td {
    padding: 12px;
  }

  .action-group {
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .card {
    padding: 20px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .btn-icon-only {
    width: 34px;
    height: 34px;
  }

  .action-btn {
    width: 34px;
    height: 34px;
  }

  .page-btn {
    width: 38px;
    height: 38px;
  }
}
</style>

<template>
  <div class="container">
    <h2 class="main-title">Visites Techniques</h2>

    <!-- Notifications -->
    <div v-if="error || successMessage" :class="['notification', error ? 'bg-red' : 'bg-green']">
      {{ error || successMessage }}
      <button @click="error = ''; successMessage = ''">×</button>
    </div>

    <div class="grid-layout">
      <!-- Formulaire de planification / modification -->
      <div v-if="!showResultForm" class="card" :class="isEditing ? 'card-orange' : 'card-blue'">
        <div class="card-header">
          <span>{{ isEditing ? '📝 Modifier la visite' : '📅 Planifier une visite' }}</span>
          <button v-if="isEditing" @click="cancelEdit" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body">
          <div class="compact-form">
            <div class="row">
              <!-- Véhicule avec recherche -->
              <div class="field flex-2">
                <label>Véhicule <span class="required">*</span></label>
                <div class="search-select-container">
                  <input 
                    type="text" 
                    v-model="vehicleSearch" 
                    placeholder="Rechercher par plaque..." 
                    class="custom-input search-input"
                    @focus="vehicleSearch = ''"
                  />
                  <select v-model="form.vehicleId" class="custom-input select-with-search" required>
                    <option value="" disabled>Sélectionner un véhicule...</option>
                    <option 
                      v-for="v in filteredVehicles" 
                      :key="v.id" 
                      :value="v.id" 
                      :disabled="isVehicleInRepair(v)"
                    >
                      {{ v.plate }} - {{ v.model || 'N/A' }}{{ isVehicleInRepair(v) ? ' (EN RÉPARATION)' : '' }}
                    </option>
                    <option v-if="filteredVehicles.length === 0" disabled>Aucun véhicule trouvé</option>
                  </select>
                </div>
              </div>

              <!-- Date prévue -->
              <div class="field flex-2">
                <label>Date prévue <span class="required">*</span></label>
                <input 
                  type="date" 
                  v-model="uiDate" 
                  class="custom-input"
                  :min="minDate" 
                  required
                />
              </div>

              <!-- Centre de contrôle -->
              <div class="field flex-2">
                <label>Centre de contrôle</label>
                <input v-model="form.center" placeholder="Ex: SICTA" class="custom-input" />
              </div>
            </div>

            <div class="row mt-20">
              <!-- Coût -->
              <div class="field flex-1">
                <label>Coût Prévu</label>
                <input type="number" v-model.number="form.cost" class="custom-input" min="0" />
              </div>

              <!-- Notes -->
              <div class="field flex-3">
                <label>Notes / Observations</label>
                <input type="text" v-model="form.notes" class="custom-input" placeholder="Notes..." />
              </div>

              <!-- Bouton submit -->
              <button 
                class="btn-primary" 
                :class="{'btn-orange': isEditing}" 
                @click="processSubmit" 
                :disabled="submitting || !form.vehicleId || !uiDate"
                style="height: 38px;"
              >
                <span v-if="submitting" class="spinner"></span>
                {{ submitting ? 'Traitement...' : (isEditing ? 'Mettre à jour' : 'Programmer') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Formulaire de validation de résultat -->
      <div v-else class="card card-green animate-in">
        <div class="card-header">
          <span>✅ Confirmer la visite : {{ getVehiclePlate(resultForm.vehicleId) }}</span>
          <button @click="cancelResult" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body bg-light-green">
          <div class="compact-form">
            <div class="row">
              <!-- Résultat -->
              <div class="field flex-1">
                <label>Résultat Final <span class="required">*</span></label>
                <select v-model="resultForm.result" class="custom-input border-success" required>
                  <option value="" disabled>Sélectionner...</option>
                  <option value="SUCCES">SUCCÈS (Validé)</option>
                  <option value="ECHEC">ÉCHEC (Contre-visite)</option>
                </select>
              </div>

              <!-- Date effective -->
              <div class="field flex-1">
                <label>Date effective <span class="required">*</span></label>
                <input 
                  type="date" 
                  v-model="uiDoneAt" 
                  class="custom-input border-success" 
                  :min="minDate"
                  required 
                />
              </div>

              <!-- Coût réel -->
              <div class="field flex-1">
                <label>Coût Réel</label>
                <input type="number" v-model.number="resultForm.cost" class="custom-input border-success" min="0" />
              </div>
            </div>

            <div class="row mt-10">
              <!-- Prochaine visite -->
              <div class="field flex-1">
                <label>Prochaine visite <span class="required">*</span></label>
                <input 
                  type="date" 
                  v-model="uiNextInspect" 
                  class="custom-input border-success" 
                  required 
                />
              </div>

              <!-- Commentaire -->
              <div class="field flex-3">
                <label>Commentaire</label>
                <input 
                  type="text" 
                  v-model="resultForm.notes" 
                  class="custom-input border-success" 
                  placeholder="Détails..." 
                />
              </div>

              <!-- Bouton valider -->
              <button 
                class="btn-success" 
                @click="submitResult" 
                :disabled="submitting || !resultForm.result || !uiDoneAt || !uiNextInspect"
                style="height: 38px;"
              >
                <span v-if="submitting" class="spinner"></span>
                {{ submitting ? 'Traitement...' : 'Valider le résultat' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Liste des visites -->
      <div class="station-block shadow-sm mt-20">
        <!-- En-tête -->
        <div class="station-banner">
          <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <span>Visites techniques en cours</span>
            
            <!-- Badge historique véhicule -->
            <div v-if="selectedVehicleForHistory" class="vehicle-history-header">
              <span class="history-badge">Historique: {{ getVehiclePlate(selectedVehicleForHistory) }}</span>
              <button @click="clearHistory" class="btn-history-close">✕</button>
            </div>
          </div>

          <!-- Pagination -->
          <div class="pagination-controls">
            <button @click="currentPage--" :disabled="currentPage === 1" class="btn-page">«</button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button @click="currentPage++" :disabled="currentPage === totalPages" class="btn-page">»</button>
          </div>
        </div>

        <!-- Barre de recherche -->
        <div class="search-bar-container">
          <input 
            type="text" 
            v-model="visitSearch" 
            placeholder="🔍 Rechercher par plaque, centre ou notes..." 
            class="search-input-global"
          />
          <button v-if="visitSearch" @click="visitSearch = ''" class="search-clear" title="Effacer">✕</button>
        </div>

        <!-- Tableau -->
        <div class="table-responsive">
          <table class="tank-table">
            <thead>
              <tr>
                <th>Véhicule</th>
                <th>Centre / Notes</th>
                <th>Prochaine Visite</th>
                <th>Temps restant</th>
                <th class="text-right">Coût</th>
                <th class="text-center">Résultat</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedItems" :key="item.id">
                <!-- Véhicule -->
                <td>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <strong>{{ getVehiclePlate(item.vehicleId) }}</strong>
                    <span v-if="isVehicleInRepairById(item.vehicleId)" class="vehicle-repair-note">EN RÉPARATION</span>
                    <button 
                      v-if="!selectedVehicleForHistory" 
                      @click="viewVehicleHistory(item.vehicleId)" 
                      class="btn-history" 
                      title="Voir l'historique"
                    >
                      📋
                    </button>
                  </div>
                </td>

                <!-- Centre / Notes -->
                <td>
                  <span class="type-tag">{{ item.center || 'N/A' }}</span>
                  <br v-if="item.center && item.notes">
                  <small v-if="item.notes">{{ item.notes }}</small>
                </td>

                <!-- Prochaine visite -->
                <td>
                  <div v-if="getEffectiveNextVisitDate(item)" class="next-date-cell">
                    <span class="next-date">{{ formatDate(getEffectiveNextVisitDate(item)) }}</span>
                  </div>
                  <span v-else class="no-date">-</span>
                </td>

                <!-- Temps restant -->
                <td>
                  <div v-if="getEffectiveNextVisitDate(item)" class="time-remaining-cell">
                    <div class="time-indicator" :class="getTimeRemainingClass(getEffectiveNextVisitDate(item))">
                      <span class="time-icon">{{ getTimeIcon(getEffectiveNextVisitDate(item)) }}</span>
                      <span class="time-text">{{ getTimeRemainingText(getEffectiveNextVisitDate(item)) }}</span>
                    </div>
                    <div class="time-detail" :class="getTimeRemainingClass(getEffectiveNextVisitDate(item))">
                      {{ getTimeRemainingDetail(getEffectiveNextVisitDate(item)) }}
                    </div>
                  </div>
                  <span v-else class="no-date">-</span>
                </td>

                <!-- Coût -->
                <td class="text-right total-price">
                  {{ formatCurrency(item.cost) }}
                </td>

                <!-- Résultat -->
                <td class="text-center">
                  <span class="badge" :class="getResultBadgeClass(getDisplayResult(item))">
                    {{ getDisplayResult(item) }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="text-center">
                  <div class="action-buttons">
                    <button 
                      v-if="!item.result" 
                      @click="openResult(item)" 
                      class="btn-icon btn-complete" 
                      title="Valider le résultat"
                    >✔️</button>
                    <button 
                      @click="editItem(item)" 
                      class="btn-icon" 
                      :disabled="!canModify(item)"
                      title="Modifier"
                    >✏️</button>
                    <button 
                      @click="remove(item)" 
                      class="btn-icon" 
                      :class="canModify(item) ? 'btn-del' : 'btn-lock'" 
                      :disabled="!canModify(item)"
                      :title="canModify(item) ? 'Supprimer' : 'Verrouillé'"
                    >
                      {{ canModify(item) ? '🗑️' : '🔒' }}
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Message si aucun résultat -->
              <tr v-if="filteredItems.length === 0">
                <td colspan="7" class="empty">
                  <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>Aucune visite trouvée</h3>
                    <p>Essayez de modifier vos critères de recherche</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Info nombre de résultats -->
        <div v-if="filteredItems.length > 0" class="results-info">
          {{ filteredItems.length }} résultat(s) trouvé(s)
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api from "../services/api";

// ==================== ÉTATS ====================
const vehicles = ref([]);
const items = ref([]); // Toutes les visites

const submitting = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const showResultForm = ref(false);

const currentPage = ref(1);
const itemsPerPage = 10;

const error = ref("");
const successMessage = ref("");

// Historique
const selectedVehicleForHistory = ref(null);
const vehicleHistory = ref([]);

// Recherches
const vehicleSearch = ref("");
const visitSearch = ref("");

// Dates
const uiDate = ref(new Date().toISOString().split('T')[0]);
const uiDoneAt = ref("");
const uiNextInspect = ref("");

// Formulaires
const initialForm = { 
  vehicleId: "", 
  center: "", 
  cost: 0, 
  notes: "", 
  type: "VISITE_TECHNIQUE" 
};
const form = ref({ ...initialForm });

const resultForm = ref({ 
  id: null, 
  vehicleId: "", 
  result: "SUCCES", 
  cost: null, 
  notes: "" 
});

// ==================== CONSTANTES ====================
const minDate = (() => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
})();

// ==================== FONCTIONS UTILITAIRES ====================
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return num.toLocaleString('fr-FR') + ' FCFA';
};

const normalizeVehicleStatus = (status) => String(status || "").trim().toUpperCase();

// ==================== VÉHICULES ====================
const getVehicleById = (id) => vehicles.value.find(v => String(v.id) === String(id));

const getVehiclePlate = (id) => {
  const v = getVehicleById(id);
  return v?.plate || "-";
};

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

const isVehicleInRepairById = (id) => isVehicleInRepair(getVehicleById(id));

const selectableVehicles = computed(() => 
  vehicles.value.filter(v => !isVehicleOutOfService(v))
);

// Véhicules filtrés par recherche
const filteredVehicles = computed(() => {
  if (!vehicleSearch.value.trim()) {
    return selectableVehicles.value;
  }
  
  const search = vehicleSearch.value.toLowerCase().trim();
  return selectableVehicles.value.filter(v => 
    v.plate.toLowerCase().includes(search) || 
    (v.model && v.model.toLowerCase().includes(search))
  );
});

// ==================== VISITES ====================
const getEffectiveNextVisitDate = (visit) => {
  if (!visit) return null;
  return visit.nextInspect || visit.scheduledAt || null;
};

const getDisplayResult = (visit) => {
  if (!visit?.result) return "EN ATTENTE";
  return visit.result;
};

// Dernières visites par véhicule
const latestVisits = computed(() => {
  const visitsByVehicle = {};
  
  items.value.forEach(visit => {
    const vehicleId = visit.vehicleId;
    if (isVehicleOutOfService(getVehicleById(vehicleId))) return;
    
    if (!visitsByVehicle[vehicleId]) {
      visitsByVehicle[vehicleId] = visit;
    } else {
      const existing = visitsByVehicle[vehicleId];
      
      // Priorité aux visites sans résultat
      if (!visit.result && existing.result) {
        visitsByVehicle[vehicleId] = visit;
      } 
      // Si les deux ont un résultat, prendre la plus récente
      else if (visit.result && existing.result) {
        const visitDate = new Date(visit.scheduledAt);
        const existingDate = new Date(existing.scheduledAt);
        if (visitDate > existingDate) {
          visitsByVehicle[vehicleId] = visit;
        }
      }
      // Si les deux n'ont pas de résultat, prendre la plus récente
      else if (!visit.result && !existing.result) {
        const visitDate = new Date(visit.scheduledAt);
        const existingDate = new Date(existing.scheduledAt);
        if (visitDate > existingDate) {
          visitsByVehicle[vehicleId] = visit;
        }
      }
    }
  });
  
  return Object.values(visitsByVehicle).sort((a, b) => {
    if (!a.result && b.result) return -1;
    if (a.result && !b.result) return 1;
    
    const aNext = getEffectiveNextVisitDate(a);
    const bNext = getEffectiveNextVisitDate(b);
    if (aNext && bNext) return new Date(aNext) - new Date(bNext);
    if (aNext && !bNext) return -1;
    if (!aNext && bNext) return 1;
    
    return new Date(b.scheduledAt) - new Date(a.scheduledAt);
  });
});

// Filtrage par recherche
const filteredItems = computed(() => {
  let items = selectedVehicleForHistory.value ? vehicleHistory.value : latestVisits.value;
  
  if (visitSearch.value.trim()) {
    const search = visitSearch.value.toLowerCase().trim();
    items = items.filter(item => {
      const plate = getVehiclePlate(item.vehicleId).toLowerCase();
      const center = (item.center || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      
      return plate.includes(search) || center.includes(search) || notes.includes(search);
    });
  }
  
  return items;
});

// Pagination
const totalPages = computed(() => 
  Math.max(1, Math.ceil(filteredItems.value.length / itemsPerPage))
);

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredItems.value.slice(start, start + itemsPerPage);
});

// ==================== GESTION DU TEMPS ====================
const getDaysNumber = (targetDate) => {
  if (!targetDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setHours(0, 0, 0, 0);
  return Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
};

const getTimeRemainingText = (date) => {
  const diff = getDaysNumber(date);
  if (diff < 0) return `+${Math.abs(diff)}j`;
  if (diff === 0) return 'Auj.';
  if (diff === 1) return 'Dem.';
  if (diff < 7) return `${diff}j`;
  if (diff < 30) return `${Math.floor(diff/7)}sem`;
  if (diff < 365) return `${Math.floor(diff/30)}mois`;
  return `${Math.floor(diff/365)}an`;
};

const getTimeRemainingDetail = (date) => {
  const diff = getDaysNumber(date);
  if (diff < 0) return `Expiré depuis ${Math.abs(diff)} jours`;
  if (diff === 0) return 'Aujourd\'hui';
  if (diff === 1) return 'Demain';
  if (diff < 7) return `${diff} jours restants`;
  if (diff < 30) return `${diff} jours (${Math.floor(diff/7)} semaines)`;
  if (diff < 365) return `${diff} jours (${Math.floor(diff/30)} mois)`;
  return `${diff} jours (${Math.floor(diff/365)} ans)`;
};

const getTimeIcon = (date) => {
  const diff = getDaysNumber(date);
  if (diff < 0) return '⚠️';
  if (diff === 0) return '⏰';
  if (diff === 1) return '🚀';
  if (diff < 7) return '📅';
  if (diff < 30) return '📆';
  if (diff < 90) return '🗓️';
  return '📅';
};

const getTimeRemainingClass = (date) => {
  const diff = getDaysNumber(date);
  if (diff < 0) return 'time-expired';
  if (diff < 7) return 'time-urgent';
  if (diff < 30) return 'time-warning';
  if (diff < 90) return 'time-normal';
  return 'time-future';
};

// ==================== VALIDATIONS ====================
const canModify = (inspection) => {
  if (!inspection) return false;
  const now = Date.now();

  if (inspection.result === "SUCCES") {
    const refDate = inspection.doneAt || inspection.updatedAt || inspection.createdAt;
    if (!refDate) return false;
    return (now - new Date(refDate).getTime()) / (1000 * 3600) <= 24;
  }

  if (!inspection.createdAt) return true;
  return (now - new Date(inspection.createdAt).getTime()) / (1000 * 3600) <= 72;
};

const getOngoingVisitUntil = (visit) => {
  if (!visit) return null;
  const now = new Date();

  if (visit.nextInspect) {
    const next = new Date(visit.nextInspect);
    if (!isNaN(next) && next > now) return next;
  }

  if (!visit.result && visit.scheduledAt) {
    const scheduled = new Date(visit.scheduledAt);
    if (!isNaN(scheduled) && scheduled > now) return scheduled;
  }

  return null;
};

const getDaysUntilDate = (date) => {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const findBlockingVisitForNewEntry = (vehicleId) => {
  if (!vehicleId) return null;
  return items.value.find((visit) => {
    if (String(visit.vehicleId) !== String(vehicleId)) return false;
    const ongoingUntil = getOngoingVisitUntil(visit);
    const remaining = getDaysUntilDate(ongoingUntil);
    return remaining !== null && remaining > 30;
  }) || null;
};

// ==================== ACTIONS CRUD ====================
async function load() {
  try {
    const [v, i] = await Promise.all([
      api.get("/vehicles"),
      api.get("/inspections?type=VISITE_TECHNIQUE")
    ]);
    
    vehicles.value = v.data;
    items.value = i.data;
    
    if (selectedVehicleForHistory.value) {
      updateVehicleHistory(selectedVehicleForHistory.value);
    }
  } catch (e) { 
    console.error("Erreur de chargement:", e);
    error.value = "Erreur de chargement des données";
  }
}

async function processSubmit() {
  // Validations
  if (!form.value.vehicleId || !uiDate.value) {
    error.value = "Veuillez sélectionner un véhicule et une date";
    return;
  }

  const selectedVehicle = getVehicleById(form.value.vehicleId);
  if (!isVehicleInService(selectedVehicle)) {
    error.value = "Impossible: le véhicule n'est pas en service";
    return;
  }

  if (!isEditing.value) {
    const blockingVisit = findBlockingVisitForNewEntry(form.value.vehicleId);
    if (blockingVisit) {
      const until = getOngoingVisitUntil(blockingVisit);
      const remaining = getDaysUntilDate(until);
      error.value = `Une visite en cours reste valide ${remaining} jour(s)`;
      return;
    }
  }
  
  submitting.value = true;
  try {
    const payload = { 
      ...form.value, 
      scheduledAt: new Date(uiDate.value).toISOString(),
      cost: Number(form.value.cost) || 0
    };
    
    if (isEditing.value) {
      await api.put(`/inspections/${editingId.value}`, payload);
      successMessage.value = "Visite modifiée avec succès";
    } else {
      await api.post("/inspections", payload);
      successMessage.value = "Visite planifiée avec succès";
    }
    
    resetForm();
    await load();
  } catch (e) { 
    console.error("Erreur:", e);
    error.value = "Erreur lors de l'enregistrement";
  } finally { 
    submitting.value = false; 
  }
}

async function submitResult() {
  if (!resultForm.value.result || !uiDoneAt.value || !uiNextInspect.value) {
    error.value = "Tous les champs obligatoires doivent être remplis";
    return;
  }
  
  submitting.value = true;
  try {
    const updatePayload = {
      result: resultForm.value.result,
      cost: Number(resultForm.value.cost) || 0,
      notes: resultForm.value.notes || "",
      doneAt: new Date(uiDoneAt.value).toISOString(),
      nextInspect: new Date(uiNextInspect.value).toISOString()
    };
    
    await api.patch(`/inspections/${resultForm.value.id}/validate`, updatePayload);
    successMessage.value = "Visite validée avec succès";
    
    cancelResult();
    await load();
  } catch (e) { 
    console.error("Erreur:", e);
    error.value = "Erreur lors de la validation";
  } finally { 
    submitting.value = false; 
  }
}

function openResult(item) {
  if (!isVehicleInService(getVehicleById(item.vehicleId))) {
    error.value = "Impossible: véhicule non en service";
    return;
  }
  
  resultForm.value = { 
    id: item.id, 
    vehicleId: item.vehicleId, 
    result: "SUCCES", 
    cost: item.cost || 0, 
    notes: item.notes || "" 
  };

  uiDoneAt.value = new Date().toISOString().split("T")[0];
  
  if (item.nextInspect) {
    uiNextInspect.value = item.nextInspect.substring(0, 10);
  } else if (item.scheduledAt) {
    const nextDate = new Date(item.scheduledAt);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    uiNextInspect.value = nextDate.toISOString().split("T")[0];
  } else {
    uiNextInspect.value = uiDoneAt.value;
  }
  
  showResultForm.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editItem(item) {
  if (!isVehicleInService(getVehicleById(item.vehicleId))) {
    error.value = "Impossible: véhicule non en service";
    return;
  }
  
  if (!canModify(item)) {
    error.value = item?.result === "SUCCES"
      ? "Cette visite est verrouillée (délai 24h dépassé)"
      : "Cette visite ne peut plus être modifiée (délai 72h dépassé)";
    return;
  }

  isEditing.value = true;
  editingId.value = item.id;
  uiDate.value = item.scheduledAt ? item.scheduledAt.substring(0, 10) : "";
  form.value = { 
    vehicleId: item.vehicleId,
    center: item.center || "",
    cost: item.cost || 0,
    notes: item.notes || "",
    type: item.type || "VISITE_TECHNIQUE"
  };
  showResultForm.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function remove(item) {
  if (!canModify(item)) {
    error.value = item?.result === "SUCCES"
      ? "Cette visite est verrouillée (délai 24h dépassé)"
      : "Cette visite ne peut plus être supprimée (délai 72h dépassé)";
    return;
  }
  
  if (!confirm("Supprimer cette visite ?")) return;
  
  try {
    await api.delete(`/inspections/${item.id}`); 
    successMessage.value = "Visite supprimée";
    await load();
  } catch (e) {
    console.error("Erreur:", e);
    error.value = "Erreur lors de la suppression";
  }
}

// ==================== FONCTIONS ANNULAIRES ====================
function resetForm() {
  isEditing.value = false;
  editingId.value = null;
  form.value = { ...initialForm };
  uiDate.value = new Date().toISOString().split('T')[0];
  vehicleSearch.value = "";
}

function cancelEdit() {
  resetForm();
}

function cancelResult() {
  showResultForm.value = false;
  resultForm.value = { id: null, vehicleId: "", result: "SUCCES", cost: null, notes: "" };
  uiDoneAt.value = "";
  uiNextInspect.value = "";
}

function clearHistory() {
  selectedVehicleForHistory.value = null;
  vehicleHistory.value = [];
  currentPage.value = 1;
  visitSearch.value = "";
}

// ==================== HISTORIQUE ====================
function updateVehicleHistory(vehicleId) {
  vehicleHistory.value = items.value
    .filter(item => item.vehicleId === vehicleId)
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
}

function viewVehicleHistory(vehicleId) {
  selectedVehicleForHistory.value = vehicleId;
  updateVehicleHistory(vehicleId);
  currentPage.value = 1;
  visitSearch.value = "";
}

// ==================== BADGES ====================
const getResultBadgeClass = (r) => {
  const normalized = String(r || "").trim().toUpperCase();
  if (!normalized || normalized === "EN ATTENTE") return 'badge-warn';
  return normalized === 'SUCCES' ? 'badge-success' : 'badge-danger';
};

// ==================== INIT ====================
onMounted(load);
</script>

<style scoped>
/* ==================== LAYOUT ==================== */
.container { 
  padding: 20px; 
  font-family: 'Segoe UI', sans-serif; 
  background: #f4f7f6; 
  min-height: 100vh; 
}

.main-title { 
  color: #2c3e50; 
  font-size: 1.5rem; 
  margin-bottom: 20px; 
  border-left: 5px solid #3498db; 
  padding-left: 15px; 
}

/* ==================== CARTES ==================== */
.card { 
  border-radius: 8px; 
  overflow: hidden; 
  margin-bottom: 20px; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.1); 
  background: white; 
}

.card-blue { border-top: 4px solid #3498db; }
.card-orange { border-top: 4px solid #e67e22; }
.card-green { border-top: 4px solid #27ae60; }

.card-header { 
  padding: 12px 20px; 
  font-weight: bold; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  border-bottom: 1px solid #eee; 
}

.card-body { padding: 20px; }
.bg-light-green { background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%) !important; }

/* ==================== FORMULAIRES ==================== */
.row { 
  display: flex; 
  gap: 15px; 
  align-items: flex-end; 
  flex-wrap: wrap; 
}

.mt-20 { margin-top: 20px; }
.mt-10 { margin-top: 10px; }

.field { 
  display: flex; 
  flex-direction: column; 
  gap: 4px; 
  min-width: 150px;
}

.field label { 
  font-size: 0.7rem; 
  font-weight: 800; 
  color: #7f8c8d; 
  text-transform: uppercase; 
}

.required { color: #e74c3c; }

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }
.flex-3 { flex: 3; }

/* ==================== INPUTS ==================== */
.custom-input { 
  padding: 10px; 
  border: 1px solid #ddd; 
  border-radius: 5px; 
  font-size: 0.9rem; 
  width: 100%; 
  box-sizing: border-box; 
  transition: border 0.3s; 
}

.custom-input:focus { 
  border-color: #3498db; 
  outline: none; 
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2); 
}

.custom-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.7;
}

.border-success { 
  border: 2px solid #27ae60 !important; 
}

/* ==================== SÉLECTEUR AVEC RECHERCHE ==================== */
.search-select-container {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  margin-bottom: 5px;
  background: white;
}

.select-with-search {
  width: 100%;
  max-height: 150px;
  overflow-y: auto;
}

.select-with-search option {
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.select-with-search option:disabled {
  color: #999;
  font-style: italic;
  background: #f5f5f5;
}

/* ==================== BOUTONS ==================== */
.btn-primary, .btn-success, .btn-cancel {
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
  white-space: nowrap;
}

.btn-primary { 
  background: #3498db; 
  color: white; 
}

.btn-primary:hover:not(:disabled) { 
  background: #2980b9; 
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.btn-primary:disabled, .btn-success:disabled { 
  opacity: 0.5; 
  cursor: not-allowed; 
}

.btn-orange { 
  background: #e67e22; 
}

.btn-orange:hover:not(:disabled) { 
  background: #d35400; 
}

.btn-success { 
  background: #27ae60; 
  color: white; 
}

.btn-success:hover:not(:disabled) { 
  background: #219653; 
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.btn-cancel { 
  background: #95a5a6; 
  color: white; 
  font-size: 0.75rem;
  padding: 5px 10px;
}

.btn-cancel:hover:not(:disabled) { 
  background: #7f8c8d; 
}

/* ==================== TABLEAU ==================== */
.station-banner { 
  background: #2c3e50; 
  color: white; 
  padding: 10px 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  flex-wrap: wrap;
  gap: 10px;
}

.tank-table { 
  width: 100%; 
  border-collapse: collapse; 
}

.tank-table th { 
  background: #f8f9fa; 
  padding: 12px; 
  font-size: 0.7rem; 
  color: #7f8c8d; 
  text-transform: uppercase; 
  text-align: left; 
  border-bottom: 2px solid #eee; 
}

.tank-table td { 
  padding: 12px; 
  border-bottom: 1px solid #eee; 
  font-size: 0.85rem; 
}

.tank-table tbody tr:hover {
  background: #f8fafc;
}

.text-right { text-align: right; }
.text-center { text-align: center; }

.total-price { 
  font-weight: 600; 
  color: #2c3e50; 
}

.total-price small { 
  font-weight: normal; 
  color: #95a5a6; 
  font-size: 0.7rem; 
}

/* ==================== BARRE DE RECHERCHE ==================== */
.search-bar-container {
  padding: 10px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
}

.search-input-global {
  width: 100%;
  padding: 10px 35px 10px 15px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.search-input-global:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.search-clear {
  position: absolute;
  right: 30px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 1rem;
  padding: 5px;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear:hover {
  color: #e74c3c;
  background: rgba(0,0,0,0.05);
}

.results-info {
  padding: 10px 20px;
  font-size: 0.8rem;
  color: #7f8c8d;
  border-top: 1px solid #eee;
  text-align: right;
}

/* ==================== BADGES ==================== */
.badge { 
  padding: 4px 8px; 
  border-radius: 10px; 
  font-size: 0.65rem; 
  font-weight: bold; 
  display: inline-block;
}

.badge-warn { background: #fef3c7; color: #92400e; }
.badge-success { background: #d1fae5; color: #065f46; }
.badge-danger { background: #fee2e2; color: #991b1b; }

.type-tag { 
  background: #e1f5fe; 
  color: #0288d1; 
  padding: 2px 6px; 
  border-radius: 4px; 
  font-size: 0.75rem; 
  font-weight: bold; 
  display: inline-block;
}

.vehicle-repair-note {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 2px 6px;
  white-space: nowrap;
}

/* ==================== ACTIONS ==================== */
.action-buttons { 
  display: flex; 
  gap: 5px; 
  justify-content: center; 
}

.btn-icon { 
  border: none; 
  padding: 6px; 
  border-radius: 4px; 
  cursor: pointer; 
  background: #f1f2f6; 
  transition: all 0.2s; 
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.btn-icon:hover:not(:disabled) { 
  transform: translateY(-1px); 
  box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
}

.btn-del:hover:not(:disabled) { 
  background: #fee2e2; 
  color: #dc2626; 
}

.btn-lock { 
  opacity: 0.3; 
  cursor: not-allowed; 
  background: #f1f2f6;
}

.btn-complete { 
  background: #d1fae5 !important; 
  color: #065f46; 
}

.btn-complete:hover:not(:disabled) { 
  background: #10b981 !important; 
  color: white !important; 
}

.btn-history {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 5px;
  border-radius: 4px;
  transition: background 0.3s;
}

.btn-history:hover {
  background: rgba(52, 152, 219, 0.1);
}

/* ==================== PAGINATION ==================== */
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-page {
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
  font-size: 1rem;
}

.btn-page:hover:not(:disabled) {
  background: rgba(255,255,255,0.3);
}

.btn-page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.9rem;
  min-width: 60px;
  text-align: center;
}

/* ==================== TEMPS RESTANT ==================== */
.next-date-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.next-date {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.85rem;
  text-align: center;
}

.time-remaining-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  min-width: 120px;
}

.time-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  min-width: 80px;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.time-icon { font-size: 1rem; }
.time-text { font-weight: 700; font-size: 0.9rem; }

.time-detail {
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 10px;
  text-align: center;
  max-width: 150px;
  transition: all 0.3s;
}

.time-expired .time-indicator {
  background-color: #fee2e2;
  color: #991b1b;
  border: 2px solid #dc2626;
  animation: pulse 1.5s infinite;
}

.time-urgent .time-indicator {
  background-color: #fef3c7;
  color: #92400e;
  border: 2px solid #f59e0b;
  animation: pulse 2s infinite;
}

.time-warning .time-indicator {
  background-color: #fef3c7;
  color: #92400e;
  border: 2px solid #fbbf24;
}

.time-normal .time-indicator {
  background-color: #d1fae5;
  color: #065f46;
  border: 2px solid #10b981;
}

.time-future .time-indicator {
  background-color: #e0f2fe;
  color: #0369a1;
  border: 2px solid #0ea5e9;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
  100% { opacity: 1; transform: scale(1); }
}

/* ==================== HISTORIQUE ==================== */
.vehicle-history-header {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.2);
  padding: 5px 10px;
  border-radius: 4px;
}

.history-badge {
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-history-close {
  background: rgba(255, 255, 255, 0.3);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.3s;
}

.btn-history-close:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* ==================== NOTIFICATIONS ==================== */
.notification { 
  padding: 12px 20px; 
  border-radius: 8px; 
  margin-bottom: 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  font-weight: 500; 
  box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
  color: white;
}

.notification button { 
  background: transparent; 
  border: none; 
  color: white; 
  font-size: 1.2rem; 
  cursor: pointer;
  padding: 0 5px;
}

.notification button:hover {
  opacity: 0.8;
}

.bg-red { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); }
.bg-green { background: linear-gradient(135deg, #27ae60 0%, #219653 100%); }

/* ==================== ÉTATS VIDES ==================== */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #7f8c8d;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 10px 0;
  color: #2c3e50;
}

.empty-state p {
  font-size: 0.9rem;
}

.no-date {
  color: #95a5a6;
  font-style: italic;
}

/* ==================== SPINNER ==================== */
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

/* ==================== ANIMATIONS ==================== */
.animate-in {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 768px) {
  .container { padding: 10px; }
  
  .row { flex-direction: column; }
  
  .flex-1, .flex-2, .flex-3 { width: 100%; }
  
  .action-buttons { flex-direction: row; justify-content: center; }
  
  .station-banner { 
    flex-direction: column; 
    text-align: center; 
  }
  
  .pagination-controls { 
    width: 100%;
    justify-content: center;
  }
  
  .time-remaining-cell { min-width: 100px; }
  
  .time-indicator { 
    padding: 6px 10px; 
    min-width: 70px; 
  }
  
  .time-text { font-size: 0.8rem; }
  
  .tank-table {
    font-size: 0.8rem;
  }
  
  .tank-table th, .tank-table td {
    padding: 8px;
  }
  
  .btn-icon {
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
  }
}
</style>
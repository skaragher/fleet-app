<template>
  <div class="container">
    <h2 class="main-title">Visites Techniques</h2>

    <div v-if="error || successMessage" :class="['notification', error ? 'bg-red' : 'bg-green']">
      {{ error || successMessage }}
      <button @click="error = ''; successMessage = ''">×</button>
    </div>

    <div class="grid-layout">
      <div v-if="!showResultForm" class="card" :class="isEditing ? 'card-orange' : 'card-blue'">
        <div class="card-header">
          <span>{{ isEditing ? '📝 Modifier la visite' : '📅 Planifier une visite' }}</span>
          <button v-if="isEditing" @click="cancelEdit" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body">
          <div class="compact-form">
            <div class="row">
              <div class="field flex-2">
                <label>Véhicule</label>
                <select v-model="form.vehicleId" class="custom-input">
                  <option value="" disabled>Choisir véhicule...</option>
                  <option v-for="v in selectableVehicles" :key="v.id" :value="v.id" :disabled="isVehicleInRepair(v)">
                    {{ v.plate }}{{ isVehicleInRepair(v) ? ' (EN RÉPARATION)' : '' }}
                  </option>
                </select>
              </div>
              <div class="field flex-2">
                <label>Date prévue</label>
                <input type="date" v-model="uiDate" class="custom-input" />
              </div>
              <div class="field flex-2">
                <label>Centre de contrôle</label>
                <input v-model="form.center" placeholder="Ex: SICTA" class="custom-input" />
              </div>
            </div>
            <div class="row mt-20">
              <div class="field flex-1">
                <label>Coût Prévu</label>
                <input type="number" v-model.number="form.cost" class="custom-input" />
              </div>
              <div class="field flex-3">
                <label>Notes / Observations</label>
                <input type="text" v-model="form.notes" class="custom-input" placeholder="Notes..." />
              </div>
              <button class="btn-primary" :class="{'btn-orange': isEditing}" @click="processSubmit" :disabled="submitting || !form.vehicleId || !uiDate" style="height: 38px;">
                {{ submitting ? '...' : (isEditing ? 'Valider' : 'Programmer') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- FORMULAIRE DE VALIDATION (comme maintenance) -->
      <div v-else class="card card-green animate-in">
        <div class="card-header">
          <span>✅ Confirmer la visite : {{ plate(resultForm.vehicleId) }}</span>
          <button @click="showResultForm = false" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body bg-light-green">
          <div class="compact-form">
            <div class="row">
              <div class="field flex-1">
                <label>Résultat Final*</label>
                <select v-model="resultForm.result" class="custom-input border-success" required>
                  <option value="" disabled>Sélectionner...</option>
                  <option value="SUCCES">SUCCÈS (Validé)</option>
                  <option value="ECHEC">ÉCHEC (Contre-visite)</option>
                </select>
              </div>
              <div class="field flex-1">
                <label>Date effective*</label>
                <input type="date" v-model="uiDoneAt" class="custom-input border-success" required />
              </div>
              <div class="field flex-1">
                <label>Coût Réel</label>
                <input type="number" v-model.number="resultForm.cost" class="custom-input border-success" />
              </div>
            </div>
            <div class="row mt-10">
              <div class="field flex-1">
                <label>Prochaine visite*</label>
                <input type="date" v-model="uiNextInspect" class="custom-input border-success" required />
              </div>
              <div class="field flex-3">
                <label>Commentaire</label>
                <input type="text" v-model="resultForm.notes" class="custom-input border-success" placeholder="Détails..." />
              </div>
              <button class="btn-success" @click="submitResult" 
                      :disabled="submitting || !resultForm.result || !uiDoneAt || !uiNextInspect"
                      style="height: 38px;">
                {{ submitting ? '...' : 'Valider le résultat' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="station-block shadow-sm mt-20">
        <div class="station-banner">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span>Visites techniques en cours</span>
            <div v-if="selectedVehicleForHistory" class="vehicle-history-header">
              <span class="history-badge">Historique: {{ plate(selectedVehicleForHistory) }}</span>
              <button @click="selectedVehicleForHistory = null" class="btn-history-close">✕</button>
            </div>
          </div>
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
              <!-- Mode historique pour un véhicule spécifique -->
              <template v-if="selectedVehicleForHistory">
                <tr v-for="it in vehicleHistory" :key="it.id">
                  <td>
                    <strong>{{ plate(it.vehicleId) }}</strong>
                    <span v-if="isVehicleInRepairById(it.vehicleId)" class="vehicle-repair-note">EN RÉPARATION</span>
                  </td>
                  <td>
                    <span class="type-tag">{{ it.center || 'N/A' }}</span><br/>
                    <small>{{ it.notes }}</small>
                  </td>
                  <td>
                    <div v-if="getEffectiveNextVisitDate(it)" class="next-date-cell">
                      <span class="next-date">{{ formatDate(getEffectiveNextVisitDate(it)) }}</span>
                    </div>
                    <span v-else class="no-date">—</span>
                  </td>
                  <td>
                    <div v-if="getEffectiveNextVisitDate(it)" class="time-remaining-cell">
                      <div class="time-indicator" :class="getTimeRemainingClass(getEffectiveNextVisitDate(it))">
                        <span class="time-icon">{{ getTimeIcon(getEffectiveNextVisitDate(it)) }}</span>
                        <span class="time-text">{{ getTimeRemainingText(getEffectiveNextVisitDate(it)) }}</span>
                      </div>
                      <div class="time-detail" :class="getTimeRemainingClass(getEffectiveNextVisitDate(it))">
                        {{ getTimeRemainingDetail(getEffectiveNextVisitDate(it)) }}
                      </div>
                    </div>
                    <span v-else class="no-date">—</span>
                  </td>
                  <td class="text-right total-price">{{ it.cost?.toLocaleString() || 0 }} <small>FCFA</small></td>
                  <td class="text-center">
                    <span class="badge" :class="getResultBadgeClass(getDisplayResult(it))">
                      {{ getDisplayResult(it) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="action-buttons">
                      <button v-if="!it.result" @click="openResult(it)" class="btn-icon btn-complete">✔️</button>
                      <button @click="editItem(it)" class="btn-icon" :disabled="!canModify(it)">✏️</button>
                      <button @click="remove(it)" class="btn-icon" :class="canModify(it) ? 'btn-del' : 'btn-lock'" :disabled="!canModify(it)">
                        {{ canModify(it) ? '🗑️' : '🔒' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
              
              <!-- Mode normal : dernières visites par véhicule -->
              <template v-else>
                <tr v-for="it in latestVisits" :key="it.id">
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <strong>{{ plate(it.vehicleId) }}</strong>
                      <span v-if="isVehicleInRepairById(it.vehicleId)" class="vehicle-repair-note">EN RÉPARATION</span>
                      <button @click="viewVehicleHistory(it.vehicleId)" class="btn-history" title="Voir l'historique">
                        📋
                      </button>
                    </div>
                  </td>
                  <td>
                    <span class="type-tag">{{ it.center || 'N/A' }}</span><br/>
                    <small>{{ it.notes }}</small>
                  </td>
                  <td>
                    <div v-if="getEffectiveNextVisitDate(it)" class="next-date-cell">
                      <span class="next-date">{{ formatDate(getEffectiveNextVisitDate(it)) }}</span>
                    </div>
                    <span v-else class="no-date">—</span>
                  </td>
                  <td>
                    <div v-if="getEffectiveNextVisitDate(it)" class="time-remaining-cell">
                      <div class="time-indicator" :class="getTimeRemainingClass(getEffectiveNextVisitDate(it))">
                        <span class="time-icon">{{ getTimeIcon(getEffectiveNextVisitDate(it)) }}</span>
                        <span class="time-text">{{ getTimeRemainingText(getEffectiveNextVisitDate(it)) }}</span>
                      </div>
                      <div class="time-detail" :class="getTimeRemainingClass(getEffectiveNextVisitDate(it))">
                        {{ getTimeRemainingDetail(getEffectiveNextVisitDate(it)) }}
                      </div>
                    </div>
                    <span v-else class="no-date">—</span>
                  </td>
                  <td class="text-right total-price">{{ it.cost?.toLocaleString() || 0 }} <small>FCFA</small></td>
                  <td class="text-center">
                    <span class="badge" :class="getResultBadgeClass(getDisplayResult(it))">
                      {{ getDisplayResult(it) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="action-buttons">
                      <button v-if="!it.result" @click="openResult(it)" class="btn-icon btn-complete">✔️</button>
                      <button @click="editItem(it)" class="btn-icon" :disabled="!canModify(it)">✏️</button>
                      <button @click="remove(it)" class="btn-icon" :class="canModify(it) ? 'btn-del' : 'btn-lock'" :disabled="!canModify(it)">
                        {{ canModify(it) ? '🗑️' : '🔒' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          
          <!-- Message si aucune visite en cours -->
          <div v-if="latestVisits.length === 0 && !selectedVehicleForHistory" class="empty-state">
            <div class="empty-icon">📅</div>
            <h3>Aucune visite technique en cours</h3>
            <p>Planifiez une nouvelle visite pour commencer le suivi</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api from "../services/api";

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
const selectedVehicleForHistory = ref(null); // Véhicule sélectionné pour l'historique
const vehicleHistory = ref([]); // Historique d'un véhicule spécifique

const uiDate = ref(new Date().toISOString().split('T')[0]);
const uiDoneAt = ref("");
const uiNextInspect = ref("");
const initialForm = { vehicleId: "", center: "", cost: 0, notes: "", type: "VISITE_TECHNIQUE" };
const form = ref({ ...initialForm });
const resultForm = ref({ id: null, vehicleId: "", result: "SUCCES", cost: null, notes: "" });

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

const plate = (id) => vehicles.value.find(v => v.id === id)?.plate || "—";
const getVehicleById = (id) => vehicles.value.find(v => String(v.id) === String(id));
const isVehicleInRepairById = (id) => isVehicleInRepair(getVehicleById(id));
const isVehicleOutOfServiceById = (id) => isVehicleOutOfService(getVehicleById(id));

const getEffectiveNextVisitDate = (visit) => {
  if (!visit) return null;

  // Règle métier:
  // - utiliser la date de prochaine visite si disponible
  // - sinon (première visite), utiliser la date planifiée
  return visit.nextInspect || visit.scheduledAt || null;
};

const getDisplayResult = (visit) => {
  if (!visit?.result) return "EN ATTENTE";
  return visit.result;
};

// Calculer les dernières visites par véhicule (exclure les SUCCÈS anciens)
const latestVisits = computed(() => {
  const visitsByVehicle = {};
  
  items.value.forEach(visit => {
    const vehicleId = visit.vehicleId;
    if (isVehicleOutOfServiceById(vehicleId)) return;
    
    // Si pas encore de visite pour ce véhicule OU si c'est plus récent
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
  
  // Convertir en tableau et trier
  return Object.values(visitsByVehicle).sort((a, b) => {
    // Visites sans résultat d'abord
    if (!a.result && b.result) return -1;
    if (a.result && !b.result) return 1;
    
    // Ensuite par date affichée de prochaine visite (règle métier)
    const aNext = getEffectiveNextVisitDate(a);
    const bNext = getEffectiveNextVisitDate(b);
    if (aNext && bNext) return new Date(aNext) - new Date(bNext);
    if (aNext && !bNext) return -1;
    if (!aNext && bNext) return 1;
    
    // Enfin par date planifiée
    return new Date(b.scheduledAt) - new Date(a.scheduledAt);
  });
});

// Pagination basée sur latestVisits ou vehicleHistory
const displayItems = computed(() => {
  return selectedVehicleForHistory.value ? vehicleHistory.value : latestVisits.value;
});

const totalPages = computed(() => Math.ceil(displayItems.value.length / itemsPerPage) || 1);
const paginatedItems = computed(() => {
  const items = displayItems.value;
  return items.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage);
});

const canModify = (inspection) => {
  if (!inspection) return false;

  const now = Date.now();

  // Règle métier: une visite validée en SUCCES se verrouille après 24h.
  if (inspection.result === "SUCCES") {
    const successRefDate = inspection.doneAt || inspection.updatedAt || inspection.createdAt;
    if (!successRefDate) return false;
    const diffHours = (now - new Date(successRefDate).getTime()) / (1000 * 3600);
    return diffHours <= 24;
  }

  // Règle existante pour les autres cas.
  if (!inspection.createdAt) return true;
  return ((now - new Date(inspection.createdAt).getTime()) / (1000 * 3600)) <= 72;
};


const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Fonction pour obtenir le nombre exact de jours
const getDaysNumber = (targetDate) => {
  if (!targetDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setHours(0, 0, 0, 0);
  const diffTime = nextDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Texte court pour l'indicateur de temps
const getTimeRemainingText = (nextInspectDate) => {
  const diffDays = getDaysNumber(nextInspectDate);
  if (diffDays < 0) return `+${Math.abs(diffDays)}j`;
  if (diffDays === 0) return 'Auj.';
  if (diffDays === 1) return 'Dem.';
  if (diffDays < 7) return `${diffDays}j`;
  if (diffDays < 30) return `${Math.floor(diffDays/7)}sem`;
  if (diffDays < 365) return `${Math.floor(diffDays/30)}mois`;
  return `${Math.floor(diffDays/365)}an`;
};

// Détail du temps restant
const getTimeRemainingDetail = (nextInspectDate) => {
  const diffDays = getDaysNumber(nextInspectDate);
  if (diffDays < 0) return `Expiré depuis ${Math.abs(diffDays)} jours`;
  if (diffDays === 0) return 'Aujourd\'hui';
  if (diffDays === 1) return 'Demain';
  if (diffDays < 7) return `${diffDays} jours restants`;
  if (diffDays < 30) return `${diffDays} jours (${Math.floor(diffDays/7)} semaines)`;
  if (diffDays < 365) return `${diffDays} jours (${Math.floor(diffDays/30)} mois)`;
  return `${diffDays} jours (${Math.floor(diffDays/365)} ans)`;
};

// Icône selon le temps restant
const getTimeIcon = (nextInspectDate) => {
  const diffDays = getDaysNumber(nextInspectDate);
  if (diffDays < 0) return '⚠️';
  if (diffDays === 0) return '⏰';
  if (diffDays === 1) return '🚀';
  if (diffDays < 7) return '📅';
  if (diffDays < 30) return '📆';
  if (diffDays < 90) return '🗓️';
  return '📅';
};

// Classe CSS pour le temps restant
const getTimeRemainingClass = (scheduledAt) => {
  const diffDays = getDaysNumber(scheduledAt);
  
  if (diffDays < 0) return 'time-expired';
  if (diffDays < 7) return 'time-urgent';
  if (diffDays < 30) return 'time-warning';
  if (diffDays < 90) return 'time-normal';
  return 'time-future';
};

const getOngoingVisitUntil = (visit) => {
  if (!visit) return null;
  const now = new Date();

  if (visit.nextInspect) {
    const next = new Date(visit.nextInspect);
    if (!Number.isNaN(next.getTime()) && next > now) return next;
  }

  if (!visit.result && visit.scheduledAt) {
    const scheduled = new Date(visit.scheduledAt);
    if (!Number.isNaN(scheduled.getTime()) && scheduled > now) return scheduled;
  }

  return null;
};

const getDaysUntilDate = (date) => {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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

async function load() {
  try {
    const [v, i] = await Promise.all([
      api.get("/vehicles"),
      api.get("/inspections?type=VISITE_TECHNIQUE")
    ]);
    
    vehicles.value = v.data;
    items.value = i.data;
    
    console.log("🔍 Toutes les visites chargées:", items.value.length);
    console.log("🚗 Dernières visites par véhicule:", latestVisits.value.length);
    
  } catch (e) { 
    console.error("❌ Erreur de chargement:", e);
    error.value = "Erreur de chargement des données";
  }
}

// Afficher l'historique d'un véhicule spécifique
function viewVehicleHistory(vehicleId) {
  selectedVehicleForHistory.value = vehicleId;
  vehicleHistory.value = items.value
    .filter(item => item.vehicleId === vehicleId)
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
  
  console.log(`📊 Historique pour ${plate(vehicleId)}:`, vehicleHistory.value.length, "visites");
  currentPage.value = 1;
}

async function processSubmit() {
  if (!form.value.vehicleId || !uiDate.value) {
    error.value = "Veuillez sélectionner un véhicule et une date";
    return;
  }
  const selectedVehicle = getVehicleById(form.value.vehicleId);
  if (!isVehicleInService(selectedVehicle)) {
    error.value = "Impossible: seules les opérations sur véhicule EN SERVICE sont autorisées.";
    return;
  }
  if (!isEditing.value) {
    const blockingVisit = findBlockingVisitForNewEntry(form.value.vehicleId);
    if (blockingVisit) {
      const until = getOngoingVisitUntil(blockingVisit);
      const remaining = getDaysUntilDate(until);
      error.value = `Impossible de saisir une nouvelle visite: une visite en cours reste valide ${remaining} jour(s).`;
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
    
    cancelEdit();
    await load();
  } catch (e) { 
    console.error("❌ Erreur lors de l'enregistrement:", e);
    error.value = "Erreur lors de l'enregistrement";
  } finally { 
    submitting.value = false; 
  }
}

function openResult(it) {
  if (!isVehicleInService(getVehicleById(it.vehicleId))) {
    error.value = "Impossible: véhicule non EN SERVICE.";
    return;
  }
  console.log("📋 Ouverture du formulaire pour:", it);
  
  resultForm.value = { 
    id: it.id, 
    vehicleId: it.vehicleId, 
    result: "SUCCES", 
    cost: it.cost || 0, 
    notes: it.notes || "" 
  };

  uiDoneAt.value = new Date().toISOString().split("T")[0];
  if (it.nextInspect) {
    uiNextInspect.value = it.nextInspect.substring(0, 10);
  } else if (it.scheduledAt) {
    const nextDate = new Date(it.scheduledAt);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    uiNextInspect.value = nextDate.toISOString().split("T")[0];
  } else {
    uiNextInspect.value = uiDoneAt.value;
  }
  
  showResultForm.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitResult() {
  if (!resultForm.value.result || !uiDoneAt.value || !uiNextInspect.value) {
    error.value = "Le résultat, la date effective et la prochaine visite sont obligatoires";
    return;
  }
  
  submitting.value = true;
  try {
    console.log("🚀 Début de la validation...");
    
    // Mettre à jour l'inspection actuelle avec le résultat (comme maintenance)
    const updatePayload = {
      result: resultForm.value.result,
      cost: Number(resultForm.value.cost) || 0,
      notes: resultForm.value.notes || "",
      doneAt: new Date(uiDoneAt.value).toISOString(),
      nextInspect: new Date(uiNextInspect.value).toISOString()
    };
    
    console.log("📤 Payload de mise à jour:", updatePayload);
    
    const updateResponse = await api.patch(`/inspections/${resultForm.value.id}/validate`, updatePayload);
    console.log("✅ Visite mise à jour:", updateResponse.data);
    
    successMessage.value = `✅ Visite validée avec succès`;
    
    // Réinitialiser
    showResultForm.value = false;
    uiDoneAt.value = "";
    uiNextInspect.value = "";
    
    // Si on était en mode historique, rester sur le même véhicule
    const currentVehicleId = resultForm.value.vehicleId;
    await load();
    
    if (selectedVehicleForHistory.value === currentVehicleId) {
      viewVehicleHistory(currentVehicleId);
    }
    
  } catch (e) { 
    console.error("❌ Erreur détaillée:", e);
    
    if (e.response) {
      if (e.response.status === 400) {
        error.value = "Données invalides. Vérifiez les informations saisies.";
      } else if (e.response.status === 404) {
        error.value = "Visite non trouvée. Actualisez la page.";
      } else {
        error.value = `Erreur serveur (${e.response.status}). Veuillez réessayer.`;
      }
    } else if (e.request) {
      error.value = "Pas de réponse du serveur. Vérifiez votre connexion.";
    } else {
      error.value = `Erreur: ${e.message}`;
    }
  } finally { 
    submitting.value = false; 
  }
}

function editItem(it) {
  if (!isVehicleInService(getVehicleById(it.vehicleId))) {
    error.value = "Impossible: véhicule non EN SERVICE.";
    return;
  }
  if (!canModify(it)) {
    error.value = it?.result === "SUCCES"
      ? "Cette visite validée (SUCCÈS) est verrouillée après 24h."
      : "Cette visite ne peut plus être modifiée (délai de 72h dépassé).";
    return;
  }

  console.log("✏️ Édition de la visite:", it);
  
  isEditing.value = true;
  editingId.value = it.id;
  uiDate.value = it.scheduledAt ? it.scheduledAt.substring(0, 10) : "";
  form.value = { 
    vehicleId: it.vehicleId,
    center: it.center || "",
    cost: it.cost || 0,
    notes: it.notes || "",
    type: it.type || "VISITE_TECHNIQUE"
  };
  showResultForm.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() { 
  isEditing.value = false; 
  editingId.value = null; 
  form.value = { ...initialForm };
  showResultForm.value = false;
}

async function remove(it) {
  if (!canModify(it)) {
    error.value = it?.result === "SUCCES"
      ? "Cette visite validée (SUCCÈS) est verrouillée après 24h."
      : "Cette visite ne peut plus être supprimée (délai de 72h dépassé)";
    return;
  }
  
  if (confirm("Êtes-vous sûr de vouloir supprimer cette visite ?")) { 
    try {
      await api.delete(`/inspections/${it.id}`); 
      successMessage.value = "Visite supprimée avec succès";
      await load(); 
    } catch (e) {
      console.error("❌ Erreur de suppression:", e);
      error.value = "Erreur lors de la suppression";
    }
  }
}

const getResultBadgeClass = (r) => {
  const normalized = String(r || "").trim().toUpperCase();
  if (!normalized || normalized === "EN ATTENTE" || normalized === "PLANIFIE") return 'badge-warn';
  return normalized === 'SUCCES' ? 'badge-success' : 'badge-danger';
};

onMounted(load);
</script>

<style scoped>
.container { padding: 20px; font-family: 'Segoe UI', sans-serif; background: #f4f7f6; min-height: 100vh; }
.main-title { color: #2c3e50; font-size: 1.5rem; margin-bottom: 20px; border-left: 5px solid #3498db; padding-left: 15px; }
.card { border-radius: 8px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); background: white; }
.card-blue { border-top: 4px solid #3498db; }
.card-orange { border-top: 4px solid #e67e22; }
.card-green { border-top: 4px solid #27ae60; }
.card-header { padding: 12px 20px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; }
.card-body { padding: 20px; }
.row { display: flex; gap: 15px; align-items: flex-end; }
.mt-20 { margin-top: 20px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.7rem; font-weight: 800; color: #7f8c8d; text-transform: uppercase; }
.flex-1 { flex: 1; } .flex-2 { flex: 2; } .flex-3 { flex: 3; }
.custom-input { padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 0.9rem; width: 100%; box-sizing: border-box; transition: border 0.3s; }
.custom-input:focus { border-color: #3498db; outline: none; box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2); }
.border-success { border: 2px solid #27ae60 !important; }
.border-success:focus { border-color: #219653 !important; box-shadow: 0 0 0 2px rgba(39, 174, 96, 0.2) !important; }
.btn-primary { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.3s; }
.btn-primary:hover:not(:disabled) { background: #2980b9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-orange { background: #e67e22; }
.btn-orange:hover:not(:disabled) { background: #d35400; }
.btn-success { background: #27ae60; color: white; border: none; padding: 10px 25px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.3s; }
.btn-success:hover:not(:disabled) { background: #219653; }
.btn-success:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-cancel { background: #95a5a6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; transition: background 0.3s; }
.btn-cancel:hover { background: #7f8c8d; }
.station-banner { background: #2c3e50; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
.tank-table { width: 100%; border-collapse: collapse; }
.tank-table th { background: #f8f9fa; padding: 12px; font-size: 0.7rem; color: #7f8c8d; text-transform: uppercase; text-align: left; border-bottom: 2px solid #eee; }
.tank-table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 0.85rem; }
.badge { padding: 4px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: bold; }
.badge-warn { background: #fef3c7; color: #92400e; }
.badge-success { background: #d1fae5; color: #065f46; }
.badge-danger { background: #fee2e2; color: #991b1b; }
.type-tag { background: #e1f5fe; color: #0288d1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.action-buttons { display: flex; gap: 5px; justify-content: center; }
.btn-icon { border: none; padding: 6px; border-radius: 4px; cursor: pointer; background: #f1f2f6; transition: all 0.2s; }
.btn-icon:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.btn-del:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }
.btn-lock { opacity: 0.3; cursor: not-allowed; }
.btn-complete { background: #d1fae5 !important; color: #065f46; }
.btn-complete:hover:not(:disabled) { background: #10b981 !important; color: white !important; }
.vehicle-repair-note {
  display: inline-block;
  margin-left: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 2px 6px;
}
.notification { padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; font-weight: 500; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.notification button { background: transparent; border: none; color: white; font-size: 1.2rem; cursor: pointer; }
.bg-red { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); }
.bg-green { background: linear-gradient(135deg, #27ae60 0%, #219653 100%); }

/* Styles pour la date de prochaine visite */
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

.time-icon {
  font-size: 1rem;
}

.time-text {
  font-weight: 700;
  font-size: 0.9rem;
}

.time-detail {
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 10px;
  text-align: center;
  max-width: 150px;
  transition: all 0.3s;
}

/* Styles pour les différentes catégories de temps */
.time-expired .time-indicator {
  background-color: #fee2e2;
  color: #991b1b;
  border: 2px solid #dc2626;
  animation: pulse 1.5s infinite;
}

.time-expired .time-detail {
  background-color: rgba(254, 226, 226, 0.3);
  color: #991b1b;
}

.time-urgent .time-indicator {
  background-color: #fef3c7;
  color: #92400e;
  border: 2px solid #f59e0b;
  animation: pulse 2s infinite;
}

.time-urgent .time-detail {
  background-color: rgba(254, 243, 199, 0.3);
  color: #92400e;
}

.time-warning .time-indicator {
  background-color: #fef3c7;
  color: #92400e;
  border: 2px solid #fbbf24;
}

.time-warning .time-detail {
  background-color: rgba(254, 243, 199, 0.3);
  color: #92400e;
}

.time-normal .time-indicator {
  background-color: #d1fae5;
  color: #065f46;
  border: 2px solid #10b981;
}

.time-normal .time-detail {
  background-color: rgba(209, 250, 229, 0.3);
  color: #065f46;
}

.time-future .time-indicator {
  background-color: #e0f2fe;
  color: #0369a1;
  border: 2px solid #0ea5e9;
}

.time-future .time-detail {
  background-color: rgba(224, 242, 254, 0.3);
  color: #0369a1;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.no-date {
  color: #95a5a6;
  font-style: italic;
}


/* Styles pour l'historique */
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

/* État vide */
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

.mt-10 {
  margin-top: 10px;
}

.bg-light-green {
  background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%) !important;
}

/* Animation */
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

/* Responsive */
@media (max-width: 768px) {
  .row {
    flex-direction: column;
  }
  
  .flex-1, .flex-2, .flex-3 {
    flex: 1;
    width: 100%;
  }
  
  .action-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .station-banner {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  
  .time-remaining-cell {
    min-width: 100px;
  }
  
  .time-indicator {
    padding: 6px 10px;
    min-width: 70px;
  }
  
  .time-text {
    font-size: 0.8rem;
  }
}
</style>

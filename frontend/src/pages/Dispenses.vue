<template>
  <div class="container">
    <h2 class="main-title">Ravitaillements (Véhicules Actifs)</h2>

    <div class="grid-layout">
      <!-- FORMULAIRE DE SAISIE -->
      <div class="card" :class="isEditing ? 'card-orange' : 'card-blue'">
        <div class="card-header">
          <span>{{ isEditing ? '📝 Modification' : '⛽ Nouveau Ravitaillement' }}</span>
          <button v-if="isEditing" @click="cancelEdit" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body">
          <div class="compact-form">
            <!-- Ligne 1 : Véhicule, Source et Chauffeur -->
            <div class="row">
              <div class="field flex-2">
                <label>Véhicule (En Service)</label>
                <select v-model="form.vehicleId" @change="handleVehicleChange" class="custom-input">
                  <option value="" disabled>Choisir véhicule...</option>
                  <option v-for="v in activeVehicles" :key="v.id" :value="v.id">
                    {{ v.plate }} [{{ v.fuelType }}]
                  </option>
                </select>
              </div>
              <div class="field flex-2">
                <label>Source (Cuve)</label>
                <select v-model="form.tankId" :disabled="!form.vehicleId" class="custom-input highlight-tank">
                  <option value="" disabled>Sélectionner la cuve</option>
                  <optgroup v-for="s in filteredStations" :key="s.id" :label="s.name">
                    <option v-for="t in s.tanks.filter(tk => tk.fuelType === selectedVehicle?.fuelType)" :key="t.id" :value="t.id">
                      {{ t.fuelType }} ({{ t.currentL }}L dispo)
                    </option>
                  </optgroup>
                </select>
              </div>
              <div class="field flex-1">
                <label>Chauffeur</label>
                <select v-model="form.driverId" class="custom-input" :disabled="isDriverAssigned">
                  <option value="">-- Aucun --</option>
                  <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.fullName }}</option>
                </select>
              </div>
            </div>

            <!-- Ligne 2 : Données de ravitaillement -->
            <div class="row mt-30">
              <div class="field">
                <label>Km Compteur <small v-if="selectedVehicle" class="info-km">
                  (Actuel: {{ selectedVehicle.odometerKm }} km)
                </small></label>
                <input type="number" v-model.number="form.odometerKm" class="custom-input" />
              </div>
              <div class="field">
                <label>Volume (Litres)</label>
                <input type="number" v-model.number="form.liters" class="custom-input" step="0.01" />
              </div>
              <div class="field">
                <label>Prix Unit. (L)</label>
                <input type="number" v-model.number="form.unitPrice" class="custom-input" />
              </div>
              <div class="total-inline">
                <span class="total-label">Montant Total :</span>
                <span class="total-val">{{ (form.liters * (form.unitPrice || 0)).toLocaleString() }}</span> <small>FCFA</small>
              </div>
              <button 
                :class="isEditing ? 'btn-orange' : 'btn-primary'" 
                @click="processSubmit" 
                :disabled="submitting || !form.tankId || form.liters <= 0"
              >
                {{ submitting ? '⏳ Traitement...' : (isEditing ? 'Mettre à jour' : 'Valider') }}
              </button>
            </div>

            <!-- Messages d'erreur -->
            <div v-if="validationErrors.length > 0" class="validation-errors mt-20">
              <strong>❌ Erreurs de validation :</strong>
              <ul>
                <li v-for="(err, index) in validationErrors" :key="index">{{ err }}</li>
              </ul>
            </div>
            
            <div v-if="apiError" class="error-message mt-20">
              <strong>❌ Erreur :</strong> {{ apiError }}
            </div>
          </div>
        </div>
      </div>

      <!-- TABLEAU D'HISTORIQUE -->
      <div class="station-block shadow-sm mt-20">
        <div class="station-banner">
          <span>Historique des opérations ({{ items.length }})</span>
          <div v-if="searchActive" class="search-badge">
            🔍 Recherche active
          </div>
        </div>

        <!-- FILTRES DE RECHERCHE -->
        <div class="card card-green mb-20">
          <div class="card-header">
            🔍 Recherche et Filtres
          </div>
          <div class="card-body">
            <div class="search-form">
              <div class="row row-spaced">
                <div class="field flex-2">
                  <label>Véhicule</label>
                  <select v-model="searchFilters.vehicleId" class="custom-input" @change="handleSearch">
                    <option value="">Tous les véhicules</option>
                    <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                      {{ vehicle.plate }} ({{ vehicle.fuelType }})
                    </option>
                  </select>
                </div>
                
                <div class="field flex-2">
                  <label>Date spécifique</label>
                  <input 
                    type="date" 
                    v-model="searchFilters.date" 
                    class="custom-input"
                    @change="handleSearch"
                  />
                </div>
                
                <div class="field flex-2">
                  <label>Station</label>
                  <select v-model="searchFilters.stationId" class="custom-input" @change="handleSearch">
                    <option value="">Toutes les stations</option>
                    <option v-for="station in stations" :key="station.id" :value="station.id">
                      {{ station.name }}
                    </option>
                  </select>
                </div>
                
                <div class="field flex-1">
                  <button @click="resetFilters" class="btn-gray mt-25">
                    🔄 Réinitialiser
                  </button>
                </div>
              </div>
              
              <div v-if="searchActive" class="search-active mt-10">
                <small>
                  🔍 Recherche active: 
                  <span v-if="searchFilters.vehicleId">Véhicule {{ getVehiclePlate(searchFilters.vehicleId) }} | </span>
                  <span v-if="searchFilters.date">Date: {{ formatDisplayDate(searchFilters.date) }} | </span>
                  <span v-if="searchFilters.stationId">Station: {{ getStationName(searchFilters.stationId) }}</span>
                </small>
              </div>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="tank-table">
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Véhicule / Chauffeur</th>
                <th>Source</th>
                <th>Volume</th>
                <th class="text-right">Total</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in paginatedItems" :key="it.id">
                <td>{{ formatDate(it.dispensedAt) }}</td>
                <td>
                  <strong>{{ it.vehicle?.plate || 'N/A' }}</strong><br/>
                  <small>{{ it.driver?.fullName || 'N/A' }}</small>
                </td>
                <td>
                  <small>{{ it.station?.name || 'N/A' }}</small><br/>
                  <span class="fuel-badge">{{ it.tank?.fuelType || 'N/A' }}</span>
                </td>
                <td class="stock-text">{{ it.liters?.toLocaleString() || 0 }} L</td>
                <td class="text-right total-price">
                  {{ ((it.liters || 0) * (it.unitPrice || 0)).toLocaleString() }} <small>FCFA</small>
                </td>
                <td class="text-center">
                  <div v-if="canModify(it.dispensedAt)" class="action-buttons">
                    <button @click="editItem(it)" class="btn-icon" title="Modifier">✏️</button>
                    <button @click="confirmDeleteItem(it)" class="btn-icon btn-del" title="Supprimer">🗑️</button>
                  </div>
                  <span v-else class="locked" title="Délai dépassé">🔒</span>
                </td>
              </tr>
              <tr v-if="paginatedItems.length === 0">
                <td colspan="6" class="text-center">
                  <div v-if="searchActive" class="empty-search">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-text">Aucun résultat trouvé</div>
                    <small class="empty-subtext">
                      Essayez de modifier vos critères de recherche
                    </small>
                  </div>
                  <div v-else class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-text">Aucun ravitaillement enregistré</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- PAGINATION COMPLÈTE -->
          <div v-if="filteredItems.length > 0" class="pagination-container">
            <div class="pagination-info">
              Affichage {{ startIndex + 1 }}-{{ endIndex }} sur {{ filteredItems.length }}
            </div>
            <div class="pagination-controls">
              <button 
                @click="previousPage" 
                :disabled="currentPage === 1"
                class="pagination-btn"
                title="Page précédente"
              >
                ← Précédent
              </button>
              
              <div class="page-numbers">
                <button
                  v-for="page in visiblePages"
                  :key="page"
                  @click="goToPage(page)"
                  :class="['page-btn', { active: page === currentPage }]"
                  :disabled="page === '...'"
                  :title="page !== '...' ? `Aller à la page ${page}` : ''"
                >
                  {{ page }}
                </button>
              </div>
              
              <button 
                @click="nextPage" 
                :disabled="currentPage === totalPages"
                class="pagination-btn"
                title="Page suivante"
              >
                Suivant →
              </button>
            </div>
            <div class="pagination-size">
              <label>Lignes par page :</label>
              <select v-model="itemsPerPage" @change="resetToFirstPage" class="page-size-select">
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- POPUP DE CONFIRMATION DE SUPPRESSION -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content delete-modal">
        <div class="modal-header">
          <h3 class="modal-title">🗑️ Confirmer la suppression</h3>
          <button class="modal-close" @click="closeDeleteModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon warning">
            ⚠️
          </div>
          <p class="modal-message">
            Êtes-vous sûr de vouloir supprimer ce ravitaillement ?
          </p>
          <div class="modal-details" v-if="itemToDelete">
            <div class="detail-item">
              <span class="detail-label">Véhicule :</span>
              <span class="detail-value">{{ itemToDelete.vehicle?.plate || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Date :</span>
              <span class="detail-value">{{ formatDate(itemToDelete.dispensedAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Volume :</span>
              <span class="detail-value">{{ itemToDelete.liters }} L</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Montant :</span>
              <span class="detail-value">{{ ((itemToDelete.liters || 0) * (itemToDelete.unitPrice || 0)).toLocaleString() }} FCFA</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeDeleteModal">Annuler</button>
          <button class="btn-delete" @click="executeDelete" :disabled="deleting">
            {{ deleting ? 'Suppression en cours...' : 'Confirmer la suppression' }}
          </button>
        </div>
      </div>
    </div>

    <!-- POPUP DE SUCCÈS -->
    <div v-if="showSuccessModal" class="modal-overlay" @click.self="closeSuccessModal">
      <div class="modal-content success-modal">
        <div class="modal-header">
          <h3 class="modal-title">✅ Succès</h3>
          <button class="modal-close" @click="closeSuccessModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon success">
            ✅
          </div>
          <p class="modal-message">
            {{ successMessage }}
          </p>
          <div class="modal-details" v-if="successDetails">
            <div class="detail-item">
              <span class="detail-label">{{ successDetails.label }} :</span>
              <span class="detail-value">{{ successDetails.value }}</span>
            </div>
          </div>
          <div class="modal-summary" v-if="operationSummary">
            <div class="summary-item" v-for="(item, key) in operationSummary" :key="key">
              <span class="summary-label">{{ item.label }} :</span>
              <span class="summary-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ok" @click="closeSuccessModal">OK</button>
        </div>
      </div>
    </div>

    <!-- POPUP D'ERREUR -->
    <div v-if="showErrorModal" class="modal-overlay" @click.self="closeErrorModal">
      <div class="modal-content error-modal">
        <div class="modal-header">
          <h3 class="modal-title">❌ Erreur</h3>
          <button class="modal-close" @click="closeErrorModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon error">
            ❌
          </div>
          <p class="modal-message">
            {{ errorMessage }}
          </p>
          <div class="modal-details" v-if="errorDetails">
            <pre class="error-details">{{ errorDetails }}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ok" @click="closeErrorModal">OK</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import api from "../services/api";

const stations = ref([]);
const vehicles = ref([]);
const drivers = ref([]);
const items = ref([]);
const submitting = ref(false);
const deleting = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const currentPage = ref(1);
const itemsPerPage = ref(10);

// États des modales
const showDeleteModal = ref(false);
const showSuccessModal = ref(false);
const showErrorModal = ref(false);

// Données pour les modales
const itemToDelete = ref(null);
const successMessage = ref("");
const successDetails = ref(null);
const operationSummary = ref(null);
const errorMessage = ref("");
const errorDetails = ref("");

// Messages dans le formulaire
const validationErrors = ref([]);
const apiError = ref("");

// Filtres de recherche
const searchFilters = ref({
  vehicleId: "",
  date: "",
  stationId: "",
});

const initialForm = { 
  vehicleId: "", 
  driverId: "", 
  tankId: "", 
  liters: 0, 
  unitPrice: 0, 
  odometerKm: 0 
};
const form = ref({ ...initialForm });

// Computed properties
const activeVehicles = computed(() => vehicles.value.filter(v => v.status === 'EN_SERVICE'));
const selectedVehicle = computed(() => vehicles.value.find(v => v.id === form.value.vehicleId));
const isDriverAssigned = computed(() => !!(selectedVehicle.value?.driverId));

const filteredStations = computed(() => {
  if (!selectedVehicle.value) return [];
  return stations.value.filter(s => s.tanks?.some(t => t.fuelType === selectedVehicle.value.fuelType));
});

const searchActive = computed(() => {
  return Object.values(searchFilters.value).some(val => val !== "");
});

const filteredItems = computed(() => {
  if (!searchActive.value) {
    return items.value;
  }
  
  return items.value.filter(item => {
    // Filtre par véhicule
    if (searchFilters.value.vehicleId && item.vehicleId !== searchFilters.value.vehicleId) {
      return false;
    }
    
    // Filtre par date
    if (searchFilters.value.date) {
      const itemDate = new Date(item.dispensedAt).toISOString().split('T')[0];
      const searchDate = new Date(searchFilters.value.date).toISOString().split('T')[0];
      if (itemDate !== searchDate) {
        return false;
      }
    }
    
    // Filtre par station
    if (searchFilters.value.stationId && item.stationId !== searchFilters.value.stationId) {
      return false;
    }
    
    return true;
  });
});

// Pagination computed properties
const totalPages = computed(() => {
  return Math.ceil(filteredItems.value.length / itemsPerPage.value) || 1;
});

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredItems.value.slice(start, end);
});

const startIndex = computed(() => {
  return (currentPage.value - 1) * itemsPerPage.value;
});

const endIndex = computed(() => {
  const end = startIndex.value + itemsPerPage.value;
  return end > filteredItems.value.length ? filteredItems.value.length : end;
});

const visiblePages = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = currentPage.value;
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }
  }
  
  return pages;
});

// Méthodes utilitaires
const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

const formatDisplayDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('fr-FR');
  } catch {
    return dateString;
  }
};

const getVehiclePlate = (vehicleId) => {
  const vehicle = vehicles.value.find(v => v.id === vehicleId);
  return vehicle ? vehicle.plate : vehicleId;
};

const getStationName = (stationId) => {
  const station = stations.value.find(s => s.id === stationId);
  return station ? station.name : stationId;
};

const canModify = (dateIso) => {
  if (!dateIso) return false;
  try {
    const dispenseDate = new Date(dateIso);
    const now = new Date();
    const diffMinutes = (now - dispenseDate) / (1000 * 60);
    return diffMinutes < 30;
  } catch {
    return false;
  }
};

// Méthodes de pagination
function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

function goToPage(page) {
  if (page !== '...') {
    currentPage.value = page;
  }
}

function resetToFirstPage() {
  currentPage.value = 1;
}

// Gestion de la recherche
function handleSearch() {
  resetToFirstPage();
}

function resetFilters() {
  searchFilters.value = {
    vehicleId: "",
    date: "",
    stationId: "",
  };
  resetToFirstPage();
}

// Watcher pour réinitialiser la pagination lors de la recherche
watch(searchFilters, () => {
  resetToFirstPage();
}, { deep: true });

// Gestion des modales
function showSuccessPopup(message, details = null, summary = null) {
  successMessage.value = message;
  successDetails.value = details;
  operationSummary.value = summary;
  showSuccessModal.value = true;
}

function showErrorPopup(message, details = "") {
  errorMessage.value = message;
  errorDetails.value = details;
  showErrorModal.value = true;
}

function closeSuccessModal() {
  showSuccessModal.value = false;
  successMessage.value = "";
  successDetails.value = null;
  operationSummary.value = null;
}

function closeErrorModal() {
  showErrorModal.value = false;
  errorMessage.value = "";
  errorDetails.value = "";
}

function confirmDeleteItem(item) {
  itemToDelete.value = item;
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  itemToDelete.value = null;
  deleting.value = false;
}

// Clear messages
function clearMessages() {
  validationErrors.value = [];
  apiError.value = "";
}

// Gestion du formulaire
function handleVehicleChange() {
  form.value.tankId = "";
  if (selectedVehicle.value) {
    form.value.driverId = selectedVehicle.value.driverId || "";
    form.value.odometerKm = selectedVehicle.value.odometerKm || 0;
  }
}

async function load() {
  try {
    console.log("Chargement des données...");
    
    const [stationsRes, vehiclesRes, driversRes, dispensesRes] = await Promise.all([
      api.get("/stations"),
      api.get("/vehicles"),
      api.get("/drivers"),
      api.get("/fuel/dispenses")
    ]);
    
    stations.value = stationsRes.data || [];
    vehicles.value = vehiclesRes.data || [];
    drivers.value = driversRes.data || [];
    
    // Gérer les différents formats de réponse API
    console.log("📦 Réponse ravitaillements:", dispensesRes);
    
    if (Array.isArray(dispensesRes.data)) {
      items.value = dispensesRes.data;
    } else if (dispensesRes.data && dispensesRes.data.success && dispensesRes.data.data && Array.isArray(dispensesRes.data.data.items)) {
      items.value = dispensesRes.data.data.items;
    } else if (dispensesRes.data && dispensesRes.data.data && Array.isArray(dispensesRes.data.data)) {
      items.value = dispensesRes.data.data;
    } else {
      items.value = [];
    }
    
    // Trier par date (plus récent d'abord)
    items.value.sort((a, b) => new Date(b.dispensedAt) - new Date(a.dispensedAt));
    
    console.log(`✅ ${items.value.length} ravitaillements chargés`);
    
  } catch (e) { 
    console.error("Erreur lors du chargement:", e);
    showErrorPopup("Impossible de charger les données", e.message);
  }
}

async function processSubmit() {
  clearMessages();
  
  // Validation
  validationErrors.value = [];
  
  if (!form.value.vehicleId) {
    validationErrors.value.push("Véhicule requis");
  }
  
  if (!form.value.tankId) {
    validationErrors.value.push("Cuve source requise");
  }
  
  if (!form.value.liters || form.value.liters <= 0) {
    validationErrors.value.push("Volume doit être supérieur à 0");
  }
  
  if (selectedVehicle.value && form.value.odometerKm < selectedVehicle.value.odometerKm) {
    validationErrors.value.push(`L'index saisi (${form.value.odometerKm}) est inférieur au dernier index (${selectedVehicle.value.odometerKm}) du véhicule`);
  }
  
  if (validationErrors.value.length > 0) {
    return;
  }
  
  submitting.value = true;
  
  try {
    const tank = stations.value.flatMap(s => s.tanks).find(t => t.id === form.value.tankId);
    
    // Préparer le payload
    const payload = { 
      vehicleId: String(form.value.vehicleId),
      driverId: form.value.driverId || null,
      tankId: String(form.value.tankId),
      stationId: tank?.stationId ? String(tank.stationId) : null,
      liters: Number(form.value.liters),
      unitPrice: form.value.unitPrice ? Number(form.value.unitPrice) : null,
      odometerKm: form.value.odometerKm ? Number(form.value.odometerKm) : null
    };
    
    let response;
    const montantTotal = (form.value.liters * (form.value.unitPrice || 0)).toLocaleString();
    
    if (isEditing.value && editingId.value) {
      // Mode édition
      response = await api.put(`/fuel/dispenses/${editingId.value}`, payload);
      
      // Message de succès pour l'édition
      showSuccessPopup(
        "Ravitaillement modifié avec succès !",
        { label: "Véhicule", value: selectedVehicle.value?.plate || 'N/A' },
        [
          { label: "Volume", value: `${form.value.liters} L` },
          { label: "Montant", value: `${montantTotal} FCFA` },
          { label: "Km compteur", value: `${form.value.odometerKm} km` }
        ]
      );
    } else {
      // Mode création
      const creationPayload = {
        ...payload,
        dispensedAt: new Date().toISOString()
      };
      response = await api.post("/fuel/dispenses", creationPayload);
      
      // Message de succès pour la création
      showSuccessPopup(
        "Ravitaillement enregistré avec succès !",
        { label: "Véhicule", value: selectedVehicle.value?.plate || 'N/A' },
        [
          { label: "Volume", value: `${form.value.liters} L` },
          { label: "Montant", value: `${montantTotal} FCFA` },
          { label: "Km compteur", value: `${form.value.odometerKm} km` },
          { label: "Date", value: new Date().toLocaleString('fr-FR') }
        ]
      );
    }
    
    console.log("Réponse API:", response);
    
    cancelEdit(); 
    await load();
    resetToFirstPage();
    
  } catch (e) { 
    console.error("Erreur complète:", e);
    
    if (e.response) {
      const status = e.response.status;
      const data = e.response.data;
      
      if (status === 400) {
        if (data.errors && Array.isArray(data.errors)) {
          validationErrors.value = data.errors.map(err => err.message || err);
        } else if (data.message) {
          showErrorPopup("Erreur de validation", data.message);
        }
      } else if (status === 403) {
        showErrorPopup("Action non autorisée", "Délai de modification dépassé (30 minutes)");
      } else if (status === 404) {
        showErrorPopup("Ressource non trouvée", "L'élément que vous essayez de modifier n'existe plus");
      } else if (status === 500) {
        showErrorPopup("Erreur serveur", "Une erreur est survenue côté serveur. Veuillez réessayer.");
      } else {
        showErrorPopup(`Erreur ${status}`, data?.message || "Erreur inconnue");
      }
    } else if (e.request) {
      showErrorPopup("Erreur de connexion", "Pas de réponse du serveur. Vérifiez votre connexion internet.");
    } else {
      showErrorPopup("Erreur", "Erreur lors de l'envoi: " + e.message);
    }
  }
  finally { 
    submitting.value = false; 
  }
}

async function executeDelete() {
  if (!itemToDelete.value) return;
  
  deleting.value = true;
  
  try {
    await api.delete(`/fuel/dispenses/${itemToDelete.value.id}`);
    
    // Message de succès pour la suppression
    showSuccessPopup(
      "Ravitaillement supprimé avec succès !",
      { label: "Véhicule", value: itemToDelete.value.vehicle?.plate || 'N/A' },
      [
        { label: "Volume", value: `${itemToDelete.value.liters} L` },
        { label: "Montant", value: `${((itemToDelete.value.liters || 0) * (itemToDelete.value.unitPrice || 0)).toLocaleString()} FCFA` },
        { label: "Date", value: formatDate(itemToDelete.value.dispensedAt) }
      ]
    );
    
    await load();
    resetToFirstPage();
    closeDeleteModal();
    
  } catch (e) {
    console.error("Erreur suppression:", e);
    
    if (e.response?.status === 403) {
      showErrorPopup("Action non autorisée", "Délai de suppression dépassé (30 minutes)");
    } else if (e.response?.status === 404) {
      showErrorPopup("Ressource non trouvée", "Le ravitaillement que vous essayez de supprimer n'existe plus");
    } else {
      showErrorPopup("Erreur lors de la suppression", e.message);
    }
    
    closeDeleteModal();
  }
  finally {
    deleting.value = false;
  }
}

const cancelEdit = () => { 
  isEditing.value = false; 
  editingId.value = null; 
  form.value = { ...initialForm }; 
  clearMessages();
};

const editItem = (it) => { 
  isEditing.value = true; 
  editingId.value = it.id; 
  form.value = { 
    vehicleId: it.vehicleId || "",
    driverId: it.driverId || "",
    tankId: it.tankId || "",
    liters: it.liters || 0,
    unitPrice: it.unitPrice || 0,
    odometerKm: it.odometerKm || 0
  }; 
  window.scrollTo(0,0); 
  clearMessages();
};

onMounted(load);
</script>

<style scoped>
/* Styles de base */
.container { padding: 15px; background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; position: relative; }
.main-title { font-size: 20px; font-weight: 800; color: #1e293b; margin-bottom: 20px; }

/* Cartes et formulaires */
.card { border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; }
.card-blue { border-top: 5px solid #3b82f6; }
.card-orange { border-top: 5px solid #f59e0b; }
.card-green { border-top: 5px solid #10b981; }
.card-header { padding: 15px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; background: #fcfcfc; }
.card-body { padding: 20px; }

.row { display: flex; flex-direction: column; gap: 15px; }
.mt-30 { margin-top: 25px; }
.mb-20 { margin-bottom: 20px; }
.mt-20 { margin-top: 20px; }
.mt-25 { margin-top: 25px; }
.mt-10 { margin-top: 10px; }

.field { display: flex; flex-direction: column; gap: 5px; width: 100%; }
.field label { font-size: 12px; font-weight: 600; color: #64748b; }
.info-km { color: #3b82f6; font-weight: bold; }
.custom-input { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
.total-inline { font-size: 18px; font-weight: 900; color: #1e293b; padding: 10px 0; }
.total-label { font-size: 12px; color: #64748b; display: block; }

/* Boutons */
.btn-primary, .btn-orange { padding: 12px; border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; width: 100%; }
.btn-primary { background: #3b82f6; }
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-orange { background: #f59e0b; }
.btn-orange:hover:not(:disabled) { background: #d97706; }
.btn-primary:disabled, .btn-orange:disabled { background: #cbd5e1; cursor: not-allowed; }
.btn-cancel { background: #fee2e2; color: #b91c1c; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px; }
.btn-cancel:hover { background: #fecaca; }
.btn-gray { background: #64748b; color: white; border: none; height: 40px; padding: 0 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-gray:hover { background: #475569; }
.btn-icon { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
.btn-icon:hover { background: #e2e8f0; }
.btn-del:hover { background: #fee2e2; border-color: #fecaca; }

/* Messages d'erreur dans le formulaire */
.validation-errors {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 12px 15px;
  color: #991b1b;
  font-size: 0.9rem;
}

.validation-errors ul {
  margin: 8px 0 0 20px;
  padding: 0;
}

.validation-errors li {
  margin-bottom: 4px;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 12px 15px;
  color: #991b1b;
  font-size: 0.9rem;
}

/* Badges */
.search-badge {
  background: #3b82f6;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.search-active {
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  padding: 10px 15px;
  color: #1d4ed8;
  font-size: 0.85rem;
}

.fuel-badge { 
  display: inline-block; 
  background: #f1f5f9; 
  padding: 2px 8px; 
  border-radius: 4px; 
  color: #475569; 
  font-weight: 700; 
  font-size: 0.75rem; 
  margin-top: 4px; 
}

/* Table */
.table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 0 0 12px 12px; }
.tank-table { width: 100%; min-width: 800px; border-collapse: collapse; background: white; }
.tank-table th { text-align: left; padding: 12px; background: #f1f5f9; font-size: 11px; color: #475569; text-transform: uppercase; }
.tank-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.stock-text { color: #059669; font-weight: 800; }
.total-price { font-weight: 800; color: #1e293b; }
.text-right { text-align: right; }
.text-center { text-align: center; }

.station-banner { 
  background: #1e293b; 
  color: white; 
  padding: 12px 20px; 
  display: flex; 
  flex-direction: column; 
  gap: 10px; 
  border-radius: 12px 12px 0 0;
}

/* État vide */
.empty-search, .empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-search .empty-icon,
.empty-state .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.empty-search .empty-text,
.empty-state .empty-text {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 8px;
}

.empty-search .empty-subtext {
  color: #94a3b8;
  font-size: 0.9rem;
}

/* PAGINATION */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 12px 12px;
  flex-wrap: wrap;
  gap: 15px;
}

.pagination-info {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-btn {
  padding: 8px 15px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #475569;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.pagination-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 5px;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #475569;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.page-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.page-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.page-btn:disabled {
  background: transparent;
  border: none;
  cursor: default;
}

.pagination-size {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #64748b;
}

.page-size-select {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: white;
  color: #475569;
  font-size: 0.85rem;
  cursor: pointer;
}

.page-size-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Action buttons */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 5px;
}

.locked { 
  filter: grayscale(1); 
  opacity: 0.4; 
  font-size: 1.2rem; 
  cursor: not-allowed;
}

/* ============ MODALES (POPUPS) ============ */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Modal pour la suppression */
.delete-modal {
  border-top: 5px solid #ef4444;
}

/* Modal pour le succès */
.success-modal {
  border-top: 5px solid #10b981;
}

/* Modal pour les erreurs */
.error-modal {
  border-top: 5px solid #ef4444;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.modal-close:hover {
  background: #f1f5f9;
  color: #475569;
}

.modal-body {
  padding: 20px;
  text-align: center;
}

.modal-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  animation: bounce 0.5s ease;
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.modal-icon.warning {
  color: #f59e0b;
}

.modal-icon.success {
  color: #10b981;
}

.modal-icon.error {
  color: #ef4444;
}

.modal-message {
  font-size: 1.1rem;
  color: #334155;
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-details {
  background: #f8fafc;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  text-align: left;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.detail-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.detail-label {
  font-weight: 600;
  color: #475569;
}

.detail-value {
  color: #1e293b;
  font-weight: 500;
}

.modal-summary {
  background: #ecfdf5;
  border-radius: 8px;
  padding: 15px;
  margin-top: 20px;
  text-align: left;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.summary-label {
  font-weight: 600;
  color: #065f46;
}

.summary-value {
  color: #047857;
  font-weight: 500;
}

.error-details {
  background: #fef2f2;
  border-radius: 6px;
  padding: 10px;
  margin-top: 15px;
  font-family: monospace;
  font-size: 0.85rem;
  color: #991b1b;
  text-align: left;
  max-height: 200px;
  overflow-y: auto;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-delete {
  background: #ef4444;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-delete:hover:not(:disabled) {
  background: #dc2626;
}

.btn-delete:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.btn-ok {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 25px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-ok:hover {
  background: #2563eb;
}

/* Responsive */
@media (min-width: 768px) {
  .container { padding: 30px; }
  .row { flex-direction: row; align-items: flex-end; }
  .row-spaced { display: flex; gap: 25px; align-items: flex-end; flex-wrap: wrap; }
  .flex-2 { flex: 2; min-width: 200px; }
  .flex-1 { flex: 1; min-width: 140px; }
  .btn-primary, .btn-orange { width: auto; padding: 12px 25px; }
  .total-inline { padding: 0 20px; }
  .total-label { display: none; }
  .station-banner { flex-direction: row; justify-content: space-between; align-items: center; }
  .mt-30 { margin-top: 30px; }
  .search-form .row { flex-direction: row; }
  
  .modal-content {
    width: 80%;
  }
}

@media (max-width: 480px) {
  .modal-footer {
    flex-direction: column;
  }
  
  .modal-footer button {
    width: 100%;
  }
}
</style>
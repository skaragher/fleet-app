<template>
  <div class="container">
    <h2 class="main-title">Approvisionnements (Entrées Cuves)</h2>

    <div class="grid-layout">
      <!-- FORMULAIRE -->
      <div class="card" :class="isEditing ? 'card-orange' : 'card-green'">
        <div class="card-header">
          {{ isEditing ? '📝 Modification' : '⛽ Nouvelle Livraison' }}
          <button v-if="isEditing" @click="cancelEdit" class="btn-cancel">Annuler</button>
        </div>
        <div class="card-body">
          <div class="compact-form">
            <div class="row row-spaced">
              <div class="field flex-2">
                <label>Station *</label>
                <select v-model="form.stationId" @change="handleStationChange" class="custom-input">
                  <option value="">Choisir station</option>
                  <option v-for="s in stations" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
              <div class="field flex-2">
                <label>Cuve *</label>
                <select v-model="form.tankId" :disabled="!form.stationId" class="custom-input">
                  <option value="">Choisir cuve</option>
                  <option v-for="t in tanksForStation" :key="t.id" :value="t.id">
                    {{ t.fuelType }} ({{ t.currentL }}L / {{ t.capacityL }}L)
                  </option>
                </select>
              </div>
              <div class="field flex-2">
                <label>Fournisseur</label>
                <input v-model="form.supplier" class="custom-input" placeholder="ex: TOTAL, SHELL..." />
              </div>
            </div>

            <div class="row row-spaced mt-20">
              <div class="field flex-1">
                <label>Référence BL</label>
                <input v-model="form.deliveryRef" class="custom-input" placeholder="N° Bon de livraison" />
              </div>
              <div class="field flex-1">
                <label>Volume (L) *</label>
                <input 
                  type="number" 
                  v-model.number="form.deliveredL" 
                  class="custom-input" 
                  placeholder="0" 
                  min="1"
                />
              </div>
              <div class="field flex-1">
                <label>Prix (FCFA)</label>
                <input 
                  type="number" 
                  v-model.number="form.unitPrice" 
                  class="custom-input" 
                  placeholder="0" 
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div class="total-inline">
                <span>{{ (form.deliveredL * (form.unitPrice || 0)).toLocaleString() }}</span> 
                <small>FCFA</small>
              </div>

              <div class="field-btn">
                <button 
                  :class="isEditing ? 'btn-orange' : 'btn-green'" 
                  @click="handleSubmit" 
                  :disabled="submitting || !formValid"
                >
                  {{ submitting ? '⏳ Traitement...' : (isEditing ? 'Mettre à jour' : 'Enregistrer') }}
                </button>
              </div>
            </div>

            <!-- Messages d'erreur -->
            <div v-if="validationErrors.length > 0" class="validation-errors mt-20">
              <strong>❌ Erreurs de validation :</strong>
              <ul>
                <li v-for="(err, index) in validationErrors" :key="index">{{ err }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- HISTORIQUE -->
      <div class="station-block shadow-sm mt-25">
        <div class="station-banner">
          <span>Historique des livraisons ({{ filteredItems.length }})</span>
          <div v-if="searchActive" class="search-badge">
            🔍 Recherche active
          </div>
        </div>
        
        <!-- FILTRES DE RECHERCHE -->
        <div class="card card-blue mb-20">
          <div class="card-header">
            🔍 Recherche et Filtres
          </div>
          <div class="card-body">
            <div class="search-form">
              <div class="row row-spaced">
                <div class="field flex-2">
                  <label>Station</label>
                  <select v-model="searchFilters.stationId" class="custom-input" @change="handleSearch">
                    <option value="">Toutes les stations</option>
                    <option v-for="station in stations" :key="station.id" :value="station.id">
                      {{ station.name }}
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
                  <label>Fournisseur</label>
                  <input 
                    type="text" 
                    v-model="searchFilters.supplier" 
                    class="custom-input"
                    placeholder="Rechercher par fournisseur..."
                    @input="debounceSearch"
                  />
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
                  <span v-if="searchFilters.stationId">Station {{ getStationName(searchFilters.stationId) }} | </span>
                  <span v-if="searchFilters.date">Date: {{ formatDisplayDate(searchFilters.date) }} | </span>
                  <span v-if="searchFilters.supplier">Fournisseur: "{{ searchFilters.supplier }}"</span>
                </small>
              </div>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="tank-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Station / Cuve</th>
                <th>Fournisseur / Réf</th>
                <th>Volume</th>
                <th>Coût</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedItems" :key="item.id">
                <td>{{ formatDate(item.deliveredAt) }}</td>
                <td>
                  <strong>{{ item.station?.name || 'N/A' }}</strong><br/>
                  <small class="fuel-badge">{{ item.tank?.fuelType || 'N/A' }}</small>
                </td>
                <td>
                  <strong>{{ item.supplier || '-' }}</strong><br/>
                  <small>BL: {{ item.deliveryRef || '-' }}</small>
                </td>
                <td class="stock-text">+ {{ item.deliveredL?.toLocaleString() || 0 }} L</td>
                <td class="text-right total-price">
                  {{ ((item.deliveredL || 0) * (item.unitPrice || 0)).toLocaleString() }} FCFA
                </td>
                <td class="text-center">
                  <div v-if="canModify(item.deliveredAt)" class="action-buttons">
                    <button 
                      @click="editItem(item)" 
                      class="btn-icon"
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button 
                      @click="confirmDeleteItem(item)" 
                      class="btn-icon btn-del"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
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
                    <div class="empty-text">Aucune livraison enregistrée</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- PAGINATION -->
          <div v-if="filteredItems.length > 0" class="pagination-container">
            <div class="pagination-info">
              Affichage {{ startIndex + 1 }}-{{ endIndex }} sur {{ filteredItems.length }}
            </div>
            <div class="pagination-controls">
              <button 
                @click="previousPage" 
                :disabled="currentPage === 1"
                class="pagination-btn"
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
                >
                  {{ page }}
                </button>
              </div>
              
              <button 
                @click="nextPage" 
                :disabled="currentPage === totalPages"
                class="pagination-btn"
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
            Êtes-vous sûr de vouloir supprimer cette livraison ?
          </p>
          <div class="modal-details" v-if="itemToDelete">
            <div class="detail-item">
              <span class="detail-label">Station :</span>
              <span class="detail-value">{{ itemToDelete.station?.name || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Cuve :</span>
              <span class="detail-value">{{ itemToDelete.tank?.fuelType || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Date :</span>
              <span class="detail-value">{{ formatDate(itemToDelete.deliveredAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Volume :</span>
              <span class="detail-value">+ {{ itemToDelete.deliveredL?.toLocaleString() || 0 }} L</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Coût :</span>
              <span class="detail-value">{{ ((itemToDelete.deliveredL || 0) * (itemToDelete.unitPrice || 0)).toLocaleString() }} FCFA</span>
            </div>
            <div v-if="itemToDelete.supplier" class="detail-item">
              <span class="detail-label">Fournisseur :</span>
              <span class="detail-value">{{ itemToDelete.supplier }}</span>
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

// Données
const stations = ref([]);
const items = ref([]);
const submitting = ref(false);
const deleting = ref(false);
const isEditing = ref(false);
const editingId = ref(null);

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

// Filtres de recherche
const searchFilters = ref({
  stationId: "",
  date: "",
  supplier: "",
});

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Formulaire
const form = ref({
  stationId: "",
  tankId: "",
  supplier: "",
  deliveredL: 0,
  unitPrice: 0,
  deliveryRef: "",
  notes: ""
});

// Computed
const tanksForStation = computed(() => {
  if (!form.value.stationId) return [];
  const station = stations.value.find(s => s.id === form.value.stationId);
  return station?.tanks || [];
});

const formValid = computed(() => {
  return form.value.stationId && form.value.tankId && form.value.deliveredL > 0;
});

const searchActive = computed(() => {
  return Object.values(searchFilters.value).some(val => val !== "");
});

const filteredItems = computed(() => {
  if (!searchActive.value) {
    return items.value;
  }
  
  return items.value.filter(item => {
    // Filtre par station
    if (searchFilters.value.stationId && item.stationId !== searchFilters.value.stationId) {
      return false;
    }
    
    // Filtre par date
    if (searchFilters.value.date) {
      const itemDate = new Date(item.deliveredAt).toISOString().split('T')[0];
      const searchDate = new Date(searchFilters.value.date).toISOString().split('T')[0];
      if (itemDate !== searchDate) {
        return false;
      }
    }
    
    // Filtre par fournisseur (recherche partielle, insensible à la casse)
    if (searchFilters.value.supplier) {
      const supplier = item.supplier || '';
      const searchTerm = searchFilters.value.supplier.toLowerCase();
      if (!supplier.toLowerCase().includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  });
});

// Pagination computed properties
const totalPages = computed(() => {
  return Math.ceil(filteredItems.value.length / itemsPerPage.value);
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
    return new Date(dateString).toLocaleDateString('fr-FR', {
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

const canModify = (dateIso) => {
  if (!dateIso) return false;
  try {
    const deliveryDate = new Date(dateIso);
    const now = new Date();
    const diffMinutes = (now - deliveryDate) / (1000 * 60);
    return diffMinutes < 30;
  } catch {
    return false;
  }
};

const getStationName = (stationId) => {
  const station = stations.value.find(s => s.id === stationId);
  return station ? station.name : stationId;
};

const getTankFuelType = (tankId) => {
  for (const station of stations.value) {
    const tank = station.tanks?.find(t => t.id === tankId);
    if (tank) return tank.fuelType;
  }
  return 'N/A';
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

// Watcher pour réinitialiser la pagination lors de la recherche
watch(searchFilters, () => {
  resetToFirstPage();
}, { deep: true });

let searchTimeout = null;
const debounceSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    resetToFirstPage();
  }, 500);
};

// Gestion de la recherche
function handleSearch() {
  resetToFirstPage();
}

function resetFilters() {
  searchFilters.value = {
    stationId: "",
    date: "",
    supplier: "",
  };
  resetToFirstPage();
}

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
}

// Gestion du formulaire
function handleStationChange() {
  form.value.tankId = "";
  if (tanksForStation.value.length > 0) {
    form.value.tankId = tanksForStation.value[0].id;
  }
}

function editItem(item) {
  isEditing.value = true;
  editingId.value = item.id;
  
  form.value = { 
    stationId: item.stationId || "",
    tankId: item.tankId || "",
    supplier: item.supplier || "",
    deliveredL: item.deliveredL || 0,
    unitPrice: item.unitPrice || 0,
    deliveryRef: item.deliveryRef || "",
    notes: item.notes || ""
  };
  
  window.scrollTo(0, 0);
  clearMessages();
}

function cancelEdit() {
  isEditing.value = false;
  editingId.value = null;
  form.value = {
    stationId: "",
    tankId: "",
    supplier: "",
    deliveredL: 0,
    unitPrice: 0,
    deliveryRef: "",
    notes: ""
  };
  clearMessages();
}

async function handleSubmit() {
  clearMessages();
  
  // Validation frontend
  validationErrors.value = [];
  
  if (!form.value.stationId) {
    validationErrors.value.push("Station requise");
  }
  
  if (!form.value.tankId) {
    validationErrors.value.push("Cuve requise");
  }
  
  if (!form.value.deliveredL || form.value.deliveredL <= 0) {
    validationErrors.value.push("Volume doit être supérieur à 0");
  }
  
  if (validationErrors.value.length > 0) {
    return;
  }

  submitting.value = true;
  
  try {
    // Préparer le payload
    const payload = {
      stationId: String(form.value.stationId),
      tankId: String(form.value.tankId),
      supplier: form.value.supplier?.trim() || null,
      deliveredL: Number(form.value.deliveredL),
      unitPrice: form.value.unitPrice ? Number(form.value.unitPrice) : null,
      deliveryRef: form.value.deliveryRef?.trim() || null,
      notes: form.value.notes?.trim() || null
    };

    const montantTotal = (form.value.deliveredL * (form.value.unitPrice || 0)).toLocaleString();
    const station = stations.value.find(s => s.id === form.value.stationId);
    const tankFuelType = getTankFuelType(form.value.tankId);
    
    let response;
    if (isEditing.value && editingId.value) {
      // Mode édition
      response = await api.put(`/fuel/supplies/${editingId.value}`, payload);
      
      // Message de succès pour l'édition
      showSuccessPopup(
        "Livraison modifiée avec succès !",
        { label: "Station", value: station?.name || 'N/A' },
        [
          { label: "Cuve", value: tankFuelType },
          { label: "Volume", value: `${form.value.deliveredL?.toLocaleString() || 0} L` },
          { label: "Coût total", value: `${montantTotal} FCFA` },
          { label: "Fournisseur", value: form.value.supplier || '-' }
        ]
      );
      
      cancelEdit();
    } else {
      // Mode création - ajouter deliveredAt
      const creationPayload = {
        ...payload,
        deliveredAt: new Date().toISOString()
      };
      response = await api.post("/fuel/supplies", creationPayload);
      
      // Message de succès pour la création
      showSuccessPopup(
        "Livraison enregistrée avec succès !",
        { label: "Station", value: station?.name || 'N/A' },
        [
          { label: "Cuve", value: tankFuelType },
          { label: "Volume", value: `${form.value.deliveredL?.toLocaleString() || 0} L` },
          { label: "Coût total", value: `${montantTotal} FCFA` },
          { label: "Fournisseur", value: form.value.supplier || '-' },
          { label: "Date", value: new Date().toLocaleString('fr-FR') }
        ]
      );
      
      form.value = {
        stationId: "",
        tankId: "",
        supplier: "",
        deliveredL: 0,
        unitPrice: 0,
        deliveryRef: "",
        notes: ""
      };
    }
    
    console.log("Réponse API:", response);
    await loadData();
    resetToFirstPage();
    
  } catch (err) {
    console.error("Erreur complète:", err);
    
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;
      
      console.error("Status:", status);
      console.error("Data:", data);
      
      if (status === 400) {
        // Erreur de validation
        if (data.errors && Array.isArray(data.errors)) {
          validationErrors.value = data.errors.map(e => e.message || e);
        } else {
          showErrorPopup("Erreur de validation", data.message || "Données invalides");
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
    } else if (err.request) {
      showErrorPopup("Erreur de connexion", "Pas de réponse du serveur. Vérifiez votre connexion internet.");
    } else {
      showErrorPopup("Erreur", "Erreur lors de l'envoi: " + err.message);
    }
    
  } finally {
    submitting.value = false;
  }
}

// Suppression d'un élément
async function executeDelete() {
  if (!itemToDelete.value) return;
  
  deleting.value = true;
  
  try {
    await api.delete(`/fuel/supplies/${itemToDelete.value.id}`);
    
    // Message de succès pour la suppression
    showSuccessPopup(
      "Livraison supprimée avec succès !",
      { label: "Station", value: itemToDelete.value.station?.name || 'N/A' },
      [
        { label: "Cuve", value: itemToDelete.value.tank?.fuelType || 'N/A' },
        { label: "Volume", value: `+ ${itemToDelete.value.deliveredL?.toLocaleString() || 0} L` },
        { label: "Coût total", value: `${((itemToDelete.value.deliveredL || 0) * (itemToDelete.value.unitPrice || 0)).toLocaleString()} FCFA` },
        { label: "Date", value: formatDate(itemToDelete.value.deliveredAt) },
        { label: "Fournisseur", value: itemToDelete.value.supplier || '-' }
      ]
    );
    
    await loadData();
    resetToFirstPage();
    closeDeleteModal();
    
  } catch (err) {
    console.error("Erreur suppression:", err);
    
    if (err.response?.status === 403) {
      showErrorPopup("Action non autorisée", "Délai de suppression dépassé (30 minutes)");
    } else if (err.response?.status === 404) {
      showErrorPopup("Ressource non trouvée", "La livraison que vous essayez de supprimer n'existe plus");
    } else {
      showErrorPopup("Erreur lors de la suppression", err.message);
    }
    
    closeDeleteModal();
  }
  finally {
    deleting.value = false;
  }
}

// Chargement des données
async function loadData() {
  try {
    console.log("Chargement des données...");
    
    const [stationsRes, suppliesRes] = await Promise.all([
      api.get("/stations"),
      api.get("/fuel/supplies")
    ]);
    
    stations.value = stationsRes.data || [];
    
    // Gérer les différents formats de réponse API
    console.log("📦 Réponse approvisionnements:", suppliesRes);
    
    if (Array.isArray(suppliesRes.data)) {
      // Format 1: Tableau direct
      items.value = suppliesRes.data;
    } else if (suppliesRes.data && suppliesRes.data.success && suppliesRes.data.data && Array.isArray(suppliesRes.data.data.items)) {
      // Format 2: Structuré avec {success, data: {items}}
      items.value = suppliesRes.data.data.items;
    } else if (suppliesRes.data && suppliesRes.data.data && Array.isArray(suppliesRes.data.data)) {
      // Format 3: {data: [...]}
      items.value = suppliesRes.data.data;
    } else {
      items.value = [];
    }
    
    // Trier par date (plus récent d'abord)
    items.value.sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt));
    
    console.log(`✅ ${items.value.length} approvisionnements chargés`);
    console.log(`✅ ${stations.value.length} stations chargées`);
    
  } catch (err) {
    console.error("Erreur chargement:", err);
    showErrorPopup("Impossible de charger les données", err.message);
  }
}

// Initialisation
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.container { padding: 20px; font-family: 'Segoe UI', sans-serif; max-width: 1250px; margin: 0 auto; position: relative; }
.main-title { font-size: 1.4rem; margin-bottom: 25px; color: #1e293b; font-weight: 700; }

/* Carte de recherche */
.card-blue { border-top: 5px solid #3b82f6; }
.mb-20 { margin-bottom: 20px; }

.search-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.search-active {
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  padding: 10px 15px;
  color: #1d4ed8;
  font-size: 0.85rem;
}

.search-badge {
  background: #3b82f6;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

/* État vide de recherche */
.empty-search {
  padding: 30px 20px;
  text-align: center;
}

.empty-search .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.empty-search .empty-text {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 8px;
}

.empty-search .empty-subtext {
  color: #94a3b8;
  font-size: 0.9rem;
}

.empty-state {
  padding: 40px 20px !important;
  text-align: center;
}

.empty-state .empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.empty-state .empty-text {
  font-size: 1.1rem;
  color: #64748b;
}

/* PAGINATION */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 10px 10px;
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

/* Messages d'erreur */
.validation-errors {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 12px 15px;
  margin-top: 15px;
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

/* Styles de base */
.card { background: white; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.card-green { border-top: 5px solid #10b981; }
.card-orange { border-top: 5px solid #f59e0b; background: #fffcf5; }
.card-header { padding: 15px 20px; font-weight: bold; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.card-body { padding: 20px; }

/* Flexbox Layout avec espacement (GAP) */
.compact-form { display: flex; flex-direction: column; }
.row-spaced { display: flex; gap: 25px; align-items: flex-end; flex-wrap: wrap; }
.mt-10 { margin-top: 10px; }
.mt-20 { margin-top: 20px; }
.mt-25 { margin-top: 25px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.flex-1 { flex: 1; min-width: 140px; }
.flex-2 { flex: 2; min-width: 200px; }

.field label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.custom-input { height: 40px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 12px; font-size: 0.95rem; width: 100%; transition: all 0.2s; }
.custom-input:focus { border-color: #10b981; outline: none; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }

.total-inline { background: #064e3b; color: #ecfdf5; padding: 0 20px; height: 40px; line-height: 40px; border-radius: 6px; font-weight: 800; min-width: 160px; text-align: center; }
.total-inline span { color: #34d399; font-size: 1.2rem; }

.btn-green { background: #10b981; color: white; border: none; height: 40px; padding: 0 25px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
.btn-green:hover { background: #059669; }
.btn-green:disabled { background: #cbd5e1; cursor: not-allowed; }

.btn-orange { background: #f59e0b; color: white; border: none; height: 40px; padding: 0 25px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-orange:disabled { background: #cbd5e1; cursor: not-allowed; }

.btn-gray { background: #64748b; color: white; border: none; height: 40px; padding: 0 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-gray:hover { background: #475569; }

.btn-cancel { background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; }
.btn-cancel:hover { background: #dc2626; }

/* Table Section */
.station-banner { display: flex; justify-content: space-between; background: #334155; color: white; padding: 12px 20px; border-radius: 10px 10px 0 0; align-items: center; }

.tank-table { width: 100%; border-collapse: collapse; background: white; font-size: 0.9rem; }
.tank-table th { background: #f8fafc; padding: 15px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; }
.tank-table td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; }

.fuel-badge { display: inline-block; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; color: #475569; font-weight: 700; font-size: 0.75rem; margin-top: 4px; }
.stock-text { color: #059669; font-weight: 800; }
.total-price { font-weight: 800; color: #1e293b; }
.text-right { text-align: right; }
.text-center { text-align: center; }

.action-buttons { display: flex; justify-content: center; gap: 5px; }
.btn-icon { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
.btn-icon:hover { background: #e2e8f0; }
.btn-del:hover { background: #fee2e2; border-color: #fecaca; }
.locked { filter: grayscale(1); opacity: 0.4; font-size: 1.2rem; cursor: not-allowed; }

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
  .row-spaced { display: flex; gap: 25px; align-items: flex-end; flex-wrap: wrap; }
  .btn-green, .btn-orange { width: auto; padding: 12px 25px; }
  .total-inline { padding: 0 20px; }
  .station-banner { flex-direction: row; justify-content: space-between; align-items: center; }
  
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
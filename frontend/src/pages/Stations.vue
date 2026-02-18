<template>
  <div class="container" v-if="stations">
    <h2 class="main-title">Gestion des Stations & Cuves</h2>

    <div class="grid-forms">
      <!-- FORMULAIRE STATION (Création ou Modification) -->
      <div class="card">
        <div class="card-header">
          {{ isEditingStation ? 'Modifier la Station' : 'Nouvelle Station' }}
        </div>
        <div class="card-body">
          <div class="form-row">
            <div class="field">
              <label>Nom</label>
              <input v-model="stationForm.name" placeholder="Nom..." class="custom-input" />
            </div>
            <div class="field">
              <label>Ville</label>
              <input v-model="stationForm.location" placeholder="Ville..." class="custom-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Adresse</label>
              <input v-model="stationForm.address" placeholder="Adresse..." class="custom-input" />
            </div>
            <div class="field">
              <label>Téléphone</label>
              <input v-model="stationForm.phone" placeholder="Téléphone..." class="custom-input" />
            </div>
          </div>
          <div class="btn-group">
            <button class="btn-primary" @click="saveStation">
              {{ isEditingStation ? 'Mettre à jour' : 'Enregistrer Station' }}
            </button>
            <button v-if="isEditingStation" class="btn-cancel-flat" @click="resetStationForm">Annuler</button>
          </div>
          
          <!-- Messages d'erreur station -->
          <div v-if="stationErrors.length > 0" class="validation-errors mt-20">
            <strong>❌ Erreurs de validation :</strong>
            <ul>
              <li v-for="(err, index) in stationErrors" :key="index">{{ err }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- FORMULAIRE CUVE -->
      <div class="card">
        <div class="card-header">Ajouter une Cuve</div>
        <div class="card-body">
          <div class="form-row">
            <div class="field">
              <label>Station</label>
              <select v-model="tankForm.stationId" class="custom-input">
                <option value="" disabled>Choisir une station</option>
                <option v-for="s in stations" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>Nom Cuve</label>
              <input v-model="tankForm.name" placeholder="Ex: A1" class="custom-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Carburant</label>
              <select v-model="tankForm.fuelType" class="custom-input">
                <option value="DIESEL">DIESEL</option>
                <option value="SUPER">SUPER</option>
                <option value="LUBRIFIANT">LUBRIFIANT</option>
                <option value="HUILE">HUILE</option>
              </select>
            </div>
            <div class="field">
              <label>Capacité (L)</label>
              <input type="number" v-model.number="tankForm.capacityL" class="custom-input" />
            </div>
            <div class="field">
              <label>Stock Alerte (L)</label>
              <input type="number" v-model.number="tankForm.lowAlertL" class="custom-input" />
            </div>
          </div>
          <button class="btn-primary btn-blue" @click="createTank">Ajouter la Cuve</button>
          
          <!-- Messages d'erreur cuve -->
          <div v-if="tankErrors.length > 0" class="validation-errors mt-20">
            <strong>❌ Erreurs de validation :</strong>
            <ul>
              <li v-for="(err, index) in tankErrors" :key="index">{{ err }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- LISTE DES STATIONS -->
    <div v-for="s in stations" :key="s.id" class="station-block">
      <div class="station-banner">
        <div class="station-info">
          <span class="st-name">{{ s.name }}</span>
          <span class="st-loc"> ( {{ s.location }} )</span>
          <!-- Bouton Modifier Station -->
          <button class="btn-edit-inline" @click="editStation(s)" title="Modifier station">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </div>
        <button class="btn-delete-text" @click="confirmDeleteStation(s)">Supprimer Station</button>
      </div>

      <!-- TABLEAU DES CUVES -->
      <div class="table-responsive">
        <table class="tank-table" v-if="s.tanks && s.tanks.length">
          <thead>
            <tr>
              <th>Nom</th><th>Type</th><th>Capacité</th><th>Stock</th><th>Statut</th><th class="text-right-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in s.tanks" :key="t.id">
              <template v-if="editingId === t.id">
                <td><input v-model="editForm.name" class="input-table" /></td>
                <td>
                  <select v-model="editForm.fuelType" class="input-table">
                    <option value="DIESEL">DIESEL</option>
                    <option value="SUPER">SUPER</option>
                    <option value="LUBRIFIANT">LUBRIFIANT</option>
                    <option value="HUILE">HUILE</option>
                  </select>
                </td>
                <td><input type="number" v-model.number="editForm.capacityL" class="input-table" /></td>
                <td><input :value="t.currentL" readonly class="input-table readonly" /></td>
                <td>---</td>
                <td class="text-right">
                  <div class="actions-wrapper">
                    <button @click="saveEdit(t.id)" class="btn-save">✔</button>
                    <button @click="cancelEdit" class="btn-cancel">✖</button>
                  </div>
                </td>
              </template>
              <template v-else>
                <td>{{ t.name }}</td>
                <td><span class="fuel-badge">{{ t.fuelType }}</span></td>
                <td>{{ t.capacityL }} L</td>
                <td class="stock-text">{{ t.currentL }} L</td>
                <td>
                  <span :class="['status-badge', t.currentL <= t.lowAlertL ? 'low' : 'ok']">
                    {{ t.currentL <= t.lowAlertL ? 'ALERTE' : 'OK' }}
                  </span>
                </td>
                <td class="text-right">
                  <div class="actions-wrapper">
                    <button class="btn-edit" @click="startEdit(t, s.id)">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-del" @click="confirmDeleteTank(t, s)">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
        <div v-else class="no-data-mini">Aucune cuve.</div>
      </div>
    </div>

    <!-- POPUP DE CONFIRMATION DE SUPPRESSION STATION -->
    <div v-if="showDeleteStationModal" class="modal-overlay" @click.self="closeDeleteStationModal">
      <div class="modal-content delete-modal">
        <div class="modal-header">
          <h3 class="modal-title">🗑️ Confirmer la suppression</h3>
          <button class="modal-close" @click="closeDeleteStationModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon warning">
            ⚠️
          </div>
          <p class="modal-message">
            Êtes-vous sûr de vouloir supprimer cette station ?
          </p>
          <div class="modal-details" v-if="stationToDelete">
            <div class="detail-item">
              <span class="detail-label">Station :</span>
              <span class="detail-value">{{ stationToDelete.name }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Localisation :</span>
              <span class="detail-value">{{ stationToDelete.location }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Nombre de cuves :</span>
              <span class="detail-value">{{ stationToDelete.tanks?.length || 0 }} cuve(s)</span>
            </div>
            <div v-if="stationToDelete.address" class="detail-item">
              <span class="detail-label">Adresse :</span>
              <span class="detail-value">{{ stationToDelete.address }}</span>
            </div>
            <div v-if="stationToDelete.phone" class="detail-item">
              <span class="detail-label">Téléphone :</span>
              <span class="detail-value">{{ stationToDelete.phone }}</span>
            </div>
          </div>
          <div class="modal-warning" v-if="stationToDelete?.tanks?.length > 0">
            <p><strong>⚠️ Attention :</strong> Cette station contient {{ stationToDelete.tanks.length }} cuve(s). Toutes les cuves seront également supprimées !</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeDeleteStationModal">Annuler</button>
          <button class="btn-delete" @click="executeDeleteStation" :disabled="deleting">
            {{ deleting ? 'Suppression en cours...' : 'Confirmer la suppression' }}
          </button>
        </div>
      </div>
    </div>

    <!-- POPUP DE CONFIRMATION DE SUPPRESSION CUVE -->
    <div v-if="showDeleteTankModal" class="modal-overlay" @click.self="closeDeleteTankModal">
      <div class="modal-content delete-modal">
        <div class="modal-header">
          <h3 class="modal-title">🗑️ Confirmer la suppression</h3>
          <button class="modal-close" @click="closeDeleteTankModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon warning">
            ⚠️
          </div>
          <p class="modal-message">
            Êtes-vous sûr de vouloir supprimer cette cuve ?
          </p>
          <div class="modal-details" v-if="tankToDelete">
            <div class="detail-item">
              <span class="detail-label">Nom :</span>
              <span class="detail-value">{{ tankToDelete.name }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Type :</span>
              <span class="detail-value">{{ tankToDelete.fuelType }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Station :</span>
              <span class="detail-value">{{ tankStation?.name || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Capacité :</span>
              <span class="detail-value">{{ tankToDelete.capacityL }} L</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Stock actuel :</span>
              <span class="detail-value">{{ tankToDelete.currentL }} L</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Statut :</span>
              <span :class="['status-badge', tankToDelete.currentL <= tankToDelete.lowAlertL ? 'low' : 'ok']">
                {{ tankToDelete.currentL <= tankToDelete.lowAlertL ? 'ALERTE' : 'OK' }}
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeDeleteTankModal">Annuler</button>
          <button class="btn-delete" @click="executeDeleteTank" :disabled="deleting">
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
import { ref, onMounted } from "vue";
import api from "../services/api";

const stations = ref([]);
const editingId = ref(null);
const currentStationId = ref(null);
const isEditingStation = ref(false);
const stationIdToEdit = ref(null);

// États des modales
const showDeleteStationModal = ref(false);
const showDeleteTankModal = ref(false);
const showSuccessModal = ref(false);
const showErrorModal = ref(false);

// Données pour les modales
const stationToDelete = ref(null);
const tankToDelete = ref(null);
const tankStation = ref(null);
const successMessage = ref("");
const successDetails = ref(null);
const operationSummary = ref(null);
const errorMessage = ref("");
const errorDetails = ref("");
const deleting = ref(false);

// Messages d'erreur
const stationErrors = ref([]);
const tankErrors = ref([]);

const initStation = () => ({ name: "", location: "", address: "", phone: "" });
const initTank = () => ({ name: "", stationId: "", fuelType: "DIESEL", capacityL: 10000, lowAlertL: 500 });

const stationForm = ref(initStation());
const tankForm = ref(initTank());
const editForm = ref({ name: '', fuelType: '', capacityL: 0, lowAlertL: 0, currentL: 0 });

async function load() {
  try {
    const res = await api.get("/stations");
    stations.value = res.data || [];
  } catch (e) { 
    console.error(e);
    showErrorPopup("Impossible de charger les stations", e.message);
  }
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

function confirmDeleteStation(station) {
  stationToDelete.value = station;
  showDeleteStationModal.value = true;
}

function closeDeleteStationModal() {
  showDeleteStationModal.value = false;
  stationToDelete.value = null;
  deleting.value = false;
}

function confirmDeleteTank(tank, station) {
  tankToDelete.value = tank;
  tankStation.value = station;
  showDeleteTankModal.value = true;
}

function closeDeleteTankModal() {
  showDeleteTankModal.value = false;
  tankToDelete.value = null;
  tankStation.value = null;
  deleting.value = false;
}

// --- LOGIQUE STATION ---
function editStation(s) {
  isEditingStation.value = true;
  stationIdToEdit.value = s.id;
  stationForm.value = { 
    name: s.name, 
    location: s.location, 
    address: s.address || "", 
    phone: s.phone || "" 
  };
  stationErrors.value = [];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetStationForm() {
  isEditingStation.value = false;
  stationIdToEdit.value = null;
  stationForm.value = initStation();
  stationErrors.value = [];
}

async function saveStation() {
  stationErrors.value = [];
  
  // Validation
  if (!stationForm.value.name) {
    stationErrors.value.push("Le nom de la station est requis");
  }
  
  if (!stationForm.value.location) {
    stationErrors.value.push("La localisation (ville) est requise");
  }
  
  if (stationErrors.value.length > 0) {
    return;
  }
  
  try {
    if (isEditingStation.value) {
      await api.put(`/stations/${stationIdToEdit.value}`, stationForm.value);
      
      // Message de succès pour la modification
      showSuccessPopup(
        "Station modifiée avec succès !",
        { label: "Station", value: stationForm.value.name },
        [
          { label: "Localisation", value: stationForm.value.location },
          { label: "Adresse", value: stationForm.value.address || '-' },
          { label: "Téléphone", value: stationForm.value.phone || '-' }
        ]
      );
    } else {
      await api.post("/stations", stationForm.value);
      
      // Message de succès pour la création
      showSuccessPopup(
        "Station créée avec succès !",
        { label: "Station", value: stationForm.value.name },
        [
          { label: "Localisation", value: stationForm.value.location },
          { label: "Adresse", value: stationForm.value.address || '-' },
          { label: "Téléphone", value: stationForm.value.phone || '-' }
        ]
      );
    }
    
    resetStationForm();
    await load();
    
  } catch (e) { 
    console.error(e);
    if (e.response?.status === 400) {
      if (e.response.data?.errors) {
        stationErrors.value = e.response.data.errors.map(err => err.message || err);
      } else {
        showErrorPopup("Erreur de validation", e.response.data?.message || "Données invalides");
      }
    } else {
      showErrorPopup("Erreur lors de l'enregistrement", e.message);
    }
  }
}

async function executeDeleteStation() {
  if (!stationToDelete.value) return;
  
  deleting.value = true;
  
  try {
    await api.delete(`/stations/${stationToDelete.value.id}`);
    
    // Message de succès pour la suppression
    showSuccessPopup(
      "Station supprimée avec succès !",
      { label: "Station", value: stationToDelete.value.name },
      [
        { label: "Localisation", value: stationToDelete.value.location },
        { label: "Cuves supprimées", value: `${stationToDelete.value.tanks?.length || 0} cuve(s)` },
        { label: "Adresse", value: stationToDelete.value.address || '-' }
      ]
    );
    
    await load();
    closeDeleteStationModal();
    
  } catch (e) {
    console.error("Erreur suppression:", e);
    
    if (e.response?.status === 409) {
      showErrorPopup("Action impossible", "Impossible de supprimer cette station car elle contient des données associées (livraisons, ravitaillements)");
    } else if (e.response?.status === 404) {
      showErrorPopup("Station non trouvée", "La station que vous essayez de supprimer n'existe plus");
    } else {
      showErrorPopup("Erreur lors de la suppression", e.message);
    }
    
    closeDeleteStationModal();
  }
  finally {
    deleting.value = false;
  }
}

// --- LOGIQUE CUVE ---
async function createTank() {
  tankErrors.value = [];
  
  // Validation
  if (!tankForm.value.stationId) {
    tankErrors.value.push("La station est requise");
  }
  
  if (!tankForm.value.name) {
    tankErrors.value.push("Le nom de la cuve est requis");
  }
  
  if (!tankForm.value.capacityL || tankForm.value.capacityL <= 0) {
    tankErrors.value.push("La capacité doit être supérieure à 0");
  }
  
  if (!tankForm.value.lowAlertL || tankForm.value.lowAlertL < 0) {
    tankErrors.value.push("Le seuil d'alerte doit être positif");
  }
  
  if (tankErrors.value.length > 0) {
    return;
  }
  
  try {
    const station = stations.value.find(s => s.id === tankForm.value.stationId);
    
    await api.post(`/stations/${tankForm.value.stationId}/tanks`, tankForm.value);
    
    // Message de succès pour la création
    showSuccessPopup(
      "Cuve créée avec succès !",
      { label: "Station", value: station?.name || 'N/A' },
      [
        { label: "Nom", value: tankForm.value.name },
        { label: "Type", value: tankForm.value.fuelType },
        { label: "Capacité", value: `${tankForm.value.capacityL} L` },
        { label: "Stock alerte", value: `${tankForm.value.lowAlertL} L` }
      ]
    );
    
    tankForm.value = initTank();
    await load();
    
  } catch (e) { 
    console.error(e);
    if (e.response?.status === 400) {
      if (e.response.data?.errors) {
        tankErrors.value = e.response.data.errors.map(err => err.message || err);
      } else {
        showErrorPopup("Erreur de validation", e.response.data?.message || "Données invalides");
      }
    } else {
      showErrorPopup("Erreur lors de la création", e.message);
    }
  }
}

function startEdit(tank, stationId) {
  editingId.value = tank.id;
  currentStationId.value = stationId;
  editForm.value = { ...tank };
}

function cancelEdit() { 
  editingId.value = null; 
  editForm.value = { name: '', fuelType: '', capacityL: 0, lowAlertL: 0, currentL: 0 };
}

async function saveEdit(id) {
  try {
    const payload = {
      name: editForm.value.name,
      fuelType: editForm.value.fuelType,
      capacityL: Number(editForm.value.capacityL),
      lowAlertL: Number(editForm.value.lowAlertL),
      currentL: Number(editForm.value.currentL),
      stationId: currentStationId.value
    };
    
    // Validation
    if (!payload.name) {
      showErrorPopup("Erreur de validation", "Le nom de la cuve est requis");
      return;
    }
    
    if (!payload.capacityL || payload.capacityL <= 0) {
      showErrorPopup("Erreur de validation", "La capacité doit être supérieure à 0");
      return;
    }
    
    if (payload.currentL > payload.capacityL) {
      showErrorPopup("Erreur de validation", `Le stock actuel (${payload.currentL}L) ne peut pas dépasser la capacité (${payload.capacityL}L)`);
      return;
    }
    
    const station = stations.value.find(s => s.id === currentStationId.value);
    const tank = station?.tanks?.find(t => t.id === id);
    
    await api.put(`/stations/tanks/${id}`, payload);
    
    // Message de succès pour la modification
    showSuccessPopup(
      "Cuve modifiée avec succès !",
      { label: "Station", value: station?.name || 'N/A' },
      [
        { label: "Nom", value: payload.name },
        { label: "Type", value: payload.fuelType },
        { label: "Capacité", value: `${payload.capacityL} L` },
        { label: "Stock actuel", value: `${payload.currentL} L` },
        { label: "Stock alerte", value: `${payload.lowAlertL} L` },
        { label: "Statut", value: payload.currentL <= payload.lowAlertL ? 'ALERTE' : 'OK' }
      ]
    );
    
    editingId.value = null;
    await load();
    
  } catch (e) { 
    console.error(e);
    if (e.response?.status === 400) {
      showErrorPopup("Erreur de validation", e.response.data?.message || "Données invalides");
    } else {
      showErrorPopup("Erreur lors de la modification", e.message);
    }
  }
}

async function executeDeleteTank() {
  if (!tankToDelete.value) return;
  
  deleting.value = true;
  
  try {
    await api.delete(`/stations/tanks/${tankToDelete.value.id}`);
    
    // Message de succès pour la suppression
    showSuccessPopup(
      "Cuve supprimée avec succès !",
      { label: "Station", value: tankStation.value?.name || 'N/A' },
      [
        { label: "Nom", value: tankToDelete.value.name },
        { label: "Type", value: tankToDelete.value.fuelType },
        { label: "Capacité", value: `${tankToDelete.value.capacityL} L` },
        { label: "Stock restant", value: `${tankToDelete.value.currentL} L` }
      ]
    );
    
    await load();
    closeDeleteTankModal();
    
  } catch (e) {
    console.error("Erreur suppression:", e);
    
    if (e.response?.status === 409) {
      showErrorPopup("Action impossible", "Impossible de supprimer cette cuve car elle contient des données associées (livraisons, ravitaillements)");
    } else if (e.response?.status === 404) {
      showErrorPopup("Cuve non trouvée", "La cuve que vous essayez de supprimer n'existe plus");
    } else {
      showErrorPopup("Erreur lors de la suppression", e.message);
    }
    
    closeDeleteTankModal();
  }
  finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.container { padding: 20px; font-family: sans-serif; max-width: 1100px; margin: 0 auto; position: relative; }
.main-title { color: #004085; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
.grid-forms { display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; margin-bottom: 30px; }
.card { border: 1px solid #0056b3; border-radius: 8px; background: #fff; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.card-header { background: #004085; color: white; padding: 10px; font-weight: bold; }
.card-body { padding: 15px; }
.form-row { display: flex; gap: 10px; margin-bottom: 10px; }
.field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.8rem; font-weight: bold; color: #666; }
.custom-input { height: 34px; padding: 0 10px; border: 1px solid #ccc; border-radius: 5px; font-size: 0.9rem; }
.btn-primary { height: 36px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%; }
.btn-blue { background: #0056b3; }
.btn-cancel-flat { background: none; border: none; color: #666; cursor: pointer; text-decoration: underline; margin-top: 10px; width: 100%; font-size: 0.85rem; }

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

.mt-20 { margin-top: 20px; }

/* Station block */
.station-block { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
.station-banner { background: #f8f9fa; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; }
.st-name { font-weight: bold; color: #004085; }
.btn-edit-inline { background: none; border: none; color: #007bff; cursor: pointer; margin-left: 8px; padding: 2px; }
.btn-delete-text { color: #dc3545; background: none; border: none; cursor: pointer; text-decoration: underline; font-size: 0.8rem; }

/* Table */
.tank-table { width: 100%; border-collapse: collapse; }
.tank-table th { background: #f1f1f1; padding: 10px; text-align: left; font-size: 0.85rem; border-bottom: 1px solid #ddd; }
.tank-table td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 0.9rem; }
.actions-wrapper { display: flex; justify-content: flex-end; align-items: center; gap: 15px; }

.input-table { height: 30px; width: 100%; border: 1px solid #007bff; border-radius: 4px; padding: 0 5px; }
.readonly { background: #f9f9f9; color: #999; }
.btn-edit { color: #007bff; background: none; border: none; cursor: pointer; }
.btn-del { color: #dc3545; background: none; border: none; cursor: pointer; }
.btn-save { color: #28a745; background: none; border: none; font-size: 1.3rem; cursor: pointer; }
.btn-cancel { color: #666; background: none; border: none; font-size: 1.3rem; cursor: pointer; }

.status-badge { padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; display: inline-block; }
.status-badge.ok { background: #d4edda; color: #155724; }
.status-badge.low { background: #f8d7da; color: #721c24; }
.fuel-badge { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
.no-data-mini { text-align: center; padding: 20px; color: #666; font-style: italic; }
.text-right { text-align: right; }

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

.modal-warning {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
  text-align: left;
  color: #92400e;
  font-size: 0.9rem;
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

.btn-cancel, .btn-cancel-modal {
  background: #64748b;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-cancel:hover, .btn-cancel-modal:hover {
  background: #475569;
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
@media (max-width: 768px) {
  .grid-forms {
    grid-template-columns: 1fr;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .modal-footer button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .station-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .form-row {
    flex-direction: column;
  }
}
</style>
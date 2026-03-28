<template>
  <div class="fuel-reports">
    <!-- En-tête visible uniquement à l'impression -->
    <div class="print-header">
      <div class="print-header-top">
        <div class="print-logo-block">
          <img v-if="companyLogoUrl" :src="companyLogoUrl" class="print-logo" alt="Logo" />
        </div>
        <div class="print-company-block">
          <div class="print-company-name">{{ companyName }}</div>
        </div>
      </div>
      <div class="print-title-bar">{{ currentTabPrintTitle }}</div>
      <div class="print-period">Période : {{ fmtDate(startDate) }} au {{ fmtDate(endDate) }}</div>
    </div>

    <div class="page-header no-print">
      <h1>États Carburant</h1>
      <p class="page-subtitle">Rapports de gestion du carburant</p>
    </div>

    <!-- Filtres de période -->
    <div class="filters-bar no-print">
      <div class="filter-group">
        <label for="start-date">Du</label>
        <input
          id="start-date"
          type="date"
          v-model="startDate"
          :max="endDate"
          aria-label="Date de début"
        />
      </div>
      <div class="filter-group">
        <label for="end-date">Au</label>
        <input
          id="end-date"
          type="date"
          v-model="endDate"
          :min="startDate"
          :max="today"
          aria-label="Date de fin"
        />
      </div>
      <div class="filter-group" v-if="activeTab === 'comparison'">
        <label for="norm">Norme (L/100km)</label>
        <input
          id="norm"
          type="number"
          v-model.number="norm"
          min="1"
          max="50"
          step="0.5"
          aria-label="Norme de consommation"
        />
      </div>
      <button class="btn-primary" @click="loadReportWithRetry" :disabled="loading">
        <span v-if="loading" class="btn-spinner"></span>
        <span>{{ loading ? 'Chargement...' : 'Actualiser' }}</span>
      </button>
      <button class="btn-secondary" @click="exportCSV" :disabled="loading || !hasData">⬇ CSV</button>
      <button class="btn-secondary" @click="exportPDF" :disabled="loading || !hasData || pdfExporting">
        <span v-if="pdfExporting" class="btn-spinner"></span>
        <span>{{ pdfExporting ? 'Export...' : '⬇ PDF' }}</span>
      </button>
      <button class="btn-print" @click="printReport" :disabled="loading || !hasData">🖨 Imprimer</button>
      <button class="btn-secondary" @click="saveCurrentFilters" title="Sauvegarder les filtres">⭐ Sauvegarder</button>
      <select v-if="savedFilters.length" v-model="selectedFilterId" @change="loadSavedFilter" class="filter-select">
        <option value="">Filtres sauvegardés</option>
        <option v-for="filter in savedFilters" :key="filter.id" :value="filter.id">
          {{ filter.name }} ({{ filter.startDate }} - {{ filter.endDate }})
        </option>
      </select>
    </div>

    <!-- Tabs -->
    <div class="tabs no-print" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-label="`Onglet ${tab.label}`"
      >
        <span class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
        {{ tab.label }}
        <!-- Badge de chargement par onglet -->
        <span v-if="tabLoading[tab.id]" class="tab-spinner"></span>
      </button>
    </div>

    <!-- Erreur -->
    <div v-if="error" class="alert-error" role="alert">
      <strong>Erreur :</strong> {{ error }}
      <button @click="loadReportWithRetry()" class="retry-btn">Réessayer</button>
    </div>

    <!-- Loading global -->
    <div v-if="loading" class="loading-state" role="status" aria-live="polite">
      <div class="spinner"></div>
      <p>Chargement des données...</p>
    </div>

    <!-- ====================== TAB 1: APPROVISIONNEMENTS ====================== -->
    <div v-if="!loading && activeTab === 'supplies' && suppliesData" class="report-content">
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-label">Volume total reçu</span>
          <span class="summary-value">{{ fmt(suppliesData.summary.totalL) }} L</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Coût total</span>
          <span class="summary-value">{{ fmtCost(suppliesData.summary.totalCost) }}</span>
        </div>
        <div class="summary-card no-print">
          <span class="summary-label">Nb livraisons</span>
          <span class="summary-value">{{ suppliesData.summary.totalSupplies }}</span>
        </div>
        <div class="summary-card no-print">
          <span class="summary-label">Fournisseurs</span>
          <span class="summary-value">{{ suppliesData.bySupplier.length }}</span>
        </div>
      </div>

      <div class="section-title">Synthèse par fournisseur</div>
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Fournisseur</th>
              <th class="num">Volume (L)</th>
              <th class="num">Coût</th>
              <th class="num">Livraisons</th>
              <th class="num no-print">Part (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in suppliesData.bySupplier" :key="row.supplier">
              <td>{{ row.supplier }}</td>
              <td class="num">{{ fmt(row.totalL) }}</td>
              <td class="num">{{ fmtCost(row.totalCost) }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num no-print">
                <div class="bar-cell">
                  <div class="bar-fill" :style="{ width: pct(row.totalL, suppliesData.summary.totalL) + '%' }"></div>
                  <span>{{ pct(row.totalL, suppliesData.summary.totalL) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td class="num"><strong>{{ fmt(suppliesData.summary.totalL) }}</strong></td>
              <td class="num"><strong>{{ fmtCost(suppliesData.summary.totalCost) }}</strong></td>
              <td class="num"><strong>{{ suppliesData.summary.totalSupplies }}</strong></td>
              <td class="num no-print">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="section-title">
        Détail des livraisons
        <span class="section-count">({{ suppliesData.lines.length }} entrées)</span>
      </div>
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Fournisseur</th>
              <th>Station</th>
              <th>Cuve / Type</th>
              <th class="num">Volume (L)</th>
              <th class="num">Prix unit.</th>
              <th class="num">Coût</th>
              <th>Réf.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in paginatedSupplies" :key="line.id">
              <td>{{ fmtDate(line.date) }}</td>
              <td>{{ line.supplier }}</td>
              <td>{{ line.station }}</td>
              <td>{{ line.tank }} <span class="fuel-badge">{{ line.fuelType }}</span></td>
              <td class="num">{{ fmt(line.deliveredL) }}</td>
              <td class="num">{{ line.unitPrice ? fmtCost(line.unitPrice) : '-' }}</td>
              <td class="num">{{ line.cost > 0 ? fmtCost(line.cost) : '-' }}</td>
              <td>{{ line.deliveryRef || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <!-- CORRECTIF: pagination correctement liée aux lignes supplies -->
        <div v-if="suppliesData.lines.length > pageSize" class="pagination">
          <button @click="suppliesPage--" :disabled="suppliesPage === 1" class="page-btn">Précédent</button>
          <span>Page {{ suppliesPage }} / {{ suppliesTotalPages }}</span>
          <button @click="suppliesPage++" :disabled="suppliesPage === suppliesTotalPages" class="page-btn">Suivant</button>
        </div>
      </div>
    </div>

    <!-- ====================== TAB 2: SORTIES ====================== -->
    <div v-if="!loading && activeTab === 'dispenses' && dispensesData" class="report-content">
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-label">Volume distribué</span>
          <span class="summary-value">{{ fmt(dispensesData.summary.totalL) }} L</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Coût total</span>
          <span class="summary-value">{{ fmtCost(dispensesData.summary.totalCost) }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Nb ravitaillements</span>
          <span class="summary-value">{{ dispensesData.summary.totalDispenses }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Véhicules</span>
          <span class="summary-value">{{ dispensesData.byVehicle.length }}</span>
        </div>
      </div>

      <div class="two-cols">
        <div>
          <div class="section-title">Par véhicule</div>
          <div class="table-wrapper">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th class="num">Volume (L)</th>
                  <th class="num">Coût</th>
                  <th class="num">Ravit.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in dispensesData.byVehicle" :key="row.plate">
                  <td>{{ row.label || row.plate }}</td>
                  <td class="num">{{ fmt(row.totalL) }}</td>
                  <td class="num">{{ fmtCost(row.totalCost) }}</td>
                  <td class="num">{{ row.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div class="section-title">Par chauffeur</div>
          <div class="table-wrapper">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Chauffeur</th>
                  <th class="num">Volume (L)</th>
                  <th class="num">Coût</th>
                  <th class="num">Ravit.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in dispensesData.byDriver" :key="row.driver">
                  <td>{{ row.driver }}</td>
                  <td class="num">{{ fmt(row.totalL) }}</td>
                  <td class="num">{{ fmtCost(row.totalCost) }}</td>
                  <td class="num">{{ row.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="section-title">
        Détail des ravitaillements
        <span class="section-count">({{ dispensesData.lines.length }} entrées)</span>
      </div>
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Véhicule</th>
              <th>Chauffeur</th>
              <th>Station</th>
              <th>Type</th>
              <th class="num">Litres</th>
              <th class="num">Coût</th>
              <th class="num">Km</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in paginatedDispenses" :key="line.id">
              <td>{{ fmtDate(line.date) }}</td>
              <td>{{ line.vehicle }}</td>
              <td>{{ line.driverName }}</td>
              <td>{{ line.station }}</td>
              <td><span class="fuel-badge">{{ line.fuelType }}</span></td>
              <td class="num">{{ fmt(line.liters) }}</td>
              <td class="num">{{ line.cost > 0 ? fmtCost(line.cost) : '-' }}</td>
              <td class="num">{{ line.odometerKm > 0 ? line.odometerKm.toLocaleString('fr-FR') : '-' }}</td>
            </tr>
          </tbody>
        </table>
        <!-- CORRECTIF: pagination propre pour dispenses -->
        <div v-if="dispensesData.lines.length > pageSize" class="pagination">
          <button @click="dispensesPage--" :disabled="dispensesPage === 1" class="page-btn">Précédent</button>
          <span>Page {{ dispensesPage }} / {{ dispensesTotalPages }}</span>
          <button @click="dispensesPage++" :disabled="dispensesPage === dispensesTotalPages" class="page-btn">Suivant</button>
        </div>
      </div>
    </div>

    <!-- ====================== TAB 3: CONSOMMATIONS ====================== -->
    <div v-if="!loading && activeTab === 'consumption' && consumptionData" class="report-content">
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-label">Volume total</span>
          <span class="summary-value">{{ fmt(consumptionData.summary.totalL) }} L</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Distance totale</span>
          <span class="summary-value">{{ consumptionData.summary.totalKm.toLocaleString('fr-FR') }} km</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Conso. moyenne flotte</span>
          <span class="summary-value">
            {{ consumptionData.summary.avgFleetConsumption ? consumptionData.summary.avgFleetConsumption + ' L/100km' : 'N/A' }}
          </span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Véhicules suivis</span>
          <span class="summary-value">{{ consumptionData.summary.totalVehicles }}</span>
        </div>
      </div>

      <div class="section-title">Consommation par véhicule</div>
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Type</th>
              <th class="num">Volume (L)</th>
              <th class="num">Km parcourus</th>
              <th class="num">L/100km</th>
              <th class="num">Moy. / ravit.</th>
              <th class="num">Nb ravit.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in consumptionData.vehicles" :key="v.vehicleId">
              <td>
                <strong>{{ v.plate }}</strong>
                <span class="vehicle-sub" v-if="v.make || v.model">{{ [v.make, v.model].filter(Boolean).join(' ') }}</span>
              </td>
              <td><span class="fuel-badge">{{ v.fuelType }}</span></td>
              <td class="num">{{ fmt(v.totalL) }}</td>
              <td class="num">{{ v.kmDriven > 0 ? v.kmDriven.toLocaleString('fr-FR') : '-' }}</td>
              <td class="num">
                <span v-if="v.consumptionRate !== null && v.consumptionRate !== undefined" :class="rateClass(v.consumptionRate)">
                  {{ v.consumptionRate }} L/100km
                </span>
                <span v-else class="muted">N/A</span>
              </td>
              <td class="num">{{ v.avgPerFill }} L</td>
              <td class="num">{{ v.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ====================== TAB 4: COMPARATIF ====================== -->
    <div v-if="!loading && activeTab === 'comparison' && comparisonData" class="report-content">
      <div class="summary-cards">
        <div class="summary-card summary-card--danger">
          <span class="summary-label">Critiques (&gt;25%)</span>
          <span class="summary-value">{{ comparisonData.summary.critiques }}</span>
        </div>
        <div class="summary-card summary-card--warning">
          <span class="summary-label">Attention (10-25%)</span>
          <span class="summary-value">{{ comparisonData.summary.attentions }}</span>
        </div>
        <div class="summary-card summary-card--success">
          <span class="summary-label">Économiques (&lt;–10%)</span>
          <span class="summary-value">{{ comparisonData.summary.economies }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Normaux</span>
          <span class="summary-value">{{ comparisonData.summary.normaux }}</span>
        </div>
      </div>

      <div class="norm-info">
        Norme par catégorie — les véhicules sans catégorie utilisent <strong>{{ comparisonData.normL100km }} L/100km</strong>
      </div>

      <div class="section-title">Analyse des écarts par véhicule</div>
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Catégorie</th>
              <th class="num">Norme (L/100km)</th>
              <th class="num">Km parcourus</th>
              <th class="num">Volume réel (L)</th>
              <th class="num">Volume norme (L)</th>
              <th class="num">Écart (L)</th>
              <th class="num">Écart (%)</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in comparisonData.vehicles" :key="v.vehicleId" :class="'row-' + v.status">
              <td>
                <strong>{{ v.plate }}</strong>
                <span class="vehicle-sub" v-if="v.make || v.model">{{ [v.make, v.model].filter(Boolean).join(' ') }}</span>
              </td>
              <td>
                <span v-if="v.category" class="category-badge">{{ CATEGORY_LABELS[v.category] }}</span>
                <span v-else class="no-category">—</span>
              </td>
              <td class="num"><strong>{{ v.normRate }}</strong></td>
              <td class="num">{{ v.kmDriven > 0 ? v.kmDriven.toLocaleString('fr-FR') : '-' }}</td>
              <td class="num">{{ fmt(v.totalL) }}</td>
              <td class="num">{{ v.normL !== null && v.normL !== undefined ? fmt(v.normL) : '-' }}</td>
              <td class="num" :class="excessClass(v.excessL)">{{ formatExcess(v.excessL) }}</td>
              <td class="num" :class="excessClass(v.ecartPct)">{{ formatEcartPct(v.ecartPct) }}</td>
              <td>
                <span class="status-badge" :class="'status-' + v.status">{{ statusLabel(v.status) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="legend">
        <span class="legend-item"><span class="status-badge status-critique">Critique</span> Surconsommation &gt;25% - risque fraude/fuite</span>
        <span class="legend-item"><span class="status-badge status-attention">Attention</span> Surconsommation 10-25% - à surveiller</span>
        <span class="legend-item"><span class="status-badge status-ok">Normal</span> Dans la norme (±10%)</span>
        <span class="legend-item"><span class="status-badge status-economie">Économique</span> Sous la norme de plus de 10%</span>
      </div>
    </div>

    <!-- État vide -->
    <div v-if="!loading && !hasData && !error" class="empty-state">
      <p>Aucune donnée pour cette période. Cliquez sur "Actualiser" pour charger les états.</p>
    </div>

    <!-- Pied de page impression -->
    <div class="print-footer">
      <span class="print-footer-left">{{ companyFooterLeft }}</span>
      <span class="print-footer-center">
        Imprimé le {{ fmtDate(new Date()) }} par {{ currentUser?.fullName || currentUser?.full_name || currentUser?.name || 'Utilisateur' }}
      </span>
      <span class="print-footer-right">Page 1 / 1</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import api from '../services/api.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCompanyStore } from '../stores/company.js';

const company = useCompanyStore();

const today = new Date().toISOString().split('T')[0];
const firstOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

const startDate = ref(firstOfYear);
const endDate = ref(today);
const norm = ref(parseFloat(localStorage.getItem('fuelNorm') || '12'));

const CATEGORY_LABELS = {
  CITADINE:     'Citadine',
  BERLINE_SUV:  'Berline/SUV',
  PICKUP_4X4:   'Pick-up/4x4',
  PETIT_CAMION: 'Pt Camion',
  POIDS_LOURD:  'Poids Lourd',
  GROS_PORTEUR: 'Gros Porteur',
};
const loading = ref(false);
const pdfExporting = ref(false);
const error = ref('');
const activeTab = ref(localStorage.getItem('lastFuelTab') || 'supplies');

// CORRECTIF: AbortController natif au lieu de cancelTokenSource axios
let abortController = null;

// CORRECTIF: pagination séparée par onglet (évite le bug de reset partagé)
const suppliesPage = ref(1);
const dispensesPage = ref(1);
const pageSize = 50;

const suppliesData = ref(null);
const dispensesData = ref(null);
const consumptionData = ref(null);
const comparisonData = ref(null);

// Suivi du chargement par onglet
const tabLoading = ref({ supplies: false, dispenses: false, consumption: false, comparison: false });

// Filtres sauvegardés
const savedFilters = ref([]);
const selectedFilterId = ref('');

// CORRECTIF: debounce pour éviter les appels doubles sur changement de date
let dateDebounceTimer = null;

const tabs = [
  { id: 'supplies',    label: 'Approvisionnements',   icon: '📥', printTitle: 'ÉTAT DES APPROVISIONNEMENTS EN CARBURANT' },
  { id: 'dispenses',   label: 'Sorties carburant',     icon: '⛽', printTitle: 'ÉTAT DES SORTIES DE CARBURANT' },
  { id: 'consumption', label: 'Consommations',          icon: '📊', printTitle: 'ÉTAT DES CONSOMMATIONS PAR VÉHICULE' },
  { id: 'comparison',  label: 'Comparatif vs norme',    icon: '🔍', printTitle: 'ÉTAT COMPARATIF CONSOMMATION / NORME' },
];

// ── Pagination computed correctement séparée ──
const paginatedSupplies = computed(() => {
  if (!suppliesData.value?.lines) return [];
  const start = (suppliesPage.value - 1) * pageSize;
  return suppliesData.value.lines.slice(start, start + pageSize);
});

const paginatedDispenses = computed(() => {
  if (!dispensesData.value?.lines) return [];
  const start = (dispensesPage.value - 1) * pageSize;
  return dispensesData.value.lines.slice(start, start + pageSize);
});

const suppliesTotalPages = computed(() =>
  Math.max(1, Math.ceil((suppliesData.value?.lines?.length ?? 0) / pageSize))
);

const dispensesTotalPages = computed(() =>
  Math.max(1, Math.ceil((dispensesData.value?.lines?.length ?? 0) / pageSize))
);

// ── Données entreprise ──
const getApiBase = () => (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
const companyName = computed(() => company.settings?.name || 'FLEETENERGY');
const companyFooterLeft = computed(() => company.displayFooter?.left || companyName.value);

const companyLogoUrl = computed(() => {
  const url = company.settings?.logoUrl;
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = getApiBase();
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url.replace(/^\/+/, '')}`;
});

const currentUser = computed(() => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
});

const hasData = computed(() => {
  if (activeTab.value === 'supplies')    return !!suppliesData.value;
  if (activeTab.value === 'dispenses')   return !!dispensesData.value;
  if (activeTab.value === 'consumption') return !!consumptionData.value;
  if (activeTab.value === 'comparison')  return !!comparisonData.value;
  return false;
});

const currentTabPrintTitle = computed(
  () => tabs.find(t => t.id === activeTab.value)?.printTitle || 'ÉTAT CARBURANT'
);

// ── Validation ──
function validateDates() {
  if (!startDate.value || !endDate.value) {
    error.value = 'Les deux dates sont requises.';
    return false;
  }
  if (new Date(startDate.value) > new Date(endDate.value)) {
    error.value = 'La date de début doit être antérieure à la date de fin.';
    return false;
  }
  // CORRECTIF: empêcher des plages de plus de 2 ans (protection accidentelle)
  const diffDays = (new Date(endDate.value) - new Date(startDate.value)) / 86400000;
  if (diffDays > 730) {
    error.value = 'La période ne peut pas dépasser 2 ans.';
    return false;
  }
  error.value = '';
  return true;
}

// ── Chargement principal ──
async function loadReport() {
  if (!validateDates()) return;

  // Annuler la requête précédente
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();

  loading.value = true;
  tabLoading.value[activeTab.value] = true;
  error.value = '';

  const params = { startDate: startDate.value, endDate: endDate.value };

  try {
    if (activeTab.value === 'supplies') {
      const res = await api.get('/fuel/reports/supplies', { params, signal: abortController.signal });
      suppliesData.value = res.data.data;
      suppliesPage.value = 1;
    } else if (activeTab.value === 'dispenses') {
      const res = await api.get('/fuel/reports/dispenses', { params, signal: abortController.signal });
      dispensesData.value = res.data.data;
      dispensesPage.value = 1;
    } else if (activeTab.value === 'consumption') {
      const res = await api.get('/fuel/reports/consumption', { params, signal: abortController.signal });
      consumptionData.value = res.data.data;
    } else if (activeTab.value === 'comparison') {
      const res = await api.get('/fuel/reports/comparison', {
        params: { ...params, norm: norm.value },
        signal: abortController.signal,
      });
      comparisonData.value = res.data.data;
    }
  } catch (e) {
    // CORRECTIF: ignorer les erreurs d'annulation (AbortError ou axios CanceledError)
    if (e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
    const msg = e?.response?.data?.message || e?.message || 'Erreur lors du chargement';
    error.value = msg;
  } finally {
    loading.value = false;
    tabLoading.value[activeTab.value] = false;
  }
}

// CORRECTIF: retry avec back-off exponentiel et gestion propre des erreurs
async function loadReportWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await loadReport();
      return; // succès
    } catch (e) {
      if (e?.name === 'AbortError' || e?.name === 'CanceledError') return;
      if (i < retries - 1) {
        const delay = 1000 * Math.pow(2, i);
        error.value = `Tentative ${i + 2}/${retries} dans ${delay / 1000}s...`;
        await new Promise(r => setTimeout(r, delay));
      } else {
        error.value = e?.response?.data?.message || 'Échec après plusieurs tentatives.';
      }
    }
  }
}

function switchTab(id) {
  if (activeTab.value === id) return; // CORRECTIF: éviter rechargement inutile
  activeTab.value = id;
  localStorage.setItem('lastFuelTab', id);
  if (!hasData.value) loadReport();
}

// ── Filtres sauvegardés ──
function saveCurrentFilters() {
  const name = prompt('Nom du filtre :', `Filtre ${new Date().toLocaleDateString('fr-FR')}`);
  if (!name?.trim()) return;

  let filters = [];
  try {
    filters = JSON.parse(localStorage.getItem('fuelFilters') || '[]');
    if (!Array.isArray(filters)) filters = [];
  } catch { filters = []; }

  const newFilter = {
    id: Date.now().toString(),
    name: name.trim(),
    startDate: startDate.value,
    endDate: endDate.value,
    norm: norm.value,
    tab: activeTab.value,
  };
  filters.push(newFilter);
  localStorage.setItem('fuelFilters', JSON.stringify(filters));
  savedFilters.value = filters;
  selectedFilterId.value = newFilter.id;
}

function loadSavedFilter() {
  if (!selectedFilterId.value) return;
  const filter = savedFilters.value.find(f => f.id === selectedFilterId.value);
  if (!filter) return;
  startDate.value = filter.startDate;
  endDate.value = filter.endDate;
  if (filter.norm) norm.value = filter.norm;
  if (filter.tab) activeTab.value = filter.tab;
  loadReport();
}

function loadSavedFilters() {
  try {
    const raw = localStorage.getItem('fuelFilters');
    const parsed = JSON.parse(raw || '[]');
    savedFilters.value = Array.isArray(parsed) ? parsed : [];
  } catch {
    savedFilters.value = [];
  }
}

// ── Formatage ──
function fmt(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtCost(n) {
  if (n == null) return '0 FCFA';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' FCFA';
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return String(d);
  }
}

function pct(val, total) {
  if (!total || !val) return 0;
  return Math.round((val / total) * 100);
}

function rateClass(rate) {
  if (rate > 18) return 'text-danger';
  if (rate > 14) return 'text-warning';
  return 'text-success';
}

function excessClass(val) {
  if (val == null || val === 0) return '';
  return val > 0 ? 'text-danger' : 'text-success';
}

// CORRECTIF: formatage centralisé (évite la duplication inline dans le template)
function formatExcess(val) {
  if (val == null) return '-';
  return (val > 0 ? '+' : '') + val;
}

function formatEcartPct(val) {
  if (val == null) return '-';
  return (val > 0 ? '+' : '') + val + '%';
}

function statusLabel(s) {
  const labels = { critique: 'Critique', attention: 'Attention', ok: 'Normal', economie: 'Économique' };
  return labels[s] || s;
}

// ── Export CSV ──
function escapeCSV(val) {
  if (val == null) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
}

function exportCSV() {
  let rows = [];
  let filename = 'export.csv';

  if (activeTab.value === 'supplies' && suppliesData.value) {
    filename = `approvisionnements_${startDate.value}_${endDate.value}.csv`;
    rows = [
      ['Date', 'Fournisseur', 'Station', 'Cuve', 'Type', 'Volume (L)', 'Prix unit.', 'Coût', 'Référence'],
      ...suppliesData.value.lines.map(l => [
        fmtDate(l.date), l.supplier, l.station, l.tank, l.fuelType,
        l.deliveredL, l.unitPrice ?? '', l.cost || '', l.deliveryRef || '',
      ]),
    ];
  } else if (activeTab.value === 'dispenses' && dispensesData.value) {
    filename = `sorties_carburant_${startDate.value}_${endDate.value}.csv`;
    rows = [
      ['Date', 'Véhicule', 'Chauffeur', 'Station', 'Type', 'Litres', 'Coût', 'Kilométrage'],
      ...dispensesData.value.lines.map(l => [
        fmtDate(l.date), l.vehicle, l.driverName, l.station, l.fuelType,
        l.liters, l.cost || '', l.odometerKm || '',
      ]),
    ];
  } else if (activeTab.value === 'consumption' && consumptionData.value) {
    filename = `consommations_${startDate.value}_${endDate.value}.csv`;
    rows = [
      ['Véhicule', 'Marque', 'Modèle', 'Type', 'Volume (L)', 'Km parcourus', 'L/100km', 'Moy/ravit.', 'Nb ravit.'],
      ...consumptionData.value.vehicles.map(v => [
        v.plate, v.make ?? '', v.model ?? '', v.fuelType, v.totalL,
        v.kmDriven, v.consumptionRate ?? '', v.avgPerFill, v.count,
      ]),
    ];
  } else if (activeTab.value === 'comparison' && comparisonData.value) {
    filename = `comparatif_vs_norme_${startDate.value}_${endDate.value}.csv`;
    rows = [
      ['Véhicule', 'Type', 'Km parcourus', 'Volume réel (L)', 'Volume norme (L)', 'Écart (L)', 'Écart (%)', 'Statut'],
      ...comparisonData.value.vehicles.map(v => [
        v.plate, v.fuelType, v.kmDriven, v.totalL,
        v.normL ?? '', v.excessL ?? '', v.ecartPct ?? '', statusLabel(v.status),
      ]),
    ];
  }

  if (!rows.length) return;

  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Export PDF ──
async function exportPDF() {
  if (pdfExporting.value) return;
  pdfExporting.value = true;

  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const period = `Période : ${fmtDate(startDate.value)} au ${fmtDate(endDate.value)}`;
    const edited = `Édité le ${fmtDate(new Date())}`;

    // Logo
    let logoLoaded = false;
    if (companyLogoUrl.value) {
      try {
        const img = await new Promise((resolve, reject) => {
          const i = new Image();
          i.crossOrigin = 'anonymous';
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = companyLogoUrl.value;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 14, 8, 18, 18);
        logoLoaded = true;
      } catch { /* logo indisponible, on continue */ }
    }

    const textX = logoLoaded ? 36 : 14;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(companyName.value.toUpperCase(), textX, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(edited, W - 14, 15, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(14, 21, W - 14, 21);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 78, 216);
    doc.text(currentTabPrintTitle.value, W / 2, 30, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(period, W / 2, 36, { align: 'center' });

    doc.setDrawColor(29, 78, 216);
    doc.setLineWidth(0.5);
    doc.line(14, 41, W - 14, 41);

    const startY = 47;
    const headStyles = { fillColor: [29, 78, 216] };
    const margin = { left: 14, right: 14 };

    if (activeTab.value === 'supplies' && suppliesData.value) {
      const s = suppliesData.value.summary;
      autoTable(doc, {
        startY,
        head: [['Volume total (L)', 'Coût total', 'Nb livraisons', 'Fournisseurs']],
        body: [[fmt(s.totalL), fmtCost(s.totalCost), s.totalSupplies, suppliesData.value.bySupplier.length]],
        styles: { fontSize: 9 }, headStyles, margin,
      });
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Fournisseur', 'Volume (L)', 'Coût', 'Livraisons']],
        body: suppliesData.value.bySupplier.map(r => [r.supplier, fmt(r.totalL), fmtCost(r.totalCost), r.count]),
        styles: { fontSize: 8 }, headStyles, margin,
      });
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Détail des livraisons', 14, 16);
      autoTable(doc, {
        startY: 20,
        head: [['Date', 'Fournisseur', 'Station', 'Cuve', 'Type', 'Volume (L)', 'Prix unit.', 'Coût', 'Réf.']],
        body: suppliesData.value.lines.map(l => [
          fmtDate(l.date), l.supplier, l.station, l.tank, l.fuelType,
          fmt(l.deliveredL), l.unitPrice ? fmtCost(l.unitPrice) : '-',
          l.cost > 0 ? fmtCost(l.cost) : '-', l.deliveryRef || '-',
        ]),
        styles: { fontSize: 7 }, headStyles, margin,
      });

    } else if (activeTab.value === 'dispenses' && dispensesData.value) {
      const s = dispensesData.value.summary;
      autoTable(doc, {
        startY,
        head: [['Volume distribué (L)', 'Coût total', 'Nb ravitaillements', 'Véhicules']],
        body: [[fmt(s.totalL), fmtCost(s.totalCost), s.totalDispenses, dispensesData.value.byVehicle.length]],
        styles: { fontSize: 9 }, headStyles, margin,
      });
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Véhicule', 'Volume (L)', 'Coût', 'Ravit.']],
        body: dispensesData.value.byVehicle.map(r => [r.label || r.plate, fmt(r.totalL), fmtCost(r.totalCost), r.count]),
        styles: { fontSize: 8 }, headStyles, margin,
      });
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Chauffeur', 'Volume (L)', 'Coût', 'Ravit.']],
        body: dispensesData.value.byDriver.map(r => [r.driver, fmt(r.totalL), fmtCost(r.totalCost), r.count]),
        styles: { fontSize: 8 }, headStyles, margin,
      });
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Détail des ravitaillements', 14, 16);
      autoTable(doc, {
        startY: 20,
        head: [['Date', 'Véhicule', 'Chauffeur', 'Station', 'Type', 'Litres', 'Coût', 'Km']],
        body: dispensesData.value.lines.map(l => [
          fmtDate(l.date), l.vehicle, l.driverName, l.station, l.fuelType,
          fmt(l.liters), l.cost > 0 ? fmtCost(l.cost) : '-',
          l.odometerKm > 0 ? l.odometerKm.toLocaleString('fr-FR') : '-',
        ]),
        styles: { fontSize: 7 }, headStyles, margin,
      });

    } else if (activeTab.value === 'consumption' && consumptionData.value) {
      const s = consumptionData.value.summary;
      autoTable(doc, {
        startY,
        head: [['Volume total (L)', 'Distance totale (km)', 'Conso. moy. flotte', 'Véhicules suivis']],
        body: [[fmt(s.totalL), s.totalKm.toLocaleString('fr-FR'), s.avgFleetConsumption ? s.avgFleetConsumption + ' L/100km' : 'N/A', s.totalVehicles]],
        styles: { fontSize: 9 }, headStyles, margin,
      });
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Véhicule', 'Marque/Modèle', 'Type', 'Volume (L)', 'Km parcourus', 'L/100km', 'Moy/ravit.', 'Nb ravit.']],
        body: consumptionData.value.vehicles.map(v => [
          v.plate, [v.make, v.model].filter(Boolean).join(' ') || '-', v.fuelType,
          fmt(v.totalL), v.kmDriven > 0 ? v.kmDriven.toLocaleString('fr-FR') : '-',
          v.consumptionRate != null ? v.consumptionRate + ' L/100km' : 'N/A',
          v.avgPerFill + ' L', v.count,
        ]),
        styles: { fontSize: 8 }, headStyles, margin,
        didParseCell(data) {
          if (data.section === 'body' && data.column.index === 5) {
            const val = parseFloat(data.cell.raw);
            if (!isNaN(val)) {
              if (val > 18) data.cell.styles.textColor = [220, 38, 38];
              else if (val > 14) data.cell.styles.textColor = [217, 119, 6];
              else data.cell.styles.textColor = [22, 163, 74];
            }
          }
        },
      });

    } else if (activeTab.value === 'comparison' && comparisonData.value) {
      const s = comparisonData.value.summary;
      autoTable(doc, {
        startY,
        head: [['Norme appliquée', 'Total véhicules', 'Critiques (>25%)', 'Attention (10-25%)', 'Normaux', 'Économiques']],
        body: [[comparisonData.value.normL100km + ' L/100km', s.total ?? (s.critiques + s.attentions + s.normaux + s.economies), s.critiques, s.attentions, s.normaux, s.economies]],
        styles: { fontSize: 9 }, headStyles, margin,
      });
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Véhicule', 'Type', 'Km', 'Vol. réel (L)', 'Vol. norme (L)', 'Écart (L)', 'Écart (%)', 'Statut']],
        body: comparisonData.value.vehicles.map(v => [
          v.plate, v.fuelType,
          v.kmDriven > 0 ? v.kmDriven.toLocaleString('fr-FR') : '-',
          fmt(v.totalL),
          v.normL != null ? fmt(v.normL) : '-',
          formatExcess(v.excessL),
          formatEcartPct(v.ecartPct),
          statusLabel(v.status),
        ]),
        styles: { fontSize: 8 }, headStyles, margin,
        didParseCell(data) {
          if (data.section === 'body' && data.column.index === 7) {
            const s = data.cell.raw;
            if (s === 'Critique')   data.cell.styles.textColor = [185, 28, 28];
            else if (s === 'Attention') data.cell.styles.textColor = [146, 64, 14];
            else if (s === 'Économique') data.cell.styles.textColor = [30, 64, 175];
          }
        },
      });
    }

    // Pied de page sur chaque page
    const pageCount = doc.internal.getNumberOfPages();
    const PH = doc.internal.pageSize.getHeight();
    const userName = currentUser.value?.fullName
      || currentUser.value?.full_name
      || currentUser.value?.name
      || 'Utilisateur';
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(14, PH - 14, W - 14, PH - 14);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      // Gauche : info entreprise
      doc.text(companyFooterLeft.value || companyName.value, 14, PH - 9);
      // Centre : nom de l'utilisateur
      doc.text(`Imprimé par ${userName}`, W / 2, PH - 9, { align: 'center' });
      // Droite : numéro de page
      doc.text(`Page ${i} / ${pageCount}`, W - 14, PH - 9, { align: 'right' });
    }

    const filename = `${activeTab.value}_${startDate.value}_${endDate.value}.pdf`;
    doc.save(filename);
  } finally {
    pdfExporting.value = false;
  }
}

function printReport() {
  window.print();
}


// ── Watchers ──

// CORRECTIF: watcher norm avec debounce pour éviter appels répétés pendant la saisie
let normDebounce = null;
watch(norm, (val) => {
  const parsed = parseFloat(val);
  if (isNaN(parsed) || parsed < 1 || parsed > 50) return;
  localStorage.setItem('fuelNorm', parsed.toString());
  if (activeTab.value !== 'comparison') return;
  clearTimeout(normDebounce);
  normDebounce = setTimeout(() => loadReport(), 600);
});

// CORRECTIF: debounce sur changement de dates pour éviter double appel
watch([startDate, endDate], () => {
  clearTimeout(dateDebounceTimer);
  dateDebounceTimer = setTimeout(() => {
    if (validateDates()) loadReport();
  }, 400);
});

// ── Cycle de vie ──
onMounted(() => {
  company.loadFromServer?.();
  loadSavedFilters();
  loadReport();
});

onUnmounted(() => {
  // CORRECTIF: annulation propre à la destruction du composant
  if (abortController) abortController.abort();
  clearTimeout(dateDebounceTimer);
  clearTimeout(normDebounce);
});
</script>

<style scoped>
.fuel-reports {
  padding: 0;
  width: 100%;
  box-sizing: border-box;
}

.page-header { margin-bottom: 20px; }
.page-header h1 {
  font-size: 1.6rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px 0;
}
.page-subtitle { color: #64748b; margin: 0; }

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}
.filter-group input {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.9rem;
  color: #1e293b;
}
.filter-select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.9rem;
  background: #fff;
  cursor: pointer;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #1d4ed8;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 18px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 600;
}
.btn-primary:disabled { opacity: 0.6; cursor: default; }
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 18px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 600;
}
.btn-secondary:disabled { opacity: 0.4; cursor: default; }
.btn-print {
  background: #0f766e;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 18px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 600;
}
.btn-print:disabled { opacity: 0.4; cursor: default; }
.retry-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  margin-left: 12px;
  cursor: pointer;
}
.btn-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e2e8f0;
  overflow-x: auto;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  transition: color 0.15s;
}
.tab-btn:hover { color: #1d4ed8; }
.tab-btn.active {
  color: #1d4ed8;
  border-bottom-color: #1d4ed8;
  font-weight: 700;
}
.tab-icon { font-size: 1rem; }
.tab-spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid #cbd5e1;
  border-top-color: #1d4ed8;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.loading-state { text-align: center; color: #64748b; padding: 40px; }
.spinner {
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top-color: #1d4ed8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; color: #94a3b8; padding: 40px; }

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.summary-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-card--danger  { border-left: 4px solid #ef4444; }
.summary-card--warning { border-left: 4px solid #f59e0b; }
.summary-card--success { border-left: 4px solid #22c55e; }
.summary-label { font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
.summary-value { font-size: 1.3rem; font-weight: 700; color: #1e293b; }

.section-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 20px 0 8px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-count { font-size: 0.78rem; font-weight: 400; color: #94a3b8; text-transform: none; letter-spacing: 0; }

.report-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.report-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  padding: 10px 12px;
  text-align: left;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}
.report-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
  vertical-align: middle;
}
.report-table tbody tr:hover { background: #f8fafc; }
.report-table tfoot td {
  background: #f1f5f9;
  border-top: 2px solid #e2e8f0;
  font-weight: 700;
  vertical-align: middle;
}
/* th.num ET td.num alignés à droite - le header suit son contenu */
.num { text-align: right; }
.report-table th.num { text-align: right; }

.bar-cell { display: flex; align-items: center; gap: 8px; }
.bar-fill { height: 6px; background: #1d4ed8; border-radius: 3px; min-width: 4px; }

.category-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.no-category { color: #94a3b8; font-size: 0.8rem; }

.fuel-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: #dbeafe;
  color: #1d4ed8;
  margin-left: 4px;
}
.vehicle-sub { display: block; font-size: 0.75rem; color: #94a3b8; }

.two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 768px) { .two-cols { grid-template-columns: 1fr; } }

.text-danger  { color: #dc2626; font-weight: 600; }
.text-warning { color: #d97706; font-weight: 600; }
.text-success { color: #16a34a; font-weight: 600; }
.muted { color: #94a3b8; }

.norm-info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  margin-bottom: 16px;
}

.row-critique  { background: #fef2f2 !important; }
.row-attention { background: #fffbeb !important; }
.row-economie  { background: #f0fdf4 !important; }

.status-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
}
.status-critique { background: #fee2e2; color: #b91c1c; }
.status-attention { background: #fef3c7; color: #92400e; }
.status-ok       { background: #dcfce7; color: #166534; }
.status-economie { background: #dbeafe; color: #1e40af; }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 20px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 0.8rem;
  color: #64748b;
}
.legend-item { display: flex; align-items: center; gap: 6px; }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px;
}
.page-btn {
  padding: 6px 12px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
}
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── IMPRESSION ── */
.print-header { display: none; }
.print-footer { display: none; }

@media print {
  .topbar, .sidebar, .sidebar-overlay { display: none !important; }
  .no-print { display: none !important; }

  .print-header {
    display: block !important;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 2px solid #1d4ed8;
  }
  .print-header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .print-logo { height: 44px; width: auto; object-fit: contain; }
  .print-company-name { font-size: 1rem; font-weight: 700; color: #1e293b; }
  .print-title-bar {
    font-size: 1rem;
    font-weight: 800;
    color: #1d4ed8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
    margin-bottom: 4px;
  }
  .print-period { text-align: center; font-size: 0.8rem; color: #475569; }

  /*
   * PIED DE PAGE SUR TOUTES LES PAGES
   * ───────────────────────────────────
   * Technique : position:fixed ancré en bas de chaque page physique.
   * Pour éviter que le CONTENU passe dessous, on réserve un padding-bottom
   * sur .fuel-reports égal à la hauteur du footer (~22px) + marge (8mm).
   * Ainsi le navigateur coupe le flux du contenu AVANT le footer sur chaque page.
   */
  .print-footer {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    position: fixed;          /* ancré sur chaque page physique */
    bottom: 6mm;
    left: 0;
    right: 0;
    padding: 5px 14mm 0;      /* marges latérales identiques au contenu */
    border-top: 1px solid #cbd5e1;
    font-size: 0.72rem;
    color: #94a3b8;
    background: #fff;         /* masque tout contenu qui glisserait dessous */
    z-index: 9999;
    height: 14px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  /* ── KPI cards : ligne compacte au lieu de 4 grands blocs ── */
  .summary-cards {
    display: flex !important;
    flex-direction: row !important;
    gap: 0 !important;
    margin-bottom: 10px !important;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }
  .summary-card {
    flex: 1;
    padding: 6px 10px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 2px !important;
    border-right: 1px solid #e2e8f0;
    border-left: none !important;
    border-top: none !important;
    border-bottom: none !important;
    border-radius: 0 !important;
  }
  .summary-card:last-child { border-right: none; }
  .summary-card--danger  { border-top: 3px solid #ef4444 !important; }
  .summary-card--warning { border-top: 3px solid #f59e0b !important; }
  .summary-card--success { border-top: 3px solid #22c55e !important; }
  .summary-label {
    font-size: 0.65rem !important;
    white-space: nowrap;
    margin: 0 !important;
    line-height: 1.2;
  }
  .summary-value {
    font-size: 1rem !important;
    font-weight: 700 !important;
    margin: 0 !important;
    line-height: 1.3;
  }
  .summary-card.no-print { display: none !important; }

  /* ── Footer : gauche=entreprise | centre=utilisateur | droite=page ── */
  .print-footer-left {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .print-footer-center {
    flex: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .print-footer-right {
    flex: 0 0 auto;
    text-align: right;
    white-space: nowrap;
    font-weight: 600;
    color: #475569;
    padding-left: 16px;
  }
  .report-table th, .report-table td { padding: 5px 8px; font-size: 0.78rem; vertical-align: middle; }
  .report-table th.num, .report-table td.num { text-align: right; }
  .section-title { font-size: 0.8rem; margin: 12px 0 4px 0; }
  .table-wrapper { page-break-inside: avoid; }
  .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .fuel-reports { padding: 0 0 18mm 0; max-width: 100%; }
  .legend { font-size: 0.72rem; padding: 6px 10px; page-break-inside: avoid; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>

<style>
/*
 * @page doit être dans un <style> non-scoped pour être pris en compte par le navigateur.
 * margin-bottom : espace réservé en bas de chaque page physique pour le footer fixe.
 */
@page {
  margin-top: 10mm;
  margin-bottom: 22mm; /* doit être >= hauteur footer + bottom offset */
  margin-left: 10mm;
  margin-right: 10mm;
}

@media print {
  .topbar, .sidebar, .sidebar-overlay, .app-footer { display: none !important; }
  .body { padding: 0 !important; margin: 0 !important; }
  .layout { display: block !important; }
  main { padding: 0 !important; margin: 0 !important; }
}
</style>
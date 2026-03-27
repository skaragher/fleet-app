<template>
  <div class="reports" :class="{ 'driver-view': isDriverMobile }">
    <!-- Version chauffeur mobile -->
    <template v-if="isDriverMobile">
      <div class="driver-container">
        <!-- Header chauffeur -->
        <header class="driver-header">
          <div class="driver-header-top">
            <h1>📱 Mon espace chauffeur</h1>
            <button class="btn-icon" :disabled="loading" @click="loadAll">
              <span class="btn-icon">↻</span>
            </button>
          </div>
          <p class="driver-subtitle">Bonjour {{ authStore.user?.name || 'Chauffeur' }}</p>
        </header>

        <!-- Carte véhicule -->
        <div class="driver-vehicle-card">
          <div class="driver-vehicle-header">
            <span class="driver-vehicle-icon">🚗</span>
            <div class="driver-vehicle-info">
              <span class="driver-vehicle-label">Votre véhicule</span>
              <span class="driver-vehicle-plate">{{ driverVehicle?.plate || 'Non assigné' }}</span>
            </div>
          </div>
          <div class="driver-vehicle-stats">
            <div class="driver-stat">
              <span class="driver-stat-label">Ravitaillements</span>
              <span class="driver-stat-value">{{ driverDispenses.length }}</span>
            </div>
            <div class="driver-stat">
              <span class="driver-stat-label">Volume total</span>
              <span class="driver-stat-value">{{ driverTotalLiters.toLocaleString() }} L</span>
            </div>
          </div>
        </div>

        <!-- Cartes d'information -->
        <div class="driver-cards">
          <!-- Assurance -->
          <div class="driver-card" :class="getStatusClass(driverLatestInsurance?.endAt)">
            <div class="driver-card-header">
              <span class="driver-card-icon">🛡️</span>
              <h3>Assurance</h3>
            </div>
            <div class="driver-card-content">
              <p v-if="driverLatestInsurance">
                <span class="driver-card-label">Échéance</span>
                <span class="driver-card-date">{{ formatDate(driverLatestInsurance.endAt) }}</span>
                <span class="driver-card-badge" :class="getStatusClass(driverLatestInsurance.endAt)">
                  {{ getStatusLabel(driverLatestInsurance.endAt) }}
                </span>
              </p>
              <p v-else class="driver-empty">Aucune assurance trouvée</p>
            </div>
          </div>

          <!-- Visite technique -->
          <div class="driver-card" :class="getStatusClass(getInspectionReferenceDate(driverLatestInspection))">
            <div class="driver-card-header">
              <span class="driver-card-icon">🔧</span>
              <h3>Visite technique</h3>
            </div>
            <div class="driver-card-content">
              <p v-if="driverLatestInspection">
                <span class="driver-card-label">Prochaine</span>
                <span class="driver-card-date">{{ formatDate(getInspectionReferenceDate(driverLatestInspection)) }}</span>
                <span class="driver-card-badge" :class="getStatusClass(getInspectionReferenceDate(driverLatestInspection))">
                  {{ getStatusLabel(getInspectionReferenceDate(driverLatestInspection)) }}
                </span>
              </p>
              <p v-else class="driver-empty">Aucune visite trouvée</p>
            </div>
          </div>

          <!-- Maintenance -->
          <div class="driver-card">
            <div class="driver-card-header">
              <span class="driver-card-icon">🛠️</span>
              <h3>Maintenance</h3>
            </div>
            <div class="driver-card-content">
              <p v-if="driverNextMaintenance">
                <span class="driver-card-label">Prochain</span>
                <span class="driver-card-date">{{ formatDate(driverNextMaintenance.dueAt) }}</span>
                <span class="driver-card-desc">{{ driverNextMaintenance.description || 'Entretien' }}</span>
              </p>
              <p v-else class="driver-empty">Aucune maintenance planifiée</p>
            </div>
          </div>
        </div>

        <!-- Historique ravitaillements -->
        <div class="driver-history">
          <div class="driver-history-header">
            <h3>⛽ Derniers ravitaillements</h3>
            <span class="driver-history-count">{{ driverDispenses.length }} total</span>
          </div>
          <div class="driver-history-list">
            <div v-for="d in driverDispenses.slice(0, 5)" :key="d.id" class="driver-history-item">
              <div class="driver-history-left">
                <span class="driver-history-date">{{ formatDate(d.dispensedAt) }}</span>
                <span class="driver-history-station">{{ d.station?.name || 'Station' }}</span>
              </div>
              <div class="driver-history-right">
                <span class="driver-history-liters">{{ Number(d.liters || 0).toLocaleString() }} L</span>
                <span class="driver-history-amount">{{ formatMoney(Number(d.liters || 0) * Number(d.unitPrice || 0)) }}</span>
              </div>
            </div>
            <div v-if="!driverDispenses.length" class="driver-empty">
              Aucun ravitaillement
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Version desktop normale -->
    <template v-else>
      <!-- En-tête impression -->
      <div class="print-header" v-if="generatedAt">
        <div class="print-branding">
          <img v-if="companyLogoUrl" :src="companyLogoUrl" alt="Logo entreprise" class="print-logo" />
          <div class="print-branding-text">
            <h2>{{ companyName }}</h2>
          </div>
        </div>
      </div>

      <!-- Header principal -->
      <header class="reports-header">
        <div class="header-left">
          <h1>Rapports</h1>
          <p class="text-muted">Générez et analysez les données de votre flotte</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline" :disabled="loading" @click="loadAll">
            <span class="btn-icon">↻</span>
            {{ loading ? 'Chargement...' : 'Actualiser' }}
          </button>
          <button class="btn btn-primary" @click="printAll">
            <span class="btn-icon">🖨️</span>
            Imprimer
          </button>
        </div>
      </header>

      <!-- Filtres -->
      <div class="filters-panel">
        <div class="filters-grid">
          <div class="filter-item">
            <label>Du</label>
            <input v-model="fromDate" type="date" class="filter-input" />
          </div>
          <div class="filter-item">
            <label>Au</label>
            <input v-model="toDate" type="date" class="filter-input" />
          </div>
          <div v-if="canViewStationReports" class="filter-item">
            <label>Station</label>
            <select v-model="selectedStationId" class="filter-input" :disabled="isStationManager">
              <option v-if="!isStationManager" value="">Toutes les stations</option>
              <option v-for="s in availableStationsForRole" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div v-if="canViewVehicleReports || canViewConsumptionReports || canViewVisitsInsuranceReports || canViewMaintenanceReports" class="filter-item">
            <label>Véhicule</label>
            <select v-model="selectedVehicleId" class="filter-input">
              <option value="">Tous les véhicules</option>
              <option v-for="v in inServiceVehicles" :key="v.id" :value="v.id">
                {{ v.plate }} {{ v.model ? `- ${v.model}` : '' }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="report-menu">
        <button
          v-for="menu in reportMenuOptions"
          :key="menu.key"
          :class="['report-menu-btn', { active: activeReportMenu === menu.key }]"
          @click="activeReportMenu = menu.key"
        >
          {{ menu.label }}
        </button>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card" v-for="(kpi, index) in kpiData" :key="index" :style="{ animationDelay: `${index * 0.05}s` }">
          <div class="kpi-icon" :class="kpi.color">{{ kpi.icon }}</div>
          <div class="kpi-content">
            <span class="kpi-label">{{ kpi.label }}</span>
            <span class="kpi-value">{{ kpi.value }}</span>
          </div>
        </div>
      </div>

      <!-- Sections de rapports -->
      <div class="reports-sections">
        <!-- Assurances -->
        <section v-if="canViewVisitsInsuranceReports && activeReportMenu === 'visitsInsurance'" id="report-insurances" class="report-card">
          <div class="card-header">
            <h2>📄 {{ reportTitleWithPeriod('Assurances') }}</h2>
            <button class="btn-icon" @click="printSection('report-insurances', reportTitleWithPeriod('Assurances'))">
              <span>🖨️</span>
            </button>
          </div>
          <div class="card-content">
            <div v-if="insurancesMergedForDisplay.length" class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th>Police</th>
                    <th>Assureur</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Jours restants</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ins in insurancesMergedForDisplay" :key="ins.id">
                    <td><span class="vehicle-badge">{{ ins.vehicle?.plate }}</span></td>
                    <td>{{ ins.policyNo }}</td>
                    <td>{{ ins.insurer?.name }}</td>
                    <td>{{ formatDate(ins.startAt) }}</td>
                    <td>{{ formatDate(ins.endAt) }}</td>
                    <td>
                      <span :class="['badge', daysTo(ins.endAt) < 0 ? 'error' : (daysTo(ins.endAt) <= 30 ? 'warning' : 'success')]">
                        {{ daysTo(ins.endAt) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state" style="padding: 18px;">
              <p>Aucune assurance sur la période.</p>
            </div>
          </div>
        </section>

        <!-- Visites techniques -->
        <section v-if="canViewVisitsInsuranceReports && activeReportMenu === 'visitsInsurance'" id="report-inspections" class="report-card">
          <div class="card-header">
            <h2>🔧 {{ reportTitleWithPeriod('Visites techniques') }}</h2>
            <button class="btn-icon" @click="printSection('report-inspections', reportTitleWithPeriod('Visites techniques'))">
              <span>🖨️</span>
            </button>
          </div>
          <div class="card-content">
            <div v-if="inspectionsMergedForDisplay.length" class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th>Centre</th>
                    <th>Planifiée</th>
                    <th>Prochaine</th>
                    <th>Résultat</th>
                    <th>Jours restants</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="it in inspectionsMergedForDisplay" :key="it.id">
                    <td><span class="vehicle-badge">{{ vehiclePlate(it.vehicleId) }}</span></td>
                    <td>{{ it.center || '-' }}</td>
                    <td>{{ formatDate(it.scheduledAt) }}</td>
                    <td>{{ formatDate(getInspectionReferenceDate(it)) }}</td>
                    <td>
                      <span :class="['badge', it.result === 'FAVORABLE' ? 'success' : 'warning']">
                        {{ it.result || 'En attente' }}
                      </span>
                    </td>
                    <td>
                      <span :class="['badge', daysTo(getInspectionReferenceDate(it)) < 0 ? 'error' : (daysTo(getInspectionReferenceDate(it)) <= 30 ? 'warning' : 'success')]">
                        {{ daysTo(getInspectionReferenceDate(it)) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state" style="padding: 18px;">
              <p>Aucune visite sur la période.</p>
            </div>
          </div>
        </section>

        <!-- Activités station -->
        <section v-if="canViewStationReports && activeReportMenu === 'station'" id="report-station" class="report-card">
          <div class="card-header">
            <h2>⛽ {{ reportTitleWithPeriod('Activités station') }}</h2>
            <button class="btn-icon" @click="printSection('report-station', reportTitleWithPeriod('Activités station'))">
              <span>🖨️</span>
            </button>
          </div>
          <div class="card-content">
            <!-- Totaux -->
            <div class="totals-grid">
              <div class="total-card">
                <div class="total-icon supply">⛽</div>
                <div class="total-details">
                  <span class="total-label">Approvisionnements</span>
                  <span class="total-value">{{ stationSuppliesTotalVolume.toLocaleString() }} L</span>
                  <span class="total-amount">{{ formatMoney(stationSuppliesTotalAmount) }}</span>
                </div>
              </div>
              <div class="total-card">
                <div class="total-icon dispense">💰</div>
                <div class="total-details">
                  <span class="total-label">Ravitaillements</span>
                  <span class="total-value">{{ stationDispensesTotalVolume.toLocaleString() }} L</span>
                  <span class="total-amount">{{ formatMoney(stationDispensesTotalAmount) }}</span>
                </div>
              </div>
            </div>

            <!-- Synthèse journalière -->
            <h3 class="subsection-title">Synthèse journalière</h3>
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Jour</th>
                    <th class="text-right">Appro (L)</th>
                    <th class="text-right">Appro (FCFA)</th>
                    <th class="text-right">Ravit. (L)</th>
                    <th class="text-right">Ravit. (FCFA)</th>
                    <th class="text-right">Solde (L)</th>
                    <th class="text-right">Solde (FCFA)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="day in stationDailySummary" :key="day.date">
                    <td>{{ formatDate(day.date) }}</td>
                    <td class="text-right">{{ day.supplyVolume.toLocaleString() }}</td>
                    <td class="text-right">{{ formatMoney(day.supplyAmount) }}</td>
                    <td class="text-right">{{ day.dispenseVolume.toLocaleString() }}</td>
                    <td class="text-right">{{ formatMoney(day.dispenseAmount) }}</td>
                    <td class="text-right">{{ (day.supplyVolume - day.dispenseVolume).toLocaleString() }}</td>
                    <td class="text-right">{{ formatMoney(day.supplyAmount - day.dispenseAmount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Situation véhicules -->
        <section v-if="canViewConsumptionReports && activeReportMenu === 'consumption'" id="report-vehicles" class="report-card">
          <div class="card-header">
            <h2>🚛 {{ reportTitleWithPeriod('Situation véhicules') }}</h2>
            <button class="btn-icon" @click="printSection('report-vehicles', reportTitleWithPeriod('Situation véhicules'))">
              <span>🖨️</span>
            </button>
          </div>
          <div class="card-content">
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th class="text-right">Conso (L)</th>
                    <th class="text-right">L/100km</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in vehicleSituationRows" :key="row.vehicleId">
                    <td>
                      <span class="vehicle-plate">{{ row.plate }}</span>
                      <span class="vehicle-model">{{ row.model }}</span>
                    </td>
                    <td class="text-right">{{ row.totalLiters.toLocaleString() }}</td>
                    <td class="text-right">
                      <span v-if="row.consumptionPer100">{{ row.consumptionPer100.toFixed(1) }}</span>
                      <span v-else>-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-if="canViewVehicleReports && activeReportMenu === 'vehicle'" id="report-vehicle" class="report-card">
          <div class="card-header">
            <h2>🚗 {{ reportTitleWithPeriod('Rapport véhicule') }}</h2>
            <button class="btn-icon" @click="printSection('report-vehicle', reportTitleWithPeriod('Rapport véhicule'))">
              <span>🖨️</span>
            </button>
          </div>
          <div class="card-content">
            <div v-if="!selectedVehicleReport" class="empty-state">
              <span class="empty-icon">ℹ️</span>
              <p>Aucun véhicule en service trouvé.</p>
            </div>
            <div v-else class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th class="text-right">Kilométrage</th>
                    <th>Dernier ravitaillement</th>
                    <th>Assurance</th>
                    <th>Visite technique</th>
                    <th>Maintenance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ selectedVehicleLabel }}</td>
                    <td class="text-right">{{ Number(selectedVehicleOdometer || 0).toLocaleString() }} km</td>
                    <td>{{ selectedVehicleLastDispenseText }}</td>
                    <td>{{ selectedVehicleInsuranceText }}</td>
                    <td>{{ selectedVehicleInspectionText }}</td>
                    <td>{{ selectedVehicleMaintenanceText }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-if="canViewMaintenanceReports && activeReportMenu === 'maintenanceCost'" id="report-maintenance-cost" class="report-card">
          <div class="card-header">
            <h2>🛠️ {{ reportTitleWithPeriod('Maintenance et coûts') }}</h2>
            <button class="btn-icon" @click="printSection('report-maintenance-cost', reportTitleWithPeriod('Maintenance et coûts'))">
              <span>🖨️</span>
            </button>
          </div>
          <div class="card-content">
            <div class="totals-grid">
              <div class="total-card">
                <div class="total-icon dispense">💰</div>
                <div class="total-details">
                  <span class="total-label">Total maintenance</span>
                  <span class="total-value">{{ maintenanceDetailsForSelection.length }}</span>
                  <span class="total-amount">{{ formatMoney(maintenanceTotalCostForSelection) }}</span>
                </div>
              </div>
            </div>
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Véhicule</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Statut</th>
                    <th class="text-right">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in maintenanceDetailsForSelection" :key="m.id">
                    <td>{{ formatDate(m.dueAt || m.doneAt || m.createdAt) }}</td>
                    <td>{{ m.vehicle?.plate || vehiclePlate(m.vehicleId) }}</td>
                    <td>{{ m.maintenanceType || '-' }}</td>
                    <td>{{ m.description || '-' }}</td>
                    <td>{{ m.status || '-' }}</td>
                    <td class="text-right">{{ formatMoney(m.cost) }}</td>
                  </tr>
                  <tr v-if="!maintenanceDetailsForSelection.length">
                    <td colspan="6" class="empty-state">Aucune maintenance sur la période.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      <p class="print-generated-at" v-if="generatedAt">Imprimé le: {{ generatedAt }} par {{ printUserName }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watchEffect } from "vue";
import api from "../services/api";
import { useCompanyStore } from "../stores/company";
import { useAuthStore } from "../stores/auth";

// État
const loading = ref(false);
const fromDate = ref("");
const toDate = ref("");
const selectedStationId = ref("");
const selectedVehicleId = ref("");
const activeReportMenu = ref("vehicle");
const generatedAt = ref("");
const company = useCompanyStore();
const authStore = useAuthStore();
const viewportWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1200);
const isMobile = computed(() => viewportWidth.value <= 768);
const isDriver = computed(() => authStore.user?.role === "DRIVER");
const isDriverMobile = computed(() => isDriver.value && isMobile.value);
const assignedVehicleId = computed(() => String(authStore.user?.assignedVehicleId || ""));
const assignedStationId = computed(() => String(authStore.user?.assignedStationId || ""));
const role = computed(() => String(authStore.user?.role || "").trim().toUpperCase());
const isSuperAdmin = computed(() => role.value === "SUPER_ADMIN" || role.value === "ADMIN");
const isFleetManager = computed(() => role.value === "FLEET_MANAGER");
const isStationManager = computed(() => role.value === "STATION_MANAGER");
const isFuelManager = computed(() => role.value === "FUEL_MANAGER" || role.value === "FUEL_OPERATOR");

// Politique d'accès par rôle pour les menus/sections de rapports.
const canViewVehicleReports = computed(() => isSuperAdmin.value || isFleetManager.value);
const canViewConsumptionReports = computed(() => isSuperAdmin.value || isFleetManager.value);
const canViewVisitsInsuranceReports = computed(() => isSuperAdmin.value || isFleetManager.value);
const canViewMaintenanceReports = computed(() => isSuperAdmin.value || isFleetManager.value);
const canViewStationReports = computed(() => isSuperAdmin.value || isStationManager.value || isFuelManager.value);

const reportMenuOptions = computed(() => {
  // Menus visibles selon rôle métier.
  if (isSuperAdmin.value) {
    return [
      { key: "vehicle", label: "Véhicule" },
      { key: "consumption", label: "Consommation" },
      { key: "visitsInsurance", label: "Visites & Assurances" },
      { key: "maintenanceCost", label: "Maintenance & coûts" },
      { key: "station", label: "Station" },
    ];
  }
  if (isFleetManager.value) {
    return [
      { key: "vehicle", label: "Véhicule" },
      { key: "consumption", label: "Consommation" },
      { key: "visitsInsurance", label: "Visites & Assurances" },
      { key: "maintenanceCost", label: "Maintenance & coûts" },
    ];
  }
  if (isStationManager.value || isFuelManager.value) {
    return [{ key: "station", label: "Station" }];
  }
  return [{ key: "vehicle", label: "Véhicule" }];
});

// Données
const vehicles = ref([]);
const stations = ref([]);
const insurances = ref([]);
const inspections = ref([]);
const maintenances = ref([]);
const supplies = ref([]);
const dispenses = ref([]);

// KPIs
const kpiData = computed(() => {
  if (isStationManager.value || isFuelManager.value) {
    return [
      { icon: '⛽', color: 'green', label: 'Total appro', value: formatMoney(stationSuppliesTotalAmount.value) },
      { icon: '💰', color: 'purple', label: 'Total ravit.', value: formatMoney(stationDispensesTotalAmount.value) },
      { icon: '📊', color: 'blue', label: 'Solde volume', value: stationNetVolume.value.toLocaleString() + ' L' },
      { icon: '🧮', color: 'purple', label: 'Solde montant', value: formatMoney(stationNetAmount.value) },
    ];
  }

  if (isFleetManager.value) {
    return [
      { icon: '🚛', color: 'blue', label: 'Véhicules en service', value: inServiceVehicles.value.length },
      { icon: '⚠️', color: 'orange', label: 'Assurances expirées', value: expiredInsuranceLatest.value.length },
      { icon: '🔧', color: 'red', label: 'Visites expirées', value: expiredInspectionLatest.value.length },
      { icon: '🛠️', color: 'purple', label: 'Maintenances', value: maintenanceDetailsForSelection.value.length },
      { icon: '💵', color: 'green', label: 'Coût maintenance', value: formatMoney(maintenanceTotalCostForSelection.value) },
    ];
  }

  return [
    { icon: '🚛', color: 'blue', label: 'Véhicules en service', value: inServiceVehicles.value.length },
    { icon: '⚠️', color: 'orange', label: 'Assurances expirées', value: expiredInsuranceLatest.value.length },
    { icon: '🔧', color: 'red', label: 'Visites expirées', value: expiredInspectionLatest.value.length },
    { icon: '⛽', color: 'green', label: 'Total appro', value: formatMoney(stationSuppliesTotalAmount.value) },
    { icon: '💰', color: 'purple', label: 'Total ravit.', value: formatMoney(stationDispensesTotalAmount.value) },
    { icon: '📊', color: 'blue', label: 'Solde volume', value: stationNetVolume.value.toLocaleString() + ' L' },
    { icon: '🧮', color: 'purple', label: 'Solde montant', value: formatMoney(stationNetAmount.value) },
  ];
});

// Utilitaires
const parseList = (responseData) => {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.data?.items)) return responseData.data.items;
  if (Array.isArray(responseData?.data)) return responseData.data;
  return [];
};

const normalizeVehicleStatus = (status) => String(status || "").trim().toUpperCase();
const isVehicleInService = (v) => {
  const s = normalizeVehicleStatus(v?.status);
  return s === "EN_SERVICE" || s === "EN SERVICE" || s === "ACTIF" || s === "ACTIVE";
};

const inServiceVehicles = computed(() => vehicles.value.filter(isVehicleInService));
const inServiceSet = computed(() => new Set(inServiceVehicles.value.map((v) => String(v.id))));
const availableStationsForRole = computed(() => {
  // Un gestionnaire de station est limité strictement à sa station assignée.
  if (isStationManager.value && assignedStationId.value) {
    return stations.value.filter((s) => String(s.id) === assignedStationId.value);
  }
  return stations.value;
});
const stationScopeId = computed(() => {
  if (isStationManager.value && assignedStationId.value) return assignedStationId.value;
  return String(selectedStationId.value || "");
});
const selectedVehicleSet = computed(() => {
  // Sans sélection: on travaille sur tous les véhicules en service.
  if (!selectedVehicleId.value) return new Set(inServiceVehicles.value.map((v) => String(v.id)));
  return new Set([String(selectedVehicleId.value)]);
});

// Gestion des dates
const toDayDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

// Si l'utilisateur n'a pas choisi de période: on applique l'année courante par défaut.
const defaultFromDate = computed(() => {
  const now = new Date();
  return toDayDate(new Date(now.getFullYear(), 0, 1));
});
const defaultToDate = computed(() => toDayDate(new Date()));
const hasUserPeriod = computed(() => Boolean(fromDate.value || toDate.value));
const effectiveFromDate = computed(() => {
  const userFrom = toDayDate(fromDate.value);
  if (userFrom) return userFrom;
  return hasUserPeriod.value ? null : defaultFromDate.value;
});
const effectiveToDate = computed(() => {
  const userTo = toDayDate(toDate.value);
  if (userTo) return userTo;
  return hasUserPeriod.value ? null : defaultToDate.value;
});

const inRange = (value) => {
  const date = toDayDate(value);
  if (!date) return true;
  const from = effectiveFromDate.value;
  const to = effectiveToDate.value;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const daysTo = (value) => {
  const d = toDayDate(value);
  if (!d) return 9999;
  const now = toDayDate(new Date());
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

// Formatage
const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const formatMoney = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR").format(num) + " FCFA";
};

const getStatusClass = (date) => {
  const days = daysTo(date);
  if (days < 0) return 'error';
  if (days <= 30) return 'warning';
  return 'success';
};

const getStatusLabel = (date) => {
  const days = daysTo(date);
  if (days < 0) return `Expiré (${Math.abs(days)}j)`;
  if (days === 0) return 'Aujourd\'hui';
  if (days === 1) return 'Demain';
  return `${days} jours`;
};

const companyName = computed(() => company.settings?.name || "FLEETENERGY");
const getApiBaseUrl = () =>
  (import.meta.env.VITE_API_URL || "/api").replace(/\/api\/?$/, "");
const resolveCompanyLogoUrl = (logoUrl) => {
  if (!logoUrl) return "";
  if (String(logoUrl).startsWith("http") || String(logoUrl).startsWith("data:")) return logoUrl;
  if (String(logoUrl).startsWith("/")) return `${getApiBaseUrl()}${logoUrl}`;
  return `${getApiBaseUrl()}/${String(logoUrl).replace(/^\/+/, "")}`;
};
const companyLogoUrl = computed(() => resolveCompanyLogoUrl(company.settings?.logoUrl));
const printUserName = computed(() => authStore.user?.name || "Utilisateur");
// La période imprimée reflète soit le filtre utilisateur, soit la période annuelle par défaut.
const printPeriodLabel = computed(() => {
  if (!hasUserPeriod.value) {
    return `${formatDate(defaultFromDate.value)} → ${formatDate(defaultToDate.value)}`;
  }
  const from = fromDate.value ? formatDate(fromDate.value) : "début";
  const to = toDate.value ? formatDate(toDate.value) : "aujourd'hui";
  return `${from} → ${to}`;
});
const reportTitleWithPeriod = (baseTitle) =>
  printPeriodLabel.value ? `${baseTitle} (Période: ${printPeriodLabel.value})` : baseTitle;

// Assurances
const latestByVehicle = (items, dateGetter) => {
  // Garde une seule ligne "la plus récente" par véhicule (source pour statuts synthétiques).
  const map = new Map();
  for (const item of items) {
    const vehicleId = String(item.vehicleId || "");
    if (!vehicleId || !inServiceSet.value.has(vehicleId)) continue;
    const current = map.get(vehicleId);
    if (!current) {
      map.set(vehicleId, item);
      continue;
    }
    const dA = new Date(dateGetter(item) || 0).getTime();
    const dB = new Date(dateGetter(current) || 0).getTime();
    if (dA > dB) map.set(vehicleId, item);
  }
  return Array.from(map.values());
};

const insuranceLatestInService = computed(() =>
  latestByVehicle(insurances.value, (i) => i.endAt || i.startAt || i.createdAt)
);
const insuranceLatestScoped = computed(() =>
  insuranceLatestInService.value.filter((i) => selectedVehicleSet.value.has(String(i.vehicleId || "")))
);

const expiredInsuranceLatest = computed(() =>
  insuranceLatestScoped.value
    .filter((i) => inRange(i.endAt) && daysTo(i.endAt) < 0)
    .sort((a, b) => new Date(a.endAt) - new Date(b.endAt))
);
const ongoingInsuranceLatest = computed(() =>
  insuranceLatestScoped.value
    .filter((i) => {
      // "En cours" = non expirée; sans filtre explicite, on inclut aussi les échéances année suivante.
      const isOngoing = daysTo(i.endAt) >= 0;
      if (!isOngoing) return false;
      if (!hasUserPeriod.value) return true;
      return inRange(i.endAt);
    })
    .sort((a, b) => new Date(a.endAt || 0) - new Date(b.endAt || 0))
);
const insurancesMergedForDisplay = computed(() =>
  insuranceLatestScoped.value
    .filter((i) => {
      if (hasUserPeriod.value) return inRange(i.endAt);
      // Sans filtre utilisateur: inclure les assurances expirées dans l'année + toutes les assurances en cours.
      return inRange(i.endAt) || daysTo(i.endAt) >= 0;
    })
    .sort((a, b) => new Date(a.endAt || 0) - new Date(b.endAt || 0))
);

// Inspections
const getInspectionReferenceDate = (it) => it?.nextInspect || it?.scheduledAt || null;

const inspectionLatestInService = computed(() =>
  latestByVehicle(inspections.value, (i) => i.nextInspect || i.scheduledAt || i.createdAt)
);
const inspectionLatestScoped = computed(() =>
  inspectionLatestInService.value.filter((it) => selectedVehicleSet.value.has(String(it.vehicleId || "")))
);

const expiredInspectionLatest = computed(() =>
  inspectionLatestScoped.value
    .filter((it) => {
      const ref = getInspectionReferenceDate(it);
      return inRange(ref) && daysTo(ref) < 0;
    })
    .sort((a, b) => new Date(getInspectionReferenceDate(a)) - new Date(getInspectionReferenceDate(b)))
);
const ongoingInspectionLatest = computed(() =>
  inspectionLatestScoped.value
    .filter((it) => {
      const ref = getInspectionReferenceDate(it);
      // Même règle métier que les assurances pour l'affichage "en cours".
      const isOngoing = daysTo(ref) >= 0;
      if (!isOngoing) return false;
      if (!hasUserPeriod.value) return true;
      return inRange(ref);
    })
    .sort((a, b) => new Date(getInspectionReferenceDate(a) || 0) - new Date(getInspectionReferenceDate(b) || 0))
);
const inspectionsMergedForDisplay = computed(() =>
  inspectionLatestScoped.value
    .filter((it) => {
      const ref = getInspectionReferenceDate(it);
      if (hasUserPeriod.value) return inRange(ref);
      // Sans filtre utilisateur: inclure visites expirées dans l'année + toutes les visites en cours.
      return inRange(ref) || daysTo(ref) >= 0;
    })
    .sort((a, b) => new Date(getInspectionReferenceDate(a) || 0) - new Date(getInspectionReferenceDate(b) || 0))
);

const vehiclePlate = (vehicleId) =>
  vehicles.value.find((v) => String(v.id) === String(vehicleId))?.plate || "-";

const driverVehicle = computed(() =>
  vehicles.value.find((v) => String(v.id) === assignedVehicleId.value) || null
);
const driverDispenses = computed(() =>
  dispenses.value
    .filter((d) => String(d.vehicleId || d.vehicle?.id || "") === assignedVehicleId.value)
    .filter((d) => inRange(d.dispensedAt))
    .sort((a, b) => new Date(b.dispensedAt || 0) - new Date(a.dispensedAt || 0))
);
const driverTotalLiters = computed(() =>
  driverDispenses.value.reduce((sum, d) => sum + Number(d.liters || 0), 0)
);
const driverLatestInsurance = computed(() =>
  insurances.value
    .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId.value)
    .sort((a, b) => new Date(b.endAt || b.createdAt || 0) - new Date(a.endAt || a.createdAt || 0))[0] || null
);
const driverLatestInspection = computed(() =>
  inspections.value
    .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId.value)
    .sort((a, b) =>
      new Date((b.nextInspect || b.scheduledAt || b.createdAt || 0)) -
      new Date((a.nextInspect || a.scheduledAt || a.createdAt || 0))
    )[0] || null
);
const driverNextMaintenance = computed(() =>
  maintenances.value
    .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === assignedVehicleId.value)
    .filter((m) => m.status !== "DONE")
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0))[0] || null
);

// Station
const stationSupplies = computed(() =>
  supplies.value.filter((s) => {
    if (!inRange(s.deliveredAt)) return false;
    if (!stationScopeId.value) return true;
    return String(s.stationId || s.station?.id || "") === stationScopeId.value;
  })
);

const stationDispenses = computed(() =>
  dispenses.value.filter((d) => {
    if (!inRange(d.dispensedAt)) return false;
    if (!stationScopeId.value) return true;
    return String(d.stationId || d.station?.id || "") === stationScopeId.value;
  })
);

const stationSuppliesTotalVolume = computed(() =>
  stationSupplies.value.reduce((sum, s) => sum + Number(s.deliveredL || 0), 0)
);
const stationSuppliesTotalAmount = computed(() =>
  stationSupplies.value.reduce((sum, s) => sum + Number(s.deliveredL || 0) * Number(s.unitPrice || 0), 0)
);
const stationDispensesTotalVolume = computed(() =>
  stationDispenses.value.reduce((sum, d) => sum + Number(d.liters || 0), 0)
);
const stationDispensesTotalAmount = computed(() =>
  stationDispenses.value.reduce((sum, d) => sum + Number(d.liters || 0) * Number(d.unitPrice || 0), 0)
);
const stationNetVolume = computed(() => stationSuppliesTotalVolume.value - stationDispensesTotalVolume.value);
const stationNetAmount = computed(() => stationSuppliesTotalAmount.value - stationDispensesTotalAmount.value);

const stationDailySummary = computed(() => {
  const map = new Map();
  const ensure = (k) => {
    if (!map.has(k)) {
      map.set(k, {
        date: k,
        supplyVolume: 0,
        supplyAmount: 0,
        dispenseVolume: 0,
        dispenseAmount: 0,
      });
    }
    return map.get(k);
  };

  for (const s of stationSupplies.value) {
    const key = new Date(s.deliveredAt).toISOString().slice(0, 10);
    const row = ensure(key);
    row.supplyVolume += Number(s.deliveredL || 0);
    row.supplyAmount += Number(s.deliveredL || 0) * Number(s.unitPrice || 0);
  }

  for (const d of stationDispenses.value) {
    const key = new Date(d.dispensedAt).toISOString().slice(0, 10);
    const row = ensure(key);
    row.dispenseVolume += Number(d.liters || 0);
    row.dispenseAmount += Number(d.liters || 0) * Number(d.unitPrice || 0);
  }

  return Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
});

const selectedStationLabel = computed(() => {
  if (!stationScopeId.value) return "Toutes les stations";
  return stations.value.find((s) => String(s.id) === stationScopeId.value)?.name || "Station inconnue";
});
const selectedVehicleLabel = computed(() => {
  if (!selectedVehicleId.value) return "Tous les véhicules";
  const v = inServiceVehicles.value.find((it) => String(it.id) === String(selectedVehicleId.value));
  return v ? `${v.plate}${v.model ? ` - ${v.model}` : ""}` : "Véhicule inconnu";
});

const selectedPeriodLabel = computed(() => {
  if (!hasUserPeriod.value) {
    return `${formatDate(defaultFromDate.value)} → ${formatDate(defaultToDate.value)}`;
  }
  const from = fromDate.value ? formatDate(fromDate.value) : "début";
  const to = toDate.value ? formatDate(toDate.value) : "aujourd'hui";
  return `${from} → ${to}`;
});

const selectedVehicleReportId = computed(() =>
  String(selectedVehicleId.value || inServiceVehicles.value[0]?.id || "")
);

const maintenanceDetailsForSelection = computed(() =>
  maintenances.value
    .filter((m) => selectedVehicleSet.value.has(String(m.vehicleId || m.vehicle?.id || "")))
    .filter((m) => inRange(m.dueAt || m.doneAt || m.createdAt))
    .sort((a, b) => new Date(b.dueAt || b.doneAt || b.createdAt || 0) - new Date(a.dueAt || a.doneAt || a.createdAt || 0))
);

const maintenanceTotalCostForSelection = computed(() =>
  maintenanceDetailsForSelection.value.reduce((sum, m) => sum + Number(m.cost || 0), 0)
);

const selectedVehicleObj = computed(() =>
  inServiceVehicles.value.find((it) => String(it.id) === selectedVehicleReportId.value)
);
const selectedVehicleOdometer = computed(() => selectedVehicleObj.value?.odometerKm || 0);
const selectedVehicleReport = computed(() => selectedVehicleObj.value || null);

const selectedVehicleLastDispense = computed(() =>
  dispenses.value
    .filter((d) => String(d.vehicleId || d.vehicle?.id || "") === selectedVehicleReportId.value)
    .filter((d) => inRange(d.dispensedAt))
    .sort((a, b) => new Date(b.dispensedAt || 0) - new Date(a.dispensedAt || 0))[0] || null
);
const selectedVehicleLatestInsurance = computed(() =>
  insurances.value
    .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === selectedVehicleReportId.value)
    .sort((a, b) => new Date(b.endAt || b.createdAt || 0) - new Date(a.endAt || a.createdAt || 0))[0] || null
);
const selectedVehicleLatestInspection = computed(() =>
  inspections.value
    .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === selectedVehicleReportId.value)
    .sort((a, b) => new Date((b.nextInspect || b.scheduledAt || b.createdAt || 0)) - new Date((a.nextInspect || a.scheduledAt || a.createdAt || 0)))[0] || null
);
const selectedVehicleNextMaintenance = computed(() =>
  maintenances.value
    .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === selectedVehicleReportId.value)
    .filter((m) => m.status !== "DONE")
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0))[0] || null
);

const selectedVehicleLastDispenseText = computed(() => {
  const d = selectedVehicleLastDispense.value;
  if (!d) return "-";
  return `${formatDate(d.dispensedAt)} | ${Number(d.liters || 0).toLocaleString()} L`;
});
const selectedVehicleInsuranceText = computed(() => {
  const i = selectedVehicleLatestInsurance.value;
  if (!i?.endAt) return "-";
  const days = daysTo(i.endAt);
  return `${formatDate(i.endAt)} (${days < 0 ? `Expirée ${Math.abs(days)}j` : `${days}j`})`;
});
const selectedVehicleInspectionText = computed(() => {
  const i = selectedVehicleLatestInspection.value;
  const ref = getInspectionReferenceDate(i);
  if (!ref) return "-";
  const days = daysTo(ref);
  return `${formatDate(ref)} (${days < 0 ? `Retard ${Math.abs(days)}j` : `${days}j`})`;
});
const selectedVehicleMaintenanceText = computed(() => {
  const m = selectedVehicleNextMaintenance.value;
  if (!m) return "-";
  return `${m.maintenanceType || "ENTRETIEN"} - ${formatDate(m.dueAt || m.doneAt || m.createdAt)}`;
});

const vehicleSituationRows = computed(() => {
  // Agrégation consommation + maintenance par véhicule pour le rapport "Consommation".
  const byVehicle = inServiceVehicles.value.filter((v) => selectedVehicleSet.value.has(String(v.id)));
  return byVehicle.map((v) => {
    const vehicleId = String(v.id);
    const vDispenses = dispenses.value
      .filter((d) => String(d.vehicleId || d.vehicle?.id || "") === vehicleId)
      .filter((d) => inRange(d.dispensedAt))
      .sort((a, b) => new Date(a.dispensedAt || 0) - new Date(b.dispensedAt || 0));

    const totalLiters = vDispenses.reduce((sum, d) => sum + Number(d.liters || 0), 0);
    let consumptionPer100 = null;
    if (vDispenses.length >= 2) {
      const first = Number(vDispenses[0].odometerKm || 0);
      const last = Number(vDispenses[vDispenses.length - 1].odometerKm || 0);
      const distance = Math.max(0, last - first);
      const litersForCalc = vDispenses.slice(1).reduce((sum, d) => sum + Number(d.liters || 0), 0);
      if (distance > 0 && litersForCalc > 0) {
        consumptionPer100 = (litersForCalc * 100) / distance;
      }
    }

    const vMaintenances = maintenances.value
      .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === vehicleId)
      .filter((m) => inRange(m.dueAt || m.doneAt || m.createdAt));
    const maintenanceCount = vMaintenances.length;
    const maintenanceCost = vMaintenances.reduce((sum, m) => sum + Number(m.cost || 0), 0);

    const insurance = insuranceLatestScoped.value.find((i) => String(i.vehicleId || "") === vehicleId) || null;
    const inspection = inspectionLatestScoped.value.find((it) => String(it.vehicleId || "") === vehicleId) || null;
    const insuranceEndAt = insurance?.endAt || null;
    const inspectionDate = getInspectionReferenceDate(inspection);

    return {
      vehicleId,
      plate: v.plate,
      model: v.model,
      totalLiters,
      consumptionPer100,
      maintenanceCount,
      maintenanceCost,
      insuranceEndAt,
      insuranceDays: insuranceEndAt ? daysTo(insuranceEndAt) : null,
      inspectionDate,
      inspectionDays: inspectionDate ? daysTo(inspectionDate) : null,
    };
  });
});

// Chargement
const loadAll = async () => {
  loading.value = true;
  generatedAt.value = new Date().toLocaleString("fr-FR");
  try {
    // allSettled permet d'afficher le reste même si un endpoint est refusé (ex: selon rôle).
    const [v, st, i, insp, m, s, d] = await Promise.allSettled([
      api.get("/vehicles"),
      api.get("/stations"),
      api.get("/insurance"),
      api.get("/inspections?type=VISITE_TECHNIQUE"),
      api.get("/maintenance"),
      api.get("/fuel/supplies"),
      api.get("/fuel/dispenses"),
    ]);

    vehicles.value = v.status === "fulfilled" ? parseList(v.value.data) : [];
    stations.value = st.status === "fulfilled" ? parseList(st.value.data) : [];
    insurances.value = i.status === "fulfilled" ? parseList(i.value.data) : [];
    inspections.value = insp.status === "fulfilled" ? parseList(insp.value.data) : [];
    maintenances.value = m.status === "fulfilled" ? parseList(m.value.data) : [];
    supplies.value = s.status === "fulfilled" ? parseList(s.value.data) : [];
    dispenses.value = d.status === "fulfilled" ? parseList(d.value.data) : [];

    // Si stations est interdit/non dispo, reconstruire une liste minimale à partir des données reçues.
    if (!stations.value.length) {
      const stationMap = new Map();
      for (const item of [...supplies.value, ...dispenses.value]) {
        const stItem = item?.station;
        const sid = String(item?.stationId || stItem?.id || "");
        if (!sid) continue;
        if (!stationMap.has(sid)) {
          stationMap.set(sid, {
            id: sid,
            name: stItem?.name || `Station ${sid.slice(0, 6)}`,
          });
        }
      }
      stations.value = Array.from(stationMap.values());
    }
  } catch (error) {
    console.error("Erreur chargement:", error);
  } finally {
    loading.value = false;
  }
};

// Impression
const printAll = () => {
  // Impression complète de la vue active avec en-tête entreprise.
  generatedAt.value = new Date().toLocaleString("fr-FR");
  window.print();
};

const printSection = (sectionId, title) => {
  generatedAt.value = new Date().toLocaleString("fr-FR");
  const element = document.getElementById(sectionId);
  if (!element) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const styles = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules || [])
          .map((rule) => rule.cssText)
          .join("");
      } catch {
        return "";
      }
    })
    .join("");

  const titleWithPeriod = title;
  // On injecte logo + entête métier dans la fenêtre d'impression.
  const logoBlock = companyLogoUrl.value
    ? `<img src="${companyLogoUrl.value}" alt="Logo entreprise" style="height:56px;max-width:180px;object-fit:contain;" />`
    : "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${titleWithPeriod} - ${companyName.value}</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 24px;
            color: #111827;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          img {
            filter: none !important;
            -webkit-filter: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-head { display:flex; align-items:center; gap:16px; margin:0 0 14px; }
          h1 { font-size: 24px; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th { background: #f3f4f6; padding: 10px; text-align: left; border: 1px solid #e5e7eb; }
          td { padding: 8px 10px; border: 1px solid #e5e7eb; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
          .badge.error { background: #fee2e2; color: #991b1b; }
          .badge.success { background: #dcfce7; color: #166534; }
          .badge.warning { background: #fef3c7; color: #92400e; }
          .text-right { text-align: right; }
          .btn, .btn-icon, .header-actions { display: none !important; }
        </style>
      </head>
      <body>
        <div class="print-head">
          ${logoBlock}
          <div>
            <h1>${companyName.value}</h1>
          </div>
        </div>
        ${element.outerHTML}
        <p style="margin-top:12px;font-size:11px;color:#6b7280;">Imprimé le: ${generatedAt.value} par ${printUserName.value}</p>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

const handleResize = () => {
  viewportWidth.value = window.innerWidth;
};

watchEffect(() => {
  // Force un onglet valide si le rôle ne permet pas l'onglet courant.
  const allowedMenus = reportMenuOptions.value.map((m) => m.key);
  if (allowedMenus.length && !allowedMenus.includes(activeReportMenu.value)) {
    activeReportMenu.value = allowedMenus[0];
  }

  // Un gestionnaire station reste verrouillé sur sa station, même après refresh.
  if (isStationManager.value) {
    if (assignedStationId.value) selectedStationId.value = assignedStationId.value;
    else selectedStationId.value = "";
  }
});

onMounted(() => {
  loadAll();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.reports {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  background: #f8fafc;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ==================== VERSION CHAUFFEUR MOBILE ==================== */
.driver-view {
  padding: 0;
  background: #f3f4f6;
}

.driver-container {
  max-width: 480px;
  margin: 0 auto;
  padding: 20px;
}

.driver-header {
  margin-bottom: 24px;
}

.driver-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.driver-header-top h1 {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.driver-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.driver-vehicle-card {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 16px;
  padding: 20px;
  color: white;
  margin-bottom: 24px;
  box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);
}

.driver-vehicle-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.driver-vehicle-icon {
  font-size: 32px;
  background: rgba(255, 255, 255, 0.2);
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.driver-vehicle-info {
  flex: 1;
}

.driver-vehicle-label {
  display: block;
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.driver-vehicle-plate {
  display: block;
  font-size: 20px;
  font-weight: 700;
}

.driver-vehicle-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
}

.driver-stat {
  text-align: center;
}

.driver-stat-label {
  display: block;
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.driver-stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
}

.driver-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.driver-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-left: 4px solid transparent;
}

.driver-card.success { border-left-color: #10b981; }
.driver-card.warning { border-left-color: #f59e0b; }
.driver-card.error { border-left-color: #ef4444; }

.driver-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.driver-card-icon {
  font-size: 20px;
}

.driver-card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.driver-card-content p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.driver-card-label {
  font-size: 13px;
  color: #6b7280;
}

.driver-card-date {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.driver-card-desc {
  font-size: 13px;
  color: #4b5563;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 12px;
}

.driver-card-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 500;
}

.driver-card-badge.success { background: #dcfce7; color: #166534; }
.driver-card-badge.warning { background: #fef3c7; color: #92400e; }
.driver-card-badge.error { background: #fee2e2; color: #b91c1c; }

.driver-history {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.driver-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.driver-history-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.driver-history-count {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 10px;
  border-radius: 20px;
}

.driver-history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.driver-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.driver-history-item:last-child {
  border-bottom: none;
}

.driver-history-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.driver-history-date {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.driver-history-station {
  font-size: 12px;
  color: #6b7280;
}

.driver-history-right {
  text-align: right;
}

.driver-history-liters {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.driver-history-amount {
  display: block;
  font-size: 12px;
  color: #10b981;
}

.driver-empty {
  color: #9ca3af;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

/* ==================== VERSION DESKTOP ==================== */
.print-header {
  display: none;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e5e7eb;
}

.print-branding {
  display: flex;
  align-items: center;
  gap: 14px;
}

.print-logo {
  height: 56px;
  max-width: 180px;
  object-fit: contain;
  filter: none !important;
  -webkit-filter: none !important;
}

.print-branding-text {
  display: flex;
  flex-direction: column;
}

.print-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}

.print-header p {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}

.print-meta {
  margin-top: 6px !important;
}

/* Header */
.reports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.text-muted {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Boutons */
.btn {
  padding: 0 20px;
  height: 42px;
  border-radius: 10px;
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
  background: #2563eb;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
}

.btn-outline {
  background: white;
  border-color: #e5e7eb;
  color: #374151;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
  transform: scale(1.05);
}

/* Filtres */
.filters-panel {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.report-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 18px;
}

.report-menu-btn {
  border: 1px solid #dbe3ef;
  background: #fff;
  color: #334155;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.report-menu-btn.active {
  background: #1d4ed8;
  color: #fff;
  border-color: #1d4ed8;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-item label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.filter-input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.2s;
}

.filter-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

/* KPIs */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.kpi-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid #e5e7eb;
  transition: all 0.3s;
  animation: slideInUp 0.5s ease-out forwards;
  opacity: 0;
  transform: translateY(10px);
}

@keyframes slideInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  border-color: #2563eb;
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

.kpi-icon.blue { background: #dbeafe; color: #1e40af; }
.kpi-icon.orange { background: #ffedd5; color: #9a3412; }
.kpi-icon.red { background: #fee2e2; color: #991b1b; }
.kpi-icon.green { background: #dcfce7; color: #166534; }
.kpi-icon.purple { background: #f3e8ff; color: #6b21a8; }

.kpi-content {
  flex: 1;
}

.kpi-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.kpi-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

/* Sections de rapports */
.reports-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.report-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.card-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-content {
  padding: 24px;
}

.subsection-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 24px 0 16px;
}

.subsection-title:first-of-type {
  margin-top: 0;
}

/* Tableaux */
.table-responsive {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

th {
  text-align: left;
  padding: 14px 16px;
  background: #f9fafb;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  color: #1f2937;
}

tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: #f9fafb;
}

.text-right {
  text-align: right;
}

/* Badges et status */
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.badge.success {
  background: #dcfce7;
  color: #166534;
}

.badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.badge.error {
  background: #fee2e2;
  color: #b91c1c;
}

.vehicle-badge {
  background: #f3f4f6;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
}

.vehicle-plate {
  display: block;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.vehicle-model {
  display: block;
  font-size: 12px;
  color: #6b7280;
}

.status-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-cell .badge {
  align-self: flex-start;
}

/* Totaux */
.totals-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.total-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s;
}

.total-card:hover {
  background: white;
  border-color: #2563eb;
  transform: translateY(-2px);
}

.total-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.total-icon.supply {
  background: #dcfce7;
  color: #166534;
}

.total-icon.dispense {
  background: #dbeafe;
  color: #1e40af;
}

.total-details {
  flex: 1;
}

.total-label {
  display: block;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.total-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.total-amount {
  display: block;
  font-size: 14px;
  color: #4b5563;
}

/* États vides */
.empty-state {
  text-align: center;
  padding: 48px;
  color: #9ca3af;
}

.empty-icon {
  display: block;
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
}

.print-generated-at {
  display: none;
}

/* Impression */
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-logo,
  img {
    filter: none !important;
    -webkit-filter: none !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-generated-at {
    display: block !important;
    margin-top: 8px;
    font-size: 11px;
    color: #6b7280;
    text-align: right;
  }

  .print-header {
    display: block;
  }

  .reports-header,
  .filters-panel,
  .btn,
  .btn-icon,
  .header-actions {
    display: none !important;
  }

  .reports {
    padding: 0;
    background: white;
  }

  .report-card {
    break-inside: avoid;
    border: 1px solid #e5e7eb;
    margin-bottom: 20px;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }

  .kpi-card {
    break-inside: avoid;
    border: 1px solid #e5e7eb;
    padding: 12px;
  }

  .kpi-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }

  .kpi-value {
    font-size: 16px;
  }

  th {
    background: #f3f4f6 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .badge {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

/* Responsive */
@media (max-width: 1200px) {
  .kpi-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1024px) {
  .filters-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .kpi-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .reports {
    padding: 16px;
  }

  .reports-header {
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

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .totals-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .card-header .btn-icon {
    align-self: flex-end;
  }
}
</style>

<template>
  <div class="dashboard-container">
    <!-- Notifications Toast -->
    <div class="toast-container">
      <div v-for="notification in notifications" :key="notification.id" 
           :class="['toast', `toast-${notification.type}`]">
        {{ notification.message }}
        <button @click="removeNotification(notification.id)" class="toast-close">×</button>
      </div>
    </div>

    <!-- Skeleton Loader -->
    <template v-if="loading && !dataLoaded">
      <div class="skeleton-header">
        <div class="skeleton-title"></div>
        <div class="skeleton-subtitle"></div>
      </div>
      <div class="skeleton-grid">
        <div v-for="i in 4" :key="i" class="skeleton-kpi"></div>
      </div>
      <div class="skeleton-charts">
        <div class="skeleton-chart-large"></div>
        <div class="skeleton-chart-medium"></div>
      </div>
    </template>

    <!-- Contenu principal -->
    <template v-else>
      <header class="dashboard-header">
        <div>
          <h1 class="title">Tableau de Bord Flotte</h1>
          <p class="subtitle">Analyse au {{ today }}</p>
        </div>
        <div class="header-actions">
          <button @click="refreshData" class="refresh-btn" :class="{ rotating: loading }"
                  :aria-label="loading ? 'Actualisation en cours' : 'Actualiser les données'"
                  :aria-busy="loading">
            {{ loading ? '⌛' : '🔄' }} Actualiser
          </button>
        </div>
      </header>

      <!-- Banner d'erreur -->
      <div v-if="error" class="error-banner glass">
        ⚠️ {{ error }} 
        <button @click="refreshData" class="retry-btn">Réessayer</button>
      </div>

      <!-- KPI Grid -->
      <div v-if="!isStationManager" class="kpi-grid">
        <div class="kpi-card glass blue">
          <div class="kpi-icon">🚚</div>
          <div class="kpi-content">
            <span class="label">Véhicules</span>
            <h3 class="value">{{ dashboardData?.kpis?.vehicles || 0 }}</h3>
            <div class="kpi-subtext">{{ activeVehiclesCount }} en service</div>
          </div>
        </div>
        <div v-if="!isFleetManager" class="kpi-card glass green">
          <div class="kpi-icon">⛽</div>
          <div class="kpi-content">
            <span class="label">Stations</span>
            <h3 class="value">{{ dashboardData?.kpis?.stations || 0 }}</h3>
            <div class="kpi-subtext">{{ tanks.length }} cuves</div>
          </div>
        </div>
        <div class="kpi-card glass orange">
          <div class="kpi-icon">🛠️</div>
          <div class="kpi-content">
            <span class="label">Entretiens</span>
            <h3 class="value">{{ dashboardData?.kpis?.maintPlanned || 0 }}</h3>
            <div class="kpi-subtext">{{ urgentMaintenances.length }} urgents</div>
          </div>
        </div>
        <div class="kpi-card glass red">
          <div class="kpi-icon">📅</div>
          <div class="kpi-content">
            <span class="label">Assurances</span>
            <h3 class="value">{{ expiringInsurances.length }}</h3>
            <div class="kpi-subtext">{{ expiringInsurances.length }} ass. expirent</div>
          </div>
        </div>
 <!-- NOUVEAU KPI VISITES TECHNIQUES expirer -->
        <div class="kpi-card glass red">
  <div class="kpi-icon">🔧</div>
  <div class="kpi-content">
    <span class="label">Visites techniques</span>
    <h3 class="value">{{ criticalInspections.length }}</h3>
    <div class="kpi-subtext">{{ expiredInspections.length }} en retard</div>
    <div class="kpi-subtext">{{ urgentInspections.length }} urgents</div>
  </div>
        </div>
      </div>

      <div v-else class="kpi-grid">
        <div class="kpi-card glass green">
          <div class="kpi-icon">⛽</div>
          <div class="kpi-content">
            <span class="label">Stations</span>
            <h3 class="value">{{ dashboardData?.kpis?.stations || 0 }}</h3>
            <div class="kpi-subtext">{{ tanks.length }} cuves suivies</div>
          </div>
        </div>
        <div class="kpi-card glass blue">
          <div class="kpi-icon">📦</div>
          <div class="kpi-content">
            <span class="label">Approvisionnements</span>
            <h3 class="value">{{ supplies.length }}</h3>
            <div class="kpi-subtext">Derniers mouvements</div>
          </div>
        </div>
        <div class="kpi-card glass orange">
          <div class="kpi-icon">🚚</div>
          <div class="kpi-content">
            <span class="label">Ravitaillements</span>
            <h3 class="value">{{ dispenses.length }}</h3>
            <div class="kpi-subtext">Derniers mouvements</div>
          </div>
        </div>
        <div class="kpi-card glass red">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-content">
            <span class="label">Alertes Stock</span>
            <h3 class="value">{{ criticalTanksCount }}</h3>
            <div class="kpi-subtext">{{ ruptureSoonCount }} ruptures <= 7j</div>
          </div>
        </div>
      </div>

      <template v-if="isStationManager">
        <h2 class="section-title">📋 Activités station</h2>
        <div class="charts-grid">
          <div class="card glass-white">
            <h3>Approvisionnements récents</h3>
            <div class="scroll-box-maintenance">
              <table class="glass-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station</th>
                    <th>Cuve</th>
                    <th>Fournisseur</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in supplies.slice(0, 10)" :key="s.id">
                    <td>{{ formatDate(s.deliveredAt) }}</td>
                    <td>{{ s.station?.name || "—" }}</td>
                    <td>{{ s.tank?.name || s.tank?.fuelType || "—" }}</td>
                    <td>{{ s.supplier || "—" }}</td>
                    <td>{{ (s.deliveredL || 0).toLocaleString() }} L</td>
                  </tr>
                  <tr v-if="!supplies.length">
                    <td colspan="5" class="empty">Aucun approvisionnement.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card glass-white">
            <h3>Ravitaillements récents</h3>
            <div class="scroll-box-maintenance">
              <table class="glass-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station</th>
                    <th>Véhicule</th>
                    <th>Cuve</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in dispenses.slice(0, 10)" :key="d.id">
                    <td>{{ formatDate(d.dispensedAt) }}</td>
                    <td>{{ d.station?.name || "—" }}</td>
                    <td>{{ d.vehicle?.plate || "—" }}</td>
                    <td>{{ d.tank?.name || d.tank?.fuelType || "—" }}</td>
                    <td>{{ (d.liters || 0).toLocaleString() }} L</td>
                  </tr>
                  <tr v-if="!dispenses.length">
                    <td colspan="5" class="empty">Aucun ravitaillement.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <h2 class="section-title">🚨 Alertes de rupture</h2>
        <div class="card glass-white">
          <div class="scroll-box-maintenance">
            <table class="glass-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Cuve</th>
                  <th>Stock</th>
                  <th>Alerte bas</th>
                  <th>Rupture estimée</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in stationRuptureAlerts" :key="row.tank.id" :class="row.estimate.daysLeft <= 7 ? 'row-urgent' : 'row-warning'">
                  <td>{{ row.tank.station?.name || "—" }}</td>
                  <td>{{ row.tank.name || row.tank.fuelType || "—" }}</td>
                  <td>{{ (row.tank.currentL || 0).toLocaleString() }} L</td>
                  <td>{{ (row.tank.lowAlertL || 0).toLocaleString() }} L</td>
                  <td>Dans {{ row.estimate.daysLeft }}j ({{ formatDate(row.estimate.date) }})</td>
                </tr>
                <tr v-if="!stationRuptureAlerts.length">
                  <td colspan="5" class="empty">Aucune rupture imminente détectée.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <template v-if="!isStationManager">
      <!-- Charts Grid -->
      <div class="charts-grid mt-20">
        <div class="card glass-white chart-card">
          <h3>📊 Consommation par Véhicule (L/100km)</h3>
          <div class="chart-container">
            <Bar v-if="consumptionChartData.labels.length > 0" 
                 :data="consumptionChartData" 
                 :options="consumptionChartOptions" />
            <div v-else class="no-chart-data">
              <div class="no-data-icon">📊</div>
              <p>Aucune donnée de consommation disponible</p>
            </div>
          </div>
        </div>

        <div class="card glass-white chart-card">
          <h3>💰 Coûts des Derniers Entretiens</h3>
          <div class="chart-container">
            <Bar v-if="maintenanceChartData.labels.length > 0" 
                 :data="maintenanceChartData" 
                 :options="maintenanceChartOptions" />
            <div v-else class="no-chart-data">
              <div class="no-data-icon">💰</div>
              <p>Aucun coût d'entretien enregistré</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Alertes et Planning -->
      <h2 class="section-title">🚨 Alertes et Planning</h2>
      <div class="card glass-white planning-section">
        <div class="header-flex">
          <h3>📅 Événements à venir</h3>
          <div class="view-toggle">
            <button @click="activePlanningTab = 'maintenance'" 
                    :class="{ active: activePlanningTab === 'maintenance' }">
              Entretiens ({{ upcomingMaintenances.length }})
            </button>
            <button @click="activePlanningTab = 'inspections'" 
                    :class="{ active: activePlanningTab === 'inspections' }">
              Visites ({{ upcomingInspections.length }})
            </button>
            <button @click="activePlanningTab = 'insurances'" 
                    :class="{ active: activePlanningTab === 'insurances' }">
              Assurances ({{ expiringInsurances.length }})
            </button>
          </div>
        </div>
        
        <!-- Tab Content -->
        <div class="tab-content">
          <!-- MAINTENANCE TAB -->
          <div v-if="activePlanningTab === 'maintenance'" class="scroll-box-maintenance">
            <table class="glass-table" role="table">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Type</th>
                  <th>Échéance</th>
                  <th>Coût estimé</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in upcomingMaintenances" :key="m.id" 
                    :class="getMaintenanceRowClass(m)">
                  <td>
                    <div class="vehicle-info">
                      <div class="vehicle-icon">🚛</div>
                      <div>
                        <strong>{{ m.vehicle?.plate || 'N/A' }}</strong>
                        <div class="vehicle-model">{{ truncateText(m.description, 30) }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span :class="['maintenance-type', m.maintenanceType?.toLowerCase()]">
                      {{ getMaintenanceTypeLabel(m.maintenanceType) }}
                    </span>
                  </td>
                  <td>
                    <div class="date-cell">
                      {{ formatDate(m.dueAt) }}
                      <div class="date-diff">
                        {{ getDaysDiffLabel(m.dueAt) }}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="cost-badge">
                      {{ formatCurrency(m.cost) }}
                    </span>
                  </td>
                  <td>
                    <span :class="['status-pill', getMaintenanceStatus(m)]">
                      {{ getMaintenanceStatusLabel(m) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="upcomingMaintenances.length === 0" class="no-data">
              <div class="no-data-icon">🛠️</div>
              <p>Aucun entretien planifié</p>
            </div>
          </div>

          <!-- INSPECTIONS TAB -->
          <div v-if="activePlanningTab === 'inspections'" class="scroll-box-maintenance">
            <table class="glass-table" role="table">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Type</th>
                  <th>Échéance</th>
                  <th>Centre</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="i in upcomingInspections" :key="i.id"
                    :class="getInspectionRowClass(i)">
                  <td>
                    <div class="vehicle-info">
                      <div class="vehicle-icon">📋</div>
                      <div>
                        <strong>{{ i.vehicle?.plate || 'N/A' }}</strong>
                        <div class="vehicle-model">{{ truncateText(i.type, 25) }}</div>
                      </div>
                    </div>
                  </td>
                  <td>{{ getInspectionTypeLabel(i.type) }}</td>
                  <td>
                    <div class="date-cell">
                        {{ formatDate(getInspectionDueDate(i)) }}
                      <div class="date-diff">
                        {{ getDaysDiffLabel(getInspectionDueDate(i)) }}
                      </div>
                    </div>
                  </td>
                  <td>{{ truncateText(i.center, 20) || '—' }}</td>
                  <td>
                    <span :class="['status-pill', getInspectionStatus(i)]">
                      {{ getInspectionStatusLabel(i) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="upcomingInspections.length === 0" class="no-data">
              <div class="no-data-icon">📋</div>
              <p>Aucune visite technique planifiée</p>
            </div>
          </div>

          <!-- INSURANCES TAB - CORRECTION ICI -->
          <div v-if="activePlanningTab === 'insurances'" class="scroll-box-maintenance">
            <table class="glass-table" role="table">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Assureur</th>
                  <th>Numéro police</th>
                  <th>Expiration</th>
                  <th>Prime</th>
                  <th>Jours restants</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ins in expiringInsurances" :key="ins.id"
                    :class="getInsuranceRowClass(ins)">
                  <td>
                    <div class="vehicle-info">
                      <div class="vehicle-icon">🛡️</div>
                      <div>
                        <strong>{{ ins.vehicle?.plate || 'N/A' }}</strong>
                        <div class="vehicle-model">{{ ins.vehicle?.model || '—' }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="insurer-name">
                      {{ ins.insurer?.name || truncateText(ins.insurerName, 20) || 'Non spécifié' }}
                    </span>
                  </td>
                  <td>
                    <span class="policy-number" :title="ins.policyNo">
                      {{ ins.policyNo ? truncateText(ins.policyNo, 12) : '—' }}
                    </span>
                  </td>
                  <td>
                    <div class="date-cell">
                      {{ formatDate(ins.endAt) }}
                      <div class="date-diff">
                        {{ getDaysDiffLabel(ins.endAt) }}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="premium-badge">
                      {{ formatCurrency(ins.premium) }}
                    </span>
                  </td>
                  <td>
                    <span :class="['days-badge', getInsuranceDaysClass(ins)]">
                      {{ getDaysDiff(ins.endAt) > 0 ? getDaysDiff(ins.endAt) : 'Expirée' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="expiringInsurances.length === 0" class="no-data">
              <div class="no-data-icon">🛡️</div>
              <p>Toutes les assurances sont à jour</p>
              <p class="no-data-subtext">Aucune assurance n'expire dans les 60 prochains jours</p>
            </div>
          </div>
        </div>
      </div>

      <!-- État de la flotte -->
      <h2 class="section-title">🚛 État de la Flotte</h2>
      <div class="card glass-white fleet-section">
        <div class="fleet-filters">
          <button @click="setFleetFilter('all')" :class="{ active: fleetFilter === 'all' }">
            Tous ({{ fleetVisibleCount }})
          </button>
          <button @click="setFleetFilter('high')" :class="{ active: fleetFilter === 'high' }">
            Haute conso ({{ highConsumptionCount }})
          </button>
          <button @click="setFleetFilter('low')" :class="{ active: fleetFilter === 'low' }">
            Basse conso ({{ lowConsumptionCount }})
          </button>
        </div>

        <div v-if="repairingVehicles.length > 0" class="repair-alert">
          ⚠️ {{ repairingVehicles.length }} véhicule(s) en réparation: 
          {{ repairingVehicles.map(v => v.plate).join(', ') }}
        </div>

        <div class="scroll-box-maintenance">
          <table class="glass-table" role="table">
            <thead>
              <tr>
                <th>Plaque</th>
                <th>Modèle</th>
                <th>Km</th>
                <th>Conso.</th>
                <th>Dernier ravit.</th>
                <th>Qté dernière</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in filteredFleet" :key="v.id" 
                  @click="selectVehicle(v)" 
                  class="clickable-row">
                <td><span :class="['plate-tag', { repair: isVehicleInRepair(v) }]">{{ v.plate }}</span></td>
                <td>
                  <div class="vehicle-model-cell">
                    <span class="vehicle-icon-small">🚚</span>
                    <strong>{{ v.model || 'Non spécifié' }}</strong>
                    <span v-if="isVehicleInRepair(v)" class="repair-badge">EN RÉPARATION</span>
                  </div>
                </td>
                <td>{{ (v.totalKm || 0).toLocaleString() }} km</td>
                <td>
                  <span :class="['conso-badge', getConsumptionClass(v.avgConsumption)]">
                    {{ parseFloat(v.avgConsumption || 0).toFixed(1) }} L/100km
                  </span>
                </td>
                <td>
                  <span v-if="v.history && v.history.length > 0" class="last-refuel">
                    {{ formatDate(v.history[0]?.date) }}
                  </span>
                  <span v-else class="no-refuel">—</span>
                </td>
                <td>
                  <span v-if="v.history && v.history.length > 0" class="last-quantity">
                    {{ v.history[0]?.liters }} L
                  </span>
                  <span v-else class="no-refuel">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="filteredFleet.length === 0" class="no-data">
            <div class="no-data-icon">🚚</div>
            <p>Aucun véhicule trouvé</p>
          </div>
        </div>
      </div>
      </template>

      <!-- Stocks Carburant -->
      <template v-if="!isFleetManager">
      <h2 class="section-title">📦 Stocks Carburant</h2>
      <div class="stations-grid">
        <div v-for="station in stations" :key="station.id" class="station-card glass-white">
          <div class="station-header">
            <h3>📍 {{ station.name }}</h3>
            <span class="station-status" :class="getStationStatus(station.id)">
              {{ getStationStatusLabel(station.id) }}
            </span>
          </div>
          <div v-for="tank in getStationTanks(station.id)" :key="tank.id" class="tank-row">
            <div class="tank-info">
              <div class="fuel-type">
                <span class="fuel-icon" :class="getFuelTypeClass(tank.fuelType)"></span>
                {{ getFuelTypeLabel(tank.fuelType) }}
              </div>
              <span class="bold">{{ (tank.currentL || 0).toLocaleString() }} / {{ (tank.capacityL || 0).toLocaleString() }} L</span>
            </div>
            <div class="progress-container-glass">
              <div class="progress-fill" :class="getStockClass(tank)" 
                   :style="{ width: getTankPercentage(tank) + '%' }">
              </div>
            </div>
            <div class="tank-footer">
              <span class="percentage">{{ getTankPercentage(tank) }}%</span>
              <span v-if="isTankCritical(tank)" class="critical-text">
                ⚠️ Stock critique
              </span>
            </div>
          </div>
        </div>
      </div>
      </template>
    </template>

    <!-- Modale Véhicule -->
    <div v-if="selectedVehicle && !isStationManager" class="modal-overlay" @click.self="selectedVehicle = null">
      <div class="modal-content glass-white">
        <div class="modal-header">
          <h2>{{ selectedVehicle.plate }} - {{ selectedVehicle.model || 'Véhicule' }}</h2>
          <button @click="selectedVehicle = null" class="close-btn" aria-label="Fermer">&times;</button>
        </div>
        <div class="modal-body">
          <div class="vehicle-details">
            <div class="detail-section">
              <h4>📊 Statistiques</h4>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">Kilométrage</span>
                  <span class="stat-value">{{ (selectedVehicle.totalKm || 0).toLocaleString() }} km</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Conso. moyenne</span>
                  <span class="stat-value">{{ parseFloat(selectedVehicle.avgConsumption || 0).toFixed(1) }} L/100km</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Dernier ravit.</span>
                  <span class="stat-value">{{ selectedVehicle.history && selectedVehicle.history.length > 0 ? formatDate(selectedVehicle.history[0].date) : 'Aucun' }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Nombre de ravit.</span>
                  <span class="stat-value">{{ selectedVehicle.history?.length || 0 }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h4>📈 Consommation Mensuelle (L/100km)</h4>
              <div class="chart-container">
                <Bar v-if="selectedVehicle.monthlyStats && selectedVehicle.monthlyStats.values.some(v => v > 0)" 
                     :data="vehicleMonthlyChartData" 
                     :options="monthlyChartOptions" />
                <div v-else class="no-chart-data">
                  <div class="no-data-icon">📈</div>
                  <p>Données mensuelles non disponibles</p>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h4>⛽ Derniers Ravitaillements</h4>
              <div class="scroll-box">
                <table class="mini-table">
                  <thead>
                    <tr><th>Date</th><th>Station</th><th>Quantité</th><th>Km</th><th>Prix unit.</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="h in (selectedVehicle.history || []).slice(0, 5)" :key="h.id">
                      <td>{{ formatDate(h.date) }}</td>
                      <td>{{ h.station || 'N/A' }}</td>
                      <td class="bold">{{ h.liters }} L</td>
                      <td>{{ (h.odometer || 0).toLocaleString() }} km</td>
                      <td>{{ formatCurrency(h.unitPrice || 0) }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="!selectedVehicle.history || selectedVehicle.history.length === 0" class="no-data-small">
                  Aucun ravitaillement enregistré
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { Bar } from 'vue-chartjs';
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import api from "../services/api";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth"; // <-- IMPORT AJOUTÉ ICI

// Enregistrer les composants Chart.js
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Initialiser le store et le router
const router = useRouter();
const authStore = useAuthStore();

// Références

// Enregistrer les composants Chart.js
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Dans Dashboard.vue, ajoutez cette fonction
const handleApiError = (error) => {
  console.error('API Error:', error);
  
  if (error.response?.status === 401) {
    // Token invalide - déconnexion propre
    showNotification('Session expirée. Redirection...', 'error');
    
    setTimeout(() => {
      // Utiliser le store d'authentification
      const authStore = useAuthStore();
      authStore.logout();
    }, 1500);
    
    return true; // Erreur traitée
  }
  
  return false; // Erreur non traitée
};

// Références
const dashboardData = ref(null);
const loading = ref(false);
const dataLoaded = ref(false);
const error = ref(null);
const selectedVehicle = ref(null);
const notifications = ref([]);
const fleetFilter = ref('all');
const activePlanningTab = ref('maintenance');

// Données calculées
const tanks = computed(() => dashboardData.value?.tanks || []);
const fleetData = computed(() => dashboardData.value?.fleet || []);
const maintenances = computed(() => dashboardData.value?.maintenances || []);
const insurances = computed(() => dashboardData.value?.insurances || []);
const inspections = computed(() => dashboardData.value?.inspections || []);
const supplies = computed(() => dashboardData.value?.supplies || []);
const dispenses = computed(() => dashboardData.value?.dispenses || []);
const isStationManager = computed(() => authStore.user?.role === "STATION_MANAGER");
const isFleetManager = computed(() => authStore.user?.role === "FLEET_MANAGER");

// --- Helpers ---
const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
const ONLINE_VEHICLE_STATUSES = new Set([
  'ONLINE',
  'EN_LIGNE',
  'EN LIGNE',
  'ACTIVE',
  'ACTIF',
  'EN_SERVICE',
  'EN SERVICE'
]);

const isVehicleOnline = (vehicle) => {
  const normalized = normalizeStatus(vehicle?.status);
  return ONLINE_VEHICLE_STATUSES.has(normalized);
};

const isVehicleOutOfService = (vehicle) => {
  const normalized = normalizeStatus(vehicle?.status);
  return normalized === 'HORS_SERVICE' || normalized === 'HORS SERVICE';
};

const isVehicleInRepair = (vehicle) => {
  const normalized = normalizeStatus(vehicle?.status);
  return normalized === 'EN_REPARATION' || normalized === 'EN REPARATION';
};

const getDaysDiff = (date) => {
  if (!date) return 999;
  const now = new Date();
  const target = new Date(date);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const truncateText = (text, maxLength) => {
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Fonction formatCurrency modifiée pour utiliser le FCFA
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === 0) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + ' FCFA';
};

// --- KPI Computed ---
const today = computed(() => {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
});

const activeVehiclesCount = computed(() => {
  return fleetData.value.filter((v) => !isVehicleOutOfService(v) && isVehicleOnline(v)).length || 0;
});

// --- Maintenance ---
const upcomingMaintenances = computed(() => {
  return maintenances.value.slice(0, 10);
});

const urgentMaintenances = computed(() => {
  return upcomingMaintenances.value.filter(m => {
    const diff = getDaysDiff(m.dueAt);
    return diff >= 0 && diff <= 7;
  });
});

const getMaintenanceStatus = (m) => {
  if (m.status === 'DONE') return 'completed';
  const diff = getDaysDiff(m.dueAt);
  if (diff < 0) return 'expired';
  if (diff <= 7) return 'urgent';
  return 'planned';
};

const getMaintenanceStatusLabel = (m) => {
  if (m.status === 'DONE') return 'TERMINÉ';
  const diff = getDaysDiff(m.dueAt);
  if (diff < 0) return 'EN RETARD';
  if (diff <= 7) return 'URGENT';
  return 'PLANIFIÉ';
};

const getMaintenanceTypeLabel = (type) => {
  const labels = {
    'VIDANGE': 'Vidange',
    'REVISION': 'Révision',
    'REPARATION': 'Réparation',
    'DEPANNAGE': 'Dépannage',
    'PREVENTIVE': 'Préventif',
    'CORRECTIVE': 'Correctif'
  };
  return labels[type] || type;
};

const getMaintenanceRowClass = (m) => {
  const status = getMaintenanceStatus(m);
  if (status === 'expired') return 'row-expired';
  if (status === 'urgent') return 'row-urgent';
  return '';
};

// --- Inspections ---
const getInspectionDueDate = (inspection) => {
  if (!inspection) return null;
  // Même règle que la page Inspections:
  // prochaine visite d'abord, sinon date planifiée (première visite).
  return inspection.nextInspect || inspection.scheduledAt || null;
};

const getInspectionSortTime = (inspection) => {
  const candidates = [
    inspection?.doneAt,
    inspection?.effectiveAt,
    inspection?.scheduledAt,
    inspection?.createdAt,
    inspection?.updatedAt,
    inspection?.nextInspect
  ];
  for (const value of candidates) {
    const time = value ? new Date(value).getTime() : NaN;
    if (!Number.isNaN(time)) return time;
  }
  return 0;
};

const latestInspectionsByVehicle = computed(() => {
  if (!inspections.value || inspections.value.length === 0) return [];

  const latestByVehicle = new Map();

  for (const inspection of inspections.value) {
    const vehicleId = inspection?.vehicleId || inspection?.vehicle?.id;
    const vehicleKey = vehicleId ? String(vehicleId) : '';
    const vehicleStatus = normalizeStatus(inspection?.vehicle?.status);
    const isOnlineVehicle =
      (vehicleKey && onlineVehicleIds.value.has(vehicleKey)) ||
      ONLINE_VEHICLE_STATUSES.has(vehicleStatus);
    if (!vehicleKey) continue;
    if (!isOnlineVehicle) continue;

    const current = latestByVehicle.get(vehicleKey);
    if (!current || getInspectionSortTime(inspection) > getInspectionSortTime(current)) {
      latestByVehicle.set(vehicleKey, inspection);
    }
  }

  return Array.from(latestByVehicle.values());
});

const actionableInspections = computed(() => {
  return latestInspectionsByVehicle.value
    .filter(i => {
      // Inclure les visites planifiées et les visites validées avec prochaine échéance.
      if (!i.doneAt) return !!getInspectionDueDate(i);
      return !!i.nextInspect;
    })
    .sort((a, b) => {
      const aDate = new Date(getInspectionDueDate(a)).getTime();
      const bDate = new Date(getInspectionDueDate(b)).getTime();
      return aDate - bDate;
    });
});

const upcomingInspections = computed(() => {
  return actionableInspections.value.slice(0, 10);
});

// NOUVELLE computed pour les visites techniques urgentes
const urgentInspections = computed(() => {
  return upcomingInspections.value.filter(i => {
    const diff = getDaysDiff(getInspectionDueDate(i));
    return diff >= 0 && diff <= 7;
  });
});

// Toutes les visites critiques (expirées + urgentes)
const criticalInspections = computed(() => {
  return actionableInspections.value.filter(i => {
    const diff = getDaysDiff(getInspectionDueDate(i));
    return diff < 0 || (diff >= 0 && diff <= 7);
  });
});
// NOUVELLE computed pour les visites expirées
const expiredInspections = computed(() => {
  return actionableInspections.value.filter(i => {
    const diff = getDaysDiff(getInspectionDueDate(i));
    return diff < 0;
  });
});

const getInspectionStatus = (i) => {
  const dueDate = getInspectionDueDate(i);
  if (!dueDate) return 'completed';
  const diff = getDaysDiff(dueDate);
  if (diff < 0) return 'expired';
  if (diff <= 14) return 'urgent';
  return 'planned';
};

const getInspectionStatusLabel = (i) => {
  const dueDate = getInspectionDueDate(i);
  if (!dueDate) return 'FAITE';
  if (!i.doneAt) return 'EN ATTENTE';
  const diff = getDaysDiff(dueDate);
  if (diff < 0) return 'EN RETARD';
  if (diff <= 14) return 'URGENT';
  return i.doneAt ? 'REPROGRAMMÉE' : 'PLANIFIÉE';
};

const getInspectionTypeLabel = (type) => {
  const labels = {
    'TECHNICAL': 'Visite technique',
    'POLLUTION': 'Contrôle pollution',
    'PERIODIC': 'Contrôle périodique'
  };
  return labels[type] || type;
};

const getInspectionRowClass = (i) => {
  const status = getInspectionStatus(i);
  if (status === 'expired') return 'row-expired';
  if (status === 'urgent') return 'row-urgent';
  return '';
};

// --- Assurances - NOUVELLES FONCTIONS ---
const onlineVehicleIds = computed(() => {
  return new Set(
    fleetData.value
      .filter(isVehicleOnline)
      .map((v) => String(v.id))
      .filter(Boolean)
  );
});

const parseDateSafe = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getInsuranceEndDaysDiff = (endAt) => {
  const end = parseDateSafe(endAt);
  if (!end) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  return Math.ceil((endDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const isInsuranceActiveAt = (ins, refDate) => {
  const start = parseDateSafe(ins?.startAt);
  const end = parseDateSafe(ins?.endAt);
  if (!end) return false;
  const startsBefore = !start || start <= refDate;
  return startsBefore && end >= refDate;
};

const latestInsurancesForOnlineVehicles = computed(() => {
  if (!insurances.value || insurances.value.length === 0) return [];
  const now = new Date();
  const byVehicle = new Map();

  for (const ins of insurances.value) {
    const vehicleId = ins?.vehicleId || ins?.vehicle?.id;
    const vehicleKey = vehicleId ? String(vehicleId) : '';
    const vehicleStatus = normalizeStatus(ins?.vehicle?.status);
    const isOnlineVehicle =
      (vehicleKey && onlineVehicleIds.value.has(vehicleKey)) ||
      ONLINE_VEHICLE_STATUSES.has(vehicleStatus);

    if (!vehicleKey || !isOnlineVehicle) continue;
    if (!byVehicle.has(vehicleKey)) byVehicle.set(vehicleKey, []);
    byVehicle.get(vehicleKey).push(ins);
  }

  const selected = [];

  for (const vehicleInsurances of byVehicle.values()) {
    const active = vehicleInsurances
      .filter((ins) => isInsuranceActiveAt(ins, now))
      .sort((a, b) => (parseDateSafe(a.endAt)?.getTime() || Number.POSITIVE_INFINITY) - (parseDateSafe(b.endAt)?.getTime() || Number.POSITIVE_INFINITY));

    if (active.length > 0) {
      selected.push(active[0]);
      continue;
    }

    const expired = vehicleInsurances
      .filter((ins) => {
        const end = parseDateSafe(ins?.endAt);
        return end && end < now;
      })
      .sort((a, b) => (parseDateSafe(b.endAt)?.getTime() || 0) - (parseDateSafe(a.endAt)?.getTime() || 0));

    if (expired.length > 0) {
      selected.push(expired[0]);
      continue;
    }

    const upcoming = vehicleInsurances
      .filter((ins) => {
        const start = parseDateSafe(ins?.startAt);
        return start && start > now;
      })
      .sort((a, b) => (parseDateSafe(a.startAt)?.getTime() || 0) - (parseDateSafe(b.startAt)?.getTime() || 0));

    if (upcoming.length > 0) {
      selected.push(upcoming[0]);
    }
  }

  return selected;
});

const expiringInsurances = computed(() => {
  if (!latestInsurancesForOnlineVehicles.value.length) return [];
  
  // Trier par date d'expiration (plus proche en premier)
  return latestInsurancesForOnlineVehicles.value
    .filter(ins => {
      const diff = getInsuranceEndDaysDiff(ins.endAt);
      if (diff === null) return false;
      // Afficher toutes les assurances qui expirent dans les 60 prochains jours
      return diff <= 60;
    })
    .sort((a, b) => {
      const diffA = getInsuranceEndDaysDiff(a.endAt) ?? 99999;
      const diffB = getInsuranceEndDaysDiff(b.endAt) ?? 99999;
      return diffA - diffB;
    });
});

// Fonction pour obtenir la classe CSS selon les jours restants
const getInsuranceDaysClass = (ins) => {
  const days = getInsuranceEndDaysDiff(ins.endAt);
  if (days === null) return 'normal';
  
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'normal';
};

const getInsuranceRowClass = (ins) => {
  const daysClass = getInsuranceDaysClass(ins);
  if (daysClass === 'expired') return 'row-expired';
  if (daysClass === 'critical') return 'row-urgent';
  if (daysClass === 'warning') return 'row-warning';
  return '';
};

// --- Flotte ---
const highConsumptionCount = computed(() => {
  return fleetData.value
    .filter((v) => !isVehicleOutOfService(v))
    .filter(v => parseFloat(v.avgConsumption) > 15).length;
});

const lowConsumptionCount = computed(() => {
  return fleetData.value
    .filter((v) => !isVehicleOutOfService(v))
    .filter(v => parseFloat(v.avgConsumption) > 0 && parseFloat(v.avgConsumption) < 10).length;
});

const filteredFleet = computed(() => {
  let filtered = fleetData.value.filter((v) => !isVehicleOutOfService(v));
  if (fleetFilter.value === 'high') {
    filtered = filtered.filter(v => parseFloat(v.avgConsumption) > 15);
  }
  if (fleetFilter.value === 'low') {
    filtered = filtered.filter(v => parseFloat(v.avgConsumption) > 0 && parseFloat(v.avgConsumption) < 10);
  }
  return filtered.slice(0, 10);
});

const repairingVehicles = computed(() =>
  fleetData.value.filter((v) => !isVehicleOutOfService(v) && isVehicleInRepair(v))
);

const fleetVisibleCount = computed(() =>
  fleetData.value.filter((v) => !isVehicleOutOfService(v)).length
);

const getConsumptionClass = (consumption) => {
  const value = parseFloat(consumption || 0);
  if (value < 8) return 'excellent';
  if (value < 12) return 'good';
  if (value < 18) return 'average';
  return 'high';
};

const setFleetFilter = (filter) => {
  fleetFilter.value = filter;
};

// --- Stations et tanks ---
const stations = computed(() => {
  const stationMap = new Map();
  tanks.value.forEach(tank => {
    if (tank.station && !stationMap.has(tank.station.id)) {
      stationMap.set(tank.station.id, tank.station);
    }
  });
  return Array.from(stationMap.values());
});

const getStationTanks = (id) => tanks.value.filter(t => t.stationId === id);
const getTankPercentage = (t) => t.capacityL > 0 ? Math.round((t.currentL / t.capacityL) * 100) : 0;
const isTankCritical = (t) => t.currentL <= (t.lowAlertL || t.capacityL * 0.1);

const criticalTanksCount = computed(() => tanks.value.filter((t) => isTankCritical(t)).length);

const getTankRuptureEstimate = (tank) => {
  if (!tank?.id) return null;
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 14);

  const recentDispenses = dispenses.value.filter(
    (d) => d.tankId === tank.id && d.dispensedAt && new Date(d.dispensedAt) >= since
  );

  if (!recentDispenses.length) return null;
  const totalLiters = recentDispenses.reduce((sum, d) => sum + (Number(d.liters) || 0), 0);
  const avgDaily = totalLiters / 14;
  if (avgDaily <= 0) return null;

  const daysLeft = Math.max(0, Math.ceil((Number(tank.currentL) || 0) / avgDaily));
  const ruptureDate = new Date(now);
  ruptureDate.setDate(ruptureDate.getDate() + daysLeft);
  return { daysLeft, date: ruptureDate };
};

const ruptureSoonCount = computed(() =>
  tanks.value.filter((t) => {
    const estimate = getTankRuptureEstimate(t);
    return estimate && estimate.daysLeft <= 7;
  }).length
);

const stationRuptureAlerts = computed(() =>
  tanks.value
    .map((tank) => ({ tank, estimate: getTankRuptureEstimate(tank) }))
    .filter((x) => x.estimate && x.estimate.daysLeft <= 14)
    .sort((a, b) => a.estimate.daysLeft - b.estimate.daysLeft)
);

const getStockClass = (tank) => {
  const percentage = getTankPercentage(tank);
  if (percentage <= 15) return 'critical';
  if (percentage <= 30) return 'warning';
  return 'good';
};

const getStationStatus = (id) => {
  const sTanks = getStationTanks(id);
  const criticalTanks = sTanks.filter(t => isTankCritical(t));
  if (criticalTanks.length === sTanks.length && sTanks.length > 0) return 'critical';
  if (criticalTanks.length > 0) return 'warning';
  return 'good';
};

const getStationStatusLabel = (id) => {
  const status = getStationStatus(id);
  switch(status) {
    case 'critical': return 'CRITIQUE';
    case 'warning': return 'ALERTE';
    default: return 'NORMAL';
  }
};

const getFuelTypeLabel = (type) => {
  const labels = {
    'DIESEL': 'Diesel',
    'SUPER': 'Super 95',
    'SUPER98': 'Super 98',
    'GASOLINE': 'Essence',
    'LUBRIFIANT': 'Lubrifiant',
    'HUILE': 'Huile moteur',
    'ADBLUE': 'AdBlue'
  };
  return labels[type] || type;
};

const getFuelTypeClass = (type) => {
  const classes = {
    'DIESEL': 'diesel',
    'SUPER': 'super',
    'SUPER98': 'super98',
    'GASOLINE': 'gasoline',
    'LUBRIFIANT': 'lubrifiant',
    'HUILE': 'huile',
    'ADBLUE': 'adblue'
  };
  return classes[type] || 'default';
};

// --- Charts ---
const consumptionChartData = computed(() => {
  if (!dashboardData.value?.consumption) {
    return { labels: [], datasets: [] };
  }
  
  return {
    labels: dashboardData.value.consumption.labels,
    datasets: [{
      label: 'Consommation (L/100km)',
      data: dashboardData.value.consumption.values,
      backgroundColor: '#3b82f6',
      borderRadius: 6,
      borderSkipped: false
    }]
  };
});

const consumptionChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => `${context.parsed.y.toFixed(1)} L/100km`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'L/100km'
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
};

const maintenanceChartData = computed(() => {
  if (!dashboardData.value?.maintenanceChart) {
    return { labels: [], datasets: [] };
  }
  
  return {
    labels: dashboardData.value.maintenanceChart.labels,
    datasets: [{
      label: 'Coût des entretiens',
      data: dashboardData.value.maintenanceChart.values,
      backgroundColor: '#10b981',
      borderRadius: 6,
      borderSkipped: false
    }]
  };
});

// Options du graphique modifié pour le FCFA
const maintenanceChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => formatCurrency(context.parsed.y)
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Coût (FCFA)'
      },
      ticks: {
        callback: (value) => {
          if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M FCFA';
          if (value >= 1000) return (value / 1000).toFixed(0) + 'K FCFA';
          return value.toLocaleString('fr-FR') + ' FCFA';
        }
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
};

// --- Vehicle Modal ---
const selectVehicle = (vehicle) => {
  selectedVehicle.value = vehicle;
  document.body.style.overflow = 'hidden';
};

const vehicleMonthlyChartData = computed(() => {
  if (!selectedVehicle.value?.monthlyStats) {
    return { labels: [], datasets: [] };
  }
  
  return {
    labels: selectedVehicle.value.monthlyStats.labels || ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    datasets: [{
      label: 'Consommation (L/100km)',
      data: selectedVehicle.value.monthlyStats.values || [],
      backgroundColor: '#8b5cf6',
      borderColor: '#7c3aed',
      borderWidth: 2,
      fill: true,
      tension: 0.4
    }]
  };
});

const monthlyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { 
      display: true,
      position: 'top'
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'L/100km'
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
};

// --- Notifications ---
const showNotification = (message, type = 'info') => {
  const id = Date.now();
  notifications.value.push({
    id,
    message,
    type
  });
  
  setTimeout(() => {
    removeNotification(id);
  }, 5000);
};

const removeNotification = (id) => {
  notifications.value = notifications.value.filter(n => n.id !== id);
};

// --- Days Diff Label ---
const getDaysDiffLabel = (date) => {
  const diff = getDaysDiff(date);
  if (diff < 0) return `${Math.abs(diff)}j de retard`;
  if (diff === 0) return 'Aujourd\'hui';
  if (diff === 1) return 'Demain';
  if (diff <= 7) return `Dans ${diff}j (urgent)`;
  if (diff <= 30) return `Dans ${diff}j`;
  return `Dans ${Math.floor(diff/30)} mois`;
};

// --- API Fetch ---
const refreshData = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    console.log('🔄 Loading dashboard data...');
    
    // Vérifier d'abord l'authentification
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) {
      console.warn('User not authenticated, redirecting...');
      authStore.logout();
      return;
    }
    
    const res = await api.get("/dashboard");
    dashboardData.value = res.data;
    dataLoaded.value = true;
    
    // Vérifier s'il y a des alertes critiques
    checkCriticalAlerts();
    
    showNotification('Données actualisées avec succès', 'success');
  } catch (e) {
    console.error("Erreur de chargement", e);
    
    // Utiliser le handler d'erreur
    const isAuthError = handleApiError(e);
    
    if (!isAuthError) {
      error.value = "Impossible de charger les données. Vérifiez votre connexion.";
      showNotification('Erreur lors du chargement des données', 'error');
    }
  } finally {
    loading.value = false;
  }
};

const checkCriticalAlerts = () => {
  if (isStationManager.value) {
    const criticalTanks = tanks.value.filter(t => isTankCritical(t));
    if (criticalTanks.length > 0) {
      showNotification(`${criticalTanks.length} cuve(s) en stock critique`, 'warning');
    }
    if (ruptureSoonCount.value > 0) {
      showNotification(`${ruptureSoonCount.value} cuve(s) en rupture imminente`, 'warning');
    }
    return;
  }

  if (isFleetManager.value) {
    if (repairingVehicles.value.length > 0) {
      showNotification(`${repairingVehicles.value.length} véhicule(s) en réparation`, 'warning');
    }

    if (urgentMaintenances.value.length > 0) {
      showNotification(`${urgentMaintenances.value.length} entretien(s) urgent(s)`, 'warning');
    }

    const urgentInsurances = expiringInsurances.value.filter(ins => {
      const days = getInsuranceEndDaysDiff(ins.endAt);
      if (days === null) return false;
      return days <= 7;
    });
    if (urgentInsurances.length > 0) {
      showNotification(`${urgentInsurances.length} assurance(s) expire(nt) bientôt`, 'warning');
    }

    if (urgentInspections.value.length > 0) {
      showNotification(`${urgentInspections.value.length} visite(s) technique(s) urgente(s)`, 'warning');
    }
    return;
  }

  // Alertes de stocks critiques
  const criticalTanks = tanks.value.filter(t => isTankCritical(t));
  if (criticalTanks.length > 0) {
    showNotification(`${criticalTanks.length} cuve(s) en stock critique`, 'warning');
  }

  if (repairingVehicles.value.length > 0) {
    showNotification(`${repairingVehicles.value.length} véhicule(s) en réparation`, 'warning');
  }
  
  // Alertes d'entretiens urgents
  if (urgentMaintenances.value.length > 0) {
    showNotification(`${urgentMaintenances.value.length} entretien(s) urgent(s)`, 'warning');
  }
  
  // Alertes d'assurances expirant bientôt
  const urgentInsurances = expiringInsurances.value.filter(ins => {
    const days = getInsuranceEndDaysDiff(ins.endAt);
    if (days === null) return false;
    return days <= 7;
  });
  if (urgentInsurances.length > 0) {
    showNotification(`${urgentInsurances.length} assurance(s) expire(nt) bientôt`, 'warning');
  }
  
  // NOUVELLE alerte pour les visites techniques urgentes
  if (urgentInspections.value.length > 0) {
    showNotification(`${urgentInspections.value.length} visite(s) technique(s) urgente(s)`, 'warning');
  }
};

// --- Lifecycle ---
onMounted(() => {
  refreshData();
  
  // Auto-refresh toutes les 5 minutes
  const interval = setInterval(refreshData, 5 * 60 * 1000);
  
  onUnmounted(() => {
    clearInterval(interval);
  });
});

// Watch pour restaurer le scroll body quand modal fermée
watch(selectedVehicle, (newVal) => {
  if (!newVal) {
    document.body.style.overflow = 'auto';
  }
});
</script>

<style scoped>
/* Styles existants conservés, ajout des nouveaux styles pour les assurances et visites techniques */

/* Nouveaux styles pour les assurances */
.insurer-name {
  font-weight: 600;
  color: #1e293b;
}

.premium-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
  font-family: 'Courier New', monospace;
}

.days-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  display: inline-block;
  min-width: 40px;
  text-align: center;
}

.days-badge.critical {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  animation: pulse 1.5s infinite;
}

.days-badge.warning {
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.days-badge.normal {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.days-badge.expired {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  text-decoration: line-through;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.row-warning {
  background-color: rgba(254, 243, 199, 0.2);
}

.no-data-subtext {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 5px;
  font-style: italic;
}

/* Ajout de la classe row-warning dans les styles existants */
.row-expired {
  background-color: rgba(254, 226, 226, 0.3);
}

.row-urgent {
  background-color: rgba(254, 243, 199, 0.3);
}

.row-warning {
  background-color: rgba(254, 243, 199, 0.2);
}

/* Responsive adjustments for insurance table */
@media (max-width: 768px) {
  .glass-table {
    font-size: 12px;
  }
  
  .glass-table th:nth-child(6),
  .glass-table td:nth-child(6) {
    display: none;
  }
}

/* Styles pour les assureurs manquants */
.insurer-name::before {
  content: '🏢 ';
  font-size: 12px;
  opacity: 0.7;
}

.policy-number::before {
  content: '📄 ';
  font-size: 12px;
  opacity: 0.7;
}

.dashboard-container {
  padding: 20px;
  background: #f8fafc;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.subtitle {
  color: #64748b;
  margin-top: 5px;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.refresh-btn, .retry-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn:hover, .retry-btn:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Toast */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  padding: 12px 16px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  animation: slideIn 0.3s ease;
  border-left: 4px solid;
  min-width: 300px;
}

.toast-success {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.toast-error {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.toast-warning {
  border-left-color: #f59e0b;
  background: #fffbeb;
}

.toast-info {
  border-left-color: #3b82f6;
  background: #eff6ff;
}

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 0;
  font-size: 18px;
  line-height: 1;
}

.toast-close:hover {
  color: #1e293b;
}

/* Error Banner */
.error-banner {
  background: #fee2e2;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #fecaca;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.kpi-card {
  padding: 20px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
}

.kpi-card.glass.blue {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  color: #0369a1;
}

.kpi-card.glass.green {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #15803d;
}

.kpi-card.glass.orange {
  background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
  color: #9a3412;
}

.kpi-card.glass.red {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
}

/* NOUVEAU style pour le KPI des visites techniques */
.kpi-card.glass.purple {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  color: #7c3aed;
}

.kpi-icon {
  background: white;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.kpi-content {
  flex: 1;
}

.label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.value {
  font-size: 28px;
  font-weight: 800;
  margin: 4px 0;
}

.kpi-subtext {
  font-size: 11px;
  opacity: 0.7;
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-bottom: 30px;
}

@media (min-width: 1024px) {
  .charts-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.chart-card h3 {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: #1e293b;
}

.chart-container {
  height: 250px;
  position: relative;
}

.no-chart-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
}

.no-chart-data .no-data-icon {
  font-size: 40px;
  margin-bottom: 10px;
  opacity: 0.5;
}

/* Header Flex */
.header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.view-toggle {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.view-toggle button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle button:hover {
  border-color: #3b82f6;
}

.view-toggle button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

/* Tables */
.glass-table {
  width: 100%;
  border-collapse: collapse;
}

.glass-table th {
  text-align: left;
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
  background: #f8fafc;
}

.glass-table td {
  padding: 16px 8px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  vertical-align: middle;
}

.row-expired {
  background-color: rgba(254, 226, 226, 0.3);
}

.row-urgent {
  background-color: rgba(254, 243, 199, 0.3);
}

.scroll-box-maintenance {
  max-height: 400px;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

/* Vehicle Info */
.vehicle-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vehicle-icon {
  font-size: 20px;
  opacity: 0.7;
}

.vehicle-model {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.vehicle-model-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vehicle-icon-small {
  font-size: 16px;
  opacity: 0.7;
}

/* Maintenance Type */
.maintenance-type {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}

.maintenance-type.vidange {
  background: #dbeafe;
  color: #1d4ed8;
}

.maintenance-type.revision {
  background: #fce7f3;
  color: #be185d;
}

.maintenance-type.reparation {
  background: #fef3c7;
  color: #92400e;
}

.maintenance-type.depannage {
  background: #dcfce7;
  color: #166534;
}

.maintenance-type.preventive {
  background: #e0f2fe;
  color: #0369a1;
}

.maintenance-type.corrective {
  background: #fee2e2;
  color: #dc2626;
}

/* Cost Badge - Modifié pour FCFA */
.cost-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
  font-family: 'Courier New', monospace;
}

/* Date Cell */
.date-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.date-diff {
  font-size: 10px;
  color: #64748b;
  font-style: italic;
}

/* Status Pill */
.status-pill {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-pill.expired {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.status-pill.urgent {
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.status-pill.planned {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.status-pill.completed {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

/* Plate Tag */
.plate-tag {
  background: #1e293b;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.plate-tag.repair {
  background: #f59e0b;
  color: #1f2937;
}

.repair-badge {
  font-size: 10px;
  font-weight: 700;
  color: #b45309;
  background: #ffedd5;
  border: 1px solid #fdba74;
  border-radius: 999px;
  padding: 2px 6px;
}

/* Conso Badge */
.conso-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}

.conso-badge.excellent {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.conso-badge.good {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.conso-badge.average {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.conso-badge.high {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.last-refuel, .last-quantity {
  font-size: 12px;
  font-weight: 500;
}

.no-refuel {
  color: #94a3b8;
  font-style: italic;
  font-size: 12px;
}

/* Fleet Filters */
.fleet-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.fleet-filters button {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.fleet-filters button:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.fleet-filters button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.repair-alert {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  border: 1px solid #fdba74;
  font-size: 12px;
  font-weight: 600;
}

.clickable-row {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.clickable-row:hover {
  background-color: #f8fafc;
}

/* Stations Grid */
.stations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.station-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.station-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e2e8f0;
}

.station-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
}

.station-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.station-status.critical {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.station-status.warning {
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.station-status.good {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.station-status.unknown {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.tank-row {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f1f5f9;
}

.tank-row:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.tank-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
}

.fuel-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.fuel-icon::before {
  font-size: 16px;
}

.fuel-icon.diesel::before { content: "⛽"; color: #1e293b; }
.fuel-icon.super::before { content: "🟡"; color: #f59e0b; }
.fuel-icon.super98::before { content: "🟠"; color: #ea580c; }
.fuel-icon.gasoline::before { content: "🔥"; color: #dc2626; }
.fuel-icon.lubrifiant::before { content: "🔧"; color: #64748b; }
.fuel-icon.huile::before { content: "🛢️"; color: #0369a1; }
.fuel-icon.adblue::before { content: "💧"; color: #3b82f6; }
.fuel-icon.default::before { content: "⛽"; color: #94a3b8; }

.bold {
  font-weight: 700;
}

/* Progress Bar */
.progress-container-glass {
  background: #e2e8f0;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  height: 100%;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-fill.good {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.progress-fill.warning {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.progress-fill.critical {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.tank-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.percentage {
  font-weight: 700;
  color: #1e293b;
}

.critical-text {
  color: #ef4444;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Insurance Type */
.insurance-type {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #e0f2fe;
  color: #0369a1;
}

.policy-number {
  font-family: monospace;
  font-size: 11px;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #475569;
}

/* No Data */
.no-data {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-data p {
  margin: 0;
  font-size: 14px;
}

.no-data-small {
  text-align: center;
  padding: 30px;
  color: #94a3b8;
  font-style: italic;
  font-size: 13px;
}

.empty {
  text-align: center;
  color: #64748b;
  font-style: italic;
}

/* Section Title */
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 40px 0 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
  border-radius: 12px 12px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: #1e293b;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #64748b;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.modal-body {
  padding: 24px;
}

.vehicle-details {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.detail-section h4 {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: #1e293b;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: transform 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-2px);
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  font-weight: 600;
}

.stat-value {
  display: block;
  font-size: 18px;
  color: #1e293b;
  font-weight: 700;
}

.scroll-box {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
}

.mini-table {
  width: 100%;
  border-collapse: collapse;
}

.mini-table th {
  text-align: left;
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
  background: #f8fafc;
  position: sticky;
  top: 0;
}

.mini-table td {
  padding: 12px 8px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 12px;
}

.mini-table tr:last-child td {
  border-bottom: none;
}

.mini-table .bold {
  font-weight: 700;
}

/* Skeleton Loaders */
.skeleton-header {
  margin-bottom: 30px;
}

.skeleton-title {
  width: 200px;
  height: 32px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 10px;
}

.skeleton-subtitle {
  width: 150px;
  height: 20px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 6px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.skeleton-kpi {
  height: 100px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 12px;
}

.skeleton-charts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-bottom: 30px;
}

@media (min-width: 1024px) {
  .skeleton-charts {
    grid-template-columns: 1fr 1fr;
  }
}

.skeleton-chart-large, .skeleton-chart-medium {
  height: 300px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 12px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Animations */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Custom Scrollbar */
.scroll-box-maintenance::-webkit-scrollbar,
.scroll-box::-webkit-scrollbar {
  width: 8px;
}

.scroll-box-maintenance::-webkit-scrollbar-track,
.scroll-box::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.scroll-box-maintenance::-webkit-scrollbar-thumb,
.scroll-box::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.scroll-box-maintenance::-webkit-scrollbar-thumb:hover,
.scroll-box::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Accessibility */
button:focus-visible, 
.clickable-row:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Print styles */
@media print {
  .refresh-btn, .header-actions, .toast-container, .view-toggle button,
  .fleet-filters button, .station-status, .status-pill, .clickable-row {
    display: none !important;
  }
  
  .dashboard-container {
    padding: 0;
  }
  
  .card, .station-card {
    break-inside: avoid;
    box-shadow: none;
    border: 1px solid #e2e8f0;
  }
  
  .kpi-card {
    border: 1px solid #e2e8f0;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-container {
    padding: 15px;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
  
  .header-actions {
    width: 100%;
  }
  
  .refresh-btn {
    width: 100%;
    justify-content: center;
  }
  
  .kpi-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .stations-grid {
    grid-template-columns: 1fr;
  }
  
  .header-flex {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .view-toggle {
    width: 100%;
    justify-content: center;
  }
  
  .fleet-filters {
    justify-content: center;
  }
  
  .modal-content {
    margin: 10px;
    max-height: 85vh;
  }
  
  .glass-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 20px;
  }
  
  .subtitle {
    font-size: 12px;
  }
  
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  
  .kpi-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
  
  .value {
    font-size: 24px;
  }
  
  .section-title {
    font-size: 16px;
  }
}
</style>

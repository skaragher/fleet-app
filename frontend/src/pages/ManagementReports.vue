<template>
  <div class="mgmt-reports">

    <!-- ═══ EN-TÊTE IMPRESSION ═══ -->
    <div class="print-header">
      <div class="print-header-top">
        <div class="print-logo-block">
          <img v-if="companyLogoUrl" :src="companyLogoUrl" alt="Logo" class="print-logo-img" crossorigin="anonymous" />
        </div>
        <div class="print-company-block">
          <div class="print-company-name">{{ companyName }}</div>
        </div>
      </div>
      <div class="print-title-bar">{{ currentPrintTitle }}</div>
      <div class="print-period">{{ currentPrintPeriod }}</div>
      <div v-if="selectedVehicleLabel" class="print-vehicle-filter">
        Véhicule : {{ selectedVehicleLabel }}
      </div>
    </div>

    <!-- ═══ ENTÊTE PAGE ═══ -->
    <div class="page-header no-print">
      <div class="page-header-left">
        <h2 class="page-title">Rapports de Gestion</h2>
        <p class="page-subtitle">États financiers, véhicules, maintenance, audit &amp; synthèse</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" @click="printPage">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimer
        </button>
        <button class="btn btn-primary" @click="exportPDF">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF
        </button>
      </div>
    </div>

    <!-- ═══ ONGLETS CATÉGORIES ═══ -->
    <div class="category-tabs no-print">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat-tab"
        :class="{ active: activeCategory === cat.id }"
        @click="switchCategory(cat.id)"
      >
        <span class="cat-icon">{{ cat.icon }}</span>
        <span class="cat-label">{{ cat.label }}</span>
      </button>
    </div>

    <!-- ═══ BARRE DE FILTRES PRINCIPALE ═══ -->
    <div
      class="filters-bar no-print"
      v-if="activeCategory !== 'audit' || activeSub !== 'daily'"
    >
      <!-- Dates -->
      <div class="filter-group">
        <label>Du</label>
        <input type="date" v-model="startDate" @change="fetchData" />
      </div>
      <div class="filter-group">
        <label>Au</label>
        <input type="date" v-model="endDate" @change="fetchData" />
      </div>

      <!-- ── FILTRE VÉHICULE ── affiché sur les onglets qui le supportent -->
      <div class="filter-group" v-if="showVehicleFilter">
        <label>Véhicule</label>
        <div class="vehicle-select-wrapper">
          <select
            v-model="selectedVehicleId"
            @change="fetchData"
            class="filter-select"
            :disabled="vehiclesLoading"
          >
            <option value="">
              {{ vehiclesLoading ? 'Chargement...' : vehicles.length ? 'Tous les véhicules' : 'Aucun véhicule' }}
            </option>
            <option
              v-for="v in vehicles"
              :key="v.id"
              :value="v.id"
            >{{ v.plate }}{{ v.label ? ' — ' + v.label : '' }}</option>
          </select>
          <button
            v-if="selectedVehicleId"
            class="vehicle-clear-btn"
            @click="clearVehicleFilter"
            title="Effacer le filtre véhicule"
          >✕</button>
          <span v-if="vehiclesLoading" class="vehicle-loading-dot"></span>
        </div>
      </div>

      <!-- Norme comparatif -->
      <div class="filter-group" v-if="activeCategory === 'audit' && activeSub === 'anomalies'">
        <label>Norme L/100km</label>
        <input type="number" v-model.number="anomalyNorm" step="0.5" min="1" @change="fetchData" style="width:90px" />
      </div>
      <div class="filter-group" v-if="activeCategory === 'audit' && activeSub === 'anomalies'">
        <label>Seuil écart %</label>
        <input type="number" v-model.number="anomalyThreshold" step="1" min="1" @change="fetchData" style="width:90px" />
      </div>

      <!-- Année/Mois synthèse mensuelle -->
      <template v-if="activeCategory === 'synthesis' && activeSub === 'monthly'">
        <div class="filter-group">
          <label>Année</label>
          <input type="number" v-model.number="monthlyYear" min="2020" :max="new Date().getFullYear()" @change="fetchData" style="width:100px" />
        </div>
        <div class="filter-group">
          <label>Mois</label>
          <select v-model.number="monthlyMonth" @change="fetchData">
            <option v-for="(name, i) in monthNames" :key="i" :value="i + 1">{{ name }}</option>
          </select>
        </div>
      </template>

      <button class="btn btn-sm btn-secondary" @click="resetFilters">Réinitialiser</button>
    </div>

    <!-- Filtres journalier -->
    <div class="filters-bar no-print" v-if="activeCategory === 'audit' && activeSub === 'daily'">
      <div class="filter-group">
        <label>Date</label>
        <input type="date" v-model="dailyDate" @change="fetchData" />
      </div>
    </div>

    <!-- Filtres maintenance à venir -->
    <div class="filters-bar no-print" v-if="activeCategory === 'maintenance' && activeSub === 'upcoming'">
      <div class="filter-group">
        <label>Horizon (jours)</label>
        <input type="number" v-model.number="upcomingDays" min="7" max="365" @change="fetchData" style="width:100px" />
      </div>
    </div>
    <!-- Filtres maintenance alertes -->
    <div class="filters-bar no-print" v-if="activeCategory === 'maintenance' && activeSub === 'alerts'">
      <div class="filter-group">
        <label>Alerte dans (jours)</label>
        <input type="number" v-model.number="alertDays" min="7" max="90" @change="fetchData" style="width:100px" />
      </div>
    </div>

    <!-- Chip de filtre actif (feedback visuel) -->
    <div class="active-filters no-print" v-if="selectedVehicleId && showVehicleFilter">
      <span class="active-filter-chip">
        🚗 {{ selectedVehicleLabel }}
        <button @click="clearVehicleFilter" class="chip-clear">✕</button>
      </span>
    </div>

    <!-- Sous-onglets -->
    <div class="sub-tabs no-print" v-if="currentSubTabs.length > 1">
      <button
        v-for="sub in currentSubTabs"
        :key="sub.id"
        class="sub-tab"
        :class="{ active: activeSub === sub.id }"
        @click="activeSub = sub.id; fetchData()"
      >{{ sub.label }}</button>
    </div>

    <!-- ═══ CHARGEMENT / ERREUR ═══ -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>Chargement...</span>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchData">Réessayer</button>
    </div>

    <!-- ═══ CONTENU ═══ -->
    <div v-else class="report-content">

      <!-- ──────── FINANCES ──────── -->
      <template v-if="activeCategory === 'finances'">
        <div v-if="data.expenses">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-label">Volume total</div>
              <div class="summary-value">{{ fmt(data.expenses.summary.totalL) }} L</div>
            </div>
            <div class="summary-card accent">
              <div class="summary-label">Coût total</div>
              <div class="summary-value">{{ fmtCost(data.expenses.summary.totalCost) }}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Transactions</div>
              <div class="summary-value">{{ data.expenses.summary.count }}</div>
            </div>
          </div>

          <div class="sub-section">
            <h4 class="sub-section-title">Évolution mensuelle</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Mois</th><th>Volume (L)</th><th>Coût</th><th>Transactions</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.expenses.byMonth" :key="r.month">
                    <td>{{ r.month }}</td>
                    <td>{{ fmt(r.totalL) }}</td>
                    <td>{{ fmtCost(r.totalCost) }}</td>
                    <td>{{ r.count }}</td>
                  </tr>
                  <tr v-if="!data.expenses.byMonth?.length"><td colspan="4" class="empty">Aucune donnée</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="sub-section" v-if="!selectedVehicleId">
            <h4 class="sub-section-title">Par véhicule</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Véhicule</th><th>Volume (L)</th><th>Coût</th><th>Plein(s)</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.expenses.byVehicle" :key="r.vehicle">
                    <td>{{ r.vehicle }}</td>
                    <td>{{ fmt(r.totalL) }}</td>
                    <td>{{ fmtCost(r.totalCost) }}</td>
                    <td>{{ r.count }}</td>
                  </tr>
                  <tr v-if="!data.expenses.byVehicle?.length"><td colspan="4" class="empty">Aucune donnée</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="sub-section">
            <h4 class="sub-section-title">Détail des opérations</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Date</th><th>Véhicule</th><th>Chauffeur</th><th>Station</th><th>Volume (L)</th><th>PU (FCFA)</th><th>Montant</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.expenses.lines" :key="r.id">
                    <td>{{ fmtDate(r.date) }}</td>
                    <td>{{ r.vehicle }}</td>
                    <td>{{ r.driver }}</td>
                    <td>{{ r.station }}</td>
                    <td>{{ fmt(r.liters) }}</td>
                    <td>{{ r.unitPrice ? fmt(r.unitPrice) : '—' }}</td>
                    <td>{{ fmtCost(r.cost) }}</td>
                  </tr>
                  <tr v-if="!data.expenses.lines?.length"><td colspan="7" class="empty">Aucune donnée</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>

      <!-- ──────── VÉHICULES ──────── -->
      <template v-if="activeCategory === 'vehicles'">
        <template v-if="activeSub === 'assignments' && data.assignments">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-label">Affectations utilisateurs actives</div>
              <div class="summary-value">{{ data.assignments.summary.activeUserAssignments }}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Affectations chauffeurs actives</div>
              <div class="summary-value">{{ data.assignments.summary.activeDriverAssignments }}</div>
            </div>
          </div>

          <div class="sub-section">
            <h4 class="sub-section-title">Affectations utilisateurs</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Véhicule</th><th>Depuis</th><th>Jusqu'au</th><th>Statut</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.assignments.userAssignments" :key="r.id">
                    <td>{{ r.userName }}</td>
                    <td><span class="badge">{{ r.userRole }}</span></td>
                    <td>{{ r.vehicle }}<small v-if="r.vehicleLabel"> — {{ r.vehicleLabel }}</small></td>
                    <td>{{ fmtDate(r.assignedAt) }}</td>
                    <td>{{ r.unassignedAt ? fmtDate(r.unassignedAt) : '—' }}</td>
                    <td><span class="status-dot" :class="r.active ? 'green' : 'grey'">{{ r.active ? 'Actif' : 'Terminé' }}</span></td>
                  </tr>
                  <tr v-if="!data.assignments.userAssignments?.length"><td colspan="6" class="empty">Aucune affectation</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="sub-section">
            <h4 class="sub-section-title">Affectations chauffeurs</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Chauffeur</th><th>Permis N°</th><th>Véhicule</th><th>Depuis</th><th>Jusqu'au</th><th>Statut</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.assignments.driverAssignments" :key="r.id">
                    <td>{{ r.driverName }}</td>
                    <td>{{ r.licenseNo }}</td>
                    <td>{{ r.vehicle }}<small v-if="r.vehicleLabel"> — {{ r.vehicleLabel }}</small></td>
                    <td>{{ fmtDate(r.startDate) }}</td>
                    <td>{{ r.endDate ? fmtDate(r.endDate) : '—' }}</td>
                    <td><span class="status-dot" :class="r.active ? 'green' : 'grey'">{{ r.active ? 'Actif' : 'Terminé' }}</span></td>
                  </tr>
                  <tr v-if="!data.assignments.driverAssignments?.length"><td colspan="6" class="empty">Aucune affectation</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <template v-if="activeSub === 'activity' && data.activity">
          <div class="summary-cards">
            <div class="summary-card"><div class="summary-label">Véhicules</div><div class="summary-value">{{ data.activity.summary.totalVehicles }}</div></div>
            <div class="summary-card"><div class="summary-label">Volume carburant</div><div class="summary-value">{{ fmt(data.activity.summary.totalFuelL) }} L</div></div>
            <div class="summary-card accent"><div class="summary-label">Coût carburant</div><div class="summary-value">{{ fmtCost(data.activity.summary.totalFuelCost) }}</div></div>
            <div class="summary-card"><div class="summary-label">Coût maintenance</div><div class="summary-value">{{ fmtCost(data.activity.summary.totalMaintenanceCost) }}</div></div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Véhicule</th><th>Statut</th><th>Km</th><th>Pleins</th><th>Vol. (L)</th><th>Coût carb.</th><th>Mainten.</th><th>Coût maint.</th><th>Coût total</th></tr></thead>
              <tbody>
                <tr v-for="v in data.activity.vehicles" :key="v.vehicleId">
                  <td><strong>{{ v.plate }}</strong><br/><small>{{ v.make }} {{ v.model }}</small></td>
                  <td><span class="badge" :class="statusClass(v.status)">{{ fmtStatus(v.status) }}</span></td>
                  <td>{{ fmt(v.odometerKm) }}</td>
                  <td>{{ v.fuelEvents }}</td>
                  <td>{{ fmt(v.totalFuelL) }}</td>
                  <td>{{ fmtCost(v.totalFuelCost) }}</td>
                  <td>{{ v.maintenanceEvents }}</td>
                  <td>{{ fmtCost(v.totalMaintenanceCost) }}</td>
                  <td><strong>{{ fmtCost(v.totalCost) }}</strong></td>
                </tr>
                <tr v-if="!data.activity.vehicles?.length"><td colspan="9" class="empty">Aucune donnée</td></tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>

      <!-- ──────── MAINTENANCE ──────── -->
      <template v-if="activeCategory === 'maintenance'">
        <template v-if="activeSub === 'done' && data.maintenanceDone">
          <div class="summary-cards">
            <div class="summary-card"><div class="summary-label">Opérations réalisées</div><div class="summary-value">{{ data.maintenanceDone.summary.count }}</div></div>
            <div class="summary-card accent"><div class="summary-label">Coût total</div><div class="summary-value">{{ fmtCost(data.maintenanceDone.summary.totalCost) }}</div></div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Véhicule</th><th>Type</th><th>Description</th><th>Km</th><th>Coût</th></tr></thead>
              <tbody>
                <tr v-for="r in data.maintenanceDone.lines" :key="r.id">
                  <td>{{ fmtDate(r.date) }}</td>
                  <td>{{ r.vehicle }}<br/><small>{{ r.vehicleLabel }}</small></td>
                  <td><span class="badge">{{ r.type }}</span></td>
                  <td>{{ r.description || '—' }}</td>
                  <td>{{ r.odometerKm ? fmt(r.odometerKm) : '—' }}</td>
                  <td>{{ r.cost ? fmtCost(r.cost) : '—' }}</td>
                </tr>
                <tr v-if="!data.maintenanceDone.lines?.length"><td colspan="6" class="empty">Aucun entretien réalisé</td></tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="activeSub === 'upcoming' && data.maintenanceUpcoming">
          <div class="summary-cards">
            <div class="summary-card red"><div class="summary-label">En retard</div><div class="summary-value">{{ data.maintenanceUpcoming.summary.overdue }}</div></div>
            <div class="summary-card orange"><div class="summary-label">Urgent (≤7j)</div><div class="summary-value">{{ data.maintenanceUpcoming.summary.urgent }}</div></div>
            <div class="summary-card yellow"><div class="summary-label">Bientôt (≤30j)</div><div class="summary-value">{{ data.maintenanceUpcoming.summary.soon }}</div></div>
            <div class="summary-card"><div class="summary-label">Total</div><div class="summary-value">{{ data.maintenanceUpcoming.summary.total }}</div></div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Véhicule</th><th>Type</th><th>Description</th><th>Échéance</th><th>Jours restants</th><th>Urgence</th></tr></thead>
              <tbody>
                <tr v-for="r in data.maintenanceUpcoming.lines" :key="r.id" :class="['row-' + r.urgency]">
                  <td>{{ r.vehicle }}<br/><small>{{ r.vehicleLabel }}</small></td>
                  <td><span class="badge">{{ r.type }}</span></td>
                  <td>{{ r.description || '—' }}</td>
                  <td>{{ r.dueAt ? fmtDate(r.dueAt) : '—' }}</td>
                  <td>{{ r.daysLeft !== null ? r.daysLeft + ' j' : '—' }}</td>
                  <td><span class="urgency-badge" :class="'urgency-' + r.urgency">{{ fmtUrgency(r.urgency) }}</span></td>
                </tr>
                <tr v-if="!data.maintenanceUpcoming.lines?.length"><td colspan="6" class="empty">Aucun entretien planifié</td></tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="activeSub === 'alerts' && data.maintenanceAlerts">
          <div class="summary-cards">
            <div class="summary-card red"><div class="summary-label">Expirés</div><div class="summary-value">{{ data.maintenanceAlerts.summary.expired }}</div></div>
            <div class="summary-card red"><div class="summary-label">En retard</div><div class="summary-value">{{ data.maintenanceAlerts.summary.overdue }}</div></div>
            <div class="summary-card orange"><div class="summary-label">Urgents</div><div class="summary-value">{{ data.maintenanceAlerts.summary.urgent }}</div></div>
            <div class="summary-card yellow"><div class="summary-label">À surveiller</div><div class="summary-value">{{ data.maintenanceAlerts.summary.warning }}</div></div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Catégorie</th><th>Véhicule</th><th>Description</th><th>Échéance</th><th>Jours</th><th>Statut</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in data.maintenanceAlerts.alerts" :key="i" :class="['row-alert-' + r.status]">
                  <td><span class="alert-type-icon">{{ alertTypeIcon(r.type) }}</span> {{ fmtAlertType(r.type) }}</td>
                  <td>{{ r.vehiclePlate }}<br/><small>{{ r.vehicleLabel }}</small></td>
                  <td>{{ r.label }}</td>
                  <td>{{ r.dueDate ? fmtDate(r.dueDate) : '—' }}</td>
                  <td>{{ r.daysLeft !== null ? r.daysLeft + ' j' : '—' }}</td>
                  <td><span class="urgency-badge" :class="'urgency-' + r.status">{{ fmtUrgency(r.status) }}</span></td>
                </tr>
                <tr v-if="!data.maintenanceAlerts.alerts?.length"><td colspan="6" class="empty">Aucune alerte</td></tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>

      <!-- ──────── AUDIT ──────── -->
      <template v-if="activeCategory === 'audit'">
        <template v-if="activeSub === 'anomalies' && data.anomalies">
          <div class="summary-cards">
            <div class="summary-card red"><div class="summary-label">Critiques (&gt;25%)</div><div class="summary-value">{{ data.anomalies.summary.critical }}</div></div>
            <div class="summary-card orange"><div class="summary-label">Avertissements</div><div class="summary-value">{{ data.anomalies.summary.warning }}</div></div>
            <div class="summary-card"><div class="summary-label">Total anomalies</div><div class="summary-value">{{ data.anomalies.summary.total }}</div></div>
            <div class="summary-card"><div class="summary-label">Norme</div><div class="summary-value">{{ data.anomalies.normL100km }} L/100km</div></div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Véhicule</th><th>Volume (L)</th><th>Km parcourus</th><th>Consomm. réelle</th><th>Norme</th><th>Écart %</th><th>Pleins</th><th>Sévérité</th></tr></thead>
              <tbody>
                <tr v-for="r in data.anomalies.anomalies" :key="r.plate" :class="['row-anomaly-' + r.severity]">
                  <td><strong>{{ r.plate }}</strong><br/><small>{{ r.vehicleLabel }}</small></td>
                  <td>{{ fmt(r.totalL) }}</td>
                  <td>{{ fmt(r.kmDriven) }}</td>
                  <td>{{ r.actualRate }} L/100km</td>
                  <td>{{ r.normRate }} L/100km</td>
                  <td><strong :class="r.ecartPct > 0 ? 'text-red' : 'text-green'">{{ r.ecartPct > 0 ? '+' : '' }}{{ r.ecartPct }}%</strong></td>
                  <td>{{ r.fillCount }}</td>
                  <td><span class="urgency-badge" :class="r.severity === 'critical' ? 'urgency-overdue' : 'urgency-soon'">{{ r.severity === 'critical' ? 'Critique' : 'Attention' }}</span></td>
                </tr>
                <tr v-if="!data.anomalies.anomalies?.length"><td colspan="8" class="empty">Aucune anomalie détectée</td></tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="activeSub === 'stock' && data.stock">
          <div class="summary-cards">
            <div class="summary-card"><div class="summary-label">Cuves contrôlées</div><div class="summary-value">{{ data.stock.summary.totalTanks }}</div></div>
            <div class="summary-card red"><div class="summary-label">Écarts critiques</div><div class="summary-value">{{ data.stock.summary.critical }}</div></div>
            <div class="summary-card orange"><div class="summary-label">Avertissements</div><div class="summary-value">{{ data.stock.summary.warnings }}</div></div>
            <div class="summary-card yellow"><div class="summary-label">Niveaux bas</div><div class="summary-value">{{ data.stock.summary.lowAlerts }}</div></div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Station</th><th>Cuve</th><th>Type</th><th>Capacité (L)</th><th>Réel (L)</th><th>Théorique (L)</th><th>Écart (L)</th><th>Écart %</th><th>Remplissage</th><th>Statut</th></tr></thead>
              <tbody>
                <tr v-for="r in data.stock.tanks" :key="r.tankId" :class="['row-stock-' + r.status]">
                  <td>{{ r.station }}</td>
                  <td>{{ r.tankName }}</td>
                  <td>{{ r.fuelType }}</td>
                  <td>{{ fmt(r.capacityL) }}</td>
                  <td>{{ fmt(r.currentL) }}</td>
                  <td>{{ fmt(r.theoreticalL) }}</td>
                  <td :class="r.ecartL < 0 ? 'text-red' : 'text-green'">{{ r.ecartL > 0 ? '+' : '' }}{{ fmt(r.ecartL) }}</td>
                  <td :class="r.ecartPct !== null && Math.abs(r.ecartPct) > 5 ? 'text-red' : ''">{{ r.ecartPct !== null ? r.ecartPct + '%' : '—' }}</td>
                  <td>
                    <div class="progress-bar">
                      <div class="progress-fill" :style="`width:${r.fillPct}%`" :class="r.fillPct < 20 ? 'low' : ''"></div>
                    </div>
                    <small>{{ r.fillPct }}%</small>
                  </td>
                  <td><span class="urgency-badge" :class="r.status === 'critical' ? 'urgency-overdue' : r.status === 'warning' ? 'urgency-soon' : 'urgency-normal'">{{ r.status === 'critical' ? 'Critique' : r.status === 'warning' ? 'Attention' : 'OK' }}</span></td>
                </tr>
                <tr v-if="!data.stock.tanks?.length"><td colspan="10" class="empty">Aucune cuve</td></tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="activeSub === 'daily' && data.daily">
          <h3 class="section-date">Journée du {{ fmtDate(data.daily.date) }}</h3>
          <div class="summary-cards">
            <div class="summary-card"><div class="summary-label">Sorties (L)</div><div class="summary-value">{{ fmt(data.daily.summary.totalDispensesL) }}</div></div>
            <div class="summary-card accent"><div class="summary-label">Montant sorties</div><div class="summary-value">{{ fmtCost(data.daily.summary.totalDispensesCost) }}</div></div>
            <div class="summary-card"><div class="summary-label">Approvisionnements (L)</div><div class="summary-value">{{ fmt(data.daily.summary.totalSuppliesL) }}</div></div>
            <div class="summary-card"><div class="summary-label">Montant appro.</div><div class="summary-value">{{ fmtCost(data.daily.summary.totalSuppliesCost) }}</div></div>
          </div>
          <div class="sub-section">
            <h4 class="sub-section-title">Sorties carburant</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Heure</th><th>Station</th><th>Véhicule</th><th>Chauffeur</th><th>Type</th><th>Volume (L)</th><th>Montant</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.daily.dispenses" :key="r.id">
                    <td>{{ fmtTime(r.time) }}</td>
                    <td>{{ r.station }}</td>
                    <td>{{ r.vehicle }}</td>
                    <td>{{ r.driver }}</td>
                    <td>{{ r.fuelType }}</td>
                    <td>{{ fmt(r.liters) }}</td>
                    <td>{{ fmtCost(r.cost) }}</td>
                  </tr>
                  <tr v-if="!data.daily.dispenses?.length"><td colspan="7" class="empty">Aucune sortie</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="sub-section">
            <h4 class="sub-section-title">Approvisionnements</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Heure</th><th>Station</th><th>Cuve</th><th>Fournisseur</th><th>Réf.</th><th>Volume (L)</th><th>Montant</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.daily.supplies" :key="r.id">
                    <td>{{ fmtTime(r.time) }}</td>
                    <td>{{ r.station }}</td>
                    <td>{{ r.tank }}</td>
                    <td>{{ r.supplier }}</td>
                    <td>{{ r.deliveryRef || '—' }}</td>
                    <td>{{ fmt(r.deliveredL) }}</td>
                    <td>{{ fmtCost(r.cost) }}</td>
                  </tr>
                  <tr v-if="!data.daily.supplies?.length"><td colspan="7" class="empty">Aucun approvisionnement</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </template>

      <!-- ──────── SYNTHÈSE ──────── -->
      <template v-if="activeCategory === 'synthesis'">
        <template v-if="activeSub === 'monthly' && data.monthly">
          <h3 class="section-date">{{ monthNames[data.monthly.period.month - 1] }} {{ data.monthly.period.year }}</h3>
          <div class="summary-cards">
            <div class="summary-card"><div class="summary-label">Volume distribué</div><div class="summary-value">{{ fmt(data.monthly.fuel.dispensesL) }} L</div></div>
            <div class="summary-card accent"><div class="summary-label">Coût carburant</div><div class="summary-value">{{ fmtCost(data.monthly.fuel.dispensesCost) }}</div></div>
            <div class="summary-card"><div class="summary-label">Coût maintenance</div><div class="summary-value">{{ fmtCost(data.monthly.maintenance.totalCost) }}</div></div>
            <div class="summary-card accent"><div class="summary-label">Coût opérationnel total</div><div class="summary-value">{{ fmtCost(data.monthly.totalOperationalCost) }}</div></div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-block">
              <div class="kpi-block-title">Carburant</div>
              <div class="kpi-row"><span>Approvisionnements (L)</span><strong>{{ fmt(data.monthly.fuel.suppliesL) }}</strong></div>
              <div class="kpi-row"><span>Transactions</span><strong>{{ data.monthly.fuel.transactions }}</strong></div>
              <div class="kpi-row"><span>Moy. par plein</span><strong>{{ fmt(data.monthly.fuel.avgPerTransaction) }} L</strong></div>
            </div>
            <div class="kpi-block">
              <div class="kpi-block-title">Flotte</div>
              <div class="kpi-row"><span>En service</span><strong class="text-green">{{ data.monthly.fleet.active }}</strong></div>
              <div class="kpi-row"><span>En réparation</span><strong class="text-orange">{{ data.monthly.fleet.inRepair }}</strong></div>
              <div class="kpi-row"><span>Hors service</span><strong class="text-red">{{ data.monthly.fleet.outOfService }}</strong></div>
            </div>
            <div class="kpi-block">
              <div class="kpi-block-title">Maintenance</div>
              <div class="kpi-row"><span>Opérations réalisées</span><strong>{{ data.monthly.maintenance.operations }}</strong></div>
              <div v-for="(count, type) in data.monthly.maintenance.byType" :key="type" class="kpi-row">
                <span>{{ type }}</span><strong>{{ count }}</strong>
              </div>
            </div>
            <div class="kpi-block">
              <div class="kpi-block-title">Alertes (30 prochains jours)</div>
              <div class="kpi-row"><span>Assurances à échéance</span><strong class="text-red">{{ data.monthly.alerts.insurancesExpiringSoon }}</strong></div>
              <div class="kpi-row"><span>Inspections à venir</span><strong class="text-orange">{{ data.monthly.alerts.inspectionsDueSoon }}</strong></div>
            </div>
          </div>
        </template>

        <template v-if="activeSub === 'fleet' && data.fleetReport">
          <div class="summary-cards">
            <div class="summary-card"><div class="summary-label">Véhicules actifs</div><div class="summary-value">{{ data.fleetReport.fleet.active }} / {{ data.fleetReport.fleet.totalVehicles }}</div></div>
            <div class="summary-card"><div class="summary-label">Chauffeurs</div><div class="summary-value">{{ data.fleetReport.fleet.totalDrivers }}</div></div>
            <div class="summary-card"><div class="summary-label">Stations</div><div class="summary-value">{{ data.fleetReport.fleet.totalStations }}</div></div>
            <div class="summary-card accent"><div class="summary-label">Coût total période</div><div class="summary-value">{{ fmtCost(data.fleetReport.totalCost) }}</div></div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-block">
              <div class="kpi-block-title">Carburant</div>
              <div class="kpi-row"><span>Volume distribué</span><strong>{{ fmt(data.fleetReport.fuel.totalL) }} L</strong></div>
              <div class="kpi-row"><span>Coût distribution</span><strong>{{ fmtCost(data.fleetReport.fuel.totalCost) }}</strong></div>
              <div class="kpi-row"><span>Volume approvisionné</span><strong>{{ fmt(data.fleetReport.fuel.suppliesL) }} L</strong></div>
            </div>
            <div class="kpi-block">
              <div class="kpi-block-title">Flotte</div>
              <div class="kpi-row"><span>En service</span><strong class="text-green">{{ data.fleetReport.fleet.active }}</strong></div>
              <div class="kpi-row"><span>En réparation</span><strong class="text-orange">{{ data.fleetReport.fleet.inRepair }}</strong></div>
              <div class="kpi-row"><span>Hors service</span><strong class="text-red">{{ data.fleetReport.fleet.outOfService }}</strong></div>
            </div>
            <div class="kpi-block">
              <div class="kpi-block-title">Maintenance</div>
              <div class="kpi-row"><span>Opérations</span><strong>{{ data.fleetReport.maintenance.operations }}</strong></div>
              <div class="kpi-row"><span>Coût total</span><strong>{{ fmtCost(data.fleetReport.maintenance.totalCost) }}</strong></div>
            </div>
            <div class="kpi-block">
              <div class="kpi-block-title">Alertes (30 jours)</div>
              <div class="kpi-row"><span>Inspections</span><strong class="text-orange">{{ data.fleetReport.alerts.inspections }}</strong></div>
              <div class="kpi-row"><span>Assurances</span><strong class="text-red">{{ data.fleetReport.alerts.insurances }}</strong></div>
            </div>
          </div>
          <div class="sub-section">
            <h4 class="sub-section-title">Consommation par véhicule</h4>
            <div class="table-wrapper">
              <table class="data-table">
                <thead><tr><th>Véhicule</th><th>Carburant</th><th>Statut</th><th>Km</th><th>Volume (L)</th><th>Coût carburant</th></tr></thead>
                <tbody>
                  <tr v-for="v in data.fleetReport.vehicles" :key="v.id">
                    <td><strong>{{ v.plate }}</strong><br/><small>{{ v.label }}</small></td>
                    <td>{{ v.fuelType }}</td>
                    <td><span class="badge" :class="statusClass(v.status)">{{ fmtStatus(v.status) }}</span></td>
                    <td>{{ fmt(v.odometerKm) }}</td>
                    <td>{{ fmt(v.fuelL) }}</td>
                    <td>{{ fmtCost(v.fuelCost) }}</td>
                  </tr>
                  <tr v-if="!data.fleetReport.vehicles?.length"><td colspan="6" class="empty">Aucun véhicule</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </template>

    </div><!-- /report-content -->

    <!-- ═══ PIED DE PAGE IMPRESSION ═══ -->
    <div class="print-footer">
      <span class="print-footer-left">{{ companyName }}</span>
      <span class="print-footer-center">
        Imprimé le {{ fmtDate(new Date()) }} par {{ currentUser?.fullName || currentUser?.name || 'Utilisateur' }}
      </span>
      <span class="print-footer-right">Page 1 / 1</span>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useAuthStore } from "../stores/auth";
import { useCompanyStore } from "../stores/company";
import api from "../services/api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const authStore    = useAuthStore();
const companyStore = useCompanyStore();

// ── Dates ──────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();
const startDate   = ref(`${currentYear}-01-01`);
const endDate     = ref(new Date().toISOString().slice(0, 10));
const dailyDate   = ref(new Date().toISOString().slice(0, 10));
const upcomingDays    = ref(60);
const alertDays       = ref(30);
const anomalyNorm     = ref(12);
const anomalyThreshold = ref(10);
const monthlyYear  = ref(currentYear);
const monthlyMonth = ref(new Date().getMonth() + 1);

const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// ── Filtre véhicule ────────────────────────────────────────────
const vehicles        = ref([]);   // liste chargée depuis l'API
const vehiclesLoading = ref(false);
const selectedVehicleId = ref(''); // '' = tous

// Onglets qui supportent le filtre véhicule
const VEHICLE_FILTER_TABS = new Set([
  'finances_expenses',
  'vehicles_activity',
  'vehicles_assignments',
  'maintenance_done',
  'audit_anomalies',
  'audit_daily',
  'synthesis_fleet',
]);

const showVehicleFilter = computed(() =>
  VEHICLE_FILTER_TABS.has(`${activeCategory.value}_${activeSub.value}`)
);

const selectedVehicleLabel = computed(() => {
  if (!selectedVehicleId.value) return '';
  const v = vehicles.value.find(v => v.id === selectedVehicleId.value);
  return v ? `${v.plate}${v.label ? ' — ' + v.label : ''}` : '';
});

async function loadVehicles() {
  if (vehicles.value.length) return;
  vehiclesLoading.value = true;
  try {
    const res = await api.get('/vehicles', { params: { limit: 500, status: 'all' } });

    // Couvre toutes les formes possibles de réponse API :
    // { data: [...] }
    // { data: { data: [...] } }
    // { data: { items: [...] } }
    // { data: { vehicles: [...] } }
    // { data: { rows: [...] } }
    const payload = res.data;
    let raw = null;

    if (Array.isArray(payload))              raw = payload;
    else if (Array.isArray(payload?.data))   raw = payload.data;
    else if (Array.isArray(payload?.data?.data))     raw = payload.data.data;
    else if (Array.isArray(payload?.data?.items))    raw = payload.data.items;
    else if (Array.isArray(payload?.data?.vehicles)) raw = payload.data.vehicles;
    else if (Array.isArray(payload?.data?.rows))     raw = payload.data.rows;
    else if (Array.isArray(payload?.items))          raw = payload.items;
    else if (Array.isArray(payload?.vehicles))       raw = payload.vehicles;
    else if (Array.isArray(payload?.rows))           raw = payload.rows;

    if (!raw || !raw.length) {
      console.warn('[ManagementReports] loadVehicles: liste vide ou structure inconnue', payload);
      vehicles.value = [];
      return;
    }

    // Normalise les champs pour le select — supporte id/vehicleId/_id et plate/licensePlate/immatriculation
    vehicles.value = raw.map(v => ({
      id:    v.id ?? v.vehicleId ?? v._id ?? '',
      plate: v.plate ?? v.licensePlate ?? v.immatriculation ?? v.registration ?? '—',
      label: v.label ?? ((v.make && v.model) ? `${String(v.make ?? '')} ${String(v.model ?? '')}`.trim() : (v.description ?? '')),
    })).filter(v => v.id && v.plate);

  } catch (e) {
    console.error('[ManagementReports] loadVehicles error:', e?.response?.status, e?.message);
    vehicles.value = [];
  } finally {
    vehiclesLoading.value = false;
  }
}

function clearVehicleFilter() {
  selectedVehicleId.value = '';
  fetchData();
}

// ── Navigation ─────────────────────────────────────────────────
const categories = [
  { id: "finances",    icon: "💰", label: "Finances",         subs: [{ id: "expenses",    label: "Dépenses carburant" }] },
  { id: "vehicles",    icon: "🚗", label: "Véhicules",        subs: [{ id: "assignments", label: "Affectations" }, { id: "activity", label: "Activités" }] },
  { id: "maintenance", icon: "🔧", label: "Maintenance",      subs: [{ id: "done", label: "Réalisés" }, { id: "upcoming", label: "À venir" }, { id: "alerts", label: "Alertes" }] },
  { id: "audit",       icon: "🔍", label: "Audit & Contrôle", subs: [{ id: "anomalies", label: "Anomalies" }, { id: "stock", label: "Rapprochement stock" }, { id: "daily", label: "Journalier" }] },
  { id: "synthesis",   icon: "📊", label: "Synthèse",         subs: [{ id: "monthly", label: "Tableau mensuel" }, { id: "fleet", label: "Rapport global" }] },
];

const activeCategory = ref("finances");
const activeSub      = ref("expenses");

const currentSubTabs = computed(() =>
  categories.find(c => c.id === activeCategory.value)?.subs || []
);

function switchCategory(catId) {
  activeCategory.value = catId;
  activeSub.value = categories.find(c => c.id === catId)?.subs[0]?.id || '';
  // Réinitialiser le filtre véhicule au changement de catégorie
  selectedVehicleId.value = '';
  fetchData();
}

// ── État ──────────────────────────────────────────────────────
const loading = ref(false);
const error   = ref(null);
const data    = ref({});

// ── Infos entreprise & utilisateur ────────────────────────────
const companyName    = computed(() => companyStore.settings?.companyName || 'FLEETENERGY');
const companyLogoUrl = computed(() => {
  const url = companyStore.settings?.logoUrl;
  if (!url) return '';
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  return url.startsWith('http') ? url : `${base}${url}`;
});
const currentUser = computed(() => {
  try { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; } catch { return null; }
});

// ── Print titles ──────────────────────────────────────────────
const printTitles = {
  finances_expenses:    'ÉTAT DES DÉPENSES EN CARBURANT',
  vehicles_assignments: 'ÉTAT DES AFFECTATIONS VÉHICULES / CHAUFFEURS',
  vehicles_activity:    'HISTORIQUE DES ACTIVITÉS PAR VÉHICULE',
  maintenance_done:     'ÉTAT DES ENTRETIENS RÉALISÉS',
  maintenance_upcoming: 'ÉTAT DES ENTRETIENS À VENIR',
  maintenance_alerts:   'ÉTAT DES ALERTES TECHNIQUES',
  audit_anomalies:      'ÉTAT DES ANOMALIES DÉTECTÉES',
  audit_stock:          'ÉTAT DE RAPPROCHEMENT STOCK',
  audit_daily:          'RAPPORT JOURNALIER DE STATION',
  synthesis_monthly:    'TABLEAU DE BORD MENSUEL',
  synthesis_fleet:      'RAPPORT GLOBAL DE GESTION DE FLOTTE',
};

const currentPrintTitle = computed(
  () => printTitles[`${activeCategory.value}_${activeSub.value}`] || 'RAPPORT DE GESTION'
);
const currentPrintPeriod = computed(() => {
  if (activeCategory.value === 'audit' && activeSub.value === 'daily')
    return `Journée du ${fmtDate(dailyDate.value)}`;
  if (activeCategory.value === 'synthesis' && activeSub.value === 'monthly')
    return `${monthNames[monthlyMonth.value - 1]} ${monthlyYear.value}`;
  return `Période : ${fmtDate(startDate.value)} au ${fmtDate(endDate.value)}`;
});

// ── Fetch data ────────────────────────────────────────────────
async function fetchData() {
  loading.value = true;
  error.value   = null;

  const cat = activeCategory.value;
  const sub = activeSub.value;

  const baseParams = { startDate: startDate.value, endDate: endDate.value };
  // Envoi au backend (fonctionne si le backend le supporte)
  const vehicleParam = selectedVehicleId.value
    ? { vehicleId: selectedVehicleId.value, vehicle_id: selectedVehicleId.value }
    : {};

  try {
    if (cat === 'finances' && sub === 'expenses') {
      const r = await api.get('/reports/financial/expenses', { params: { ...baseParams, ...vehicleParam } });
      data.value.expenses = applyVehicleFilter(r.data.data, {
        linesKey: 'lines', lineField: 'vehicle',
        byKey: 'byVehicle', byField: 'vehicle',
      });
    }
    else if (cat === 'vehicles' && sub === 'assignments') {
      const r = await api.get('/reports/vehicles/assignments', { params: { ...baseParams, ...vehicleParam } });
      data.value.assignments = applyVehicleFilterAssignments(r.data.data);
    }
    else if (cat === 'vehicles' && sub === 'activity') {
      const r = await api.get('/reports/vehicles/activity', { params: { ...baseParams, ...vehicleParam } });
      data.value.activity = applyVehicleFilterActivity(r.data.data);
    }
    else if (cat === 'maintenance' && sub === 'done') {
      const r = await api.get('/reports/maintenance/done', { params: { ...baseParams, ...vehicleParam } });
      data.value.maintenanceDone = applyVehicleFilterLines(r.data.data, 'lines');
    }
    else if (cat === 'maintenance' && sub === 'upcoming') {
      const r = await api.get('/reports/maintenance/upcoming', { params: { days: upcomingDays.value } });
      data.value.maintenanceUpcoming = r.data.data;
    }
    else if (cat === 'maintenance' && sub === 'alerts') {
      const r = await api.get('/reports/maintenance/alerts', { params: { days: alertDays.value } });
      data.value.maintenanceAlerts = r.data.data;
    }
    else if (cat === 'audit' && sub === 'anomalies') {
      const r = await api.get('/reports/audit/anomalies', { params: { ...baseParams, ...vehicleParam, norm: anomalyNorm.value, threshold: anomalyThreshold.value } });
      data.value.anomalies = applyVehicleFilterLines(r.data.data, 'anomalies');
    }
    else if (cat === 'audit' && sub === 'stock') {
      const r = await api.get('/reports/audit/stock');
      data.value.stock = r.data.data;
    }
    else if (cat === 'audit' && sub === 'daily') {
      const r = await api.get('/reports/audit/daily', { params: { date: dailyDate.value, ...vehicleParam } });
      data.value.daily = applyVehicleFilterDaily(r.data.data);
    }
    else if (cat === 'synthesis' && sub === 'monthly') {
      const r = await api.get('/reports/summary/monthly', { params: { year: monthlyYear.value, month: monthlyMonth.value } });
      data.value.monthly = r.data.data;
    }
    else if (cat === 'synthesis' && sub === 'fleet') {
      const r = await api.get('/reports/summary/fleet', { params: { ...baseParams, ...vehicleParam } });
      data.value.fleetReport = applyVehicleFilterLines(r.data.data, 'vehicles');
    }
  } catch (e) {
    const status = e?.response?.status;
    const msg    = e?.response?.data?.message || e?.response?.data?.error;
    if (status === 403)      error.value = 'Accès refusé (403) — votre rôle ne permet pas d\'accéder à ce rapport.';
    else if (status === 404) error.value = 'Route introuvable (404) — le backend doit être redémarré.';
    else if (status === 401) error.value = 'Session expirée — veuillez vous reconnecter.';
    else                     error.value = msg || e?.message || 'Erreur lors du chargement du rapport.';
  } finally {
    loading.value = false;
  }
}

// ── Helpers de filtrage frontend ──────────────────────────────

// Plaque et id du véhicule sélectionné
const selectedVehiclePlate = computed(() => {
  if (!selectedVehicleId.value) return '';
  return vehicles.value.find(v => String(v.id) === String(selectedVehicleId.value))?.plate ?? '';
});

/**
 * Vérifie si un objet ligne correspond au véhicule sélectionné.
 * Stratégie :
 *  1. Comparaison par ID (vehicleId, vehicle_id, id) — exact
 *  2. Comparaison par plaque (plate, vehicle, vehiclePlate) — exact ou partiel
 */
function matchesVehicle(row) {
  if (!selectedVehicleId.value) return true;
  if (!row) return false;

  const selId    = String(selectedVehicleId.value);
  const selPlate = selectedVehiclePlate.value.trim().toLowerCase();

  // 1. Comparaison par ID — le plus fiable
  const rowId = row.vehicleId ?? row.vehicle_id ?? row.id ?? row.vehiculeId;
  if (rowId != null && String(rowId) === selId) return true;

  // 2. Comparaison par plaque — fallback
  if (!selPlate) return false;
  const candidates = [row.plate, row.vehicle, row.vehiclePlate, row.vehiculeLabel, row.label];
  return candidates.some(c => c && String(c).toLowerCase().includes(selPlate));
}

// Filtre un tableau de lignes
function filterLines(arr) {
  if (!selectedVehicleId.value || !Array.isArray(arr)) return arr ?? [];
  return arr.filter(r => matchesVehicle(r));
}

// Filtre générique : lines + byVehicle + recalcule summary
function applyVehicleFilter(raw, { linesKey, lineField, byKey, byField }) {
  if (!raw || !selectedVehicleId.value) return raw;
  const lines  = filterLines(raw[linesKey]);
  const byList = filterLines(raw[byKey]);
  return {
    ...raw,
    [linesKey]: lines,
    [byKey]:    byList,
    summary: {
      ...raw.summary,
      totalL:        lines.reduce((s, r) => s + (Number(r.liters ?? r.totalL ?? r.deliveredL) || 0), 0),
      totalCost:     lines.reduce((s, r) => s + (Number(r.cost ?? r.totalCost) || 0), 0),
      count:         lines.length,
      totalSupplies: lines.length,
    },
  };
}

// Filtre un sous-tableau nommé d'un objet
function applyVehicleFilterLines(raw, key) {
  if (!raw || !selectedVehicleId.value) return raw;
  return { ...raw, [key]: filterLines(raw[key]) };
}

// Filtre pour les activités véhicule
function applyVehicleFilterActivity(raw) {
  if (!raw || !selectedVehicleId.value) return raw;
  const filtered = filterLines(raw.vehicles);
  return {
    ...raw,
    vehicles: filtered,
    summary: {
      ...raw.summary,
      totalVehicles:        filtered.length,
      totalFuelL:           filtered.reduce((s, v) => s + (Number(v.totalFuelL) || 0), 0),
      totalFuelCost:        filtered.reduce((s, v) => s + (Number(v.totalFuelCost) || 0), 0),
      totalMaintenanceCost: filtered.reduce((s, v) => s + (Number(v.totalMaintenanceCost) || 0), 0),
    },
  };
}

// Filtre pour les affectations
function applyVehicleFilterAssignments(raw) {
  if (!raw || !selectedVehicleId.value) return raw;
  const ua = filterLines(raw.userAssignments);
  const da = filterLines(raw.driverAssignments);
  return {
    ...raw,
    userAssignments:   ua,
    driverAssignments: da,
    summary: {
      activeUserAssignments:   ua.filter(r => r.active).length,
      activeDriverAssignments: da.filter(r => r.active).length,
    },
  };
}

// Filtre pour le journalier
function applyVehicleFilterDaily(raw) {
  if (!raw || !selectedVehicleId.value) return raw;
  const dispenses = filterLines(raw.dispenses);
  return {
    ...raw,
    dispenses,
    summary: {
      ...raw.summary,
      totalDispensesL:    dispenses.reduce((s, r) => s + (Number(r.liters) || 0), 0),
      totalDispensesCost: dispenses.reduce((s, r) => s + (Number(r.cost) || 0), 0),
    },
  };
}

function resetFilters() {
  startDate.value = `${currentYear}-01-01`;
  endDate.value   = new Date().toISOString().slice(0, 10);
  selectedVehicleId.value = '';
  fetchData();
}

onMounted(() => {
  companyStore.loadFromServer?.();
  loadVehicles();
  fetchData();
});

watch(dailyDate, fetchData);

// ── Helpers ───────────────────────────────────────────────────
function fmt(n)     { return n != null ? Number(n).toLocaleString('fr-FR') : '—'; }
function fmtCost(n) { return n != null ? Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' FCFA' : '—'; }
function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return '—'; } }
function fmtTime(d) { if (!d) return '—'; try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } }
function fmtStatus(s)  { return s === 'EN_SERVICE' ? 'En service' : s === 'EN_REPARATION' ? 'En réparation' : s === 'HORS_SERVICE' ? 'Hors service' : s; }
function statusClass(s){ return s === 'EN_SERVICE' ? 'badge-green' : s === 'EN_REPARATION' ? 'badge-orange' : 'badge-red'; }
function fmtUrgency(u) { return u === 'overdue' ? 'En retard' : u === 'expired' ? 'Expiré' : u === 'urgent' ? 'Urgent' : u === 'soon' ? 'Bientôt' : u === 'warning' ? 'À surveiller' : u === 'critical' ? 'Critique' : 'Normal'; }
function fmtAlertType(t){ return t === 'inspection' ? 'Inspection' : t === 'insurance' ? 'Assurance' : 'Maintenance'; }
function alertTypeIcon(t){ return t === 'inspection' ? '🔍' : t === 'insurance' ? '🛡️' : '🔧'; }

function printPage() { window.print(); }

// ── Export PDF ────────────────────────────────────────────────
async function exportPDF() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();

  let logoDataUrl = null;
  if (companyLogoUrl.value) {
    try {
      logoDataUrl = await new Promise((resolve) => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = companyLogoUrl.value;
      });
    } catch { logoDataUrl = null; }
  }

  function addHeader(doc) {
    const W = doc.internal.pageSize.getWidth();
    if (logoDataUrl) { try { doc.addImage(logoDataUrl, 'PNG', 10, 8, 20, 14); } catch {} }
    doc.setFontSize(10); doc.setTextColor(60, 60, 60);
    doc.text(companyName.value.toUpperCase(), 35, 15);
    doc.text(`Édité le ${fmtDate(new Date())}`, W - 14, 15, { align: 'right' });
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3); doc.line(10, 21, W - 10, 21);
    doc.setFontSize(14); doc.setTextColor(29, 78, 216);
    doc.text(currentPrintTitle.value, W / 2, 29, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text(currentPrintPeriod.value, W / 2, 35, { align: 'center' });
    // Mention du filtre véhicule dans le PDF si actif
    if (selectedVehicleLabel.value) {
      doc.setFontSize(8); doc.setTextColor(30, 64, 175);
      doc.text(`Véhicule : ${selectedVehicleLabel.value}`, W / 2, 40, { align: 'center' });
      doc.setDrawColor(29, 78, 216); doc.setLineWidth(0.5); doc.line(10, 44, W - 10, 44);
    } else {
      doc.setDrawColor(29, 78, 216); doc.setLineWidth(0.5); doc.line(10, 40, W - 10, 40);
    }
  }

  function addFooter(doc) {
    const W  = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const pc = doc.internal.getNumberOfPages();
    const userName = currentUser.value?.fullName || currentUser.value?.name || 'Utilisateur';
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text(companyName.value, 14, PH - 8);
      doc.text(`Imprimé par ${userName}`, W / 2, PH - 8, { align: 'center' });
      doc.text(`Page ${i} / ${pc}`, W - 14, PH - 8, { align: 'right' });
    }
  }

  addHeader(doc);

  const startY = selectedVehicleLabel.value ? 51 : 47;
  const tableConfig = buildPDFTable();
  if (tableConfig) {
    autoTable(doc, {
      head: [tableConfig.head],
      body: tableConfig.body,
      startY,
      margin: { left: 10, right: 10, bottom: 15 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      didDrawPage: (d) => { if (d.pageNumber > 1) addHeader(doc); },
    });
  }

  addFooter(doc);
  const slug = currentPrintTitle.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  doc.save(`${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function buildPDFTable() {
  const cat = activeCategory.value;
  const sub = activeSub.value;

  if (cat === 'finances' && sub === 'expenses' && data.value.expenses) {
    return {
      head: ['Date','Véhicule','Chauffeur','Station','Volume (L)','PU','Montant'],
      body: (data.value.expenses.lines || []).map(r => [fmtDate(r.date), r.vehicle, r.driver, r.station, fmt(r.liters), r.unitPrice ? fmt(r.unitPrice) : '—', fmtCost(r.cost)]),
    };
  }
  if (cat === 'vehicles' && sub === 'assignments' && data.value.assignments) {
    const rows = [
      ...(data.value.assignments.userAssignments || []).map(r => [r.userName, r.userRole, r.vehicle, fmtDate(r.assignedAt), r.unassignedAt ? fmtDate(r.unassignedAt) : '—', r.active ? 'Actif' : 'Terminé']),
      ...(data.value.assignments.driverAssignments || []).map(r => [r.driverName + ' (chauffeur)', r.licenseNo, r.vehicle, fmtDate(r.startDate), r.endDate ? fmtDate(r.endDate) : '—', r.active ? 'Actif' : 'Terminé']),
    ];
    return { head: ['Utilisateur / Chauffeur','Rôle / Permis','Véhicule','Début','Fin','Statut'], body: rows };
  }
  if (cat === 'vehicles' && sub === 'activity' && data.value.activity) {
    return {
      head: ['Véhicule','Statut','Km','Pleins','Vol. (L)','Coût carb.','Mainten.','Coût maint.','Coût total'],
      body: (data.value.activity.vehicles || []).map(v => [`${v.plate} ${v.make||''} ${v.model||''}`.trim(), fmtStatus(v.status), fmt(v.odometerKm), v.fuelEvents, fmt(v.totalFuelL), fmtCost(v.totalFuelCost), v.maintenanceEvents, fmtCost(v.totalMaintenanceCost), fmtCost(v.totalCost)]),
    };
  }
  if (cat === 'maintenance' && sub === 'done' && data.value.maintenanceDone) {
    return {
      head: ['Date','Véhicule','Type','Description','Km','Coût'],
      body: (data.value.maintenanceDone.lines || []).map(r => [fmtDate(r.date), `${r.vehicle} ${r.vehicleLabel}`.trim(), r.type, r.description || '—', r.odometerKm ? fmt(r.odometerKm) : '—', r.cost ? fmtCost(r.cost) : '—']),
    };
  }
  if (cat === 'maintenance' && sub === 'upcoming' && data.value.maintenanceUpcoming) {
    return {
      head: ['Véhicule','Type','Description','Échéance','Jours restants','Urgence'],
      body: (data.value.maintenanceUpcoming.lines || []).map(r => [`${r.vehicle} ${r.vehicleLabel}`.trim(), r.type, r.description || '—', r.dueAt ? fmtDate(r.dueAt) : '—', r.daysLeft !== null ? r.daysLeft + ' j' : '—', fmtUrgency(r.urgency)]),
    };
  }
  if (cat === 'maintenance' && sub === 'alerts' && data.value.maintenanceAlerts) {
    return {
      head: ['Type','Véhicule','Description','Échéance','Jours','Statut'],
      body: (data.value.maintenanceAlerts.alerts || []).map(r => [fmtAlertType(r.type), r.vehiclePlate, r.label, r.dueDate ? fmtDate(r.dueDate) : '—', r.daysLeft !== null ? r.daysLeft + ' j' : '—', fmtUrgency(r.status)]),
    };
  }
  if (cat === 'audit' && sub === 'anomalies' && data.value.anomalies) {
    return {
      head: ['Véhicule','Volume (L)','Km','Consomm. réelle','Norme','Écart %','Pleins','Sévérité'],
      body: (data.value.anomalies.anomalies || []).map(r => [`${r.plate} ${r.vehicleLabel}`.trim(), fmt(r.totalL), fmt(r.kmDriven), r.actualRate+' L/100km', r.normRate+' L/100km', (r.ecartPct > 0 ? '+' : '')+r.ecartPct+'%', r.fillCount, r.severity === 'critical' ? 'Critique' : 'Attention']),
    };
  }
  if (cat === 'audit' && sub === 'stock' && data.value.stock) {
    return {
      head: ['Station','Cuve','Type','Réel (L)','Théorique (L)','Écart (L)','Écart %','Remplissage','Statut'],
      body: (data.value.stock.tanks || []).map(r => [r.station, r.tankName, r.fuelType, fmt(r.currentL), fmt(r.theoreticalL), (r.ecartL >= 0 ? '+' : '')+fmt(r.ecartL), r.ecartPct !== null ? r.ecartPct+'%' : '—', r.fillPct+'%', r.status === 'critical' ? 'Critique' : r.status === 'warning' ? 'Attention' : 'OK']),
    };
  }
  if (cat === 'audit' && sub === 'daily' && data.value.daily) {
    return {
      head: ['Heure','Station','Véhicule','Chauffeur','Type','Volume (L)','Montant'],
      body: (data.value.daily.dispenses || []).map(r => [fmtTime(r.time), r.station, r.vehicle, r.driver, r.fuelType, fmt(r.liters), fmtCost(r.cost)]),
    };
  }
  if (cat === 'synthesis' && sub === 'fleet' && data.value.fleetReport) {
    return {
      head: ['Véhicule','Carburant','Statut','Km','Volume (L)','Coût carburant'],
      body: (data.value.fleetReport.vehicles || []).map(v => [`${v.plate} ${v.label}`.trim(), v.fuelType, fmtStatus(v.status), fmt(v.odometerKm), fmt(v.fuelL), fmtCost(v.fuelCost)]),
    };
  }
  return null;
}
</script>

<style>
@page {
  margin-top: 10mm;
  margin-bottom: 22mm;
  margin-left: 10mm;
  margin-right: 10mm;
}
@media print {
  .topbar, .sidebar, .sidebar-overlay, .app-footer, .no-print { display: none !important; }
  .body   { padding: 0 !important; margin: 0 !important; }
  .layout { display: block !important; }
  main    { padding: 0 !important; margin: 0 !important; }
}
</style>

<style scoped>
.mgmt-reports { padding: 1.5rem; font-family: inherit; }

/* ══ PRINT ══ */
.print-header { display: none; }
.print-footer { display: none; }

@media print {
  .print-header {
    display: block !important;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
  .print-header-top { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
  .print-logo-img   { height: 48px; object-fit: contain; }
  .print-company-name { font-size: 1.1rem; font-weight: 700; color: #1e3a8a; }
  .print-title-bar  { font-size: 1rem; font-weight: 700; color: #1d4ed8; text-align: center; text-transform: uppercase; border-top: 2px solid #1d4ed8; border-bottom: 2px solid #1d4ed8; padding: 0.3rem 0; margin: 0.4rem 0; }
  .print-period     { text-align: center; font-size: 0.8rem; color: #555; margin-bottom: 0.25rem; }
  .print-vehicle-filter { text-align: center; font-size: 0.75rem; color: #1d4ed8; font-weight: 600; margin-bottom: 0.5rem; }

  .print-footer {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    font-size: 0.7rem;
    color: #666;
    border-top: 1px solid #ccc;
    padding-top: 0.3rem;
    position: fixed;
    bottom: 6mm;
    left: 0; right: 0;
    padding: 4px 10mm 0;
    background: #fff;
    height: 14px;
  }
  .print-footer-left   { flex: 1; text-align: left; }
  .print-footer-center { flex: 1; text-align: center; }
  .print-footer-right  { flex: 0 0 auto; text-align: right; font-weight: 600; color: #475569; padding-left: 12px; }

  .mgmt-reports { padding: 0 0 18mm 0; max-width: 100%; }
  .data-table th, .data-table td { padding: 4px 6px !important; font-size: 0.75rem !important; }
  .summary-cards {
    display: flex !important;
    flex-direction: row !important;
    gap: 0 !important;
    margin-bottom: 8px !important;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }
  .summary-card {
    flex: 1;
    padding: 5px 10px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 2px !important;
    border-right: 1px solid #e2e8f0 !important;
    border-left: none !important;
    border-top: none !important;
    border-bottom: none !important;
    border-radius: 0 !important;
  }
  .summary-card:last-child { border-right: none !important; }
  .summary-card.accent  { border-top: 3px solid #1d4ed8 !important; }
  .summary-card.red     { border-top: 3px solid #ef4444 !important; }
  .summary-card.orange  { border-top: 3px solid #f97316 !important; }
  .summary-card.yellow  { border-top: 3px solid #eab308 !important; }
  .summary-label { font-size: 0.62rem !important; margin: 0 !important; line-height: 1.2; }
  .summary-value { font-size: 0.9rem !important; font-weight: 700 !important; margin: 0 !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}

/* ══ VEHICLE FILTER ══ */
.vehicle-select-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}
.filter-select {
  padding: 0.375rem 0.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #1e293b;
  background: #fff;
  min-width: 180px;
  max-width: 260px;
}
.vehicle-clear-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 2px 4px;
  border-radius: 4px;
  line-height: 1;
}
.vehicle-clear-btn:hover { background: #fee2e2; color: #dc2626; }
.vehicle-loading-dot {
  display: inline-block;
  width: 8px; height: 8px;
  background: #1d4ed8;
  border-radius: 50%;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.3 } }

/* Chip filtre actif */
.active-filters { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
.active-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}
.chip-clear {
  background: none;
  border: none;
  color: #93c5fd;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0;
  line-height: 1;
}
.chip-clear:hover { color: #1d4ed8; }

/* ══ HEADER PAGE ══ */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
.page-title  { font-size: 1.5rem; font-weight: 700; color: #1e3a8a; margin: 0 0 0.25rem; }
.page-subtitle { color: #64748b; font-size: 0.875rem; margin: 0; }
.page-header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

/* ══ TABS ══ */
.category-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.cat-tab       { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border: 2px solid #e2e8f0; border-radius: 0.5rem; background: white; cursor: pointer; font-size: 0.875rem; color: #475569; transition: all 0.15s; }
.cat-tab:hover { border-color: #93c5fd; color: #1d4ed8; }
.cat-tab.active { background: #1d4ed8; border-color: #1d4ed8; color: white; font-weight: 600; }
.cat-icon  { font-size: 1rem; }

.sub-tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; background: #f1f5f9; border-radius: 0.5rem; padding: 0.25rem; }
.sub-tab  { padding: 0.375rem 0.875rem; border: none; border-radius: 0.375rem; background: transparent; cursor: pointer; font-size: 0.8rem; color: #475569; }
.sub-tab.active { background: white; font-weight: 600; color: #1d4ed8; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

/* ══ FILTRES ══ */
.filters-bar   { display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1rem; flex-wrap: wrap; }
.filter-group  { display: flex; flex-direction: column; gap: 0.25rem; }
.filter-group label { font-size: 0.75rem; color: #64748b; font-weight: 500; }
.filter-group input, .filter-group select { padding: 0.375rem 0.625rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.875rem; color: #1e293b; }

/* ══ BOUTONS ══ */
.btn { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.15s; }
.btn-sm      { padding: 0.375rem 0.75rem; font-size: 0.8rem; }
.btn-primary { background: #1d4ed8; color: white; }
.btn-primary:hover { background: #1e3a8a; }
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
.btn-secondary:hover { background: #e2e8f0; }

/* ══ LOADING / ERROR ══ */
.loading-state { display: flex; align-items: center; gap: 0.75rem; padding: 3rem; justify-content: center; color: #64748b; }
.spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #1d4ed8; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { text-align: center; padding: 2rem; color: #dc2626; }

/* ══ SUMMARY CARDS ══ */
.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.summary-card  { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; text-align: center; }
.summary-card.accent { background: #eff6ff; border-color: #bfdbfe; }
.summary-card.red    { background: #fef2f2; border-color: #fecaca; }
.summary-card.orange { background: #fff7ed; border-color: #fed7aa; }
.summary-card.yellow { background: #fefce8; border-color: #fde68a; }
.summary-label { font-size: 0.75rem; color: #64748b; margin-bottom: 0.25rem; }
.summary-value { font-size: 1.25rem; font-weight: 700; color: #1e3a8a; }

/* ══ TABLES ══ */
.sub-section        { margin-bottom: 1.5rem; }
.sub-section-title  { font-size: 0.9rem; font-weight: 600; color: #334155; margin: 0 0 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid #e2e8f0; }
.table-wrapper      { overflow-x: auto; border-radius: 0.5rem; border: 1px solid #e2e8f0; }
.data-table         { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.data-table th      { background: #f8fafc; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.data-table th.num  { text-align: right; }
.data-table td      { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.data-table td.num  { text-align: right; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: #f8fafc; }
.empty              { text-align: center; color: #94a3b8; padding: 1.5rem !important; }

/* ══ BADGES ══ */
.badge        { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 1rem; font-size: 0.7rem; font-weight: 600; background: #e2e8f0; color: #475569; }
.badge-green  { background: #dcfce7; color: #166534; }
.badge-orange { background: #ffedd5; color: #9a3412; }
.badge-red    { background: #fee2e2; color: #991b1b; }
.status-dot   { padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.7rem; font-weight: 600; }
.status-dot.green { background: #dcfce7; color: #166534; }
.status-dot.grey  { background: #f1f5f9; color: #64748b; }

.urgency-badge   { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.7rem; font-weight: 600; }
.urgency-overdue, .urgency-expired, .urgency-critical { background: #fee2e2; color: #991b1b; }
.urgency-urgent  { background: #ffedd5; color: #9a3412; }
.urgency-soon, .urgency-warning { background: #fefce8; color: #92400e; }
.urgency-normal  { background: #f0fdf4; color: #166534; }

/* ══ COULEURS LIGNES ══ */
.row-overdue td, .row-alert-overdue td, .row-alert-expired td { background: #fff5f5 !important; }
.row-urgent  td { background: #fff7ed !important; }
.row-soon    td { background: #fefce8 !important; }
.row-anomaly-critical td { background: #fff5f5 !important; }
.row-stock-critical td  { background: #fff5f5 !important; }
.row-stock-warning  td  { background: #fff7ed !important; }

.text-red    { color: #dc2626 !important; }
.text-green  { color: #16a34a !important; }
.text-orange { color: #ea580c !important; }

/* ══ KPI GRID ══ */
.kpi-grid  { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-block { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; }
.kpi-block-title { font-weight: 700; color: #1e3a8a; font-size: 0.85rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid #bfdbfe; }
.kpi-row   { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.8rem; color: #475569; border-bottom: 1px solid #f1f5f9; }
.kpi-row:last-child { border-bottom: none; }
.kpi-row strong { font-weight: 600; color: #1e293b; }

/* ══ PROGRESS BAR ══ */
.progress-bar { background: #e2e8f0; border-radius: 1rem; height: 6px; width: 80px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 4px; }
.progress-fill { height: 100%; background: #1d4ed8; border-radius: 1rem; }
.progress-fill.low { background: #dc2626; }

.section-date { color: #1e3a8a; font-size: 1rem; font-weight: 600; margin: 0 0 1rem; }
small { color: #94a3b8; font-size: 0.75rem; }

@media (max-width: 640px) {
  .category-tabs { gap: 0.25rem; }
  .cat-tab { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
  .cat-label { display: none; }
  .mgmt-reports { padding: 1rem; }
  .filter-select { min-width: 140px; }
}
</style>
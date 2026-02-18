<template>
  <div class="dashboard-container">
    <!-- Notifications -->
    <Transition name="fade">
      <div v-if="error || successMessage" :class="['notification', error ? 'notification-error' : 'notification-success']">
        <div class="noti-content">
          <span class="status-icon">{{ error ? '⚠️' : '✅' }}</span>
          <div class="noti-text">
            <p class="noti-title">{{ error ? 'Erreur' : 'Succès' }}</p>
            <p class="noti-message">{{ error || successMessage }}</p>
          </div>
        </div>
        <button @click="clearMessages" class="notification-close">×</button>
      </div>
    </Transition>

    <!-- Modal de modification -->
    <Transition name="modal">
      <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
        <div class="modal-content glass-modal">
          <div class="modal-header">
            <div class="modal-header-icon">
              <span>✏️</span>
            </div>
            <div class="modal-header-text">
              <h3>Modifier le Contrat d'Assurance</h3>
              <p class="modal-subtitle">POL-{{ editForm.policyNo }} • {{ getVehiclePlate(selectedItem?.vehicleId) }}</p>
            </div>
            <button @click="closeEditModal" class="modal-close">×</button>
          </div>
          
          <div class="modal-body">
            <div class="modal-grid">
              <!-- Informations fixes -->
              <div class="modal-section">
                <h4 class="section-title">
                  <span class="section-icon">📋</span>
                  Informations du contrat
                </h4>
                <div class="fixed-info-grid">
                  <div class="fixed-info-item">
                    <span class="fixed-info-label">Véhicule</span>
                    <span class="fixed-info-value highlight-bg">
                      <span class="info-icon">🚗</span>
                      {{ getVehiclePlate(selectedItem?.vehicleId) }}
                    </span>
                  </div>
                  <div class="fixed-info-item">
                    <span class="fixed-info-label">Créé le</span>
                    <span class="fixed-info-value">
                      <span class="info-icon">📅</span>
                      {{ formatDateTime(selectedItem?.createdAt) }}
                    </span>
                  </div>
                  <div class="fixed-info-item">
                    <span class="fixed-info-label">Statut</span>
                    <span :class="['fixed-info-value status-badge', getDaysRemainingClass(selectedItem?.endAt)]">
                      <span class="info-icon">{{ getDaysRemainingIcon(selectedItem?.endAt) }}</span>
                      {{ getDaysRemainingText(selectedItem?.endAt) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Champs modifiables -->
              <div class="modal-section">
                <h4 class="section-title">
                  <span class="section-icon">🔄</span>
                  Informations modifiables
                </h4>
                <div class="edit-form-grid">
                  <div class="form-group">
                    <label class="form-label">
                      <span class="label-icon">🏢</span>
                      Assureur *
                    </label>
                    <select v-model="editForm.insurerId" class="modern-input modal-input" :disabled="!canModify(selectedItem?.createdAt)">
                      <option value="" disabled>Choisir un assureur...</option>
                      <option v-for="ins in insurers" :key="ins.id" :value="ins.id">{{ ins.name }}</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label class="form-label">
                      <span class="label-icon">🛡️</span>
                      Type de couverture *
                    </label>
                    <select v-model="editForm.insurancesType" class="modern-input modal-input" :disabled="!canModify(selectedItem?.createdAt)">
                      <option value="RC">Responsabilité Civile (RC)</option>
                      <option value="TIERS">Tiers Simple</option>
                      <option value="INTERMEDIAIRE">Intermédiaire</option>
                      <option value="TOUS_RISQUES">Tous Risques</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label class="form-label">
                      <span class="label-icon">🔢</span>
                      N° de Police *
                    </label>
                    <div class="input-with-prefix">
                      <span class="input-prefix">POL-</span>
                      <input v-model="editForm.policyNo" type="text" class="modern-input modal-input" 
                             :disabled="!canModify(selectedItem?.createdAt)" />
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">
                      <span class="label-icon">💵</span>
                      Coût annuel (FCFA) *
                    </label>
                    <div class="input-with-suffix">
                      <input type="number" v-model.number="editForm.premium" class="modern-input modal-input" 
                             :disabled="!canModify(selectedItem?.createdAt)" />
                      <span class="input-suffix">FCFA</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Période modifiable -->
              <div class="modal-section">
                <h4 class="section-title">
                  <span class="section-icon">📅</span>
                  Période du contrat
                </h4>
                <div class="period-edit-grid">
                  <div class="form-group">
                    <label class="form-label">
                      <span class="label-icon">⏱️</span>
                      Durée
                    </label>
                    <div class="duration-input-modal">
                      <input type="number" v-model.number="editForm.durationValue" class="modern-input num-input" min="1" 
                             :disabled="!canModify(selectedItem?.createdAt)" />
                      <select v-model="editForm.durationUnit" class="modern-input unit-select" 
                              :disabled="!canModify(selectedItem?.createdAt)">
                        <option value="months">Mois</option>
                        <option value="years">Années</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">
                      <span class="label-icon">📅</span>
                      Date de début
                    </label>
                    <input type="date" v-model="editForm.startAt" class="modern-input modal-input"
                           :disabled="!canModify(selectedItem?.createdAt)" @change="calculateEditEndDate" />
                  </div>

                  <div class="form-group">
                    <label class="form-label">
                      <span class="label-icon">⏰</span>
                      Date d'échéance
                    </label>
                    <div class="date-display-modal">
                      <input type="date" v-model="editForm.endAt" class="modern-input modal-input" readonly 
                             :class="getDateFieldClass(editForm.endAt)" />
                      <span class="date-info-small">Calculée automatiquement</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Info modification -->
              <div class="modal-info-section">
                <div class="modification-status-card" :class="canModify(selectedItem?.createdAt) ? 'status-active' : 'status-locked'">
                  <div class="status-icon-large">
                    {{ canModify(selectedItem?.createdAt) ? '✅' : '🔒' }}
                  </div>
                  <div class="status-content">
                    <h4 class="status-title">{{ canModify(selectedItem?.createdAt) ? 'Modification autorisée' : 'Modification verrouillée' }}</h4>
                    <p class="status-text">
                      {{ canModify(selectedItem?.createdAt) 
                        ? `Vous pouvez modifier ce contrat jusqu'au ${formatDate(getModificationDeadline(selectedItem?.createdAt))}` 
                        : `Les modifications sont verrouillées depuis le ${formatDate(getModificationDeadline(selectedItem?.createdAt))}` }}
                    </p>
                    <div class="time-remaining" v-if="canModify(selectedItem?.createdAt)">
                      <span class="time-icon">⏳</span>
                      <span class="time-text">
                        Temps restant : {{ getRemainingModificationTime(selectedItem?.createdAt).hours }}h 
                        {{ getRemainingModificationTime(selectedItem?.createdAt).minutes }}min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <div class="modal-footer-content">
              <button @click="closeEditModal" class="btn-cancel">
                <span class="btn-icon">←</span>
                <span class="btn-text">Annuler</span>
              </button>
              <div class="footer-actions">
                <button @click="updateContract" :disabled="!canModify(selectedItem?.createdAt) || updating" 
                        class="btn-save" :class="{ 'btn-disabled': !canModify(selectedItem?.createdAt) }">
                  <span v-if="!updating" class="btn-icon">💾</span>
                  <span v-if="!updating" class="btn-text">Enregistrer les modifications</span>
                  <span v-if="updating" class="loading-spinner-small"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Chargement -->
    <div v-if="loading && !items.length" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner-large"></div>
        <p>Chargement des données...</p>
      </div>
    </div>

    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-main">
          <h1 class="title">
            <span class="title-icon">🛡️</span>
            Gestion des Assurances
          </h1>
          <p class="subtitle">Flotte Automobile • {{ today }}</p>
        </div>
        <div class="header-actions">
          <button @click="load" class="refresh-btn" :class="{ rotating: loading }" :disabled="loading">
            <span class="refresh-icon">{{ loading ? '⏳' : '🔄' }}</span>
            <span class="refresh-text">{{ loading ? 'Chargement...' : 'Actualiser' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- KPI Grid -->
    <div class="kpi-grid">
      <div class="kpi-card glass premium framed-card">
        <div class="kpi-content">
          <div class="kpi-icon-wrapper framed-icon">
            <span class="kpi-icon">📄</span>
          </div>
          <div class="kpi-text">
            <span class="label">Polices actives</span>
            <h3 class="value">{{ items.length }}</h3>
          </div>
        </div>
        <div class="kpi-trend">
          <span class="trend-text">Total contrats</span>
        </div>
      </div>
      
      <div class="kpi-card glass premium framed-card">
        <div class="kpi-content">
          <div class="kpi-icon-wrapper framed-icon">
            <span class="kpi-icon">💰</span>
          </div>
          <div class="kpi-text">
            <span class="label">Montant total</span>
            <h3 class="value">{{ formatCompactCurrency(totalPremium) }}</h3>
          </div>
        </div>
        <div class="kpi-trend">
          <span class="trend-text">Somme assurée</span>
        </div>
      </div>
      
      <div class="kpi-card glass warning framed-card">
        <div class="kpi-content">
          <div class="kpi-icon-wrapper framed-icon">
            <span class="kpi-icon">⏳</span>
          </div>
          <div class="kpi-text">
            <span class="label">À renouveler</span>
            <h3 class="value">{{ upcomingRenewals }}</h3>
          </div>
        </div>
        <div class="kpi-trend">
          <span class="trend-text">30 prochains jours</span>
        </div>
      </div>
      
      <div class="kpi-card glass danger framed-card">
        <div class="kpi-content">
          <div class="kpi-icon-wrapper framed-icon">
            <span class="kpi-icon">🚨</span>
          </div>
          <div class="kpi-text">
            <span class="label">Expirées</span>
            <h3 class="value">{{ expiredCount }}</h3>
          </div>
        </div>
        <div class="kpi-trend">
          <span class="trend-text">Action requise</span>
        </div>
      </div>
    </div>

    <!-- Formulaire de création -->
    <section class="form-section card framed-card">
      <div class="form-header">
        <div class="form-header-icon framed-icon">
          <span>📋</span>
        </div>
        <div class="form-header-text">
          <h3>Nouveau Contrat d'Assurance</h3>
          <p>Remplissez les informations pour ajouter une nouvelle police</p>
        </div>
      </div>
      
      <div class="form-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">🚗</span>
              Véhicule *
            </label>
            <div class="select-wrapper framed-input">
              <select v-model="form.vehicleId" class="modern-input select-filled" :class="{ 'input-error': !form.vehicleId && submitted }" @change="onVehicleChange">
                <option value="" disabled>Choisir un véhicule...</option>
                <option v-for="v in vehicles" :key="v.id" :value="v.id">
                  {{ v.plate }} - {{ v.model || 'Modèle non spécifié' }} ({{ getVehicleStatus(v) }})
                </option>
              </select>
              <div class="select-arrow">▼</div>
            </div>
            <!-- Indicateur d'assurance en cours -->
            <div v-if="form.vehicleId" class="insurance-status-info framed-section">
              <div v-if="hasActiveInsurance(form.vehicleId)" class="warning-status">
                <span class="status-icon">⚠️</span>
                <div class="status-details">
                  <p class="status-title">Une assurance est en cours</p>
                  <p class="status-description">
                    POL-{{ getActiveInsurance(form.vehicleId)?.policyNo }} • 
                    Valide jusqu'au {{ formatDate(getActiveInsurance(form.vehicleId)?.endAt) }}
                  </p>
                  <p v-if="dates.start && new Date(dates.start) > new Date()" class="status-note">
                    <span class="note-icon">📅</span>
                    Cette nouvelle assurance sera visible à partir du {{ formatDate(dates.start) }}
                  </p>
                  <p v-else-if="dates.start" class="status-note">
                    <span class="note-icon">🔄</span>
                    Cette assurance remplacera l'ancienne immédiatement
                  </p>
                </div>
              </div>
              <div v-else class="success-status">
                <span class="status-icon">✅</span>
                <div class="status-details">
                  <p class="status-title">Aucune assurance en cours</p>
                  <p class="status-description">
                    Ce véhicule peut être assuré immédiatement
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">🏢</span>
              Assureur *
            </label>
            <div class="select-wrapper framed-input">
              <select v-model="form.insurerId" class="modern-input select-filled" @change="handleInsurerChange" 
                      :class="{ 'input-error': !form.insurerId && submitted }">
                <option value="" disabled>Choisir un assureur...</option>
                <option v-for="ins in insurers" :key="ins.id" :value="ins.id">
                  {{ ins.name }}
                </option>
                <option value="NEW" class="opt-new">+ Nouvel assureur</option>
              </select>
              <div class="select-arrow">▼</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">🛡️</span>
              Type de couverture *
            </label>
            <div class="select-wrapper framed-input">
              <select v-model="form.insurancesType" class="modern-input select-filled">
                <option value="RC">Responsabilité Civile (RC)</option>
                <option value="TIERS">Tiers Simple</option>
                <option value="INTERMEDIAIRE">Intermédiaire</option>
                <option value="TOUS_RISQUES">Tous Risques</option>
              </select>
              <div class="select-arrow">▼</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">🔢</span>
              N° de Police *
            </label>
            <div class="input-with-prefix framed-input">
              <span class="input-prefix">POL-</span>
              <input v-model="form.policyNo" type="text" class="modern-input" 
                     placeholder="2025-001" :class="{ 'input-error': !form.policyNo && submitted }" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">📅</span>
              Durée du contrat *
            </label>
            <div class="duration-group framed-input">
              <div class="duration-input">
                <input type="number" v-model.number="durationValue" class="modern-input num-input" min="1" 
                       @input="calculateEndDate" />
                <select v-model="durationUnit" class="modern-input unit-select" @change="calculateEndDate">
                  <option value="months">Mois</option>
                  <option value="years">Années</option>
                </select>
                <input type="date" v-model="dates.start" @change="calculateEndDate" 
                       class="modern-input date-start" />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">📆</span>
              Échéance (auto)
            </label>
            <div class="date-display framed-input">
              <input type="date" v-model="dates.end" class="modern-input date-display-field" readonly 
                     :class="getDateFieldClass(dates.end)" />
              <span class="date-info">Calculée automatiquement</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <span class="label-icon">💵</span>
              Coût annuel (FCFA) *
            </label>
            <div class="input-with-suffix framed-input">
              <input type="number" v-model.number="form.premium" class="modern-input" 
                     placeholder="0" :class="{ 'input-error': (!form.premium || form.premium <= 0) && submitted }" />
              <span class="input-suffix">FCFA</span>
            </div>
          </div>
        </div>

        <Transition name="slide-fade">
          <div v-if="showNewInsurerInput" class="new-insurer-form framed-section">
            <div class="new-insurer-header">
              <span class="new-insurer-icon framed-icon-small">➕</span>
              <h4>Nouvel assureur</h4>
            </div>
            <div class="new-insurer-body">
              <input v-model="newInsurerName" placeholder="Nom de l'assureur..." 
                     class="modern-input insurer-name-input framed-input" @keyup.enter="saveNewInsurer" />
              <button @click="saveNewInsurer" class="btn-save-insurer" :disabled="!newInsurerName.trim()">
                <span class="btn-icon">✓</span>
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </Transition>

        <div class="form-footer">
          <button @click="create" :disabled="submitting || !form.vehicleId || !form.insurerId || !form.policyNo || !form.premium" 
                  class="btn-submit framed-btn" :class="{ 'btn-loading': submitting }">
            <span class="btn-content">
              <span v-if="!submitting" class="btn-icon">⚡</span>
              <span v-if="!submitting" class="btn-text">Valider le contrat</span>
              <span v-if="submitting" class="loading-spinner"></span>
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- Historique des Polices -->
    <main class="table-section">
      <div class="table-card card framed-card">
        <div class="table-header">
          <div class="table-header-left">
            <div class="table-title-wrapper">
              <h3 class="table-title">Historique des polices</h3>
              <span class="table-count framed-badge">{{ filteredItems.length }} contrats</span>
            </div>
            <div class="table-filters">
              <div class="period-filter framed-input">
                <div class="period-input">
                  <label><span class="filter-icon">📅</span> Du:</label>
                  <input type="date" v-model="filterDates.from" class="date-input" />
                </div>
                <div class="period-input">
                  <label><span class="filter-icon">📅</span> Au:</label>
                  <input type="date" v-model="filterDates.to" class="date-input" />
                </div>
                <button v-if="filterDates.from || filterDates.to" @click="resetDateFilter" class="btn-clear">
                  <span class="clear-icon">✕</span>
                  Effacer
                </button>
              </div>
            </div>
          </div>
          
          <div class="table-header-right">
            <div class="search-box framed-input">
              <span class="search-icon">🔍</span>
              <input v-model="searchQuery" type="text" placeholder="Rechercher une plaque..." 
                     class="search-input" />
            </div>
            <div class="status-filter-wrapper framed-input">
              <select v-model="filterStatus" class="status-filter">
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="expiring">Expirent bientôt</option>
                <option value="expired">Expirés</option>
              </select>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="dashboard-table">
            <thead>
              <tr>
                <th class="col-vehicle">
                  <span class="th-icon">🚗</span>
                  Véhicule
                </th>
                <th class="col-insurer">
                  <span class="th-icon">🏢</span>
                  Assureur
                </th>
                <th class="col-period">
                  <span class="th-icon">📅</span>
                  Période
                </th>
                <th class="col-status">
                  <span class="th-icon">🔄</span>
                  Statut
                </th>
                <th class="col-premium">
                  <span class="th-icon">💰</span>
                  Coût
                </th>
                <th class="col-modification">
                  <span class="th-icon">⚙️</span>
                  Modifiable
                </th>
                <th class="col-actions">
                  <span class="th-icon">🔧</span>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in paginatedItems" :key="it.id" :class="getRowClass(it.endAt)">
                <td class="cell-vehicle">
                  <div class="vehicle-info">
                    <span class="vehicle-icon">🚗</span>
                    <div class="vehicle-details">
                      <span class="plate-tag framed-badge">{{ it.vehicle?.plate }}</span>
                      <span class="vehicle-type">{{ formatInsuranceType(it.insurancesType) }}</span>
                      <span v-if="it.vehicle?.status" :class="['vehicle-status', getVehicleStatusClass(it.vehicle)]">
                        {{ getVehicleStatus(it.vehicle) }}
                      </span>
                    </div>
                  </div>
                </td>
                
                <td class="cell-insurer">
                  <div class="insurer-info">
                    <span class="insurer-name">{{ it.insurer?.name || 'Inconnu' }}</span>
                    <span class="policy-number framed-text">N° {{ it.policyNo || '—' }}</span>
                  </div>
                </td>
                
                <td class="cell-period">
                  <div class="period-info">
                    <span class="period-dates">{{ formatDate(it.startAt) }} → {{ formatDate(it.endAt) }}</span>
                  </div>
                </td>
                
                <td class="cell-status">
                  <span :class="['status-pill', 'framed-pill', getDaysRemainingClass(it.endAt)]">
                    <span class="pill-icon">{{ getDaysRemainingIcon(it.endAt) }}</span>
                    {{ getDaysRemainingText(it.endAt) }}
                  </span>
                </td>
                
                <td class="cell-premium">
                  <div class="premium-info">
                    <span class="premium-value framed-text">{{ formatCurrency(it.premium) }}</span>
                  </div>
                </td>
                
                <td class="cell-modification">
                  <div class="modification-status">
                    <span v-if="canModify(it.createdAt)" class="modify-allowed framed-status allowed">
                      <span class="status-icon">✅</span>
                      <span class="status-text">Modifiable</span>
                      <span class="status-time">Jusqu'au {{ formatDate(getModificationDeadline(it.createdAt)) }}</span>
                    </span>
                    <span v-else class="modify-locked framed-status locked">
                      <span class="status-icon">🔒</span>
                      <span class="status-text">Verrouillé</span>
                      <span class="status-time">Depuis le {{ formatDate(getModificationDeadline(it.createdAt)) }}</span>
                    </span>
                  </div>
                </td>
                
                <td class="cell-actions">
                  <div class="action-buttons">
                    <button @click="openEditModal(it)" 
                            class="action-btn btn-edit framed-btn" 
                            :disabled="!canModify(it.createdAt)"
                            :title="canModify(it.createdAt) ? 'Modifier le contrat' : 'Verrouillé après 3 jours'">
                      <span class="action-icon">✏️</span>
                      <span class="action-text">Modifier</span>
                    </button>
                    <button @click="remove(it)" 
                            class="action-btn btn-delete framed-btn" 
                            :disabled="!canModify(it.createdAt)"
                            :title="canModify(it.createdAt) ? 'Supprimer le contrat' : 'Verrouillé après 3 jours'">
                      <span class="action-icon">🗑️</span>
                      <span class="action-text">Supprimer</span>
                    </button>
                  </div>
                </td>
              </tr>
              
              <tr v-if="filteredItems.length === 0">
                <td colspan="7" class="no-results">
                  <div class="no-results-content">
                    <span class="no-results-icon">📭</span>
                    <p>Aucun contrat trouvé</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="table-footer">
          <div class="pagination-info">
            <span class="pagination-text">
              Page {{ currentPage }} sur {{ totalPages || 1 }}
              <span class="pagination-count framed-text">({{ filteredItems.length }} résultats)</span>
            </span>
          </div>
          
          <div class="pagination-controls">
            <button @click="currentPage--" :disabled="currentPage === 1" class="pagination-btn btn-prev framed-btn">
              <span class="btn-arrow">←</span>
              Précédent
            </button>
            
            <div class="page-numbers">
              <button v-for="page in getVisiblePages()" :key="page" 
                      @click="currentPage = page" 
                      :class="['page-number', 'framed-btn', { active: currentPage === page }]">
                {{ page }}
              </button>
            </div>
            
            <button @click="currentPage++" :disabled="currentPage >= totalPages" class="pagination-btn btn-next framed-btn">
              Suivant
              <span class="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import api from "../services/api";

// --- ÉTATS ---
const vehicles = ref([]);
const insurers = ref([]);
const items = ref([]);
const allInsurances = ref([]); // Toutes les assurances
const insuranceHistory = ref({}); // Historique par véhicule
const loading = ref(false);
const submitting = ref(false);
const updating = ref(false);
const submitted = ref(false);
const error = ref("");
const successMessage = ref("");
const searchQuery = ref("");
const filterStatus = ref("all");
const filterDates = ref({ from: "", to: "" });
const currentPage = ref(1);
const itemsPerPage = 8;
const showNewInsurerInput = ref(false);
const newInsurerName = ref("");

// Modal d'édition
const showEditModal = ref(false);
const selectedItem = ref(null);
const editForm = ref({
  insurerId: "",
  insurancesType: "TIERS",
  policyNo: "",
  premium: 0,
  durationValue: 12,
  durationUnit: "months",
  startAt: "",
  endAt: ""
});

// Formulaire
const form = ref({
  vehicleId: "",
  insurerId: "",
  insurancesType: "TIERS",
  premium: 0,
  policyNo: ""
});

const durationValue = ref(12);
const durationUnit = ref("months");
const dates = ref({
  start: new Date().toISOString().split('T')[0],
  end: ""
});

// --- LOGIQUE 3 JOURS ---
const canModify = (createdAt) => {
  if (!createdAt) return true;
  const created = new Date(createdAt);
  const now = new Date();
  const diffHours = (now - created) / (1000 * 60 * 60);
  return diffHours <= 72; // 72 heures = 3 jours
};

const getModificationDeadline = (createdAt) => {
  if (!createdAt) return new Date();
  const created = new Date(createdAt);
  const deadline = new Date(created);
  deadline.setHours(deadline.getHours() + 72); // + 3 jours
  return deadline;
};

const getRemainingModificationTime = (createdAt) => {
  if (!createdAt) return { hours: 0, minutes: 0 };
  const deadline = getModificationDeadline(createdAt);
  const now = new Date();
  const diffMs = deadline - now;
  
  if (diffMs <= 0) return { hours: 0, minutes: 0 };
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
};

// --- HELPERS ---
const getVehiclePlate = (vehicleId) => {
  const vehicle = vehicles.value.find(v => v.id === vehicleId);
  return vehicle?.plate || '—';
};

const getVehicleStatus = (vehicle) => {
  if (!vehicle || !vehicle.status) return 'Actif';
  const status = vehicle.status.toLowerCase().trim();
  if (status === 'hors service' || status === 'en panne') {
    return vehicle.status;
  }
  return 'Actif';
};

const getVehicleStatusClass = (vehicle) => {
  if (!vehicle || !vehicle.status) return 'status-active';
  const status = vehicle.status.toLowerCase().trim();
  if (status === 'hors service') return 'status-inactive';
  if (status === 'en panne') return 'status-warning';
  return 'status-active';
};

const getDaysRemainingIcon = (date) => {
  if (!date) return '—';
  const now = new Date();
  const end = new Date(date);
  const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
  
  if (diff < 0) return '⚠️';
  if (diff <= 7) return '⏳';
  if (diff <= 30) return '📅';
  return '✅';
};

// --- LOGIQUE ASSURANCES ---
const hasActiveInsurance = (vehicleId, excludeId = null) => {
  const now = new Date();
  const vehicleInsurances = insuranceHistory.value[vehicleId] || [];
  
  return vehicleInsurances.some(insurance => {
    if (excludeId && insurance.id === excludeId) return false;
    
    const startDate = new Date(insurance.startAt);
    const endDate = new Date(insurance.endAt);
    
    return now >= startDate && now <= endDate;
  });
};

const getActiveInsurance = (vehicleId) => {
  const now = new Date();
  const vehicleInsurances = insuranceHistory.value[vehicleId] || [];
  
  return vehicleInsurances.find(insurance => {
    const startDate = new Date(insurance.startAt);
    const endDate = new Date(insurance.endAt);
    return now >= startDate && now <= endDate;
  });
};

// --- LOGIQUE MODIFICATION DATES ---
const calculateEditEndDate = () => {
  if (!editForm.value.startAt || !editForm.value.durationValue) return;
  const start = new Date(editForm.value.startAt);
  const end = new Date(start);
  
  if (editForm.value.durationUnit === "years") {
    end.setFullYear(start.getFullYear() + editForm.value.durationValue);
  } else {
    end.setMonth(start.getMonth() + editForm.value.durationValue);
  }
  end.setDate(end.getDate() - 1);
  editForm.value.endAt = end.toISOString().split('T')[0];
};

// --- API ACTIONS ---
const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const [vRes, iRes, insRes] = await Promise.all([
      api.get("/vehicles"),
      api.get("/insurers"),
      api.get("/insurance")
    ]);
    
    // Filtrer les véhicules: exclure "Hors Service" et "en panne"
    vehicles.value = (vRes.data?.data || vRes.data || []).filter(v => {
      const status = (v.status?.toLowerCase() || "").trim();
      return status !== "hors service" && status !== "en panne";
    });
    
    insurers.value = iRes.data?.data || iRes.data || [];
    
    // Stocker toutes les assurances
    allInsurances.value = insRes.data?.data || insRes.data || [];
    
    // Organiser les assurances par véhicule
    insuranceHistory.value = {};
    allInsurances.value.forEach(insurance => {
      const vehicleId = insurance.vehicleId;
      if (!insuranceHistory.value[vehicleId]) {
        insuranceHistory.value[vehicleId] = [];
      }
      insuranceHistory.value[vehicleId].push(insurance);
    });
    
    // Trier les assurances de chaque véhicule par date de création (plus récente en premier)
    Object.keys(insuranceHistory.value).forEach(vehicleId => {
      insuranceHistory.value[vehicleId].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    });
    
    // Déterminer quelle assurance afficher pour chaque véhicule
    const now = new Date();
    const insurancesToDisplay = [];
    
    Object.keys(insuranceHistory.value).forEach(vehicleId => {
      const vehicleInsurances = insuranceHistory.value[vehicleId];
      if (vehicleInsurances.length === 0) return;
      
      // Trouver l'assurance "active" selon les règles
      let insuranceToShow = null;
      
      for (const insurance of vehicleInsurances) {
        const startDate = new Date(insurance.startAt);
        const endDate = new Date(insurance.endAt);
        
        // Vérifier si cette assurance devrait être affichée
        if (now >= startDate) {
          // Si l'assurance est en cours
          if (now <= endDate) {
            // C'est l'assurance en cours, on l'affiche
            insuranceToShow = insurance;
            break;
          } else {
            // Assurance expirée, on continue à chercher
            continue;
          }
        } else {
          // Assurance future, on vérifie si on peut l'afficher
          // On cherche s'il y a une assurance en cours ou récente
          const activeOrRecent = vehicleInsurances.find(ins => {
            const insStart = new Date(ins.startAt);
            const insEnd = new Date(ins.endAt);
            return now >= insStart && now <= insEnd;
          });
          
          if (!activeOrRecent) {
            // Pas d'assurance en cours, on peut afficher la future
            insuranceToShow = insurance;
            break;
          }
        }
      }
      
      // Si aucune assurance ne correspond aux critères, prendre la dernière
      if (!insuranceToShow && vehicleInsurances.length > 0) {
        insuranceToShow = vehicleInsurances[0];
      }
      
      if (insuranceToShow) {
        // S'assurer que le véhicule existe toujours et est actif
        const vehicle = vehicles.value.find(v => v.id === vehicleId);
        if (vehicle) {
          // Ajouter les informations du véhicule
          insuranceToShow.vehicle = vehicle;
          insurancesToDisplay.push(insuranceToShow);
        }
      }
    });
    
    // Ajouter les informations de l'assureur
    items.value = insurancesToDisplay.map(insurance => {
      const insurer = insurers.value.find(i => i.id === insurance.insurerId);
      return {
        ...insurance,
        insurer: insurer || null
      };
    });
    
  } catch (err) {
    console.error("Erreur chargement:", err);
    error.value = "Erreur lors du chargement des données";
  } finally {
    loading.value = false;
  }
};

const create = async () => {
  submitted.value = true;
  
  // Vérifier que le véhicule est actif
  const vehicle = vehicles.value.find(v => v.id === form.value.vehicleId);
  if (!vehicle) {
    error.value = "Véhicule non trouvé";
    return;
  }
  
  const vehicleStatus = (vehicle.status?.toLowerCase() || "").trim();
  if (vehicleStatus === "hors service" || vehicleStatus === "en panne") {
    error.value = "Impossible d'ajouter une assurance à un véhicule Hors Service ou en panne";
    return;
  }
  
  // Vérifier les champs obligatoires
  if (!form.value.vehicleId || !form.value.insurerId || !form.value.policyNo || !form.value.premium) {
    error.value = "Veuillez remplir tous les champs obligatoires (*)";
    return;
  }
  
  // Vérifier s'il y a une assurance en cours
  const activeInsurance = getActiveInsurance(form.value.vehicleId);
  const startDate = new Date(dates.value.start);
  const now = new Date();
  
  // Avertissement si création d'une assurance future alors qu'une assurance est en cours
  if (activeInsurance && startDate > now) {
    const confirmMessage = `Une assurance est déjà en cours pour ce véhicule (POL-${activeInsurance.policyNo}, valide jusqu'au ${formatDate(activeInsurance.endAt)}).\n\nVoulez-vous quand même créer cette nouvelle assurance ? Elle ne sera affichée qu'à partir de sa date de début (${formatDate(dates.value.start)}).`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
  }
  
  // Avertissement si chevauchement de dates
  if (activeInsurance && startDate <= new Date(activeInsurance.endAt)) {
    const confirmMessage = `Attention : cette nouvelle assurance commence avant la fin de l'assurance en cours (POL-${activeInsurance.policyNo}, valide jusqu'au ${formatDate(activeInsurance.endAt)}).\n\nVoulez-vous quand même continuer ?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
  }
  
  submitting.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    const payload = {
      vehicleId: String(form.value.vehicleId),
      insurerId: String(form.value.insurerId),
      insurancesType: form.value.insurancesType,
      policyNo: String(form.value.policyNo),
      premium: parseFloat(form.value.premium) || 0,
      durationValue: parseInt(durationValue.value) || 1,
      durationUnit: String(durationUnit.value),
      startAt: new Date(dates.value.start).toISOString(),
      endAt: new Date(dates.value.end).toISOString()
    };

    const response = await api.post("/insurance", payload);
    console.log("Réponse création:", response.data);
    
    let successMsg = "Contrat créé avec succès !";
    if (activeInsurance) {
      if (startDate > now) {
        successMsg += `\nCette assurance sera visible à partir du ${formatDate(dates.value.start)}.`;
      } else {
        successMsg += `\nCette assurance remplace l'ancienne (POL-${activeInsurance.policyNo}).`;
      }
    }
    
    successMessage.value = successMsg;
    resetForm();
    await load();
    
    setTimeout(() => successMessage.value = "", 5000);
    
  } catch (err) {
    console.error("Erreur création:", err.response?.data || err);
    error.value = err.response?.data?.message || "Erreur lors de la création du contrat";
  } finally {
    submitting.value = false;
  }
};

const updateContract = async () => {
  if (!selectedItem.value || !canModify(selectedItem.value.createdAt)) {
    error.value = "Impossible de modifier ce contrat";
    return;
  }
  
  updating.value = true;
  error.value = "";
  
  try {
    const payload = {
      insurerId: String(editForm.value.insurerId),
      insurancesType: editForm.value.insurancesType,
      policyNo: String(editForm.value.policyNo),
      premium: parseFloat(editForm.value.premium) || 0,
      durationValue: parseInt(editForm.value.durationValue) || 1,
      durationUnit: String(editForm.value.durationUnit),
      startAt: new Date(editForm.value.startAt).toISOString(),
      endAt: new Date(editForm.value.endAt).toISOString()
    };

    console.log("Mise à jour contrat:", selectedItem.value.id, payload);
    
    await api.put(`/insurance/${selectedItem.value.id}`, payload);
    
    successMessage.value = "Contrat mis à jour avec succès !";
    closeEditModal();
    await load();
    
    setTimeout(() => successMessage.value = "", 3000);
    
  } catch (err) {
    console.error("Erreur mise à jour:", err.response?.data || err);
    error.value = err.response?.data?.message || "Erreur lors de la mise à jour";
  } finally {
    updating.value = false;
  }
};

const remove = async (item) => {
  if (!canModify(item.createdAt)) {
    error.value = "Impossible de supprimer ce contrat après 3 jours";
    return;
  }
  
  if (!confirm(`Voulez-vous vraiment supprimer le contrat ${item.policyNo} ?`)) {
    return;
  }
  
  try {
    await api.delete(`/insurance/${item.id}`);
    successMessage.value = "Contrat supprimé avec succès";
    await load();
    
    setTimeout(() => successMessage.value = "", 3000);
    
  } catch (err) {
    console.error("Erreur suppression:", err.response?.data || err);
    error.value = err.response?.data?.message || "Erreur lors de la suppression";
  }
};

const saveNewInsurer = async () => {
  if (!newInsurerName.value.trim()) {
    error.value = "Veuillez saisir un nom d'assureur";
    return;
  }
  
  try {
    const res = await api.post("/insurers", { name: newInsurerName.value.trim() });
    const created = res.data?.data || res.data;
    
    insurers.value.push(created);
    form.value.insurerId = created.id;
    showNewInsurerInput.value = false;
    newInsurerName.value = "";
    successMessage.value = "Assureur ajouté avec succès";
    
    setTimeout(() => successMessage.value = "", 3000);
    
  } catch (err) {
    console.error("Erreur création assureur:", err.response?.data || err);
    error.value = err.response?.data?.message || "Erreur lors de la création de l'assureur";
  }
};

// --- MODAL ---
const openEditModal = (item) => {
  if (!canModify(item.createdAt)) {
    error.value = "Ce contrat ne peut plus être modifié après 3 jours";
    return;
  }
  
  selectedItem.value = item;
  editForm.value = {
    insurerId: item.insurerId,
    insurancesType: item.insurancesType,
    policyNo: item.policyNo,
    premium: item.premium,
    durationValue: item.durationValue,
    durationUnit: item.durationUnit,
    startAt: item.startAt ? new Date(item.startAt).toISOString().split('T')[0] : '',
    endAt: item.endAt ? new Date(item.endAt).toISOString().split('T')[0] : ''
  };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  selectedItem.value = null;
  editForm.value = {
    insurerId: "",
    insurancesType: "TIERS",
    policyNo: "",
    premium: 0,
    durationValue: 12,
    durationUnit: "months",
    startAt: "",
    endAt: ""
  };
};

// --- LOGIQUE DATES ---
const calculateEndDate = () => {
  if (!dates.value.start || !durationValue.value) return;
  const start = new Date(dates.value.start);
  const end = new Date(start);
  
  if (durationUnit.value === "years") {
    end.setFullYear(start.getFullYear() + durationValue.value);
  } else {
    end.setMonth(start.getMonth() + durationValue.value);
  }
  end.setDate(end.getDate() - 1);
  dates.value.end = end.toISOString().split('T')[0];
};

// Watch pour la durée dans la modal
watch(() => editForm.value.startAt, calculateEditEndDate);
watch(() => editForm.value.durationValue, calculateEditEndDate);
watch(() => editForm.value.durationUnit, calculateEditEndDate);

watch([() => dates.value.start, durationValue, durationUnit], calculateEndDate, { immediate: true });

// --- FILTRAGE ---
const filteredItems = computed(() => {
  return items.value.filter(it => {
    // Recherche par plaque
    const plate = it.vehicle?.plate?.toLowerCase() || "";
    const matchesSearch = plate.includes(searchQuery.value.toLowerCase());
    
    // Statut
    const diffDays = Math.ceil((new Date(it.endAt) - new Date()) / (1000 * 3600 * 24));
    let matchesStatus = true;
    if (filterStatus.value === "expired") matchesStatus = diffDays < 0;
    else if (filterStatus.value === "expiring") matchesStatus = diffDays >= 0 && diffDays <= 30;
    else if (filterStatus.value === "active") matchesStatus = diffDays > 30;

    // Dates de création
    const createdAt = new Date(it.createdAt).toISOString().split('T')[0];
    let matchesDate = true;
    if (filterDates.value.from) matchesDate = matchesDate && createdAt >= filterDates.value.from;
    if (filterDates.value.to) matchesDate = matchesDate && createdAt <= filterDates.value.to;

    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredItems.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(filteredItems.value.length / itemsPerPage));

const getVisiblePages = () => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
};

// --- KPI ---
const totalPremium = computed(() => 
  items.value.reduce((sum, it) => sum + (Number(it.premium) || 0), 0)
);

const upcomingRenewals = computed(() => {
  const now = new Date();
  return items.value.filter(it => {
    if (!it.endAt) return false;
    const end = new Date(it.endAt);
    const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
    return diff > 0 && diff <= 30;
  }).length;
});

const expiredCount = computed(() => {
  const now = new Date();
  return items.value.filter(it => {
    if (!it.endAt) return false;
    const end = new Date(it.endAt);
    return end < now;
  }).length;
});

// --- FORMATAGE ---
const today = computed(() => new Date().toLocaleDateString('fr-FR', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
}));

const formatCurrency = (v) => {
  const num = Number(v) || 0;
  return new Intl.NumberFormat('fr-FR').format(num) + ' FCFA';
};

const formatCompactCurrency = (v) => {
  const num = Number(v) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M FCFA';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'k FCFA';
  return formatCurrency(num);
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (err) {
    return '—';
  }
};

const formatDateTime = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (err) {
    return '—';
  }
};

const formatDuration = (v, u) => {
  if (!v || !u) return '—';
  return `${v} ${u === 'years' ? 'an(s)' : 'mois'}`;
};

const formatInsuranceType = (t) => {
  if (!t) return '—';
  const types = {
    'RC': 'Responsabilité Civile',
    'TIERS': 'Tiers Simple',
    'INTERMEDIAIRE': 'Intermédiaire',
    'TOUS_RISQUES': 'Tous Risques'
  };
  return types[t] || t;
};

const getDaysRemainingText = (date) => {
  if (!date) return '—';
  const now = new Date();
  const end = new Date(date);
  const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
  
  if (diff < 0) return 'Expiré';
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  return `${diff} jours`;
};

const getDaysRemainingClass = (date) => {
  if (!date) return 'pill-neutral';
  const now = new Date();
  const end = new Date(date);
  const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
  
  if (diff < 0) return 'pill-danger';
  if (diff <= 7) return 'pill-warning';
  if (diff <= 30) return 'pill-info';
  return 'pill-success';
};

const getRowClass = (date) => {
  if (!date) return '';
  const now = new Date();
  const end = new Date(date);
  const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
  
  if (diff < 0) return 'row-expired';
  if (diff <= 30) return 'row-warning';
  return '';
};

const getDateFieldClass = (date) => {
  if (!date) return '';
  const now = new Date();
  const end = new Date(date);
  const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
  return diff <= 30 ? 'date-warning' : '';
};

const handleInsurerChange = () => {
  showNewInsurerInput.value = form.value.insurerId === "NEW";
};

const onVehicleChange = () => {
  // Réinitialiser l'assureur quand le véhicule change
  if (form.value.vehicleId && hasActiveInsurance(form.value.vehicleId)) {
    const activeIns = getActiveInsurance(form.value.vehicleId);
    // Pré-remplir avec l'assureur actuel si disponible
    if (activeIns && activeIns.insurerId) {
      form.value.insurerId = activeIns.insurerId;
    }
  }
};

const resetDateFilter = () => {
  filterDates.value = { from: "", to: "" };
};

const resetForm = () => {
  form.value = { vehicleId: "", insurerId: "", insurancesType: "TIERS", premium: 0, policyNo: "" };
  durationValue.value = 12;
  durationUnit.value = "months";
  dates.value = { start: new Date().toISOString().split('T')[0], end: "" };
  submitted.value = false;
};

const clearMessages = () => { 
  error.value = ""; 
  successMessage.value = ""; 
};

// --- LIFECYCLE ---
onMounted(load);

watch([searchQuery, filterStatus, filterDates], () => {
  currentPage.value = 1;
});
</script>

<style scoped>
/* Variables CSS */
:root {
  --primary: #3b82f6;
  --primary-light: #60a5fa;
  --primary-dark: #2563eb;
  --primary-bg: #eff6ff;
  --secondary: #8b5cf6;
  --success: #10b981;
  --success-light: #34d399;
  --success-bg: #ecfdf5;
  --warning: #f59e0b;
  --warning-light: #fbbf24;
  --warning-bg: #fffbeb;
  --danger: #ef4444;
  --danger-light: #f87171;
  --danger-bg: #fef2f2;
  --info: #0ea5e9;
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-500: #64748b;
  --gray-600: #475569;
  --gray-700: #334155;
  --gray-800: #1e293b;
  --gray-900: #0f172a;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  --radius-sm: 0.375rem;
  --radius: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.25rem;
}

/* Base */
.dashboard-container {
  padding: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  min-height: 100vh;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--gray-800);
  position: relative;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
  backdrop-filter: blur(5px);
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--gray-200);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 2px solid var(--gray-100);
  background: var(--gray-50);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--gray-900);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--gray-500);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--gray-200);
  color: var(--gray-700);
}

.modal-body {
  padding: 24px;
}

.modal-form .form-group {
  margin-bottom: 20px;
}

.modal-form label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 8px;
}

.modal-info {
  background: var(--gray-50);
  border-radius: var(--radius);
  padding: 16px;
  margin-top: 24px;
  border: 1px solid var(--gray-200);
}

.modal-info .info-label {
  display: block;
  font-size: 12px;
  color: var(--gray-500);
  margin-bottom: 4px;
}

.modal-info .info-value {
  display: block;
  font-weight: 600;
  color: var(--gray-800);
  margin-bottom: 12px;
}

.modal-info .deadline {
  color: var(--primary);
}

.modal-info .info-warning {
  display: block;
  color: var(--danger);
  font-weight: 600;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--danger-bg);
  border-radius: var(--radius);
  border: 1px solid var(--danger-light);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 2px solid var(--gray-100);
  background: var(--gray-50);
}

.btn-cancel {
  padding: 10px 20px;
  border: 2px solid var(--gray-300);
  background: white;
  border-radius: var(--radius);
  font-weight: 600;
  color: var(--gray-700);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: var(--gray-100);
  border-color: var(--gray-400);
}

.btn-save {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Notifications */
.notification {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 320px;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideDown 0.3s ease;
}

.notification-success {
  background: linear-gradient(135deg, var(--success-bg) 0%, rgba(16, 185, 129, 0.1) 100%);
  border-left: 4px solid var(--success);
  color: #065f46;
}

.notification-error {
  background: linear-gradient(135deg, var(--danger-bg) 0%, rgba(239, 68, 68, 0.1) 100%);
  border-left: 4px solid var(--danger);
  color: #991b1b;
}

.noti-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.status-icon {
  font-size: 20px;
}

.noti-text {
  flex: 1;
}

.noti-title {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 2px;
}

.noti-message {
  font-size: 14px;
  margin: 0;
}

.notification-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 20px;
  opacity: 0.7;
  padding: 4px;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.notification-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.05);
}

/* Header */
.dashboard-header {
  background: white;
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow);
  border: 1px solid var(--gray-200);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.header-main {
  flex: 1;
}

.title {
  font-size: 28px;
  font-weight: 800;
  color: var(--gray-900);
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 32px;
}

.subtitle {
  color: var(--gray-500);
  font-size: 14px;
  margin: 0;
}

.header-actions {
  flex-shrink: 0;
}

.refresh-btn {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  border: none;
  border-radius: var(--radius);
  padding: 12px 24px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.refresh-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.refresh-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 16px;
}

.rotating .refresh-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.kpi-card {
  padding: 24px;
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.kpi-card.premium {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%);
  color: white;
}

.kpi-card.warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.9) 100%);
  color: white;
}

.kpi-card.danger {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%);
  color: white;
}

.kpi-content {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.kpi-icon-wrapper {
  background: rgba(255, 255, 255, 0.2);
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.kpi-text {
  flex: 1;
}

.label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  display: block;
}

.value {
  font-size: 36px;
  font-weight: 800;
  margin: 0;
  line-height: 1;
}

.kpi-trend {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 12px;
}

.trend-text {
  font-size: 11px;
  opacity: 0.8;
  font-weight: 500;
}

/* Form Section */
.glass-form {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%);
  backdrop-filter: blur(10px);
}

.form-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 24px 0;
  margin-bottom: 24px;
}

.form-header-icon {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.form-header-text h3 {
  font-size: 20px;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 4px 0;
}

.form-header-text p {
  color: var(--gray-500);
  font-size: 14px;
  margin: 0;
}

.form-body {
  padding: 0 24px 24px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
  display: flex;
  align-items: center;
  gap: 6px;
}

.label-icon {
  opacity: 0.7;
}

.select-wrapper {
  position: relative;
}

.select-filled {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  font-size: 14px;
  transition: all 0.3s;
  appearance: none;
  background: white;
  color: var(--gray-800);
}

.select-filled:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.select-arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--gray-500);
  font-size: 12px;
}

.opt-new {
  color: var(--primary);
  font-weight: 600;
}

.input-error {
  border-color: var(--danger) !important;
}

.input-with-prefix {
  position: relative;
}

.input-prefix {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-500);
  font-weight: 600;
}

.input-with-prefix .modern-input {
  padding-left: 60px;
}

.duration-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.duration-input {
  display: flex;
  gap: 8px;
}

.num-input {
  width: 80px;
  text-align: center;
}

.unit-select {
  width: 100px;
}

.date-start {
  flex: 1;
}

.date-display {
  position: relative;
}

.date-display-field {
  background: var(--gray-50);
  cursor: not-allowed;
}

.date-info {
  display: block;
  font-size: 11px;
  color: var(--gray-500);
  margin-top: 4px;
}

.date-warning {
  border-color: var(--warning);
  background: var(--warning-bg);
}

.input-with-suffix {
  position: relative;
}

.input-suffix {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-500);
  font-size: 14px;
}

/* Indicateur d'assurance en cours */
.insurance-status-info {
  margin-top: 12px;
  padding: 12px;
  border-radius: var(--radius);
}

.warning-status {
  background: var(--warning-bg);
  border: 1px solid var(--warning-light);
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.success-status {
  background: var(--success-bg);
  border: 1px solid var(--success-light);
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.status-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.status-details {
  flex: 1;
}

.status-title {
  font-weight: 600;
  font-size: 14px;
  margin: 0 0 4px 0;
  color: var(--gray-800);
}

.status-description {
  font-size: 12px;
  color: var(--gray-600);
  margin: 0 0 8px 0;
}

.status-note {
  font-size: 11px;
  color: var(--gray-500);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.note-icon {
  font-size: 12px;
}

/* Nouvel assureur */
.new-insurer-form {
  background: var(--gray-50);
  border-radius: var(--radius);
  padding: 16px;
  margin-top: 16px;
  border: 1px solid var(--gray-200);
}

.new-insurer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.new-insurer-icon {
  color: var(--primary);
  font-size: 18px;
}

.new-insurer-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-700);
  margin: 0;
}

.new-insurer-body {
  display: flex;
  gap: 12px;
}

.insurer-name-input {
  flex: 1;
}

.btn-save-insurer {
  background: linear-gradient(135deg, var(--success) 40%, var(--success-light) 100%);
  color: black;
  border: none;
  border-radius: var(--radius);
  padding: 12px 20px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s;
}

.btn-save-insurer:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-save-insurer:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Bouton de soumission */
.form-footer {
  padding-top: 24px;
  border-top: 1px solid var(--gray-200);
}

/* Le bouton principal "Valider" */
.btn-submit {
  background: linear-gradient(135deg, #3a8dff 0%, #0056b3 100%);
  color: black; /* Écriture noire demandée */
  border: none;
  border-radius: 12px; /* Un arrondi moderne */
  padding: 16px 32px;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

/* Effet de survol attractif */
.btn-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.5);
  filter: brightness(1.1);
}

/* État désactivé pour le bouton principal */
.btn-submit:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

/* Style spécifique pour les boutons d'action dans le tableau quand ils sont verrouillés */
.btn-locked {
  background: #f1f5f9 !important;
  color: #94a3b8 !important;
  cursor: not-allowed !important;
  opacity: 0.7;
  border: 1px solid #e2e8f0 !important;
}

/* Animation de l'icône de cadenas */
.btn-locked span {
  filter: grayscale(1);
}


.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-icon {
  font-size: 18px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

/* Table Section */
.glass-table {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--gray-200);
  flex-wrap: wrap;
  gap: 16px;
}

.table-header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.table-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.table-count {
  background: var(--primary-bg);
  color: var(--primary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.table-filters {
  display: flex;
  align-items: center;
  gap: 12px;
}

.period-filter {
  background: var(--gray-100);
  border-radius: var(--radius);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--gray-200);
}

.period-input {
  display: flex;
  align-items: center;
  gap: 4px;
}

.period-input label {
  font-size: 12px;
  color: var(--gray-600);
  font-weight: 600;
}

.date-input {
  padding: 6px 8px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm);
  font-size: 12px;
  min-width: 100px;
}

.btn-clear {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-light);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.btn-clear:hover {
  background: var(--danger);
  color: white;
}

.clear-icon {
  font-size: 14px;
}

.table-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-400);
  pointer-events: none;
}

.search-input {
  padding: 10px 16px 10px 36px;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  font-size: 14px;
  width: 240px;
  transition: all 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.status-filter-wrapper {
  position: relative;
}

.status-filter {
  padding: 10px 36px 10px 16px;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  font-size: 14px;
  background: white;
  color: var(--gray-800);
  cursor: pointer;
  appearance: none;
  min-width: 180px;
}

.status-filter:focus {
  outline: none;
  border-color: var(--primary);
}

.table-responsive {
  overflow-x: auto;
}

.dashboard-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1000px;
}

.dashboard-table th {
  background: var(--gray-50);
  padding: 16px 20px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid var(--gray-200);
  white-space: nowrap;
}

.dashboard-table td {
  padding: 20px;
  border-bottom: 1px solid var(--gray-100);
  vertical-align: middle;
}

.dashboard-table tbody tr {
  transition: all 0.2s;
}

.dashboard-table tbody tr:hover {
  background: var(--gray-50);
}

.row-expired {
  background: linear-gradient(90deg, var(--danger-bg) 0%, rgba(239, 68, 68, 0.05) 100%);
}

.row-warning {
  background: linear-gradient(90deg, var(--warning-bg) 0%, rgba(245, 158, 11, 0.05) 100%);
}

/* Cellules du tableau */
.vehicle-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vehicle-icon {
  font-size: 20px;
  opacity: 0.7;
}

.vehicle-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plate-tag {
  background: var(--gray-900);
  color: blue;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  display: inline-block;
}

.vehicle-type {
  font-size: 11px;
  color: var(--gray-500);
}

.vehicle-status {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  display: inline-block;
}

.status-active {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-light);
}

.status-warning {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-light);
}

.status-inactive {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-light);
}

.insurer-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.insurer-name {
  font-weight: 600;
  color: var(--gray-800);
}

.policy-number {
  font-size: 11px;
  color: var(--gray-500);
}

.period-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.period-dates {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
}

.period-duration {
  font-size: 11px;
  color: var(--gray-500);
}

.status-pill {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 2px solid;
  white-space: nowrap;
}

.pill-success {
  background: var(--success-bg);
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.2);
}

.pill-info {
  background: var(--primary-bg);
  color: var(--primary);
  border-color: rgba(59, 130, 246, 0.2);
}

.pill-warning {
  background: var(--warning-bg);
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.2);
}

.pill-danger {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: rgba(239, 68, 68, 0.2);
}

.pill-neutral {
  background: var(--gray-100);
  color: var(--gray-600);
  border-color: var(--gray-200);
}

.premium-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.premium-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--gray-800);
}

/* Modification status */
.modification-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modify-allowed {
  color: var(--success);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.modify-locked {
  color: var(--danger);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-icon {
  font-size: 14px;
  margin-right: 4px;
}

.status-text {
  font-weight: 700;
}

.status-time {
  font-size: 10px;
  opacity: 0.8;
  font-weight: 500;
}

/* Actions */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-edit {
  color: var(--primary);
  border-color: var(--primary-light);
  background: var(--primary-bg);
}

.btn-edit:hover:not(:disabled) {
  background: var(--primary);
  color: white;
}

.btn-delete {
  color: var(--danger);
  border-color: var(--danger-light);
  background: var(--danger-bg);
}

.btn-delete:hover:not(:disabled) {
  background: var(--danger);
  color: white;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.action-icon {
  font-size: 14px;
}

.action-text {
  font-size: 12px;
}

.no-results {
  text-align: center;
  padding: 60px 20px !important;
}

.no-results-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--gray-400);
}

.no-results-icon {
  font-size: 48px;
  opacity: 0.5;
}

.no-results p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

/* Pagination */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-top: 1px solid var(--gray-200);
  flex-wrap: wrap;
  gap: 16px;
  background: var(--gray-50);
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-text {
  font-size: 14px;
  color: var(--gray-600);
}

.pagination-count {
  color: var(--gray-400);
  font-size: 13px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination-btn {
  background: white;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-700);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-arrow {
  font-size: 16px;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-number {
  background: white;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-700);
  cursor: pointer;
  transition: all 0.2s;
}

.page-number:hover {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.page-number.active {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  border-color: var(--primary);
}

/* Animations */
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(-10px);
  opacity: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Responsive */
@media (max-width: 1024px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .title {
    font-size: 24px;
  }
  
  .kpi-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .duration-input {
    flex-direction: column;
  }
  
  .num-input, .unit-select, .date-start {
    width: 100%;
  }
  
  .table-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .table-header-left {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .period-filter {
    flex-direction: column;
    align-items: stretch;
  }
  
  .period-input {
    justify-content: space-between;
  }
  
  .table-header-right {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input {
    width: 100%;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .table-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .pagination-controls {
    justify-content: center;
  }
  
  .page-numbers {
    display: none;
  }
  
  .modal-content {
    margin: 10px;
    max-height: 85vh;
  }
}

@media (max-width: 640px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  
  .new-insurer-body {
    flex-direction: column;
  }
}
</style>
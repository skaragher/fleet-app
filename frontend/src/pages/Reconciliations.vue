<template>
  <div class="reconciliations-page">

    <div class="page-header">
      <div>
        <h1>Rapprochements de stock</h1>
        <p class="page-subtitle">Contrôle et ajustement des niveaux de carburant</p>
      </div>
      <button class="btn btn-primary" @click="openNewModal">
        + Nouveau rapprochement
      </button>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button :class="['tab-btn', activeTab === 'reconciliations' && 'active']" @click="activeTab = 'reconciliations'">
        📋 Rapprochements
      </button>
      <button :class="['tab-btn', activeTab === 'audit' && 'active']" @click="activeTab = 'audit'; loadAudit()">
        🔍 Journal des traces
      </button>
    </div>

    <!-- ══ TAB RAPPROCHEMENTS ══════════════════════════════════════════════ -->
    <template v-if="activeTab === 'reconciliations'">
      <div class="filters-bar">
        <div class="filter-group">
          <label>Station</label>
          <select v-model="filters.stationId" @change="load">
            <option value="">Toutes</option>
            <option v-for="s in stations" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Statut</label>
          <select v-model="filters.status" @change="load">
            <option value="">Tous</option>
            <option value="PENDING">En attente</option>
            <option value="VALIDATED">Validé</option>
            <option value="REJECTED">Rejeté</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Du</label>
          <input type="date" v-model="filters.startDate" @change="load" />
        </div>
        <div class="filter-group">
          <label>Au</label>
          <input type="date" v-model="filters.endDate" @change="load" />
        </div>
        <button class="btn btn-secondary" @click="resetFilters">Réinitialiser</button>
      </div>

      <div v-if="loading" class="loading-state"><div class="spinner"></div><p>Chargement…</p></div>
      <div v-else-if="error" class="alert-error">{{ error }}</div>
      <div v-else-if="!items.length" class="empty-state">Aucun rapprochement pour ces critères.</div>
      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Station / Cuve</th>
              <th>Type</th>
              <th class="num">Stock système (L)</th>
              <th class="num">Stock physique (L)</th>
              <th class="num">Écart (L)</th>
              <th>Motif</th>
              <th>Réalisé par</th>
              <th>Date</th>
              <th>Statut</th>
              <th v-if="isAdmin">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id" :class="rowClass(r)">
              <td>
                <strong>{{ r.station?.name }}</strong>
                <br /><small>{{ r.tank?.name }} - {{ r.tank?.fuelType }}</small>
              </td>
              <td><span class="fuel-badge">{{ r.tank?.fuelType }}</span></td>
              <td class="num">{{ fmt(r.systemL) }}</td>
              <td class="num">{{ fmt(r.physicalL) }}</td>
              <td class="num" :class="r.adjustmentL < 0 ? 'text-red' : r.adjustmentL > 0 ? 'text-green' : ''">
                <strong>{{ r.adjustmentL > 0 ? '+' : '' }}{{ fmt(r.adjustmentL) }}</strong>
              </td>
              <td>{{ r.reason || '-' }}</td>
              <td>
                {{ r.performer?.name }}
                <br /><small class="role-label">{{ fmtRole(r.performer?.role) }}</small>
              </td>
              <td>{{ fmtDate(r.performedAt) }}</td>
              <td>
                <span class="status-badge" :class="'status-' + r.status.toLowerCase()">
                  {{ statusLabel(r.status) }}
                </span>
                <template v-if="r.status === 'VALIDATED' && r.validator">
                  <br /><small>par {{ r.validator.name }}</small>
                </template>
              </td>
              <td v-if="isAdmin">
                <template v-if="r.status === 'PENDING'">
                  <button class="btn-sm btn-success" @click="validate(r, 'VALIDATED')" title="Valider">✔ Valider</button>
                  <button class="btn-sm btn-danger" @click="validate(r, 'REJECTED')" title="Rejeter">✘ Rejeter</button>
                  <button class="btn-sm btn-ghost" @click="deleteRecon(r)" title="Supprimer">🗑</button>
                </template>
                <span v-else class="text-muted">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" v-if="total > pageSize">
        <button :disabled="page <= 1" @click="page--; load()">&laquo; Préc.</button>
        <span>Page {{ page }} / {{ Math.ceil(total / pageSize) }}</span>
        <button :disabled="page >= Math.ceil(total / pageSize)" @click="page++; load()">Suiv. &raquo;</button>
      </div>
    </template>

    <!-- ══ TAB AUDIT ══════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'audit'">
      <div class="filters-bar">
        <div class="filter-group">
          <label>Action</label>
          <select v-model="auditFilters.action" @change="loadAudit">
            <option value="">Toutes</option>
            <option value="SUPPLY">Approvisionnement</option>
            <option value="DISPENSE">Ravitaillement</option>
            <option value="RECONCILIATION">Rapprochement</option>
            <option value="ADJUSTMENT">Ajustement</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Station</label>
          <select v-model="auditFilters.stationId" @change="loadAudit">
            <option value="">Toutes</option>
            <option v-for="s in stations" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Du</label>
          <input type="date" v-model="auditFilters.startDate" @change="loadAudit" />
        </div>
        <div class="filter-group">
          <label>Au</label>
          <input type="date" v-model="auditFilters.endDate" @change="loadAudit" />
        </div>
      </div>

      <div v-if="auditLoading" class="loading-state"><div class="spinner"></div><p>Chargement…</p></div>
      <div v-else-if="!auditItems.length" class="empty-state">Aucune trace pour ces critères.</div>
      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date/Heure</th>
              <th>Action</th>
              <th>Station / Cuve</th>
              <th>Utilisateur</th>
              <th class="num">Stock avant (L)</th>
              <th class="num">Stock après (L)</th>
              <th class="num">Δ (L)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in auditItems" :key="log.id" :class="'audit-row-' + log.action.toLowerCase()">
              <td>{{ fmtDateTime(log.createdAt) }}</td>
              <td><span class="action-badge" :class="'action-' + log.action.toLowerCase()">{{ actionLabel(log.action) }}</span></td>
              <td>
                <strong>{{ log.station?.name }}</strong>
                <br /><small>{{ log.tank?.name }} - {{ log.tank?.fuelType }}</small>
              </td>
              <td>{{ log.userName || log.user?.name || '-' }}</td>
              <td class="num">{{ fmt(log.previousL) }}</td>
              <td class="num">{{ fmt(log.newL) }}</td>
              <td class="num" :class="log.deltaL < 0 ? 'text-red' : log.deltaL > 0 ? 'text-green' : ''">
                <strong>{{ log.deltaL > 0 ? '+' : '' }}{{ fmt(log.deltaL) }}</strong>
              </td>
              <td class="notes-cell">{{ log.notes || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" v-if="auditTotal > auditPageSize">
        <button :disabled="auditPage <= 1" @click="auditPage--; loadAudit()">&laquo; Préc.</button>
        <span>Page {{ auditPage }} / {{ Math.ceil(auditTotal / auditPageSize) }}</span>
        <button :disabled="auditPage >= Math.ceil(auditTotal / auditPageSize)" @click="auditPage++; loadAudit()">Suiv. &raquo;</button>
      </div>
    </template>

    <!-- ══ MODAL NOUVEAU RAPPROCHEMENT ════════════════════════════════════ -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2>Nouveau rapprochement</h2>
          <button class="modal-close" @click="showModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Station *</label>
            <select v-model="form.stationId" @change="onStationChange">
              <option value="">Sélectionner une station</option>
              <option v-for="s in stations" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Cuve *</label>
            <select v-model="form.tankId" @change="onTankChange">
              <option value="">Sélectionner une cuve</option>
              <option v-for="t in filteredTanks" :key="t.id" :value="t.id">
                {{ t.name }} - {{ t.fuelType }} ({{ fmt(t.currentL) }}/{{ fmt(t.capacityL) }}L)
              </option>
            </select>
          </div>
          <div v-if="selectedTank" class="tank-info-card">
            <div class="tank-info-row">
              <span>Stock système actuel</span>
              <strong>{{ fmt(selectedTank.currentL) }} L</strong>
            </div>
            <div class="tank-info-row">
              <span>Capacité</span>
              <strong>{{ fmt(selectedTank.capacityL) }} L</strong>
            </div>
            <div class="tank-info-bar">
              <div class="tank-bar-fill" :style="{ width: tankFillPct + '%' }" :class="tankFillPct < 20 ? 'low' : ''"></div>
            </div>
          </div>
          <div class="form-group">
            <label>Stock physique mesuré (L) *</label>
            <input type="number" v-model.number="form.physicalL" min="0" :max="selectedTank?.capacityL" />
            <div v-if="form.physicalL !== '' && selectedTank" class="ecart-preview" :class="ecart < 0 ? 'ecart-negative' : ecart > 0 ? 'ecart-positive' : 'ecart-zero'">
              Écart : {{ ecart > 0 ? '+' : '' }}{{ fmt(ecart) }} L
              ({{ ecartPct > 0 ? '+' : '' }}{{ ecartPct.toFixed(1) }}%)
            </div>
          </div>
          <div class="form-group">
            <label>Motif</label>
            <select v-model="form.reason">
              <option value="">Non précisé</option>
              <option value="Évaporation naturelle">Évaporation naturelle</option>
              <option value="Erreur de comptage">Erreur de comptage</option>
              <option value="Fuite détectée">Fuite détectée</option>
              <option value="Pompage non enregistré">Pompage non enregistré</option>
              <option value="Inventaire physique périodique">Inventaire physique périodique</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea v-model="form.notes" rows="2" placeholder="Observations…"></textarea>
          </div>
          <div v-if="formError" class="alert-error">{{ formError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showModal = false">Annuler</button>
          <button class="btn btn-primary" @click="submitRecon" :disabled="saving">
            {{ saving ? 'Enregistrement…' : 'Soumettre le rapprochement' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL VALIDATION ══════════════════════════════════════════════ -->
    <div v-if="showValidateModal" class="modal-overlay" @click.self="showValidateModal = false">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h2>{{ validateAction === 'VALIDATED' ? '✔ Valider' : '✘ Rejeter' }} le rapprochement</h2>
          <button class="modal-close" @click="showValidateModal = false">✕</button>
        </div>
        <div class="modal-body" v-if="selectedRecon">
          <div class="validate-summary">
            <div class="validate-row"><span>Station</span><strong>{{ selectedRecon.station?.name }}</strong></div>
            <div class="validate-row"><span>Cuve</span><strong>{{ selectedRecon.tank?.name }}</strong></div>
            <div class="validate-row"><span>Stock système</span><strong>{{ fmt(selectedRecon.systemL) }} L</strong></div>
            <div class="validate-row"><span>Stock physique</span><strong>{{ fmt(selectedRecon.physicalL) }} L</strong></div>
            <div class="validate-row">
              <span>Ajustement</span>
              <strong :class="selectedRecon.adjustmentL < 0 ? 'text-red' : selectedRecon.adjustmentL > 0 ? 'text-green' : ''">
                {{ selectedRecon.adjustmentL > 0 ? '+' : '' }}{{ fmt(selectedRecon.adjustmentL) }} L
              </strong>
            </div>
          </div>
          <div v-if="validateAction === 'VALIDATED'" class="alert-warning">
            ⚠️ Cette action va <strong>modifier définitivement</strong> le stock de la cuve de
            <strong>{{ fmt(selectedRecon.systemL) }}L → {{ fmt(selectedRecon.physicalL) }}L</strong>.
          </div>
          <div class="form-group">
            <label>Commentaire (optionnel)</label>
            <textarea v-model="validateNotes" rows="2" placeholder="Motif de validation / rejet…"></textarea>
          </div>
          <div v-if="validateError" class="alert-error">{{ validateError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showValidateModal = false">Annuler</button>
          <button
            :class="['btn', validateAction === 'VALIDATED' ? 'btn-success' : 'btn-danger']"
            @click="confirmValidate"
            :disabled="validating"
          >
            {{ validating ? 'Traitement…' : (validateAction === 'VALIDATED' ? 'Confirmer la validation' : 'Confirmer le rejet') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();

// ── Permissions ───────────────────────────────────────────────
const isAdmin = computed(() => ['SUPER_ADMIN', 'FLEET_MANAGER'].includes(auth.user?.role));

// ── Tabs ──────────────────────────────────────────────────────
const activeTab = ref('reconciliations');

// ── Data ──────────────────────────────────────────────────────
const items       = ref([]);
const total       = ref(0);
const page        = ref(1);
const pageSize    = 50;
const loading     = ref(false);
const error       = ref('');
const stations    = ref([]);
const allTanks    = ref([]);

// ── Filters ───────────────────────────────────────────────────
const filters = ref({ stationId: '', status: '', startDate: '', endDate: '' });

const resetFilters = () => {
  filters.value = { stationId: '', status: '', startDate: '', endDate: '' };
  page.value = 1;
  load();
};

// ── Audit ─────────────────────────────────────────────────────
const auditItems    = ref([]);
const auditTotal    = ref(0);
const auditPage     = ref(1);
const auditPageSize = 100;
const auditLoading  = ref(false);
const auditFilters  = ref({ action: '', stationId: '', startDate: '', endDate: '' });

// ── Modal nouveau rapprochement ───────────────────────────────
const showModal   = ref(false);
const saving      = ref(false);
const formError   = ref('');
const form        = ref({ stationId: '', tankId: '', physicalL: '', reason: '', notes: '' });
const selectedTank = ref(null);

const filteredTanks = computed(() =>
  form.value.stationId ? allTanks.value.filter(t => t.stationId === form.value.stationId) : []
);
const ecart = computed(() => {
  if (!selectedTank.value || form.value.physicalL === '') return 0;
  return form.value.physicalL - selectedTank.value.currentL;
});
const ecartPct = computed(() => {
  if (!selectedTank.value || !selectedTank.value.currentL) return 0;
  return (ecart.value / selectedTank.value.currentL) * 100;
});
const tankFillPct = computed(() => {
  if (!selectedTank.value) return 0;
  return Math.min(100, Math.round((selectedTank.value.currentL / selectedTank.value.capacityL) * 100));
});

// ── Modal validation ──────────────────────────────────────────
const showValidateModal = ref(false);
const selectedRecon     = ref(null);
const validateAction    = ref('VALIDATED');
const validateNotes     = ref('');
const validateError     = ref('');
const validating        = ref(false);

// ── Load functions ────────────────────────────────────────────
const load = async () => {
  loading.value = true; error.value = '';
  try {
    const params = { page: page.value, limit: pageSize };
    if (filters.value.stationId) params.stationId = filters.value.stationId;
    if (filters.value.status)    params.status    = filters.value.status;
    if (filters.value.startDate) params.startDate = filters.value.startDate;
    if (filters.value.endDate)   params.endDate   = filters.value.endDate;
    const res = await api.get('/reconciliations', { params });
    items.value = res.data.data;
    total.value = res.data.total;
  } catch (e) {
    error.value = e.response?.data?.message || 'Erreur de chargement';
  } finally {
    loading.value = false;
  }
};

const loadAudit = async () => {
  auditLoading.value = true;
  try {
    const params = { page: auditPage.value, limit: auditPageSize };
    if (auditFilters.value.action)    params.action    = auditFilters.value.action;
    if (auditFilters.value.stationId) params.stationId = auditFilters.value.stationId;
    if (auditFilters.value.startDate) params.startDate = auditFilters.value.startDate;
    if (auditFilters.value.endDate)   params.endDate   = auditFilters.value.endDate;
    const res = await api.get('/reconciliations/audit', { params });
    auditItems.value = res.data.data;
    auditTotal.value = res.data.total;
  } catch (e) {
    console.error(e);
  } finally {
    auditLoading.value = false;
  }
};

const loadStations = async () => {
  try {
    const res = await api.get('/stations');
    const list = res.data?.data || res.data || [];
    stations.value = list;
    // Les cuves sont incluses dans la réponse (include: { tanks: true })
    const tanks = [];
    for (const s of list) {
      (s.tanks || []).forEach(t => {
        tanks.push({ ...t, stationId: s.id });
      });
    }
    allTanks.value = tanks;
  } catch (e) {
    console.error(e);
  }
};

// ── Formulaire ────────────────────────────────────────────────
const openNewModal = () => {
  form.value = { stationId: '', tankId: '', physicalL: '', reason: '', notes: '' };
  selectedTank.value = null; formError.value = '';
  showModal.value = true;
};

const onStationChange = () => {
  form.value.tankId = ''; selectedTank.value = null;
};

const onTankChange = () => {
  selectedTank.value = filteredTanks.value.find(t => t.id === form.value.tankId) || null;
};

const submitRecon = async () => {
  formError.value = '';
  if (!form.value.tankId) { formError.value = 'Sélectionnez une cuve'; return; }
  if (form.value.physicalL === '' || form.value.physicalL < 0) {
    formError.value = 'Entrez un stock physique valide (≥ 0)'; return;
  }
  saving.value = true;
  try {
    await api.post('/reconciliations', {
      tankId:    form.value.tankId,
      physicalL: form.value.physicalL,
      reason:    form.value.reason || null,
      notes:     form.value.notes  || null,
    });
    showModal.value = false;
    load();
  } catch (e) {
    formError.value = e.response?.data?.message || 'Erreur lors de la soumission';
  } finally {
    saving.value = false;
  }
};

// ── Validation ────────────────────────────────────────────────
const validate = (recon, action) => {
  selectedRecon.value  = recon;
  validateAction.value = action;
  validateNotes.value  = '';
  validateError.value  = '';
  showValidateModal.value = true;
};

const confirmValidate = async () => {
  validating.value = true; validateError.value = '';
  try {
    await api.put(`/reconciliations/${selectedRecon.value.id}/validate`, {
      action: validateAction.value,
      notes:  validateNotes.value || null,
    });
    showValidateModal.value = false;
    load();
  } catch (e) {
    validateError.value = e.response?.data?.message || 'Erreur lors de la validation';
  } finally {
    validating.value = false;
  }
};

const deleteRecon = async (recon) => {
  if (!confirm(`Supprimer ce rapprochement (${recon.station?.name} / ${recon.tank?.name}) ?`)) return;
  try {
    await api.delete(`/reconciliations/${recon.id}`);
    load();
  } catch (e) {
    alert(e.response?.data?.message || 'Erreur de suppression');
  }
};

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) { return n != null ? Number(n).toLocaleString('fr-FR') : '-'; }
function fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('fr-FR'); }
function fmtDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function statusLabel(s) {
  return s === 'PENDING' ? 'En attente' : s === 'VALIDATED' ? 'Validé' : 'Rejeté';
}
function actionLabel(a) {
  return a === 'SUPPLY' ? 'Appro.' : a === 'DISPENSE' ? 'Sortie' : a === 'RECONCILIATION' ? 'Rapprochement' : 'Ajustement';
}
function fmtRole(r) {
  const map = { SUPER_ADMIN: 'Super Admin', FLEET_MANAGER: 'Gestionnaire Flotte', STATION_MANAGER: 'Gest. Station', FUEL_MANAGER: 'Gest. Carburant', DRIVER: 'Chauffeur', VIEWER: 'Observateur' };
  return map[r] || r || '-';
}
function rowClass(r) {
  if (r.status === 'REJECTED') return 'row-rejected';
  if (r.status === 'VALIDATED' && r.adjustmentL < 0) return 'row-negative';
  if (r.status === 'VALIDATED' && r.adjustmentL > 0) return 'row-positive';
  return '';
}

onMounted(async () => {
  await loadStations();
  load();
});
</script>

<style scoped>
.reconciliations-page { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0; }
.page-subtitle { color: #64748b; font-size: 0.875rem; margin: 0; }

/* ── Tabs ── */
.tabs-bar { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 2px solid #e2e8f0; }
.tab-btn { padding: 0.6rem 1.25rem; border: none; background: transparent; cursor: pointer; font-size: 0.875rem; color: #64748b; font-weight: 600; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
.tab-btn.active { color: #1d4ed8; border-bottom-color: #1d4ed8; }
.tab-btn:hover:not(.active) { color: #334155; }

/* ── Filters ── */
.filters-bar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; margin-bottom: 1rem; background: #f8fafc; padding: 1rem; border-radius: 10px; border: 1px solid #e2e8f0; }
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-group label { font-size: 0.75rem; font-weight: 600; color: #64748b; }
.filter-group input, .filter-group select { padding: 0.4rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem; background: white; }

/* ── Table ── */
.table-wrapper { overflow-x: auto; border-radius: 10px; border: 1px solid #e2e8f0; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.data-table th { background: #f8fafc; padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
.data-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: #f8fafc; }
.num { text-align: right; }

/* Row status colors */
.row-rejected td { background: #fff5f5 !important; }
.row-negative td { background: #fff7ed !important; }
.row-positive td { background: #f0fdf4 !important; }
.audit-row-supply td     { background: #f0f9ff; }
.audit-row-dispense td   { background: #fff7ed; }
.audit-row-reconciliation td { background: #f5f3ff; }

.text-red   { color: #dc2626; }
.text-green { color: #16a34a; }
.text-muted { color: #94a3b8; }
.notes-cell { font-size: 0.78rem; color: #64748b; max-width: 250px; white-space: pre-wrap; }

/* ── Badges ── */
.status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
.status-pending   { background: #fef3c7; color: #92400e; }
.status-validated { background: #dcfce7; color: #166534; }
.status-rejected  { background: #fee2e2; color: #991b1b; }

.action-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; }
.action-supply         { background: #e0f2fe; color: #0369a1; }
.action-dispense       { background: #fef3c7; color: #92400e; }
.action-reconciliation { background: #ede9fe; color: #6d28d9; }
.action-adjustment     { background: #fee2e2; color: #991b1b; }

.fuel-badge { display: inline-block; background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; border-radius: 4px; padding: 1px 6px; font-size: 0.72rem; font-weight: 700; }
.role-label { color: #94a3b8; }

/* ── Buttons ── */
.btn { padding: 0.5rem 1.25rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s; }
.btn-primary  { background: #1d4ed8; color: white; }
.btn-primary:hover  { background: #1e40af; }
.btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
.btn-secondary:hover { background: #e2e8f0; }
.btn-success { background: #16a34a; color: white; }
.btn-success:hover { background: #15803d; }
.btn-danger  { background: #dc2626; color: white; }
.btn-danger:hover  { background: #b91c1c; }

.btn-sm { padding: 3px 8px; font-size: 0.75rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; margin-right: 4px; }
.btn-sm.btn-success { background: #dcfce7; color: #166534; }
.btn-sm.btn-success:hover { background: #bbf7d0; }
.btn-sm.btn-danger  { background: #fee2e2; color: #991b1b; }
.btn-sm.btn-danger:hover  { background: #fecaca; }
.btn-sm.btn-ghost   { background: transparent; color: #94a3b8; }
.btn-sm.btn-ghost:hover   { color: #64748b; }

/* ── States ── */
.loading-state { display: flex; flex-direction: column; align-items: center; padding: 3rem; color: #64748b; gap: 0.75rem; }
.empty-state   { text-align: center; padding: 3rem; color: #94a3b8; font-size: 0.9rem; }
.alert-error   { background: #fee2e2; color: #991b1b; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #fecaca; font-size: 0.875rem; margin-bottom: 1rem; }
.alert-warning { background: #fef3c7; color: #92400e; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #fde68a; font-size: 0.875rem; margin-bottom: 1rem; }

.spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #1d4ed8; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Pagination ── */
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; font-size: 0.875rem; }
.pagination button { padding: 0.4rem 1rem; border: 1px solid #cbd5e1; border-radius: 6px; background: white; cursor: pointer; }
.pagination button:disabled { opacity: 0.4; cursor: default; }

/* ── Modal ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal { background: white; border-radius: 16px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.modal-sm { max-width: 440px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
.modal-header h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0; }
.modal-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; padding: 0.25rem; }
.modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; }

.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group label { font-size: 0.8rem; font-weight: 700; color: #374151; }
.form-group input, .form-group select, .form-group textarea { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; }
.form-group textarea { resize: vertical; }

.tank-info-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 0.75rem 1rem; }
.tank-info-row { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px; }
.tank-info-bar { height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 8px; overflow: hidden; }
.tank-bar-fill { height: 100%; background: #1d4ed8; border-radius: 4px; transition: width 0.3s; }
.tank-bar-fill.low { background: #dc2626; }

.ecart-preview { font-size: 0.85rem; font-weight: 700; padding: 6px 10px; border-radius: 6px; margin-top: 2px; }
.ecart-positive { background: #f0fdf4; color: #166534; }
.ecart-negative { background: #fff5f5; color: #991b1b; }
.ecart-zero     { background: #f8fafc; color: #64748b; }

.validate-summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; }
.validate-row { display: flex; justify-content: space-between; font-size: 0.875rem; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
.validate-row:last-child { border-bottom: none; }
</style>

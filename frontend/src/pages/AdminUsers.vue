<template>
  <section class="users-page">

    <!-- ── Header ── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p>{{ users.length }} utilisateur{{ users.length !== 1 ? 's' : '' }} enregistré{{ users.length !== 1 ? 's' : '' }}</p>
        </div>
      </div>
      <button class="btn-refresh" :disabled="loading" @click="loadAll">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        {{ loading ? "Chargement…" : "Actualiser" }}
      </button>
    </div>

    <!-- ── Stats bar ── -->
    <div class="stats-bar">
      <div class="stat-chip">
        <span class="stat-dot green"></span>
        <span>{{ users.filter(u => u.isActive !== false).length }} actifs</span>
      </div>
      <div class="stat-chip">
        <span class="stat-dot red"></span>
        <span>{{ users.filter(u => u.isActive === false).length }} désactivés</span>
      </div>
      <div class="stat-chip">
        <span class="stat-dot blue"></span>
        <span>{{ connectedOnlineCount }} en ligne</span>
      </div>
    </div>

    <!-- ── Form card ── -->
    <div class="card form-card">
      <div class="card-header">
        <div class="card-header-icon" :class="editingId ? 'edit' : 'create'">
          <svg v-if="editingId" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <h2>{{ editingId ? "Modifier l'utilisateur" : "Nouvel utilisateur" }}</h2>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Nom complet</label>
          <input v-model.trim="form.name" type="text" placeholder="Jean Dupont" />
        </div>
        <div class="field">
          <label>Email</label>
          <input v-model.trim="form.email" type="email" placeholder="jean@entreprise.com"
            autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" name="create_user_email" />
        </div>
        <div class="field" v-if="formHasDriverRole">
          <label>Numéro de permis</label>
          <input v-model.trim="form.licenseNo" type="text" placeholder="Ex: AB123456" />
        </div>
        <div class="field">
          <label>Mot de passe {{ editingId ? "(laisser vide pour conserver)" : "" }}</label>
          <input v-model="form.password" type="password" placeholder="••••••••"
            autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" name="create_user_password" />
        </div>
        <div class="field">
          <label class="toggle-label">
            <span>Compte actif</span>
            <div class="toggle" :class="{ active: form.isActive }" @click="form.isActive = !form.isActive">
              <div class="toggle-knob"></div>
            </div>
          </label>
        </div>
      </div>

      <div class="roles-section">
        <p class="section-label">Rôles</p>
        <div class="chips-row">
          <label v-for="r in roleOptions" :key="r" class="role-chip" :class="{ selected: form.selectedRoles.includes(r) }">
            <input type="checkbox" :checked="form.selectedRoles.includes(r)" @change="toggleRole(r)" style="display:none" />
            {{ r }}
          </label>
        </div>
        <p v-if="computedPrimaryRole" class="primary-role-hint">
          Rôle effectif : <strong>{{ computedPrimaryRole }}</strong>
        </p>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Véhicule affecté (DRIVER)</label>
          <select v-model="form.assignedVehicleId">
            <option value="">Aucun</option>
            <option v-for="v in availableVehicles" :key="v.id" :value="v.id">{{ v.plate }} - {{ v.model || "N/A" }}</option>
          </select>
        </div>
      </div>

      <div class="stations-section">
        <p class="section-label">Stations affectées</p>
        <div class="chips-row">
          <label v-for="s in stations" :key="s.id" class="station-chip" :class="{ selected: form.assignedStationIds.includes(s.id) }">
            <input type="checkbox" :checked="form.assignedStationIds.includes(s.id)" @change="toggleStation(s.id)" style="display:none" />
            {{ s.name }}
          </label>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ error }}
      </div>
      <div v-if="success" class="alert alert-success">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {{ success }}
      </div>

      <div class="form-actions">
        <button class="btn-primary" :disabled="submitting" @click="saveUser">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {{ submitting ? "Enregistrement…" : (editingId ? "Mettre à jour" : "Créer l'utilisateur") }}
        </button>
        <button v-if="editingId" class="btn-cancel" @click="resetForm">Annuler</button>
      </div>
    </div>

    <!-- ── Users table ── -->
    <div class="card table-card">
      <div class="card-header">
        <div class="card-header-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        </div>
        <h2>Liste des utilisateurs</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Rôle</th>
              <th>Permis</th>
              <th>Statut</th>
              <th>Véhicule</th>
              <th>Stations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>
                <div class="user-cell">
                  <div class="avatar">{{ u.name?.charAt(0)?.toUpperCase() || '?' }}</div>
                  <div>
                    <div class="user-name">{{ u.name }}</div>
                    <div class="user-email">{{ u.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="roles-badges">
                  <span v-for="r in Array.from(new Set([u.role, ...(u.roles||[])].filter(Boolean)))" :key="r" class="role-badge" :class="roleBadgeClass(r)">{{ r }}</span>
                </div>
              </td>
              <td class="mono">{{ u.licenseNo || "-" }}</td>
              <td>
                <span class="status-pill" :class="u.isActive === false ? 'off' : 'on'">
                  <span class="pulse" v-if="u.isActive !== false"></span>
                  {{ u.isActive === false ? "Désactivé" : "Actif" }}
                </span>
              </td>
              <td class="mono">{{ u.assignedVehicle?.plate || "-" }}</td>
              <td>
                <span v-if="stationNames(u.assignedStationIds).length" class="station-names">{{ stationNames(u.assignedStationIds).join(", ") }}</span>
                <span v-else class="muted">-</span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="action-btn edit" @click="startEdit(u)" title="Modifier">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="action-btn info" @click="loadVehicleHistory(u)" title="Historique véhicule">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </button>
                  <button v-if="userHasRole(u, 'DRIVER') && u.assignedVehicleId" class="action-btn warn" @click="unassignVehicle(u)" title="Retirer véhicule">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                  <button class="action-btn" :class="u.isActive === false ? 'success' : 'warn'" @click="toggleUserStatus(u)" :title="u.isActive === false ? 'Activer' : 'Désactiver'">
                    <svg v-if="u.isActive === false" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                  <button class="action-btn danger" @click="removeUser(u)" title="Supprimer">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!users.length && !loading">
              <td colspan="7" class="empty-row">Aucun utilisateur trouvé.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Connected users ── -->
    <div class="card table-card">
      <div class="card-header">
        <div class="card-header-icon green">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h2>Utilisateurs connectés</h2>
        <div class="online-badge">{{ connectedOnlineCount }} en ligne</div>
        <button class="btn-refresh ml-auto" :disabled="loadingConnected" @click="loadConnectedUsers">
          {{ loadingConnected ? "…" : "Actualiser" }}
        </button>
      </div>
      <p class="card-sub">Fenêtre d'activité : {{ connectedWindowMinutes }} min</p>
      <div v-if="connectedError" class="alert alert-error">{{ connectedError }}</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Dernière connexion</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in connectedUsers" :key="u.id">
              <td>
                <div class="user-cell">
                  <div class="avatar" :class="u.isOnline ? 'online' : ''">{{ u.name?.charAt(0)?.toUpperCase() || '?' }}</div>
                  <div>
                    <div class="user-name">{{ u.name }}</div>
                    <div class="user-email">{{ u.email }}</div>
                  </div>
                </div>
              </td>
              <td><span class="role-badge" :class="roleBadgeClass(u.role)">{{ u.role }}</span></td>
              <td>
                <span class="status-pill" :class="u.isOnline ? 'on' : 'off'">
                  <span class="pulse" v-if="u.isOnline"></span>
                  {{ u.isOnline ? "En ligne" : "Hors ligne" }}
                </span>
              </td>
              <td class="mono">{{ formatDateTime(u.lastLoginAt) }}</td>
              <td class="mono muted">{{ u.ipAddress || "-" }}</td>
            </tr>
            <tr v-if="!connectedUsers.length && !loadingConnected">
              <td colspan="5" class="empty-row">Aucune connexion enregistrée.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Vehicle history ── -->
    <div v-if="selectedHistoryUser" class="card table-card">
      <div class="card-header">
        <div class="card-header-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </div>
        <div>
          <h2>Historique véhicule</h2>
          <p class="card-sub" style="margin:0">{{ selectedHistoryUser.name }} · {{ selectedHistoryUser.email }}</p>
        </div>
        <button class="btn-cancel ml-auto" @click="clearVehicleHistory">Fermer</button>
      </div>
      <div v-if="historyError" class="alert alert-error">{{ historyError }}</div>
      <div v-else-if="loadingHistory" class="empty-row">Chargement…</div>
      <div v-else-if="!vehicleHistory.length" class="empty-row">Aucun historique d'affectation.</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Affecté par</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in vehicleHistory" :key="h.id">
              <td class="mono">{{ h.vehicle?.plate || "-" }} - {{ h.vehicle?.model || "N/A" }}</td>
              <td class="mono">{{ formatDateTime(h.assignedAt) }}</td>
              <td>
                <span v-if="h.unassignedAt" class="mono">{{ formatDateTime(h.unassignedAt) }}</span>
                <span v-else class="status-pill on"><span class="pulse"></span>En cours</span>
              </td>
              <td>{{ h.assignedBy?.name || "Système" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </section>
</template>

<script setup>
import { computed, onActivated, onMounted, reactive, ref } from "vue";
import api from "../services/api";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();

const users = ref([]);
const vehicles = ref([]);
const stations = ref([]);
const loading = ref(false);
const submitting = ref(false);
const editingId = ref(null);
const error = ref("");
const success = ref("");
const loadingHistory = ref(false);
const historyError = ref("");
const selectedHistoryUser = ref(null);
const vehicleHistory = ref([]);
const connectedUsers = ref([]);
const connectedError = ref("");
const loadingConnected = ref(false);
const connectedWindowMinutes = ref(30);
const connectedOnlineCount = ref(0);
const ROLE_PRIORITY = ["SUPER_ADMIN", "FLEET_MANAGER", "FUEL_MANAGER", "STATION_MANAGER", "VEHICLE_MANAGER", "DRIVER", "VIEWER"];
const isFleetManager = computed(() => authStore.user?.role === "FLEET_MANAGER");
const roleOptions = computed(() =>
  isFleetManager.value ? ["DRIVER"] : [...ROLE_PRIORITY]
);
const computedPrimaryRole = computed(() =>
  ROLE_PRIORITY.find(r => form.selectedRoles.includes(r)) || ""
);
const formHasDriverRole = computed(() => form.selectedRoles.includes("DRIVER"));
const userHasRole = (u, role) => {
  const roles = Array.from(new Set([u?.role, ...((u?.roles || []))].filter(Boolean)));
  return roles.includes(role);
};
const assignedVehicleIdsByOtherDrivers = computed(() => {
  const ids = new Set();
  for (const u of users.value || []) {
    if (!userHasRole(u, "DRIVER")) continue;
    if (editingId.value && u.id === editingId.value) continue;
    if (u.assignedVehicleId) ids.add(u.assignedVehicleId);
  }
  return ids;
});
const availableVehicles = computed(() =>
  (vehicles.value || []).filter((v) => !assignedVehicleIdsByOtherDrivers.value.has(v.id))
);

const form = reactive({
  name: "", email: "", licenseNo: "", password: "",
  selectedRoles: [], isActive: true,
  assignedVehicleId: "", assignedStationIds: [],
});

const roleBadgeClass = (role) => {
  const map = {
    SUPER_ADMIN: "badge-purple", FLEET_MANAGER: "badge-blue", FUEL_MANAGER: "badge-cyan",
    STATION_MANAGER: "badge-teal", VEHICLE_MANAGER: "badge-indigo", DRIVER: "badge-orange", VIEWER: "badge-gray",
  };
  return map[role] || "badge-gray";
};

const stationNames = (ids = []) => {
  const idSet = new Set(ids || []);
  return stations.value.filter((s) => idSet.has(s.id)).map((s) => s.name);
};

const resetForm = () => {
  editingId.value = null;
  form.name = ""; form.email = ""; form.licenseNo = ""; form.password = "";
  form.selectedRoles = []; form.isActive = true;
  form.assignedVehicleId = ""; form.assignedStationIds = [];
  error.value = ""; success.value = "";
};

const formatAdditionalRoles = (roles = [], primaryRole = null) => {
  const all = Array.from(new Set([primaryRole, ...(roles || [])].filter(Boolean)));
  return all.length ? all.join(", ") : "-";
};

const toggleRole = (role) => {
  if (form.selectedRoles.includes(role)) {
    form.selectedRoles = form.selectedRoles.filter((x) => x !== role);
  } else {
    form.selectedRoles = [...form.selectedRoles, role];
  }
};

const toggleStation = (id) => {
  if (form.assignedStationIds.includes(id)) {
    form.assignedStationIds = form.assignedStationIds.filter((x) => x !== id);
  } else {
    form.assignedStationIds = [...form.assignedStationIds, id];
  }
};

const loadAll = async () => {
  loading.value = true; error.value = "";
  try {
    const [u, v, s] = await Promise.allSettled([api.get("/users"), api.get("/vehicles"), api.get("/stations")]);
    if (u.status === "fulfilled") users.value = u.value?.data?.data || u.value?.data || [];
    else throw u.reason;
    if (v.status === "fulfilled") vehicles.value = v.value?.data?.data || v.value?.data || [];
    else throw v.reason;
    if (s.status === "fulfilled") stations.value = s.value?.data?.data || s.value?.data || [];
    else stations.value = [];
  } catch (e) {
    error.value = e?.response?.data?.message || "Chargement impossible";
  } finally {
    loading.value = false;
  }
};

const loadConnectedUsers = async () => {
  loadingConnected.value = true; connectedError.value = "";
  try {
    const res = await api.get("/auth/connected-users", { params: { windowMinutes: connectedWindowMinutes.value } });
    connectedUsers.value = res?.data?.items || [];
    connectedOnlineCount.value = Number(res?.data?.onlineCount || 0);
    connectedWindowMinutes.value = Number(res?.data?.windowMinutes || connectedWindowMinutes.value || 30);
  } catch (e) {
    connectedUsers.value = []; connectedOnlineCount.value = 0;
    connectedError.value = e?.response?.data?.message || "Impossible de charger les utilisateurs connectés.";
  } finally {
    loadingConnected.value = false;
  }
};

const startEdit = (u) => {
  editingId.value = u.id;
  form.name = u.name || ""; form.email = u.email || ""; form.licenseNo = u.licenseNo || "";
  form.password = "";
  const allRoles = Array.from(new Set([u.role, ...(Array.isArray(u.roles) ? u.roles : [])].filter(Boolean)));
  form.selectedRoles = allRoles;
  form.isActive = u.isActive !== false;
  form.assignedVehicleId = u.assignedVehicleId || "";
  form.assignedStationIds = Array.from(new Set([
    ...(u.assignedStationIds || []),
    ...(u.assignedStationId ? [u.assignedStationId] : [])
  ]));
};

const saveUser = async () => {
  error.value = ""; success.value = "";
  if (!form.name || !form.email || (!editingId.value && !form.password)) {
    error.value = "Nom, email et mot de passe (création) sont requis"; return;
  }
  if (!computedPrimaryRole.value) { error.value = "Sélectionnez au moins un rôle."; return; }
  if (formHasDriverRole.value && !form.licenseNo) {
    error.value = "Le numéro de permis est requis pour un chauffeur."; return;
  }
  if (formHasDriverRole.value && form.isActive === false && form.assignedVehicleId) {
    error.value = "Retirez d'abord le véhicule avant de désactiver ce chauffeur."; return;
  }
  if (formHasDriverRole.value && form.assignedVehicleId && assignedVehicleIdsByOtherDrivers.value.has(form.assignedVehicleId)) {
    error.value = "Ce véhicule est déjà affecté à un autre chauffeur."; return;
  }
  submitting.value = true;
  try {
    const primaryRole = computedPrimaryRole.value;
    const payload = {
      name: form.name, email: form.email,
      licenseNo: formHasDriverRole.value ? form.licenseNo : null,
      role: primaryRole,
      roles: form.selectedRoles.filter((r) => r !== primaryRole),
      isActive: form.isActive !== false,
      assignedVehicleId: form.assignedVehicleId || null,
      assignedStationId: form.assignedStationIds[0] || null,
      assignedStationIds: form.assignedStationIds || [],
    };
    if (form.password) payload.password = form.password;
    if (editingId.value) {
      await api.put(`/users/${editingId.value}`, payload);
      success.value = "Utilisateur mis à jour avec succès";
    } else {
      await api.post("/users", payload);
      success.value = "Utilisateur créé avec succès";
    }
    resetForm(); await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.message || "Erreur de sauvegarde";
  } finally {
    submitting.value = false;
  }
};

const unassignVehicle = async (u) => {
  if (!window.confirm(`Retirer le véhicule de ${u.name} ?`)) return;
  error.value = ""; success.value = "";
  try {
    await api.put(`/users/${u.id}`, { assignedVehicleId: null });
    success.value = "Véhicule retiré avec succès."; await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.message || "Impossible de retirer le véhicule.";
  }
};

const toggleUserStatus = async (u) => {
  error.value = ""; success.value = "";
  const nextActive = u.isActive === false;
  if (!nextActive && u.role === "DRIVER" && u.assignedVehicleId) {
    error.value = "Retirez d'abord le véhicule avant de désactiver ce chauffeur."; return;
  }
  try {
    await api.put(`/users/${u.id}`, { isActive: nextActive });
    success.value = nextActive ? "Utilisateur activé." : "Utilisateur désactivé."; await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.message || "Impossible de changer le statut utilisateur.";
  }
};

const removeUser = async (u) => {
  if (!window.confirm(`Supprimer définitivement ${u.name} ?`)) return;
  error.value = ""; success.value = "";
  try {
    await api.delete(`/users/${u.id}`);
    success.value = "Utilisateur supprimé"; await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.message || "Erreur de suppression";
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR");
};

const clearVehicleHistory = () => {
  selectedHistoryUser.value = null; vehicleHistory.value = []; historyError.value = "";
};

const loadVehicleHistory = async (user) => {
  selectedHistoryUser.value = user; vehicleHistory.value = []; historyError.value = ""; loadingHistory.value = true;
  try {
    const res = await api.get(`/users/${user.id}/vehicle-history`);
    vehicleHistory.value = res.data || [];
  } catch (e) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message;
    if (status === 404) historyError.value = "Historique indisponible: endpoint backend non trouvé.";
    else if (status === 500) historyError.value = `Erreur serveur: ${msg || "migration Prisma manquante"}`;
    else historyError.value = msg || "Impossible de charger l'historique.";
  } finally {
    loadingHistory.value = false;
  }
};

const initializePageState = () => { resetForm(); clearVehicleHistory(); };

onMounted(async () => { initializePageState(); await Promise.all([loadAll(), loadConnectedUsers()]); });
onActivated(() => { initializePageState(); loadConnectedUsers(); });
</script>

<style scoped>
.users-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Header ── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.page-header-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.page-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
}
.page-header p {
  margin: 2px 0 0;
  font-size: 13px;
  color: #64748b;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-refresh:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.ml-auto { margin-left: auto; }

/* ── Stats ── */
.stats-bar {
  display: flex;
  gap: 12px;
}
.stat-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.stat-dot {
  width: 8px; height: 8px; border-radius: 50%;
}
.stat-dot.green { background: #22c55e; }
.stat-dot.red { background: #ef4444; }
.stat-dot.blue { background: #3b82f6; }

/* ── Cards ── */
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  border-bottom: 1px solid #f1f5f9;
}
.card-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}
.card-header-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  flex-shrink: 0;
}
.card-header-icon.create { background: #ede9fe; color: #7c3aed; }
.card-header-icon.edit { background: #dbeafe; color: #2563eb; }
.card-header-icon.green { background: #dcfce7; color: #16a34a; }

.card-sub {
  margin: 0;
  padding: 8px 22px 0;
  font-size: 12px;
  color: #94a3b8;
}

.online-badge {
  padding: 4px 10px;
  background: #dcfce7;
  color: #15803d;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

/* ── Form ── */
.form-card { }
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 20px 22px 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.field input, .field select {
  height: 40px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  color: #0f172a;
  background: #f8fafc;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field input:focus, .field select:focus {
  outline: none;
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}

.toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding-top: 22px;
}
.toggle {
  width: 44px; height: 24px;
  background: #e2e8f0;
  border-radius: 999px;
  position: relative;
  transition: background 0.2s;
  cursor: pointer;
}
.toggle.active { background: #4f46e5; }
.toggle-knob {
  position: absolute;
  top: 3px; left: 3px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle.active .toggle-knob { transform: translateX(20px); }

.roles-section, .stations-section {
  padding: 16px 22px 0;
}
.section-label {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.primary-role-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #64748b;
}
.primary-role-hint strong { color: #4f46e5; }

.role-chip, .station-chip {
  padding: 6px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.role-chip:hover, .station-chip:hover { border-color: #6366f1; color: #4f46e5; }
.role-chip.selected, .station-chip.selected {
  border-color: #4f46e5;
  background: #ede9fe;
  color: #4f46e5;
}

/* ── Alerts ── */
.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 22px 0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}
.alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }

/* ── Form actions ── */
.form-actions {
  display: flex;
  gap: 10px;
  padding: 20px 22px;
}
.btn-primary {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
  box-shadow: 0 4px 12px -2px rgba(79,70,229,0.4);
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-cancel {
  padding: 10px 18px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-cancel:hover { background: #f8fafc; border-color: #cbd5e1; }

/* ── Table ── */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
thead tr { background: #f8fafc; }
th {
  padding: 11px 16px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
}
td {
  padding: 13px 16px;
  font-size: 13px;
  color: #1e293b;
  border-bottom: 1px solid #f8fafc;
  vertical-align: middle;
}
tbody tr:hover { background: #fafbff; }
tbody tr:last-child td { border-bottom: none; }

.empty-row {
  text-align: center;
  color: #94a3b8;
  padding: 32px;
  font-size: 14px;
}

/* ── User cell ── */
.user-cell { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800;
  flex-shrink: 0;
  position: relative;
}
.avatar.online::after {
  content: '';
  position: absolute;
  bottom: 1px; right: 1px;
  width: 9px; height: 9px;
  background: #22c55e;
  border: 2px solid #fff;
  border-radius: 50%;
}
.user-name { font-size: 13px; font-weight: 700; color: #0f172a; }
.user-email { font-size: 11px; color: #94a3b8; margin-top: 1px; }

/* ── Badges ── */
.role-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.badge-purple { background: #ede9fe; color: #6d28d9; }
.badge-blue { background: #dbeafe; color: #1d4ed8; }
.badge-cyan { background: #cffafe; color: #0e7490; }
.badge-teal { background: #ccfbf1; color: #0f766e; }
.badge-indigo { background: #e0e7ff; color: #4338ca; }
.badge-orange { background: #ffedd5; color: #c2410c; }
.badge-gray { background: #f1f5f9; color: #475569; }

.roles-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ── Status pill ── */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.status-pill.on { background: #dcfce7; color: #15803d; }
.status-pill.off { background: #fee2e2; color: #b91c1c; }

.pulse {
  width: 7px; height: 7px; border-radius: 50%;
  background: #22c55e;
  animation: pulse 1.8s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
}

/* ── Row actions ── */
.row-actions { display: flex; gap: 5px; flex-wrap: wrap; }
.action-btn {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  color: #475569;
}
.action-btn:hover { transform: translateY(-1px); }
.action-btn.edit:hover { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
.action-btn.info:hover { background: #e0e7ff; border-color: #a5b4fc; color: #4338ca; }
.action-btn.warn:hover { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
.action-btn.success:hover { background: #dcfce7; border-color: #86efac; color: #15803d; }
.action-btn.danger:hover { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }

/* ── Misc ── */
.mono { font-family: monospace; font-size: 12px; }
.muted { color: #94a3b8; }
.station-names { font-size: 12px; color: #374151; }

@media (max-width: 768px) {
  .users-page { padding: 16px; }
  .form-grid { grid-template-columns: 1fr; }
  .stats-bar { flex-wrap: wrap; }
}
</style>

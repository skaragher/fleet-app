<template>
  <section class="users-page">
    <header class="page-head">
      <h1>Gestion des utilisateurs</h1>
      <button class="btn" :disabled="loading" @click="loadAll">{{ loading ? "..." : "Actualiser" }}</button>
    </header>

    <div class="card form-card">
      <h2>{{ editingId ? "Modifier un utilisateur" : "Créer un utilisateur" }}</h2>
      <div class="grid">
        <label>
          Nom
          <input v-model.trim="form.name" type="text" />
        </label>
        <label>
          Email
          <input
            v-model.trim="form.email"
            type="email"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            name="create_user_email"
          />
        </label>
        <label v-if="formHasDriverRole">
          Numéro de permis
          <input v-model.trim="form.licenseNo" type="text" placeholder="Ex: AB123456" />
        </label>
        <label>
          Mot de passe {{ editingId ? "(laisser vide pour ne pas changer)" : "" }}
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            name="create_user_password"
          />
        </label>
        <label>
          Rôle
          <select v-model="form.role">
            <option value="">Aucun</option>
            <option v-for="r in roleOptions" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
        <div v-if="canManageMultipleRoles" class="roles-box">
          <p>Rôles additionnels</p>
          <div class="roles-list">
            <label v-for="r in additionalRoleOptions" :key="r" class="check">
              <input
                type="checkbox"
                :checked="form.roles.includes(r)"
                @change="toggleAdditionalRole(r)"
              />
              {{ r }}
            </label>
          </div>
        </div>
        <label class="inline-check">
          <span>Utilisateur actif</span>
          <input v-model="form.isActive" type="checkbox" />
        </label>
      </div>

      <div class="grid">
        <label>
          Véhicule affecté (DRIVER)
          <select v-model="form.assignedVehicleId">
            <option value="">Aucun</option>
            <option v-for="v in availableVehicles" :key="v.id" :value="v.id">{{ v.plate }} - {{ v.model || "N/A" }}</option>
          </select>
        </label>

        <label>
          Station principale
          <select v-model="form.assignedStationId">
            <option value="">Aucune</option>
            <option v-for="s in stations" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
      </div>

      <div class="stations-box">
        <p>Stations affectées (gestionnaire station: une ou plusieurs)</p>
        <div class="stations-list">
          <label v-for="s in stations" :key="s.id" class="check">
            <input type="checkbox" :checked="form.assignedStationIds.includes(s.id)" @change="toggleStation(s.id)" />
            {{ s.name }}
          </label>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" :disabled="submitting" @click="saveUser">{{ submitting ? "..." : "Enregistrer" }}</button>
        <button v-if="editingId" class="btn" @click="resetForm">Annuler</button>
      </div>
      <p v-if="error" class="msg err">{{ error }}</p>
      <p v-if="success" class="msg ok">{{ success }}</p>
    </div>

    <div class="card table-card">
      <h2>Utilisateurs</h2>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Permis</th>
            <th>Rôle</th>
            <th>Rôles additionnels</th>
            <th>Statut</th>
            <th>Véhicule</th>
            <th>Stations</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.name }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.licenseNo || "-" }}</td>
            <td>{{ u.role }}</td>
            <td>{{ formatAdditionalRoles(u.roles, u.role) }}</td>
            <td>
              <span :class="['status-pill', u.isActive === false ? 'off' : 'on']">
                {{ u.isActive === false ? "Désactivé" : "Actif" }}
              </span>
            </td>
            <td>{{ u.assignedVehicle?.plate || "-" }}</td>
            <td>{{ stationNames(u.assignedStationIds).join(", ") || "-" }}</td>
            <td>
              <div class="table-actions">
                <button class="btn small" @click="startEdit(u)">Modifier</button>
                <button class="btn small info" @click="loadVehicleHistory(u)">Historique</button>
                <button
                  class="btn small warn"
                  v-if="userHasRole(u, 'DRIVER') && u.assignedVehicleId"
                  @click="unassignVehicle(u)"
                >
                  Retirer véhicule
                </button>
                <button class="btn small" @click="toggleUserStatus(u)">
                  {{ u.isActive === false ? "Activer" : "Désactiver" }}
                </button>
                <button class="btn small danger" @click="removeUser(u)">Supprimer</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card table-card">
      <div class="history-head">
        <h2>Utilisateurs connectés</h2>
        <button class="btn small" :disabled="loadingConnected" @click="loadConnectedUsers">
          {{ loadingConnected ? "..." : "Actualiser" }}
        </button>
      </div>
      <p class="history-sub">
        Fenêtre d'activité: {{ connectedWindowMinutes }} min • En ligne: <strong>{{ connectedOnlineCount }}</strong> / {{ connectedUsers.length }}
      </p>
      <p v-if="connectedError" class="msg err">{{ connectedError }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Rôle</th>
            <th>Statut</th>
            <th>Dernière connexion</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in connectedUsers" :key="u.id">
            <td>{{ u.name }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.role }}</td>
            <td>
              <span :class="['status-pill', u.isOnline ? 'on' : 'off']">
                {{ u.isOnline ? "En ligne" : "Hors ligne" }}
              </span>
            </td>
            <td>{{ formatDateTime(u.lastLoginAt) }}</td>
            <td>{{ u.ipAddress || "-" }}</td>
          </tr>
          <tr v-if="!connectedUsers.length && !loadingConnected">
            <td colspan="6" class="history-empty">Aucune connexion enregistrée.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedHistoryUser" class="card history-card">
      <div class="history-head">
        <h2>Historique d'affectation véhicule</h2>
        <button class="btn small" @click="clearVehicleHistory">Fermer</button>
      </div>
      <p class="history-sub">
        Chauffeur: <strong>{{ selectedHistoryUser.name }}</strong> ({{ selectedHistoryUser.email }})
      </p>

      <p v-if="historyError" class="msg err">{{ historyError }}</p>
      <p v-else-if="loadingHistory" class="history-loading">Chargement de l'historique...</p>
      <p v-else-if="!vehicleHistory.length" class="history-empty">Aucun historique d'affectation.</p>

      <table v-else>
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
            <td>{{ h.vehicle?.plate || "-" }} - {{ h.vehicle?.model || "N/A" }}</td>
            <td>{{ formatDateTime(h.assignedAt) }}</td>
            <td>{{ h.unassignedAt ? formatDateTime(h.unassignedAt) : "En cours" }}</td>
            <td>{{ h.assignedBy?.name || "Système" }}</td>
          </tr>
        </tbody>
      </table>
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
const isFleetManager = computed(() => authStore.user?.role === "FLEET_MANAGER");
const canManageMultipleRoles = computed(() => authStore.isSuperAdmin === true);
const roleOptions = computed(() =>
  isFleetManager.value
    ? ["DRIVER"]
    : ["SUPER_ADMIN", "FLEET_MANAGER", "FUEL_MANAGER", "STATION_MANAGER", "VEHICLE_MANAGER", "DRIVER", "VIEWER"]
);
const additionalRoleOptions = computed(() => roleOptions.value.filter((r) => r !== form.role));
const formHasDriverRole = computed(() =>
  Array.from(new Set([form.role, ...(form.roles || [])].filter(Boolean))).includes("DRIVER")
);
const defaultRole = computed(() => "");
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
  name: "",
  email: "",
  licenseNo: "",
  password: "",
  role: defaultRole.value,
  roles: [],
  isActive: true,
  assignedVehicleId: "",
  assignedStationId: "",
  assignedStationIds: [],
});

const stationNames = (ids = []) => {
  const idSet = new Set(ids || []);
  return stations.value.filter((s) => idSet.has(s.id)).map((s) => s.name);
};

const resetForm = () => {
  editingId.value = null;
  form.name = "";
  form.email = "";
  form.licenseNo = "";
  form.password = "";
  form.role = defaultRole.value;
  form.roles = [];
  form.isActive = true;
  form.assignedVehicleId = "";
  form.assignedStationId = "";
  form.assignedStationIds = [];
  error.value = "";
  success.value = "";
};

const formatAdditionalRoles = (roles = [], primaryRole = null) => {
  const filtered = Array.from(new Set((roles || []).filter((r) => r && r !== primaryRole)));
  return filtered.length ? filtered.join(", ") : "-";
};

const toggleAdditionalRole = (role) => {
  if (role === form.role) return;
  if (form.roles.includes(role)) {
    form.roles = form.roles.filter((x) => x !== role);
  } else {
    form.roles = [...form.roles, role];
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
  loading.value = true;
  error.value = "";
  try {
    const [u, v, s] = await Promise.allSettled([api.get("/users"), api.get("/vehicles"), api.get("/stations")]);

    if (u.status === "fulfilled") {
      users.value = u.value?.data?.data || u.value?.data || [];
    } else {
      throw u.reason;
    }

    if (v.status === "fulfilled") {
      vehicles.value = v.value?.data?.data || v.value?.data || [];
    } else {
      throw v.reason;
    }

    if (s.status === "fulfilled") {
      stations.value = s.value?.data?.data || s.value?.data || [];
    } else {
      stations.value = [];
    }
  } catch (e) {
    error.value = e?.response?.data?.message || "Chargement impossible";
  } finally {
    loading.value = false;
  }
};

const loadConnectedUsers = async () => {
  loadingConnected.value = true;
  connectedError.value = "";
  try {
    const res = await api.get("/auth/connected-users", {
      params: { windowMinutes: connectedWindowMinutes.value },
    });
    connectedUsers.value = res?.data?.items || [];
    connectedOnlineCount.value = Number(res?.data?.onlineCount || 0);
    connectedWindowMinutes.value = Number(res?.data?.windowMinutes || connectedWindowMinutes.value || 30);
  } catch (e) {
    connectedUsers.value = [];
    connectedOnlineCount.value = 0;
    connectedError.value = e?.response?.data?.message || "Impossible de charger les utilisateurs connectés.";
  } finally {
    loadingConnected.value = false;
  }
};

const startEdit = (u) => {
  editingId.value = u.id;
  form.name = u.name || "";
  form.email = u.email || "";
  form.licenseNo = u.licenseNo || "";
  form.password = "";
  form.role = u.role || "VIEWER";
  form.roles = Array.isArray(u.roles) ? u.roles.filter((r) => r && r !== (u.role || "VIEWER")) : [];
  form.isActive = u.isActive !== false;
  form.assignedVehicleId = u.assignedVehicleId || "";
  form.assignedStationId = u.assignedStationId || "";
  form.assignedStationIds = [...(u.assignedStationIds || [])];
};

const saveUser = async () => {
  error.value = "";
  success.value = "";

  if (!form.name || !form.email || (!editingId.value && !form.password)) {
    error.value = "Nom, email et mot de passe (création) sont requis";
    return;
  }
  if (!form.role) {
    error.value = "Le rôle est requis.";
    return;
  }
  if (formHasDriverRole.value && !form.licenseNo) {
    error.value = "Le numéro de permis est requis pour un chauffeur.";
    return;
  }

  if (formHasDriverRole.value && form.isActive === false && form.assignedVehicleId) {
    error.value = "Retirez d'abord le véhicule avant de désactiver ce chauffeur.";
    return;
  }

  if (formHasDriverRole.value && form.assignedVehicleId && assignedVehicleIdsByOtherDrivers.value.has(form.assignedVehicleId)) {
    error.value = "Ce véhicule est déjà affecté à un autre chauffeur.";
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      name: form.name,
      email: form.email,
      licenseNo: formHasDriverRole.value ? form.licenseNo : null,
      role: form.role,
      roles: canManageMultipleRoles.value ? form.roles.filter((r) => r !== form.role) : undefined,
      isActive: form.isActive !== false,
      assignedVehicleId: form.assignedVehicleId || null,
      assignedStationId: form.assignedStationId || null,
      assignedStationIds: form.assignedStationIds || [],
    };
    if (form.password) payload.password = form.password;

    if (editingId.value) {
      await api.put(`/users/${editingId.value}`, payload);
      success.value = "Utilisateur mis à jour";
    } else {
      await api.post("/users", payload);
      success.value = "Utilisateur créé";
    }
    resetForm();
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.message || "Erreur de sauvegarde";
  } finally {
    submitting.value = false;
  }
};

const unassignVehicle = async (u) => {
  if (!window.confirm(`Retirer le véhicule de ${u.name} ?`)) return;
  error.value = "";
  success.value = "";
  try {
    await api.put(`/users/${u.id}`, { assignedVehicleId: null });
    success.value = "Véhicule retiré avec succès.";
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.message || "Impossible de retirer le véhicule.";
  }
};

const toggleUserStatus = async (u) => {
  error.value = "";
  success.value = "";
  const nextActive = u.isActive === false;
  if (!nextActive && u.role === "DRIVER" && u.assignedVehicleId) {
    error.value = "Retirez d'abord le véhicule avant de désactiver ce chauffeur.";
    return;
  }
  try {
    await api.put(`/users/${u.id}`, { isActive: nextActive });
    success.value = nextActive ? "Utilisateur activé." : "Utilisateur désactivé.";
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.message || "Impossible de changer le statut utilisateur.";
  }
};

const removeUser = async (u) => {
  if (!window.confirm(`Supprimer ${u.name} ?`)) return;
  error.value = "";
  success.value = "";
  try {
    await api.delete(`/users/${u.id}`);
    success.value = "Utilisateur supprimé";
    await loadAll();
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
  selectedHistoryUser.value = null;
  vehicleHistory.value = [];
  historyError.value = "";
};

const loadVehicleHistory = async (user) => {
  selectedHistoryUser.value = user;
  vehicleHistory.value = [];
  historyError.value = "";
  loadingHistory.value = true;
  try {
    const res = await api.get(`/users/${user.id}/vehicle-history`);
    vehicleHistory.value = res.data || [];
  } catch (e) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message;
    if (status === 404) {
      historyError.value = "Historique indisponible: endpoint backend non trouvé. Redémarre le backend.";
    } else if (status === 500) {
      historyError.value = `Erreur serveur historique: ${msg || "migration Prisma manquante"}`;
    } else {
      historyError.value = msg || "Impossible de charger l'historique.";
    }
  } finally {
    loadingHistory.value = false;
  }
};

const initializePageState = () => {
  resetForm();
  clearVehicleHistory();
};

onMounted(async () => {
  initializePageState();
  await Promise.all([loadAll(), loadConnectedUsers()]);
});

onActivated(() => {
  initializePageState();
  loadConnectedUsers();
});
</script>

<style scoped>
.users-page { padding: 20px; display: grid; gap: 14px; }
.page-head { display: flex; justify-content: space-between; align-items: center; }
.card { background: #fff; border: 1px solid #dbe3ef; border-radius: 10px; padding: 14px; }
.grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 10px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #334155; }
.inline-check { justify-content: center; }
.inline-check input { width: 18px; height: 18px; }
input, select { height: 36px; border: 1px solid #c9d4e5; border-radius: 8px; padding: 0 10px; }
.stations-box { border: 1px dashed #c9d4e5; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.stations-list { display: flex; flex-wrap: wrap; gap: 10px 16px; }
.roles-box { border: 1px dashed #c9d4e5; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.roles-box p { margin: 0 0 8px; font-size: 12px; color: #475569; font-weight: 600; }
.roles-list { display: flex; flex-wrap: wrap; gap: 10px 16px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.check input { height: auto; }
.actions { display: flex; gap: 8px; }
.btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.btn.primary { border: none; background: #2563eb; color: #fff; }
.btn.small { padding: 6px 8px; font-size: 12px; }
.btn.info { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
.btn.warn { color: #92400e; border-color: #fcd34d; background: #fffbeb; }
.btn.danger { color: #b91c1c; border-color: #fecaca; background: #fff5f5; }
.table-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.status-pill { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
.status-pill.on { background: #dcfce7; color: #166534; }
.status-pill.off { background: #fee2e2; color: #991b1b; }
.msg { margin: 8px 0 0; font-weight: 600; font-size: 12px; }
.msg.err { color: #b91c1c; }
.msg.ok { color: #166534; }
.history-card { margin-top: 0; }
.history-head { display: flex; justify-content: space-between; align-items: center; }
.history-sub { margin: 6px 0 10px; color: #475569; font-size: 13px; }
.history-loading, .history-empty { margin: 8px 0; color: #64748b; font-size: 13px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5edf7; font-size: 13px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>

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
          <input v-model.trim="form.email" type="email" />
        </label>
        <label>
          Mot de passe {{ editingId ? "(laisser vide pour ne pas changer)" : "" }}
          <input v-model="form.password" type="password" />
        </label>
        <label>
          Rôle
          <select v-model="form.role">
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="FLEET_MANAGER">FLEET_MANAGER</option>
            <option value="STATION_MANAGER">STATION_MANAGER</option>
            <option value="VEHICLE_MANAGER">VEHICLE_MANAGER</option>
            <option value="DRIVER">DRIVER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>
      </div>

      <div class="grid">
        <label>
          Véhicule affecté (DRIVER)
          <select v-model="form.assignedVehicleId">
            <option value="">Aucun</option>
            <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.plate }} - {{ v.model || "N/A" }}</option>
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
            <th>Rôle</th>
            <th>Véhicule</th>
            <th>Stations</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.name }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.role }}</td>
            <td>{{ u.assignedVehicle?.plate || "—" }}</td>
            <td>{{ stationNames(u.assignedStationIds).join(", ") || "—" }}</td>
            <td>
              <button class="btn small" @click="startEdit(u)">Modifier</button>
              <button class="btn small danger" @click="removeUser(u)">Supprimer</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import api from "../services/api";

const users = ref([]);
const vehicles = ref([]);
const stations = ref([]);
const loading = ref(false);
const submitting = ref(false);
const editingId = ref(null);
const error = ref("");
const success = ref("");

const form = reactive({
  name: "",
  email: "",
  password: "",
  role: "VIEWER",
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
  form.password = "";
  form.role = "VIEWER";
  form.assignedVehicleId = "";
  form.assignedStationId = "";
  form.assignedStationIds = [];
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
    const [u, v, s] = await Promise.all([api.get("/users"), api.get("/vehicles"), api.get("/stations")]);
    users.value = u.data || [];
    vehicles.value = v.data || [];
    stations.value = s.data || [];
  } catch (e) {
    error.value = e?.response?.data?.message || "Chargement impossible";
  } finally {
    loading.value = false;
  }
};

const startEdit = (u) => {
  editingId.value = u.id;
  form.name = u.name || "";
  form.email = u.email || "";
  form.password = "";
  form.role = u.role || "VIEWER";
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

  submitting.value = true;
  try {
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
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

onMounted(loadAll);
</script>

<style scoped>
.users-page { padding: 20px; display: grid; gap: 14px; }
.page-head { display: flex; justify-content: space-between; align-items: center; }
.card { background: #fff; border: 1px solid #dbe3ef; border-radius: 10px; padding: 14px; }
.grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 10px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #334155; }
input, select { height: 36px; border: 1px solid #c9d4e5; border-radius: 8px; padding: 0 10px; }
.stations-box { border: 1px dashed #c9d4e5; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.stations-list { display: flex; flex-wrap: wrap; gap: 10px 16px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.check input { height: auto; }
.actions { display: flex; gap: 8px; }
.btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.btn.primary { border: none; background: #2563eb; color: #fff; }
.btn.small { padding: 6px 8px; font-size: 12px; }
.btn.danger { color: #b91c1c; border-color: #fecaca; background: #fff5f5; }
.msg { margin: 8px 0 0; font-weight: 600; font-size: 12px; }
.msg.err { color: #b91c1c; }
.msg.ok { color: #166534; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5edf7; font-size: 13px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>


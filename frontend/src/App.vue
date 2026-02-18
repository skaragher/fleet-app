<template>
  <div class="layout" :class="{ 'sidebar-open': isMenuOpen }">
    <!-- Overlay : voile sombre pour fermer le menu sur mobile -->
    <div v-if="isMenuOpen" class="sidebar-overlay" @click="closeMenu"></div>

    <header class="topbar">
      <div class="brand-section">
        <!-- Bouton Burger visible uniquement sur mobile -->
        <button v-if="auth.token" class="menu-toggle" @click="toggleMenu" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
            <path v-if="isMenuOpen" d="M6 18L18 6M6 6l12 12"/>
            <path v-else d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </button>
        <div class="brand">
          <div class="logo">
            <span class="logo-icon">⛽</span>
          </div>
          <div class="brand-text">
            <h1 class="brand-title">FLOTTECH</h1>
            <p class="brand-subtitle">MANAGER</p>
          </div>
        </div>
      </div>

      <div class="topbar-actions">
        <div v-if="auth.user" class="user-profile">
          <div class="user-info">
            <div class="user-details">
              <p class="user-name">{{ auth.user.name }}</p>
              <div class="user-meta">
                <span class="user-role" :class="getRoleClass(auth.user.role)">
                  {{ formatRoleLabel(auth.user.role) }}
                </span>
                <!-- Affichage des ressources assignées -->
                <div v-if="assignedVehicle || assignedStation" class="user-assignments">
                  <span v-if="assignedVehicle" class="assignment-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-2.7-.6-4.5-1.9C10.7 7.3 10 6.1 10 5V3c0-.6-.4-1-1-1H8"/>
                      <path d="M3 17h2c.6 0 1-.4 1-1v-3c0-.9.7-1.7 1.5-1.9C7.3 10.6 10 10 10 10s2.7-.6 4.5-1.9C15.3 7.3 16 6.1 16 5V3c0-.6.4-1 1-1h2"/>
                    </svg>
                    {{ assignedVehicle.plate }}
                  </span>
                  <span v-if="assignedStation" class="assignment-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M8 2v4M16 2v4"/>
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <path d="M8 10h8M8 14h8M8 18h8"/>
                    </svg>
                    {{ assignedStation.name }}
                  </span>
                </div>
              </div>
            </div>
            <div class="user-avatar" :class="getRoleClass(auth.user.role)">
              {{ getUserInitials(auth.user.name) }}
            </div>
          </div>
          <button class="btn-logout" @click="logout" title="Déconnexion">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="body">
      <aside v-if="auth.token" class="sidebar">
        <div class="sidebar-header">
          <h3 class="sidebar-title">Navigation</h3>
          <div class="user-role-badge" :class="getRoleClass(auth.user?.role)">
            {{ formatRoleLabel(auth.user?.role) }}
          </div>
        </div>
        
        <nav class="nav-menu">
          <!-- Dashboard -->
          <RouterLink to="/" class="nav-item" @click="closeMenu">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="9"/>
                <rect x="14" y="3" width="7" height="5"/>
                <rect x="14" y="12" width="7" height="9"/>
                <rect x="3" y="16" width="7" height="5"/>
              </svg>
            </div>
            <span class="nav-label">Dashboard</span>
            <span class="nav-badge" v-if="$route.path === '/'">●</span>
          </RouterLink>

          <!-- Parc Automobile -->
          <div v-if="canAccessVehicles" class="nav-section">
            <div class="nav-section-title">
              <span>Parc Automobile</span>
              <span class="section-icon">🚙</span>
            </div>
            <RouterLink 
              v-if="canAccessVehicles" 
              to="/vehicles" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/vehicles') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-2.7-.6-4.5-1.9C10.7 7.3 10 6.1 10 5V3c0-.6-.4-1-1-1H8"/>
                  <path d="M3 17h2c.6 0 1-.4 1-1v-3c0-.9.7-1.7 1.5-1.9C7.3 10.6 10 10 10 10s2.7-.6 4.5-1.9C15.3 7.3 16 6.1 16 5V3c0-.6.4-1 1-1h2"/>
                </svg>
              </div>
              <span class="nav-label">Véhicules</span>
              <span v-if="!canEditVehicles && auth.user?.role !== 'VIEWER'" class="read-only-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
            </RouterLink>
          </div>

          <!-- Énergie & Fluides -->
          <div v-if="canAccessStations" class="nav-section">
            <div class="nav-section-title">
              <span>Énergie & Fluides</span>
              <span class="section-icon">⛽</span>
            </div>
            <RouterLink 
              v-if="canAccessStations" 
              to="/stations" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/stations') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <span class="nav-label">Stations & Cuves</span>
              <span v-if="!canEditStations && auth.user?.role !== 'VIEWER'" class="read-only-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
            </RouterLink>
          </div>

          <!-- Gestion Carburant -->
          <div v-if="canManageFuel" class="nav-section">
            <div class="nav-section-title">
              <span>Gestion Carburant</span>
              <span class="section-icon">🛢️</span>
            </div>
            <RouterLink 
              v-if="canManageFuel" 
              to="/fuel/supplies" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/fuel/supplies') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 12V8H6a2 2 0 0 1-2-2V3"/>
                  <path d="M2 12h20v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9z"/>
                </svg>
              </div>
              <span class="nav-label">Approvisionnements</span>
            </RouterLink>
            <RouterLink 
              v-if="canManageFuel" 
              to="/fuel/dispenses" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/fuel/dispenses') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <span class="nav-label">Ravitaillements</span>
            </RouterLink>
          </div>

          <!-- Maintenance -->
          <div v-if="canAccessMaintenance" class="nav-section">
            <div class="nav-section-title">
              <span>Maintenance</span>
              <span class="section-icon">🛠️</span>
            </div>
            <RouterLink 
              v-if="canAccessMaintenance" 
              to="/maintenance" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/maintenance') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <span class="nav-label">Entretien</span>
              <span v-if="!canEditMaintenance" class="read-only-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
            </RouterLink>
            <RouterLink 
              v-if="canAccessMaintenance" 
              to="/insurance" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/insurance') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <span class="nav-label">Assurances</span>
              <span v-if="!canEditMaintenance" class="read-only-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
            </RouterLink>
            <RouterLink 
              v-if="canAccessMaintenance" 
              to="/inspections" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/inspections') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
              </div>
              <span class="nav-label">Visites techniques</span>
              <span v-if="!canEditMaintenance" class="read-only-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
            </RouterLink>
          </div>

          <!-- Administration -->
          <div v-if="canManageUsers" class="nav-section">
            <div class="nav-section-title">
              <span>Administration</span>
              <span class="section-icon">👥</span>
            </div>
            <RouterLink 
              v-if="canManageUsers" 
              to="/admin/users" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/admin/users') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <span class="nav-label">Utilisateurs</span>
            </RouterLink>
            <RouterLink 
              v-if="canViewReports" 
              to="/reports" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/reports') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                </svg>
              </div>
              <span class="nav-label">Rapports</span>
            </RouterLink>
          </div>

          <!-- Mon Espace -->
          <div class="nav-section">
            <div class="nav-section-title">
              <span>Mon Espace</span>
              <span class="section-icon">👤</span>
            </div>
            <RouterLink 
              to="/profile" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes('/profile') }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <span class="nav-label">Mon Profil</span>
            </RouterLink>
            
            <RouterLink 
              v-if="isVehicleManager || isDriver" 
              :to="`/vehicles/${auth.user?.assignedVehicleId}`" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes(`/vehicles/${auth.user?.assignedVehicleId}`) }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-2.7-.6-4.5-1.9C10.7 7.3 10 6.1 10 5V3c0-.6-.4-1-1-1H8"/>
                  <path d="M3 17h2c.6 0 1-.4 1-1v-3c0-.9.7-1.7 1.5-1.9C7.3 10.6 10 10 10 10s2.7-.6 4.5-1.9C15.3 7.3 16 6.1 16 5V3c0-.6.4-1 1-1h2"/>
                </svg>
              </div>
              <span class="nav-label">Mon Véhicule</span>
              <span v-if="assignedVehicle" class="nav-badge">{{ assignedVehicle.plate }}</span>
            </RouterLink>

            <RouterLink 
              v-if="isStationManager" 
              :to="`/stations/${auth.user?.assignedStationId}`" 
              class="nav-item" 
              @click="closeMenu"
              :class="{ 'active': $route.path.includes(`/stations/${auth.user?.assignedStationId}`) }"
            >
              <div class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <span class="nav-label">Ma Station</span>
              <span v-if="assignedStation" class="nav-badge">{{ assignedStation.name }}</span>
            </RouterLink>
          </div>
        </nav>
        
        <!-- Indicateur de rôle en bas de la sidebar -->
        <div v-if="auth.user" class="sidebar-footer">
          <div class="assigned-info">
            <div v-if="isVehicleManager || isDriver" class="assigned-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-2.7-.6-4.5-1.9C10.7 7.3 10 6.1 10 5V3c0-.6-.4-1-1-1H8"/>
                <path d="M3 17h2c.6 0 1-.4 1-1v-3c0-.9.7-1.7 1.5-1.9C7.3 10.6 10 10 10 10s2.7-.6 4.5-1.9C15.3 7.3 16 6.1 16 5V3c0-.6.4-1 1-1h2"/>
              </svg>
              <span>{{ assignedVehicle?.plate || 'Non assigné' }}</span>
            </div>
            <div v-if="isStationManager" class="assigned-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>{{ assignedStation?.name || 'Non assignée' }}</span>
            </div>
          </div>
        </div>
      </aside>

      <main class="content">
        <div class="page-container">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useAuthStore } from "./stores/auth";
import api from "./services/api";

const auth = useAuthStore();
const route = useRoute();
const isMenuOpen = ref(false);
const assignedVehicle = ref(null);
const assignedStation = ref(null);

// Watch route changes to close menu on mobile
watch(() => route.path, () => {
  if (window.innerWidth < 1024) {
    isMenuOpen.value = false;
  }
});

// === COMPUTED PROPERTIES POUR LES RÔLES ===
const isSuperAdmin = computed(() => auth.user?.role === 'SUPER_ADMIN');
const isFleetManager = computed(() => auth.user?.role === 'FLEET_MANAGER');
const isStationManager = computed(() => auth.user?.role === 'STATION_MANAGER');
const isVehicleManager = computed(() => auth.user?.role === 'VEHICLE_MANAGER');
const isDriver = computed(() => auth.user?.role === 'DRIVER');
const isViewer = computed(() => auth.user?.role === 'VIEWER');

// === FONCTIONS POUR VÉRIFIER LES PERMISSIONS ===
const hasPermission = (permission) => {
  return auth.user?.permissions?.includes(permission) || false;
};

// === COMPUTED PROPERTIES POUR LES PERMISSIONS ===
const canAccessVehicles = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || isVehicleManager.value || 
         isDriver.value || isViewer.value || isStationManager.value;
});

const canEditVehicles = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || 
         (isVehicleManager.value && hasPermission('edit_vehicle'));
});

const canAccessStations = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || isStationManager.value || 
         isViewer.value;
});

const canEditStations = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || 
         (isStationManager.value && hasPermission('edit_station'));
});

const canManageFuel = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || isStationManager.value || 
         isVehicleManager.value || hasPermission('manage_fuel');
});

const canAccessMaintenance = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || isVehicleManager.value || 
         isViewer.value;
});

const canEditMaintenance = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || 
         (isVehicleManager.value && hasPermission('edit_maintenance'));
});

const canManageUsers = computed(() => {
  return isSuperAdmin.value || hasPermission('manage_users');
});

const canViewReports = computed(() => {
  return isSuperAdmin.value || isFleetManager.value || 
         hasPermission('view_reports');
});

// === FONCTIONS UTILITAIRES ===
const getRoleClass = (role) => {
  const classes = {
    'SUPER_ADMIN': 'role-super-admin',
    'FLEET_MANAGER': 'role-fleet-manager',
    'STATION_MANAGER': 'role-station-manager',
    'VEHICLE_MANAGER': 'role-vehicle-manager',
    'DRIVER': 'role-driver',
    'VIEWER': 'role-viewer'
  };
  return classes[role] || '';
};

const formatRoleLabel = (role) => {
  const labels = {
    'SUPER_ADMIN': 'Super Admin',
    'FLEET_MANAGER': 'Gestionnaire Flotte',
    'STATION_MANAGER': 'Gestionnaire Station',
    'VEHICLE_MANAGER': 'Responsable Véhicule',
    'DRIVER': 'Conducteur',
    'VIEWER': 'Observateur'
  };
  return labels[role] || role;
};

const getUserInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

const toggleMenu = () => isMenuOpen.value = !isMenuOpen.value;
const closeMenu = () => isMenuOpen.value = false;

function logout() { 
  auth.logout(); 
  location.href = "/login"; 
}

// === CHARGEMENT DES DONNÉES ASSIGNÉES ===
onMounted(async () => {
  if (auth.user?.assignedVehicleId) {
    try {
      const response = await api.get(`/vehicles/${auth.user.assignedVehicleId}`);
      assignedVehicle.value = response.data;
    } catch (error) {
      console.error('Erreur chargement véhicule assigné:', error);
    }
  }
  
  if (auth.user?.assignedStationId) {
    try {
      const response = await api.get(`/stations/${auth.user.assignedStationId}`);
      assignedStation.value = response.data;
    } catch (error) {
      console.error('Erreur chargement station assignée:', error);
    }
  }
});
</script>

<style scoped>
/* Variables pour les couleurs */
.layout {
  --primary-color: #1d4ed8;
  --primary-dark: #1e3a8a;
  --primary-light: #dbeafe;
  --sidebar-bg: linear-gradient(180deg, #0f172a 0%, #0b1f4f 55%, #0a2a78 100%);
  --sidebar-border: rgba(255, 255, 255, 0.12);
  --content-bg: radial-gradient(circle at 10% 10%, #eff6ff 0%, #dbeafe 40%, #f8fbff 100%);
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-light: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #1d4ed8;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 6px 18px -4px rgb(29 78 216 / 0.25);
  --shadow-lg: 0 18px 32px -10px rgb(29 78 216 / 0.35);
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --transition: all 0.2s ease;
  font-family: "Outfit", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

/* Layout principal */
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--content-bg);
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 98;
  display: none;
}

@media (max-width: 1023px) {
  .sidebar-overlay {
    display: block;
  }
}

/* Topbar */
.topbar {
  background: linear-gradient(90deg, #ffffff 0%, #eef4ff 100%);
  border-bottom: 1px solid #bfdbfe;
  padding: 0.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 8px 24px -16px rgb(37 99 235 / 0.5);
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.menu-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  transition: var(--transition);
}

.menu-toggle:hover {
  background: var(--primary-light);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #2563eb, #1e40af);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  box-shadow: var(--shadow-md);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.brand-subtitle {
  font-size: 0.75rem;
  color: #1d4ed8;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  border-radius: var(--radius-lg);
  transition: var(--transition);
}

.user-profile:hover {
  background: linear-gradient(90deg, #dbeafe, #eff6ff);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.user-role {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: white;
}

.user-assignments {
  display: flex;
  gap: 0.375rem;
}

.assignment-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  background: white;
  color: var(--text-secondary);
  border: 1px solid #e5e7eb;
  font-weight: 500;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
  position: relative;
  overflow: hidden;
}

.user-avatar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
}

.btn-logout {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: var(--transition);
}

.btn-logout:hover {
  background: #fee2e2;
  color: var(--danger);
}

/* Body avec sidebar et content */
.body {
  display: flex;
  flex: 1;
  min-height: calc(100vh - 64px);
}

/* Sidebar */
.sidebar {
  width: 260px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 64px;
  bottom: 0;
  left: 0;
  z-index: 99;
  transform: translateX(0);
  transition: transform 0.3s ease;
  box-shadow: 10px 0 30px -20px rgb(15 23 42 / 0.9);
}

@media (max-width: 1023px) {
  .sidebar {
    transform: translateX(-100%);
  }
  
  .layout.sidebar-open .sidebar {
    transform: translateX(0);
  }
}

.sidebar-header {
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.sidebar-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #cbd5e1;
  margin-bottom: 0.5rem;
}

.user-role-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 700;
  color: #e0e7ff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* Navigation */
.nav-menu {
  flex: 1;
  padding: 1rem 0.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-section {
  margin-bottom: 1rem;
}

.nav-section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-icon {
  opacity: 0.7;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  color: #e2e8f0;
  text-decoration: none;
  transition: var(--transition);
  position: relative;
  margin: 0 0.5rem;
}

.nav-item:hover {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.22), rgba(37, 99, 235, 0.08));
  color: #ffffff;
  transform: translateX(3px);
}

.nav-item.active {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.35), rgba(37, 99, 235, 0.15));
  color: #ffffff;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.35);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background: linear-gradient(180deg, #93c5fd, #3b82f6);
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  opacity: 0.7;
}

.nav-item.active .nav-icon,
.nav-item:hover .nav-icon {
  opacity: 1;
}

.nav-label {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
}

.nav-badge {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: rgba(147, 197, 253, 0.22);
  color: #dbeafe;
  font-weight: 600;
}

.read-only-badge {
  opacity: 0.5;
}

/* Sidebar footer */
.sidebar-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 23, 42, 0.32);
}

.assigned-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.assigned-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #bfdbfe;
  font-weight: 500;
}

/* Contenu principal */
.content {
  flex: 1;
  margin-left: 260px;
  min-height: calc(100vh - 64px);
  padding: 1.5rem;
}

@media (max-width: 1023px) {
  .content {
    margin-left: 0;
  }
}

.page-container {
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .topbar {
    padding: 0.75rem 1rem;
  }
  
  .menu-toggle {
    display: block;
  }
  
  .content {
    padding: 1rem;
  }
  
  .user-details {
    display: none;
  }
}

/* Couleurs des rôles */
.role-super-admin {
  background: linear-gradient(135deg, #1e40af, #1d4ed8);
}

.role-fleet-manager {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}

.role-station-manager {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
}

.role-vehicle-manager {
  background: linear-gradient(135deg, #3b82f6, #1e3a8a);
}

.role-driver {
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
}

.role-viewer {
  background: linear-gradient(135deg, #60a5fa, #2563eb);
}
</style>

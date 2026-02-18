// router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

// Pages
const Login = () => import("../pages/Login.vue");
const Dashboard = () => import("../pages/Dashboard.vue");
const Vehicles = () => import("../pages/Vehicles.vue");
const Stations = () => import("../pages/Stations.vue");
const Supplies = () => import("../pages/Supplies.vue");
const Dispenses = () => import("../pages/Dispenses.vue");
const Maintenance = () => import("../pages/Maintenance.vue");
const Insurance = () => import("../pages/Insurance.vue");
const Inspections = () => import("../pages/Inspections.vue");
const Reports = () => import("../pages/Reports.vue");
const Profile = () => import("../pages/Profile.vue");
const AdminUsers = () => import("../pages/AdminUsers.vue");
const Unauthorized = () => import("../pages/Unauthorized.vue");

// Routes
const routes = [
  { path: "/login", component: Login, name: "Login" },
  { path: "/", component: Dashboard, name: "Dashboard", meta: { requiresAuth: true } },
  { path: "/vehicles", component: Vehicles, name: "Vehicles", meta: { requiresAuth: true } },
  { path: "/vehicles/:id", component: Vehicles, name: "VehicleDetails", meta: { requiresAuth: true } },
  { path: "/stations", component: Stations, name: "Stations", meta: { requiresAuth: true } },
  { path: "/stations/:id", component: Stations, name: "StationDetails", meta: { requiresAuth: true } },
  { path: "/fuel/supplies", component: Supplies, name: "Supplies", meta: { requiresAuth: true } },
  { path: "/fuel/dispenses", component: Dispenses, name: "Dispenses", meta: { requiresAuth: true } },
  { path: "/maintenance", component: Maintenance, name: "Maintenance", meta: { requiresAuth: true } },
  { path: "/insurance", component: Insurance, name: "Insurance", meta: { requiresAuth: true } },
  { path: "/inspections", component: Inspections, name: "Inspections", meta: { requiresAuth: true } },
  { path: "/reports", component: Reports, name: "Reports", meta: { requiresAuth: true } },
  { path: "/profile", component: Profile, name: "Profile", meta: { requiresAuth: true } },
  { path: "/admin/users", component: AdminUsers, name: "AdminUsers", meta: { requiresAuth: true } },
  { path: "/unauthorized", component: Unauthorized, name: "Unauthorized", meta: { requiresAuth: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Guard de navigation

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.token) {
    return next({ name: 'Login' });
  }

  if (to.name === 'Login' && authStore.token) {
    return next({ name: 'Dashboard' });
  }

  next();
});


export default router;

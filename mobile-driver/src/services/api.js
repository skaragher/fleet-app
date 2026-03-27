import axios from "axios";
import { API_URL } from "../config";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const setApiToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const authApi = {
  login: (identifier, password) => api.post("/auth/login", { identifier, password }),
  me: () => api.get("/auth/me"),
};

export const companyApi = {
  settings: () => api.get("/company-settings"),
};

export const driverApi = {
  dashboard: () => api.get("/dashboard"),
  vehicles: () => api.get("/vehicles"),
  insurances: () => api.get("/insurance"),
  inspections: () => api.get("/inspections"),
  maintenances: () => api.get("/maintenance"),
  dispenses: () => api.get("/fuel/dispenses"),
};

export default api;

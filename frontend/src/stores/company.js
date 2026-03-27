import { defineStore } from "pinia";
import { computed, ref } from "vue";
import api from "../services/api";

const STORAGE_KEY = "company_settings";

const defaultSettings = {
  name: "FLEETENERGY",
  tagline: "Gestion de flotte et energie",
  logoUrl: "",
  email: "",
  phone: "",
  address: "",
  footerNote: "Tous droits reserves.",
};

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...(JSON.parse(raw) || {}) };
  } catch {
    return { ...defaultSettings };
  }
};

export const useCompanyStore = defineStore("company", () => {
  const settings = ref(readStored());

  const save = (nextValues = {}) => {
    settings.value = { ...settings.value, ...nextValues };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
  };

  const loadFromServer = async () => {
    try {
      const response = await api.get("/company-settings");
      const data = response?.data?.settings || {};
      save({ ...defaultSettings, ...data });
      return { success: true, settings: settings.value };
    } catch {
      return { success: false, settings: settings.value };
    }
  };

  const saveToServer = async (nextValues = {}) => {
    try {
      const payload = { ...settings.value, ...nextValues };
      const response = await api.put("/company-settings", payload);
      const data = response?.data?.settings || payload;
      save(data);
      return { success: true, settings: settings.value, message: response?.data?.message || "Enregistre" };
    } catch (e) {
      return { success: false, error: e?.response?.data?.message || "Erreur enregistrement" };
    }
  };

  const uploadLogo = async (logoBase64) => {
    try {
      const response = await api.post("/company-settings/logo", { logoBase64 });
      const data = response?.data?.settings || {};
      save({ ...defaultSettings, ...data });
      return { success: true, settings: settings.value, logoUrl: response?.data?.logoUrl || settings.value.logoUrl };
    } catch (e) {
      return { success: false, error: e?.response?.data?.message || "Erreur telechargement logo" };
    }
  };

  const reset = () => {
    settings.value = { ...defaultSettings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
  };

  const displayTopbar = computed(() => {
    const line2 = settings.value.tagline || settings.value.email || settings.value.phone || "";
    return {
      line1: settings.value.name || "FLEETENERGY",
      line2,
    };
  });

  const displayFooter = computed(() => {
    const contact = [settings.value.phone, settings.value.email].filter(Boolean).join(" • ");
    const address = settings.value.address || "";
    const right = settings.value.footerNote || "";
    return {
      left: [settings.value.name, contact, address].filter(Boolean).join(" • "),
      right,
    };
  });

  return {
    settings,
    save,
    loadFromServer,
    saveToServer,
    uploadLogo,
    reset,
    displayTopbar,
    displayFooter,
  };
});

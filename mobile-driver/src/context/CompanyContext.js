import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { companyApi } from "../services/api";
import { API_URL } from "../config";
import { useAuth } from "./AuthContext";

const defaultCompany = {
  name: "FLEETENERGY",
  tagline: "Gestion de flotte",
  logoUrl: "",
};

const CompanyContext = createContext(null);

const resolveLogoUrl = (logoUrl) => {
  if (!logoUrl) return "";
  if (String(logoUrl).startsWith("http")) return logoUrl;
  const base = String(API_URL).replace(/\/api\/?$/, "");
  if (String(logoUrl).startsWith("/")) return `${base}${logoUrl}`;
  return `${base}/${String(logoUrl).replace(/^\/+/, "")}`;
};

export const CompanyProvider = ({ children }) => {
  const { isAuthenticated, refreshTick } = useAuth();
  const [company, setCompany] = useState(defaultCompany);

  const loadCompany = async () => {
    try {
      const res = await companyApi.settings();
      const settings = res?.data?.settings || {};
      setCompany({
        ...defaultCompany,
        ...settings,
        logoUrl: resolveLogoUrl(settings.logoUrl || ""),
      });
    } catch {
      setCompany(defaultCompany);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadCompany();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadCompany();
  }, [refreshTick, isAuthenticated]);

  const value = useMemo(
    () => ({
      company,
      reloadCompany: loadCompany,
    }),
    [company]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
};

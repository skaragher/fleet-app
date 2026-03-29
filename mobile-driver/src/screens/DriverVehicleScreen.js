import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Card from "../components/Card";
import CompanyHeader from "../components/CompanyHeader";
import { driverApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { daysTo, formatDate } from "../utils/format";
import {
  getVidangeAlert,
  isPendingMaintenance,
  maintenanceDueLabel,
  maintenanceTypeLabel,
} from "../utils/maintenance";

const FUEL_LABELS = { DIESEL: "Diesel", SUPER: "Sans plomb", LUBRIFIANT: "Lubrifiant", HUILE: "Huile" };

// ─── Spec row helper ──────────────────────────────────────────────────────────
const SpecRow = ({ icon, label, value, color = "#64748b" }) => (
  <View style={specS.row}>
    <View style={[specS.iconBox, { backgroundColor: color + "18" }]}>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <View style={specS.text}>
      <Text style={specS.label}>{label}</Text>
      <Text style={specS.value}>{value}</Text>
    </View>
  </View>
);

const specS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  label: { fontSize: 10, color: "#94a3b8", fontWeight: "600", letterSpacing: 0.3 },
  value: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
});

// ─── Days badge ───────────────────────────────────────────────────────────────
const DaysBadge = ({ days, expiredLabel = "Expiré !", overdueLabel = "En retard !" }) => {
  if (days === null) return null;
  const expired = days < 0;
  const urgent = days >= 0 && days < 30;
  const color = expired ? "#dc2626" : urgent ? "#f59e0b" : "#16a34a";
  const bg = expired ? "#fef2f2" : urgent ? "#fffbeb" : "#f0fdf4";
  return (
    <View style={[dayS.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[dayS.days, { color }]}>{expired ? "—" : days}</Text>
      {!expired && <Text style={[dayS.unit, { color }]}>jours</Text>}
      <Text style={[dayS.status, { color }]}>{expired ? expiredLabel : days < 30 ? "Bientôt" : "Valide"}</Text>
    </View>
  );
};

const dayS = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 80,
  },
  days: { fontSize: 28, fontWeight: "900", lineHeight: 32 },
  unit: { fontSize: 11, fontWeight: "600", marginTop: -2 },
  status: { fontSize: 10, fontWeight: "700", marginTop: 2, letterSpacing: 0.3 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const DriverVehicleScreen = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user, refreshTick } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [insurances, setInsurances] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [maintenances, setMaintenances] = useState([]);

  const assignedVehicleId = String(user?.assignedVehicleId || "");

  const vehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === assignedVehicleId) || null,
    [vehicles, assignedVehicleId]
  );

  const latestInsurance = useMemo(
    () =>
      insurances
        .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId)
        .sort((a, b) => new Date(b.endAt || 0) - new Date(a.endAt || 0))[0] || null,
    [insurances, assignedVehicleId]
  );

  const latestInspection = useMemo(
    () =>
      inspections
        .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId)
        .sort(
          (a, b) =>
            new Date(b.nextInspect || b.scheduledAt || 0) -
            new Date(a.nextInspect || a.scheduledAt || 0)
        )[0] || null,
    [inspections, assignedVehicleId]
  );

  const nextMaintenance = useMemo(() => {
    const list = maintenances
      .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === assignedVehicleId)
      .filter(isPendingMaintenance);
    if (!list.length) return null;
    return list
      .slice()
      .sort((a, b) => {
        const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return Number(a.odometerKm || Number.MAX_SAFE_INTEGER) - Number(b.odometerKm || Number.MAX_SAFE_INTEGER);
      })[0];
  }, [maintenances, assignedVehicleId]);

  const maintenanceAlert = useMemo(
    () => getVidangeAlert(nextMaintenance, Number(vehicle?.odometerKm || 0)),
    [nextMaintenance, vehicle]
  );

  const load = async () => {
    setRefreshing(true);
    try {
      const [v, i, insp, m] = await Promise.all([
        driverApi.vehicles(),
        driverApi.insurances(),
        driverApi.inspections(),
        driverApi.maintenances(),
      ]);
      setVehicles(v.data || []);
      setInsurances(i.data || []);
      setInspections(insp.data || []);
      setMaintenances(m.data || []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshTick]);

  const insuranceDays = latestInsurance ? daysTo(latestInsurance.endAt) : null;
  const inspectionDays = latestInspection
    ? daysTo(latestInspection.nextInspect || latestInspection.scheduledAt)
    : null;
  const isDanger = maintenanceAlert?.level === "danger";
  const isWarning = maintenanceAlert?.level === "warning";

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#1d4ed8" />}>
      <CompanyHeader subtitle="Fiche de mon véhicule" />

      {/* ── Vehicle identity hero ─────────────────────────────────────── */}
      <LinearGradient
        colors={vehicle ? ["#0f172a", "#1e3a8a"] : ["#475569", "#64748b"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroInner}>
          <View style={styles.plateContainer}>
            <Text style={styles.plateLabel}>PLAQUE</Text>
            <Text style={styles.plateNumber}>{vehicle?.plate || "—"}</Text>
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroMakeModel}>
              {[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Modèle non renseigné"}
            </Text>
            <View style={styles.heroBadges}>
              {vehicle?.fuelType ? (
                <View style={styles.heroBadge}>
                  <Ionicons name="flash-outline" size={11} color="#bfdbfe" />
                  <Text style={styles.heroBadgeText}>{FUEL_LABELS[vehicle.fuelType] || vehicle.fuelType}</Text>
                </View>
              ) : null}
              {vehicle?.status ? (
                <View style={[styles.heroBadge, styles.heroBadgeGreen]}>
                  <Ionicons name="ellipse" size={7} color="#86efac" />
                  <Text style={styles.heroBadgeText}>{String(vehicle.status).replaceAll("_", " ")}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.heroCarIcon}>
          <Ionicons name="car-sport" size={42} color="rgba(255,255,255,0.15)" />
        </View>
      </LinearGradient>

      {/* ── Specs grid ───────────────────────────────────────────────── */}
      <Card title="Caractéristiques" icon="information-circle-outline" iconColor="#1d4ed8" iconBg="#eff6ff">
        <View style={[styles.specsGrid, isTablet && styles.specsGridTablet]}>
          <SpecRow icon="speedometer-outline" label="KILOMÉTRAGE" value={`${Number(vehicle?.odometerKm || 0).toLocaleString()} km`} color="#1d4ed8" />
          <SpecRow icon="flash-outline" label="CARBURANT" value={FUEL_LABELS[vehicle?.fuelType] || vehicle?.fuelType || "—"} color="#f59e0b" />
          <SpecRow icon="car-outline" label="MARQUE / MODÈLE" value={[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "—"} color="#4f46e5" />
          <SpecRow icon="document-text-outline" label="CHÂSSIS" value={vehicle?.chassisNumber || "—"} color="#0891b2" />
        </View>
      </Card>

      {/* ── Documents row ────────────────────────────────────────────── */}
      <View style={[styles.docsRow, isTablet && styles.docsRowTablet]}>
        {/* Insurance */}
        <Card
          title="Assurance"
          icon="shield-checkmark-outline"
          iconColor={insuranceDays !== null && insuranceDays < 15 ? "#dc2626" : "#16a34a"}
          iconBg={insuranceDays !== null && insuranceDays < 15 ? "#fef2f2" : "#f0fdf4"}
          accent={insuranceDays !== null && insuranceDays < 15 ? "#ef4444" : undefined}
        >
          {latestInsurance ? (
            <View style={styles.docContent}>
              <DaysBadge days={insuranceDays} expiredLabel="Expirée !" />
              <View style={styles.docDetails}>
                <Text style={styles.docLine}>
                  <Text style={styles.docKey}>Fin : </Text>
                  {formatDate(latestInsurance.endAt)}
                </Text>
                {latestInsurance.insurancesType ? (
                  <Text style={styles.docLine}>
                    <Text style={styles.docKey}>Type : </Text>
                    {latestInsurance.insurancesType}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.noDocRow}>
              <Ionicons name="close-circle-outline" size={16} color="#94a3b8" />
              <Text style={styles.noDoc}>Aucune assurance</Text>
            </View>
          )}
        </Card>

        {/* Inspection */}
        <Card
          title="Visite technique"
          icon="clipboard-outline"
          iconColor={inspectionDays !== null && inspectionDays < 0 ? "#dc2626" : "#4f46e5"}
          iconBg={inspectionDays !== null && inspectionDays < 0 ? "#fef2f2" : "#eef2ff"}
          accent={inspectionDays !== null && inspectionDays < 0 ? "#ef4444" : undefined}
        >
          {latestInspection ? (
            <View style={styles.docContent}>
              <DaysBadge days={inspectionDays} overdueLabel="En retard !" />
              <View style={styles.docDetails}>
                <Text style={styles.docLine}>
                  <Text style={styles.docKey}>Prochaine : </Text>
                  {formatDate(latestInspection.nextInspect || latestInspection.scheduledAt)}
                </Text>
                {latestInspection.center ? (
                  <Text style={styles.docLine}>
                    <Text style={styles.docKey}>Centre : </Text>
                    {latestInspection.center}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.noDocRow}>
              <Ionicons name="close-circle-outline" size={16} color="#94a3b8" />
              <Text style={styles.noDoc}>Aucune visite</Text>
            </View>
          )}
        </Card>
      </View>

      {/* ── Maintenance ──────────────────────────────────────────────── */}
      <Card
        title="Maintenance à venir"
        icon="construct-outline"
        iconColor="#7c3aed"
        iconBg="#f3e8ff"
        accent={isDanger ? "#ef4444" : isWarning ? "#f59e0b" : undefined}
      >
        <Text style={styles.odomLine}>
          Kilométrage actuel : {Number(vehicle?.odometerKm || 0).toLocaleString()} km
        </Text>
        {nextMaintenance ? (
          <View style={[styles.maintBox, isDanger ? styles.maintBoxDanger : isWarning ? styles.maintBoxWarning : styles.maintBoxNormal]}>
            <View style={styles.maintTop}>
              <Text style={styles.maintType}>{maintenanceTypeLabel(nextMaintenance.maintenanceType)}</Text>
              {maintenanceAlert ? (
                <Text style={[styles.alertPill, isDanger ? styles.alertDanger : styles.alertWarning]}>
                  {maintenanceAlert.text}
                </Text>
              ) : null}
            </View>
            <Text style={styles.maintDesc}>{nextMaintenance.description || "Entretien planifié"}</Text>
            <Text style={styles.maintDue}>{maintenanceDueLabel(nextMaintenance, formatDate)}</Text>
            {typeof nextMaintenance.odometerKm === "number" && (
              <Text style={styles.maintDue}>
                Kilométrage : {Number(nextMaintenance.odometerKm).toLocaleString()} km
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.noMaintRow}>
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text style={styles.noMaint}>Aucune maintenance planifiée</Text>
          </View>
        )}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  // Hero
  hero: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    overflow: "hidden",
  },
  heroInner: { flex: 1, gap: 10 },
  plateContainer: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignSelf: "flex-start",
  },
  plateLabel: { fontSize: 9, color: "#93c5fd", fontWeight: "700", letterSpacing: 1.5 },
  plateNumber: { fontSize: 30, fontWeight: "900", color: "#ffffff", letterSpacing: 2, marginTop: 2 },
  heroMeta: { gap: 6 },
  heroMakeModel: { fontSize: 14, color: "#dbeafe", fontWeight: "600" },
  heroBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroBadgeGreen: { backgroundColor: "rgba(134,239,172,0.15)" },
  heroBadgeText: { color: "#dbeafe", fontSize: 11, fontWeight: "700" },
  heroCarIcon: { position: "absolute", right: 10, top: 10 },

  // Specs
  specsGrid: { gap: 10 },
  specsGridTablet: { flexDirection: "row", flexWrap: "wrap" },

  // Documents
  docsRow: { gap: 10 },
  docsRowTablet: { flexDirection: "row" },
  docContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  docDetails: { flex: 1, gap: 3 },
  docLine: { fontSize: 12, color: "#475569" },
  docKey: { fontWeight: "700", color: "#1e3a8a" },
  noDocRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  noDoc: { fontSize: 13, color: "#94a3b8" },

  // Maintenance
  odomLine: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  maintBox: { borderRadius: 10, padding: 10, gap: 4 },
  maintBoxNormal: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  maintBoxWarning: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#f59e0b" },
  maintBoxDanger: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#ef4444" },
  maintTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  maintType: { fontSize: 14, fontWeight: "800", color: "#0f172a", flex: 1 },
  maintDesc: { fontSize: 12, color: "#64748b" },
  maintDue: { fontSize: 12, color: "#334155", fontWeight: "600" },
  alertPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
  },
  alertWarning: { color: "#b45309", borderColor: "#f59e0b", backgroundColor: "#fef9c3" },
  alertDanger: { color: "#b91c1c", borderColor: "#ef4444", backgroundColor: "#fee2e2" },
  noMaintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  noMaint: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
});

export default DriverVehicleScreen;

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

// ─── Stat Tile ────────────────────────────────────────────────────────────────
const StatTile = ({ label, value, sub, icon, iconColor, accentColor }) => (
  <View style={tileS.tile}>
    <View style={[tileS.iconBox, { backgroundColor: iconColor + "22" }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={tileS.value} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={tileS.label}>{label}</Text>
    {sub ? <Text style={[tileS.sub, accentColor && { color: accentColor }]}>{sub}</Text> : null}
  </View>
);

const tileS = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    gap: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  sub: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const DriverDashboardScreen = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user, refreshTick } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dispensesFallback, setDispensesFallback] = useState([]);
  const [maintenancesDirect, setMaintenancesDirect] = useState([]);

  const assignedVehicleId = String(user?.assignedVehicleId || "");
  const fleet = dashboard?.fleet || [];
  const insurances = dashboard?.insurances || [];
  const inspections = dashboard?.inspections || [];
  const maintenances = maintenancesDirect.length ? maintenancesDirect : (dashboard?.maintenances || []);
  const dispenses = dashboard?.dispenses || [];
  const tanks = dashboard?.tanks || [];

  const vehicle = useMemo(
    () => fleet.find((v) => String(v.id) === assignedVehicleId) || null,
    [fleet, assignedVehicleId]
  );
  const avgConsumption = Number(vehicle?.avgConsumption || 0);

  const consumptionState = useMemo(() => {
    if (avgConsumption <= 0) return { label: "Non disponible", color: "#64748b" };
    if (avgConsumption < 8) return { label: "Bas", color: "#16a34a" };
    if (avgConsumption <= 12) return { label: "Normal", color: "#1d4ed8" };
    return { label: "Élevé", color: "#dc2626" };
  }, [avgConsumption]);

  const latestInsurance = useMemo(
    () =>
      insurances
        .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId)
        .sort((a, b) => new Date(b.endAt || b.createdAt || 0) - new Date(a.endAt || a.createdAt || 0))[0] || null,
    [insurances, assignedVehicleId]
  );

  const latestInspection = useMemo(
    () =>
      inspections
        .filter((i) => String(i.vehicleId || i.vehicle?.id || "") === assignedVehicleId)
        .sort(
          (a, b) =>
            new Date(b.nextInspect || b.scheduledAt || b.createdAt || 0) -
            new Date(a.nextInspect || a.scheduledAt || a.createdAt || 0)
        )[0] || null,
    [inspections, assignedVehicleId]
  );

  const getDispenseDateValue = (d) => d?.dispensedAt || d?.date || d?.createdAt || null;
  const getDispenseTimestamp = (d) => {
    const value = getDispenseDateValue(d);
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const normalizedHistoryDispenses = useMemo(
    () =>
      (vehicle?.history || []).map((h) => ({
        id: h.id || `${h.date || "history"}-${h.liters || 0}`,
        liters: h.liters || 0,
        dispensedAt: h.date || null,
        date: h.date || null,
        station: h.station ? { name: h.station } : null,
        tankId: null,
      })),
    [vehicle]
  );

  const dispenseCandidates = useMemo(() => {
    const base = dispenses.length ? dispenses : dispensesFallback;
    const withVehicleFilter = base.filter(
      (d) => String(d.vehicleId || d.vehicle?.id || "") === assignedVehicleId
    );
    if (withVehicleFilter.length > 0) return withVehicleFilter;
    return normalizedHistoryDispenses;
  }, [dispenses, dispensesFallback, assignedVehicleId, normalizedHistoryDispenses]);

  const lastDispense = useMemo(
    () =>
      dispenseCandidates
        .slice()
        .sort((a, b) => getDispenseTimestamp(b) - getDispenseTimestamp(a))[0] || null,
    [dispenseCandidates]
  );

  const latestDispenseWithOdometer = useMemo(() => {
    return (
      dispensesFallback
        .filter((d) => String(d.vehicleId || d.vehicle?.id || "") === assignedVehicleId)
        .filter((d) => Number(d.odometerKm || 0) > 0)
        .sort((a, b) => {
          const aTs = new Date(getDispenseDateValue(a) || 0).getTime();
          const bTs = new Date(getDispenseDateValue(b) || 0).getTime();
          return bTs - aTs;
        })[0] || null
    );
  }, [dispensesFallback, assignedVehicleId]);

  const currentVehicleOdometer = useMemo(() => {
    if (latestDispenseWithOdometer?.odometerKm) return Number(latestDispenseWithOdometer.odometerKm);
    if (lastDispense?.odometerKm) return Number(lastDispense.odometerKm);
    return Number(vehicle?.odometerKm || 0);
  }, [latestDispenseWithOdometer, lastDispense, vehicle]);

  const maintenanceList = useMemo(() => {
    return maintenances
      .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === assignedVehicleId)
      .filter(isPendingMaintenance)
      .slice()
      .sort((a, b) => {
        const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return Number(a.odometerKm || Number.MAX_SAFE_INTEGER) - Number(b.odometerKm || Number.MAX_SAFE_INTEGER);
      });
  }, [maintenances, assignedVehicleId]);

  const getDispenseStationName = (dispense) => {
    if (!dispense) return "Non renseignée";
    if (dispense.station?.name) return dispense.station.name;
    if (dispense.tank?.station?.name) return dispense.tank.station.name;
    const tankId = String(dispense.tankId || dispense.tank?.id || "");
    if (!tankId) return "Non renseignée";
    const tank = tanks.find((t) => String(t.id) === tankId);
    return tank?.station?.name || "Non renseignée";
  };

  const load = async () => {
    setRefreshing(true);
    try {
      const [dashRes, dispensesRes, maintRes] = await Promise.all([
        driverApi.dashboard(),
        driverApi.dispenses(),
        driverApi.maintenances(),
      ]);
      setDashboard(dashRes.data || {});
      setDispensesFallback(dispensesRes.data || []);
      setMaintenancesDirect(maintRes.data || []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshTick]);

  // Computed values for stat tiles
  const insuranceDays = latestInsurance ? daysTo(latestInsurance.endAt) : null;
  const inspectionDays = latestInspection
    ? daysTo(latestInspection.nextInspect || latestInspection.scheduledAt)
    : null;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#1d4ed8" />}>
      <CompanyHeader subtitle="Tableau de bord chauffeur" />

      {/* ── Vehicle Hero ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#1e3a8a", "#2563eb", "#38bdf8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.vehicleHero}
      >
        <View style={styles.heroLeft}>
          <Text style={styles.heroLabel}>MON VÉHICULE</Text>
          <Text style={styles.heroPlateBg}>{vehicle?.plate || "Non assigné"}</Text>
          <Text style={styles.heroModel}>
            {[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Aucun modèle renseigné"}
          </Text>
          {vehicle?.status ? (
            <View style={styles.heroStatusBadge}>
              <Text style={styles.heroStatusText}>{String(vehicle.status).replaceAll("_", " ")}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.heroRight}>
          <View style={styles.heroIconCircle}>
            <Ionicons name="car-sport" size={36} color="#ffffff" />
          </View>
          <Text style={styles.heroOdometer}>
            {Number(currentVehicleOdometer || 0).toLocaleString()} km
          </Text>
        </View>
      </LinearGradient>

      {/* ── Stat tiles (2 × 2) ───────────────────────────────────────── */}
      <View style={[styles.tilesGrid, isTablet && styles.tilesGridTablet]}>
        <StatTile
          label="Conso moyenne"
          value={avgConsumption > 0 ? `${avgConsumption.toFixed(1)}` : "—"}
          sub={avgConsumption > 0 ? `L/100km · ${consumptionState.label}` : "Non disponible"}
          icon="speedometer-outline"
          iconColor={consumptionState.color}
          accentColor={consumptionState.color}
        />
        <StatTile
          label="Assurance"
          value={insuranceDays !== null ? `${Math.max(0, insuranceDays)}j` : "—"}
          sub={
            insuranceDays === null
              ? "Aucune"
              : insuranceDays < 0
              ? "Expirée !"
              : insuranceDays < 30
              ? "Renouveler bientôt"
              : "restants"
          }
          icon="shield-checkmark-outline"
          iconColor={insuranceDays === null ? "#64748b" : insuranceDays < 15 ? "#dc2626" : insuranceDays < 30 ? "#f59e0b" : "#16a34a"}
          accentColor={insuranceDays === null ? "#64748b" : insuranceDays < 15 ? "#dc2626" : insuranceDays < 30 ? "#f59e0b" : "#16a34a"}
        />
        <StatTile
          label="Visite technique"
          value={inspectionDays !== null ? `${Math.max(0, inspectionDays)}j` : "—"}
          sub={
            inspectionDays === null
              ? "Aucune"
              : inspectionDays < 0
              ? "En retard !"
              : "Prochaine"
          }
          icon="clipboard-outline"
          iconColor={inspectionDays === null ? "#64748b" : inspectionDays < 0 ? "#dc2626" : "#4f46e5"}
          accentColor={inspectionDays === null ? "#64748b" : inspectionDays < 0 ? "#dc2626" : "#4f46e5"}
        />
        <StatTile
          label="Maintenances"
          value={maintenanceList.length > 0 ? `${maintenanceList.length}` : "0"}
          sub={maintenanceList.length > 0 ? "en attente" : "Rien à signaler"}
          icon="build-outline"
          iconColor={maintenanceList.length > 0 ? "#7c3aed" : "#16a34a"}
          accentColor={maintenanceList.length > 0 ? "#7c3aed" : "#16a34a"}
        />
      </View>

      {/* ── Last dispense ────────────────────────────────────────────── */}
      <Card title="Dernier ravitaillement" icon="water-outline" iconColor="#0891b2" iconBg="#e0f2fe">
        {lastDispense ? (
          <View style={styles.dispenseBody}>
            <View style={styles.dispenseLeft}>
              <Text style={styles.dispenseLiters}>{Number(lastDispense.liters || 0).toLocaleString()}</Text>
              <Text style={styles.dispenseLitersUnit}>litres</Text>
            </View>
            <View style={styles.dispenseRight}>
              <View style={styles.dispenseInfoRow}>
                <Ionicons name="time-outline" size={13} color="#64748b" />
                <Text style={styles.dispenseInfo}>
                  {formatDate(getDispenseDateValue(lastDispense))} —{" "}
                  {new Date(getDispenseDateValue(lastDispense)).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <View style={styles.dispenseInfoRow}>
                <Ionicons name="location-outline" size={13} color="#64748b" />
                <Text style={styles.dispenseInfo}>{getDispenseStationName(lastDispense)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>Aucun ravitaillement enregistré</Text>
        )}
      </Card>

      {/* ── Maintenance list ─────────────────────────────────────────── */}
      <Card title="Maintenance" icon="construct-outline" iconColor="#7c3aed" iconBg="#f3e8ff">
        <Text style={styles.odometerLine}>
          Kilométrage actuel : {Number(currentVehicleOdometer || 0).toLocaleString()} km
        </Text>
        {maintenanceList.length > 0 ? (
          maintenanceList.map((item) => {
            const alert = getVidangeAlert(item, currentVehicleOdometer);
            const isDanger = alert?.level === "danger";
            const isWarning = alert?.level === "warning";
            return (
              <View
                key={item.id}
                style={[
                  styles.maintItem,
                  isDanger ? styles.maintDanger : isWarning ? styles.maintWarning : styles.maintNormal,
                ]}
              >
                <View style={styles.maintHeader}>
                  <Ionicons
                    name={isDanger ? "alert-circle" : isWarning ? "warning" : "checkmark-circle-outline"}
                    size={15}
                    color={isDanger ? "#dc2626" : isWarning ? "#b45309" : "#16a34a"}
                  />
                  <Text style={styles.maintType}>{maintenanceTypeLabel(item.maintenanceType)}</Text>
                  {alert ? (
                    <Text style={[styles.alertPill, isDanger ? styles.alertPillDanger : styles.alertPillWarning]}>
                      {alert.text}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.maintDesc}>{item.description || "Entretien planifié"}</Text>
                <Text style={styles.maintDue}>{maintenanceDueLabel(item, formatDate)}</Text>
              </View>
            );
          })
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
  // Vehicle hero
  vehicleHero: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  heroLeft: { flex: 1, gap: 4 },
  heroLabel: { fontSize: 10, fontWeight: "700", color: "#bfdbfe", letterSpacing: 1.2 },
  heroPlateBg: { fontSize: 28, fontWeight: "900", color: "#ffffff", letterSpacing: 1 },
  heroModel: { fontSize: 13, color: "#dbeafe", fontWeight: "500" },
  heroStatusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  heroStatusText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  heroRight: { alignItems: "center", gap: 6 },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  heroOdometer: { fontSize: 12, color: "#bfdbfe", fontWeight: "700" },

  // Tiles
  tilesGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  tilesGridTablet: { gap: 14 },

  // Dispense card
  dispenseBody: { flexDirection: "row", alignItems: "center", gap: 14 },
  dispenseLeft: { alignItems: "center", minWidth: 70 },
  dispenseLiters: { fontSize: 36, fontWeight: "900", color: "#0891b2", lineHeight: 40 },
  dispenseLitersUnit: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  dispenseRight: { flex: 1, gap: 6 },
  dispenseInfoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dispenseInfo: { fontSize: 13, color: "#334155", fontWeight: "500", flex: 1 },

  // Odometer line
  odometerLine: { fontSize: 12, color: "#64748b", fontWeight: "600" },

  // Maintenance items
  maintItem: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  maintNormal: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  maintWarning: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#f59e0b" },
  maintDanger: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#ef4444" },
  maintHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  maintType: { fontSize: 14, fontWeight: "800", color: "#0f172a", flex: 1 },
  maintDesc: { fontSize: 12, color: "#64748b", marginLeft: 21 },
  maintDue: { fontSize: 12, color: "#334155", fontWeight: "600", marginLeft: 21 },
  alertPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
  },
  alertPillWarning: { color: "#b45309", borderColor: "#f59e0b", backgroundColor: "#fef9c3" },
  alertPillDanger: { color: "#b91c1c", borderColor: "#ef4444", backgroundColor: "#fee2e2" },
  noMaintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  noMaint: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  empty: { fontSize: 13, color: "#94a3b8" },
});

export default DriverDashboardScreen;

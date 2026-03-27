import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
    const list = maintenances
      .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === assignedVehicleId)
      .filter(isPendingMaintenance)
      .slice()
      .sort((a, b) => {
        const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return Number(a.odometerKm || Number.MAX_SAFE_INTEGER) - Number(b.odometerKm || Number.MAX_SAFE_INTEGER);
      });
    return list;
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

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <CompanyHeader subtitle="Tableau de bord chauffeur" />
      <Text style={styles.title}>Dashboard chauffeur</Text>

      <View style={[styles.grid, isTablet && styles.gridTablet]}>
        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Mon véhicule">
            <Text style={styles.value}>{vehicle?.plate || "Non assigné"}</Text>
            <Text style={styles.muted}>{vehicle?.model || "Aucun modèle"}</Text>
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Consommation (L/100km)">
            <Text style={styles.value}>{avgConsumption > 0 ? `${avgConsumption.toFixed(1)} L/100km` : "-"}</Text>
            <Text style={[styles.badge, { color: consumptionState.color, borderColor: consumptionState.color }]}>
              {consumptionState.label}
            </Text>
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Assurance">
            {latestInsurance ? (
              <>
                <Text style={styles.value}>Expire le {formatDate(latestInsurance.endAt)}</Text>
                <Text style={styles.muted}>
                  {daysTo(latestInsurance.endAt) < 0
                    ? `Expirée depuis ${Math.abs(daysTo(latestInsurance.endAt))} jour(s)`
                    : `${daysTo(latestInsurance.endAt)} jour(s) restants`}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Aucune assurance trouvée</Text>
            )}
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Visite technique">
            {latestInspection ? (
              <>
                <Text style={styles.value}>
                  {formatDate(latestInspection.nextInspect || latestInspection.scheduledAt)}
                </Text>
                <Text style={styles.muted}>
                  {daysTo(latestInspection.nextInspect || latestInspection.scheduledAt) < 0
                    ? "Visite en retard"
                    : "Prochaine échéance"}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Aucune visite trouvée</Text>
            )}
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Maintenance">
            <Text style={styles.muted}>
              Kilometrage actuel: {Number(currentVehicleOdometer || 0).toLocaleString()} km
            </Text>
            {maintenanceList.length > 0 ? (
              maintenanceList.map((item) => {
                const maintenanceAlert = getVidangeAlert(item, currentVehicleOdometer);
                return (
                  <View key={item.id} style={styles.maintenanceRow}>
                    <Text style={styles.maintenanceTypeText}>{maintenanceTypeLabel(item.maintenanceType)}</Text>
                    <Text style={styles.muted}>{item.description || "Entretien planifie"}</Text>
                    <Text style={styles.emphasis}>{maintenanceDueLabel(item, formatDate)}</Text>
                    {typeof item.odometerKm === "number" ? (
                      <Text style={styles.emphasis}>
                        Kilometrage entretien: {Number(item.odometerKm).toLocaleString()} km
                      </Text>
                    ) : null}
                    {maintenanceAlert ? (
                      <Text
                        style={[
                          styles.alertBadge,
                          maintenanceAlert.level === "danger" ? styles.alertDanger : styles.alertWarning,
                        ]}
                      >
                        {maintenanceAlert.text}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <>
                <Text style={styles.muted}>Type: -</Text>
                <Text style={styles.muted}>Kilometrage entretien: -</Text>
                <Text style={styles.muted}>Aucune maintenance planifiée</Text>
              </>
            )}
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemFullTablet]}>
          <Card title="Dernier ravitaillement">
            {lastDispense ? (
              <>
                <Text style={styles.value}>{Number(lastDispense.liters || 0).toLocaleString()} L</Text>
                <Text style={styles.emphasis}>
                  {formatDate(getDispenseDateValue(lastDispense))} à{" "}
                  {new Date(getDispenseDateValue(lastDispense)).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={styles.muted}>
                  Station: {getDispenseStationName(lastDispense)}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Aucun ravitaillement</Text>
            )}
          </Card>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1d4ed8",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  muted: {
    fontSize: 13,
    color: "#64748b",
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  grid: {
    gap: 12,
  },
  gridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  gridItem: {
    width: "100%",
  },
  gridItemTablet: {
    flexBasis: "48.8%",
  },
  gridItemFullTablet: {
    flexBasis: "100%",
  },
  maintenanceRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    marginTop: 8,
  },
  alertBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  alertWarning: {
    color: "#b45309",
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
  },
  alertDanger: {
    color: "#b91c1c",
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  maintenanceTypeText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000000",
  },
  emphasis: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "700",
  },
});

export default DriverDashboardScreen;



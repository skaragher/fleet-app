import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import CompanyHeader from "../components/CompanyHeader";
import { useAuth } from "../context/AuthContext";
import { driverApi } from "../services/api";
import { daysTo, formatCurrency, formatDate } from "../utils/format";
import {
  getVidangeAlert,
  isPendingMaintenance,
  maintenanceDueLabel,
  maintenanceTypeLabel,
} from "../utils/maintenance";

const DriverReportsScreen = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user, refreshTick } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [dispenses, setDispenses] = useState([]);
  const [insurances, setInsurances] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [period, setPeriod] = useState("DAY");

  const assignedVehicleId = String(user?.assignedVehicleId || "");

  const isInPeriod = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (period === "DAY") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    if (period === "MONTH") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === "YEAR") {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const vehicleDispenses = useMemo(
    () =>
      dispenses
        .filter((d) => String(d.vehicleId || d.vehicle?.id || "") === assignedVehicleId)
        .filter((d) => isInPeriod(d.dispensedAt))
        .sort((a, b) => new Date(b.dispensedAt || 0) - new Date(a.dispensedAt || 0)),
    [dispenses, assignedVehicleId, period]
  );

  const totalLiters = useMemo(
    () => vehicleDispenses.reduce((sum, d) => sum + Number(d.liters || 0), 0),
    [vehicleDispenses]
  );

  const totalAmount = useMemo(
    () =>
      vehicleDispenses.reduce(
        (sum, d) => sum + Number(d.liters || 0) * Number(d.unitPrice || 0),
        0
      ),
    [vehicleDispenses]
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

  const maintenanceList = useMemo(() => {
    const list = maintenances
      .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === assignedVehicleId)
      .filter(isPendingMaintenance);
    return list
      .slice()
      .sort((a, b) => {
        const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return Number(a.odometerKm || Number.MAX_SAFE_INTEGER) - Number(b.odometerKm || Number.MAX_SAFE_INTEGER);
      });
  }, [maintenances, assignedVehicleId]);

  const getDispenseStationName = (d) =>
    d?.station?.name || d?.tank?.station?.name || "Non renseignée";

  const load = async () => {
    setRefreshing(true);
    try {
      const [d, i, insp, m] = await Promise.all([
        driverApi.dispenses(),
        driverApi.insurances(),
        driverApi.inspections(),
        driverApi.maintenances(),
      ]);
      setDispenses(d.data || []);
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

  const avgConsumption = useMemo(() => {
    const values = vehicleDispenses
      .map((d) => Number(d.vehicle?.avgConsumption || d.avgConsumption || 0))
      .filter((v) => v > 0);
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }, [vehicleDispenses]);

  const consumptionState = useMemo(() => {
    if (avgConsumption <= 0 || Number.isNaN(avgConsumption)) return { label: "Non disponible", color: "#64748b" };
    if (avgConsumption < 8) return { label: "Bas", color: "#16a34a" };
    if (avgConsumption <= 12) return { label: "Normal", color: "#1d4ed8" };
    return { label: "Élevé", color: "#dc2626" };
  }, [avgConsumption]);
  const currentVehicleOdometer = useMemo(() => {
    const latest = vehicleDispenses[0];
    if (latest?.odometerKm) return Number(latest.odometerKm);
    return Number(user?.assignedVehicle?.odometerKm || 0);
  }, [vehicleDispenses, user]);
  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <CompanyHeader subtitle="Rapports du chauffeur" />
      <Text style={styles.title}>Rapports chauffeur</Text>

      <View style={[styles.periodSwitch, isTablet && styles.periodSwitchTablet]}>
        <TouchableOpacity
          style={[styles.periodBtn, period === "DAY" && styles.periodBtnActive]}
          onPress={() => setPeriod("DAY")}
        >
          <Text style={[styles.periodText, period === "DAY" && styles.periodTextActive]}>Jour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === "MONTH" && styles.periodBtnActive]}
          onPress={() => setPeriod("MONTH")}
        >
          <Text style={[styles.periodText, period === "MONTH" && styles.periodTextActive]}>Mois</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === "YEAR" && styles.periodBtnActive]}
          onPress={() => setPeriod("YEAR")}
        >
          <Text style={[styles.periodText, period === "YEAR" && styles.periodTextActive]}>Année</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.grid, isTablet && styles.gridTablet]}>
        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Synthèse">
            <Text style={styles.line}>Ravitaillements: {vehicleDispenses.length}</Text>
            <Text style={styles.line}>Volume total: {totalLiters.toLocaleString()} L</Text>
            <Text style={styles.emphasis}>Montant total: {formatCurrency(totalAmount)}</Text>
            <Text style={styles.line}>
              Conso moyenne: {avgConsumption > 0 ? `${avgConsumption.toFixed(1)} L/100km` : "-"}
            </Text>
            <Text style={[styles.badge, { color: consumptionState.color, borderColor: consumptionState.color }]}>
              {consumptionState.label}
            </Text>
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Assurance">
            {latestInsurance ? (
              <Text style={styles.emphasis}>
                Fin: {formatDate(latestInsurance.endAt)} ({daysTo(latestInsurance.endAt)}j)
              </Text>
            ) : (
              <Text style={styles.muted}>Aucune assurance</Text>
            )}
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Visite technique">
            {latestInspection ? (
              <Text style={styles.emphasis}>
                Prochaine: {formatDate(latestInspection.nextInspect || latestInspection.scheduledAt)}
              </Text>
            ) : (
              <Text style={styles.muted}>Aucune visite</Text>
            )}
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Maintenance">
            <Text style={styles.line}>
              Kilometrage actuel: {Number(currentVehicleOdometer || 0).toLocaleString()} km
            </Text>
            {maintenanceList.length > 0 ? (
              maintenanceList.map((item) => {
                const maintenanceAlert = getVidangeAlert(item, currentVehicleOdometer);
                return (
                  <View key={item.id} style={styles.maintenanceRow}>
                    <Text style={styles.maintenanceTypeText}>Type: {maintenanceTypeLabel(item.maintenanceType)}</Text>
                    <Text style={styles.line}>Detail: {item.description || "Entretien planifie"}</Text>
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
                <Text style={styles.line}>Type: -</Text>
                <Text style={styles.line}>Kilometrage entretien: -</Text>
                <Text style={styles.muted}>Aucune maintenance planifiée</Text>
              </>
            )}
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemFullTablet]}>
          <Card title="10 derniers ravitaillements">
            {vehicleDispenses.slice(0, 10).map((d) => (
              <View key={d.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.emphasis}>
                    {formatDate(d.dispensedAt)} à{" "}
                    {new Date(d.dispensedAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text style={styles.stationText}>Station: {getDispenseStationName(d)}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.line}>{Number(d.liters || 0).toLocaleString()} L</Text>
                  <Text style={styles.emphasis}>{formatCurrency(Number(d.liters || 0) * Number(d.unitPrice || 0))}</Text>
                </View>
              </View>
            ))}
            {vehicleDispenses.length === 0 && <Text style={styles.muted}>Aucun ravitaillement</Text>}
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
  line: {
    fontSize: 14,
    color: "#334155",
  },
  muted: {
    fontSize: 13,
    color: "#64748b",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    marginTop: 8,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  stationText: {
    fontSize: 12,
    color: "#64748b",
  },
  periodSwitch: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#dbeafe",
    borderRadius: 10,
    padding: 4,
  },
  periodSwitchTablet: {
    alignSelf: "flex-start",
    minWidth: 420,
  },
  periodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: "#1d4ed8",
  },
  periodText: {
    color: "#1e3a8a",
    fontWeight: "700",
    fontSize: 12,
  },
  periodTextActive: {
    color: "#ffffff",
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
    fontSize: 15,
    fontWeight: "900",
    color: "#000000",
  },
  emphasis: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "700",
  },
});

export default DriverReportsScreen;



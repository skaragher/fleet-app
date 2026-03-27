import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import CompanyHeader from "../components/CompanyHeader";
import { driverApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../utils/format";
import {
  getVidangeAlert,
  isPendingMaintenance,
  maintenanceDueLabel,
  maintenanceTypeLabel,
} from "../utils/maintenance";

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

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <CompanyHeader subtitle="Fiche de mon véhicule" />
      <Text style={styles.title}>Mon véhicule</Text>
      <View style={[styles.grid, isTablet && styles.gridTablet]}>
        <View style={[styles.gridItem, isTablet && styles.gridItemFullTablet]}>
          <Card>
            <Text style={styles.value}>{vehicle?.plate || "Non assigné"}</Text>
            <Text style={styles.line}>Modèle: {vehicle?.make || "-"} {vehicle?.model || "-"}</Text>
            <Text style={styles.line}>Carburant: {vehicle?.fuelType || "-"}</Text>
            <Text style={styles.line}>Kilométrage: {Number(vehicle?.odometerKm || 0).toLocaleString()} km</Text>
            <Text style={styles.line}>Statut: {String(vehicle?.status || "-").replaceAll("_", " ")}</Text>
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Assurance">
            <Text style={styles.emphasis}>
              {latestInsurance ? `Fin: ${formatDate(latestInsurance.endAt)}` : "Aucune assurance"}
            </Text>
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card title="Visite technique">
            <Text style={styles.emphasis}>
              {latestInspection
                ? `Prochaine: ${formatDate(latestInspection.nextInspect || latestInspection.scheduledAt)}`
                : "Aucune visite"}
            </Text>
          </Card>
        </View>

        <View style={[styles.gridItem, isTablet && styles.gridItemFullTablet]}>
          <Card title="Maintenance">
            <Text style={styles.line}>
              Kilometrage actuel: {Number(vehicle?.odometerKm || 0).toLocaleString()} km
            </Text>
            {nextMaintenance ? (
              <>
                <Text style={styles.maintenanceTypeText}>Type: {maintenanceTypeLabel(nextMaintenance.maintenanceType)}</Text>
                <Text style={styles.line}>Detail: {nextMaintenance.description || "Entretien planifie"}</Text>
                <Text style={styles.emphasis}>{maintenanceDueLabel(nextMaintenance, formatDate)}</Text>
                {typeof nextMaintenance.odometerKm === "number" ? (
                  <Text style={styles.emphasis}>
                    Kilometrage entretien: {Number(nextMaintenance.odometerKm).toLocaleString()} km
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
              </>
            ) : (
              <>
                <Text style={styles.line}>Type: -</Text>
                <Text style={styles.line}>Kilometrage entretien: -</Text>
                <Text style={styles.line}>Aucune maintenance planifiée</Text>
              </>
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
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  line: {
    fontSize: 14,
    color: "#334155",
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

export default DriverVehicleScreen;



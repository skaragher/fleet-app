import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

const PERIODS = [
  { key: "DAY", label: "Aujourd'hui" },
  { key: "MONTH", label: "Ce mois" },
  { key: "YEAR", label: "Cette année" },
];

// Normes de consommation par catégorie (L/100km) — calquées sur le référentiel backend
const CATEGORY_NORMS = {
  CITADINE:     7,
  BERLINE_SUV:  10,
  PICKUP_4X4:   12,
  PETIT_CAMION: 18,
  POIDS_LOURD:  28,
  GROS_PORTEUR: 38,
};
const CATEGORY_LABELS = {
  CITADINE:     "Citadine",
  BERLINE_SUV:  "Berline/SUV",
  PICKUP_4X4:   "Pick-up/4x4",
  PETIT_CAMION: "Petit camion",
  POIDS_LOURD:  "Poids lourd",
  GROS_PORTEUR: "Gros porteur",
};
const DEFAULT_NORM = 12;

// ─── Stat tile ────────────────────────────────────────────────────────────────
const StatTile = ({ label, value, unit, icon, iconColor }) => (
  <View style={tileS.tile}>
    <View style={[tileS.iconBox, { backgroundColor: iconColor + "18" }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <Text style={tileS.value} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    {unit ? <Text style={[tileS.unit, { color: iconColor }]}>{unit}</Text> : null}
    <Text style={tileS.label}>{label}</Text>
  </View>
);

const tileS = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: { fontSize: 20, fontWeight: "900", color: "#0f172a", letterSpacing: -0.3 },
  unit: { fontSize: 11, fontWeight: "700" },
  label: { fontSize: 10, color: "#64748b", fontWeight: "600" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const DriverReportsScreen = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user, refreshTick } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [dispenses, setDispenses] = useState([]);
  const [insurances, setInsurances] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [period, setPeriod] = useState("MONTH");

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
      vehicleDispenses.reduce((sum, d) => sum + Number(d.liters || 0) * Number(d.unitPrice || 0), 0),
    [vehicleDispenses]
  );

  const avgConsumption = useMemo(() => {
    const values = vehicleDispenses
      .map((d) => Number(d.vehicle?.avgConsumption || d.avgConsumption || 0))
      .filter((v) => v > 0);
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }, [vehicleDispenses]);

  // Catégorie et norme du véhicule assigné (tirées des données de ravitaillement)
  const vehicleCategory = useMemo(() => {
    const first = vehicleDispenses.find((d) => d.vehicle?.category);
    return first?.vehicle?.category || user?.assignedVehicle?.category || null;
  }, [vehicleDispenses, user]);

  const categoryNorm = useMemo(
    () => (vehicleCategory ? (CATEGORY_NORMS[vehicleCategory] ?? DEFAULT_NORM) : DEFAULT_NORM),
    [vehicleCategory]
  );

  const consumptionState = useMemo(() => {
    if (avgConsumption <= 0) return { label: "Non disponible", color: "#64748b", ecartPct: null };
    const ecartPct = ((avgConsumption - categoryNorm) / categoryNorm) * 100;
    if (ecartPct > 25)  return { label: "Critique",   color: "#dc2626", ecartPct };
    if (ecartPct > 10)  return { label: "Attention",  color: "#f59e0b", ecartPct };
    if (ecartPct < -10) return { label: "Économique", color: "#0891b2", ecartPct };
    return               { label: "Normal",      color: "#16a34a", ecartPct };
  }, [avgConsumption, categoryNorm]);

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

  const maintenanceList = useMemo(
    () =>
      maintenances
        .filter((m) => String(m.vehicleId || m.vehicle?.id || "") === assignedVehicleId)
        .filter(isPendingMaintenance)
        .slice()
        .sort((a, b) => {
          const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
          if (aTime !== bTime) return aTime - bTime;
          return Number(a.odometerKm || Number.MAX_SAFE_INTEGER) - Number(b.odometerKm || Number.MAX_SAFE_INTEGER);
        }),
    [maintenances, assignedVehicleId]
  );

  const currentVehicleOdometer = useMemo(() => {
    const latest = vehicleDispenses[0];
    if (latest?.odometerKm) return Number(latest.odometerKm);
    return Number(user?.assignedVehicle?.odometerKm || 0);
  }, [vehicleDispenses, user]);

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

  useEffect(() => { load(); }, [refreshTick]);

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#1d4ed8" />}>
      <CompanyHeader subtitle="Rapports du chauffeur" />

      {/* ── Period switcher ───────────────────────────────────────────── */}
      <View style={styles.periodBar}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Stat tiles ───────────────────────────────────────────────── */}
      <View style={styles.tilesGrid}>
        <StatTile
          label="Ravitaillements"
          value={`${vehicleDispenses.length}`}
          icon="water-outline"
          iconColor="#0891b2"
        />
        <StatTile
          label="Volume total"
          value={`${totalLiters.toLocaleString()}`}
          unit="litres"
          icon="flask-outline"
          iconColor="#1d4ed8"
        />
      </View>
      <View style={styles.tilesGrid}>
        <StatTile
          label="Montant total"
          value={totalAmount > 0 ? `${Math.round(totalAmount / 1000)}k` : "0"}
          unit="FCFA"
          icon="cash-outline"
          iconColor="#16a34a"
        />
        <StatTile
          label="Conso moyenne"
          value={avgConsumption > 0 ? `${avgConsumption.toFixed(1)}` : "-"}
          unit={avgConsumption > 0 ? `L/100 · ${consumptionState.label}` : undefined}
          icon="speedometer-outline"
          iconColor={consumptionState.color}
        />
      </View>

      {/* ── Consommation détail ───────────────────────────────────── */}
      {avgConsumption > 0 && (
        <View style={styles.consoDetail}>
          <View style={styles.consoRow}>
            <Text style={styles.consoKey}>Calibre véhicule</Text>
            <Text style={styles.consoVal}>
              {vehicleCategory ? CATEGORY_LABELS[vehicleCategory] : "Non renseigné"}
            </Text>
          </View>
          <View style={styles.consoRow}>
            <Text style={styles.consoKey}>Norme calibre</Text>
            <Text style={[styles.consoVal, { color: "#1d4ed8" }]}>{categoryNorm} L/100km</Text>
          </View>
          {consumptionState.ecartPct !== null && (
            <View style={styles.consoRow}>
              <Text style={styles.consoKey}>Écart vs norme</Text>
              <Text style={[styles.consoVal, { color: consumptionState.color, fontWeight: "800" }]}>
                {consumptionState.ecartPct > 0 ? "+" : ""}{consumptionState.ecartPct.toFixed(1)}%
              </Text>
            </View>
          )}
          {/* Légende seuils */}
          <View style={styles.consoLegend}>
            <Text style={styles.consoLegendTitle}>Seuils d'alerte :</Text>
            {[
              { label: "Critique",   color: "#dc2626", text: "> +25%" },
              { label: "Attention",  color: "#f59e0b", text: "+10 à +25%" },
              { label: "Normal",     color: "#16a34a", text: "± 10%" },
              { label: "Économique", color: "#0891b2", text: "< -10%" },
            ].map((s) => (
              <View key={s.label} style={styles.consoLegendRow}>
                <View style={[styles.consoLegendDot, { backgroundColor: s.color }]} />
                <Text style={styles.consoLegendLabel}>{s.label}</Text>
                <Text style={styles.consoLegendRange}>{s.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Documents summary ────────────────────────────────────────── */}
      <View style={[styles.docsRow, isTablet && styles.docsRowTablet]}>
        <Card title="Assurance" icon="shield-checkmark-outline" iconColor="#16a34a" iconBg="#f0fdf4">
          {latestInsurance ? (
            <>
              <Text style={styles.docDate}>Fin : {formatDate(latestInsurance.endAt)}</Text>
              <Text style={[
                styles.docDays,
                daysTo(latestInsurance.endAt) < 15 ? styles.docRed : daysTo(latestInsurance.endAt) < 30 ? styles.docOrange : styles.docGreen
              ]}>
                {daysTo(latestInsurance.endAt) < 0
                  ? "Expirée !"
                  : `${daysTo(latestInsurance.endAt)} jours restants`}
              </Text>
            </>
          ) : (
            <Text style={styles.noDoc}>Aucune assurance</Text>
          )}
        </Card>

        <Card title="Visite technique" icon="clipboard-outline" iconColor="#4f46e5" iconBg="#eef2ff">
          {latestInspection ? (
            <>
              <Text style={styles.docDate}>
                Prochaine : {formatDate(latestInspection.nextInspect || latestInspection.scheduledAt)}
              </Text>
              <Text style={[
                styles.docDays,
                daysTo(latestInspection.nextInspect || latestInspection.scheduledAt) < 0 ? styles.docRed : styles.docGreen
              ]}>
                {daysTo(latestInspection.nextInspect || latestInspection.scheduledAt) < 0
                  ? "En retard !"
                  : `${daysTo(latestInspection.nextInspect || latestInspection.scheduledAt)} jours`}
              </Text>
            </>
          ) : (
            <Text style={styles.noDoc}>Aucune visite</Text>
          )}
        </Card>
      </View>

      {/* ── Maintenance ──────────────────────────────────────────────── */}
      {maintenanceList.length > 0 && (
        <Card title="Maintenance" icon="construct-outline" iconColor="#7c3aed" iconBg="#f3e8ff">
          <Text style={styles.odomLine}>
            Kilométrage : {Number(currentVehicleOdometer || 0).toLocaleString()} km
          </Text>
          {maintenanceList.map((item) => {
            const alert = getVidangeAlert(item, currentVehicleOdometer);
            const isDanger = alert?.level === "danger";
            return (
              <View key={item.id} style={[styles.maintItem, isDanger ? styles.maintDanger : styles.maintWarning]}>
                <View style={styles.maintHeader}>
                  <Text style={styles.maintType}>{maintenanceTypeLabel(item.maintenanceType)}</Text>
                  {alert && (
                    <Text style={[styles.alertPill, isDanger ? styles.alertPillDanger : styles.alertPillWarning]}>
                      {alert.text}
                    </Text>
                  )}
                </View>
                <Text style={styles.maintDue}>{maintenanceDueLabel(item, formatDate)}</Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* ── Dispense history ─────────────────────────────────────────── */}
      <Card title="Historique des ravitaillements" icon="list-outline" iconColor="#0891b2" iconBg="#e0f2fe">
        {vehicleDispenses.slice(0, 10).length === 0 ? (
          <Text style={styles.noDoc}>Aucun ravitaillement sur cette période</Text>
        ) : (
          vehicleDispenses.slice(0, 10).map((d, idx) => {
            const amount = Number(d.liters || 0) * Number(d.unitPrice || 0);
            return (
              <View key={d.id} style={[styles.dispRow, idx === 0 && styles.dispRowFirst]}>
                <View style={styles.dispIconCol}>
                  <View style={styles.dispDot} />
                </View>
                <View style={styles.dispLeft}>
                  <Text style={styles.dispDate}>
                    {formatDate(d.dispensedAt)} -{" "}
                    {new Date(d.dispensedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <View style={styles.dispStationRow}>
                    <Ionicons name="location-outline" size={11} color="#94a3b8" />
                    <Text style={styles.dispStation}>{getDispenseStationName(d)}</Text>
                  </View>
                </View>
                <View style={styles.dispRight}>
                  <Text style={styles.dispLiters}>{Number(d.liters || 0).toLocaleString()} L</Text>
                  {amount > 0 && <Text style={styles.dispAmount}>{formatCurrency(amount)}</Text>}
                </View>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  // Period bar
  periodBar: {
    flexDirection: "row",
    backgroundColor: "#e0e7ff",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },
  periodBtnActive: { backgroundColor: "#1d4ed8" },
  periodText: { color: "#3730a3", fontWeight: "700", fontSize: 12 },
  periodTextActive: { color: "#ffffff" },

  // Tiles
  tilesGrid: { flexDirection: "row", gap: 10 },

  // Consommation détail
  consoDetail: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  consoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  consoKey: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  consoVal: { fontSize: 13, color: "#0f172a", fontWeight: "700" },
  consoLegend: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    gap: 4,
  },
  consoLegendTitle: { fontSize: 11, color: "#94a3b8", fontWeight: "700", marginBottom: 2 },
  consoLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  consoLegendDot: { width: 8, height: 8, borderRadius: 4 },
  consoLegendLabel: { fontSize: 11, fontWeight: "700", color: "#334155", flex: 1 },
  consoLegendRange: { fontSize: 11, color: "#64748b" },

  // Docs row
  docsRow: { gap: 10 },
  docsRowTablet: { flexDirection: "row" },
  docDate: { fontSize: 13, color: "#334155", fontWeight: "500" },
  docDays: { fontSize: 13, fontWeight: "700" },
  docGreen: { color: "#16a34a" },
  docOrange: { color: "#b45309" },
  docRed: { color: "#dc2626" },
  noDoc: { fontSize: 13, color: "#94a3b8" },

  // Maintenance
  odomLine: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  maintItem: { borderRadius: 10, padding: 10, gap: 3 },
  maintWarning: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#f59e0b" },
  maintDanger: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#ef4444" },
  maintHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  maintType: { fontSize: 13, fontWeight: "800", color: "#0f172a", flex: 1 },
  maintDue: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  alertPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
  },
  alertPillWarning: { color: "#b45309", borderColor: "#f59e0b", backgroundColor: "#fef9c3" },
  alertPillDanger: { color: "#b91c1c", borderColor: "#ef4444", backgroundColor: "#fee2e2" },

  // Dispense rows
  dispRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    marginTop: 10,
  },
  dispRowFirst: { borderTopWidth: 0, paddingTop: 0, marginTop: 0 },
  dispIconCol: { alignItems: "center", paddingTop: 5 },
  dispDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0891b2",
  },
  dispLeft: { flex: 1, gap: 2 },
  dispDate: { fontSize: 13, color: "#0f172a", fontWeight: "600" },
  dispStationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  dispStation: { fontSize: 11, color: "#94a3b8" },
  dispRight: { alignItems: "flex-end", gap: 2 },
  dispLiters: { fontSize: 15, fontWeight: "800", color: "#0891b2" },
  dispAmount: { fontSize: 11, color: "#16a34a", fontWeight: "600" },
});

export default DriverReportsScreen;

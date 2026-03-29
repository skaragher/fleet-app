import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Card from "../components/Card";
import CompanyHeader from "../components/CompanyHeader";
import { stationApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

const FUEL_LABELS = {
  DIESEL: "Diesel",
  SUPER: "Sans plomb",
  LUBRIFIANT: "Lubrifiant",
  HUILE: "Huile",
};

const formatTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
};

const StationHistoryScreen = () => {
  const { refreshTick } = useAuth();
  const [context, setContext] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await stationApi.context();
      setContext(res.data);
    } catch {
      // Silencieux
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [refreshTick]);

  const dispenses = context?.todayDispenses || [];
  const station = context?.station;

  const totalLiters = dispenses.reduce((s, d) => s + Number(d.liters || 0), 0);
  const totalAmount = dispenses.reduce(
    (s, d) => s + Number(d.liters || 0) * Number(d.unitPrice || 0),
    0
  );

  // Grouper par cuve pour les stats
  const byTank = {};
  for (const d of dispenses) {
    const key = d.tank?.name || "—";
    if (!byTank[key]) byTank[key] = { liters: 0, count: 0, fuel: d.tank?.fuelType };
    byTank[key].liters += Number(d.liters || 0);
    byTank[key].count += 1;
  }

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#1d4ed8" />}
    >
      <CompanyHeader subtitle="Historique du jour" />

      {/* ── Résumé du jour ───────────────────────────────────────────── */}
      <LinearGradient
        colors={["#1e3a8a", "#2563eb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.summaryBanner}
      >
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryLabel}>AUJOURD'HUI — {station?.name || "Ma station"}</Text>
          <Text style={styles.summaryDate}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatNum}>{dispenses.length}</Text>
            <Text style={styles.summaryStatLabel}>ravit.</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatNum}>{totalLiters.toLocaleString()}</Text>
            <Text style={styles.summaryStatLabel}>litres</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Stats par cuve ───────────────────────────────────────────── */}
      {Object.keys(byTank).length > 0 && (
        <Card title="Par cuve" icon="flask-outline" iconColor="#0891b2" iconBg="#e0f2fe">
          {Object.entries(byTank).map(([name, data]) => (
            <View key={name} style={styles.tankStatRow}>
              <View style={styles.tankStatLeft}>
                <Text style={styles.tankStatName}>{name}</Text>
                <Text style={styles.tankStatFuel}>{FUEL_LABELS[data.fuel] || data.fuel || "—"}</Text>
              </View>
              <View style={styles.tankStatRight}>
                <Text style={styles.tankStatLiters}>{data.liters.toLocaleString()} L</Text>
                <Text style={styles.tankStatCount}>{data.count} ravit.</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* ── Liste des ravitaillements ─────────────────────────────────── */}
      <Card
        title={`${dispenses.length} ravitaillement${dispenses.length !== 1 ? "s" : ""} aujourd'hui`}
        icon="list-outline"
        iconColor="#1d4ed8"
        iconBg="#eff6ff"
      >
        {dispenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="water-outline" size={36} color="#cbd5e1" />
            <Text style={styles.emptyText}>Aucun ravitaillement enregistré aujourd'hui</Text>
          </View>
        ) : (
          dispenses.map((d, idx) => {
            const amount = Number(d.liters || 0) * Number(d.unitPrice || 0);
            const plate = d.vehicle?.plate || d.privatePlate || "Privé";
            const model = [d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ");
            return (
              <View key={d.id} style={[styles.dispRow, idx === 0 && styles.dispRowFirst]}>
                {/* Heure */}
                <View style={styles.dispTimeCol}>
                  <Text style={styles.dispTime}>{formatTime(d.dispensedAt)}</Text>
                  <View style={styles.dispDot} />
                </View>
                {/* Infos */}
                <View style={styles.dispBody}>
                  <View style={styles.dispHeader}>
                    <Text style={styles.dispPlate}>{plate}</Text>
                    <Text style={styles.dispLiters}>{Number(d.liters || 0).toLocaleString()} L</Text>
                  </View>
                  {model ? <Text style={styles.dispModel}>{model}</Text> : null}
                  <View style={styles.dispMeta}>
                    <Ionicons name="flask-outline" size={11} color="#64748b" />
                    <Text style={styles.dispMetaText}>
                      {d.tank?.name || "—"} · {FUEL_LABELS[d.tank?.fuelType] || d.tank?.fuelType || "—"}
                    </Text>
                    {amount > 0 && (
                      <>
                        <Text style={styles.dispMetaDot}>·</Text>
                        <Text style={[styles.dispMetaText, styles.dispAmount]}>
                          {Math.round(amount).toLocaleString()} FCFA
                        </Text>
                      </>
                    )}
                  </View>
                  {d.driver?.fullName && (
                    <View style={styles.dispMeta}>
                      <Ionicons name="person-outline" size={11} color="#64748b" />
                      <Text style={styles.dispMetaText}>{d.driver.fullName}</Text>
                    </View>
                  )}
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
  // Summary banner
  summaryBanner: {
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryLeft: { flex: 1 },
  summaryLabel: { fontSize: 9, color: "#93c5fd", fontWeight: "700", letterSpacing: 1.5 },
  summaryDate: { fontSize: 15, fontWeight: "700", color: "#ffffff", marginTop: 4, textTransform: "capitalize" },
  summaryStats: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryStat: { alignItems: "center" },
  summaryStatNum: { fontSize: 26, fontWeight: "900", color: "#ffffff" },
  summaryStatLabel: { fontSize: 10, color: "#bfdbfe", fontWeight: "600" },
  summaryDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.2)" },

  // Tank stats
  tankStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tankStatLeft: { gap: 1 },
  tankStatName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  tankStatFuel: { fontSize: 11, color: "#64748b" },
  tankStatRight: { alignItems: "flex-end", gap: 1 },
  tankStatLiters: { fontSize: 16, fontWeight: "900", color: "#0891b2" },
  tankStatCount: { fontSize: 11, color: "#64748b" },

  // Dispense rows
  dispRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    marginTop: 10,
  },
  dispRowFirst: { borderTopWidth: 0, paddingTop: 0, marginTop: 0 },
  dispTimeCol: { alignItems: "center", gap: 4, width: 40 },
  dispTime: { fontSize: 12, fontWeight: "700", color: "#1d4ed8" },
  dispDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1d4ed8",
  },
  dispBody: { flex: 1, gap: 3 },
  dispHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dispPlate: { fontSize: 15, fontWeight: "900", color: "#0f172a" },
  dispLiters: { fontSize: 16, fontWeight: "900", color: "#0891b2" },
  dispModel: { fontSize: 12, color: "#64748b" },
  dispMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  dispMetaText: { fontSize: 11, color: "#64748b" },
  dispMetaDot: { fontSize: 11, color: "#cbd5e1" },
  dispAmount: { color: "#16a34a", fontWeight: "700" },

  // Empty
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center" },
});

export default StationHistoryScreen;

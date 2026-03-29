import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import Screen from "../components/Screen";
import Card from "../components/Card";
import CompanyHeader from "../components/CompanyHeader";
import { stationApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

// ─── QR payload type attendu ──────────────────────────────────────────────────
const QR_TYPE = "FLEETENERGY_VEHICLE";

// ─── Mode de saisie ───────────────────────────────────────────────────────────
const MODE_SCAN = "scan";
const MODE_MANUAL = "manual";

// ─── Écran principal ──────────────────────────────────────────────────────────
const StationHomeScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const { user, refreshTick } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState(MODE_SCAN);
  const [context, setContext] = useState(null); // { station, todayDispenses }
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState(null);
  const [plate, setPlate] = useState("");
  const [searching, setSearching] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Charger le contexte station
  const loadContext = useCallback(async () => {
    setContextLoading(true);
    setContextError(null);
    try {
      const res = await stationApi.context();
      setContext(res.data);
    } catch (e) {
      const msg = e?.response?.data?.message || "Impossible de charger les données de la station.";
      setContextError(msg);
    } finally {
      setContextLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [refreshTick]);

  // ── Identification du véhicule par plaque ──────────────────────────────────
  const identifyVehicle = async (searchPlate) => {
    if (!searchPlate.trim()) return;
    setSearching(true);
    try {
      const res = await stationApi.searchVehicle(searchPlate.trim());
      const vehicles = res.data || [];
      if (vehicles.length === 0) {
        Alert.alert("Véhicule introuvable", `Aucun véhicule en service avec la plaque "${searchPlate}".`);
        setScanned(false);
        return;
      }
      // Prendre le premier résultat exact ou le premier de la liste
      const vehicle = vehicles.find(
        (v) => v.plate.toLowerCase() === searchPlate.trim().toLowerCase()
      ) || vehicles[0];

      navigation.navigate("DispenseForm", { vehicle, context });
      setPlate("");
      setScanned(false);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de rechercher le véhicule.");
      setScanned(false);
    } finally {
      setSearching(false);
    }
  };

  // ── Handler QR code scanné ─────────────────────────────────────────────────
  const handleBarcode = useCallback(
    ({ data }) => {
      if (scanned || searching) return;
      setScanned(true);
      try {
        const payload = JSON.parse(data);
        if (payload?.type === QR_TYPE && payload?.plate) {
          identifyVehicle(payload.plate);
        } else if (typeof data === "string" && data.length >= 3) {
          // QR simple contenant juste la plaque
          identifyVehicle(data);
        } else {
          Alert.alert("QR invalide", "Ce QR code n'est pas reconnu.");
          setScanned(false);
        }
      } catch {
        // Pas du JSON → peut-être juste une plaque en texte brut
        identifyVehicle(data);
      }
    },
    [scanned, searching, context]
  );

  // ─── Rendu ────────────────────────────────────────────────────────────────
  const stationName = context?.station?.name || user?.name || "Ma station";
  const todayCount = context?.todayDispenses?.length || 0;
  const todayLiters = (context?.todayDispenses || []).reduce(
    (s, d) => s + Number(d.liters || 0),
    0
  );

  // Afficher l'erreur de contexte si présente
  if (!contextLoading && contextError) {
    return (
      <Screen scroll={false}>
        <View style={styles.errorWrapper}>
          <Ionicons name="warning-outline" size={48} color="#f59e0b" />
          <Text style={styles.errorTitle}>Station non configurée</Text>
          <Text style={styles.errorMsg}>{contextError}</Text>
          <Text style={styles.errorHint}>
            Vérifiez que votre compte a bien une station assignée dans l'interface d'administration.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadContext}>
            <Ionicons name="refresh-outline" size={18} color="#ffffff" />
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.wrapper}>
        {/* Header station */}
        <LinearGradient
          colors={["#1e3a8a", "#2563eb"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>STATION</Text>
            <Text style={styles.headerName} numberOfLines={1}>{stationName}</Text>
          </View>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNum}>{todayCount}</Text>
              <Text style={styles.headerStatLabel}>ravit.</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNum}>{todayLiters.toLocaleString()}</Text>
              <Text style={styles.headerStatLabel}>litres</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Mode switcher */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === MODE_SCAN && styles.modeBtnActive]}
            onPress={() => { setMode(MODE_SCAN); setScanned(false); }}
          >
            <Ionicons
              name="qr-code-outline"
              size={16}
              color={mode === MODE_SCAN ? "#ffffff" : "#3730a3"}
            />
            <Text style={[styles.modeBtnText, mode === MODE_SCAN && styles.modeBtnTextActive]}>
              Scanner QR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === MODE_MANUAL && styles.modeBtnActive]}
            onPress={() => setMode(MODE_MANUAL)}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={mode === MODE_MANUAL ? "#ffffff" : "#3730a3"}
            />
            <Text style={[styles.modeBtnText, mode === MODE_MANUAL && styles.modeBtnTextActive]}>
              Saisir plaque
            </Text>
          </TouchableOpacity>
        </View>

        {/* Zone principale */}
        <View style={styles.main}>
          {mode === MODE_SCAN ? (
            // ── Scanner QR ──────────────────────────────────────────────────
            <View style={styles.scanArea}>
              {!permission ? (
                <View style={styles.permCenter}>
                  <ActivityIndicator color="#1d4ed8" />
                </View>
              ) : !permission.granted ? (
                <View style={styles.permCenter}>
                  <Ionicons name="camera-off-outline" size={48} color="#94a3b8" />
                  <Text style={styles.permText}>Accès caméra requis</Text>
                  <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                    <Text style={styles.permBtnText}>Autoriser la caméra</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={scanned ? undefined : handleBarcode}
                  />
                  {/* Cadre de scan */}
                  <View style={styles.scanFrame}>
                    <View style={[styles.scanCorner, styles.scanCornerTL]} />
                    <View style={[styles.scanCorner, styles.scanCornerTR]} />
                    <View style={[styles.scanCorner, styles.scanCornerBL]} />
                    <View style={[styles.scanCorner, styles.scanCornerBR]} />
                  </View>
                  <View style={styles.scanHintBg}>
                    {searching ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.scanHint}>
                        {scanned ? "Identification en cours…" : "Pointez le QR code du chauffeur"}
                      </Text>
                    )}
                  </View>
                  {scanned && !searching && (
                    <TouchableOpacity
                      style={styles.rescanBtn}
                      onPress={() => setScanned(false)}
                    >
                      <Text style={styles.rescanText}>Re-scanner</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          ) : (
            // ── Saisie manuelle ──────────────────────────────────────────────
            <View style={styles.manualArea}>
              <View style={styles.manualCard}>
                <Ionicons name="car-outline" size={40} color="#1d4ed8" style={styles.manualIcon} />
                <Text style={styles.manualTitle}>Rechercher un véhicule</Text>
                <Text style={styles.manualSub}>Entrez la plaque d'immatriculation</Text>
                <View style={styles.plateInputWrap}>
                  <TextInput
                    style={styles.plateInput}
                    placeholder="Ex : AB-123-CD"
                    placeholderTextColor="#94a3b8"
                    value={plate}
                    onChangeText={(t) => setPlate(t.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => identifyVehicle(plate)}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.searchBtn, (!plate.trim() || searching) && styles.searchBtnDisabled]}
                  onPress={() => identifyVehicle(plate)}
                  disabled={!plate.trim() || searching}
                >
                  {searching ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="search-outline" size={18} color="#ffffff" />
                      <Text style={styles.searchBtnText}>Rechercher</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Cuves disponibles */}
              {context?.station?.tanks?.length > 0 && (
                <View style={styles.tanksSection}>
                  <Text style={styles.tanksSectionTitle}>Cuves disponibles</Text>
                  {context.station.tanks.map((tank) => {
                    const pct = tank.capacityL > 0
                      ? Math.round((tank.currentL / tank.capacityL) * 100)
                      : 0;
                    const low = tank.currentL <= tank.lowAlertL;
                    return (
                      <View key={tank.id} style={styles.tankRow}>
                        <View style={styles.tankInfo}>
                          <Text style={styles.tankName}>{tank.name}</Text>
                          <Text style={styles.tankFuel}>{tank.fuelType}</Text>
                        </View>
                        <View style={styles.tankBar}>
                          <View
                            style={[
                              styles.tankBarFill,
                              { width: `${pct}%`, backgroundColor: low ? "#ef4444" : "#1d4ed8" },
                            ]}
                          />
                        </View>
                        <Text style={[styles.tankLevel, low && styles.tankLevelLow]}>
                          {Number(tank.currentL).toLocaleString()} L
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
};

const CORNER = 22;
const CORNER_THICK = 3;

const styles = StyleSheet.create({
  wrapper: { flex: 1, gap: 12, padding: 16 },

  // Header
  header: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  headerLeft: { flex: 1 },
  headerLabel: { fontSize: 9, color: "#93c5fd", fontWeight: "700", letterSpacing: 1.5 },
  headerName: { fontSize: 18, fontWeight: "900", color: "#ffffff", marginTop: 2 },
  headerStats: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerStat: { alignItems: "center" },
  headerStatNum: { fontSize: 22, fontWeight: "900", color: "#ffffff" },
  headerStatLabel: { fontSize: 10, color: "#bfdbfe", fontWeight: "600" },
  headerStatDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },

  // Mode switcher
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: "#e0e7ff",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  modeBtnActive: { backgroundColor: "#1d4ed8" },
  modeBtnText: { color: "#3730a3", fontWeight: "700", fontSize: 13 },
  modeBtnTextActive: { color: "#ffffff" },

  // Zone principale
  main: { flex: 1 },

  // Scanner
  scanArea: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    position: "absolute",
    width: 220,
    height: 220,
  },
  scanCorner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#60a5fa",
  },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK },
  scanHintBg: {
    position: "absolute",
    bottom: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scanHint: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  rescanBtn: {
    position: "absolute",
    bottom: 70,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  rescanText: { color: "#ffffff", fontWeight: "700" },
  permCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  permText: { color: "#94a3b8", fontSize: 15, textAlign: "center" },
  permBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  permBtnText: { color: "#ffffff", fontWeight: "700" },

  // Manual
  manualArea: { flex: 1, gap: 14 },
  manualCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  manualIcon: { marginBottom: 4 },
  manualTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  manualSub: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  plateInputWrap: {
    width: "100%",
    borderWidth: 2,
    borderColor: "#dbeafe",
    borderRadius: 12,
    backgroundColor: "#f8faff",
    overflow: "hidden",
  },
  plateInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: 3,
  },
  searchBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  searchBtnDisabled: { backgroundColor: "#94a3b8" },
  searchBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },

  // Tanks
  tanksSection: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tanksSectionTitle: { fontSize: 13, fontWeight: "800", color: "#1e3a8a", marginBottom: 2 },
  tankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tankInfo: { width: 100, gap: 1 },
  tankName: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
  tankFuel: { fontSize: 10, color: "#64748b" },
  tankBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tankBarFill: { height: "100%", borderRadius: 4 },
  tankLevel: { fontSize: 12, fontWeight: "700", color: "#334155", width: 60, textAlign: "right" },
  tankLevelLow: { color: "#ef4444" },

  // Error state
  errorWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  errorTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  errorMsg: { fontSize: 14, color: "#dc2626", textAlign: "center", fontWeight: "600" },
  errorHint: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 20 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});

export default StationHomeScreen;

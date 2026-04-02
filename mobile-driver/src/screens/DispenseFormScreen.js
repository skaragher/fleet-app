import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { stationApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

const FUEL_LABELS = {
  DIESEL: "Diesel",
  SUPER: "Sans plomb",
  LUBRIFIANT: "Lubrifiant",
  HUILE: "Huile",
};

// ─── Champ de saisie ──────────────────────────────────────────────────────────
const Field = ({ label, icon, iconColor = "#1d4ed8", required, children }) => (
  <View style={fieldS.wrap}>
    <View style={fieldS.labelRow}>
      <Ionicons name={icon} size={14} color={iconColor} />
      <Text style={fieldS.label}>
        {label}
        {required ? <Text style={fieldS.required}> *</Text> : null}
      </Text>
    </View>
    {children}
  </View>
);

const fieldS = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", letterSpacing: 0.2 },
  required: { color: "#ef4444" },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
const DispenseFormScreen = ({ route, navigation }) => {
  const { vehicle, context } = route.params || {};
  const { user } = useAuth();

  const allTanks = context?.station?.tanks || [];
  const stationId = context?.station?.id || "";

  // Filtrer les cuves par type de carburant du véhicule
  const compatibleTanks = vehicle?.fuelType
    ? allTanks.filter((t) => t.fuelType === vehicle.fuelType)
    : allTanks;
  const tanks = compatibleTanks; // cuves compatibles uniquement

  const [tankId, setTankId] = useState(compatibleTanks[0]?.id || "");
  const [liters, setLiters] = useState("");
  const [odometerKm, setOdometerKm] = useState(
    vehicle?.odometerKm ? String(vehicle.odometerKm) : ""
  );
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedTank = tanks.find((t) => t.id === tankId);

  const validate = () => {
    if (tanks.length === 0) {
      Alert.alert(
        "Ravitaillement impossible",
        `Aucune cuve ${FUEL_LABELS[vehicle?.fuelType] || ""} disponible à cette station.`
      );
      return false;
    }
    const litersNum = parseInt(liters, 10);
    if (!liters || isNaN(litersNum) || litersNum <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un nombre de litres valide.");
      return false;
    }
    if (!odometerKm || isNaN(parseInt(odometerKm, 10))) {
      Alert.alert("Erreur", "Le kilométrage est obligatoire pour les véhicules de la flotte.");
      return false;
    }
    if (parseInt(odometerKm, 10) < (vehicle?.odometerKm || 0)) {
      Alert.alert(
        "Kilométrage invalide",
        `Le kilométrage saisi (${odometerKm} km) est inférieur au kilométrage actuel du véhicule (${vehicle?.odometerKm} km).`
      );
      return false;
    }
    if (!tankId) {
      Alert.alert("Erreur", "Sélectionnez une cuve.");
      return false;
    }
    if (selectedTank && litersNum > selectedTank.currentL) {
      Alert.alert(
        "Stock insuffisant",
        `La cuve "${selectedTank.name}" ne contient que ${selectedTank.currentL} L.`
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await stationApi.createDispense({
        stationId,
        tankId,
        vehicleId: vehicle.id,
        liters: parseInt(liters, 10),
        odometerKm: parseInt(odometerKm, 10),
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        notes: notes.trim() || null,
      });

      Alert.alert(
        "Ravitaillement enregistré",
        `${liters} L ont été enregistrés pour le véhicule ${vehicle.plate}.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      const msg = e?.response?.data?.message || "Une erreur est survenue.";
      Alert.alert("Erreur", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={24}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#0f172a", "#1e3a8a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>RAVITAILLEMENT</Text>
            <Text style={styles.headerPlate}>{vehicle?.plate || "-"}</Text>
          </View>
          <View style={styles.backBtn} />
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Infos véhicule ─────────────────────────────────────── */}
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleIconBox}>
              <Ionicons name="car-sport" size={24} color="#1d4ed8" />
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehiclePlate}>{vehicle?.plate}</Text>
              <Text style={styles.vehicleModel}>
                {[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Modèle non renseigné"}
              </Text>
              <Text style={styles.vehicleMeta}>
                {FUEL_LABELS[vehicle?.fuelType] || vehicle?.fuelType || "-"}
                {" · "}
                {vehicle?.odometerKm != null
                  ? `${Number(vehicle.odometerKm).toLocaleString()} km actuels`
                  : "Kilométrage inconnu"}
              </Text>
            </View>
          </View>

          {/* ── Formulaire ─────────────────────────────────────────── */}
          <View style={styles.form}>

            {/* Sélection de la cuve - filtrée par type de carburant du véhicule */}
            <Field
              label={`Cuve - ${FUEL_LABELS[vehicle?.fuelType] || vehicle?.fuelType || "Carburant"}`}
              icon="flask-outline"
              iconColor="#0891b2"
              required
            >
              {/* Badge type carburant du véhicule */}
              {vehicle?.fuelType && (
                <View style={styles.fuelLockBadge}>
                  <Ionicons name="lock-closed" size={12} color="#0891b2" />
                  <Text style={styles.fuelLockText}>
                    Seules les cuves {FUEL_LABELS[vehicle.fuelType] || vehicle.fuelType} sont disponibles
                  </Text>
                </View>
              )}
              <View style={styles.tanksGrid}>
                {tanks.map((tank) => {
                  const isSelected = tankId === tank.id;
                  const low = tank.currentL <= tank.lowAlertL;
                  return (
                    <TouchableOpacity
                      key={tank.id}
                      style={[styles.tankOption, isSelected && styles.tankOptionSelected, low && styles.tankOptionLow]}
                      onPress={() => setTankId(tank.id)}
                    >
                      <Ionicons
                        name="water"
                        size={16}
                        color={isSelected ? "#ffffff" : low ? "#ef4444" : "#0891b2"}
                      />
                      <Text style={[styles.tankOptionName, isSelected && styles.tankOptionNameSelected]}>
                        {tank.name}
                      </Text>
                      <Text style={[styles.tankOptionFuel, isSelected && styles.tankOptionNameSelected]}>
                        {FUEL_LABELS[tank.fuelType] || tank.fuelType}
                      </Text>
                      <Text style={[styles.tankOptionLevel, isSelected && styles.tankOptionNameSelected, low && !isSelected && styles.tankOptionLevelLow]}>
                        {Number(tank.currentL).toLocaleString()} L
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {tanks.length === 0 && (
                  <View style={styles.noTanksBox}>
                    <Ionicons name="warning-outline" size={20} color="#dc2626" />
                    <Text style={styles.noTanksText}>
                      Aucune cuve {FUEL_LABELS[vehicle?.fuelType] || ""} disponible à cette station
                    </Text>
                  </View>
                )}
              </View>
            </Field>

            {/* Quantité */}
            <Field label="Quantité dispensée (litres)" icon="water-outline" iconColor="#1d4ed8" required>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  value={liters}
                  onChangeText={setLiters}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
                <Text style={styles.inputUnit}>L</Text>
              </View>
              {selectedTank && (
                <Text style={styles.stockHint}>
                  Stock disponible : {Number(selectedTank.currentL).toLocaleString()} L
                </Text>
              )}
            </Field>

            {/* Kilométrage */}
            <Field label="Kilométrage actuel" icon="speedometer-outline" iconColor="#7c3aed" required>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder={vehicle?.odometerKm ? String(vehicle.odometerKm) : "0"}
                  placeholderTextColor="#94a3b8"
                  value={odometerKm}
                  onChangeText={setOdometerKm}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
                <Text style={styles.inputUnit}>km</Text>
              </View>
            </Field>

            {/* Prix unitaire */}
            <Field label="Prix unitaire (optionnel)" icon="cash-outline" iconColor="#16a34a">
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  value={unitPrice}
                  onChangeText={setUnitPrice}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
                <Text style={styles.inputUnit}>FCFA/L</Text>
              </View>
            </Field>

            {/* Notes */}
            <Field label="Notes (optionnel)" icon="document-text-outline" iconColor="#64748b">
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Observations, remarques…"
                placeholderTextColor="#94a3b8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>

            {/* Récapitulatif */}
            {liters && parseInt(liters, 10) > 0 && unitPrice && parseFloat(unitPrice) > 0 && (
              <View style={styles.recap}>
                <Ionicons name="receipt-outline" size={16} color="#0891b2" />
                <Text style={styles.recapText}>
                  Total estimé :{" "}
                  <Text style={styles.recapAmount}>
                    {(parseInt(liters, 10) * parseFloat(unitPrice)).toLocaleString()} FCFA
                  </Text>
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ── Bouton Valider ─────────────────────────────────────────── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
                <Text style={styles.submitText}>Valider le ravitaillement</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f4ff" },
  kav: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerLabel: { fontSize: 9, color: "#93c5fd", fontWeight: "700", letterSpacing: 1.5 },
  headerPlate: { fontSize: 22, fontWeight: "900", color: "#ffffff", letterSpacing: 2, marginTop: 2 },

  // Scroll
  scroll: { padding: 16, gap: 14, paddingBottom: 8 },

  // Vehicle card
  vehicleCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  vehicleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleInfo: { flex: 1, gap: 2 },
  vehiclePlate: { fontSize: 20, fontWeight: "900", color: "#0f172a", letterSpacing: 1 },
  vehicleModel: { fontSize: 13, color: "#334155", fontWeight: "600" },
  vehicleMeta: { fontSize: 11, color: "#64748b" },

  // Form
  form: { gap: 16 },

  // Tank options
  tanksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tankOption: {
    flex: 1,
    minWidth: 120,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    gap: 3,
    alignItems: "center",
  },
  tankOptionSelected: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  tankOptionLow: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  tankOptionName: { fontSize: 13, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  tankOptionFuel: { fontSize: 11, color: "#64748b", textAlign: "center" },
  tankOptionLevel: { fontSize: 12, fontWeight: "700", color: "#0891b2", textAlign: "center" },
  tankOptionNameSelected: { color: "#ffffff" },
  tankOptionLevelLow: { color: "#ef4444" },
  fuelLockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  fuelLockText: { fontSize: 12, color: "#0891b2", fontWeight: "600" },
  noTanksBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    flex: 1,
  },
  noTanksText: { fontSize: 13, color: "#dc2626", fontWeight: "600", flex: 1 },
  noTanks: { fontSize: 13, color: "#94a3b8", fontStyle: "italic" },

  // Inputs
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  inputMulti: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    padding: 14,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 80,
  },
  inputUnit: {
    paddingRight: 14,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },
  stockHint: { fontSize: 11, color: "#0891b2", fontWeight: "600" },

  // Recap
  recap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e0f2fe",
    borderRadius: 10,
    padding: 12,
  },
  recapText: { fontSize: 13, color: "#0f172a" },
  recapAmount: { fontWeight: "900", color: "#0891b2", fontSize: 15 },

  // Footer
  footer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: "#f0f4ff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1d4ed8",
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: "#1d4ed8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: "#94a3b8", shadowOpacity: 0 },
  submitText: { color: "#ffffff", fontWeight: "900", fontSize: 16 },
});

export default DispenseFormScreen;

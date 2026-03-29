import React, { useState } from "react";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import Screen from "../components/Screen";
import Card from "../components/Card";
import CompanyHeader from "../components/CompanyHeader";
import { useAuth } from "../context/AuthContext";

// ─── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, iconColor = "#1d4ed8" }) => (
  <View style={rowS.row}>
    <View style={[rowS.iconBox, { backgroundColor: iconColor + "15" }]}>
      <Ionicons name={icon} size={16} color={iconColor} />
    </View>
    <View style={rowS.content}>
      <Text style={rowS.label}>{label}</Text>
      <Text style={rowS.value}>{value || "—"}</Text>
    </View>
  </View>
);

const rowS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  content: { flex: 1 },
  label: { fontSize: 10, color: "#94a3b8", fontWeight: "600", letterSpacing: 0.3 },
  value: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
const ProfileScreen = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user, logout, isDriver } = useAuth();
  const [showQR, setShowQR] = useState(false);

  const onLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: logout },
    ]);
  };

  // Initiales pour l'avatar
  const initials = (user?.name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Payload QR code pour le chauffeur
  const qrPayload = JSON.stringify({
    type: "FLEETENERGY_VEHICLE",
    vehicleId: user?.assignedVehicleId || null,
    plate: user?.assignedVehicle?.plate || null,
    driverId: user?.id || null,
    driverName: user?.name || null,
  });

  const subtitle = isDriver ? "Compte chauffeur" : "Compte gestionnaire";

  return (
    <Screen>
      <CompanyHeader subtitle={subtitle} />

      {/* ── Modal QR code ────────────────────────────────────────────── */}
      {isDriver && (
        <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
          <TouchableOpacity style={qrStyles.overlay} activeOpacity={1} onPress={() => setShowQR(false)}>
            <View style={qrStyles.modal}>
              <Text style={qrStyles.modalTitle}>Mon QR Code</Text>
              <Text style={qrStyles.modalSub}>
                Présentez ce code au gestionnaire de station
              </Text>
              <View style={qrStyles.qrBox}>
                <QRCode value={qrPayload} size={220} backgroundColor="#ffffff" color="#0f172a" />
              </View>
              <Text style={qrStyles.plateInQR}>{user?.assignedVehicle?.plate || "Véhicule non assigné"}</Text>
              <Text style={qrStyles.driverInQR}>{user?.name}</Text>
              <TouchableOpacity style={qrStyles.closeBtn} onPress={() => setShowQR(false)}>
                <Text style={qrStyles.closeBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Avatar + name ────────────────────────────────────────────── */}
      <View style={styles.avatarSection}>
        <LinearGradient
          colors={["#1d4ed8", "#4f46e5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarCircle}
        >
          <Text style={styles.avatarInitials}>{initials}</Text>
        </LinearGradient>
        <Text style={styles.userName}>{user?.name || "Chauffeur"}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="person-outline" size={11} color="#4f46e5" />
          <Text style={styles.roleText}>{user?.role || "DRIVER"}</Text>
        </View>
      </View>

      {/* ── Vehicle assigned + bouton QR ─────────────────────────────── */}
      {user?.assignedVehicle?.plate && (
        <LinearGradient
          colors={["#0f172a", "#1e3a8a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.vehicleBanner}
        >
          <View>
            <Text style={styles.vehicleBannerLabel}>VÉHICULE ASSIGNÉ</Text>
            <Text style={styles.vehicleBannerPlate}>{user.assignedVehicle.plate}</Text>
          </View>
          {isDriver && (
            <TouchableOpacity style={styles.qrBtn} onPress={() => setShowQR(true)}>
              <Ionicons name="qr-code-outline" size={20} color="#ffffff" />
              <Text style={styles.qrBtnText}>Mon QR</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      )}

      {/* ── Bouton QR si pas de véhicule assigné mais chauffeur ──────── */}
      {isDriver && !user?.assignedVehicle?.plate && (
        <TouchableOpacity style={styles.qrBtnFull} onPress={() => setShowQR(true)}>
          <Ionicons name="qr-code-outline" size={20} color="#1d4ed8" />
          <Text style={styles.qrBtnFullText}>Afficher mon QR code</Text>
        </TouchableOpacity>
      )}

      {/* ── Profile info ─────────────────────────────────────────────── */}
      <Card title="Mes informations" icon="person-circle-outline" iconColor="#1d4ed8" iconBg="#eff6ff">
        <InfoRow icon="person-outline" label="NOM COMPLET" value={user?.name} iconColor="#1d4ed8" />
        <InfoRow icon="mail-outline" label="EMAIL" value={user?.email} iconColor="#4f46e5" />
        <InfoRow icon="id-card-outline" label="N° PERMIS" value={user?.licenseNo} iconColor="#0891b2" />
        {!!user?.mobileOriginalRole && (
          <InfoRow icon="briefcase-outline" label="RÔLE D'ORIGINE" value={user.mobileOriginalRole} iconColor="#7c3aed" />
        )}
        {!user?.assignedVehicle?.plate && (
          <InfoRow icon="car-outline" label="VÉHICULE" value="Non assigné" iconColor="#94a3b8" />
        )}
      </Card>

      {/* ── Logout ───────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
        <View style={styles.logoutInner}>
          <Ionicons name="log-out-outline" size={20} color="#ffffff" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.version}>FleetEnergy Driver · v1.0.4</Text>
    </Screen>
  );
};

const styles = StyleSheet.create({
  // Avatar
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 8 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1d4ed8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarInitials: { fontSize: 28, fontWeight: "900", color: "#ffffff" },
  userName: { fontSize: 20, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eef2ff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  roleText: { fontSize: 12, fontWeight: "700", color: "#4f46e5" },

  // Vehicle banner
  vehicleBanner: {
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  vehicleBannerLabel: { fontSize: 9, color: "#93c5fd", fontWeight: "700", letterSpacing: 1.5 },
  vehicleBannerPlate: { fontSize: 28, fontWeight: "900", color: "#ffffff", letterSpacing: 2, marginTop: 4 },
  vehicleBannerIcon: { opacity: 0.6 },

  // QR button inline
  qrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  qrBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  // QR button standalone (no vehicle)
  qrBtnFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#bfdbfe",
    borderStyle: "dashed",
  },
  qrBtnFullText: { color: "#1d4ed8", fontWeight: "800", fontSize: 15 },

  // Logout
  logoutBtn: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#dc2626",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  logoutText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },

  version: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
});

// ─── QR Modal styles ──────────────────────────────────────────────────────────
const qrStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  modalSub: { fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 8 },
  qrBox: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  plateInQR: { fontSize: 24, fontWeight: "900", color: "#0f172a", letterSpacing: 2, marginTop: 8 },
  driverInQR: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  closeBtn: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  closeBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
});

export default ProfileScreen;

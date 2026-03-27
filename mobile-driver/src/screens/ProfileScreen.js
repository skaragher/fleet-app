import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import CompanyHeader from "../components/CompanyHeader";
import { useAuth } from "../context/AuthContext";

const ProfileScreen = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user, logout } = useAuth();

  const onLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnexion", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <Screen>
      <CompanyHeader subtitle="Compte chauffeur" />
      <Text style={styles.title}>Mon profil</Text>
      <View style={[styles.grid, isTablet && styles.gridTablet]}>
        <View style={[styles.gridItem, isTablet && styles.gridItemTablet]}>
          <Card>
            <Text style={styles.value}>{user?.name || "-"}</Text>
            <Text style={styles.line}>{user?.email || "-"}</Text>
            <Text style={styles.line}>Rôle: {user?.role || "-"}</Text>
            {!!user?.mobileOriginalRole && (
              <Text style={styles.line}>Rôle d'origine: {user.mobileOriginalRole}</Text>
            )}
            <Text style={styles.line}>Véhicule assigné: {user?.assignedVehicle?.plate || "-"}</Text>
          </Card>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
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
    fontWeight: "700",
    color: "#111827",
  },
  line: {
    fontSize: 14,
    color: "#334155",
  },
  logoutBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
  },
  grid: {
    gap: 12,
  },
  gridTablet: {
    flexDirection: "row",
  },
  gridItem: {
    width: "100%",
  },
  gridItemTablet: {
    flexBasis: "48.8%",
  },
});

export default ProfileScreen;


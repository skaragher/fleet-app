import React from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCompany } from "../context/CompanyContext";

const CompanyHeader = ({ subtitle }) => {
  const { company } = useCompany();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <LinearGradient
      colors={["#1e3a8a", "#2563eb", "#38bdf8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, isTablet && styles.headerTablet]}
    >
      <View style={[styles.left, isTablet && styles.leftTablet]}>
        <Text style={[styles.name, isTablet && styles.nameTablet]}>{company.name || "FLEETENERGY"}</Text>
        <Text style={[styles.tagline, isTablet && styles.taglineTablet]}>{subtitle || company.tagline || "Espace Chauffeur"}</Text>
      </View>
      {company.logoUrl ? <Image source={{ uri: company.logoUrl }} style={[styles.logo, isTablet && styles.logoTablet]} resizeMode="contain" /> : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  header: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTablet: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  left: {
    flex: 1,
    paddingRight: 10,
  },
  leftTablet: {
    paddingRight: 14,
  },
  name: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  nameTablet: {
    fontSize: 19,
  },
  tagline: {
    marginTop: 2,
    fontSize: 12,
    color: "#dbeafe",
  },
  taglineTablet: {
    fontSize: 14,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  logoTablet: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
});

export default CompanyHeader;

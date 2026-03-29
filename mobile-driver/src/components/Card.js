import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const Card = ({ title, icon, iconColor = "#1d4ed8", iconBg = "#eff6ff", accent, children }) => {
  return (
    <View style={[styles.card, !!accent && { borderLeftColor: accent, borderLeftWidth: 4 }]}>
      {(title || icon) ? (
        <View style={styles.cardHeader}>
          {icon ? (
            <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={17} color={iconColor} />
            </View>
          ) : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e3a8a",
    flex: 1,
  },
});

export default Card;

import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";

const LoginScreen = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const { login, setError, error } = useAuth();
  const [licenseNo, setLicenseNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await login(licenseNo.trim(), password);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView style={styles.root} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.shell, isTablet && styles.shellTablet]}>
          <View style={[styles.hero, isTablet && styles.heroTablet]}>
            <View style={styles.brandChip}>
              <Text style={styles.brandChipText}>FLEETENERGY</Text>
            </View>
            <View style={styles.heroLogo}>
              <MaterialIcons name="local-gas-station" size={26} color="#4f46e5" />
            </View>
            <Text style={[styles.heroTitle, isTablet && styles.heroTitleTablet]}>Système de Gestion</Text>
            <Text style={[styles.heroSubtitle, isTablet && styles.heroSubtitleTablet]}>Flotte & Énergie</Text>

            <View style={styles.featuresRow}>
              <View style={styles.featureCard}>
                <Feather name="shield" size={16} color="#4f46e5" />
                <Text style={styles.featureText}>Accès sécurisé</Text>
              </View>
              <View style={styles.featureCard}>
                <Feather name="bar-chart-2" size={16} color="#4f46e5" />
                <Text style={styles.featureText}>Suivi intelligent</Text>
              </View>
            </View>
          </View>

          <View style={[styles.formPanel, isTablet && styles.formPanelTablet]}>
            <Text style={[styles.welcome, isTablet && styles.welcomeTablet]}>Bienvenue !</Text>
            <Text style={styles.welcomeSub}>Connectez-vous pour accéder à votre espace.</Text>

            <Text style={styles.label}>Identifiant</Text>
            <View style={styles.inputWrap}>
              <Feather name="credit-card" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email ou n° de permis"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={licenseNo}
                onChangeText={setLicenseNo}
              />
            </View>

            <Text style={styles.label}>Code</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputWithToggle]}
                placeholder="Votre code"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.eyeToggle} onPress={() => setShowPassword(v => !v)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, (loading || !licenseNo || !password) && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={loading || !licenseNo || !password}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Se connecter</Text>}
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginVertical: 6,
  },
  shellTablet: {
    flexDirection: "row",
    minHeight: 620,
  },
  hero: {
    backgroundColor: "#dde3f7",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: "center",
  },
  heroTablet: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brandChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  brandChipText: {
    color: "#4338ca",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  heroLogo: {
    marginTop: 10,
    width: 62,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  heroTitleTablet: {
    fontSize: 32,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#4f46e5",
  },
  heroSubtitleTablet: {
    fontSize: 20,
  },
  featuresRow: {
    marginTop: 12,
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  featureCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#fff",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  featureText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  formPanel: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  formPanelTablet: {
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  welcome: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0f172a",
  },
  welcomeTablet: {
    fontSize: 40,
  },
  welcomeSub: {
    fontSize: 14,
    color: "#475569",
    marginTop: 4,
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 8,
    marginBottom: 6,
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  eyeToggle: {
    position: "absolute",
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  error: {
    color: "#b91c1c",
    fontSize: 13,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});

export default LoginScreen;

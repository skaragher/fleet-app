import React, { useEffect, useRef } from "react";
import { Animated, useWindowDimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StationHomeScreen from "../screens/StationHomeScreen";
import StationHistoryScreen from "../screens/StationHistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

const AnimatedTabIcon = ({ focused, onName, offName, color, size }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.16 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={focused ? onName : offName} size={size || 22} color={color} />
    </Animated.View>
  );
};

const iconByRoute = {
  StationHome: { on: "qr-code", off: "qr-code-outline" },
  StationHistory: { on: "receipt", off: "receipt-outline" },
  StationProfil: { on: "person-circle", off: "person-circle-outline" },
};

const StationManagerTabs = () => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 768;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabelStyle: { fontSize: isTablet ? 13 : 11, fontWeight: "700" },
        tabBarItemStyle: { paddingVertical: isTablet ? 6 : 4 },
        tabBarStyle: {
          height: (isTablet ? 72 : 64) + Math.max(insets.bottom, 8),
          paddingTop: isTablet ? 6 : 4,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: "#c7d2fe",
          borderTopWidth: 1,
          backgroundColor: "#ffffff",
          elevation: 12,
          shadowColor: "#1d4ed8",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: "#1d4ed8",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarIcon: ({ focused, color, size }) => {
          const cfg = iconByRoute[route.name] || { on: "ellipse", off: "ellipse-outline" };
          return (
            <AnimatedTabIcon
              focused={focused}
              onName={cfg.on}
              offName={cfg.off}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="StationHome"
        component={StationHomeScreen}
        options={{ title: "Ravitaillement" }}
      />
      <Tab.Screen
        name="StationHistory"
        component={StationHistoryScreen}
        options={{ title: "Historique" }}
      />
      <Tab.Screen
        name="StationProfil"
        component={ProfileScreen}
        options={{ title: "Profil" }}
      />
    </Tab.Navigator>
  );
};

export default StationManagerTabs;

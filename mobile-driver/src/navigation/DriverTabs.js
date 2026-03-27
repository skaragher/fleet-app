import React, { useEffect, useRef } from "react";
import { Animated, useWindowDimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DriverDashboardScreen from "../screens/DriverDashboardScreen";
import DriverVehicleScreen from "../screens/DriverVehicleScreen";
import DriverReportsScreen from "../screens/DriverReportsScreen";
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

const DriverTabs = () => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 768;
  const iconByRoute = {
    Dashboard: { on: "grid", off: "grid-outline" },
    MonVehicule: { on: "car", off: "car-outline" },
    Rapports: { on: "stats-chart", off: "stats-chart-outline" },
    Profil: { on: "person-circle", off: "person-circle-outline" },
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabelStyle: { fontSize: isTablet ? 13 : 11, fontWeight: "700", marginBottom: isTablet ? 2 : 2 },
        tabBarItemStyle: {
          paddingVertical: isTablet ? 6 : 4,
        },
        tabBarStyle: {
          height: (isTablet ? 72 : 62) + Math.max(insets.bottom, 8),
          paddingTop: isTablet ? 6 : 4,
          paddingBottom: Math.max(insets.bottom, 8),
          position: "relative",
          borderTopColor: "#dbeafe",
          borderTopWidth: 1,
          backgroundColor: "#ffffff",
          elevation: 8,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.14,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: "#1d4ed8",
        tabBarInactiveTintColor: "#64748b",
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
      <Tab.Screen name="Dashboard" component={DriverDashboardScreen} options={{ title: "Accueil" }} />
      <Tab.Screen name="MonVehicule" component={DriverVehicleScreen} options={{ title: "Mon véhicule" }} />
      <Tab.Screen name="Rapports" component={DriverReportsScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default DriverTabs;

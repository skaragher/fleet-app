import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StationManagerTabs from "./StationManagerTabs";
import DispenseFormScreen from "../screens/DispenseFormScreen";

const Stack = createNativeStackNavigator();

// Ce navigateur enveloppe les onglets du gestionnaire + l'écran de ravitaillement
// (accessible depuis l'onglet Scanner et l'onglet Historique)
const StationManagerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="StationManagerTabs" component={StationManagerTabs} />
    <Stack.Screen
      name="DispenseForm"
      component={DispenseFormScreen}
      options={{
        presentation: "modal",
        animation: "slide_from_bottom",
      }}
    />
  </Stack.Navigator>
);

export default StationManagerNavigator;

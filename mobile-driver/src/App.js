import React from "react";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./context/AuthContext";
import { CompanyProvider } from "./context/CompanyContext";
import RootNavigator from "./navigation/RootNavigator";

const App = () => {
  return (
    <AuthProvider>
      <CompanyProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </CompanyProvider>
    </AuthProvider>
  );
};

export default App;

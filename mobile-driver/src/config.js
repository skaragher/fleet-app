import Constants from "expo-constants";

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  Constants.manifest2?.extra?.expoClient?.extra?.apiUrl ||
  "https://193.168.173.181/api";

import React from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Screen = ({ children, scroll = true, refreshControl }) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const content = <View style={[styles.inner, isTablet && styles.innerTablet, !scroll && styles.innerFull]}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2ff",
  },
  scroll: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  scrollTablet: {
    paddingBottom: 40,
  },
  inner: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    padding: 16,
    gap: 12,
  },
  innerTablet: {
    paddingHorizontal: 24,
    gap: 16,
  },
  innerFull: {
    flex: 1,
  },
});

export default Screen;

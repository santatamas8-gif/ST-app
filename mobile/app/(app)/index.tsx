import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getDashboardStats } from "@/repositories/dashboardRepository";

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isPlayer = user?.role === "player";

  const [loading, setLoading] = useState(true);
  const [hasTodayWellness, setHasTodayWellness] = useState(false);
  const [todayWellnessCount, setTodayWellnessCount] = useState(0);
  const [todaySessionsCount, setTodaySessionsCount] = useState(0);

  useEffect(() => {
    getDashboardStats().then((stats) => {
      setLoading(false);
      if (stats.error) return;
      if (stats.hasTodayWellness !== undefined) setHasTodayWellness(stats.hasTodayWellness);
      if (stats.todayWellnessCount !== undefined) setTodayWellnessCount(stats.todayWellnessCount);
      if (stats.todaySessionsCount !== undefined) setTodaySessionsCount(stats.todaySessionsCount);
    });
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Loading…</Text>
      </View>
    );
  }

  if (!isPlayer) {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>Dashboard</Text>
        <Text style={styles.hint}>Summary: today's wellness and session entries.</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{todayWellnessCount}</Text>
            <Text style={styles.statLabel}>Today wellness (count)</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{todaySessionsCount}</Text>
            <Text style={styles.statLabel}>Today sessions/RPE (count)</Text>
          </View>
        </View>
        <Text style={styles.linkHint}>Use the Wellness and RPE tabs to view summaries.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Hi, {user.email ?? "player"}!</Text>
      {!hasTodayWellness && (
        <View style={styles.ctaBox}>
          <Text style={styles.ctaText}>No wellness entry for today yet.</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push("/(app)/wellness")}
          >
            <Text style={styles.ctaButtonText}>Fill wellness form</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.hint}>Use the tabs below for Wellness and RPE.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f5f5f5",
  },
  centered: { justifyContent: "center", alignItems: "center" },
  welcome: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  ctaBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  ctaText: { fontSize: 15, color: "#374151", marginBottom: 12 },
  ctaButton: {
    backgroundColor: "#059669",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  ctaButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  statsRow: { flexDirection: "row", gap: 16, marginTop: 16 },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statValue: { fontSize: 24, fontWeight: "700", color: "#111" },
  statLabel: { fontSize: 13, color: "#666", marginTop: 4 },
  linkHint: { fontSize: 14, color: "#666", marginTop: 20 },
});

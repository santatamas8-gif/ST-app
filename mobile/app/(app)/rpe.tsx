import { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import {
  getMySessions,
  getSessionsSummaryForStaff,
  submitSession,
} from "@/repositories/sessionsRepository";
import { useAuth } from "@/context/AuthContext";
import type { SessionRow } from "@/models/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RpeScreen() {
  const { user } = useAuth();
  const isPlayer = user?.role === "player";

  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [emailByUserId, setEmailByUserId] = useState<Record<string, string>>({});
  const [recentScrollAtEnd, setRecentScrollAtEnd] = useState(true);

  const recentSessionsLast12 = useMemo(() => sessions.slice(0, 12), [sessions]);

  useEffect(() => {
    setRecentScrollAtEnd(recentSessionsLast12.length <= 5);
  }, [recentSessionsLast12.length]);

  useEffect(() => {
    if (isPlayer) {
      getMySessions(50).then(({ data, error: err }) => {
        setSessionsLoading(false);
        if (err) setError(err);
        else if (data) setSessions(data);
      });
    } else {
      getSessionsSummaryForStaff(100).then(
        ({ data, emailByUserId: emails, error: err }) => {
          setSessionsLoading(false);
          if (err) setError(err);
          else {
            if (data) setSessions(data);
            if (emails) setEmailByUserId(emails);
          }
        }
      );
    }
  }, [isPlayer]);

  async function handleSubmit() {
    setError("");
    const dur = parseInt(duration, 10);
    const r = parseInt(rpe, 10);
    if (!date || isNaN(dur) || dur < 1 || isNaN(r) || r < 1 || r > 10) {
      setError("Date, duration (min) and RPE (1–10) are required.");
      return;
    }
    setLoading(true);
    const result = await submitSession({ date, duration: dur, rpe: r });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const { data } = await getMySessions(50);
    if (data) setSessions(data);
    setDuration("");
    setRpe("");
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isPlayer) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Players RPE / session entries</Text>
        <Text style={styles.subtitle}>
          Summary: everything players log (date, min, RPE, load).
        </Text>
        {sessionsLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : sessions.length === 0 ? (
          <Text style={styles.empty}>No sessions logged yet.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colEmail]} numberOfLines={1}>Player</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colDate]}>Date</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Perc</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>RPE</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Load</Text>
            </View>
            {sessions.map((r) => (
              <View key={r.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colEmail]} numberOfLines={1}>{emailByUserId[r.user_id] ?? r.user_id}</Text>
                <Text style={[styles.tableCell, styles.colDate]}>{r.date}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.duration}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.rpe ?? "—"}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.load ?? "—"}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Log session</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
        />
        <Text style={styles.label}>Duration (min)</Text>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          placeholder="pl. 60"
          keyboardType="number-pad"
        />
        <Text style={styles.label}>RPE (1–10)</Text>
        <TextInput
          style={styles.input}
          value={rpe}
          onChangeText={setRpe}
          placeholder="1–10"
          keyboardType="number-pad"
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Recent sessions</Text>
      <Text style={styles.recentSubtitle}>Last 12 sessions · scroll for more</Text>
      {sessionsLoading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.recentListWrap}>
          <ScrollView
            style={styles.recentScroll}
            contentContainerStyle={styles.recentScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const atEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 8;
              setRecentScrollAtEnd(atEnd);
            }}
            scrollEventThrottle={80}
          >
            {recentSessionsLast12.length === 0 ? (
              <Text style={styles.empty}>No entries yet.</Text>
            ) : (
              recentSessionsLast12.map((s) => (
                <View key={s.id} style={styles.row}>
                  <Text style={styles.date}>{s.date}</Text>
                  <Text style={styles.values}>
                    {s.duration} perc · RPE {s.rpe ?? "—"} · Load {s.load ?? "—"}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          {recentSessionsLast12.length > 5 && !recentScrollAtEnd && (
            <View style={styles.recentFade} pointerEvents="none" />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 24, paddingBottom: 48 },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 16 },
  form: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  error: { color: "#c00", marginBottom: 12, fontSize: 14 },
  button: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  list: { marginTop: 8 },
  recentSubtitle: { fontSize: 13, color: "#666", marginBottom: 8 },
  recentListWrap: { position: "relative", maxHeight: 280, marginTop: 8 },
  recentScroll: { flex: 1, maxHeight: 280 },
  recentScrollContent: { paddingBottom: 8 },
  recentFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 32,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  row: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  date: { fontWeight: "600", marginBottom: 4 },
  values: { fontSize: 14, color: "#666" },
  empty: { color: "#666", fontStyle: "italic", paddingVertical: 12 },
  table: { marginTop: 8 },
  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tableCell: { fontSize: 12 },
  tableHeader: { fontWeight: "600", color: "#374151" },
  colEmail: { flex: 1.4, marginRight: 4 },
  colDate: { width: 72, marginRight: 4 },
  colNum: { width: 44, textAlign: "center" },
});

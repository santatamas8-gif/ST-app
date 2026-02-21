import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  getMyWellnessEntries,
  getWellnessSummaryForStaff,
  submitDailyWellness,
} from "@/repositories/wellnessRepository";
import { useAuth } from "@/context/AuthContext";
import type { WellnessRow } from "@/models/types";

const SCALE_MIN = 1;
const SCALE_MAX = 10;

function calcSleepHours(bed: string, wake: string): number | null {
  if (!bed || !wake) return null;
  const [bH, bM] = bed.split(":").map(Number);
  const [wH, wM] = wake.split(":").map(Number);
  let bedMins = bH * 60 + (bM ?? 0);
  let wakeMins = wH * 60 + (wM ?? 0);
  if (wakeMins <= bedMins) wakeMins += 24 * 60;
  return Math.round(((wakeMins - bedMins) / 60) * 100) / 100;
}

export default function WellnessScreen() {
  const { user } = useAuth();
  const isPlayer = user?.role === "player";

  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [sleepQuality, setSleepQuality] = useState(5);
  const [fatigue, setFatigue] = useState(5);
  const [soreness, setSoreness] = useState(5);
  const [stress, setStress] = useState(5);
  const [mood, setMood] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<WellnessRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [emailByUserId, setEmailByUserId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isPlayer) {
      getMyWellnessEntries(14).then(({ data, error: err }) => {
        setEntriesLoading(false);
        if (err) setError(err);
        else if (data) setEntries(data);
      });
    } else {
      getWellnessSummaryForStaff(100).then(({ data, emailByUserId: emails, error: err }) => {
        setEntriesLoading(false);
        if (err) setError(err);
        else {
          if (data) setEntries(data);
          if (emails) setEmailByUserId(emails);
        }
      });
    }
  }, [isPlayer]);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    const result = await submitDailyWellness({
      sleep_quality: sleepQuality,
      fatigue,
      soreness,
      stress,
      mood,
      bed_time: bedTime || undefined,
      wake_time: wakeTime || undefined,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const { data } = await getMyWellnessEntries(14);
    if (data) setEntries(data);
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Betöltés...</Text>
      </View>
    );
  }

  if (!isPlayer) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Játékosok wellness bejegyzései</Text>
        <Text style={styles.subtitle}>
          Összesítés: minden mező, amit a játékosok kitöltenek (fekvés, kelés, alvás, minőség, fatigue, soreness, stress, mood).
        </Text>
        {entriesLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>Még nincs kitöltött wellness bejegyzés.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colEmail]} numberOfLines={1}>Játékos</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colDate]}>Dátum</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colTime]}>Fekvés</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colTime]}>Kelés</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Óra</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Minőség</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Fatigue</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Soreness</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Stress</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.colNum]}>Mood</Text>
            </View>
            {entries.map((r) => (
              <View key={r.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colEmail]} numberOfLines={1}>{emailByUserId[r.user_id] ?? r.user_id}</Text>
                <Text style={[styles.tableCell, styles.colDate]}>{r.date}</Text>
                <Text style={[styles.tableCell, styles.colTime]}>{r.bed_time ?? "—"}</Text>
                <Text style={[styles.tableCell, styles.colTime]}>{r.wake_time ?? "—"}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.sleep_duration != null ? `${r.sleep_duration}h` : "—"}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.sleep_quality ?? "—"}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.fatigue ?? "—"}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.soreness ?? "—"}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.stress ?? "—"}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{r.mood ?? "—"}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  const sleepHours = calcSleepHours(bedTime, wakeTime);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Napi wellness</Text>
      <View style={styles.form}>
        <Text style={styles.sliderLabel}>Mikor feküdt le</Text>
        <TextInput
          style={styles.timeInput}
          value={bedTime}
          onChangeText={setBedTime}
          placeholder="HH:mm"
          placeholderTextColor="#999"
        />
        <Text style={styles.sliderLabel}>Mikor kelt fel</Text>
        <TextInput
          style={styles.timeInput}
          value={wakeTime}
          onChangeText={setWakeTime}
          placeholder="HH:mm"
          placeholderTextColor="#999"
        />
        {sleepHours !== null && (
          <Text style={styles.sleepHours}>Alvás: {sleepHours.toFixed(1)} óra</Text>
        )}
        <SliderRow label="Alvás minőség (1–10)" value={sleepQuality} onChange={setSleepQuality} />
        <SliderRow label="Fáradtság" value={fatigue} onChange={setFatigue} />
        <SliderRow label="Fájdalom" value={soreness} onChange={setSoreness} />
        <SliderRow label="Stressz" value={stress} onChange={setStress} />
        <SliderRow label="Hangulat" value={mood} onChange={setMood} />
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
          <Text style={styles.buttonText}>Küldés</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Korábbi bejegyzések</Text>
      {entriesLoading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.list}>
          {entries.length === 0 ? (
            <Text style={styles.empty}>Még nincs bejegyzés.</Text>
          ) : (
            entries.map((e) => (
              <View key={e.id} style={styles.row}>
                <Text style={styles.date}>{e.date}</Text>
                <Text style={styles.values}>
                  {e.bed_time ?? "—"} → {e.wake_time ?? "—"}
                  {e.sleep_duration != null ? ` (${e.sleep_duration}h)` : ""} · minőség {e.sleep_quality ?? "—"} · fáradtság {e.fatigue ?? "—"} · hangulat {e.mood ?? "—"}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderControls}>
        <TouchableOpacity
          style={styles.sliderBtn}
          onPress={() => onChange(Math.max(SCALE_MIN, value - 1))}
        >
          <Text>-</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.sliderInput}
          value={String(value)}
          onChangeText={(t) => {
            const n = parseInt(t, 10);
            if (!isNaN(n)) onChange(Math.min(SCALE_MAX, Math.max(SCALE_MIN, n)));
          }}
          keyboardType="number-pad"
        />
        <TouchableOpacity
          style={styles.sliderBtn}
          onPress={() => onChange(Math.min(SCALE_MAX, value + 1))}
        >
          <Text>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },
  content: { padding: 24, paddingBottom: 48 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 16 },
  form: { marginBottom: 16 },
  sliderRow: { marginBottom: 16 },
  sliderLabel: { fontSize: 14, marginBottom: 4 },
  sliderControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  sliderBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  sliderInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    width: 48,
    textAlign: "center",
    fontSize: 16,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  sleepHours: { fontSize: 14, color: "#374151", marginBottom: 12 },
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
  row: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  date: { fontWeight: "600", marginBottom: 4 },
  values: { fontSize: 14, color: "#666" },
  empty: { color: "#666", fontStyle: "italic" },
  table: { marginTop: 8 },
  tableRowHeader: { flexDirection: "row", backgroundColor: "#e5e7eb", paddingVertical: 10, paddingHorizontal: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  tableRow: { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  tableCell: { fontSize: 12 },
  tableHeader: { fontWeight: "600", color: "#374151" },
  colEmail: { flex: 1.2, marginRight: 4 },
  colDate: { width: 72, marginRight: 4 },
  colTime: { width: 48, marginRight: 2 },
  colNum: { width: 36, textAlign: "center" },
});

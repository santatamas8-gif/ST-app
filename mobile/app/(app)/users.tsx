/**
 * Admin only: list users (profiles). Styled like web Users page.
 * SafeAreaView + horizontal padding so content is not cut off on edges.
 */

import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getProfiles } from "@/repositories/usersRepository";
import { useAuth } from "@/context/AuthContext";
import type { ProfileRow } from "@/repositories/usersRepository";

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://yourapp.vercel.app";
const GREEN = "#1eb871";
const CARD_BG = "#27272a";
const PAGE_BG = "#18181b";
const BORDER = "#3f3f46";
const TEXT_WHITE = "#ffffff";
const TEXT_MUTED = "#a1a1aa";

type RoleFilter = "all" | "admin" | "staff" | "player";

export default function UsersScreen() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    getProfiles().then(({ data, error: err }) => {
      setLoading(false);
      if (err) setError(err);
      else if (data) setProfiles(data);
    });
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = profiles;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.email ?? "").toLowerCase().includes(q) ||
          (p.full_name ?? "").toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") {
      list = list.filter((p) => (p.role ?? "") === roleFilter);
    }
    return list;
  }, [profiles, search, roleFilter]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={[styles.container, styles.centered, styles.padded]}>
          <Text style={styles.forbidden}>Only admin can view Users.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>
            Create staff and player accounts. All UI in English.
          </Text>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email"
            placeholderTextColor={TEXT_MUTED}
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleChip, roleFilter === "all" && styles.roleChipActive]}
              onPress={() => setRoleFilter("all")}
            >
              <Text style={[styles.roleChipText, roleFilter === "all" && styles.roleChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleChip, roleFilter === "admin" && styles.roleChipActive]}
              onPress={() => setRoleFilter("admin")}
            >
              <Text style={[styles.roleChipText, roleFilter === "admin" && styles.roleChipTextActive]}>
                Admin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleChip, roleFilter === "staff" && styles.roleChipActive]}
              onPress={() => setRoleFilter("staff")}
            >
              <Text style={[styles.roleChipText, roleFilter === "staff" && styles.roleChipTextActive]}>
                Staff
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleChip, roleFilter === "player" && styles.roleChipActive]}
              onPress={() => setRoleFilter("player")}
            >
              <Text style={[styles.roleChipText, roleFilter === "player" && styles.roleChipTextActive]}>
                Player
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => Linking.openURL(`${WEB_APP_URL}/admin/users`)}
          >
            <Text style={styles.createButtonText}>Create user (web)</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : loading ? (
          <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 24 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>
            {profiles.length === 0 ? "No users yet." : "No users match the filters."}
          </Text>
        ) : (
          <View style={styles.list}>
            {filtered.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Ionicons name="person-outline" size={16} color={TEXT_MUTED} />
                  <Text style={styles.cardName} numberOfLines={1}>
                    {p.full_name || "—"}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="mail-outline" size={16} color={TEXT_MUTED} />
                  <Text style={styles.cardEmail} numberOfLines={1}>
                    {p.email ?? "—"}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="person-circle-outline" size={16} color={TEXT_MUTED} />
                  <Text style={styles.cardRole}>{(p.role ?? "—").toLowerCase()}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="calendar-outline" size={16} color={TEXT_MUTED} />
                  <Text style={styles.cardDate}>
                    {p.created_at
                      ? new Date(p.created_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: Platform.OS === "ios" ? 32 : 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  padded: {
    paddingHorizontal: 16,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  forbidden: {
    fontSize: 16,
    color: TEXT_MUTED,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_WHITE,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  toolbar: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: "#3f3f46",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_WHITE,
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#3f3f46",
  },
  roleChipActive: {
    backgroundColor: GREEN,
  },
  roleChipText: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: "500",
  },
  roleChipTextActive: {
    color: TEXT_WHITE,
  },
  createButton: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  createButtonText: {
    color: TEXT_WHITE,
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: "#f87171",
    fontSize: 14,
    marginBottom: 12,
  },
  empty: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 24,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_WHITE,
    flex: 1,
  },
  cardEmail: {
    fontSize: 14,
    color: TEXT_MUTED,
    flex: 1,
  },
  cardRole: {
    fontSize: 13,
    color: TEXT_MUTED,
    textTransform: "capitalize",
  },
  cardDate: {
    fontSize: 12,
    color: "#71717a",
  },
});

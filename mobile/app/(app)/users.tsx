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
const BORDER_LIGHT = "#52525b";
const TEXT_WHITE = "#ffffff";
const TEXT_MUTED = "#a1a1aa";
const TEXT_DIM = "#71717a";

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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerLogo}>ST – AMS</Text>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>
            Create staff and player accounts. All UI in English.
          </Text>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={TEXT_DIM} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email"
              placeholderTextColor={TEXT_DIM}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.roleRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.roleChip, roleFilter === "all" && styles.roleChipActive]}
              onPress={() => setRoleFilter("all")}
            >
              <Text style={[styles.roleChipText, roleFilter === "all" && styles.roleChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.roleChip, roleFilter === "admin" && styles.roleChipActive]}
              onPress={() => setRoleFilter("admin")}
            >
              <Text style={[styles.roleChipText, roleFilter === "admin" && styles.roleChipTextActive]}>
                Admin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.roleChip, roleFilter === "staff" && styles.roleChipActive]}
              onPress={() => setRoleFilter("staff")}
            >
              <Text style={[styles.roleChipText, roleFilter === "staff" && styles.roleChipTextActive]}>
                Staff
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.roleChip, roleFilter === "player" && styles.roleChipActive]}
              onPress={() => setRoleFilter("player")}
            >
              <Text style={[styles.roleChipText, roleFilter === "player" && styles.roleChipTextActive]}>
                Player
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.createButton}
            onPress={() => Linking.openURL(`${WEB_APP_URL}/admin/users`)}
          >
            <Text style={styles.createButtonText}>Create user (web)</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingText}>Loading users…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>
              {profiles.length === 0 ? "No users yet." : "No users match the filters."}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardIconWrap}>
                      <Ionicons name="person-outline" size={16} color={TEXT_MUTED} />
                    </View>
                    <Text style={styles.cardLabel}>Name</Text>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {p.full_name || "—"}
                    </Text>
                  </View>
                  <View style={styles.cardRow}>
                    <View style={styles.cardIconWrap}>
                      <Ionicons name="mail-outline" size={16} color={TEXT_MUTED} />
                    </View>
                    <Text style={styles.cardLabel}>Email</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>
                      {p.email ?? "—"}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardBottom}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardIconWrap}>
                      <Ionicons name="person-circle-outline" size={16} color={TEXT_MUTED} />
                    </View>
                    <Text style={styles.cardLabel}>Role</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.cardRole}>{(p.role ?? "—").toLowerCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRow}>
                    <View style={styles.cardIconWrap}>
                      <Ionicons name="calendar-outline" size={16} color={TEXT_MUTED} />
                    </View>
                    <Text style={styles.cardLabel}>Created at</Text>
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
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
  },
  padded: {
    paddingHorizontal: 18,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  forbidden: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    paddingBottom: 14,
    marginBottom: 14,
  },
  headerLogo: {
    fontSize: 12,
    fontWeight: "600",
    color: GREEN,
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_WHITE,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 6,
    lineHeight: 18,
  },
  toolbar: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    padding: 14,
    marginBottom: 18,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
    }),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3f3f46",
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_WHITE,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#3f3f46",
    borderWidth: 1,
    borderColor: "transparent",
  },
  roleChipActive: {
    backgroundColor: GREEN,
    borderColor: "rgba(30,184,113,0.5)",
  },
  roleChipText: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: "500",
  },
  roleChipTextActive: {
    color: TEXT_WHITE,
    fontWeight: "600",
  },
  createButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
      },
    }),
  },
  createButtonText: {
    color: TEXT_WHITE,
    fontSize: 15,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: "rgba(248,113,113,0.12)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    padding: 14,
    marginBottom: 16,
  },
  error: {
    color: "#f87171",
    fontSize: 14,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  emptyBox: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  empty: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(30,184,113,0.5)",
    ...Platform.select({
      android: { elevation: 1 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
    }),
  },
  cardTop: {
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    minHeight: 20,
  },
  cardIconWrap: {
    width: 28,
    height: 28,
    minWidth: 28,
    minHeight: 28,
    borderRadius: 8,
    backgroundColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: TEXT_DIM,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 38,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_WHITE,
    flex: 1,
  },
  cardEmail: {
    fontSize: 13,
    color: TEXT_MUTED,
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    marginVertical: 6,
  },
  cardBottom: {
    flexDirection: "column",
  },
  roleBadge: {
    backgroundColor: "rgba(30,184,113,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardRole: {
    fontSize: 12,
    color: GREEN,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  cardDate: {
    fontSize: 11,
    color: TEXT_DIM,
    flex: 1,
  },
});

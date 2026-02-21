import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function DashboardScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Üdv, {user?.email ?? "játékos"}!</Text>
      <Text style={styles.hint}>Használd az alul lévő tabokat a Wellness és RPE oldalakhoz.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f5f5f5",
  },
  welcome: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: "#666",
  },
});

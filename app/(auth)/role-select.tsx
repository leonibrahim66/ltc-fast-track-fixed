/**
 * Role Selection Screen
 *
 * Shown after the user taps "Get Started" on the Welcome Screen.
 * Displays all available roles as tappable cards; each card navigates
 * to the appropriate Login / Register page for that role.
 *
 * No gesture-based hidden admin access here — that lives exclusively
 * on the Welcome Screen.
 */
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useResponsive, getStaticResponsive } from "@/hooks/use-responsive";

// ── Role definitions ──────────────────────────────────────────────────────────

type RoleKey = "customer" | "carrier_driver" | "zone_manager" | "garbage_driver" | "recycler";

interface RoleCard {
  key: RoleKey;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  color: string;
  bgColor: string;
  route: string;
}

const ROLES: RoleCard[] = [
  {
    key: "customer",
    title: "Customer",
    subtitle: "Request garbage pickups and carrier services",
    icon: "person",
    color: "#1B8A4E",
    bgColor: "#C8E6C9",
    route: "/role-auth?role=customer",
  },
  {
    key: "carrier_driver",
    title: "Carrier Driver",
    subtitle: "Accept transport jobs for goods and cargo",
    icon: "local-shipping",
    color: "#1565C0",
    bgColor: "#B3D4F5",
    route: "/role-auth?role=carrier_driver",
  },
  {
    key: "zone_manager",
    title: "Zone Manager",
    subtitle: "Manage zones, drivers, and household subscriptions",
    icon: "manage-accounts",
    color: "#1B5E20",
    bgColor: "#B2DFDB",
    route: "/role-auth?role=zone_manager",
  },
  {
    key: "garbage_driver",
    title: "Garbage Collection Driver",
    subtitle: "Collect garbage from households in your assigned zone",
    icon: "delete",
    color: "#BF360C",
    bgColor: "#FFCCBC",
    route: "/role-auth?role=garbage_driver",
  },
  {
    key: "recycler",
    title: "Recycling Company",
    subtitle: "Manage recycling orders and materials",
    icon: "recycling",
    color: "#4527A0",
    bgColor: "#D1C4E9",
    route: "/role-auth?role=recycler",
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RoleSelectScreen() {
  const router = useRouter();
  const rs = useResponsive();

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: rs.sp(32) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View
          className="px-6"
          style={{ paddingTop: rs.sp(rs.isSmall ? 20 : 28), paddingBottom: rs.sp(rs.isSmall ? 16 : 24) }}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={rs.iconSize(22)} color="#687076" />
          </TouchableOpacity>

          <Text
            className="font-bold text-foreground"
            style={{ fontSize: rs.fs(rs.isSmall ? 24 : 30), marginTop: rs.sp(12), marginBottom: rs.sp(6) }}
          >
            Who are you?
          </Text>
          <Text
            className="text-muted"
            style={{ fontSize: rs.fs(rs.isSmall ? 14 : 16), lineHeight: rs.fs(rs.isSmall ? 14 : 16) * 1.5 }}
          >
            Select your role to continue to login or registration.
          </Text>
        </View>

        {/* ── Role cards ──────────────────────────────────────────────────── */}
        <View className="px-6" style={{ gap: rs.sp(rs.isSmall ? 10 : 14) }}>
          {ROLES.map((role) => (
            <RoleCardItem
              key={role.key}
              role={role}
              rs={rs}
              onPress={() => router.push(role.route as any)}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Role Card Component ───────────────────────────────────────────────────────

function RoleCardItem({
  role,
  rs,
  onPress,
}: {
  role: RoleCard;
  rs: ReturnType<typeof import("@/hooks/use-responsive").useResponsive>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        styles.card,
        {
          padding: rs.sp(rs.isSmall ? 14 : 18),
          borderRadius: rs.s(16),
        },
      ]}
    >
      {/* Icon badge */}
      <View
        style={[
          styles.iconBadge,
          {
            backgroundColor: role.bgColor,
            width: rs.s(rs.isSmall ? 44 : 52),
            height: rs.s(rs.isSmall ? 44 : 52),
            borderRadius: rs.s(rs.isSmall ? 12 : 14),
            marginRight: rs.sp(14),
          },
        ]}
      >
        <MaterialIcons
          name={role.icon}
          size={rs.iconSize(rs.isSmall ? 22 : 26)}
          color={role.color}
        />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: rs.fs(rs.isSmall ? 15 : 17),
            marginBottom: rs.sp(3),
            fontWeight: "700",
            color: "#1A2E1A",
          }}
          numberOfLines={1}
        >
          {role.title}
        </Text>
        <Text
          style={{
            fontSize: rs.fs(rs.isSmall ? 12 : 13),
            lineHeight: rs.fs(rs.isSmall ? 12 : 13) * 1.5,
            fontWeight: "500",
            color: "#37474F",
          }}
          numberOfLines={2}
        >
          {role.subtitle}
        </Text>
      </View>

      {/* Chevron */}
      <MaterialIcons
        name="chevron-right"
        size={rs.iconSize(22)}
        color="#9BA1A6"
        style={{ marginLeft: rs.sp(8) }}
      />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backBtn: {
    width: _rs.s(36),
    height: _rs.s(36),
    borderRadius: _rs.s(18),
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2F1",
    borderWidth: 1,
    borderColor: "#B2DFDB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  iconBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
});

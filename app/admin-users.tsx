import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
} from "react-native";
import {useRouter, useLocalSearchParams, useFocusEffect} from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { User } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { StorageEventBus, STORAGE_KEYS as BUS_KEYS } from "@/lib/storage-event-bus";

type RoleFilter = "all" | "residential" | "commercial" | "industrial" | "collector" | "zone_manager" | "recycler" | "garbage_driver";
type ZoneFilter = "all" | "assigned" | "unassigned";
type ViewMode = "list" | "hierarchy";

export default function AdminUsersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAdminAuthenticated } = useAdmin();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(
    (params.filter as RoleFilter) || "all"
  );
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Derived province/city lists from customer data
  const provinces = ["all", ...Array.from(new Set(users.filter(u => u.province).map(u => u.province as string))).sort()];
  const cities = ["all", ...Array.from(new Set(
    users.filter(u => u.city && (provinceFilter === "all" || u.province === provinceFilter)).map(u => u.city as string)
  )).sort()];

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    loadUsers();
  }, [isAdminAuthenticated]);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter, provinceFilter, cityFilter, zoneFilter]);

  const loadUsers = async () => {
    try {
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      if (usersDb) {
        const parsed = JSON.parse(usersDb);
        const usersList = Object.values(parsed) as User[];
        setUsers(usersList);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = useCallback(() => {
    let filtered = [...users];

    if (roleFilter !== "all") {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }
    if (provinceFilter !== "all") {
      filtered = filtered.filter((u) => u.province === provinceFilter);
    }
    if (cityFilter !== "all") {
      filtered = filtered.filter((u) => u.city === cityFilter);
    }
    if (zoneFilter === "assigned") {
      filtered = filtered.filter((u) => u.assignedZoneId || u.zoneId);
    } else if (zoneFilter === "unassigned") {
      filtered = filtered.filter((u) => !u.assignedZoneId && !u.zoneId && (u.role === "residential" || u.role === "commercial" || u.role === "industrial"));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(query) ||
          u.phone?.toLowerCase().includes(query) ||
          u.province?.toLowerCase().includes(query) ||
          u.city?.toLowerCase().includes(query) ||
          u.areaName?.toLowerCase().includes(query) ||
          u.id?.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter, provinceFilter, cityFilter, zoneFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "residential":
        return { bg: "bg-blue-500/10", text: "text-blue-500", color: "#3B82F6" };
      case "commercial":
        return { bg: "bg-purple-500/10", text: "text-purple-500", color: "#8B5CF6" };
      case "industrial":
        return { bg: "bg-orange-500/10", text: "text-orange-500", color: "#F97316" };
      case "collector":
      case "zone_manager":
        return { bg: "bg-success/10", text: "text-success", color: "#22C55E" };
      case "recycler":
        return { bg: "bg-warning/10", text: "text-warning", color: "#F59E0B" };
      case "garbage_driver":
        return { bg: "bg-teal-500/10", text: "text-teal-500", color: "#14B8A6" };
      default:
        return { bg: "bg-muted/10", text: "text-muted", color: "#687076" };
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "residential": return "home";
      case "commercial": return "business";
      case "industrial": return "factory";
      case "zone_manager": return "manage-accounts";
      case "collector": return "recycling";
      case "recycler": return "eco";
      case "garbage_driver": return "local-shipping";
      default: return "person";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "residential": return "Residential";
      case "commercial": return "Commercial";
      case "industrial": return "Industrial";
      case "zone_manager": return "Zone Manager";
      case "collector": return "Zone Manager (Legacy)";
      case "recycler": return "Recycler";
      case "garbage_driver": return "Garbage Driver";
      default: return role;
    }
  };

  // Zone assignment modal state
  const [zoneModalUser, setZoneModalUser] = useState<User | null>(null);
  const [availableZones, setAvailableZones] = useState<{ id: string; name: string; city?: string }[]>([]);
  const [assigningZone, setAssigningZone] = useState(false);

  const openZoneModal = async (targetUser: User) => {
    setZoneModalUser(targetUser);
    try {
      const raw = await AsyncStorage.getItem("@ltc_zones");
      const zones: { id: string; name: string; city?: string }[] = raw ? JSON.parse(raw) : [];
      setAvailableZones(zones.filter((z: any) => z.status !== "inactive"));
    } catch (_e) {
      setAvailableZones([]);
    }
  };

  const handleAssignZone = (targetUser: User) => {
    openZoneModal(targetUser);
  };

  const confirmZoneAssignment = async (zoneId: string, zoneName: string) => {
    if (!zoneModalUser) return;
    setAssigningZone(true);
    try {
      const raw = await AsyncStorage.getItem("@ltc_users_db");
      const allUsers: Record<string, any> = raw ? JSON.parse(raw) : {};
      if (allUsers[zoneModalUser.id]) {
        allUsers[zoneModalUser.id] = { ...allUsers[zoneModalUser.id], assignedZoneId: zoneId, zoneId, assignedZoneName: zoneName };
      }
      await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(allUsers));
      StorageEventBus.emit(BUS_KEYS.USERS_DB);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setZoneModalUser(null);
      await loadUsers();
      Alert.alert("Zone Assigned", `${zoneModalUser.fullName || zoneModalUser.phone} has been assigned to ${zoneName}.`);
    } catch (_e) {
      Alert.alert("Error", "Failed to assign zone. Please try again.");
    } finally {
      setAssigningZone(false);
    }
  };

  const handleRemoveZone = async (targetUser: User) => {
    Alert.alert(
      "Remove Zone Assignment",
      `Remove zone assignment from ${targetUser.fullName || targetUser.phone}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem("@ltc_users_db");
              const allUsers: Record<string, any> = raw ? JSON.parse(raw) : {};
              if (allUsers[targetUser.id]) {
                const { assignedZoneId: _a, zoneId: _z, assignedZoneName: _n, ...rest } = allUsers[targetUser.id];
                allUsers[targetUser.id] = rest;
              }
              await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(allUsers));
              StorageEventBus.emit(BUS_KEYS.USERS_DB);
              await loadUsers();
            } catch (_e) {
              Alert.alert("Error", "Failed to remove zone assignment.");
            }
          },
        },
      ]
    );
  };

  const roleFilters: { id: RoleFilter; label: string }[] = [
    { id: "all", label: "All Users" },
    { id: "residential", label: "Residential" },
    { id: "commercial", label: "Commercial" },
    { id: "industrial", label: "Industrial" },
    { id: "zone_manager", label: "Zone Managers" },
    { id: "garbage_driver", label: "Drivers" },
    { id: "recycler", label: "Recyclers" },
  ];

  // Build hierarchical structure: Province → City → Zone → Customers
  const buildHierarchy = () => {
    const customers = filteredUsers.filter(u =>
      u.role === "residential" || u.role === "commercial" || u.role === "industrial"
    );
    const hierarchy: Record<string, Record<string, User[]>> = {};
    customers.forEach(u => {
      const prov = u.province || "Unknown Province";
      const city = u.city || "Unknown City";
      if (!hierarchy[prov]) hierarchy[prov] = {};
      if (!hierarchy[prov][city]) hierarchy[prov][city] = [];
      hierarchy[prov][city].push(u);
    });
    return hierarchy;
  };

  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  const renderUserCard = ({ item }: { item: User }) => {
    const roleStyle = getRoleColor(item.role);
    const roleIcon = getRoleIcon(item.role);
    const isCustomer = item.role === "residential" || item.role === "commercial" || item.role === "industrial";
    const isDriver = item.role === "garbage_driver";
    const needsZone = isCustomer || isDriver;
    const hasZone = !!(item.assignedZoneId || item.zoneId);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/admin-user-detail?id=${item.id}` as any)}
        style={{ backgroundColor: "#1e2022", borderRadius: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: "#334155" }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${roleStyle.color}20`, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <MaterialIcons name={roleIcon as any} size={24} color={roleStyle.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#ECEDEE", fontWeight: "700", fontSize: 15 }}>{item.fullName || "Unknown"}</Text>
            <Text style={{ color: "#9BA1A6", fontSize: 13, marginTop: 2 }}>{item.phone}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: `${roleStyle.color}20` }}>
                <Text style={{ color: roleStyle.color, fontSize: 11, fontWeight: "600" }}>{getRoleLabel(item.role)}</Text>
              </View>
              {needsZone && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: hasZone ? "#22C55E20" : "#EF444420" }}>
                  <Text style={{ color: hasZone ? "#22C55E" : "#EF4444", fontSize: 11, fontWeight: "600" }}>
                    {hasZone ? (item.assignedZoneName || "Zone Assigned") : (isDriver ? "No Zone" : "Unassigned")}
                  </Text>
                </View>
              )}
            </View>
            {/* Location info for customers */}
            {isCustomer && (item.province || item.city || item.areaName) && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}>
                <MaterialIcons name="location-on" size={13} color="#9BA1A6" />
                <Text style={{ color: "#9BA1A6", fontSize: 12 }} numberOfLines={1}>
                  {[item.areaName, item.city, item.province].filter(Boolean).join(", ")}
                </Text>
              </View>
            )}
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            {needsZone && (
              <TouchableOpacity
                onPress={() => handleAssignZone(item)}
                style={{ backgroundColor: hasZone ? "#22C55E20" : "#EF444420", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text style={{ color: hasZone ? "#22C55E" : "#EF4444", fontSize: 11, fontWeight: "600" }}>
                  {hasZone ? "Reassign" : "Assign Zone"}
                </Text>
              </TouchableOpacity>
            )}
            <MaterialIcons name="chevron-right" size={20} color="#687076" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const unassignedCount = users.filter(u =>
    (u.role === "residential" || u.role === "commercial" || u.role === "industrial") &&
    !u.assignedZoneId && !u.zoneId
  ).length;

  const hierarchy = viewMode === "hierarchy" ? buildHierarchy() : {};

  return (
    <ScreenContainer>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickyHeaderIndices={[0]}
      >
        {/* Header */}
        <View style={{ backgroundColor: "#151718", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
            </TouchableOpacity>
            <Text style={{ color: "#ECEDEE", fontSize: 20, fontWeight: "700", flex: 1 }}>User Management</Text>
            <TouchableOpacity
              onPress={() => setViewMode(viewMode === "list" ? "hierarchy" : "list")}
              style={{ backgroundColor: "#1e2022", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#334155" }}
            >
              <MaterialIcons name={viewMode === "list" ? "account-tree" : "list"} size={20} color="#9BA1A6" />
            </TouchableOpacity>
          </View>

          {/* Unassigned alert */}
          {unassignedCount > 0 && (
            <TouchableOpacity
              onPress={() => setZoneFilter("unassigned")}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#EF444415", borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#EF444430" }}
            >
              <MaterialIcons name="warning" size={16} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "600", marginLeft: 6, flex: 1 }}>
                {unassignedCount} customer{unassignedCount !== 1 ? "s" : ""} without zone assignment
              </Text>
              <MaterialIcons name="chevron-right" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}

          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1e2022", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "#334155", marginBottom: 10 }}>
            <MaterialIcons name="search" size={20} color="#687076" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search name, phone, area..."
              placeholderTextColor="#687076"
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: "#ECEDEE", fontSize: 14 }}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialIcons name="close" size={18} color="#687076" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Role filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {roleFilters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setRoleFilter(filter.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  marginRight: 8,
                  backgroundColor: roleFilter === filter.id ? "#0a7ea4" : "#1e2022",
                  borderWidth: 1,
                  borderColor: roleFilter === filter.id ? "#0a7ea4" : "#334155",
                }}
              >
                <Text style={{ color: roleFilter === filter.id ? "#fff" : "#9BA1A6", fontSize: 12, fontWeight: "600" }}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Location filters row */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            {/* Province */}
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => { setShowProvinceDropdown(!showProvinceDropdown); setShowCityDropdown(false); }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1e2022", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: provinceFilter !== "all" ? "#0a7ea4" : "#334155" }}
              >
                <Text style={{ color: provinceFilter !== "all" ? "#0a7ea4" : "#9BA1A6", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                  {provinceFilter === "all" ? "Province" : provinceFilter}
                </Text>
                <MaterialIcons name={showProvinceDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={16} color="#687076" />
              </TouchableOpacity>
              {showProvinceDropdown && (
                <View style={{ position: "absolute", top: 38, left: 0, right: 0, zIndex: 100, backgroundColor: "#1e2022", borderRadius: 10, borderWidth: 1, borderColor: "#334155", maxHeight: 180, overflow: "hidden" }}>
                  <ScrollView nestedScrollEnabled>
                    {provinces.map(p => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => { setProvinceFilter(p); setCityFilter("all"); setShowProvinceDropdown(false); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#334155", backgroundColor: provinceFilter === p ? "#0a7ea420" : "transparent" }}
                      >
                        <Text style={{ color: provinceFilter === p ? "#0a7ea4" : "#ECEDEE", fontSize: 13 }}>{p === "all" ? "All Provinces" : p}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* City */}
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => { setShowCityDropdown(!showCityDropdown); setShowProvinceDropdown(false); }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1e2022", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: cityFilter !== "all" ? "#0a7ea4" : "#334155" }}
              >
                <Text style={{ color: cityFilter !== "all" ? "#0a7ea4" : "#9BA1A6", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                  {cityFilter === "all" ? "City/Town" : cityFilter}
                </Text>
                <MaterialIcons name={showCityDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={16} color="#687076" />
              </TouchableOpacity>
              {showCityDropdown && (
                <View style={{ position: "absolute", top: 38, left: 0, right: 0, zIndex: 100, backgroundColor: "#1e2022", borderRadius: 10, borderWidth: 1, borderColor: "#334155", maxHeight: 180, overflow: "hidden" }}>
                  <ScrollView nestedScrollEnabled>
                    {cities.map(c => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => { setCityFilter(c); setShowCityDropdown(false); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#334155", backgroundColor: cityFilter === c ? "#0a7ea420" : "transparent" }}
                      >
                        <Text style={{ color: cityFilter === c ? "#0a7ea4" : "#ECEDEE", fontSize: 13 }}>{c === "all" ? "All Cities" : c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Zone filter */}
            <TouchableOpacity
              onPress={() => setZoneFilter(zoneFilter === "all" ? "unassigned" : zoneFilter === "unassigned" ? "assigned" : "all")}
              style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1e2022", borderWidth: 1, borderColor: zoneFilter !== "all" ? "#0a7ea4" : "#334155", justifyContent: "center" }}
            >
              <Text style={{ color: zoneFilter !== "all" ? "#0a7ea4" : "#9BA1A6", fontSize: 11, fontWeight: "600" }}>
                {zoneFilter === "all" ? "Zone: All" : zoneFilter === "assigned" ? "Assigned" : "Unassigned"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: "#9BA1A6", fontSize: 12 }}>{filteredUsers.length} users found</Text>
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ color: "#9BA1A6" }}>Loading users...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialIcons name="people-outline" size={48} color="#334155" />
              <Text style={{ color: "#9BA1A6", marginTop: 12, fontSize: 15 }}>No users found</Text>
              <Text style={{ color: "#687076", fontSize: 13, marginTop: 4 }}>Try adjusting your filters</Text>
            </View>
          ) : viewMode === "hierarchy" ? (
            // Hierarchical view: Province → City → Customers
            Object.entries(buildHierarchy()).map(([province, cities]) => (
              <View key={province} style={{ marginBottom: 20 }}>
                {/* Province header */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <MaterialIcons name="map" size={18} color="#0a7ea4" />
                  <Text style={{ color: "#0a7ea4", fontWeight: "700", fontSize: 16, marginLeft: 8 }}>{province}</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#0a7ea430", marginLeft: 10 }} />
                </View>
                {Object.entries(cities).map(([city, customers]) => (
                  <View key={city} style={{ marginLeft: 12, marginBottom: 12 }}>
                    {/* City header */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <MaterialIcons name="location-city" size={15} color="#9BA1A6" />
                      <Text style={{ color: "#9BA1A6", fontWeight: "600", fontSize: 13, marginLeft: 6 }}>
                        {city} ({customers.length})
                      </Text>
                    </View>
                    {customers.map(customer => (
                      <TouchableOpacity
                        key={customer.id}
                        onPress={() => router.push(`/admin-user-detail?id=${customer.id}` as any)}
                        style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 12, marginBottom: 8, marginLeft: 12, borderWidth: 1, borderColor: "#334155", flexDirection: "row", alignItems: "center" }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#ECEDEE", fontWeight: "600", fontSize: 14 }}>{customer.fullName || customer.phone}</Text>
                          <Text style={{ color: "#9BA1A6", fontSize: 12, marginTop: 2 }}>{customer.areaName || customer.fullAddress || "No area"}</Text>
                          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: `${getRoleColor(customer.role).color}20` }}>
                              <Text style={{ color: getRoleColor(customer.role).color, fontSize: 10, fontWeight: "600", textTransform: "capitalize" }}>{customer.areaType || customer.role}</Text>
                            </View>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: (customer.assignedZoneId || customer.zoneId) ? "#22C55E20" : "#EF444420" }}>
                              <Text style={{ color: (customer.assignedZoneId || customer.zoneId) ? "#22C55E" : "#EF4444", fontSize: 10, fontWeight: "600" }}>
                                {(customer.assignedZoneId || customer.zoneId) ? "Zone Assigned" : "Unassigned"}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={18} color="#687076" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            ))
          ) : (
            <FlatList
              data={filteredUsers}
              renderItem={renderUserCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* ── Zone Assignment Modal ─────────────────────────────────────────── */}
      <Modal
        visible={!!zoneModalUser}
        transparent
        animationType="slide"
        onRequestClose={() => setZoneModalUser(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#1e2022", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: "#ECEDEE", fontSize: 18, fontWeight: "700" }}>Assign Zone</Text>
              <TouchableOpacity onPress={() => setZoneModalUser(null)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#9BA1A6", fontSize: 13, marginBottom: 16 }}>
              Assigning zone to: <Text style={{ color: "#ECEDEE", fontWeight: "600" }}>{zoneModalUser?.fullName || zoneModalUser?.phone}</Text>
            </Text>
            {availableZones.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <MaterialIcons name="location-off" size={40} color="#9BA1A6" />
                <Text style={{ color: "#9BA1A6", marginTop: 12, textAlign: "center" }}>
                  No zones found. Create zones in Zone Management first.
                </Text>
                <TouchableOpacity
                  onPress={() => { setZoneModalUser(null); router.push("/zone-list" as any); }}
                  style={{ marginTop: 16, backgroundColor: "#0a7ea4", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Go to Zone Management</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {availableZones.map((zone) => (
                  <TouchableOpacity
                    key={zone.id}
                    onPress={() => confirmZoneAssignment(zone.id, zone.name)}
                    disabled={assigningZone}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: (zoneModalUser?.assignedZoneId === zone.id || zoneModalUser?.zoneId === zone.id) ? "#064E3B" : "#151718",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: (zoneModalUser?.assignedZoneId === zone.id || zoneModalUser?.zoneId === zone.id) ? "#22C55E" : "#334155",
                    }}
                  >
                    <MaterialIcons name="location-on" size={20} color="#22C55E" style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#ECEDEE", fontWeight: "600", fontSize: 15 }}>{zone.name}</Text>
                      {zone.city ? <Text style={{ color: "#9BA1A6", fontSize: 12, marginTop: 2 }}>{zone.city}</Text> : null}
                    </View>
                    {(zoneModalUser?.assignedZoneId === zone.id || zoneModalUser?.zoneId === zone.id) && (
                      <MaterialIcons name="check-circle" size={20} color="#22C55E" />
                    )}
                  </TouchableOpacity>
                ))}
                {/* Remove zone option */}
                {(zoneModalUser?.assignedZoneId || zoneModalUser?.zoneId) && (
                  <TouchableOpacity
                    onPress={() => { setZoneModalUser(null); if (zoneModalUser) handleRemoveZone(zoneModalUser); }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1a0a0a", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EF4444" }}
                  >
                    <MaterialIcons name="remove-circle-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                    <Text style={{ color: "#EF4444", fontWeight: "600" }}>Remove Zone Assignment</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

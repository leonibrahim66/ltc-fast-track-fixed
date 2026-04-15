import { useState, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { APP_CONFIG, USER_ROLES } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useITRealtime } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";
import { getStaticResponsive } from "@/hooks/use-responsive";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  COUNTRIES,
  getCountry,
  getProvinces,
  getCities,
  getTowns,
  type Country,
  type Province,
  type City,
  type Town,
} from "@/lib/country-data";
import {
  validatePhone,
  normalizePhone,
  phoneErrorMessage,
} from "@/lib/phone-utils";

type UserType = "residential" | "commercial";

// ─── Reusable Dropdown Picker ─────────────────────────────────────────────────

interface PickerOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface DropdownPickerProps {
  label: string;
  placeholder: string;
  value: string;
  options: PickerOption[];
  onSelect: (id: string, label: string) => void;
  disabled?: boolean;
  icon?: string;
}

function DropdownPicker({
  label,
  placeholder,
  value,
  options,
  onSelect,
  disabled = false,
  icon = "arrow-drop-down",
}: DropdownPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-foreground mb-2">{label}</Text>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        style={[
          styles.dropdownTrigger,
          disabled && styles.dropdownDisabled,
        ]}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Text
          style={[
            styles.dropdownText,
            !selected && styles.dropdownPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialIcons
          name={open ? "arrow-drop-up" : "arrow-drop-down"}
          size={24}
          color={disabled ? "#9CA3AF" : "#6B7280"}
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    item.id === value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item.id, item.label);
                    setOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.modalOptionText,
                        item.id === value && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={styles.modalOptionSublabel}>{item.sublabel}</Text>
                    ) : null}
                  </View>
                  {item.id === value && (
                    <MaterialIcons name="check" size={20} color="#22C55E" />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { addRegistration, addEvent } = useITRealtime();
  const { addNotification } = useAdmin();

  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<UserType>("residential");

  // Step 2: Personal details
  const [fullName, setFullName] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("ZMB");
  const [phoneLocal, setPhoneLocal] = useState(""); // digits after dial code
  const [phoneError, setPhoneError] = useState("");

  // Step 3: Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 4: Location (dynamic dropdowns)
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedProvinceName, setSelectedProvinceName] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");
  const [selectedTownId, setSelectedTownId] = useState("");
  const [selectedTownName, setSelectedTownName] = useState("");
  const [locationAddress, setLocationAddress] = useState(""); // optional free-text

  // Step 5: Zone selection
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedZoneName, setSelectedZoneName] = useState("");
  const [availableZones, setAvailableZones] = useState<
    { id: string; name: string; town?: string; province?: string }[]
  >([]);
  const [zonesLoading, setZonesLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Derived values
  const country = getCountry(selectedCountryCode);
  const provinces = getProvinces(selectedCountryCode);
  const cities = selectedProvinceId ? getCities(selectedCountryCode, selectedProvinceId) : [];
  const towns = selectedCityId ? getTowns(selectedCountryCode, selectedCityId) : [];

  const fullPhone = phoneLocal.trim()
    ? `${country.dialCode.replace("+", "")}${phoneLocal.trim()}`
    : "";

  const isPhoneValid = phoneLocal.trim().length > 0 && validatePhone(selectedCountryCode, fullPhone);

  // Load zones from AsyncStorage on mount
  useEffect(() => {
    const loadZones = async () => {
      setZonesLoading(true);
      try {
        const raw = await AsyncStorage.getItem("@ltc_zones");
        if (raw) {
          const stored: any[] = JSON.parse(raw);
          const active = stored.filter((z) => z.status !== "inactive" && z.id && z.name);
          if (active.length > 0) setAvailableZones(active);
        }
      } catch (_e) {
        // ignore
      } finally {
        setZonesLoading(false);
      }
    };
    loadZones();
  }, []);

  // Reset province/city/town when country changes
  const handleCountryChange = (code: string) => {
    setSelectedCountryCode(code);
    setPhoneLocal("");
    setPhoneError("");
    setSelectedProvinceId("");
    setSelectedProvinceName("");
    setSelectedCityId("");
    setSelectedCityName("");
    setSelectedTownId("");
    setSelectedTownName("");
  };

  // Reset city/town when province changes
  const handleProvinceChange = (id: string, name: string) => {
    setSelectedProvinceId(id);
    setSelectedProvinceName(name);
    setSelectedCityId("");
    setSelectedCityName("");
    setSelectedTownId("");
    setSelectedTownName("");
  };

  // Reset town when city changes
  const handleCityChange = (id: string, name: string) => {
    setSelectedCityId(id);
    setSelectedCityName(name);
    setSelectedTownId("");
    setSelectedTownName("");
  };

  // Filter zones by province/city keywords
  const filteredZones = (() => {
    const keywords = [selectedProvinceName, selectedCityName, selectedTownName, locationAddress]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((w) => w.length > 2);
    if (keywords.length === 0) return availableZones;
    const matched = availableZones.filter((z) => {
      const haystack = [z.name, z.town, z.province]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return keywords.some((kw) => haystack.includes(kw));
    });
    return matched.length > 0 ? matched : availableZones;
  })();
  const isFiltered = filteredZones.length < availableZones.length;

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!fullName.trim()) {
        Alert.alert("Error", "Please enter your full name");
        return;
      }
      if (!phoneLocal.trim()) {
        Alert.alert("Error", "Please enter your phone number");
        return;
      }
      if (!isPhoneValid) {
        Alert.alert("Invalid Phone", phoneErrorMessage(selectedCountryCode));
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!password.trim()) {
        Alert.alert("Error", "Please enter a password");
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }
      if (password.length < 4) {
        Alert.alert("Error", "Password must be at least 4 characters");
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (!selectedProvinceId) {
        Alert.alert("Error", `Please select a ${country.code === "TZA" ? "region" : "province"}`);
        return;
      }
      if (!selectedCityId) {
        Alert.alert("Error", "Please select a city");
        return;
      }
      setStep(5);
    }
  };

  const handleRegister = async () => {
    if (!selectedZoneId) {
      Alert.alert("Error", "Please select your collection zone");
      return;
    }
    setIsLoading(true);
    try {
      const normalizedPhone = normalizePhone(selectedCountryCode, fullPhone);
      const fullAddress = [selectedProvinceName, selectedCityName, selectedTownName, locationAddress]
        .filter(Boolean)
        .join(", ");

      const success = await register({
        fullName: fullName.trim(),
        phone: normalizedPhone,
        password,
        role: userType,
        location: {
          latitude: -15.4167,
          longitude: 28.2833,
          address: fullAddress,
        },
        // Country + location fields
        country: selectedCountryCode,
        province: selectedProvinceName,
        provinceId: selectedProvinceId,
        city: selectedCityName,
        cityId: selectedCityId,
        town: selectedTownName || undefined,
        townId: selectedTownId || undefined,
        fullAddress,
        assignedZoneId: selectedZoneId,
        zoneId: selectedZoneId,
        assignedZoneName: selectedZoneName,
      } as any);

      if (success) {
        addRegistration({
          fullName: fullName.trim(),
          phone: normalizedPhone,
          role: userType,
          location: fullAddress,
          verified: false,
        });
        addEvent({
          type: "new_registration",
          title: "New User Registration",
          description: `${fullName.trim()} (${userType}) registered from ${country.name}`,
          data: { userName: fullName.trim(), phone: normalizedPhone, userRole: userType },
          priority: "medium",
        });
        addNotification({
          type: "user",
          title: "New Registration",
          message: `${fullName.trim()} registered as ${userType} user (${country.flag} ${country.name})`,
        });
        Alert.alert(
          "Registration Successful",
          "Welcome to LTC FAST TRACK! You can now request garbage pickups.",
          [{ text: "Continue", onPress: () => router.replace("/(tabs)") }]
        );
      } else {
        Alert.alert("Registration Failed", "Phone number already registered. Please login instead.");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  // ─── Province / Region label ────────────────────────────────────────────────
  const provinceLabel = selectedCountryCode === "TZA" ? "Region" : "Province";

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-8">
            {/* Back Button */}
            <TouchableOpacity onPress={handleBack} className="mb-6" style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>

            {/* Progress Indicator (6 steps) */}
            <View className="flex-row mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <View
                  key={s}
                  className={`flex-1 h-1 rounded-full mx-1 ${s <= step ? "bg-primary" : "bg-border"}`}
                />
              ))}
            </View>

            {/* ── Step 1: Account Type ─────────────────────────────────────── */}
            {step === 1 && (
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground mb-2">Account Type</Text>
                <Text className="text-base text-muted mb-8">
                  Select the type of account you want to create
                </Text>

                {(["residential", "commercial"] as UserType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setUserType(type)}
                    className={`p-6 rounded-2xl mb-4 border-2 ${
                      userType === type ? "border-primary bg-surface" : "border-border bg-background"
                    }`}
                  >
                    <View className="flex-row items-center">
                      <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-4">
                        <MaterialIcons
                          name={type === "residential" ? "home" : "business"}
                          size={24}
                          color="#22C55E"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-foreground capitalize">{type}</Text>
                        <Text className="text-sm text-muted">
                          {type === "residential" ? "For homes and households" : "For businesses and companies"}
                        </Text>
                      </View>
                      {userType === type && (
                        <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                <View className="flex-1" />
                <TouchableOpacity
                  onPress={handleNext}
                  className="bg-primary py-4 rounded-full mb-4"
                  style={styles.button}
                >
                  <Text className="text-white text-center text-lg font-semibold">Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 2: Personal Details + Country + Phone ───────────────── */}
            {step === 2 && (
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground mb-2">Personal Details</Text>
                <Text className="text-base text-muted mb-6">Enter your personal information</Text>

                {/* Full Name */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Full Name</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="person" size={20} color="#6B7280" />
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter your full name"
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Country Selector */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Country</Text>
                  <View className="flex-row gap-3">
                    {COUNTRIES.map((c) => (
                      <TouchableOpacity
                        key={c.code}
                        onPress={() => handleCountryChange(c.code)}
                        style={[
                          styles.countryCard,
                          selectedCountryCode === c.code && styles.countryCardSelected,
                        ]}
                      >
                        <Text style={styles.countryFlag}>{c.flag}</Text>
                        <Text
                          style={[
                            styles.countryName,
                            selectedCountryCode === c.code && styles.countryNameSelected,
                          ]}
                        >
                          {c.name}
                        </Text>
                        {selectedCountryCode === c.code && (
                          <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Phone Number with locked prefix */}
                <View className="mb-1">
                  <Text className="text-sm font-medium text-foreground mb-2">Phone Number</Text>
                  <View
                    style={[
                      styles.phoneRow,
                      phoneError ? styles.phoneRowError : null,
                    ]}
                  >
                    {/* Locked dial code */}
                    <View style={styles.dialCodeBox}>
                      <Text style={styles.dialCodeText}>
                        {country.flag} {country.dialCode}
                      </Text>
                    </View>
                    <View style={styles.phoneDivider} />
                    <TextInput
                      value={phoneLocal}
                      onChangeText={(t) => {
                        // Strip any leading + or dial code the user might type
                        const clean = t.replace(/^\+/, "").replace(/^260/, "").replace(/^255/, "");
                        setPhoneLocal(clean);
                        setPhoneError("");
                      }}
                      placeholder={country.phonePlaceholder}
                      keyboardType="phone-pad"
                      style={styles.phoneInput}
                      placeholderTextColor="#9CA3AF"
                      returnKeyType="done"
                    />
                    {phoneLocal.length > 0 && (
                      <MaterialIcons
                        name={isPhoneValid ? "check-circle" : "cancel"}
                        size={20}
                        color={isPhoneValid ? "#22C55E" : "#EF4444"}
                        style={{ marginRight: 12 }}
                      />
                    )}
                  </View>
                </View>
                {phoneError ? (
                  <Text style={styles.errorText}>{phoneError}</Text>
                ) : (
                  <Text style={styles.hintText}>
                    {selectedCountryCode === "ZMB"
                      ? "MTN (096/076) · Airtel (097/077) · Zamtel (095/075)"
                      : "Vodacom (074/075/076) · Airtel (078) · Tigo (071/065) · Halotel (062)"}
                  </Text>
                )}

                <View className="flex-1" />
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={!fullName.trim() || !isPhoneValid}
                  className="bg-primary py-4 rounded-full mb-4 mt-6"
                  style={[styles.button, (!fullName.trim() || !isPhoneValid) && styles.buttonDisabled]}
                >
                  <Text className="text-white text-center text-lg font-semibold">Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 3: Password ─────────────────────────────────────────── */}
            {step === 3 && (
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground mb-2">Create Password</Text>
                <Text className="text-base text-muted mb-8">Choose a secure password</Text>

                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Password</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="lock" size={20} color="#6B7280" />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter password"
                      secureTextEntry={!showPassword}
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <MaterialIcons
                        name={showPassword ? "visibility-off" : "visibility"}
                        size={20}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Confirm Password</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="lock" size={20} color="#6B7280" />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm password"
                      secureTextEntry={!showPassword}
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View className="flex-1" />
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={!password || password !== confirmPassword || password.length < 4}
                  className="bg-primary py-4 rounded-full mb-4"
                  style={[
                    styles.button,
                    (!password || password !== confirmPassword || password.length < 4) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Text className="text-white text-center text-lg font-semibold">Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 4: Location Dropdowns ───────────────────────────────── */}
            {step === 4 && (
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground mb-2">Your Location</Text>
                <Text className="text-base text-muted mb-6">
                  Select your {provinceLabel.toLowerCase()}, city, and town
                </Text>

                {/* Province / Region */}
                <DropdownPicker
                  label={provinceLabel}
                  placeholder={`Select ${provinceLabel}`}
                  value={selectedProvinceId}
                  options={provinces.map((p) => ({ id: p.id, label: p.name }))}
                  onSelect={handleProvinceChange}
                />

                {/* City */}
                <DropdownPicker
                  label="City"
                  placeholder={selectedProvinceId ? "Select City" : `Select ${provinceLabel} first`}
                  value={selectedCityId}
                  options={cities.map((c) => ({ id: c.id, label: c.name }))}
                  onSelect={handleCityChange}
                  disabled={!selectedProvinceId}
                />

                {/* Town (optional) */}
                <DropdownPicker
                  label="Town / Area (optional)"
                  placeholder={selectedCityId ? "Select Town" : "Select City first"}
                  value={selectedTownId}
                  options={towns.map((t) => ({ id: t.id, label: t.name }))}
                  onSelect={(id, name) => {
                    setSelectedTownId(id);
                    setSelectedTownName(name);
                  }}
                  disabled={!selectedCityId || towns.length === 0}
                />

                {/* Optional free-text address */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">
                    Street / Plot (optional)
                  </Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="location-on" size={20} color="#6B7280" />
                    <TextInput
                      value={locationAddress}
                      onChangeText={setLocationAddress}
                      placeholder="e.g., Plot 123, Kabulonga Road"
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View className="flex-1" />
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={!selectedProvinceId || !selectedCityId}
                  className="bg-primary py-4 rounded-full mb-4"
                  style={[
                    styles.button,
                    (!selectedProvinceId || !selectedCityId) && styles.buttonDisabled,
                  ]}
                >
                  <Text className="text-white text-center text-lg font-semibold">Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 5: Zone Selection ───────────────────────────────────── */}
            {step === 5 && (
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground mb-2">Select Your Zone</Text>
                <Text className="text-base text-muted mb-6">
                  Choose the collection zone for your area.
                </Text>

                {zonesLoading ? (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#22C55E" size="large" />
                    <Text className="text-muted mt-3">Loading zones...</Text>
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    {isFiltered && (
                      <View style={styles.filterBanner}>
                        <MaterialIcons name="filter-list" size={16} color="#22C55E" />
                        <Text style={styles.filterBannerText}>
                          Showing zones near your location. Scroll for all options.
                        </Text>
                      </View>
                    )}
                    {filteredZones.length === 0 && (
                      <View style={{ alignItems: "center", paddingVertical: 32 }}>
                        <MaterialIcons name="location-off" size={48} color="#9BA1A6" />
                        <Text style={styles.emptyTitle}>No zones available yet</Text>
                        <Text style={styles.emptySubtitle}>
                          Your area has not been set up yet. Please contact support or try again later.
                        </Text>
                      </View>
                    )}
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                      {filteredZones.map((zone) => {
                        const isSelected = selectedZoneId === zone.id;
                        return (
                          <TouchableOpacity
                            key={zone.id}
                            onPress={() => {
                              setSelectedZoneId(zone.id);
                              setSelectedZoneName(zone.name);
                            }}
                            style={[styles.zoneCard, isSelected && styles.zoneCardSelected]}
                          >
                            <View style={[styles.zoneIcon, isSelected && styles.zoneIconSelected]}>
                              <MaterialIcons
                                name="location-on"
                                size={22}
                                color={isSelected ? "#22C55E" : "#6B7280"}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.zoneName, isSelected && styles.zoneNameSelected]}>
                                {zone.name}
                              </Text>
                              {(zone.town || zone.province) && (
                                <Text style={styles.zoneSubtitle}>
                                  {[zone.town, zone.province].filter(Boolean).join(", ")}
                                </Text>
                              )}
                            </View>
                            {isSelected && (
                              <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={isLoading || !selectedZoneId}
                  className="bg-primary py-4 rounded-full mb-4 mt-4"
                  style={[styles.button, (isLoading || !selectedZoneId) && styles.buttonDisabled]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-center text-lg font-semibold">
                      Create Account
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Login Link */}
            <View className="flex-row justify-center mb-4">
              <Text className="text-muted text-base">Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/role-auth?role=customer" as any)}>
                <Text className="text-primary font-semibold text-base">Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const _rs = getStaticResponsive();

const styles = StyleSheet.create({
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.5 },

  // Country cards
  countryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  countryCardSelected: {
    borderColor: "#22C55E",
    backgroundColor: "#E8F5E9",
  },
  countryFlag: { fontSize: 22 },
  countryName: { fontSize: 14, fontWeight: "600", color: "#374151", flex: 1 },
  countryNameSelected: { color: "#1A2E1A" },

  // Phone input
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
  },
  phoneRowError: { borderColor: "#EF4444" },
  dialCodeBox: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#EFEFEF",
  },
  dialCodeText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  phoneDivider: { width: 1, height: 24, backgroundColor: "#D1D5DB" },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: "#11181C",
  },
  errorText: { fontSize: 12, color: "#EF4444", marginTop: 4, marginBottom: 4 },
  hintText: { fontSize: 11, color: "#9BA1A6", marginTop: 4, marginBottom: 4 },

  // Dropdown
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownDisabled: { opacity: 0.5 },
  dropdownText: { flex: 1, fontSize: 15, color: "#11181C" },
  dropdownPlaceholder: { color: "#9CA3AF" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#11181C" },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  modalOptionSelected: { backgroundColor: "#F0FDF4" },
  modalOptionText: { fontSize: 15, color: "#374151" },
  modalOptionTextSelected: { fontWeight: "600", color: "#22C55E" },
  modalOptionSublabel: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  // Zone cards
  zoneCard: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  zoneCardSelected: { backgroundColor: "#E8F5E9", borderColor: "#22C55E" },
  zoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  zoneIconSelected: { backgroundColor: "#22C55E20" },
  zoneName: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  zoneNameSelected: { color: "#1A2E1A" },
  zoneSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  // Filter banner
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  filterBannerText: { fontSize: 12, color: "#22C55E", marginLeft: 6, flex: 1 },

  // Empty state
  emptyTitle: { color: "#9BA1A6", fontSize: 15, fontWeight: "600", marginTop: 12 },
  emptySubtitle: {
    color: "#9BA1A6",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 24,
  },
});

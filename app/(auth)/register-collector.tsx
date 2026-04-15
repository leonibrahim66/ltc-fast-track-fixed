/**
 * Zone Manager Registration
 *
 * Step 1 — Account Info: First Name, Last Name, Phone, Password, Confirm Password
 * Step 2 — Zone Application: Province → Town/City → Zone (dropdown hierarchy) + proposed zone name
 *
 * On submit:
 *   role = "zone_manager"
 *   status = "pending_review"
 *   kycStatus = "pending"
 *   zone_id = NULL (assigned by admin only)
 *
 * Dev mode: dashboard access is allowed even if status = "pending_review".
 */
import { useState } from "react";
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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
// ─── Zambia Province / Town / Zone Data ──────────────────────────────────────

const ZAMBIA_PROVINCES: { id: string; name: string }[] = [
  { id: "central", name: "Central" },
  { id: "copperbelt", name: "Copperbelt" },
  { id: "eastern", name: "Eastern" },
  { id: "luapula", name: "Luapula" },
  { id: "lusaka", name: "Lusaka" },
  { id: "muchinga", name: "Muchinga" },
  { id: "northern", name: "Northern" },
  { id: "north_western", name: "North-Western" },
  { id: "southern", name: "Southern" },
  { id: "western", name: "Western" },
];

const TOWNS_BY_PROVINCE: Record<string, { id: string; name: string }[]> = {
  central: [
    { id: "kabwe", name: "Kabwe" },
    { id: "kapiri_mposhi", name: "Kapiri Mposhi" },
    { id: "mkushi", name: "Mkushi" },
    { id: "serenje", name: "Serenje" },
    { id: "mumbwa", name: "Mumbwa" },
  ],
  copperbelt: [
    { id: "kitwe", name: "Kitwe" },
    { id: "ndola", name: "Ndola" },
    { id: "chingola", name: "Chingola" },
    { id: "mufulira", name: "Mufulira" },
    { id: "luanshya", name: "Luanshya" },
    { id: "kalulushi", name: "Kalulushi" },
    { id: "chililabombwe", name: "Chililabombwe" },
    { id: "konkola", name: "Konkola" },
  ],
  eastern: [
    { id: "chipata", name: "Chipata" },
    { id: "petauke", name: "Petauke" },
    { id: "lundazi", name: "Lundazi" },
    { id: "katete", name: "Katete" },
  ],
  luapula: [
    { id: "mansa", name: "Mansa" },
    { id: "nchelenge", name: "Nchelenge" },
    { id: "kawambwa", name: "Kawambwa" },
    { id: "samfya", name: "Samfya" },
  ],
  lusaka: [
    { id: "lusaka_cbd", name: "Lusaka CBD" },
    { id: "chilanga", name: "Chilanga" },
    { id: "kafue", name: "Kafue" },
    { id: "chongwe", name: "Chongwe" },
    { id: "luangwa", name: "Luangwa" },
  ],
  muchinga: [
    { id: "chinsali", name: "Chinsali" },
    { id: "mpika", name: "Mpika" },
    { id: "nakonde", name: "Nakonde" },
  ],
  northern: [
    { id: "kasama", name: "Kasama" },
    { id: "mbala", name: "Mbala" },
    { id: "mpulungu", name: "Mpulungu" },
    { id: "mungwi", name: "Mungwi" },
  ],
  north_western: [
    { id: "solwezi", name: "Solwezi" },
    { id: "kasempa", name: "Kasempa" },
    { id: "mwinilunga", name: "Mwinilunga" },
    { id: "zambezi", name: "Zambezi" },
  ],
  southern: [
    { id: "livingstone", name: "Livingstone" },
    { id: "choma", name: "Choma" },
    { id: "mazabuka", name: "Mazabuka" },
    { id: "monze", name: "Monze" },
    { id: "siavonga", name: "Siavonga" },
  ],
  western: [
    { id: "mongu", name: "Mongu" },
    { id: "kaoma", name: "Kaoma" },
    { id: "senanga", name: "Senanga" },
    { id: "sesheke", name: "Sesheke" },
  ],
};

const ZONES_BY_TOWN: Record<string, { id: string; name: string }[]> = {
  lusaka_cbd: [
    { id: "z_cbd_north", name: "CBD North Zone" },
    { id: "z_cbd_south", name: "CBD South Zone" },
    { id: "z_cairo_road", name: "Cairo Road Zone" },
    { id: "z_independence", name: "Independence Avenue Zone" },
  ],
  chilanga: [
    { id: "z_chilanga_central", name: "Chilanga Central Zone" },
    { id: "z_chilanga_south", name: "Chilanga South Zone" },
  ],
  kafue: [
    { id: "z_kafue_town", name: "Kafue Town Zone" },
    { id: "z_kafue_industrial", name: "Kafue Industrial Zone" },
  ],
  kitwe: [
    { id: "z_kitwe_central", name: "Kitwe Central Zone" },
    { id: "z_kitwe_south", name: "Kitwe South Zone" },
    { id: "z_nkana", name: "Nkana Zone" },
  ],
  ndola: [
    { id: "z_ndola_central", name: "Ndola Central Zone" },
    { id: "z_ndola_east", name: "Ndola East Zone" },
  ],
  chipata: [
    { id: "z_chipata_central", name: "Chipata Central Zone" },
    { id: "z_chipata_north", name: "Chipata North Zone" },
  ],
  livingstone: [
    { id: "z_livingstone_central", name: "Livingstone Central Zone" },
    { id: "z_livingstone_south", name: "Livingstone South Zone" },
  ],
  kabwe: [
    { id: "z_kabwe_central", name: "Kabwe Central Zone" },
    { id: "z_kabwe_north", name: "Kabwe North Zone" },
  ],
};

// ─── Dropdown Component ───────────────────────────────────────────────────────

interface DropdownOption {
  id: string;
  name: string;
}

interface DropdownProps {
  label: string;
  placeholder: string;
  value: string | null;
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  disabled?: boolean;
  icon?: string;
}

function Dropdown({
  label,
  placeholder,
  value,
  options,
  onSelect,
  disabled = false,
  icon = "expand-more",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.id === value);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.dropdownBtn,
          disabled && styles.dropdownDisabled,
        ]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Text
          style={[
            styles.dropdownText,
            !selectedOption && styles.dropdownPlaceholder,
          ]}
        >
          {selectedOption ? selectedOption.name : placeholder}
        </Text>
        <MaterialIcons
          name={icon as any}
          size={22}
          color={disabled ? "#9CA3AF" : "#1B5E20"}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{label}</Text>
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
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      item.id === value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.id === value && (
                    <MaterialIcons name="check" size={20} color="#1B5E20" />
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

// ─── Main Registration Screen ─────────────────────────────────────────────────

export default function RegisterZoneManagerScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 — Account Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2 — Zone Application
  const [selectedProvince, setSelectedProvince] = useState<DropdownOption | null>(null);
  const [selectedTown, setSelectedTown] = useState<DropdownOption | null>(null);
  const [selectedZone, setSelectedZone] = useState<DropdownOption | null>(null);
  const [proposedZoneName, setProposedZoneName] = useState("");

  const availableTowns = selectedProvince
    ? TOWNS_BY_PROVINCE[selectedProvince.id] ?? []
    : [];

  const availableZones = selectedTown
    ? ZONES_BY_TOWN[selectedTown.id] ?? []
    : [];

  const handleStep1Next = () => {
    if (!firstName.trim()) {
      Alert.alert("Required", "Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      Alert.alert("Required", "Please enter your last name.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Required", "Please enter your phone number.");
      return;
    }
    if (password.length < 4) {
      Alert.alert("Required", "Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setStep(2);
  };

  const handleRegister = async () => {
    if (!selectedProvince) {
      Alert.alert("Required", "Please select a province.");
      return;
    }
    if (!selectedTown) {
      Alert.alert("Required", "Please select a town/city.");
      return;
    }
    if (!selectedZone && !proposedZoneName.trim()) {
      Alert.alert(
        "Required",
        "Please select an existing zone or enter a proposed zone name."
      );
      return;
    }

    setIsLoading(true);
    try {
      const success = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim(),
        password,
        role: "zone_manager",
        status: "pending_review",
        kycStatus: "pending",
        provinceId: selectedProvince.id,
        townId: selectedTown.id,
        selectedZoneId: selectedZone?.id ?? undefined,
        proposedZoneName: proposedZoneName.trim() || undefined,
        // zone_id intentionally left NULL — assigned by admin only
        location: {
          latitude: -15.4167,
          longitude: 28.2833,
          address: `${selectedTown.name}, ${selectedProvince.name}, Zambia`,
        },
      });

      if (success) {
        Alert.alert(
          "Application Submitted!",
          "Your Zone Manager application has been received.\n\nDevelopment Mode: You can access the dashboard while your application is under review.",
          [
            {
              text: "Go to Dashboard",
              onPress: () => router.replace("/(collector)" as any),
            },
          ]
        );
      } else {
        Alert.alert(
          "Registration Failed",
          "This phone number is already registered. Please login instead."
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color="#11181C" />
            </TouchableOpacity>

            <View style={styles.headerBadge}>
              <MaterialIcons name="manage-accounts" size={26} color="#1B5E20" />
              <Text style={styles.headerBadgeText}>Zone Manager Portal</Text>
            </View>

            <Text style={styles.headerTitle}>
              {step === 1 ? "Create Account" : "Zone Application"}
            </Text>
            <Text style={styles.headerSub}>
              {step === 1
                ? "Enter your personal details"
                : "Select your target zone area"}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressRow}>
              <View
                style={[
                  styles.progressSegment,
                  { backgroundColor: step >= 1 ? "#1B5E20" : "#E5E7EB" },
                ]}
              />
              <View
                style={[
                  styles.progressSegment,
                  { backgroundColor: step >= 2 ? "#1B5E20" : "#E5E7EB" },
                ]}
              />
            </View>
            <Text style={styles.stepLabel}>
              Step {step} of 2
            </Text>
          </View>

          {/* ── Step 1: Account Info ────────────────────────────────────────── */}
          {step === 1 && (
            <View style={styles.formSection}>
              {/* First Name */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>First Name</Text>
                <View style={styles.inputRow}>
                  <MaterialIcons name="person" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter first name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Last Name */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Last Name</Text>
                <View style={styles.inputRow}>
                  <MaterialIcons name="person-outline" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter last name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Phone */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <View style={styles.inputRow}>
                  <MaterialIcons name="phone" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. 0960819993"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputRow}>
                  <MaterialIcons name="lock" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 4 characters"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                    <MaterialIcons
                      name={showPassword ? "visibility-off" : "visibility"}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <View style={styles.inputRow}>
                  <MaterialIcons name="lock-outline" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleStep1Next}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((v) => !v)}
                  >
                    <MaterialIcons
                      name={showConfirmPassword ? "visibility-off" : "visibility"}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Auto-set info note */}
              <View style={styles.infoBox}>
                <MaterialIcons name="info" size={16} color="#1B5E20" />
                <Text style={styles.infoText}>
                  Your account will be set as{" "}
                  <Text style={{ fontWeight: "700" }}>Zone Manager</Text> with{" "}
                  <Text style={{ fontWeight: "700" }}>Pending Review</Text>{" "}
                  status. Zone ID will be assigned by admin after approval.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleStep1Next}
              >
                <Text style={styles.primaryBtnText}>Next: Zone Details</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Zone Application ────────────────────────────────────── */}
          {step === 2 && (
            <View style={styles.formSection}>
              {/* Province */}
              <Dropdown
                label="Province"
                placeholder="Select province..."
                value={selectedProvince?.id ?? null}
                options={ZAMBIA_PROVINCES}
                onSelect={(opt) => {
                  setSelectedProvince(opt);
                  setSelectedTown(null);
                  setSelectedZone(null);
                }}
              />

              {/* Town / City */}
              <Dropdown
                label="Town / City"
                placeholder={
                  selectedProvince
                    ? "Select town/city..."
                    : "Select province first"
                }
                value={selectedTown?.id ?? null}
                options={availableTowns}
                onSelect={(opt) => {
                  setSelectedTown(opt);
                  setSelectedZone(null);
                }}
                disabled={!selectedProvince}
              />

              {/* Zone */}
              <Dropdown
                label="Zone (if available)"
                placeholder={
                  selectedTown
                    ? availableZones.length > 0
                      ? "Select a zone..."
                      : "No pre-configured zones — enter below"
                    : "Select town first"
                }
                value={selectedZone?.id ?? null}
                options={availableZones}
                onSelect={(opt) => {
                  setSelectedZone(opt);
                  setProposedZoneName("");
                }}
                disabled={!selectedTown || availableZones.length === 0}
              />

              {/* Proposed Zone Name */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  Proposed Zone Name{" "}
                  <Text style={styles.optionalTag}>
                    {selectedZone ? "(optional override)" : "(required if no zone selected)"}
                  </Text>
                </Text>
                <View style={styles.inputRow}>
                  <MaterialIcons name="edit-location" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={proposedZoneName}
                    onChangeText={(v) => {
                      setProposedZoneName(v);
                      if (v.trim()) setSelectedZone(null);
                    }}
                    placeholder="e.g. Northmead Residential Zone"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Summary Card */}
              {(selectedProvince || selectedTown || selectedZone || proposedZoneName) && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Application Summary</Text>
                  {selectedProvince && (
                    <SummaryRow icon="map" label="Province" value={selectedProvince.name} />
                  )}
                  {selectedTown && (
                    <SummaryRow icon="location-city" label="Town/City" value={selectedTown.name} />
                  )}
                  {selectedZone && (
                    <SummaryRow icon="place" label="Zone" value={selectedZone.name} />
                  )}
                  {proposedZoneName.trim() && (
                    <SummaryRow
                      icon="add-location"
                      label="Proposed Zone"
                      value={proposedZoneName.trim()}
                    />
                  )}
                  <SummaryRow icon="hourglass-empty" label="Status" value="Pending Review" />
                  <SummaryRow icon="admin-panel-settings" label="Zone ID" value="Assigned by admin" />
                </View>
              )}

              {/* Dev Mode Notice */}
              <View style={styles.devNotice}>
                <MaterialIcons name="developer-mode" size={16} color="#F59E0B" />
                <Text style={styles.devNoticeText}>
                  <Text style={{ fontWeight: "700" }}>Development Mode:</Text>{" "}
                  Dashboard access is granted immediately after registration,
                  even while status is pending review.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Submit Application</Text>
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <MaterialIcons name={icon as any} size={16} color="#1B5E20" />
      <Text style={styles.summaryLabel}>{label}:</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: _rs.sp(20),
    paddingTop: _rs.sp(16),
    paddingBottom: _rs.sp(20),
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { marginBottom: _rs.sp(16) },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(8),
    marginBottom: _rs.sp(8),
  },
  headerBadgeText: {
    fontSize: _rs.fs(13),
    fontWeight: "600",
    color: "#1B5E20",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: _rs.fs(26),
    fontWeight: "800",
    color: "#11181C",
    marginBottom: _rs.sp(4),
  },
  headerSub: { fontSize: _rs.fs(14), color: "#687076", marginBottom: _rs.sp(16) },
  progressRow: { flexDirection: "row", gap: _rs.sp(8), marginBottom: _rs.sp(6) },
  progressSegment: { flex: 1, height: _rs.s(4), borderRadius: _rs.s(4) },
  stepLabel: { fontSize: _rs.fs(12), color: "#687076" },
  formSection: { paddingHorizontal: _rs.sp(20), paddingTop: _rs.sp(24) },
  fieldWrap: { marginBottom: _rs.sp(18) },
  fieldLabel: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    color: "#374151",
    marginBottom: _rs.sp(8),
  },
  optionalTag: { fontSize: _rs.fs(12), fontWeight: "400", color: "#9CA3AF" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(2),
    gap: _rs.sp(10),
  },
  input: {
    flex: 1,
    paddingVertical: _rs.sp(13),
    fontSize: _rs.fs(15),
    color: "#11181C",
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(14),
  },
  dropdownDisabled: { opacity: 0.5 },
  dropdownText: { fontSize: _rs.fs(15), color: "#11181C", flex: 1 },
  dropdownPlaceholder: { color: "#9CA3AF" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: _rs.s(24),
    borderTopRightRadius: _rs.s(24),
    paddingHorizontal: _rs.sp(20),
    paddingBottom: _rs.sp(40),
    maxHeight: "70%",
  },
  modalHandle: {
    width: _rs.s(40),
    height: _rs.s(4),
    borderRadius: _rs.s(2),
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: _rs.sp(12),
    marginBottom: _rs.sp(16),
  },
  modalTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    color: "#11181C",
    marginBottom: _rs.sp(16),
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalOptionSelected: { backgroundColor: "#F0FDF4" },
  modalOptionText: { fontSize: _rs.fs(15), color: "#374151" },
  modalOptionTextSelected: { color: "#1B5E20", fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    borderRadius: _rs.s(12),
    padding: _rs.sp(14),
    gap: _rs.sp(10),
    marginBottom: _rs.sp(20),
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  infoText: { fontSize: _rs.fs(13), color: "#166534", flex: 1, lineHeight: _rs.fs(20) },
  primaryBtn: {
    backgroundColor: "#1B5E20",
    borderRadius: _rs.s(14),
    paddingVertical: _rs.sp(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: _rs.sp(10),
    marginTop: _rs.sp(8),
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontSize: _rs.fs(16), fontWeight: "700" },
  summaryCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: _rs.s(14),
    padding: _rs.sp(16),
    marginBottom: _rs.sp(16),
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  summaryTitle: {
    fontSize: _rs.fs(14),
    fontWeight: "700",
    color: "#166534",
    marginBottom: _rs.sp(12),
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(8),
    marginBottom: _rs.sp(8),
  },
  summaryLabel: { fontSize: _rs.fs(13), color: "#374151", fontWeight: "600", width: _rs.s(100) },
  summaryValue: { fontSize: _rs.fs(13), color: "#166534", flex: 1 },
  devNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: _rs.s(12),
    padding: _rs.sp(14),
    gap: _rs.sp(10),
    marginBottom: _rs.sp(16),
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  devNoticeText: { fontSize: _rs.fs(13), color: "#92400E", flex: 1, lineHeight: _rs.fs(20) },
});

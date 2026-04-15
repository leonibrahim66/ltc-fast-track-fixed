// Mock for react-native in vitest (Node environment)
export const Platform = {
  OS: "ios" as const,
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};
export const Alert = {
  alert: () => {},
};
export const Vibration = {
  vibrate: () => {},
};
export const AppState = {
  currentState: "active",
  addEventListener: () => ({ remove: () => {} }),
};
export const Linking = {
  openURL: async () => {},
  canOpenURL: async () => true,
};
export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T) => styles,
  flatten: (style: unknown) => style,
  hairlineWidth: 1,
};
export const PermissionsAndroid = {
  request: async () => "granted",
  check: async () => true,
  PERMISSIONS: {
    ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
    ACCESS_COARSE_LOCATION: "android.permission.ACCESS_COARSE_LOCATION",
  },
  RESULTS: {
    GRANTED: "granted",
    DENIED: "denied",
    NEVER_ASK_AGAIN: "never_ask_again",
  },
};
export const View = "View";
export const Text = "Text";
export const TouchableOpacity = "TouchableOpacity";
export const Pressable = "Pressable";
export const ScrollView = "ScrollView";
export const FlatList = "FlatList";
export const Image = "Image";
export const TextInput = "TextInput";
export const ActivityIndicator = "ActivityIndicator";
export const Modal = "Modal";
export const SafeAreaView = "SafeAreaView";
export const KeyboardAvoidingView = "KeyboardAvoidingView";
export const Dimensions = {
  get: () => ({ width: 390, height: 844 }),
  addEventListener: () => ({ remove: () => {} }),
};
export const Animated = {
  Value: class {
    constructor(public _value: number) {}
    setValue(v: number) { this._value = v; }
    interpolate() { return this; }
  },
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  spring: () => ({ start: (cb?: () => void) => cb?.() }),
  View: "Animated.View",
  Text: "Animated.Text",
  createAnimatedComponent: (c: unknown) => c,
  parallel: () => ({ start: (cb?: () => void) => cb?.() }),
  sequence: () => ({ start: (cb?: () => void) => cb?.() }),
};
export default {
  Platform,
  Alert,
  Vibration,
  AppState,
  Linking,
  StyleSheet,
  PermissionsAndroid,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Dimensions,
  Animated,
};

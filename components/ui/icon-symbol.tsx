// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

const MAPPING: Record<string, MaterialIconName> = {
  // Navigation icons
  "house.fill": "home",
  "person.fill": "person",
  "gearshape.fill": "settings",
  "list.bullet": "list",
  "map.fill": "map",
  "location.fill": "location-on",
  "trash.fill": "delete",
  "calendar": "calendar-today",
  "clock.fill": "schedule",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "bell.fill": "notifications",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "camera.fill": "camera-alt",
  "photo.fill": "photo",
  "creditcard.fill": "credit-card",
  "banknote.fill": "payments",
  "building.2.fill": "business",
  "car.fill": "local-shipping",
  "truck.box.fill": "local-shipping",
  "info.circle.fill": "info",
  "questionmark.circle.fill": "help",
  "arrow.right": "arrow-forward",
  "arrow.left": "arrow-back",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "plus.circle.fill": "add-circle",
  "minus.circle.fill": "remove-circle",
  "star.fill": "star",
  "heart.fill": "favorite",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "magnifyingglass": "search",
  "xmark": "close",
  "checkmark": "check",
  "exclamationmark.triangle.fill": "warning",
  "doc.text.fill": "description",
  "folder.fill": "folder",
  "pin.fill": "push-pin",
  "mappin.circle.fill": "place",
  "person.2.fill": "people",
  "person.badge.plus": "person-add",
  "chart.bar.fill": "bar-chart",
  "dollarsign.circle.fill": "attach-money",
  "message.fill": "message",
  "bubble.left.fill": "chat",
  "hand.raised.fill": "pan-tool",
  "leaf.fill": "eco",
  "newspaper.fill": "article",
  "shippingbox.fill": "local-shipping",
  "wallet.fill": "account-balance-wallet",
};

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name];
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}

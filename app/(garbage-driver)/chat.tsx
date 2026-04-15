/**
 * Garbage Collection Driver — Pickup Chat Screen
 *
 * Provides in-app messaging per pickup:
 *   - pickup_messages: { id, pickup_id, sender_id, sender_role, message, created_at }
 *   - Persisted to AsyncStorage with key @ltc_pickup_messages_{pickupId}
 *   - Polling every 5s for "real-time" sync simulation
 *   - Call button opens native dialer
 *
 * Security: drivers can only message within their assigned pickups.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import type { Pickup } from "./index";

import { getStaticResponsive } from "@/hooks/use-responsive";
const DRIVER_ORANGE = "#EA580C";
const PICKUPS_KEY = "@ltc_pickups";

export interface PickupMessage {
  id: string;
  pickupId: string;
  senderId: string;
  senderName: string;
  senderRole: "garbage_driver" | "zone_manager" | "admin" | "residential" | "commercial";
  message: string;
  createdAt: string;
}

function messagesKey(pickupId: string) {
  return `@ltc_pickup_messages_${pickupId}`;
}

export default function GarbageDriverChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ pickupId?: string; householdName?: string }>();
  const pickupId = params.pickupId;
  const householdName = params.householdName || "Pickup";

  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [messages, setMessages] = useState<PickupMessage[]>([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(pickupId ?? null);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load all driver's pickups for conversation list
  const loadPickups = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await AsyncStorage.getItem(PICKUPS_KEY);
      const all: Pickup[] = raw ? JSON.parse(raw) : [];
      const mine = all.filter(
        (p) =>
          p.assignedDriverId === user.id &&
          (user.zoneId ? p.zoneId === user.zoneId : true)
      );
      setPickups(mine);
      if (!selectedPickupId && mine.length > 0) {
        setSelectedPickupId(mine[0].id);
      }
    } catch (_e) {
      // ignore
    }
  }, [user?.id, user?.zoneId, selectedPickupId]);

  // Load messages for selected pickup
  const loadMessages = useCallback(async (pid: string) => {
    try {
      const raw = await AsyncStorage.getItem(messagesKey(pid));
      const msgs: PickupMessage[] = raw ? JSON.parse(raw) : [];
      setMessages(msgs);
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load pickup details
  const loadPickupDetails = useCallback(async (pid: string) => {
    try {
      const raw = await AsyncStorage.getItem(PICKUPS_KEY);
      const all: Pickup[] = raw ? JSON.parse(raw) : [];
      const found = all.find((p) => p.id === pid);
      setPickup(found ?? null);
    } catch (_e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPickups();
  }, [loadPickups]);

  useEffect(() => {
    if (!selectedPickupId) return;
    setIsLoading(true);
    loadMessages(selectedPickupId);
    loadPickupDetails(selectedPickupId);

    // Poll every 5s for new messages
    pollRef.current = setInterval(() => {
      loadMessages(selectedPickupId);
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedPickupId, loadMessages, loadPickupDetails]);

  const sendMessage = async () => {
    if (!text.trim() || !selectedPickupId || !user?.id) return;
    setIsSending(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newMsg: PickupMessage = {
      id: `msg_${Date.now()}`,
      pickupId: selectedPickupId,
      senderId: user.id,
      senderName: user.fullName || user.firstName || "Driver",
      senderRole: "garbage_driver",
      message: text.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const raw = await AsyncStorage.getItem(messagesKey(selectedPickupId));
      const existing: PickupMessage[] = raw ? JSON.parse(raw) : [];
      const updated = [...existing, newMsg];
      await AsyncStorage.setItem(messagesKey(selectedPickupId), JSON.stringify(updated));
      setMessages(updated);
      setText("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (_e) {
      // ignore
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: PickupMessage }) => {
    const isMe = item.senderId === user?.id;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            <MaterialIcons name="person" size={14} color="#9BA1A6" />
          </View>
        )}
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
          {!isMe && (
            <Text style={styles.msgSenderName}>{item.senderName}</Text>
          )}
          <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
            {item.message}
          </Text>
          <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  // If no pickupId param, show conversation list
  if (!selectedPickupId) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        {pickups.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="chat-bubble-outline" size={48} color="#334155" />
            <Text style={styles.emptyTitle}>No conversations</Text>
            <Text style={styles.emptySubtitle}>Messages appear when pickups are assigned to you.</Text>
          </View>
        ) : (
          <FlatList
            data={pickups}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.convCard}
                onPress={() => setSelectedPickupId(item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.convAvatar}>
                  <MaterialIcons name="home" size={20} color={DRIVER_ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.convName}>{item.householdName}</Text>
                  <Text style={styles.convAddress} numberOfLines={1}>{item.address}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#9BA1A6" />
              </TouchableOpacity>
            )}
          />
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (pickupId) {
              router.back();
            } else {
              setSelectedPickupId(null);
            }
          }}
        >
          <MaterialIcons name="arrow-back" size={22} color="#ECEDEE" />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderTitle} numberOfLines={1}>
            {pickup?.householdName || householdName}
          </Text>
          <Text style={styles.chatHeaderSub} numberOfLines={1}>
            {pickup?.address || "Pickup Chat"}
          </Text>
        </View>
        {pickup?.contactPhone && (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${pickup.contactPhone}`)}
          >
            <MaterialIcons name="call" size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={DRIVER_ORANGE} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="chat-bubble-outline" size={40} color="#334155" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Start the conversation below.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.msgList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#9BA1A6"
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || isSending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialIcons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
  },
  headerTitle: { color: "#ECEDEE", fontSize: _rs.fs(20), fontWeight: "700" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(12),
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
    gap: _rs.sp(10),
  },
  backBtn: { padding: _rs.sp(4) },
  chatHeaderInfo: { flex: 1 },
  chatHeaderTitle: { color: "#ECEDEE", fontSize: _rs.fs(16), fontWeight: "700" },
  chatHeaderSub: { color: "#9BA1A6", fontSize: _rs.fs(12), marginTop: _rs.sp(1) },
  callBtn: {
    backgroundColor: "#22C55E",
    borderRadius: _rs.s(10),
    padding: _rs.sp(8),
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: _rs.sp(12) },
  emptyTitle: { color: "#ECEDEE", fontSize: _rs.fs(16), fontWeight: "600" },
  emptySubtitle: {
    color: "#9BA1A6",
    fontSize: _rs.fs(13),
    textAlign: "center",
    paddingHorizontal: _rs.sp(32),
  },
  msgList: { padding: _rs.sp(12), gap: _rs.sp(8) },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: _rs.sp(8) },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },
  msgAvatar: {
    width: _rs.s(28),
    height: _rs.s(28),
    borderRadius: _rs.s(14),
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  msgBubble: {
    maxWidth: "75%",
    borderRadius: _rs.s(14),
    padding: _rs.sp(10),
    gap: _rs.sp(2),
  },
  msgBubbleMe: {
    backgroundColor: DRIVER_ORANGE,
    borderBottomRightRadius: _rs.s(4),
  },
  msgBubbleOther: {
    backgroundColor: "#1e2022",
    borderBottomLeftRadius: _rs.s(4),
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  msgSenderName: { color: "#9BA1A6", fontSize: _rs.fs(11), fontWeight: "600", marginBottom: _rs.sp(2) },
  msgText: { fontSize: _rs.fs(14), lineHeight: _rs.fs(20) },
  msgTextMe: { color: "white" },
  msgTextOther: { color: "#ECEDEE" },
  msgTime: { fontSize: _rs.fs(10), alignSelf: "flex-end" },
  msgTimeMe: { color: "rgba(255,255,255,0.6)" },
  msgTimeOther: { color: "#9BA1A6" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(10),
    borderTopWidth: 0.5,
    borderTopColor: "#334155",
    gap: _rs.sp(8),
  },
  input: {
    flex: 1,
    backgroundColor: "#1e2022",
    borderRadius: _rs.s(20),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(10),
    color: "#ECEDEE",
    fontSize: _rs.fs(14),
    maxHeight: 100,
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  sendBtn: {
    backgroundColor: DRIVER_ORANGE,
    borderRadius: _rs.s(20),
    width: _rs.s(40),
    height: _rs.s(40),
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  convCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e2022",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
    gap: _rs.sp(12),
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  convAvatar: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: DRIVER_ORANGE + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  convName: { color: "#ECEDEE", fontSize: _rs.fs(15), fontWeight: "600" },
  convAddress: { color: "#9BA1A6", fontSize: _rs.fs(12), marginTop: _rs.sp(2) },
});

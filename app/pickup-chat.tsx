/**
 * Pickup Chat Screen — shared by both customers and garbage drivers.
 *
 * Route params:
 *   pickupId   — the pickup request ID
 *   otherName  — display name of the other party
 *   otherPhone — phone number of the other party (for Call/SMS fallback)
 *
 * Storage: @ltc_pickup_messages_{pickupId}  (same key used by driver chat screen)
 * Polling: every 3 seconds for real-time feel.
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
import { createDriverNotification } from "@/lib/driver-notification-helper";

const DARK_GREEN = "#1B4332";
const LIGHT_GREEN = "#22C55E";

export interface PickupMessage {
  id: string;
  pickupId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

function messagesKey(pickupId: string) {
  return `@ltc_pickup_messages_${pickupId}`;
}

export default function PickupChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    pickupId?: string;
    otherName?: string;
    otherPhone?: string;
  }>();

  const pickupId = params.pickupId ?? "";
  const otherName = params.otherName ?? "Contact";
  const otherPhone = params.otherPhone ?? "";

  const [messages, setMessages] = useState<PickupMessage[]>([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async () => {
    if (!pickupId) return;
    try {
      const raw = await AsyncStorage.getItem(messagesKey(pickupId));
      const msgs: PickupMessage[] = raw ? JSON.parse(raw) : [];
      setMessages(msgs);
    } catch {
      // non-fatal
    } finally {
      setIsLoading(false);
    }
  }, [pickupId]);

  useEffect(() => {
    if (!pickupId) return;
    setIsLoading(true);
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pickupId, loadMessages]);

  const sendMessage = async () => {
    if (!text.trim() || !pickupId || !user?.id) return;
    setIsSending(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newMsg: PickupMessage = {
      id: `msg_${Date.now()}_${Date.now().toString(36).slice(-4)}`,
      pickupId,
      senderId: user.id,
      senderName: user.fullName || user.firstName || "Customer",
      senderRole: user.role || "residential",
      message: text.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const raw = await AsyncStorage.getItem(messagesKey(pickupId));
      const existing: PickupMessage[] = raw ? JSON.parse(raw) : [];
      const updated = [...existing, newMsg];
      await AsyncStorage.setItem(messagesKey(pickupId), JSON.stringify(updated));
      setMessages(updated);
      setText("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // If the sender is a customer (not a driver), notify the assigned driver
      const senderRole = user.role || "residential";
      const isCustomerSender =
        senderRole === "residential" ||
        senderRole === "commercial" ||
        senderRole === "industrial";
      if (isCustomerSender && pickupId) {
        // Look up the pickup to find the assigned driver's userId
        const pickupsRaw = await AsyncStorage.getItem("@ltc_pickups");
        const allPickups: Array<Record<string, unknown>> = pickupsRaw
          ? JSON.parse(pickupsRaw)
          : [];
        const pickup = allPickups.find((p) => p.id === pickupId);
        const driverUserId =
          (pickup?.assignedDriverId as string) ||
          (pickup?.assignedTo as string) ||
          (pickup?.collectorId as string);
        if (driverUserId) {
          await createDriverNotification({
            driverUserId,
            type: "customer_chat",
            title: "New Message from Customer 💬",
            body: `${user.fullName || user.firstName || "Customer"}: ${text.trim().slice(0, 80)}${text.trim().length > 80 ? "..." : ""}`,
            pickupId,
          });
        }
      }
    } catch {
      // non-fatal
    } finally {
      setIsSending(false);
    }
  };

  const handleCall = () => {
    if (!otherPhone) return;
    Linking.openURL(`tel:${otherPhone}`);
  };

  const handleSMS = () => {
    if (!otherPhone) return;
    Linking.openURL(`sms:${otherPhone}`);
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

  if (!pickupId) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <MaterialIcons name="chat-bubble-outline" size={48} color="#334155" />
          <Text style={styles.emptyTitle}>No pickup selected</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <MaterialIcons name="person" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerName}>{otherName}</Text>
            <Text style={styles.headerSub}>Pickup Chat</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {otherPhone ? (
            <>
              <TouchableOpacity onPress={handleCall} style={styles.headerActionBtn}>
                <MaterialIcons name="call" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSMS} style={styles.headerActionBtn}>
                <MaterialIcons name="sms" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={DARK_GREEN} size="large" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="chat-bubble-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Send a message to start the conversation.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
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
            onPress={sendMessage}
            disabled={isSending || !text.trim()}
            style={[styles.sendBtn, (!text.trim() || isSending) && styles.sendBtnDisabled]}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialIcons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: DARK_GREEN,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    padding: 16,
    gap: 8,
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-end",
    gap: 6,
  },
  msgRowMe: {
    justifyContent: "flex-end",
  },
  msgRowOther: {
    justifyContent: "flex-start",
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  msgBubble: {
    maxWidth: "75%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  msgBubbleMe: {
    backgroundColor: DARK_GREEN,
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: "#F1F5F9",
    borderBottomLeftRadius: 4,
  },
  msgSenderName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 2,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextMe: {
    color: "#fff",
  },
  msgTextOther: {
    color: "#1E293B",
  },
  msgTime: {
    fontSize: 10,
    marginTop: 4,
  },
  msgTimeMe: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "right",
  },
  msgTimeOther: {
    color: "#94A3B8",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#fff",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: DARK_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#CBD5E1",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
  },
});

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useChat, ChatMessage } from "@/lib/chat-context";
import { useAuth } from "@/lib/auth-context";

// Quick responses for collectors
const COLLECTOR_QUICK_RESPONSES = [
  { id: "qr-1", label: "On my way", message: "On my way to the location now." },
  { id: "qr-2", label: "Arrived", message: "I have arrived at the pickup location." },
  { id: "qr-3", label: "Completed", message: "Pickup completed successfully." },
  { id: "qr-4", label: "Issue", message: "There is an issue at this location. Please advise." },
  { id: "qr-5", label: "Need help", message: "I need assistance. Please contact me." },
  { id: "qr-6", label: "Break", message: "Taking a short break. Will resume shortly." },
];

export default function CollectorChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    conversations,
    getMessages,
    sendMessage,
    markConversationAsRead,
    startConversation,
    getUnreadCountForUser,
  } = useChat();

  const [messageText, setMessageText] = useState("");
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Find or create conversation with admin
  const adminConversation = conversations.find(
    (conv) =>
      conv.participants.some((p) => p.id === String(user?.id || "")) &&
      conv.participants.some((p) => p.role === "admin")
  );

  const conversationId = adminConversation?.id || "";
  const conversationMessages = conversationId ? getMessages(conversationId) : [];
  const unreadCount = user?.id ? getUnreadCountForUser(String(user.id)) : 0;

  // Mark as read when viewing
  useEffect(() => {
    if (conversationId) {
      markConversationAsRead(conversationId);
    }
  }, [conversationId, conversationMessages.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversationMessages.length]);

  const handleSendMessage = (content: string) => {
    if (!content.trim() || !user) return;

    let convId = conversationId;

    // Start conversation if doesn't exist
    if (!convId) {
      convId = startConversation(
        String(user.id || ""),
        user.fullName || "",
        (user.role as "admin" | "collector" | "zone_manager" | "customer") || "zone_manager",
        "admin",
        "IT Admin",
        "admin"
      );
    }

    sendMessage(
      convId,
      String(user.id || ""),
      user.fullName || "",
      (user.role as "admin" | "collector" | "zone_manager" | "customer") || "zone_manager",
      "admin",
      "IT Admin",
      content.trim(),
      "text"
    );

    setMessageText("");
    setShowQuickResponses(false);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="px-4 py-3 bg-primary flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View className="w-10 h-10 rounded-full bg-white/30 items-center justify-center">
            <MaterialIcons name="support-agent" size={20} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold">IT Support</Text>
            <Text className="text-white/70 text-sm">LTC Fast Track Admin</Text>
          </View>
          {unreadCount > 0 && (
            <View className="bg-error px-2 py-1 rounded-full">
              <Text className="text-white text-xs font-bold">{unreadCount} new</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setShowQuickResponses(!showQuickResponses)}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              showQuickResponses ? "bg-white" : "bg-white/20"
            }`}
          >
            <MaterialIcons
              name="flash-on"
              size={24}
              color={showQuickResponses ? "#22C55E" : "#fff"}
            />
          </TouchableOpacity>
        </View>

        {/* Quick Responses Panel */}
        {showQuickResponses && (
          <View className="bg-surface border-b border-border p-3">
            <Text className="text-muted text-xs mb-2 font-medium">QUICK RESPONSES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {COLLECTOR_QUICK_RESPONSES.map((response) => (
                  <TouchableOpacity
                    key={response.id}
                    onPress={() => handleSendMessage(response.message)}
                    className="px-3 py-2 rounded-full bg-primary/10 border border-primary"
                  >
                    <Text className="text-primary text-sm font-medium">
                      {response.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 16 }}
        >
          {conversationMessages.length === 0 ? (
            <View className="items-center py-12">
              <MaterialIcons name="chat-bubble-outline" size={48} color="#687076" />
              <Text className="text-foreground font-semibold mt-4">
                Chat with IT Support
              </Text>
              <Text className="text-muted text-center text-sm mt-2 px-8">
                Send a message to the IT department for assistance with pickups, routes, or any issues.
              </Text>
              <TouchableOpacity
                onPress={() => setShowQuickResponses(true)}
                className="mt-4 bg-primary/10 px-4 py-2 rounded-full flex-row items-center gap-2"
              >
                <MaterialIcons name="flash-on" size={18} color="#22C55E" />
                <Text className="text-primary font-medium">Use Quick Response</Text>
              </TouchableOpacity>
            </View>
          ) : (
            conversationMessages.map((message, index) => {
              const isCollector = message.senderRole === "collector" || message.senderRole === "zone_manager";
              const showDate =
                index === 0 ||
                formatDate(message.timestamp) !==
                  formatDate(conversationMessages[index - 1].timestamp);

              return (
                <View key={message.id}>
                  {showDate && (
                    <View className="items-center my-4">
                      <Text className="text-muted text-xs bg-surface px-3 py-1 rounded-full">
                        {formatDate(message.timestamp)}
                      </Text>
                    </View>
                  )}
                  <View
                    className={`mb-3 max-w-[80%] ${
                      isCollector ? "self-end" : "self-start"
                    }`}
                  >
                    <View
                      className={`px-4 py-3 rounded-2xl ${
                        isCollector
                          ? "bg-primary"
                          : message.type === "quick_action"
                          ? "bg-warning"
                          : "bg-surface border border-border"
                      } ${
                        isCollector ? "rounded-br-sm" : "rounded-bl-sm"
                      }`}
                    >
                      <Text
                        className={`${
                          isCollector || message.type === "quick_action"
                            ? "text-white"
                            : "text-foreground"
                        }`}
                      >
                        {message.content}
                      </Text>
                    </View>
                    <Text
                      className={`text-xs text-muted mt-1 ${
                        isCollector ? "text-right" : "text-left"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                      {!isCollector && message.type === "quick_action" && " • Priority"}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Message Input */}
        <View className="px-4 py-3 bg-surface border-t border-border">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 bg-background rounded-full px-4 py-2 flex-row items-center border border-border">
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor="#687076"
                className="flex-1 text-foreground"
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => handleSendMessage(messageText)}
              />
            </View>
            <TouchableOpacity
              onPress={() => handleSendMessage(messageText)}
              disabled={!messageText.trim()}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                messageText.trim() ? "bg-primary" : "bg-muted/30"
              }`}
            >
              <MaterialIcons
                name="send"
                size={24}
                color={messageText.trim() ? "#fff" : "#687076"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

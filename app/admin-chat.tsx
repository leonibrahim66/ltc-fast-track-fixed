import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useChat, Conversation, ChatMessage } from "@/lib/chat-context";
import { useAdmin } from "@/lib/admin-context";

export default function AdminChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const { isAdminAuthenticated, adminUser } = useAdmin();
  const {
    conversations,
    quickActions,
    totalUnreadCount,
    getMessages,
    sendMessage,
    markConversationAsRead,
  } = useChat();

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showQuickActions, setShowQuickActions] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const conversationMessages = selectedConversation
    ? getMessages(selectedConversation.id)
    : [];

  // Auto-select conversation from params
  useEffect(() => {
    if (params.conversationId) {
      const conv = conversations.find((c) => c.id === params.conversationId);
      if (conv) {
        setSelectedConversation(conv);
        markConversationAsRead(conv.id);
      }
    }
  }, [params.conversationId, conversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedConversation) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversationMessages.length, selectedConversation]);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    markConversationAsRead(conv.id);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSendMessage = (content: string, type: "text" | "quick_action" = "text") => {
    if (!content.trim() || !selectedConversation) return;

    const receiver = selectedConversation.participants.find((p) => p.role !== "admin");
    if (!receiver) return;

    sendMessage(
      selectedConversation.id,
      "admin",
      adminUser?.fullName || "IT Admin",
      "admin",
      receiver.id,
      receiver.name,
      content.trim(),
      type
    );

    setMessageText("");
    setShowQuickActions(false);

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

  if (!isAdminAuthenticated) {
    return null;
  }

  // Conversation List View
  if (!selectedConversation) {
    return (
      <ScreenContainer>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 bg-primary">
          <View className="flex-row items-center justify-between mb-2">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">Messages</Text>
            <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
              {totalUnreadCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-error w-5 h-5 rounded-full items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                  </Text>
                </View>
              )}
              <MaterialIcons name="chat" size={24} color="#fff" />
            </View>
          </View>
          <Text className="text-white/80 text-sm">
            {conversations.length} active conversations
          </Text>
        </View>

        {/* Conversations List */}
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const otherParticipant = item.participants.find((p) => p.role !== "admin");
            return (
              <TouchableOpacity
                onPress={() => handleSelectConversation(item)}
                className={`bg-surface rounded-xl p-4 mb-3 border ${
                  item.unreadCount > 0 ? "border-primary" : "border-border"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                    <MaterialIcons name="person" size={24} color="#22C55E" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-foreground font-semibold">
                        {otherParticipant?.name || "Unknown"}
                      </Text>
                      <Text className="text-muted text-xs">
                        {formatTime(item.lastMessageTime)}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between mt-1">
                      <Text
                        className={`text-sm flex-1 mr-2 ${
                          item.unreadCount > 0 ? "text-foreground font-medium" : "text-muted"
                        }`}
                        numberOfLines={1}
                      >
                        {item.lastMessage}
                      </Text>
                      {item.unreadCount > 0 && (
                        <View className="bg-primary w-5 h-5 rounded-full items-center justify-center">
                          <Text className="text-white text-xs font-bold">
                            {item.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <MaterialIcons name="chat-bubble-outline" size={64} color="#687076" />
              <Text className="text-muted text-center mt-4">No conversations yet</Text>
            </View>
          }
        />
      </ScreenContainer>
    );
  }

  // Chat View
  const otherParticipant = selectedConversation.participants.find((p) => p.role !== "admin");

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Chat Header */}
        <View className="px-4 py-3 bg-primary flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => setSelectedConversation(null)}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View className="w-10 h-10 rounded-full bg-white/30 items-center justify-center">
            <MaterialIcons name="person" size={20} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold">
              {otherParticipant?.name || "Unknown"}
            </Text>
            <Text className="text-white/70 text-sm capitalize">
              {otherParticipant?.role || "User"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowQuickActions(!showQuickActions)}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              showQuickActions ? "bg-white" : "bg-white/20"
            }`}
          >
            <MaterialIcons
              name="flash-on"
              size={24}
              color={showQuickActions ? "#22C55E" : "#fff"}
            />
          </TouchableOpacity>
        </View>

        {/* Quick Actions Panel */}
        {showQuickActions && (
          <View className="bg-surface border-b border-border p-3">
            <Text className="text-muted text-xs mb-2 font-medium">QUICK ACTIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {quickActions.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    onPress={() => handleSendMessage(action.message, "quick_action")}
                    className={`px-3 py-2 rounded-full border ${
                      action.category === "emergency"
                        ? "bg-error/10 border-error"
                        : action.category === "request"
                        ? "bg-warning/10 border-warning"
                        : "bg-primary/10 border-primary"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        action.category === "emergency"
                          ? "text-error"
                          : action.category === "request"
                          ? "text-warning"
                          : "text-primary"
                      }`}
                    >
                      {action.label}
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
              <Text className="text-muted text-center mt-4">
                Start the conversation
              </Text>
              <Text className="text-muted text-center text-sm mt-1">
                Send a message or use quick actions
              </Text>
            </View>
          ) : (
            conversationMessages.map((message, index) => {
              const isAdmin = message.senderRole === "admin";
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
                      isAdmin ? "self-end" : "self-start"
                    }`}
                  >
                    <View
                      className={`px-4 py-3 rounded-2xl ${
                        isAdmin
                          ? message.type === "quick_action"
                            ? "bg-warning"
                            : "bg-primary"
                          : "bg-surface border border-border"
                      } ${
                        isAdmin ? "rounded-br-sm" : "rounded-bl-sm"
                      }`}
                    >
                      <Text
                        className={`${
                          isAdmin ? "text-white" : "text-foreground"
                        }`}
                      >
                        {message.content}
                      </Text>
                    </View>
                    <Text
                      className={`text-xs text-muted mt-1 ${
                        isAdmin ? "text-right" : "text-left"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                      {isAdmin && message.type === "quick_action" && " • Quick Action"}
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

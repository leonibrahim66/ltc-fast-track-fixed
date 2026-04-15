import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Message Types
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: "admin" | "collector" | "zone_manager" | "customer";
  receiverId: string;
  receiverName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: "text" | "quick_action" | "system";
}

// Conversation
export interface Conversation {
  id: string;
  participants: {
    id: string;
    name: string;
    role: "admin" | "collector" | "zone_manager" | "customer";
  }[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isActive: boolean;
}

// Quick Action Templates
export interface QuickAction {
  id: string;
  label: string;
  message: string;
  category: "status" | "request" | "info" | "emergency";
}

interface ChatContextType {
  conversations: Conversation[];
  messages: ChatMessage[];
  quickActions: QuickAction[];
  totalUnreadCount: number;
  getConversation: (userId: string) => Conversation | undefined;
  getMessages: (conversationId: string) => ChatMessage[];
  sendMessage: (
    conversationId: string,
    senderId: string,
    senderName: string,
    senderRole: "admin" | "collector" | "zone_manager" | "customer",
    receiverId: string,
    receiverName: string,
    content: string,
    type?: "text" | "quick_action" | "system"
  ) => void;
  startConversation: (
    userId: string,
    userName: string,
    userRole: "admin" | "collector" | "zone_manager" | "customer",
    targetId: string,
    targetName: string,
    targetRole: "admin" | "collector" | "zone_manager" | "customer"
  ) => string;
  markConversationAsRead: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  getUnreadCountForUser: (userId: string) => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const CONVERSATIONS_KEY = "@ltc_chat_conversations";
const MESSAGES_KEY = "@ltc_chat_messages";

// Default quick actions for IT admins
const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa-1",
    label: "Check Status",
    message: "Hi! Please provide your current status and location.",
    category: "status",
  },
  {
    id: "qa-2",
    label: "Urgent Pickup",
    message: "URGENT: Please prioritize the pending pickup at your current location.",
    category: "emergency",
  },
  {
    id: "qa-3",
    label: "Route Update",
    message: "Your route has been updated. Please check the app for new pickup assignments.",
    category: "info",
  },
  {
    id: "qa-4",
    label: "Break Reminder",
    message: "Reminder: You are due for a break. Please take a 15-minute rest.",
    category: "info",
  },
  {
    id: "qa-5",
    label: "End of Day",
    message: "Please complete all pending pickups and return to the depot.",
    category: "request",
  },
  {
    id: "qa-6",
    label: "Vehicle Check",
    message: "Please confirm your vehicle is in good condition for today's pickups.",
    category: "request",
  },
  {
    id: "qa-7",
    label: "Customer Complaint",
    message: "A customer has reported an issue. Please contact the office immediately.",
    category: "emergency",
  },
  {
    id: "qa-8",
    label: "Good Job",
    message: "Great work today! Keep up the excellent service.",
    category: "info",
  },
];

// Simulated collectors for demo
const DEMO_COLLECTORS = [
  { id: "collector-1", name: "John Mwale", role: "collector" as const },
  { id: "collector-2", name: "Mary Banda", role: "collector" as const },
  { id: "collector-3", name: "Peter Phiri", role: "collector" as const },
  { id: "collector-4", name: "Grace Tembo", role: "collector" as const },
  { id: "collector-5", name: "David Zulu", role: "collector" as const },
];

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load data from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        const [convData, msgData] = await Promise.all([
          AsyncStorage.getItem(CONVERSATIONS_KEY),
          AsyncStorage.getItem(MESSAGES_KEY),
        ]);

        if (convData) {
          setConversations(JSON.parse(convData));
        } else {
          // Initialize with demo conversations
          const demoConversations: Conversation[] = DEMO_COLLECTORS.map((collector) => ({
            id: `conv-admin-${collector.id}`,
            participants: [
              { id: "admin", name: "IT Admin", role: "admin" as const },
              collector,
            ],
            lastMessage: "No messages yet",
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            isActive: true,
          }));
          setConversations(demoConversations);
          await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(demoConversations));
        }

        if (msgData) {
          setMessages(JSON.parse(msgData));
        }
      } catch (error) {
        console.error("Error loading chat data:", error);
      }
    };
    loadData();
  }, []);

  // Save conversations to storage
  const saveConversations = async (newConversations: Conversation[]) => {
    try {
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(newConversations));
    } catch (error) {
      console.error("Error saving conversations:", error);
    }
  };

  // Save messages to storage
  const saveMessages = async (newMessages: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(newMessages));
    } catch (error) {
      console.error("Error saving messages:", error);
    }
  };

  // Get conversation by user ID
  const getConversation = useCallback(
    (userId: string): Conversation | undefined => {
      return conversations.find((conv) =>
        conv.participants.some((p) => p.id === userId)
      );
    },
    [conversations]
  );

  // Get messages for a conversation
  const getMessages = useCallback(
    (conversationId: string): ChatMessage[] => {
      return messages
        .filter((msg) => msg.conversationId === conversationId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
    [messages]
  );

  // Send a message
  const sendMessage = useCallback(
    (
      conversationId: string,
      senderId: string,
      senderName: string,
      senderRole: "admin" | "collector" | "zone_manager" | "customer",
      receiverId: string,
      receiverName: string,
      content: string,
      type: "text" | "quick_action" | "system" = "text"
    ) => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        conversationId,
        senderId,
        senderName,
        senderRole,
        receiverId,
        receiverName,
        content,
        timestamp: new Date().toISOString(),
        isRead: false,
        type,
      };

      // Haptic feedback
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      setMessages((prev) => {
        const updated = [...prev, newMessage];
        saveMessages(updated);
        return updated;
      });

      // Update conversation
      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              lastMessage: content,
              lastMessageTime: newMessage.timestamp,
              unreadCount: conv.unreadCount + (senderRole !== "admin" ? 1 : 0),
            };
          }
          return conv;
        });
        saveConversations(updated);
        return updated;
      });

      // Simulate collector response after 2-5 seconds (for demo)
      if (senderRole === "admin") {
        const delay = 2000 + Math.random() * 3000;
        setTimeout(() => {
          const responses = [
            "Understood, I'm on it!",
            "Copy that. Will update shortly.",
            "Received. Heading there now.",
            "Thanks for the update!",
            "Acknowledged. ETA 15 minutes.",
            "Got it. Currently at the location.",
          ];
          const randomResponse = responses[Math.floor(Math.random() * responses.length)];

          const responseMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            conversationId,
            senderId: receiverId,
            senderName: receiverName,
            senderRole: "collector",
            receiverId: senderId,
            receiverName: senderName,
            content: randomResponse,
            timestamp: new Date().toISOString(),
            isRead: false,
            type: "text",
          };

          setMessages((prev) => {
            const updated = [...prev, responseMessage];
            saveMessages(updated);
            return updated;
          });

          setConversations((prev) => {
            const updated = prev.map((conv) => {
              if (conv.id === conversationId) {
                return {
                  ...conv,
                  lastMessage: randomResponse,
                  lastMessageTime: responseMessage.timestamp,
                  unreadCount: conv.unreadCount + 1,
                };
              }
              return conv;
            });
            saveConversations(updated);
            return updated;
          });
        }, delay);
      }
    },
    []
  );

  // Start a new conversation
  const startConversation = useCallback(
    (
      userId: string,
      userName: string,
      userRole: "admin" | "collector" | "zone_manager" | "customer",
      targetId: string,
      targetName: string,
      targetRole: "admin" | "collector" | "zone_manager" | "customer"
    ): string => {
      // Check if conversation already exists
      const existing = conversations.find(
        (conv) =>
          conv.participants.some((p) => p.id === userId) &&
          conv.participants.some((p) => p.id === targetId)
      );

      if (existing) {
        return existing.id;
      }

      const newConversation: Conversation = {
        id: `conv-${Date.now()}`,
        participants: [
          { id: userId, name: userName, role: userRole },
          { id: targetId, name: targetName, role: targetRole },
        ],
        lastMessage: "Conversation started",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        isActive: true,
      };

      setConversations((prev) => {
        const updated = [...prev, newConversation];
        saveConversations(updated);
        return updated;
      });

      return newConversation.id;
    },
    [conversations]
  );

  // Mark conversation as read
  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const updated = prev.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      );
      saveConversations(updated);
      return updated;
    });

    setMessages((prev) => {
      const updated = prev.map((msg) =>
        msg.conversationId === conversationId ? { ...msg, isRead: true } : msg
      );
      saveMessages(updated);
      return updated;
    });
  }, []);

  // Delete conversation
  const deleteConversation = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const updated = prev.filter((conv) => conv.id !== conversationId);
      saveConversations(updated);
      return updated;
    });

    setMessages((prev) => {
      const updated = prev.filter((msg) => msg.conversationId !== conversationId);
      saveMessages(updated);
      return updated;
    });
  }, []);

  // Get unread count for a specific user
  const getUnreadCountForUser = useCallback(
    (userId: string): number => {
      return conversations
        .filter((conv) => conv.participants.some((p) => p.id === userId))
        .reduce((total, conv) => total + conv.unreadCount, 0);
    },
    [conversations]
  );

  const totalUnreadCount = conversations.reduce((total, conv) => total + conv.unreadCount, 0);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        messages,
        quickActions: DEFAULT_QUICK_ACTIONS,
        totalUnreadCount,
        getConversation,
        getMessages,
        sendMessage,
        startConversation,
        markConversationAsRead,
        deleteConversation,
        getUnreadCountForUser,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

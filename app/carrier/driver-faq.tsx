import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useColors } from "@/hooks/use-colors";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_DATA: { category: string; items: FAQItem[] }[] = [
  {
    category: "Registration Requirements",
    items: [
      {
        question: "What documents do I need to register as a carrier driver?",
        answer:
          "You need: (1) A valid driver's license, (2) NRC (National Registration Card) - front and back photos, (3) Vehicle registration documents, and (4) A clear photo of your vehicle.",
      },
      {
        question: "What types of vehicles are accepted?",
        answer:
          "We accept Trucks, Light Trucks, Tractors, Vans, Pickups, and Motorbikes. If your vehicle type is not listed, you can enter it manually during registration.",
      },
      {
        question: "Do I need to own the vehicle?",
        answer:
          "You must have legal access to the vehicle and valid registration documents. Vehicle ownership is verified during the approval process.",
      },
    ],
  },
  {
    category: "Document Verification",
    items: [
      {
        question: "How long does document verification take?",
        answer:
          "Our admin team typically reviews applications within 24-48 hours. You'll receive a notification once your application is approved or if additional information is needed.",
      },
      {
        question: "What happens if my documents are rejected?",
        answer:
          "If your documents don't meet our requirements, you'll receive a notification explaining the reason. You can resubmit corrected documents through your application status page.",
      },
      {
        question: "Can I update my documents after submission?",
        answer:
          "Yes, if your application is pending or rejected, you can update your documents. Once approved, contact support to update any information.",
      },
    ],
  },
  {
    category: "Approval Timeline",
    items: [
      {
        question: "When can I start accepting jobs?",
        answer:
          "You can start accepting carrier jobs immediately after your application is approved by our admin team. You'll receive a notification when approved.",
      },
      {
        question: "How will I know if I'm approved?",
        answer:
          "You'll receive a notification via the app and can check your application status anytime from the login screen or your dashboard.",
      },
      {
        question: "What if my application is taking longer than expected?",
        answer:
          "If your application hasn't been reviewed within 48 hours, please contact our support team through the Help section in the app.",
      },
    ],
  },
  {
    category: "Common Troubleshooting",
    items: [
      {
        question: "I forgot my login credentials. What should I do?",
        answer:
          "On the login screen, tap 'Forgot Credentials?' and enter your full name and vehicle plate number to recover your account information.",
      },
      {
        question: "My photo upload failed. What should I try?",
        answer:
          "Ensure your photos are clear and under 10MB. Try taking a new photo or selecting a different image. Make sure you have granted camera and photo library permissions to the app.",
      },
      {
        question: "Can I register multiple vehicles?",
        answer:
          "Currently, each driver account is linked to one vehicle. If you have multiple vehicles, please contact support for assistance with fleet registration.",
      },
    ],
  },
];

export default function DriverFAQScreen() {
  const router = useRouter();
  const colors = useColors();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 py-6 border-b" style={{ borderBottomColor: colors.border }}>
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Driver FAQ</Text>
          </View>
          <Text className="text-sm text-muted ml-9">
            Frequently asked questions about carrier driver registration
          </Text>
        </View>

        {/* FAQ Categories */}
        <View className="px-6 py-6">
          {FAQ_DATA.map((category, catIndex) => (
            <View key={catIndex} className="mb-8">
              <Text className="text-lg font-semibold text-foreground mb-4">{category.category}</Text>
              <View className="space-y-3">
                {category.items.map((item, itemIndex) => {
                  const key = `${catIndex}-${itemIndex}`;
                  const isExpanded = expandedItems.has(key);

                  return (
                    <View
                      key={key}
                      className="bg-surface rounded-2xl overflow-hidden"
                    >
                      <TouchableOpacity
                        onPress={() => toggleItem(key)}
                        className="flex-row items-center justify-between p-4"
                      >
                        <Text className="text-base font-medium text-foreground flex-1 pr-3">
                          {item.question}
                        </Text>
                        <MaterialIcons
                          name={isExpanded ? "expand-less" : "expand-more"}
                          size={24}
                          color={colors.primary}
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View className="px-4 pb-4 pt-0">
                          <Text className="text-sm text-muted leading-relaxed">{item.answer}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Contact Support */}
        <View className="px-6 pb-8">
          <View className="bg-blue-600 rounded-2xl p-6">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="support-agent" size={28} color="#FFFFFF" />
              <Text className="text-white text-lg font-semibold ml-3">Still Need Help?</Text>
            </View>
            <Text className="text-white text-sm leading-relaxed mb-4">
              If you couldn't find the answer to your question, our support team is here to help you.
            </Text>
            <TouchableOpacity className="bg-white rounded-lg py-3 items-center">
              <Text className="text-blue-600 font-semibold text-base">Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

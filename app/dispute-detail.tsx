import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import {
  useDisputes,
  DISPUTE_TYPES,
  DISPUTE_STATUS_LABELS,
  RESOLUTION_TYPES,
} from "@/lib/disputes-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function DisputeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ disputeId: string }>();
  const { getDisputeById } = useDisputes();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const dispute = params.disputeId ? getDisputeById(params.disputeId) : undefined;

  if (!dispute) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="error-outline" size={64} color="#EF4444" />
          <Text className="text-lg font-semibold text-foreground mt-4">
            Dispute Not Found
          </Text>
          <Text className="text-muted text-center mt-2">
            The dispute you are looking for could not be found.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-primary px-6 py-3 rounded-xl mt-6"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const typeInfo = DISPUTE_TYPES[dispute.type];
  const statusInfo = DISPUTE_STATUS_LABELS[dispute.status];
  const resolutionInfo = dispute.resolution
    ? RESOLUTION_TYPES[dispute.resolution]
    : null;

  const timelineSteps = [
    {
      label: "Submitted",
      date: dispute.createdAt,
      completed: true,
      icon: "send",
    },
    {
      label: "Under Review",
      date: dispute.status !== "open" ? dispute.updatedAt : null,
      completed: dispute.status !== "open",
      icon: "search",
    },
    {
      label: "Resolution",
      date: dispute.resolvedAt,
      completed: dispute.status === "resolved" || dispute.status === "rejected",
      icon: dispute.status === "rejected" ? "close" : "check",
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center px-6 pt-4 pb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4"
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#11181C" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Dispute Details</Text>
            <Text className="text-muted">#{dispute.id.slice(-8)}</Text>
          </View>
        </View>

        {/* Status Card */}
        <View className="px-6 mb-6">
          <View
            className="rounded-2xl p-6"
            style={{ backgroundColor: `${statusInfo.color}15` }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${statusInfo.color}25` }}
                >
                  <MaterialIcons
                    name={typeInfo.icon as any}
                    size={24}
                    color={statusInfo.color}
                  />
                </View>
                <View className="ml-3">
                  <Text className="font-semibold text-foreground text-lg">
                    {typeInfo.label}
                  </Text>
                  <Text className="text-muted text-sm">
                    Pickup #{dispute.pickupId.slice(-6)}
                  </Text>
                </View>
              </View>
              <View
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: statusInfo.color }}
              >
                <Text className="text-white font-medium">{statusInfo.label}</Text>
              </View>
            </View>

            {/* Timeline */}
            <View className="mt-4">
              {timelineSteps.map((step, index) => (
                <View key={step.label} className="flex-row items-start mb-4">
                  <View className="items-center mr-3">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${
                        step.completed ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <MaterialIcons
                        name={step.icon as any}
                        size={16}
                        color="white"
                      />
                    </View>
                    {index < timelineSteps.length - 1 && (
                      <View
                        className={`w-0.5 h-8 mt-1 ${
                          step.completed ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${
                        step.completed ? "text-foreground" : "text-muted"
                      }`}
                    >
                      {step.label}
                    </Text>
                    {step.date && (
                      <Text className="text-xs text-muted">
                        {new Date(step.date).toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Description */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Issue Description
          </Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-foreground leading-6">{dispute.description}</Text>
          </View>
        </View>

        {/* Photo Evidence */}
        {dispute.photoEvidence && dispute.photoEvidence.length > 0 && (
          <View className="px-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Photo Evidence
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3">
                {dispute.photoEvidence.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedPhoto(photo)}
                  >
                    <Image
                      source={{ uri: photo }}
                      className="w-24 h-24 rounded-xl"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Collector Info */}
        {dispute.collectorName && (
          <View className="px-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Collector Information
            </Text>
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-3">
                  <MaterialIcons name="person" size={24} color="#6B7280" />
                </View>
                <View>
                  <Text className="font-medium text-foreground">
                    {dispute.collectorName}
                  </Text>
                  <Text className="text-sm text-muted">
                    ID: {dispute.collectorId?.slice(-8)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Resolution */}
        {resolutionInfo && (
          <View className="px-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Resolution
            </Text>
            <View className="bg-green-50 rounded-xl p-4 border border-green-200">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
                  <MaterialIcons
                    name={resolutionInfo.icon as any}
                    size={20}
                    color="#22C55E"
                  />
                </View>
                <Text className="font-semibold text-green-800">
                  {resolutionInfo.label}
                </Text>
              </View>
              {dispute.resolutionNotes && (
                <Text className="text-green-700">{dispute.resolutionNotes}</Text>
              )}
              {dispute.resolvedAt && (
                <Text className="text-xs text-green-600 mt-2">
                  Resolved on {new Date(dispute.resolvedAt).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Rejection Reason */}
        {dispute.status === "rejected" && dispute.resolutionNotes && (
          <View className="px-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Rejection Reason
            </Text>
            <View className="bg-red-50 rounded-xl p-4 border border-red-200">
              <View className="flex-row items-center mb-3">
                <MaterialIcons name="info" size={20} color="#EF4444" />
                <Text className="font-medium text-red-800 ml-2">
                  Dispute Rejected
                </Text>
              </View>
              <Text className="text-red-700">{dispute.resolutionNotes}</Text>
            </View>
          </View>
        )}

        {/* Details */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Details
          </Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">Dispute ID</Text>
              <Text className="text-foreground font-medium">
                #{dispute.id.slice(-8)}
              </Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">Submitted</Text>
              <Text className="text-foreground">
                {new Date(dispute.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted">Last Updated</Text>
              <Text className="text-foreground">
                {new Date(dispute.updatedAt).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-muted">Issue Type</Text>
              <Text className="text-foreground">{typeInfo.label}</Text>
            </View>
          </View>
        </View>

        {/* Contact Support */}
        <View className="px-6">
          <TouchableOpacity
            onPress={() => router.push("/contact-us")}
            className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                <MaterialIcons name="support-agent" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text className="font-medium text-foreground">Need Help?</Text>
                <Text className="text-sm text-muted">Contact our support team</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Photo Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View className="flex-1 bg-black/90 items-center justify-center">
          <TouchableOpacity
            onPress={() => setSelectedPhoto(null)}
            className="absolute top-12 right-6 z-10"
          >
            <MaterialIcons name="close" size={32} color="white" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              className="w-full h-96"
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    padding: _rs.sp(8),
  },
});

import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { usePickups } from "@/lib/pickups-context";

const { width: screenWidth } = Dimensions.get("window");

export default function PickupPhotosScreen() {
  const router = useRouter();
  const { pickupId } = useLocalSearchParams<{ pickupId: string }>();
  const { getPickupById } = usePickups();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const pickup = pickupId ? getPickupById(pickupId) : undefined;
  const photos = pickup?.completionPhotos || [];

  const renderPhotoItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      onPress={() => setSelectedPhotoIndex(index)}
      className="w-1/2 p-1"
    >
      <Image
        source={{ uri: item }}
        className="w-full h-40 rounded-xl"
        contentFit="cover"
      />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center mb-4"
        >
          <MaterialIcons name="arrow-back" size={24} color="#687076" />
          <Text className="text-muted ml-2">Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-foreground mb-2">
          Pickup Photos
        </Text>
        <Text className="text-muted">
          Proof of completed pickup service
        </Text>
      </View>

      {/* Pickup Info */}
      {pickup && (
        <View className="px-6 py-4">
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="location-on" size={20} color="#22C55E" />
              <Text className="text-foreground ml-2 flex-1" numberOfLines={2}>
                {pickup.location.address || "Unknown location"}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-muted text-sm">
                Completed: {pickup.completedAt 
                  ? new Date(pickup.completedAt).toLocaleDateString()
                  : "N/A"
                }
              </Text>
              {pickup.collectorName && (
                <Text className="text-muted text-sm">
                  By: {pickup.collectorName}
                </Text>
              )}
            </View>
            {pickup.completionNotes && (
              <View className="mt-3 pt-3 border-t border-border">
                <Text className="text-muted text-sm">
                  <Text className="font-medium">Notes: </Text>
                  {pickup.completionNotes}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Photo Gallery */}
      <View className="flex-1 px-5">
        {photos.length > 0 ? (
          <FlatList
            data={photos}
            renderItem={renderPhotoItem}
            keyExtractor={(_, index) => index.toString()}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <MaterialIcons name="photo-library" size={64} color="#9CA3AF" />
            <Text className="text-muted text-center mt-4">
              No photos available for this pickup
            </Text>
            <Text className="text-muted text-center text-sm mt-2">
              The collector did not add any completion photos
            </Text>
          </View>
        )}
      </View>

      {/* Full Screen Photo Viewer */}
      <Modal
        visible={selectedPhotoIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoIndex(null)}
      >
        <View className="flex-1 bg-black">
          {/* Close Button */}
          <TouchableOpacity
            onPress={() => setSelectedPhotoIndex(null)}
            className="absolute top-12 right-4 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Photo Counter */}
          <View className="absolute top-12 left-4 z-10 px-3 py-1 rounded-full bg-white/20">
            <Text className="text-white text-sm">
              {(selectedPhotoIndex ?? 0) + 1} / {photos.length}
            </Text>
          </View>

          {/* Photo */}
          {selectedPhotoIndex !== null && (
            <View className="flex-1 items-center justify-center">
              <Image
                source={{ uri: photos[selectedPhotoIndex] }}
                style={{ width: screenWidth, height: screenWidth }}
                contentFit="contain"
              />
            </View>
          )}

          {/* Navigation Arrows */}
          {selectedPhotoIndex !== null && photos.length > 1 && (
            <>
              {selectedPhotoIndex > 0 && (
                <TouchableOpacity
                  onPress={() => setSelectedPhotoIndex(selectedPhotoIndex - 1)}
                  className="absolute left-4 top-1/2 -mt-6 w-12 h-12 rounded-full bg-white/20 items-center justify-center"
                >
                  <MaterialIcons name="chevron-left" size={32} color="#fff" />
                </TouchableOpacity>
              )}
              {selectedPhotoIndex < photos.length - 1 && (
                <TouchableOpacity
                  onPress={() => setSelectedPhotoIndex(selectedPhotoIndex + 1)}
                  className="absolute right-4 top-1/2 -mt-6 w-12 h-12 rounded-full bg-white/20 items-center justify-center"
                >
                  <MaterialIcons name="chevron-right" size={32} color="#fff" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

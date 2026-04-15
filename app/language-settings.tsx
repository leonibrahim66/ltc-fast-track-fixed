import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useI18n, Language, LANGUAGES } from "@/lib/i18n-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSelectLanguage = async (lang: Language) => {
    if (lang === language) return;
    
    setIsUpdating(true);
    try {
      await setLanguage(lang);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Failed to change language:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground ml-4">
              {t("profile.language")}
            </Text>
          </View>
          <Text className="text-muted">
            Select your preferred language for the app interface.
          </Text>
        </View>

        {/* Language Options */}
        <View className="px-6">
          <View className="bg-surface rounded-2xl border border-border overflow-hidden">
            {LANGUAGES.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleSelectLanguage(lang.code)}
                disabled={isUpdating}
                className={`flex-row items-center justify-between p-4 ${
                  index < LANGUAGES.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <View className="flex-row items-center flex-1">
                  <View 
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      language === lang.code ? "bg-primary" : "bg-muted/20"
                    }`}
                  >
                    <Text 
                      className={`text-lg font-bold ${
                        language === lang.code ? "text-white" : "text-muted"
                      }`}
                    >
                      {lang.code.toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View>
                    <Text 
                      className={`font-semibold ${
                        language === lang.code ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {lang.name}
                    </Text>
                    <Text className="text-muted text-sm">{lang.nativeName}</Text>
                  </View>
                </View>
                {language === lang.code && (
                  <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info Card */}
        <View className="px-6 mt-6">
          <View className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
            <View className="flex-row items-start">
              <MaterialIcons name="translate" size={20} color="#22C55E" />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-medium mb-1">
                  About Languages
                </Text>
                <Text className="text-muted text-sm leading-5">
                  LTC FAST TRACK supports multiple Zambian languages to make 
                  waste management services accessible to everyone. Translations 
                  are provided for key interface elements.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Language Details */}
        <View className="px-6 mt-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            Supported Languages
          </Text>
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="mb-3">
              <Text className="text-foreground font-medium">English</Text>
              <Text className="text-muted text-sm">
                Default language with full translation coverage.
              </Text>
            </View>
            <View className="mb-3 pt-3 border-t border-border">
              <Text className="text-foreground font-medium">Ichibemba (Bemba)</Text>
              <Text className="text-muted text-sm">
                Widely spoken in Northern, Luapula, and Copperbelt provinces.
              </Text>
            </View>
            <View className="mb-3 pt-3 border-t border-border">
              <Text className="text-foreground font-medium">Chinyanja (Nyanja)</Text>
              <Text className="text-muted text-sm">
                Common in Eastern Province and Lusaka.
              </Text>
            </View>
            <View className="pt-3 border-t border-border">
              <Text className="text-foreground font-medium">Chitonga (Tonga)</Text>
              <Text className="text-muted text-sm">
                Spoken in Southern Province.
              </Text>
            </View>
          </View>
        </View>

        {/* Current Selection */}
        <View className="px-6 mt-6">
          <View className="bg-success/10 rounded-xl p-4 border border-success/20">
            <View className="flex-row items-center">
              <MaterialIcons name="check-circle" size={20} color="#22C55E" />
              <Text className="text-foreground font-medium ml-3">
                Current: {LANGUAGES.find(l => l.code === language)?.name} ({LANGUAGES.find(l => l.code === language)?.nativeName})
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
});

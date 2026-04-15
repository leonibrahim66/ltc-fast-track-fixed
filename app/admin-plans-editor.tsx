import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

interface EditablePlan {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  billingPeriod: string;
  pickupsPerMonth: number;
  binSize: string;
  features: string[];
  isPopular: boolean;
}

const DEFAULT_PLANS: EditablePlan[] = [
  {
    id: 'residential-basic',
    name: 'Basic',
    category: 'Residential',
    price: 500,
    currency: 'K',
    billingPeriod: 'month',
    pickupsPerMonth: 4,
    binSize: '240L',
    features: ['Weekly pickups', 'Standard bin', 'Email support'],
    isPopular: false,
  },
  {
    id: 'residential-premium',
    name: 'Premium',
    category: 'Residential',
    price: 800,
    currency: 'K',
    billingPeriod: 'month',
    pickupsPerMonth: 8,
    binSize: '240L',
    features: ['Bi-weekly pickups', 'Standard bin', 'Phone support'],
    isPopular: true,
  },
  {
    id: 'commercial-basic',
    name: 'Basic',
    category: 'Commercial',
    price: 1200,
    currency: 'K',
    billingPeriod: 'month',
    pickupsPerMonth: 8,
    binSize: '660L',
    features: ['Weekly pickups', 'Large bin', 'Business support'],
    isPopular: false,
  },
  {
    id: 'industrial-basic',
    name: 'Basic',
    category: 'Industrial',
    price: 2000,
    currency: 'K',
    billingPeriod: 'month',
    pickupsPerMonth: 8,
    binSize: '1100L',
    features: ['Priority scheduling', 'Large bin', 'Dedicated manager'],
    isPopular: false,
  },
];

export default function AdminPlansEditor() {
  const colors = useColors();
  const [plans, setPlans] = useState<EditablePlan[]>(DEFAULT_PLANS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState('');

  const handleUpdatePlan = (id: string, updates: Partial<EditablePlan>) => {
    setPlans(plans.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleAddFeature = (planId: string) => {
    if (!newFeature.trim()) {
      Alert.alert('Error', 'Please enter a feature');
      return;
    }
    
    setPlans(
      plans.map(p =>
        p.id === planId
          ? { ...p, features: [...p.features, newFeature] }
          : p
      )
    );
    setNewFeature('');
  };

  const handleRemoveFeature = (planId: string, featureIndex: number) => {
    setPlans(
      plans.map(p =>
        p.id === planId
          ? { ...p, features: p.features.filter((_, i) => i !== featureIndex) }
          : p
      )
    );
  };

  const handleSavePlans = () => {
    Alert.alert('Success', 'Subscription plans updated successfully');
  };

  const handleTogglePopular = (id: string) => {
    setPlans(
      plans.map(p =>
        p.id === id ? { ...p, isPopular: !p.isPopular } : p
      )
    );
  };

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Subscription Plans</Text>
        <View className="w-6" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {plans.map((plan) => (
          <View key={plan.id} className="bg-surface border border-border rounded-lg overflow-hidden">
            <TouchableOpacity
              onPress={() => setEditingId(editingId === plan.id ? null : plan.id)}
              className="flex-row items-center justify-between p-4 border-b border-border"
            >
              <View className="flex-1">
                <Text className="text-lg font-bold text-foreground">{plan.name}</Text>
                <Text className="text-sm text-muted mt-1">{plan.category}</Text>
              </View>
              <View className="items-end gap-2">
                <Text className="text-xl font-bold text-primary">
                  {plan.currency}{plan.price}
                </Text>
                <Text className="text-xs text-muted">/{plan.billingPeriod}</Text>
              </View>
            </TouchableOpacity>

            {editingId === plan.id && (
              <View className="p-4 gap-4">
                <View>
                  <Text className="text-sm font-semibold text-muted mb-2">Plan Name</Text>
                  <TextInput
                    value={plan.name}
                    onChangeText={(text) => handleUpdatePlan(plan.id, { name: text })}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View>
                  <Text className="text-sm font-semibold text-muted mb-2">Price</Text>
                  <View className="flex-row gap-2">
                    <TextInput
                      value={plan.currency}
                      onChangeText={(text) => handleUpdatePlan(plan.id, { currency: text })}
                      placeholder="K"
                      className="w-16 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      placeholderTextColor={colors.muted}
                    />
                    <TextInput
                      value={plan.price.toString()}
                      onChangeText={(text) =>
                        handleUpdatePlan(plan.id, { price: parseFloat(text) || 0 })
                      }
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-sm font-semibold text-muted mb-2">Pickups Per Month</Text>
                  <TextInput
                    value={plan.pickupsPerMonth.toString()}
                    onChangeText={(text) =>
                      handleUpdatePlan(plan.id, { pickupsPerMonth: parseInt(text) || 0 })
                    }
                    placeholder="0"
                    keyboardType="number-pad"
                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => handleTogglePopular(plan.id)}
                  className={`flex-row items-center justify-between p-3 rounded-lg ${
                    plan.isPopular ? 'bg-primary/10' : 'bg-background border border-border'
                  }`}
                >
                  <Text className="font-semibold text-foreground">Mark as Popular</Text>
                  <View
                    className={`w-10 h-6 rounded-full items-center justify-center ${
                      plan.isPopular ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <MaterialIcons
                      name={plan.isPopular ? 'check' : 'close'}
                      size={16}
                      color="white"
                    />
                  </View>
                </TouchableOpacity>

                <View>
                  <Text className="text-sm font-semibold text-muted mb-2">Features</Text>
                  <View className="gap-2 mb-3">
                    {plan.features.map((feature, index) => (
                      <View key={index} className="flex-row items-center justify-between bg-background border border-border rounded-lg p-2">
                        <Text className="flex-1 text-foreground text-sm">{feature}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveFeature(plan.id, index)}
                          className="p-1 active:opacity-70"
                        >
                          <MaterialIcons name="close" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <View className="flex-row gap-2">
                    <TextInput
                      value={newFeature}
                      onChangeText={setNewFeature}
                      placeholder="Add feature..."
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      placeholderTextColor={colors.muted}
                    />
                    <TouchableOpacity
                      onPress={() => handleAddFeature(plan.id)}
                      className="bg-primary rounded-lg px-4 items-center justify-center active:opacity-80"
                    >
                      <MaterialIcons name="add" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {editingId !== plan.id && (
              <View className="px-4 py-3 bg-background/50">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-muted">Pickups/Month:</Text>
                  <Text className="text-xs font-semibold text-foreground">{plan.pickupsPerMonth}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">Bin Size:</Text>
                  <Text className="text-xs font-semibold text-foreground">{plan.binSize}</Text>
                </View>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          onPress={handleSavePlans}
          className="bg-primary rounded-lg py-3 items-center active:opacity-80 mt-4"
        >
          <Text className="text-background font-semibold">Save All Plans</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

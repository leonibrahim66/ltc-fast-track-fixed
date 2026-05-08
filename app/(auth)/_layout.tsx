import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role-select" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="carrier-login" />
      <Stack.Screen name="driver-register" />
      <Stack.Screen name="register-collector" />
      <Stack.Screen name="register-garbage-driver" />
      <Stack.Screen name="register-recycler" />
    </Stack>
  );
}
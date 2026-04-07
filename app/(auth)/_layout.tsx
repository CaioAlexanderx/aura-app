import { Stack } from "expo-router";
import { Colors } from "@/constants/colors";
import { ToastContainer } from "@/components/Toast";

export default function AuthLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      />
      <ToastContainer />
    </>
  );
}

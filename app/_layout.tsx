import { Stack } from "expo-router";
import { TripProvider } from "./context/TripContext";
import "./global.css";
// for testing
// import { useEffect } from "react";
// import { registerForPushNotificationsAsync } from "./context/notificationService";


export default function RootLayout() {
  return (
    <TripProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "white" },
        }}
      />
    </TripProvider>
  );
}

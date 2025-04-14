import { Stack } from "expo-router";
import { TripProvider } from "./context/TripContext";
import "./global.css";


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

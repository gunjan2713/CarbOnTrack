// import { Stack } from "expo-router";
// import { TripProvider } from "./context/TripContext";
// import { AuthProvider } from "./context/AuthContext";
// import "./global.css";

// export default function RootLayout() {
//   return (
//     <AuthProvider>
//       <TripProvider>
//         <Stack screenOptions={{ headerShown: false }}>
//           {/* List ALL possible screens here, regardless of auth state */}
//           <Stack.Screen name="index" />
//           <Stack.Screen name="home" />
//           <Stack.Screen name="screens/LoginScreen" />
//           <Stack.Screen name="screens/RegisterScreen" />
//           <Stack.Screen name="screens/TripHistoryScreen" />
//           <Stack.Screen name="screens/ProfileScreen" />
//           <Stack.Screen name="screens/VisualisationScreen" />

//         </Stack>
//       </TripProvider>
//     </AuthProvider>
//   );
// }

import { Slot } from "expo-router";
import { TripProvider } from "./context/TripContext";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import "./global.css"; // Tailwind styles

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <TripProvider>
          <Slot />
        </TripProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

// import { Stack } from "expo-router";
// import { TripProvider } from "./context/TripContext";
// import { AuthProvider, useAuth } from "./context/AuthContext";
// import { View, Text, ActivityIndicator } from "react-native"
// import "./global.css";
// // for testing
// // import { useEffect } from "react";
// // import { registerForPushNotificationsAsync } from "./context/notificationService";

// // Loading screen while authentication state is being checked
// function LoadingScreen() {
//   return (
//     <View className="flex-1 justify-center items-center bg-white">
//       <ActivityIndicator size="large" color="#005eff" />
//       <Text className="mt-4 text-primary-500 font-semibold">Loading CarbOnTrack...</Text>
//     </View>
//   );
// }

// // Layout with authentication flow
// function RootLayoutNav() {
//   const { user, loading } = useAuth();
//   console.log("Auth state:", { user: user?.email, loading });

//   // Show loading screen while determining auth state
//   if (loading) {
//     return <LoadingScreen />;
//   }

//   return (
//     <TripProvider>
//       <Stack
//         screenOptions={{
//           headerShown: false,
//           contentStyle: { backgroundColor: "white" },
//         }}
//       >
//         {user ? (
//           // Authenticated routes
//           <>
//             <Stack.Screen name="home" />
//             <Stack.Screen name="screens/TripHistoryScreen" options={{ title: "Trip History" }} />
//             <Stack.Screen name="screens/ProfileScreen" options={{ title: "Profile" }} />
//             <Stack.Screen name="index" options={{ title: "Splash Screen" }} />
//           </>
//         ) : (
//           // Unauthenticated routes
//           <>
//             <Stack.Screen name="screens/LoginScreen" options={{ title: "Login" }} />
//             <Stack.Screen name="screens/RegisterScreen" options={{ title: "Register" }} />
//             <Stack.Screen name="index" options={{ title: "Splash Screen" }} />
//           </>
//         )}
//       </Stack>
//     </TripProvider>
//   );
// }

// export default function RootLayout() {
//   return (
//     <AuthProvider>
//       <RootLayoutNav />
//     </AuthProvider>
//   );
// }

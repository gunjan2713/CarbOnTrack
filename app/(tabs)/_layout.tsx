import { Tabs } from "expo-router";
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: '#005eff',
      tabBarInactiveTintColor: '#666666',
    }}>
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="TripHistoryScreen" 
        options={{ 
          title: "Trips",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="VisualizationScreen" 
        options={{ 
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="LeaderboardScreen" 
        options={{ 
          title: "Leaders",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="podium-outline" size={size} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="ProfileScreen" 
        options={{ 
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          )
        }} 
      />
    </Tabs>
  );
}
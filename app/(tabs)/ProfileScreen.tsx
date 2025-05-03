import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { tripHistory, loadTripHistory } = useTrip();
  const router = useRouter();

  // Calculate total stats
  const calculateStats = () => {
    const totalEmissions = tripHistory.reduce((sum, trip) => sum + (trip.carbonEmissions || 0), 0);
    const totalDistance = tripHistory.reduce((sum, trip) => sum + trip.distance, 0);
    
    // Count trips by transport mode
    const transportCounts: Record<string, number> = {};
    tripHistory.forEach(trip => {
      if (trip.transportMode) {
        const mode = trip.transportMode.name;
        transportCounts[mode] = (transportCounts[mode] || 0) + 1;
      }
    });
    
    // Find most used transport mode
    let mostUsedMode = 'None';
    let maxCount = 0;
    
    for (const [mode, count] of Object.entries(transportCounts)) {
      if (count > maxCount) {
        mostUsedMode = mode;
        maxCount = count as number;
      }
    }
    
    return {
      totalEmissions,
      totalDistance,
      tripCount: tripHistory.length,
      mostUsedMode
    };
  };

  const stats = calculateStats();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/screens/LoginScreen');
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-500 pt-12 pb-6 px-4">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">My Profile</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* User Info Card */}
        <View className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <View className="items-center mb-4">
            <View className="w-20 h-20 bg-primary-100 rounded-full justify-center items-center mb-2">
              <Text className="text-3xl text-primary-500">
                {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </Text>
            </View>
            <Text className="text-xl font-bold">{user?.displayName || 'User'}</Text>
            <Text className="text-gray-500">{user?.email}</Text>
          </View>
          
          <TouchableOpacity 
            className="bg-primary-500 py-3 rounded-lg items-center"
            onPress={() => loadTripHistory()}
          >
            <Text className="text-white font-medium">Refresh Data</Text>
          </TouchableOpacity>
        </View>
        
        {/* Stats Card */}
        <View className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <Text className="text-lg font-semibold mb-4">Your Impact</Text>
          
          <View className="grid grid-cols-2 gap-4">
            <View className="bg-blue-50 p-3 rounded-lg">
              <Text className="text-blue-800">Total Trips</Text>
              <Text className="text-2xl font-bold text-blue-800">{stats.tripCount}</Text>
            </View>
            
            <View className="bg-green-50 p-3 rounded-lg">
              <Text className="text-green-800">Total Distance</Text>
              <Text className="text-2xl font-bold text-green-800">{stats.totalDistance.toFixed(2)} km</Text>
            </View>
            
            <View className="bg-amber-50 p-3 rounded-lg">
              <Text className="text-amber-800">Carbon Emissions</Text>
              <Text className="text-2xl font-bold text-amber-800">{stats.totalEmissions.toFixed(2)} kg</Text>
            </View>
            
            <View className="bg-purple-50 p-3 rounded-lg">
              <Text className="text-purple-800">Favorite Transport</Text>
              <Text className="text-2xl font-bold text-purple-800">{stats.mostUsedMode}</Text>
            </View>
          </View>
        </View>
        
        {/* Options */}
        <View className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <Text className="text-lg font-semibold mb-4">Options</Text>
          
          <TouchableOpacity 
            className="flex-row items-center py-3 border-b border-gray-100"
            onPress={() => router.push('/screens/TripHistoryScreen')}
          >
            <Ionicons name="list-outline" size={24} color="#666" />
            <Text className="text-base ml-3">Trip History</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-row items-center py-3"
            onPress={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')}
          >
            <Ionicons name="settings-outline" size={24} color="#666" />
            <Text className="text-base ml-3">App Settings</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          className="bg-red-500 py-4 rounded-lg items-center mb-10"
          onPress={handleLogout}
        >
          <Text className="text-white font-bold">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

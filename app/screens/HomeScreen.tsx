import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTrip, TransportMode } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const {
    trip,
    isDetectingTrip,
    currentLocation,
    transportModes,
    startTripDetection,
    stopTripDetection,
    startTrip,
    endTrip,
    selectTransportMode,
    showTransportModal,
    setShowTransportModal,
    tripHistory,
    loadTripHistory
  } = useTrip();

  const { user, logout } = useAuth();
  const router = useRouter();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  
  // Start trip detection when component loads and load trip history
  useEffect(() => {
    startTripDetection();
    loadTripHistory();
    
    return () => {
      stopTripDetection();
    };
  }, []);

  
  
  // Timer for active trip
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (trip?.isActive) {
      interval = setInterval(() => {
        const startTime = trip.startTime.getTime();
        const now = Date.now();
        setElapsedTime(now - startTime);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trip?.isActive, trip?.startTime]);
  
  // Format elapsed time as HH:MM:SS
  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle transport mode selection
  const handleSelectTransport = (mode: TransportMode) => {
    selectTransportMode(mode);
    setShowTransportModal(false);
  };
  
  // Calculate total carbon footprint from trip history
  const getTotalCarbonFootprint = () => {
    return tripHistory.reduce((total, trip) => total + (trip.carbonEmissions || 0), 0);
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      // End any active trip first
      if (trip?.isActive) {
        await endTrip();
      }
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };
  
  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-primary-500 pt-12 pb-6 px-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-2xl font-bold">CarbOnTrack</Text>
          <TouchableOpacity onPress={() => setIsLogoutModalVisible(true)}>
            <Ionicons name="menu-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* User Info */}
        {user && (
          <View className="mt-2">
            <Text className="text-white opacity-80">Hello, {user.displayName || 'User'}</Text>
          </View>
        )}
      </View>
      
      {/* Main Content */}
      <ScrollView className="flex-1 px-4 py-6">
        {/* Trip Status Card */}
        <View className="bg-white rounded-xl shadow-md p-5 mb-6">
          <Text className="text-lg font-semibold mb-2">
            {trip?.isActive ? 'Trip in Progress' : 'No Active Trip'}
          </Text>
          
          {trip?.isActive ? (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-gray-500">Duration</Text>
                  <Text className="text-xl font-bold">{formatElapsedTime(elapsedTime)}</Text>
                </View>
                <View>
                  <Text className="text-gray-500">Distance</Text>
                  <Text className="text-xl font-bold">{trip.distance.toFixed(2)} km</Text>
                </View>
                <View>
                  <Text className="text-gray-500">Speed</Text>
                  <Text className="text-xl font-bold">
                    {currentLocation ? `${Math.round(currentLocation.speed)} km/h` : '0 km/h'}
                  </Text>
                </View>
              </View>
              
              {/* Transport Mode */}
              <TouchableOpacity
                className="flex-row items-center p-3 bg-gray-100 rounded-lg mb-4"
                onPress={() => setShowTransportModal(true)}
              >
                <Text className="text-lg mr-2">
                  {trip.transportMode ? trip.transportMode.icon : '🚗'}
                </Text>
                <Text className="flex-1 text-base">
                  {trip.transportMode ? trip.transportMode.name : 'Select Transport Mode'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              
              {/* Carbon Emissions */}
              {trip.transportMode && (
                <View className="bg-green-50 p-3 rounded-lg">
                  <Text className="text-green-800 font-semibold">Carbon Emissions</Text>
                  <Text className="text-2xl font-bold text-green-800">
                    {(trip.distance * trip.transportMode.emissionFactor).toFixed(2)} kg CO₂
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View className="items-center py-6">
              {isDetectingTrip ? (
                <>
                  <ActivityIndicator size="large" color="#005eff" />
                  <Text className="text-gray-500 mt-3">
                    Monitoring for trip activity...
                  </Text>
                  {currentLocation && (
                    <Text className="text-gray-500 mt-1">
                      Current speed: {Math.round(currentLocation.speed)} km/h
                    </Text>
                  )}
                </>
              ) : (
                <Text className="text-gray-500">
                  Trip detection is not active
                </Text>
              )}
            </View>
          )}
          
          {/* Action Buttons */}
          <View className="flex-row justify-center mt-4">
            {trip?.isActive ? (
              <TouchableOpacity
                className="bg-accent-500 py-3 px-8 rounded-full"
                onPress={endTrip}
              >
                <Text className="text-white font-bold">End Trip</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="bg-primary-500 py-3 px-8 rounded-full"
                onPress={isDetectingTrip ? startTrip : startTripDetection}
              >
                <Text className="text-white font-bold">
                  {isDetectingTrip ? 'Start Trip Manually' : 'Start Trip Detection'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Total Carbon Footprint Card */}
        <View className="bg-white rounded-xl shadow-md p-5 mb-6">
          <Text className="text-lg font-semibold mb-3">Carbon Footprint Summary</Text>
          
          <View className="flex-row items-center bg-green-50 p-4 rounded-lg mb-4">
            <Ionicons name="leaf-outline" size={36} color="#059669" />
            <View className="ml-3">
              <Text className="text-green-800">Total Carbon Emissions</Text>
              <Text className="text-3xl font-bold text-green-800">
                {getTotalCarbonFootprint().toFixed(2)} kg CO₂
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            className="flex-row items-center justify-between p-3 bg-gray-100 rounded-lg"
            onPress={() => router.push('/(tabs)/TripHistoryScreen')
            }
          >
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={24} color="#666" />
              <Text className="text-base ml-2">View Trip History</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        
        {/* How It Works Card */}
        <View className="bg-white rounded-xl shadow-md p-5">
          <Text className="text-lg font-semibold mb-2">How It Works</Text>
          <Text className="text-gray-700 mb-2">
            • Trip detection activates when your speed exceeds 20 km/h
          </Text>
          <Text className="text-gray-700 mb-2">
            • Select your transport mode to calculate emissions
          </Text>
          <Text className="text-gray-700 mb-2">
            • You'll receive a notification when a trip is detected
          </Text>
          <Text className="text-gray-700">
            • Trip automatically ends after 3 minutes of being stationary
          </Text>
        </View>
      </ScrollView>
      
      {/* Transport Mode Selection Modal */}
      <Modal
        visible={showTransportModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-3xl p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">Select Transport Mode</Text>
              <TouchableOpacity onPress={() => setShowTransportModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView className="max-h-96">
              {transportModes.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  className="flex-row items-center p-4 border-b border-gray-200"
                  onPress={() => handleSelectTransport(mode)}
                >
                  <Text className="text-2xl mr-3">{mode.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-lg">{mode.name}</Text>
                    <Text className="text-gray-500">
                      {mode.emissionFactor} kg CO₂/km
                    </Text>
                  </View>
                  {trip?.transportMode?.id === mode.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#005eff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Logout Modal */}
      <Modal
        visible={isLogoutModalVisible}
        animationType="fade"
        transparent={true}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-xl p-5 w-4/5">
            <Text className="text-xl font-bold mb-4">Menu</Text>
            
            <TouchableOpacity 
              className="flex-row items-center p-4 border-b border-gray-200"
              onPress={() => {
                setIsLogoutModalVisible(false);
                router.push('/(tabs)/TripHistoryScreen');

              }}
            >
              <Ionicons name="time-outline" size={24} color="#005eff" />
              <Text className="text-lg ml-3">Trip History</Text>
            </TouchableOpacity>
            {/* Add Profile option here */}
            <TouchableOpacity 
              className="flex-row items-center p-4 border-b border-gray-200"
              onPress={() => {
                setIsLogoutModalVisible(false);
                router.push('/(tabs)/ProfileScreen');
              }}
            >
              <Ionicons name="person-outline" size={24} color="#005eff" />
              <Text className="text-lg ml-3">Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-row items-center p-4"
              onPress={() => {
                setIsLogoutModalVisible(false);
                handleLogout();
              }}
            >
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              <Text className="text-lg ml-3 text-red-500">Logout</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="mt-4 p-3 bg-gray-100 rounded-lg items-center"
              onPress={() => setIsLogoutModalVisible(false)}
            >
              <Text className="font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
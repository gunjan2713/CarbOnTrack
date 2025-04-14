import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTrip, TransportMode } from '../context/TripContext';
import { Ionicons } from '@expo/vector-icons';
// this is just for test the notification functionality.
// import { sendTripDetectionNotification } from '../context/notificationService';

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
    setShowTransportModal
  } = useTrip();

  // const [showTransportModal, setShowTransportModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Start trip detection when component loads
  useEffect(() => {
    startTripDetection();
    
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
  
  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-primary-500 pt-12 pb-6 px-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-2xl font-bold">CarbOnTrack</Text>
          <TouchableOpacity>
            <Ionicons name="settings-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Main Content */}
      <View className="flex-1 px-4 py-6">
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
        
        {/* Status Information */}
        <View className="bg-white rounded-xl shadow-md p-5">
          <Text className="text-lg font-semibold mb-2">How It Works</Text>
          <Text className="text-gray-700 mb-2">
            • Trip detection activates when your speed exceeds 20 km/h
          </Text>
          <Text className="text-gray-700 mb-2">
            • Select your transport mode to calculate emissions
          </Text>
          {/* ADD THIS NEW LINE */}
          <Text className="text-gray-700 mb-2">
            • You'll receive a notification when a trip is detected
          </Text>
          <Text className="text-gray-700">
            • Trip automatically ends after 3 minutes of being stationary
          </Text>
        </View>
      </View>
      
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
    </View>
  );
}
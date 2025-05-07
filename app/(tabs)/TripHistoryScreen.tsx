import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert,
  Modal,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrip, Trip, TransportMode } from '../context/TripContext';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { firestore } from '@/firebase';
import { useAuth } from '../context/AuthContext';

// Edit Mode Modal Component
const EditTripModal = ({ 
  visible, 
  trip, 
  transportModes,
  onClose, 
  onSave 
}: { 
  visible: boolean; 
  trip: Trip | null;
  transportModes: TransportMode[];
  onClose: () => void; 
  onSave: (trip: Trip, newTransportMode: TransportMode) => void;
}) => {
  const [selectedMode, setSelectedMode] = useState<TransportMode | null>(trip?.transportMode || null);

  // Reset selected mode when trip changes
  useEffect(() => {
    if (trip) {
      setSelectedMode(trip.transportMode || null);
    }
  }, [trip]);

  // Calculate new emissions based on selected transport mode
  const calculateNewEmissions = (mode: TransportMode): number => {
    if (!trip) return 0;
    return trip.distance * mode.emissionFactor;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
    >
      <View className="flex-1 justify-end bg-black bg-opacity-50">
        <View className="bg-white rounded-t-3xl p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold">Edit Trip</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {trip && (
            <View className="mb-4">
              <Text className="text-gray-700">Date: {format(new Date(trip.startTime), 'MMM d, yyyy')}</Text>
              <Text className="text-gray-700">Time: {format(new Date(trip.startTime), 'h:mm a')}</Text>
              <Text className="text-gray-700">Distance: {trip.distance.toFixed(2)} km</Text>
              <Text className="text-gray-700">Current Emissions: {trip.carbonEmissions?.toFixed(2) || '0'} kg CO₂</Text>
            </View>
          )}
          
          <Text className="text-lg font-semibold mb-2">Select Transport Mode</Text>
          <ScrollView className="max-h-72 mb-4">
            {transportModes.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                className={`flex-row items-center p-4 border-b border-gray-200 ${
                  selectedMode?.id === mode.id ? 'bg-blue-50' : ''
                }`}
                onPress={() => setSelectedMode(mode)}
              >
                <Text className="text-2xl mr-3">{mode.icon}</Text>
                <View className="flex-1">
                  <Text className="text-lg">{mode.name}</Text>
                  <Text className="text-gray-500">{mode.emissionFactor} kg CO₂/km</Text>
                </View>
                <View>
                  {selectedMode?.id === mode.id ? (
                    <Ionicons name="checkmark-circle" size={24} color="#005eff" />
                  ) : (
                    <Text className="text-gray-500">
                      {trip ? calculateNewEmissions(mode).toFixed(2) + ' kg' : ''}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View className="flex-row space-x-2">
            <TouchableOpacity 
              className="flex-1 bg-gray-200 py-3 rounded-lg items-center"
              onPress={onClose}
            >
              <Text className="font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className={`flex-1 py-3 rounded-lg items-center ${
                selectedMode ? 'bg-primary-500' : 'bg-gray-300'
              }`}
              disabled={!selectedMode}
              onPress={() => {
                if (trip && selectedMode) {
                  onSave(trip, selectedMode);
                }
              }}
            >
              <Text className={`font-medium ${selectedMode ? 'text-white' : 'text-gray-500'}`}>
                Save Changes
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Trip Card Component
const TripCard = ({ 
  trip, 
  onEditPress,
  onDeletePress
}: { 
  trip: Trip; 
  onEditPress: (trip: Trip) => void;
  onDeletePress: (trip: Trip) => void;
}) => {
  const formattedDate = format(new Date(trip.startTime), 'MMM d, yyyy');
  const formattedTime = format(new Date(trip.startTime), 'h:mm a');
  const duration = trip.endTime 
    ? ((new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime()) / (1000 * 60))
    : 0;

  return (
    <View className="bg-white rounded-xl shadow-sm p-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-lg font-semibold">{formattedDate}</Text>
        <Text className="text-gray-500">{formattedTime}</Text>
      </View>
      
      <View className="flex-row items-center mb-3">
        <Text className="text-2xl mr-2">{trip.transportMode?.icon || '🚗'}</Text>
        <Text className="text-base font-medium">{trip.transportMode?.name || 'Unknown'}</Text>
      </View>
      
      <View className="flex-row justify-between mb-3">
        <View>
          <Text className="text-gray-500 text-sm">Distance</Text>
          <Text className="font-bold">{trip.distance.toFixed(2)} km</Text>
        </View>
        
        <View>
          <Text className="text-gray-500 text-sm">Duration</Text>
          <Text className="font-bold">{duration.toFixed(1)} min</Text>
        </View>
        
        <View>
          <Text className="text-gray-500 text-sm">Carbon</Text>
          <Text className="font-bold">{trip.carbonEmissions?.toFixed(2) || '0'} kg</Text>
        </View>
      </View>
      
      {/* Action buttons */}
      <View className="flex-row justify-end">
        <TouchableOpacity 
          className="mr-3 flex-row items-center"
          onPress={() => onEditPress(trip)}
        >
          <Ionicons name="pencil-outline" size={16} color="#005eff" />
          <Text className="text-primary-600 ml-1">Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="flex-row items-center"
          onPress={() => onDeletePress(trip)}
        >
          <Ionicons name="trash-outline" size={16} color="#dc2626" />
          <Text className="text-red-600 ml-1">Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function TripHistoryScreen() {
  const { tripHistory, loadTripHistory, isLoadingHistory, transportModes } = useTrip();
  const { user } = useAuth();
  const router = useRouter();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localTripHistory, setLocalTripHistory] = useState<Trip[]>([]);
  
  // Use local state to track trip history for immediate UI updates
  useEffect(() => {
    setLocalTripHistory(tripHistory);
  }, [tripHistory]);

  // Load trip history on component mount
  useEffect(() => {
    loadTripHistory();
  }, []);

  // Generate CSV for download
  const generateCSV = () => {
    const header = "Date,Time,Transport Mode,Distance (km),Duration (min),Carbon Emissions (kg)\n";
    const rows = localTripHistory.map(trip => {
      const date = format(new Date(trip.startTime), 'MMM d, yyyy');
      const time = format(new Date(trip.startTime), 'h:mm a');
      const mode = trip.transportMode?.name || 'Unknown';
      const distance = trip.distance.toFixed(2);
      const duration = trip.endTime 
        ? ((new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime()) / (1000 * 60)).toFixed(1)
        : '0';
      const carbon = (trip.carbonEmissions || 0).toFixed(2);
      return `${date},${time},${mode},${distance},${duration},${carbon}`;
    });

    return header + rows.join("\n");
  };

  // Download report as CSV
  const downloadReport = async () => {
    try {
      const csv = generateCSV();
      const fileName = FileSystem.documentDirectory + `trip-history-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileName, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileName);
    } catch (error) {
      Alert.alert("Error", "Could not download the report.");
    }
  };

  // Handle editing a trip's transport mode
  const handleEditPress = (trip: Trip) => {
    setCurrentTrip(trip);
    setEditModalVisible(true);
  };

  // Save the edited trip
  const handleSaveEdit = async (trip: Trip, newTransportMode: TransportMode) => {
    if (!user) return;

    try {
      // Calculate new emissions
      const newEmissions = trip.distance * newTransportMode.emissionFactor;
      
      // Update in Firestore
      const tripRef = doc(firestore, 'users', user.uid, 'trips', trip.id);
      
      // Verify that the document still exists before updating
      const tripSnapshot = await getDoc(tripRef);
      if (!tripSnapshot.exists()) {
        Alert.alert("Error", "This trip no longer exists in the database.");
        setEditModalVisible(false);
        await loadTripHistory(); // Refresh to get accurate trip list
        return;
      }
      
      await updateDoc(tripRef, {
        transportMode: {
          id: newTransportMode.id,
          name: newTransportMode.name,
          emissionFactor: newTransportMode.emissionFactor,
          icon: newTransportMode.icon
        },
        carbonEmissions: newEmissions
      });
      
      // Update local state for immediate UI update
      const updatedTripHistory = localTripHistory.map(t => 
        t.id === trip.id ? {
          ...t,
          transportMode: newTransportMode,
          carbonEmissions: newEmissions
        } : t
      );
      
      setLocalTripHistory(updatedTripHistory);
      
      // Close modal
      setEditModalVisible(false);
      
      // Also reload trip history to ensure consistency with server
      loadTripHistory();
      
      Alert.alert(
        "Trip Updated", 
        `Transport mode updated to ${newTransportMode.name}. Carbon emissions: ${newEmissions.toFixed(2)} kg CO₂`
      );
    } catch (error) {
      console.error("Error updating trip:", error);
      Alert.alert("Error", "Failed to update trip. Please try again.");
    }
  };

  // Handle deleting a trip
  const handleDeletePress = (trip: Trip) => {
    Alert.alert(
      "Delete Trip",
      "Are you sure you want to delete this trip? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => confirmDeleteTrip(trip)
        }
      ]
    );
  };

  // Confirm and process trip deletion
  const confirmDeleteTrip = async (trip: Trip) => {
    if (!user) return;
    
    try {
      setIsDeleting(true);
      
      // First, update local state for immediate UI update
      const filteredHistory = localTripHistory.filter(t => t.id !== trip.id);
      setLocalTripHistory(filteredHistory);
      
      // Delete from Firestore
      const tripRef = doc(firestore, 'users', user.uid, 'trips', trip.id);
      
      // Check if document exists before deleting
      const tripSnapshot = await getDoc(tripRef);
      if (!tripSnapshot.exists()) {
        console.log("Trip document already deleted or does not exist");
        setIsDeleting(false);
        return;
      }
      
      // Perform the actual deletion
      await deleteDoc(tripRef);
      
      // After successful deletion, also reload data from server
      // This ensures synchronization between client and server
      setTimeout(() => {
        loadTripHistory();
        setIsDeleting(false);
      }, 500);
      
    } catch (error) {
      console.error("Error deleting trip:", error);
      Alert.alert("Error", "Failed to delete trip. Please try again.");
      setIsDeleting(false);
      // Reload trip data to ensure proper state
      loadTripHistory();
    }
  };

  // Refresh data with error handling
  const handleRefresh = useCallback(async () => {
    try {
      await loadTripHistory();
    } catch (error) {
      console.error("Error refreshing trips:", error);
      Alert.alert("Error", "Failed to refresh trip history. Please try again.");
    }
  }, [loadTripHistory]);

  // Render empty state
  const renderEmptyList = () => (
    <View className="flex-1 justify-center items-center py-10">
      <Ionicons name="car-outline" size={64} color="#ccc" />
      <Text className="text-gray-400 text-lg mt-4">No trips recorded yet</Text>
      <Text className="text-gray-400 text-center mx-10 mt-2">
        Your completed trips will appear here once you start tracking
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-500 pt-12 pb-6 px-4">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Trip History</Text>
          <TouchableOpacity onPress={downloadReport}>
            <Ionicons name="download-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Trip List */}
      <FlatList
        data={localTripHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard 
            trip={item} 
            onEditPress={handleEditPress}
            onDeletePress={handleDeletePress}
          />
        )}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingHistory || isDeleting}
            onRefresh={handleRefresh}
            colors={['#005eff']}
            tintColor="#005eff"
          />
        }
      />

      {/* Loading Overlay */}
      {(isLoadingHistory && localTripHistory.length === 0) ? (
        <View className="absolute inset-0 justify-center items-center bg-white bg-opacity-70">
          <ActivityIndicator size="large" color="#005eff" />
          <Text className="mt-2 text-primary-500">
            Loading trips...
          </Text>
        </View>
      ) : null}

      {/* Edit Modal */}
      <EditTripModal
        visible={editModalVisible}
        trip={currentTrip}
        transportModes={transportModes}
        onClose={() => {
          setEditModalVisible(false);
          setCurrentTrip(null);
        }}
        onSave={handleSaveEdit}
      />
    </View>
  );
}
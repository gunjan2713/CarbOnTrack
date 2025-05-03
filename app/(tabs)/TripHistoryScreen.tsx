import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrip, Trip } from '../context/TripContext';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Trip Card Component (same as before)

const TripCard = ({ trip }: { trip: Trip }) => {
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
      
      <View className="flex-row justify-between">
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
    </View>
  );
};

export default function TripHistoryScreen() {
  const { tripHistory, loadTripHistory, isLoadingHistory } = useTrip();
  const router = useRouter();

  useEffect(() => {
    loadTripHistory();
  }, []);

  const generateCSV = () => {
    const header = "Date,Time,Transport Mode,Distance (km),Duration (min),Carbon Emissions (kg)\n";
    const rows = tripHistory.map(trip => {
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
        data={tripHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TripCard trip={item} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingHistory}
            onRefresh={loadTripHistory}
            colors={['#005eff']}
            tintColor="#005eff"
          />
        }
      />

      {/* Loading Overlay */}
      {isLoadingHistory && tripHistory.length === 0 && (
        <View className="absolute inset-0 justify-center items-center bg-white bg-opacity-70">
          <ActivityIndicator size="large" color="#005eff" />
          <Text className="mt-2 text-primary-500">Loading trips...</Text>
        </View>
      )}
    </View>
  );
}

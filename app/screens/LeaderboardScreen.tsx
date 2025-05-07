import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrip } from '../context/TripContext';

type UserScore = {
  userId: string;
  name: string;
  totalEmissions: number;
};

export default function LeaderboardScreen() {
  const { tripHistory } = useTrip();
  const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock: group by user (assuming tripHistory has a `userId` or `userName` field)
    const emissionsMap: { [key: string]: UserScore } = {};

    tripHistory.forEach(trip => {
      const userId = trip.userId || 'Unknown'; // fallback if no ID
      const userName = trip.userName || 'Anonymous';

      if (!emissionsMap[userId]) {
        emissionsMap[userId] = {
          userId,
          name: userName,
          totalEmissions: 0
        };
      }

      emissionsMap[userId].totalEmissions += trip.carbonEmissions || 0;
    });

    const scores = Object.values(emissionsMap).sort((a, b) => a.totalEmissions - b.totalEmissions);
    setLeaderboard(scores);
    setLoading(false);
  }, [tripHistory]);

  const renderItem = ({ item, index }: { item: UserScore; index: number }) => {
    const medal = ['🥇', '🥈', '🥉'][index] || '🌱';
    return (
      <View className="bg-white p-4 mb-2 rounded-xl shadow flex-row justify-between items-center">
        <Text className="text-lg font-semibold">{medal} {item.name}</Text>
        <Text className="text-gray-700">{item.totalEmissions.toFixed(2)} kg CO₂</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#005eff" />
        <Text className="mt-4 text-primary-500">Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100 p-4">
      <Text className="text-2xl font-bold mb-4">🌍 Eco Leaderboard</Text>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
      />
    </View>
  );
}

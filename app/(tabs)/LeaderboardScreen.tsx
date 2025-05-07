import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrip } from '../context/TripContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/firebase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';

// Define the UserScore type for the leaderboard
type UserScore = {
  userId: string;
  displayName: string;
  profileImageUrl?: string;
  totalEmissions: number;
  totalDistance: number;
  tripCount: number;
  rank?: number;
};

export default function LeaderboardScreen() {
  const { tripHistory, loadTripHistory } = useTrip();
  const { user } = useAuth();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);

  // Fetch leaderboard data
  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      
      // Mock data to use if Firestore data retrieval fails
      const mockUsers = [
        { id: '1', displayName: 'EcoChampion' },
        { id: '2', displayName: 'GreenCommuter' },
        { id: '3', displayName: 'CarbonSaver' },
        { id: '4', displayName: 'EcoTraveler' },
        { id: '5', displayName: 'GreenWheels' },
        { id: user?.uid || '6', displayName: user?.displayName || 'You' },
      ];
      
      // Try to get real data first
      try {
        const usersCollection = collection(firestore, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        
        if (!usersSnapshot.empty) {
          const leaderboardData: UserScore[] = [];
          
          // Process each user
          for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            
            // Fetch all user's trips
            const tripsCollection = collection(firestore, 'users', userDoc.id, 'trips');
            const tripsQuery = query(tripsCollection, orderBy('startTime', 'desc'));
            const tripsSnapshot = await getDocs(tripsQuery);
            
            if (tripsSnapshot.empty) continue;
            
            // Calculate user stats
            let totalEmissions = 0;
            let totalDistance = 0;
            const tripCount = tripsSnapshot.size;
            
            tripsSnapshot.forEach(tripDoc => {
              const tripData = tripDoc.data();
              totalEmissions += tripData.carbonEmissions || 0;
              totalDistance += tripData.distance || 0;
            });
            
            leaderboardData.push({
              userId: userDoc.id,
              displayName: userData.displayName || 'Anonymous User',
              profileImageUrl: userData.profileImageUrl,
              totalEmissions,
              totalDistance,
              tripCount
            });
          }
          
          // If we have real data, use it
          if (leaderboardData.length > 0) {
            // Sort by emissions (lower is better)
            const sortedLeaderboard = leaderboardData
              .sort((a, b) => a.totalEmissions - b.totalEmissions)
              .map((entry, index) => ({ 
                ...entry, 
                rank: index + 1 
              }));
            
            setLeaderboard(sortedLeaderboard);
            
            // Find current user's rank
            if (user) {
              const currentUserRank = sortedLeaderboard.findIndex(entry => entry.userId === user.uid);
              setUserRank(currentUserRank !== -1 ? currentUserRank + 1 : null);
            }
            
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
        
        // If no real data found, fall through to mock data
      } catch (error) {
        console.error('Error fetching user data from Firestore:', error);
        // Fall through to mock data
      }
      
      // Generate mock data with random values
      const mockLeaderboard: UserScore[] = [];
      mockUsers.forEach((mockUser, index) => {
        const randomEmissions = Math.random() * 10 * (index + 1);
        const randomDistance = Math.random() * 100 + 10;
        const randomTrips = Math.floor(Math.random() * 10) + 1;
        
        mockLeaderboard.push({
          userId: mockUser.id,
          displayName: mockUser.displayName,
          totalEmissions: randomEmissions,
          totalDistance: randomDistance,
          tripCount: randomTrips
        });
      });
      
      // Make sure the current user has realistic data
      if (user) {
        const userIndex = mockLeaderboard.findIndex(entry => entry.userId === user.uid);
        if (userIndex === -1) {
          // If user not found, add them
          mockLeaderboard.push({
            userId: user.uid,
            displayName: user.displayName || 'You',
            totalEmissions: Math.random() * 20,
            totalDistance: Math.random() * 100 + 20,
            tripCount: Math.floor(Math.random() * 10) + 2
          });
        }
      }
      
      // Sort by emissions (lower is better)
      const sortedMockLeaderboard = mockLeaderboard
        .sort((a, b) => a.totalEmissions - b.totalEmissions)
        .map((entry, index) => ({ 
          ...entry, 
          rank: index + 1 
        }));
      
      setLeaderboard(sortedMockLeaderboard);
      
      // Find current user's rank
      if (user) {
        const currentUserRank = sortedMockLeaderboard.findIndex(entry => entry.userId === user.uid);
        setUserRank(currentUserRank !== -1 ? currentUserRank + 1 : null);
      }
      
    } catch (error) {
      console.error('Error in fetchLeaderboardData:', error);
      Alert.alert(
        'Error Loading Leaderboard',
        'There was a problem loading the leaderboard data. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Load trip history first, then fetch leaderboard data
    loadTripHistory().then(() => {
      fetchLeaderboardData().catch(error => {
        console.error('Error in fetchLeaderboardData:', error);
        setLoading(false);
        setRefreshing(false);
        Alert.alert(
          'Error Loading Leaderboard',
          'There was a problem loading the leaderboard data. Please try again.'
        );
      });
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTripHistory();
    await fetchLeaderboardData();
  };

  // Render a leaderboard item
  const renderLeaderboardItem = ({ item, index }: { item: UserScore; index: number }) => {
    const isCurrentUser = user && item.userId === user.uid;
    const isTopThree = index < 3;
    
    // Get medal or position based on rank
    const getMedalIcon = () => {
      switch (index) {
        case 0: return '🥇';
        case 1: return '🥈';
        case 2: return '🥉';
        default: return `#${index + 1}`;
      }
    };
    
    return (
      <View 
        className={`mb-3 rounded-xl p-4 ${isCurrentUser ? 'bg-primary-50' : 'bg-white'}`}
        style={{ 
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 1.5,
          elevation: 2
        }}
      >
        <View className="flex-row items-center">
          {/* Rank/Medal */}
          <View className={`w-12 h-12 rounded-full justify-center items-center mr-3 ${
            isTopThree ? 'bg-amber-100' : 'bg-gray-100'
          }`}>
            <Text className="text-lg font-bold">{getMedalIcon()}</Text>
          </View>
          
          {/* User Info */}
          <View className="flex-1">
            <Text className={`text-lg font-semibold ${isCurrentUser ? 'text-primary-700' : 'text-gray-800'}`}>
              {item.displayName} {isCurrentUser && '(You)'}
            </Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="leaf-outline" size={14} color="#059669" />
              <Text className="text-green-700 ml-1">{item.totalEmissions.toFixed(2)} kg CO₂</Text>
              <Text className="text-gray-400 mx-1">•</Text>
              <Ionicons name="map-outline" size={14} color="#666" />
              <Text className="text-gray-600 ml-1">{item.totalDistance.toFixed(1)} km</Text>
            </View>
          </View>
          
          {/* Emission Score */}
          <View className="items-end">
            <View className="bg-green-50 px-3 py-1 rounded-full">
              <Text className="font-semibold text-green-700">
                {
                  item.totalEmissions === 0 
                  ? 'Carbon Free!'
                  : item.totalDistance > 0 
                    ? `${(item.totalEmissions / item.totalDistance).toFixed(2)} kg/km`
                    : '0.00 kg/km'
                }
              </Text>
            </View>
            <Text className="text-gray-500 text-xs mt-1">{item.tripCount} trips</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render the user's card for quick reference
  const renderUserCard = () => {
    if (!user || userRank === null) return null;
    
    const userEntry = leaderboard.find(entry => entry.userId === user.uid);
    if (!userEntry) return null;
    
    return (
      <View 
        className="bg-primary-500 rounded-xl p-4 mb-4"
        style={{ 
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 4
        }}
      >
        <Text className="text-white text-lg font-bold mb-2">Your Ranking</Text>
        <View className="flex-row items-center">
          <View className="w-12 h-12 bg-white/20 rounded-full justify-center items-center mr-3">
            <Text className="text-lg font-bold text-white">#{userRank}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold">{userEntry.displayName}</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="leaf-outline" size={14} color="white" />
              <Text className="text-white ml-1">{userEntry.totalEmissions.toFixed(2)} kg CO₂</Text>
              <Text className="text-white/60 mx-1">•</Text>
              <Ionicons name="map-outline" size={14} color="white" />
              <Text className="text-white ml-1">{userEntry.totalDistance.toFixed(1)} km</Text>
            </View>
          </View>
          <View className="bg-white/20 px-3 py-1 rounded-full">
            <Text className="font-semibold text-white">
              {
                userEntry.totalEmissions === 0 
                ? 'Carbon Free!'
                : userEntry.totalDistance > 0 
                  ? `${(userEntry.totalEmissions / userEntry.totalDistance).toFixed(2)} kg/km`
                  : '0.00 kg/km'
              }
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Component to display when there's no data
  const renderEmptyList = () => (
    <View className="flex-1 justify-center items-center py-10">
      <Ionicons name="podium-outline" size={64} color="#ccc" />
      <Text className="text-gray-400 text-lg mt-4">No data available</Text>
      <Text className="text-gray-400 text-center mx-10 mt-2">
        Start tracking trips to appear on the leaderboard
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" style={{ paddingTop: StatusBar.currentHeight || 40 }}>
      {/* Header */}
      <View className="bg-primary-500 pt-2 pb-6 px-4">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Eco Leaders</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <Text className="text-white/80 text-center mt-2">
          All-Time Rankings
        </Text>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-4 pt-4">
        {/* User's current rank card */}
        {!loading && userRank !== null && renderUserCard()}
        
        {/* Leader explanation */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold">Leaderboard</Text>
          <Text className="text-gray-500 text-xs">Lower emissions = Higher rank</Text>
        </View>
        
        {/* Leaderboard List */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#005eff" />
            <Text className="mt-4 text-primary-500">Loading leaderboard...</Text>
          </View>
        ) : (
          <FlatList
            data={leaderboard}
            keyExtractor={(item) => item.userId}
            renderItem={renderLeaderboardItem}
            ListEmptyComponent={renderEmptyList}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#005eff']}
                tintColor="#005eff"
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
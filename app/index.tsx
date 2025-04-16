import { Redirect } from 'expo-router';
import { useAuth } from './context/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();
  
  console.log("Index screen - Auth state:", { user: user?.email, loading });
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#005eff" />
        <Text>Loading...</Text>
      </View>
    );
  }
  
  // Redirect based on authentication state
  return user ? <Redirect href="/screens/HomeScreen" /> : <Redirect href="/screens/LoginScreen" />;
}
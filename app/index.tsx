import { Redirect } from 'expo-router';
import { useAuth } from './context/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';

export default function Index() {
  const { user, loading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  console.log("Index screen - Auth state:", { user: user?.email, loading });

  useEffect(() => {
    if (!loading) {
      // Wait a moment to ensure auth state is stable
      const timer = setTimeout(() => {
        setShouldRedirect(true);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [loading, user]);
  
  if (loading|| !shouldRedirect) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#005eff" />
        <Text>Loading...</Text>
      </View>
    );
  }
  
  // Redirect based on authentication state
  // if (user) {
  //   // Add a small delay before redirecting to ensure layout is mounted
  //   setTimeout(() => {}, 100);
  //   return <Redirect href="/home" />;
  // }
  
  // return <Redirect href="/screens/LoginScreen" />;
  //
  return user ? <Redirect href="/home" /> : <Redirect href="/screens/LoginScreen" />;
}
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setIsLoading(true);
      await register(email, password, name);
      Alert.alert('Success', 'Your account has been created!', [
        { text: 'OK', onPress: () => router.replace('/home') }
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-white p-6 justify-center">
          {/* Header */}
          <View className="items-center mb-8">
            <Text className="text-5xl font-bold text-primary-500 mb-2">CarbOnTrack</Text>
            <Text className="text-lg text-gray-600 text-center">
              Create an account to start tracking
            </Text>
          </View>

          {/* Registration Form */}
          <View className="space-y-4 mb-6">
            <View>
              <Text className="text-gray-700 mb-2 font-medium">Name</Text>
              <TextInput
                className="bg-gray-50 p-4 rounded-lg text-gray-800"
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View>
              <Text className="text-gray-700 mb-2 font-medium">Email</Text>
              <TextInput
                className="bg-gray-50 p-4 rounded-lg text-gray-800"
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View>
              <Text className="text-gray-700 mb-2 font-medium">Password</Text>
              <TextInput
                className="bg-gray-50 p-4 rounded-lg text-gray-800"
                placeholder="Create a password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View>
              <Text className="text-gray-700 mb-2 font-medium">Confirm Password</Text>
              <TextInput
                className="bg-gray-50 p-4 rounded-lg text-gray-800"
                placeholder="Confirm your password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            className="bg-primary-500 py-4 rounded-lg items-center mb-4"
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-lg">Register</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('./LoginScreen')}>
              <Text className="text-primary-600 font-semibold">Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
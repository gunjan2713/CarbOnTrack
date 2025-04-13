import { Text, View, TouchableOpacity } from "react-native";
import {Link} from "expo-router"
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function Index() {

  const router = useRouter();

  // Automatically navigate to home screen after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/home");
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <View className="items-center">
        <Text className="text-5xl font-bold text-primary-500 mb-4">CarbOnTrack</Text>
        <Text className="text-lg text-gray-600 text-center px-10 mb-8">
          Track your trips and reduce your carbon footprint
        </Text>
        <TouchableOpacity
          className="bg-primary-500 py-3 px-8 rounded-full"
          onPress={() => router.replace("/home")}
        >
          <Text className="text-white font-bold">Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

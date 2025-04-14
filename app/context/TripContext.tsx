import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { sendTripDetectionNotification, registerForPushNotificationsAsync } from './notificationService';

// Define TypeScript interfaces
export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number; // in km/h
}

export interface TransportMode {
  id: string;
  name: string;
  emissionFactor: number; // kg CO2 per km
  icon: string;
}

export interface Trip {
  id: string;
  startTime: Date;
  endTime?: Date;
  startLocation?: LocationPoint;
  endLocation?: LocationPoint;
  distance: number; // in kilometers
  transportMode?: TransportMode;
  carbonEmissions?: number; // in kg CO2
  isActive: boolean;
  locations: LocationPoint[];
}

interface TripContextType {
  trip: Trip | null;
  isDetectingTrip: boolean;
  currentLocation: LocationPoint | null;
  transportModes: TransportMode[];
  startTripDetection: () => Promise<void>;
  stopTripDetection: () => void;
  startTrip: () => void;
  endTrip: () => void;
  selectTransportMode: (transportMode: TransportMode) => void;
  calculateEmissions: () => number;
  showTransportModal: boolean;
  setShowTransportModal: (show: boolean) => void;
}

// Define available transport modes
const TRANSPORT_MODES: TransportMode[] = [
  { id: 'car-petrol', name: 'Car (Petrol)', emissionFactor: 0.192, icon: '🚗' },
  { id: 'car-diesel', name: 'Car (Diesel)', emissionFactor: 0.171, icon: '🚙' },
  { id: 'car-ev', name: 'Electric Vehicle', emissionFactor: 0.053, icon: '🔋' },
  { id: 'motorcycle', name: 'Motorcycle', emissionFactor: 0.103, icon: '🏍️' },
  { id: 'bus', name: 'Bus', emissionFactor: 0.089, icon: '🚌' },
  { id: 'train', name: 'Metro/Train', emissionFactor: 0.041, icon: '🚆' },
  { id: 'bicycle', name: 'Bicycle', emissionFactor: 0, icon: '🚲' },
  { id: 'walking', name: 'Walking', emissionFactor: 0, icon: '🚶' },
];

// Speed thresholds
const TRIP_START_SPEED_THRESHOLD = 20; // km/h
const TRIP_END_SPEED_THRESHOLD = 5; // km/h
const TRIP_END_DURATION_THRESHOLD = 3 * 60 * 1000; // 3 minutes in milliseconds

// Create context
const TripContext = createContext<TripContextType | undefined>(undefined);

// Provider component
export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isDetectingTrip, setIsDetectingTrip] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [lowSpeedStartTime, setLowSpeedStartTime] = useState<number | null>(null);
  const [showTransportModal, setShowTransportModal] = useState<boolean>(false);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Set up notification listeners
  useEffect(() => {
    registerForPushNotificationsAsync();

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const data = response.notification.request.content.data;
      
      if (data?.type === 'trip_detection') {
        // User tapped on trip detection notification, we should start the trip and show transport modal
        startTrip();
        setShowTransportModal(true);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);



  // Request location permissions
  const requestLocationPermissions = async () => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      Alert.alert('Permission denied', 'Please grant location permissions to use trip tracking features.');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert('Background permission denied', 'Trip detection requires background location access.');
      return false;
    }

    return true;
  };

  // Start trip detection by monitoring location
  const startTripDetection = async () => {
    const permissionsGranted = await requestLocationPermissions();
    if (!permissionsGranted) return;

    setIsDetectingTrip(true);

    // Configure location tracking
    await Location.startLocationUpdatesAsync('trip-tracking', {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000, // Update every 2 seconds
      distanceInterval: 10, // Minimum 10 meters of movement
      foregroundService: {
        notificationTitle: 'CarbOnTrack is active',
        notificationBody: 'Monitoring for trip activity',
      },
    });

    // Set up location subscription
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 10,
      },
      (location) => {
        const locationPoint: LocationPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
          speed: location.coords.speed ? location.coords.speed * 3.6 : 0, // Convert m/s to km/h
        };

        setCurrentLocation(locationPoint);

        // Trip detection logic
        if (trip?.isActive) {
          // Trip is already active, check for end conditions
          handleActiveTripUpdate(locationPoint);
        } else if (locationPoint.speed >= TRIP_START_SPEED_THRESHOLD) {
          // Speed threshold exceeded, start new trip
          handlePotentialTripStart(locationPoint);
        }
      }
    );

    setLocationSubscription(subscription);
  };

  // Stop trip detection
  const stopTripDetection = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    Location.stopLocationUpdatesAsync('trip-tracking').catch(console.error);
    setIsDetectingTrip(false);
  };

  // Handle potential trip start based on speed
  const handlePotentialTripStart = async (location: LocationPoint) => {
    // In a real app, you might want to wait for consistent speed for a few seconds
    // Alert.alert(
    //   'Trip Detected',
    //   'It looks like you started a trip. Would you like to track it?',
    //   [
    //     {
    //       text: 'No',
    //       style: 'cancel',
    //     },
    //     {
    //       text: 'Yes',
    //       onPress: () => startTrip(),
    //     },
    //   ]
    // );
    // Send notification instead of showing Alert
    await sendTripDetectionNotification();
  };

  // Handle updates for an active trip
  const handleActiveTripUpdate = (location: LocationPoint) => {
    if (!trip) return;

    // Add new location to trip
    const updatedLocations = [...trip.locations, location];
    
    // Update trip distance
    const newDistance = calculateTripDistance(updatedLocations);
    
    // Check for trip end conditions
    if (location.speed < TRIP_END_SPEED_THRESHOLD) {
      if (lowSpeedStartTime === null) {
        // Start counting time below threshold
        setLowSpeedStartTime(location.timestamp);
      } else if (location.timestamp - lowSpeedStartTime > TRIP_END_DURATION_THRESHOLD) {
        // Below threshold for longer than duration threshold
        handlePotentialTripEnd();
        return;
      }
    } else {
      // Reset low speed timer if speed increases
      setLowSpeedStartTime(null);
    }

    // Update trip with new information
    setTrip({
      ...trip,
      locations: updatedLocations,
      distance: newDistance,
    });
  };

  // Handle potential trip end
  const handlePotentialTripEnd = () => {
    if (!trip || !currentLocation) return;

    Alert.alert(
      'Trip Ended?',
      'It looks like your trip has ended. Would you like to save it?',
      [
        {
          text: 'No, still traveling',
          onPress: () => setLowSpeedStartTime(null),
          style: 'cancel',
        },
        {
          text: 'Yes, end trip',
          onPress: () => endTrip(),
        },
      ]
    );
  };

  // Start a new trip
  const startTrip = () => {
    if (!currentLocation) return;

    const newTrip: Trip = {
      id: Date.now().toString(),
      startTime: new Date(),
      startLocation: currentLocation,
      distance: 0,
      isActive: true,
      locations: [currentLocation],
    };

    setTrip(newTrip);
    setLowSpeedStartTime(null);
  };

  // End the current trip
  const endTrip = () => {
    if (!trip || !currentLocation) return;

    const updatedTrip: Trip = {
      ...trip,
      endTime: new Date(),
      endLocation: currentLocation,
      isActive: false,
      carbonEmissions: calculateEmissions(),
    };

    setTrip(updatedTrip);
    setLowSpeedStartTime(null);

    // Here we would typically save the trip to storage
    console.log('Trip ended:', updatedTrip);

    // Alert the user with trip summary
    Alert.alert(
      'Trip Summary',
      `Distance: ${updatedTrip.distance.toFixed(2)} km\nCarbon: ${
        updatedTrip.carbonEmissions?.toFixed(2) || '0'
      } kg CO₂`
    );
  };

  // Select transport mode for current trip
  const selectTransportMode = (transportMode: TransportMode) => {
    if (!trip) return;

    setTrip({
      ...trip,
      transportMode,
      carbonEmissions: trip.distance * transportMode.emissionFactor,
    });
  };

  // Calculate carbon emissions based on distance and transport mode
  const calculateEmissions = (): number => {
    if (!trip || !trip.transportMode) return 0;
    return trip.distance * trip.transportMode.emissionFactor;
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate total trip distance from location points
  const calculateTripDistance = (locations: LocationPoint[]): number => {
    if (locations.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      const prevLoc = locations[i - 1];
      const currLoc = locations[i];
      
      totalDistance += calculateDistance(
        prevLoc.latitude, 
        prevLoc.longitude, 
        currLoc.latitude, 
        currLoc.longitude
      );
    }
    
    return totalDistance;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      Location.stopLocationUpdatesAsync('trip-tracking').catch(console.error);
    };
  }, [locationSubscription]);

  const value: TripContextType = {
    trip,
    isDetectingTrip,
    currentLocation,
    transportModes: TRANSPORT_MODES,
    startTripDetection,
    stopTripDetection,
    startTrip,
    endTrip,
    selectTransportMode,
    calculateEmissions,
    showTransportModal,
    setShowTransportModal,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
};

// Custom hook to use the trip context
export const useTrip = () => {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
};

// Define the background task
import * as TaskManager from 'expo-task-manager';

const LOCATION_TRACKING = 'trip-tracking';

TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  if (error) {
    console.error('Location tracking task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    // Process the locations data
    console.log('Received background location update:', locations);
    
    // This is where you would implement background trip detection logic
    // For example, you might send another notification
  }
});
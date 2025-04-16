import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { sendTripDetectionNotification, registerForPushNotificationsAsync } from './notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import { useAuth } from './AuthContext';
import { saveTrip, getUserTrips } from '../services/TripService';

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
  tripHistory: Trip[];                       //  Array of past trips
  loadTripHistory: () => Promise<void>;      //  Function to load trips
  isLoadingHistory: boolean;                 //  Loading state
}

// Define available transport modes for now but we can integrate the LLM api later to recognize the transport model from user input.
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

// Storage keys for persisting trip detection state between task executions
const LAST_LOCATIONS_KEY = 'carbontrack:lastLocations';
const TRIP_ACTIVE_KEY = 'carbontrack:tripActive';
const LOW_SPEED_START_TIME_KEY = 'carbontrack:lowSpeedStartTime';
const TRIP_DETECTION_ENABLED_KEY = 'carbontrack:tripDetectionEnabled';

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
  const [tripHistory, setTripHistory] = useState<Trip[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);


  const { user } = useAuth();  // Get the current authenticated user

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

  // Load trip history when user changes
  useEffect(() => {
    if (user) {
      loadTripHistory();
    } else {
      setTripHistory([]);
    }
  }, [user]);

  // Load trip history from Firestore
  const loadTripHistory = async () => {
    if (!user) return;
    
    try {
      setIsLoadingHistory(true);
      const trips = await getUserTrips(user.uid);
      setTripHistory(trips);
    } catch (error) {
      console.error('Error loading trip history:', error);
      Alert.alert('Error', 'Failed to load trip history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

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

    // Store that trip detection is enabled
    await AsyncStorage.setItem(TRIP_DETECTION_ENABLED_KEY, 'true');

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

    // Set up location subscription when the app is in the foreground
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
  const stopTripDetection = async () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }

    // Store that trip detection is disabled
    await AsyncStorage.setItem(TRIP_DETECTION_ENABLED_KEY, 'false');

    await Location.stopLocationUpdatesAsync('trip-tracking').catch(console.error);
    setIsDetectingTrip(false);
  };

  // Handle potential trip start based on speed
  const handlePotentialTripStart = async (location: LocationPoint) => {
    // this is what we have implemented earlier.
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

  useEffect(() => {
    const checkBackgroundTrips = async () => {
      try {
        // Check if we have an active trip from background detection
        const tripActiveStr = await AsyncStorage.getItem(TRIP_ACTIVE_KEY);
        const tripActive = tripActiveStr === 'true';
        
        // If the app state shows no active trip but storage indicates one is active
        if (tripActive && !trip?.isActive) {
          // We may need to load the trip state from storage
          // For simplicity, we'll just show the transport modal to continue the trip
          setShowTransportModal(true);
        }
        
        // Similar logic for trip end detection
        const lowSpeedStartTimeStr = await AsyncStorage.getItem(LOW_SPEED_START_TIME_KEY);
        if (lowSpeedStartTimeStr && trip?.isActive) {
          const lowSpeedStartTime = parseInt(lowSpeedStartTimeStr, 10);
          const now = Date.now();
          
          if (now - lowSpeedStartTime > TRIP_END_DURATION_THRESHOLD) {
            // Trip potentially ended while app was in background
            handlePotentialTripEnd();
          }
        }
      } catch (error) {
        console.error('Error checking background trips:', error);
      }
    };
    
    checkBackgroundTrips();
  }, []);

  // Start a new trip
  const startTrip = async () => {
    if (!currentLocation) return;

    const newTrip: Trip = {
      id: Date.now().toString(),
      startTime: new Date(),
      startLocation: currentLocation,
      distance: 0,
      isActive: true,
      locations: [currentLocation],
    };

    // Store trip active state for background task
    await AsyncStorage.setItem(TRIP_ACTIVE_KEY, 'true');

    setTrip(newTrip);
    setLowSpeedStartTime(null);
  };

  // End the current trip
  const endTrip = async () => {
    if (!trip || !currentLocation || !user) return;

    const emissions = calculateEmissions();
    const updatedTrip: Trip = {
      ...trip,
      endTime: new Date(),
      endLocation: currentLocation,
      isActive: false,
      carbonEmissions: emissions,
    };

    // Update storage to reflect trip is no longer active
    await AsyncStorage.setItem(TRIP_ACTIVE_KEY, 'false');
    await AsyncStorage.removeItem(LOW_SPEED_START_TIME_KEY);

    setTrip(updatedTrip);
    setLowSpeedStartTime(null);

    // Here we would typically save the trip to storage
    console.log('Trip ended:', updatedTrip);

    // Alert the user with trip summary
    try {
      // Save trip to Firestore
      await saveTrip(user.uid, updatedTrip);
      
      // Refresh trip history
      await loadTripHistory();
      
      // Alert the user with trip summary
      Alert.alert(
        'Trip Summary',
        `Distance: ${updatedTrip.distance.toFixed(2)} km\nCarbon: ${
          emissions.toFixed(2)
        } kg CO₂`
      );
    } catch (error) {
      console.error('Error saving trip:', error);
      Alert.alert(
        'Error Saving Trip',
        'There was a problem saving your trip data. Please try again.'
      );
    }
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
    tripHistory,           
    loadTripHistory,       
    isLoadingHistory       
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


const LOCATION_TRACKING = 'trip-tracking';


// Convert speed from m/s to km/h
const msToKmh = (speedMs: number | null): number => {
  if (speedMs === null) return 0;
  return speedMs * 3.6;
};

// Save detection state to AsyncStorage
const saveDetectionState = async (
  tripActive: boolean, 
  lowSpeedStartTime: number | null = null,
  lastLocations: Location.LocationObject[] = []
) => {
  try {
    await AsyncStorage.setItem(TRIP_ACTIVE_KEY, JSON.stringify(tripActive));
    
    if (lowSpeedStartTime !== null) {
      await AsyncStorage.setItem(LOW_SPEED_START_TIME_KEY, JSON.stringify(lowSpeedStartTime));
    }
    
    // Store only the last 5 locations to save space
    const locationsToSave = lastLocations.slice(-5);
    await AsyncStorage.setItem(LAST_LOCATIONS_KEY, JSON.stringify(locationsToSave));
  } catch (error) {
    console.error('Error saving detection state:', error);
  }
};

// Function to check if we should notify about a potential trip start
const shouldNotifyTripStart = async (currentSpeed: number): Promise<boolean> => {
  if (currentSpeed < TRIP_START_SPEED_THRESHOLD) return false;
  
  // Check if trip detection is enabled
  const tripDetectionEnabled = await AsyncStorage.getItem(TRIP_DETECTION_ENABLED_KEY);
  if (tripDetectionEnabled !== 'true') return false;
  
  // Check if a trip is already active
  const tripActiveStr = await AsyncStorage.getItem(TRIP_ACTIVE_KEY);
  if (tripActiveStr === 'true') return false;
  
  // Check when we last sent a notification (don't spam notifications)
  const lastNotificationTime = await AsyncStorage.getItem('carbontrack:lastNotificationTime');
  if (lastNotificationTime) {
    const lastTime = parseInt(lastNotificationTime, 10);
    const now = Date.now();
    // Don't send another notification if it's been less than 2 minutes
    if (now - lastTime < 2 * 60 * 1000) return false;
  }
  
  return true;
};

TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  if (error) {
    console.error('Location tracking task error:', error);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  // Get the most recent location
  const latestLocation = locations[locations.length - 1];
  const currentSpeed = msToKmh(latestLocation.coords.speed);

  console.log('Background location update received:', {
    latitude: latestLocation.coords.latitude,
    longitude: latestLocation.coords.longitude,
    speed: currentSpeed,
    timestamp: new Date(latestLocation.timestamp).toISOString()
  });


  try {
    // Check if trip detection is enabled
    const tripDetectionEnabled = await AsyncStorage.getItem(TRIP_DETECTION_ENABLED_KEY);
    if (tripDetectionEnabled !== 'true') {
      console.log('Trip detection is disabled');
      return;
    }
    // Get current trip status
    const tripActiveStr = await AsyncStorage.getItem(TRIP_ACTIVE_KEY);
    const tripActive = tripActiveStr === 'true';

    // ---------- TRIP START DETECTION ----------
    if (!tripActive) {
      // Check if speed exceeds threshold for trip start
      if (await shouldNotifyTripStart(currentSpeed)) {
        console.log('Trip potentially starting - sending notification');
        await sendTripDetectionNotification();
        
        // Save last notification time
        await AsyncStorage.setItem('carbontrack:lastNotificationTime', Date.now().toString());
      }
    } 
    // ---------- TRIP END DETECTION ----------
    else {
      // Get stored low speed start time
      const lowSpeedStartTimeStr = await AsyncStorage.getItem(LOW_SPEED_START_TIME_KEY);
      let lowSpeedStartTime = lowSpeedStartTimeStr ? parseInt(lowSpeedStartTimeStr, 10) : null;
      
      if (currentSpeed < TRIP_END_SPEED_THRESHOLD) {
        // Begin or continue tracking low speed duration
        if (lowSpeedStartTime === null) {
          lowSpeedStartTime = latestLocation.timestamp;
          await AsyncStorage.setItem(LOW_SPEED_START_TIME_KEY, lowSpeedStartTime.toString());
          console.log('Below speed threshold - starting end timer');
        } else if (latestLocation.timestamp - lowSpeedStartTime > TRIP_END_DURATION_THRESHOLD) {
          // Trip has ended due to low speed for extended period
          console.log('Trip potentially ended - sending end notification');
          
          // We can't directly end the trip here since we need user confirmation,
          // but we can send a notification that the app will handle
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Trip May Have Ended',
              body: 'It seems your trip has ended. Open the app to confirm and save trip details.',
              data: { type: 'trip_end_detection' },
            },
            trigger: null, // Send immediately
          });
          
          // Reset low speed timer
          await AsyncStorage.removeItem(LOW_SPEED_START_TIME_KEY);
        }
      } else {
        // Speed increased above threshold, reset low speed timer
        if (lowSpeedStartTime !== null) {
          console.log('Speed increased - resetting end timer');
          await AsyncStorage.removeItem(LOW_SPEED_START_TIME_KEY);
        }
      }
    }
    // Always save latest locations for context
    const existingLocationsStr = await AsyncStorage.getItem(LAST_LOCATIONS_KEY);
    let existingLocations = [];
    if (existingLocationsStr) {
      try {
        existingLocations = JSON.parse(existingLocationsStr);
      } catch (e) {
        console.error('Error parsing stored locations:', e);
      }
    }
    
    const updatedLocations = [...existingLocations, ...locations].slice(-20); // Keep last 20 locations
    await AsyncStorage.setItem(LAST_LOCATIONS_KEY, JSON.stringify(updatedLocations));
    
  } catch (error) {
    console.error('Error in background location task:', error);
  }
});

export default TripProvider;
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotification } from './NotificationContext';
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
  tripHistory: Trip[];
  loadTripHistory: () => Promise<void>;
  isLoadingHistory: boolean;
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
const TRIP_START_SPEED_THRESHOLD = 10; // km/h
const TRIP_END_SPEED_THRESHOLD = 5; // km/h
const TRIP_END_DURATION_THRESHOLD = 60 * 1000; // 1 minute in milliseconds

// Storage keys
const LAST_LOCATIONS_KEY = 'carbontrack:lastLocations';
const TRIP_ACTIVE_KEY = 'carbontrack:tripActive';
const LOW_SPEED_START_TIME_KEY = 'carbontrack:lowSpeedStartTime';
const TRIP_DETECTION_ENABLED_KEY = 'carbontrack:tripDetectionEnabled';
const CURRENT_LOCATION_KEY = 'carbontrack:currentLocation';
const TRIP_DATA_KEY = 'carbontrack:currentTripData';
const LAST_END_NOTIFICATION_TIME_KEY = 'carbontrack:lastEndNotificationTime';

// Background task name
const LOCATION_TRACKING = 'trip-tracking';

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
  const [tripHistory, setTripHistory] = useState<Trip[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const { showNotification } = useNotification();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const lastLocationUpdateTime = useRef<number>(0);

  const { user } = useAuth();

  // Helper function to validate coordinates
  const isValidCoordinate = (latitude: number, longitude: number): boolean => {
    // Simple validation - check if coordinates are in reasonable range
    return !isNaN(latitude) && !isNaN(longitude) &&
           latitude >= -90 && latitude <= 90 &&
           longitude >= -180 && longitude <= 180 &&
           // Also check they're not exactly 0,0 (which is often a default)
           !(latitude === 0 && longitude === 0);
  };

  // Save the current trip to storage
  const saveTripToStorage = async (tripData: Trip) => {
    try {
      await AsyncStorage.setItem(TRIP_DATA_KEY, JSON.stringify(tripData));
      console.log(`DEBUG: Saved trip to storage with distance: ${tripData.distance.toFixed(4)} km`);
    } catch (error) {
      console.error('DEBUG: Error saving trip to storage:', error);
    }
  };

  // Load the current trip from storage
  const loadTripFromStorage = async (): Promise<Trip | null> => {
    try {
      const tripDataStr = await AsyncStorage.getItem(TRIP_DATA_KEY);
      if (tripDataStr) {
        const tripData = JSON.parse(tripDataStr) as Trip;
        // Convert date strings back to Date objects
        tripData.startTime = new Date(tripData.startTime);
        if (tripData.endTime) {
          tripData.endTime = new Date(tripData.endTime);
        }
        console.log(`DEBUG: Loaded trip from storage with distance: ${tripData.distance.toFixed(4)} km`);
        return tripData;
      }
    } catch (error) {
      console.error('DEBUG: Error loading trip from storage:', error);
    }
    return null;
  };

  // Clear trip data from storage
  const clearTripStorage = async () => {
    try {
      await AsyncStorage.removeItem(TRIP_DATA_KEY);
      console.log('DEBUG: Cleared trip data from storage');
    } catch (error) {
      console.error('DEBUG: Error clearing trip storage:', error);
    }
  };

  // Load low speed start time from storage
  const loadLowSpeedStartTime = async () => {
    try {
      const timeStr = await AsyncStorage.getItem(LOW_SPEED_START_TIME_KEY);
      if (timeStr) {
        const time = parseInt(timeStr, 10);
        console.log(`DEBUG: Loaded low speed start time from storage: ${new Date(time).toISOString()}`);
        setLowSpeedStartTime(time);
        return time;
      }
    } catch (error) {
      console.error('DEBUG: Error loading low speed start time:', error);
    }
    return null;
  };

  // Set low speed start time and save to storage
  const setAndSaveLowSpeedStartTime = async (time: number | null) => {
    setLowSpeedStartTime(time);
    try {
      if (time === null) {
        await AsyncStorage.removeItem(LOW_SPEED_START_TIME_KEY);
        console.log('DEBUG: Cleared low speed start time');
      } else {
        await AsyncStorage.setItem(LOW_SPEED_START_TIME_KEY, time.toString());
        console.log(`DEBUG: Saved low speed start time: ${new Date(time).toISOString()}`);
      }
    } catch (error) {
      console.error('DEBUG: Error saving low speed start time:', error);
    }
  };

  // Set up a periodic UI refresh for active trips
  const setupUIRefreshTimer = () => {
    // Create a timer that periodically updates the UI during active trips
    const refreshInterval = setInterval(async () => {
      if (trip?.isActive) {
        console.log("DEBUG: Running periodic UI refresh");
        
        // Get the last stored location from AsyncStorage
        try {
          const storedLocationStr = await AsyncStorage.getItem(CURRENT_LOCATION_KEY);
          if (storedLocationStr) {
            const storedLocation = JSON.parse(storedLocationStr) as LocationPoint;
            
            // Only update if this is a new location with valid timestamp
            if (storedLocation && 
                storedLocation.timestamp > 0 && 
                (!currentLocation || storedLocation.timestamp > currentLocation.timestamp)) {
              
              console.log(`DEBUG: UI Refresh - New location: ${storedLocation.latitude.toFixed(5)}, ${storedLocation.longitude.toFixed(5)}, Speed: ${storedLocation.speed.toFixed(2)} km/h`);
              
              // Update current location state to refresh UI
              setCurrentLocation(storedLocation);
              
              // Manually call handleActiveTripUpdate to ensure distance calculations happen
              handleActiveTripUpdate(storedLocation);
            }
          }
          
          // Also check if there's a stored low speed start time
          await loadLowSpeedStartTime();
          
        } catch (error) {
          console.error("DEBUG: Error during UI refresh:", error);
        }
      }
    }, 2000); // Refresh every 2 seconds during active trips
    
    // Return cleanup function
    return () => clearInterval(refreshInterval);
  };

  // Initialize and check for stored location/trip state
  useEffect(() => {
    const initializeLocationTracking = async () => {
      try {
        // Check for stored values
        const storedTripActive = await AsyncStorage.getItem(TRIP_ACTIVE_KEY);
        const storedLocationStr = await AsyncStorage.getItem(CURRENT_LOCATION_KEY);
        const detectionEnabled = await AsyncStorage.getItem(TRIP_DETECTION_ENABLED_KEY);
        
        // Initialize stored location if available
        if (storedLocationStr) {
          try {
            const storedLocation = JSON.parse(storedLocationStr) as LocationPoint;
            setCurrentLocation(storedLocation);
            console.log('DEBUG: Restored stored location:', storedLocation);
          } catch (e) {
            console.error('DEBUG: Failed to parse stored location:', e);
          }
        }
        
        // Load low speed timer state
        await loadLowSpeedStartTime();
        
        // Restart trip detection if it was enabled
        if (detectionEnabled === 'true') {
          startTripDetection().catch(console.error);
        }
        
        // Check for active trip
        if (storedTripActive === 'true') {
          // Try to load trip data
          const storedTrip = await loadTripFromStorage();
          if (storedTrip) {
            setTrip(storedTrip);
            setShowTransportModal(true);
          }
        }
        
      } catch (error) {
        console.error('DEBUG: Error initializing location tracking:', error);
      }
    };
    
    initializeLocationTracking();
    

    
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('DEBUG: Notification received:', notification);
    });
    
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('DEBUG: Notification response received:', response);
      const data = response.notification.request.content.data;
      
      if (data?.type === 'trip_detection') {
        startTrip();
        setShowTransportModal(true);
      } else if (data?.type === 'trip_end_suggestion' && trip?.isActive) {
        // If user taps on the trip end suggestion notification
        Alert.alert(
          'End Trip?',
          'Would you like to end and save your current trip?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'End Trip',
              onPress: () => endTrip(),
            },
          ]
        );
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

  // Set up UI refresh timer for active trips
  useEffect(() => {
    const cleanupTimer = setupUIRefreshTimer();
    
    // Cleanup on unmount
    return () => {
      cleanupTimer();
    };
  }, [trip?.isActive]); // Only re-create when trip active state changes

  // Load trip history when user changes
  useEffect(() => {
    if (user) {
      loadTripHistory();
    } else {
      setTripHistory([]);
    }
  }, [user]);

  // Store current location whenever it changes
  useEffect(() => {
    if (currentLocation) {
      AsyncStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(currentLocation))
        .catch(err => console.error('DEBUG: Error storing location:', err));
    }
  }, [currentLocation]);

  // Load trip history from Firestore
  const loadTripHistory = async () => {
    if (!user) return;
    
    try {
      setIsLoadingHistory(true);
      const trips = await getUserTrips(user.uid);
      setTripHistory(trips);
    } catch (error) {
      console.error('DEBUG: Error loading trip history:', error);
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

  // Process location update
  const processLocationUpdate = (location: Location.LocationObject) => {
    // Ignore null locations
    if (!location || !location.coords) {
      return;
    }
    
    /// Convert m/s to km/h and ensure it's positive
  let speed = location.coords.speed ? Math.abs(location.coords.speed * 3.6) : 0;
  
  // Create location point
  const locationPoint: LocationPoint = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp,
    speed: speed,
  };
  
  // Update current location regardless of other conditions
  setCurrentLocation(locationPoint);
  lastLocationUpdateTime.current = Date.now();
  
  // Speed threshold check - show notification when speed exceeds threshold
  if (speed >= TRIP_START_SPEED_THRESHOLD) {
    // Show in-app notification regardless of trip status
    showNotification({
      title: 'Trip Activity Detected',
      message: `Current speed: ${speed.toFixed(1)} km/h`,
      type: 'info',
      icon: 'car',
      duration: 5000,
      onPress: () => {
        // If no active trip, start one when user taps notification
        if (!trip?.isActive) {
          startTrip();
          setShowTransportModal(true);
        }
      }
    });
    
    // If no active trip, handle potential trip start
    if (!trip?.isActive) {
      handlePotentialTripStart(locationPoint);
    }
  }

  // Trip is already active, check for end conditions and calculate distance
  if (trip?.isActive) {
    handleActiveTripUpdate(locationPoint);
  }
};

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    // If coordinates are identical, return 0
    if (lat1 === lat2 && lon1 === lon2) return 0;

    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Check if the trip should end based on speed
  const checkForTripEnd = async (location: LocationPoint) => {
    // Get the stored low speed start time to ensure consistency
    const storedLowSpeedTime = await loadLowSpeedStartTime();
    const currentLowSpeedTime = storedLowSpeedTime !== null ? storedLowSpeedTime : lowSpeedStartTime;
    
    if (location.speed < TRIP_END_SPEED_THRESHOLD) {
      if (currentLowSpeedTime === null) {
        // Start counting time below threshold - use current time instead of location timestamp
        const timestamp = Date.now();
        console.log(`DEBUG: Speed below threshold (${location.speed.toFixed(2)} km/h), starting end timer at ${new Date(timestamp).toISOString()}`);
        await setAndSaveLowSpeedStartTime(timestamp);
      } else {
        // Calculate time elapsed using current time instead of location timestamp
        const now = Date.now();
        // Add debug logs to understand the time calculations
        console.log(`DEBUG: Current time: ${now}, Low speed start time: ${currentLowSpeedTime}, Delta: ${now - currentLowSpeedTime}ms`);
        
        const timeElapsed = now - currentLowSpeedTime;
        
        // Check that timeElapsed is reasonable (not negative or too large)
        if (timeElapsed < 0 || timeElapsed > 3600000) { // If more than an hour, something's wrong
          console.log(`DEBUG: Suspicious time elapsed value: ${timeElapsed}ms - resetting timer`);
          await setAndSaveLowSpeedStartTime(now);
          return false;
        }
        
        console.log(`DEBUG: Low speed timer running: ${(timeElapsed/1000).toFixed(0)} seconds elapsed of ${(TRIP_END_DURATION_THRESHOLD/1000).toFixed(0)} seconds required`);
        
        if (timeElapsed > TRIP_END_DURATION_THRESHOLD) {
          // Below threshold for longer than duration threshold
          console.log('DEBUG: Speed below threshold for extended period, prompting trip end');
          console.log(`DEBUG: Time elapsed: ${(timeElapsed/1000).toFixed(0)} seconds`);
          await handlePotentialTripEnd();
          return true;
        }
      }
    } else {
      // Reset low speed timer if speed increases
      if (currentLowSpeedTime !== null) {
        console.log(`DEBUG: Speed increased to ${location.speed.toFixed(2)} km/h, resetting end timer`);
        await setAndSaveLowSpeedStartTime(null);
      }
    }
    
    return false;
  };

  // Handle updates for an active trip with fixed distance calculation
  const handleActiveTripUpdate = async (location: LocationPoint) => {
    if (!trip) {
      console.log("DEBUG: No active trip to update");
      return;
    }

    console.log("DEBUG: Processing active trip update");
    
    // IMPORTANT: Load latest trip data from storage to ensure we have the most accurate distance
    let currentTrip = trip;
    const storedTrip = await loadTripFromStorage();
    if (storedTrip && storedTrip.id === trip.id && storedTrip.distance > trip.distance) {
      console.log(`DEBUG: Using stored trip data with higher distance: ${storedTrip.distance.toFixed(4)} km vs ${trip.distance.toFixed(4)} km`);
      currentTrip = storedTrip;
      // Update state with the loaded trip data (don't await)
      setTrip(storedTrip);
    }

    // Check if this is a duplicate/identical location to the last one
    const lastLocation = currentTrip.locations.length > 0 ? currentTrip.locations[currentTrip.locations.length - 1] : null;
    if (lastLocation && 
        lastLocation.latitude === location.latitude && 
        lastLocation.longitude === location.longitude) {
      console.log("DEBUG: Skipping identical location");
      
      // Still check for end trip condition even if location is identical
      await checkForTripEnd(location);
      
      return;
    }

    // Validate timestamp - ignore if earlier than the trip start or last location
    if (location.timestamp < currentTrip.startTime.getTime()) {
      console.log(`DEBUG: Invalid timestamp: location is earlier than trip start`);
      return;
    }
    
    if (lastLocation && location.timestamp < lastLocation.timestamp) {
      console.log(`DEBUG: Invalid timestamp: new location time is earlier than previous`);
      return;
    }

    // Add new location to trip
    const updatedLocations = [...currentTrip.locations, location];
    
    // Calculate new distance increment
    let distanceIncrement = 0;
    if (lastLocation) {
      distanceIncrement = calculateDistance(
        lastLocation.latitude, 
        lastLocation.longitude, 
        location.latitude, 
        location.longitude
      );
      
      // Sanity check - ignore jumps over 1km
      if (distanceIncrement > 1) {
        console.log(`DEBUG: Suspiciously large distance increment: ${distanceIncrement.toFixed(4)} km - filtered out`);
        distanceIncrement = 0;
      } else {
        console.log(`DEBUG: Distance increment: ${distanceIncrement.toFixed(6)} km`);
      }
    }
    
    // Update total distance (using the current trip's distance as base)
    const newDistance = currentTrip.distance + distanceIncrement;
    console.log(`DEBUG: Previous distance: ${currentTrip.distance.toFixed(4)} km, New distance: ${newDistance.toFixed(4)} km`);
    
    // Check for trip end conditions
    await checkForTripEnd(location);

    // Update trip with new information
    const updatedTrip = {
      ...currentTrip,
      locations: updatedLocations,
      distance: newDistance,
    };
    
    // Save to state
    setTrip(updatedTrip);
    
    // Save to storage for persistence between UI refreshes
    await saveTripToStorage(updatedTrip);
    
    // Ensure UI is updated with latest speed
    setCurrentLocation(location);
  };

  // Start trip detection by monitoring location
  const startTripDetection = async () => {
    const permissionsGranted = await requestLocationPermissions();
    if (!permissionsGranted) return;

    setIsDetectingTrip(true);

    // Store that trip detection is enabled
    await AsyncStorage.setItem(TRIP_DETECTION_ENABLED_KEY, 'true');

    // Configure location tracking
    try {
      // First, remove any existing subscriptions
      if (locationSubscription) {
        locationSubscription.remove();
      }
      
      // Check if background task is defined and stop it if it is
      const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TRACKING);
      if (isTaskDefined) {
        try {
          await Location.stopLocationUpdatesAsync(LOCATION_TRACKING);
          console.log('DEBUG: Successfully stopped previous background location task');
        } catch (error) {
          console.log('DEBUG: No active background task to stop', error);
        }
      }
      
      // Start background location task
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,  // update every second
        distanceInterval: 5, // minimum 5 meters of movement
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'CarbOnTrack is active',
          notificationBody: 'Monitoring for trip activity',
        },
      });
      
      console.log('DEBUG: Background location task started');
      
      // Set up foreground location subscription for more immediate updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,    // Update every second
          distanceInterval: 5,   // Minimum 5 meters of movement
        },
        (location) => {
          processLocationUpdate(location);
        }
      );
      
      setLocationSubscription(subscription);
      console.log('DEBUG: Foreground location tracking started');
    } catch (error) {
      console.error('DEBUG: Error setting up location tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking. Please try again.');
      setIsDetectingTrip(false);
    }
  };

  // Stop trip detection
  const stopTripDetection = async () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    
    await AsyncStorage.setItem(TRIP_DETECTION_ENABLED_KEY, 'false');

    try {
      const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TRACKING);
      if (isTaskDefined) {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING);
        console.log('DEBUG: Background location task stopped');
      }
    } catch (error) {
      console.error('DEBUG: Error stopping location updates:', error);
    }
    
    setIsDetectingTrip(false);
  };

  /// In TripContext.tsx, update the handlePotentialTripStart function
const handlePotentialTripStart = async (location: LocationPoint) => {
  // Don't trigger notifications too frequently
  const lastNotificationTime = await AsyncStorage.getItem('carbontrack:lastNotificationTime');
  if (lastNotificationTime) {
    const lastTime = parseInt(lastNotificationTime, 10);
    const now = Date.now();
    // Reduce throttling time for testing (from 60 seconds to 10 seconds)
    if (now - lastTime < 10 * 1000) {
      console.log('DEBUG: Notification throttled - last notification was too recent');
      return;
    }
  }

  // Log when notifications are being sent
  console.log('DEBUG: Showing speed notification for speed:', location.speed);

  await AsyncStorage.setItem('carbontrack:lastNotificationTime', Date.now().toString());
  
  // Your existing code to show notification
  showNotification({
    title: 'Trip Activity Detected',
    message: `Current speed: ${location.speed.toFixed(1)} km/h`,
    type: 'info',
    icon: 'car',
    duration: 5000,
    onPress: () => {
      // If no active trip, start one when user taps notification
      if (!trip?.isActive) {
        startTrip();
        setShowTransportModal(true);
      }
    }
  });
}

  // Handle potential trip end
  const handlePotentialTripEnd = async () => {
    if (!trip || !currentLocation) {
      console.log("DEBUG: Cannot end trip: No active trip or current location");
      return;
    }
    
    // Check if we've recently sent an end notification to avoid duplicates
    const lastEndNotificationTime = await AsyncStorage.getItem(LAST_END_NOTIFICATION_TIME_KEY);
    if (lastEndNotificationTime) {
      const lastTime = parseInt(lastEndNotificationTime, 10);
      const now = Date.now();
      // Don't send another end notification if it's been less than 2 minutes
      if (now - lastTime < 120 * 1000) {
        console.log('DEBUG: Skipping end notification - one was sent recently');
        return;
      }
    }
    
    console.log('DEBUG: Showing trip end notification');
    
    try {
      // Show in-app notification for trip end
      showNotification({
        title: 'Trip End Detected',
        message: `It looks like you've stopped. Total distance: ${trip.distance.toFixed(2)} km`,
        type: 'success',
        icon: 'flag',
        duration: 8000,
        onPress: () => endTrip()
      });
      
      // Store the time we sent this notification
      await AsyncStorage.setItem(LAST_END_NOTIFICATION_TIME_KEY, Date.now().toString());
      
      // Reset low speed timer to prevent multiple notifications
      await setAndSaveLowSpeedStartTime(null);
    } catch (error) {
      console.error('DEBUG: Failed to show trip end notification:', error);
    }
  };

  // Start a new trip with proper data validation
  const startTrip = async () => {
    console.log("DEBUG: Starting trip - BEGIN");
    // Get the latest location directly from AsyncStorage to ensure we have the most recent data
    let validLocation: LocationPoint | null = null;
    
    try {
      // Try to get the most recent location from AsyncStorage first
      const storedLocationStr = await AsyncStorage.getItem(CURRENT_LOCATION_KEY);
      console.log("DEBUG: Retrieved from storage:", storedLocationStr || "No stored location");
      
      if (storedLocationStr) {
        try {
          const storedLocation = JSON.parse(storedLocationStr) as LocationPoint;
          
          // Validate the location data to ensure it's not garbage
          if (isValidCoordinate(storedLocation.latitude, storedLocation.longitude) &&
              storedLocation.timestamp > 0 &&
              storedLocation.speed >= 0) {
            
            console.log(`DEBUG: Using stored location: ${storedLocation.latitude.toFixed(5)}, ${storedLocation.longitude.toFixed(5)}, Speed: ${storedLocation.speed.toFixed(2)} km/h`);
            validLocation = storedLocation;
          } else {
            console.log("DEBUG: Stored location failed validation:", storedLocation);
          }
        } catch (error) {
          console.error("DEBUG: Failed to parse stored location:", error);
        }
      }
    } catch (error) {
      console.error("DEBUG: Error retrieving stored location:", error);
    }
    
    // If we couldn't get a valid location from storage, try to use the current state
    if (!validLocation && currentLocation) {
      if (isValidCoordinate(currentLocation.latitude, currentLocation.longitude) &&
          currentLocation.timestamp > 0 &&
          currentLocation.speed >= 0) {
        
        console.log(`DEBUG: Using current state location: ${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}, Speed: ${currentLocation.speed.toFixed(2)} km/h`);
        validLocation = currentLocation;
      } else {
        console.log("DEBUG: Current location failed validation:", currentLocation);
      }
    }
    
    // If we still don't have a valid location, try to get a fresh one
    if (!validLocation) {
      try {
        console.log("DEBUG: Getting fresh location from Location API");
        const freshLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation
        });
        
        if (freshLocation && freshLocation.coords) {
          const speed = freshLocation.coords.speed ? Math.max(0, freshLocation.coords.speed * 3.6) : 0;
          
          validLocation = {
            latitude: freshLocation.coords.latitude,
            longitude: freshLocation.coords.longitude,
            timestamp: freshLocation.timestamp,
            speed: speed
          };
          
          console.log(`DEBUG: Using fresh location: ${validLocation.latitude.toFixed(5)}, ${validLocation.longitude.toFixed(5)}, Speed: ${validLocation.speed.toFixed(2)} km/h`);
        }
      } catch (error) {
        console.error("DEBUG: Failed to get fresh location:", error);
      }
    }
    
    // Final check - if we still don't have a valid location, alert the user
    if (!validLocation) {
      Alert.alert(
        'Location Not Available', 
        'Unable to start trip without a valid location. Please ensure location services are enabled.'
      );
      console.log("DEBUG: Starting trip - FAILED due to no valid location");
      return;
    }

    // We have a valid location, create the trip
    await createNewTrip(validLocation);
    console.log("DEBUG: Starting trip - SUCCESS");
  };

  // Helper function to create a new trip
  const createNewTrip = async (location: LocationPoint) => {
    // Clear any existing trip data first
    await clearTripStorage();
    
    // Ensure the timestamp is current
    const now = new Date();
    const currentTimestamp = now.getTime();
    
    // Create a normalized location point with the current timestamp
    const normalizedLocation: LocationPoint = {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: currentTimestamp,
      speed: Math.max(0, location.speed) // Ensure speed is never negative
    };
    
    const newTrip: Trip = {
      id: currentTimestamp.toString(),
      startTime: now,
      startLocation: normalizedLocation,
      distance: 0,
      isActive: true,
      locations: [normalizedLocation],
    };

    // Store trip active state for background task
    await AsyncStorage.setItem(TRIP_ACTIVE_KEY, 'true');
    await AsyncStorage.removeItem(LOW_SPEED_START_TIME_KEY);
    await AsyncStorage.removeItem(LAST_END_NOTIFICATION_TIME_KEY);

    // Store the current location to ensure it's the same one we're using
    await AsyncStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(normalizedLocation));

    // Save the new trip to storage
    await saveTripToStorage(newTrip);
    
    // Update the state
    setTrip(newTrip);
    await setAndSaveLowSpeedStartTime(null);
    
    console.log('DEBUG: Trip started:', {
      id: newTrip.id,
      location: `${normalizedLocation.latitude.toFixed(5)}, ${normalizedLocation.longitude.toFixed(5)}`,
      speed: `${normalizedLocation.speed.toFixed(2)} km/h`,
      startTime: newTrip.startTime.toISOString()
    });
    
    // Force UI update to ensure latest speed is displayed
    setCurrentLocation(normalizedLocation);
  };

  // End the current trip
  const endTrip = async () => {
    console.log('DEBUG: Trip ending - triggered by user action'); // Debug log to indicate user-initiated trip end
    
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
    await AsyncStorage.removeItem(LAST_END_NOTIFICATION_TIME_KEY);
    
    // Clear trip data from storage
    await clearTripStorage();

    setTrip(null); // Clear the trip to ensure a clean state
    await setAndSaveLowSpeedStartTime(null);
    
    console.log('DEBUG: Trip ended at:', currentLocation);

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
      console.error('DEBUG: Error saving trip:', error);
      Alert.alert(
        'Error Saving Trip',
        'There was a problem saving your trip data. Please try again.'
      );
    }
  };

  // Select transport mode for current trip
  const selectTransportMode = (transportMode: TransportMode) => {
    if (!trip) return;

    const updatedTrip = {
      ...trip,
      transportMode,
      carbonEmissions: trip.distance * transportMode.emissionFactor,
    };
    
    setTrip(updatedTrip);
    
    // Update trip in storage too
    saveTripToStorage(updatedTrip).catch(console.error);
  };

  // Calculate carbon emissions based on distance and transport mode
  const calculateEmissions = (): number => {
    if (!trip || !trip.transportMode) return 0;
    return trip.distance * trip.transportMode.emissionFactor;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      
      // Try to stop the background task
      Location.stopLocationUpdatesAsync(LOCATION_TRACKING).catch(error => {
        console.log('DEBUG: Error stopping background location task on unmount:', error);
      });
    };
  }, []);

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

// Define the background task for location tracking
TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  if (error) {
    console.error('DEBUG: Location tracking task error:', error);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  // Get the most recent location
  const latestLocation = locations[locations.length - 1];
  
  try {
    // Check if trip detection is enabled
    const tripDetectionEnabled = await AsyncStorage.getItem(TRIP_DETECTION_ENABLED_KEY);
    if (tripDetectionEnabled !== 'true') {
      return;
    }
    
    // Calculate speed - convert m/s to km/h and ensure it's positive
    let currentSpeed = latestLocation.coords.speed ? Math.abs(latestLocation.coords.speed * 3.6) : 0;
    
    // Store the current location for future calculations
    const locationPoint: LocationPoint = {
      latitude: latestLocation.coords.latitude,
      longitude: latestLocation.coords.longitude,
      timestamp: latestLocation.timestamp,
      speed: currentSpeed,
    };
    
    await AsyncStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(locationPoint));
    
    console.log(`DEBUG: [Background] Location: ${locationPoint.latitude.toFixed(5)}, ${locationPoint.longitude.toFixed(5)}, Speed: ${currentSpeed.toFixed(2)} km/h`);
    
    // Get current trip status
    const tripActiveStr = await AsyncStorage.getItem(TRIP_ACTIVE_KEY);
    const tripActive = tripActiveStr === 'true';

    // Trip start detection
    if (!tripActive && currentSpeed >= TRIP_START_SPEED_THRESHOLD) {
      // Check when we last sent a notification (don't spam notifications)
      const lastNotificationTime = await AsyncStorage.getItem('carbontrack:lastNotificationTime');
      const canNotify = !lastNotificationTime || 
        (Date.now() - parseInt(lastNotificationTime, 10)) > 60 * 1000; // 1 minute
      
        if (canNotify) {
          console.log('DEBUG: [Background] Trip potentially starting - storing notification time');
          // We can't directly call showNotification from background task
          // Just store the timestamp - the notification will be shown when app comes to foreground
          await AsyncStorage.setItem('carbontrack:lastNotificationTime', Date.now().toString());
          
          // For background mode, we'll use the system notification
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Trip Activity Detected',
                body: `Current speed: ${currentSpeed.toFixed(1)} km/h. Tap to view.`,
                data: { type: 'trip_detection' },
              },
              trigger: null, // Send immediately
            });
          } catch (error) {
            console.error('DEBUG: [Background] Failed to send trip notification:', error);
          }
        }
    } 
    // Trip end detection
    else if (tripActive) {
      const lowSpeedStartTimeStr = await AsyncStorage.getItem(LOW_SPEED_START_TIME_KEY);
      let lowSpeedStartTime = lowSpeedStartTimeStr ? parseInt(lowSpeedStartTimeStr, 10) : null;
      
      if (currentSpeed < TRIP_END_SPEED_THRESHOLD) {
        if (lowSpeedStartTime === null) {
          // Use current time instead of location timestamp
          lowSpeedStartTime = Date.now();
          await AsyncStorage.setItem(LOW_SPEED_START_TIME_KEY, lowSpeedStartTime.toString());
          console.log('DEBUG: [Background] Below speed threshold - starting end timer');
        } else {
          // Calculate using current time
          const now = Date.now();
          const timeElapsed = now - lowSpeedStartTime;
          
          // Validate the time elapsed
          if (timeElapsed < 0 || timeElapsed > 3600000) { // If negative or > 1 hour
            console.log(`DEBUG: [Background] Invalid time elapsed: ${timeElapsed}ms - resetting timer`);
            lowSpeedStartTime = now;
            await AsyncStorage.setItem(LOW_SPEED_START_TIME_KEY, lowSpeedStartTime.toString());
            return;
          }
          
          console.log(`DEBUG: [Background] Low speed timer: ${(timeElapsed/1000).toFixed(0)} seconds elapsed of ${(TRIP_END_DURATION_THRESHOLD/1000).toFixed(0)} required`);
          
          if (timeElapsed > TRIP_END_DURATION_THRESHOLD) {
            console.log('DEBUG: [Background] Trip potentially ended - sending end notification');
            console.log(`DEBUG: [Background] Time elapsed: ${(timeElapsed/1000).toFixed(0)} seconds`);
            
            // Check if we've recently sent an end notification
            const lastEndNotificationTime = await AsyncStorage.getItem(LAST_END_NOTIFICATION_TIME_KEY);
            let canSendNotification = true;
            
            if (lastEndNotificationTime) {
              const lastTime = parseInt(lastEndNotificationTime, 10);
              const now = Date.now();
              // Don't send another end notification if it's been less than 2 minutes
              if (now - lastTime < 120 * 1000) {
                console.log('DEBUG: [Background] Skipping end notification - one was sent recently');
                canSendNotification = false;
              }
            }
            
            if (canSendNotification) {
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: 'Trip End Detected',
                    body: "It looks like you've stopped. Would you like to end your trip?",
                    data: { type: 'trip_end_suggestion' },
                  },
                  trigger: null, // Send immediately
                });
                console.log('DEBUG: [Background] Trip end notification sent successfully');
                
                // Store the time we sent this notification
                await AsyncStorage.setItem(LAST_END_NOTIFICATION_TIME_KEY, Date.now().toString());
                
                // Reset low speed timer
                await AsyncStorage.removeItem(LOW_SPEED_START_TIME_KEY);
              } catch (error) {
                console.error('DEBUG: [Background] Failed to send trip end notification:', error);
              }
            }
          }
        }
      } else {
        // Speed increased above threshold, reset low speed timer
        if (lowSpeedStartTime !== null) {
          console.log('DEBUG: [Background] Speed increased - resetting end timer');
          await AsyncStorage.removeItem(LOW_SPEED_START_TIME_KEY);
        }
      }
    }
    
    // Store recent locations for context
    const existingLocationsStr = await AsyncStorage.getItem(LAST_LOCATIONS_KEY);
    let existingLocations = [];
    if (existingLocationsStr) {
      try {
        existingLocations = JSON.parse(existingLocationsStr);
      } catch (e) {
        console.error('DEBUG: Error parsing stored locations:', e);
      }
    }
    
    const updatedLocations = [...existingLocations, ...locations].slice(-20); // Keep last 20 locations
    await AsyncStorage.setItem(LAST_LOCATIONS_KEY, JSON.stringify(updatedLocations));
    
  } catch (error) {
    console.error('DEBUG: Error in background location task:', error);
  }
});

export default TripProvider;
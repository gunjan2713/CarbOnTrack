import { 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit,
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
  } from 'firebase/firestore';
  import { firestore } from '../../firebase';
  import { Trip, LocationPoint, TransportMode } from '../context/TripContext';
  
  // Format trip data for Firestore
  const formatTripForFirestore = (trip: Trip) => {
    return {
      startTime: Timestamp.fromDate(trip.startTime),
      endTime: trip.endTime ? Timestamp.fromDate(trip.endTime) : null,
      startLocation: trip.startLocation || null,
      endLocation: trip.endLocation || null,
      distance: trip.distance,
      transportMode: trip.transportMode ? {
        id: trip.transportMode.id,
        name: trip.transportMode.name,
        emissionFactor: trip.transportMode.emissionFactor,
        icon: trip.transportMode.icon
      } : null,
      carbonEmissions: trip.carbonEmissions || 0,
      locations: trip.locations.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: loc.timestamp,
        speed: loc.speed
      })),
      createdAt: Timestamp.now()
    };
  };
  
  // Format Firestore data back to app model
  const formatTripFromFirestore = (doc: QueryDocumentSnapshot<DocumentData>): Trip => {
    const data = doc.data();
    
    return {
      id: doc.id,
      startTime: data.startTime.toDate(),
      endTime: data.endTime ? data.endTime.toDate() : undefined,
      startLocation: data.startLocation as LocationPoint | undefined,
      endLocation: data.endLocation as LocationPoint | undefined,
      distance: data.distance,
      transportMode: data.transportMode as TransportMode | undefined,
      carbonEmissions: data.carbonEmissions,
      isActive: false, // Always false for stored trips
      locations: data.locations as LocationPoint[]
    };
  };
  
  // Save a trip to Firestore
  export const saveTrip = async (userId: string, trip: Trip) => {
    try {
      const tripData = formatTripForFirestore(trip);
      const tripsCollectionRef = collection(firestore, 'users', userId, 'trips');
      const docRef = await addDoc(tripsCollectionRef, tripData);
      return docRef.id;
    } catch (error) {
      console.error('Error saving trip:', error);
      throw error;
    }
  };
  
  // Get all trips for a user
  export const getUserTrips = async (userId: string) => {
    try {
      const tripsCollectionRef = collection(firestore, 'users', userId, 'trips');
      const q = query(tripsCollectionRef, orderBy('startTime', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(formatTripFromFirestore);
    } catch (error) {
      console.error('Error getting user trips:', error);
      throw error;
    }
  };
  
  // Get trips within a date range (e.g., for weekly summary)
  export const getTripsInDateRange = async (userId: string, startDate: Date, endDate: Date) => {
    try {
      const tripsCollectionRef = collection(firestore, 'users', userId, 'trips');
      const q = query(
        tripsCollectionRef,
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate)),
        orderBy('startTime', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(formatTripFromFirestore);
    } catch (error) {
      console.error('Error getting trips in date range:', error);
      throw error;
    }
  };
  
  // Get user's carbon statistics
  export const getUserCarbonStats = async (userId: string) => {
    try {
      // Get all user trips
      const trips = await getUserTrips(userId);
      
      // Calculate total emissions
      const totalEmissions = trips.reduce((sum, trip) => sum + (trip.carbonEmissions || 0), 0);
      
      // Calculate total distance
      const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0);
      
      // Calculate emissions by transport mode
      const emissionsByMode: Record<string, number> = {};
      trips.forEach(trip => {
        if (trip.transportMode) {
          const modeName = trip.transportMode.name;
          emissionsByMode[modeName] = (emissionsByMode[modeName] || 0) + (trip.carbonEmissions || 0);
        }
      });
      
      return {
        totalEmissions,
        totalDistance,
        emissionsByMode,
        tripCount: trips.length
      };
    } catch (error) {
      console.error('Error getting user carbon stats:', error);
      throw error;
    }
  };

  const TripService = {
    saveTrip,
    getUserTrips,
    getTripsInDateRange,
    getUserCarbonStats
  };
  
  export default TripService;
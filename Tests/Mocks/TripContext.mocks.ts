// __tests__/__mocks__/TripContext.mocks.ts
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  return !isNaN(lat) && !isNaN(lon) &&
         lat >= -90 && lat <= 90 &&
         lon >= -180 && lon <= 180 &&
         !(lat === 0 && lon === 0);
}

export function calculateEmissions(trip: any): number {
  if (!trip || !trip.transportMode) return 0;
  return trip.distance * trip.transportMode.emissionFactor;
}

export function createNewTrip(location: any): any {
  const now = new Date();
  return {
    id: now.getTime().toString(),
    startTime: now,
    startLocation: location,
    distance: 0,
    isActive: true,
    locations: [location]
  };
}

export function handleActiveTripUpdate(trip: any, newLoc: any): any {
  const last = trip.locations[trip.locations.length - 1];
  const dist = calculateDistance(last.latitude, last.longitude, newLoc.latitude, newLoc.longitude);
  return {
    ...trip,
    locations: [...trip.locations, newLoc],
    distance: trip.distance + dist
  };
}

export function selectTransportMode(trip: any, mode: any): any {
  return {
    ...trip,
    transportMode: mode,
    carbonEmissions: trip.distance * mode.emissionFactor
  };
}

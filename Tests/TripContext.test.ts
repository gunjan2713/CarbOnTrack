import {
  calculateDistance,
  isValidCoordinate,
  calculateEmissions,
  createNewTrip,
  handleActiveTripUpdate,
  selectTransportMode,
  endTrip
} from './Mocks/TripContext.mocks';

import { Platform, Alert } from 'react-native';

describe('calculateDistance()', () => {
  test('returns 0 for identical points', () => {
    expect(calculateDistance(0, 0, 0, 0)).toBe(0);
  });

  test('calculates valid distance', () => {
    const d = calculateDistance(25.276987, 55.296249, 28.6139, 77.209);
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(2500);
  });
});

describe('isValidCoordinate()', () => {
  test('valid inputs', () => {
    expect(isValidCoordinate(25, 55)).toBe(true);
  });

  test('invalid lat/lon range', () => {
    expect(isValidCoordinate(100, 55)).toBe(false);
    expect(isValidCoordinate(25, 200)).toBe(false);
  });

  test('0,0 returns false', () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });
});

describe('calculateEmissions()', () => {
  test('returns 0 for missing transportMode', () => {
    expect(calculateEmissions({ distance: 100 })).toBe(0);
  });

  test('calculates emissions properly', () => {
    const trip = { distance: 50, transportMode: { emissionFactor: 0.2 } };
    expect(calculateEmissions(trip)).toBeCloseTo(10);
  });
});

describe('createNewTrip()', () => {
  test('returns trip with correct structure', () => {
    const loc = { latitude: 25, longitude: 55, speed: 10, timestamp: Date.now() };
    const trip = createNewTrip(loc);

    expect(trip).toHaveProperty('id');
    expect(trip.isActive).toBe(true);
    expect(trip.startLocation).toEqual(loc);
    expect(trip.locations.length).toBe(1);
  });
});

describe('handleActiveTripUpdate()', () => {
  test('adds new location and updates distance', () => {
    const loc1 = { latitude: 25.2769, longitude: 55.2962, timestamp: 1, speed: 10 };
    const loc2 = { latitude: 25.2779, longitude: 55.2972, timestamp: 2, speed: 12 };
    const trip = createNewTrip(loc1);
    const updated = handleActiveTripUpdate(trip, loc2);

    expect(updated.locations.length).toBe(2);
    expect(updated.distance).toBeGreaterThan(0);
  });

  test('does not increment distance for identical locations', () => {
    const loc1 = { latitude: 25.2769, longitude: 55.2962, timestamp: 1, speed: 10 };
    const trip = createNewTrip(loc1);
    const updated = handleActiveTripUpdate(trip, loc1);

    expect(updated.locations.length).toBe(2);
    expect(updated.distance).toBeCloseTo(0);
  });
});

describe('selectTransportMode()', () => {
  test('sets mode and calculates carbon emissions', () => {
    const trip = { id: '1', distance: 100, isActive: true, locations: [] };
    const mode = { id: 'bus', emissionFactor: 0.089 };
    const updated = selectTransportMode(trip, mode);

    expect(updated.transportMode).toEqual(mode);
    expect(updated.carbonEmissions).toBeCloseTo(8.9);
  });
});

describe('endTrip()', () => {
  test('calls expected async storage and alert functions', async () => {
    const mockSaveTrip = jest.fn().mockResolvedValue(undefined);
    const mockLoadTripHistory = jest.fn().mockResolvedValue([]);
    const mockTrip = {
      id: 'trip1',
      distance: 10,
      startTime: new Date(),
      isActive: true,
      locations: [{ latitude: 0, longitude: 0, speed: 0, timestamp: Date.now() }],
      transportMode: { id: 'bus', name: 'Bus', emissionFactor: 0.1, icon: '🚌' }
    };

    const mockUser = { uid: 'user1' };
    const mockLocation = { latitude: 0, longitude: 0, speed: 0, timestamp: Date.now() };

    const emissions = 1.0; // 10 km * 0.1 emission factor

    const endTripFn = endTrip({
      trip: mockTrip,
      currentLocation: mockLocation,
      user: mockUser,
      calculateEmissions: () => emissions,
      saveTrip: mockSaveTrip,
      loadTripHistory: mockLoadTripHistory,
      setTrip: jest.fn(),
      setLowSpeedStartTime: jest.fn(),
    });

    await endTripFn();

    expect(mockSaveTrip).toHaveBeenCalledWith('user1', expect.objectContaining({
      carbonEmissions: emissions,
      isActive: false
    }));
    expect(mockLoadTripHistory).toHaveBeenCalled();
  });
});





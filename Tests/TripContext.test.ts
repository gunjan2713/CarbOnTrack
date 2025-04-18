import {
  calculateDistance,
  isValidCoordinate,
  calculateEmissions,
  createNewTrip,
  handleActiveTripUpdate,
  selectTransportMode
} from './Mocks/TripContext.mocks';

describe('calculateDistance()', () => {
  test('returns 0 for identical points', () => {
    expect(calculateDistance(0, 0, 0, 0)).toBe(0);
  });

  test('calculates realistic city-to-city distance', () => {
    const d = calculateDistance(25.276987, 55.296249, 28.6139, 77.209);
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(2500);
  });
});

describe('isValidCoordinate()', () => {
  test('valid coordinates return true', () => {
    expect(isValidCoordinate(25.2769, 55.2962)).toBe(true);
  });

  test('out-of-bounds lat/lon return false', () => {
    expect(isValidCoordinate(100, 0)).toBe(false);
    expect(isValidCoordinate(0, 200)).toBe(false);
  });

  test('0,0 coordinate returns false', () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });
});

describe('calculateEmissions()', () => {
  test('returns 0 if no trip or no transportMode', () => {
    expect(calculateEmissions(null)).toBe(0);
    expect(calculateEmissions({ distance: 10 })).toBe(0);
  });

  test('calculates emissions correctly', () => {
    const trip = { distance: 50, transportMode: { emissionFactor: 0.192 } };
    expect(calculateEmissions(trip)).toBeCloseTo(9.6);
  });
});

describe('createNewTrip()', () => {
  test('generates trip with correct structure', () => {
    const loc = { latitude: 25, longitude: 55, speed: 12, timestamp: Date.now() };
    const trip = createNewTrip(loc);
    expect(trip).toHaveProperty('id');
    expect(trip.isActive).toBe(true);
    expect(trip.locations.length).toBe(1);
    expect(trip.startLocation).toEqual(loc);
  });
});

describe('handleActiveTripUpdate()', () => {
  test('adds location and updates distance', () => {
    const loc1 = { latitude: 25.2769, longitude: 55.2962, timestamp: 1, speed: 10 };
    const loc2 = { latitude: 25.2779, longitude: 55.2972, timestamp: 2, speed: 12 };
    const trip = createNewTrip(loc1);
    const updatedTrip = handleActiveTripUpdate(trip, loc2);

    expect(updatedTrip.locations.length).toBe(2);
    expect(updatedTrip.distance).toBeGreaterThan(0);
  });
});

describe('selectTransportMode()', () => {
  test('adds transport mode and calculates emissions', () => {
    const trip = { id: '1', distance: 100, isActive: true, locations: [] };
    const mode = { id: 'bus', emissionFactor: 0.089 };
    const updatedTrip = selectTransportMode(trip, mode);

    expect(updatedTrip.transportMode).toEqual(mode);
    expect(updatedTrip.carbonEmissions).toBeCloseTo(8.9);
  });
});

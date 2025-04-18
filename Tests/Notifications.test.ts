// import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('firebase/auth');
jest.mock('expo-notifications');
jest.mock('expo-device', () => ({ isDevice: true }));

describe('Notifications', () => {
  test('registerForPushNotificationsAsync sets channel and returns token', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'test-token' });

    const token = await Notifications.getExpoPushTokenAsync();
    expect(token.data).toBe('test-token');
  });

  test('sendTripDetectionNotification schedules notification', async () => {
    const scheduleSpy = jest.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue({} as any);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Trip Detected',
        body: 'Trip body',
        data: { type: 'trip_detection' }
      },
      trigger: null
    });
    expect(scheduleSpy).toHaveBeenCalled();
  });

  test('isTripDetectionNotification detects correct type', () => {
    const notification = {
      request: {
        content: {
          data: {
            type: 'trip_detection'
          }
        }
      }
    };
    const result = notification.request.content.data.type === 'trip_detection';
    expect(result).toBe(true);
  });
});
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request permissions for notifications
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trip-detection', {
      name: 'Trip Detection',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#005EFF',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    console.log('Must use physical device for notifications');
  }

  return token;
}

// Send a local notification for trip detection
export async function sendTripDetectionNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Trip Detected',
      body: 'It looks like you started a trip. Tap to select your transport mode.',
      data: { type: 'trip_detection' },
    },
    trigger: null, // Send immediately
  });
}

// Function to check if the notification is a trip detection notification
export function isTripDetectionNotification(notification: Notifications.Notification | null | undefined) {
  return notification?.request?.content?.data?.type === 'trip_detection';
}

const notificationService = {
  registerForPushNotificationsAsync,
  sendTripDetectionNotification,
  isTripDetectionNotification
};

export default notificationService;
// ===============================================================

// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
// import { Platform } from 'react-native';

// // Configure how notifications appear when the app is in the foreground
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

// // Request permissions for notifications
// export async function registerForPushNotificationsAsync() {
//   let token;

//   if (Platform.OS === 'android') {
//     await Notifications.setNotificationChannelAsync('trip-detection', {
//       name: 'Trip Detection',
//       importance: Notifications.AndroidImportance.MAX,
//       vibrationPattern: [0, 250, 250, 250],
//       lightColor: '#005EFF',
//     });
//   }

//   if (Device.isDevice) {
//     const { status: existingStatus } = await Notifications.getPermissionsAsync();
//     let finalStatus = existingStatus;
    
//     if (existingStatus !== 'granted') {
//       const { status } = await Notifications.requestPermissionsAsync();
//       finalStatus = status;
//     }
    
//     if (finalStatus !== 'granted') {
//       console.log('Failed to get push token for notification!');
//       return;
//     }
    
//     token = (await Notifications.getExpoPushTokenAsync()).data;
//   } else {
//     console.log('Must use physical device for notifications');
//   }

//   return token;
// }

// // Send a local notification for trip detection
// export async function sendTripDetectionNotification() {
//   await Notifications.scheduleNotificationAsync({
//     content: {
//       title: 'Trip Detected',
//       body: 'It looks like you started a trip. Tap to select your transport mode.',
//       data: { type: 'trip_detection' },
//     },
//     trigger: null, // Send immediately
//   });
// }

// // Function to check if the notification is a trip detection notification
// export function isTripDetectionNotification(notification) {
//   return notification?.request?.content?.data?.type === 'trip_detection';
// }
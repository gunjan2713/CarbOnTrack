import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Animated, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  icon?: string;
  duration?: number;
  onPress?: () => void;
  onDismiss?: () => void;
}

const { width } = Dimensions.get('window');

const InAppNotification: React.FC<NotificationProps> = ({
  visible,
  title,
  message,
  type = 'info',
  icon,
  duration = 3000,
  onPress,
  onDismiss
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const timeout = useRef<NodeJS.Timeout | null>(null);

  // Get color based on notification type
  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#005eff'; // Primary blue for info
    }
  };

  // Get icon based on notification type
  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'alert-circle';
      case 'error':
        return 'close-circle';
      default:
        return 'information-circle';
    }
  };

  // Show notification
  const showNotification = () => {
    // Clear any existing timeout
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    // Animate notification in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8
    }).start();

    // Set timeout to dismiss
    if (duration > 0) {
      timeout.current = setTimeout(() => {
        dismissNotification();
      }, duration);
    }
  };

  // Dismiss notification
  const dismissNotification = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      showNotification();
    } else {
      // Only dismiss if currently visible
      if (currentValue > -100) {
        dismissNotification();
      }
    }
  
    // Clean up timeout on unmount
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, [visible]);

  // Fixed check for visibility - don't use _value which is internal
  let currentValue = 0;
  translateY.addListener(({ value }) => {
    currentValue = value;
  });

  if (!visible && currentValue <= -100) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY }], backgroundColor: getBackgroundColor() }
      ]}
    >
      <TouchableOpacity 
        style={styles.content}
        activeOpacity={0.8}
        onPress={() => {
          if (onPress) onPress();
          dismissNotification();
        }}
      >
        <Ionicons name={getIcon() as any} size={24} color="white" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        <TouchableOpacity 
          onPress={dismissNotification}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="close" size={20} color="white" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48, // Extra padding for status bar
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  message: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  }
});

export default InAppNotification;
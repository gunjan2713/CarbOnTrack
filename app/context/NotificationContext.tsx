import React, { createContext, useState, useContext, useRef } from 'react';

// Define notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationData {
  visible: boolean;
  title: string;
  message: string;
  type: NotificationType;
  icon?: string;
  duration?: number;
  onPress?: () => void;
}

// Default notification state
const defaultNotification: NotificationData = {
  visible: false,
  title: '',
  message: '',
  type: 'info',
  duration: 3000
};

interface NotificationContextType {
  notification: NotificationData;
  showNotification: (data: Partial<NotificationData>) => void;
  hideNotification: () => void;
}

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider component
export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationData>(defaultNotification);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show notification
  const showNotification = (data: Partial<NotificationData>) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Set notification data
    setNotification({
      ...defaultNotification,
      ...data,
      visible: true
    });

    // Auto hide after duration if provided
    const duration = data.duration ?? defaultNotification.duration;
    if (duration && duration > 0) {
      timeoutRef.current = setTimeout(() => {
        hideNotification();
      }, duration);
    }
  };

  // Hide notification
  const hideNotification = () => {
    setNotification(prev => ({ ...prev, visible: false }));
  };

  return (
    <NotificationContext.Provider value={{ notification, showNotification, hideNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Add this default export to fix the error
export default NotificationContext;
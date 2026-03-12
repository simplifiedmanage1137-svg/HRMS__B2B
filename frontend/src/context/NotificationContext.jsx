// context/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);
  const [employeeUpdate, setEmployeeUpdate] = useState(null);
  const [eventNotifications, setEventNotifications] = useState([]);
  const [todayEvents, setTodayEvents] = useState({ birthdays: [], anniversaries: [], total: 0 });

  // Fetch today's events (birthdays and anniversaries)
  const fetchTodayEvents = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/employees/today-events');
      setTodayEvents(response.data);
      
      // Create notifications for events
      const events = [];
      
      response.data.birthdays?.forEach(emp => {
        events.push({
          id: `birthday-${emp.id}-${Date.now()}`,
          type: 'birthday',
          employee: emp,
          message: `🎂 Happy Birthday to ${emp.first_name} ${emp.last_name}!`,
          date: new Date().toISOString(),
          read: false
        });
      });
      
      response.data.anniversaries?.forEach(emp => {
        const years = new Date().getFullYear() - new Date(emp.joining_date).getFullYear();
        events.push({
          id: `anniversary-${emp.id}-${Date.now()}`,
          type: 'anniversary',
          employee: emp,
          message: `🎉 Congratulations! ${emp.first_name} ${emp.last_name} is celebrating ${years} year${years > 1 ? 's' : ''} work anniversary!`,
          years,
          date: new Date().toISOString(),
          read: false
        });
      });
      
      setEventNotifications(events);
    } catch (error) {
      // Don't show error in console for 404 - it's expected if route doesn't exist
      if (error.response?.status !== 404) {
        console.error('Error fetching today events:', error);
      }
    }
  };

  // Check for events every hour
  useEffect(() => {
    fetchTodayEvents();
    
    const interval = setInterval(fetchTodayEvents, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(interval);
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const notifyEmployeeUpdate = (employeeId) => {
    setEmployeeUpdate({ employeeId, timestamp: Date.now() });
  };

  const clearEmployeeUpdate = () => {
    setEmployeeUpdate(null);
  };

  const markEventAsRead = (eventId) => {
    setEventNotifications(prev => 
      prev.map(event => 
        event.id === eventId ? { ...event, read: true } : event
      )
    );
  };

  const markAllEventsAsRead = () => {
    setEventNotifications(prev => 
      prev.map(event => ({ ...event, read: true }))
    );
  };

  return (
    <NotificationContext.Provider value={{
      notification,
      showNotification,
      employeeUpdate,
      notifyEmployeeUpdate,
      clearEmployeeUpdate,
      eventNotifications,
      todayEvents,
      fetchTodayEvents,
      markEventAsRead,
      markAllEventsAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
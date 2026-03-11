// hooks/useEmployeeData.js
import { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axios from 'axios';

export const useEmployeeData = (employeeId) => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { employeeUpdate, clearEmployeeUpdate } = useNotification();

  const fetchEmployee = async () => {
    if (!employeeId) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5173//api/employees/profile/${employeeId}`);
      setEmployee(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching employee:', error);
      setError('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId]);

  // Listen for employee updates
  useEffect(() => {
    if (employeeUpdate && employeeUpdate.employeeId === employeeId) {
      fetchEmployee();
      clearEmployeeUpdate();
    }
  }, [employeeUpdate, employeeId]);

  return { employee, loading, error, refresh: fetchEmployee };
};
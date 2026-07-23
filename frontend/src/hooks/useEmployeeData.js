// hooks/useEmployeeData.js
import { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import axiosInstance from '../config/axios';
import API_ENDPOINTS from '../config/api';


export const useEmployeeData = (employeeId) => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { employeeUpdate, clearEmployeeUpdate } = useNotification();

  const fetchEmployee = async () => {
    if (!employeeId) return;

    try {
      setLoading(true);
      const response = await axiosInstance.get(API_ENDPOINTS.EMPLOYEE_PROFILE(employeeId));
      setEmployee(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching employee:', err);
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

  useEffect(() => {
    if (employeeUpdate && employeeUpdate.employeeId === employeeId) {
      fetchEmployee();
      clearEmployeeUpdate();
    }
  }, [employeeUpdate, employeeId]);

  return { employee, loading, error, refresh: fetchEmployee };
};

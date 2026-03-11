import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

const BRIDGE_URL = 'http://localhost:3001';

export const useFingerprint = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const [bridgeStatus, setBridgeStatus] = useState('disconnected');

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(BRIDGE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to fingerprint bridge');
      setIsConnected(true);
      setBridgeStatus('connected');
      setError(null);
    });

    newSocket.on('connection-status', (data) => {
      console.log('Scanner status:', data);
      setBridgeStatus(data.connected ? 'scanner-ready' : 'scanner-disconnected');
    });

    newSocket.on('fingerprint-data', (data) => {
      console.log('Fingerprint captured:', data);
      setLastScan(data);
      setScanning(false);
    });

    newSocket.on('scanning', (data) => {
      console.log('Scan status:', data);
      if (data.status === 'in-progress') {
        setScanning(true);
      } else {
        setScanning(false);
      }
    });

    newSocket.on('error', (errorData) => {
      console.error('Bridge error:', errorData);
      setError(errorData.message);
      setScanning(false);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from fingerprint bridge');
      setIsConnected(false);
      setBridgeStatus('disconnected');
    });

    setSocket(newSocket);

    // Fetch initial status
    fetch(`${BRIDGE_URL}/api/status`)
      .then(res => res.json())
      .then(data => {
        setBridgeStatus(data.connected ? 'scanner-ready' : 'scanner-disconnected');
      })
      .catch(err => {
        console.error('Failed to fetch bridge status:', err);
        setBridgeStatus('bridge-offline');
      });

    return () => {
      newSocket.close();
    };
  }, []);

  // Function to scan fingerprint
  const scanFingerprint = useCallback(() => {
    if (!isConnected) {
      setError('Bridge server not connected');
      return Promise.reject('Bridge not connected');
    }

    if (bridgeStatus !== 'scanner-ready') {
      setError('Fingerprint scanner not ready');
      return Promise.reject('Scanner not ready');
    }

    setScanning(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (!socket) {
        reject('Socket not initialized');
        return;
      }

      // Set up one-time listener for this scan
      const onData = (data) => {
        socket.off('fingerprint-data', onData);
        socket.off('error', onError);
        resolve(data);
      };

      const onError = (errorData) => {
        socket.off('fingerprint-data', onData);
        socket.off('error', onError);
        reject(errorData);
      };

      socket.once('fingerprint-data', onData);
      socket.once('error', onError);

      // Trigger scan
      socket.emit('scan-fingerprint');
    });
  }, [socket, isConnected, bridgeStatus]);

  // Function to clock in with fingerprint
  const clockInWithFingerprint = useCallback(async (employeeId) => {
    try {
      const fingerprintData = await scanFingerprint();
      
      // Send to your main backend
      const response = await fetch('http://localhost:5173//api/attendance/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          fingerprint_data: fingerprintData,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to clock in');
      }

      return await response.json();
    } catch (error) {
      console.error('Clock-in failed:', error);
      throw error;
    }
  }, [scanFingerprint]);

  return {
    isConnected: isConnected && bridgeStatus === 'scanner-ready',
    scanning,
    lastScan,
    error,
    bridgeStatus,
    scanFingerprint,
    clockInWithFingerprint
  };
};
// src/components/Employee/GeofenceMap.jsx
import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { 
  FaMapMarkerAlt, 
  FaBuilding, 
  FaLocationArrow,
  FaCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCheckCircle
} from 'react-icons/fa';
import PropTypes from 'prop-types';

// Default office coordinates (can be overridden by props)
const DEFAULT_OFFICE_COORDS = {
  name: 'Viman Nagar Office',
  address: '8th Floor SkyVista, 805, Mhada Colony, Viman Nagar, Pune 411014',
  latitude: 18.56835629424307,
  longitude: 73.90856078144989,
  radius: 50 // meters
};

const GeofenceMap = ({ 
  userLocation, 
  officeCoords = DEFAULT_OFFICE_COORDS,
  showDetails = true,
  mapHeight = '250px',
  onLocationUpdate 
}) => {
  const [isInside, setIsInside] = useState(false);
  const [distance, setDistance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userLocation && officeCoords) {
      calculateGeofenceStatus();
    }
  }, [userLocation, officeCoords]);

  // Calculate if user is inside geofence
  const calculateGeofenceStatus = () => {
    try {
      setLoading(true);
      const calculatedDistance = calculateDistance(
        userLocation.latitude, 
        userLocation.longitude,
        officeCoords.latitude, 
        officeCoords.longitude
      );
      
      setDistance(calculatedDistance);
      setIsInside(calculatedDistance <= officeCoords.radius);
      setError(null);
      
      if (onLocationUpdate) {
        onLocationUpdate({
          distance: calculatedDistance,
          isInside: calculatedDistance <= officeCoords.radius,
          coordinates: userLocation
        });
      }
    } catch (err) {
      console.error('Error calculating geofence status:', err);
      setError('Failed to calculate geofence status');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate pixel offset for user location
  const getOffset = (userLoc, officeLoc) => {
    const maxOffset = 40; // Maximum pixels offset for 100m
    const distance = calculateDistance(
      userLoc.latitude, userLoc.longitude,
      officeLoc.latitude, officeLoc.longitude
    );
    
    // Calculate direction (simplified - assumes lat/lng are roughly equal scale)
    const latDiff = userLoc.latitude - officeLoc.latitude;
    const lngDiff = userLoc.longitude - officeLoc.longitude;
    const angle = Math.atan2(latDiff, lngDiff);
    
    // Scale distance to pixels (50m = 50px in our visualization)
    const pixelDistance = Math.min(distance, 100) * 1; // 1m = 1px up to 100px
    
    return {
      x: Math.cos(angle) * pixelDistance,
      y: Math.sin(angle) * pixelDistance
    };
  };

  // Format distance for display
  const formatDistance = (distanceInMeters) => {
    if (distanceInMeters < 1) {
      return `${Math.round(distanceInMeters * 100)} cm`;
    }
    if (distanceInMeters < 1000) {
      return `${distanceInMeters.toFixed(1)} m`;
    }
    return `${(distanceInMeters / 1000).toFixed(2)} km`;
  };

  if (!userLocation) {
    return (
      <Card className="mb-3 border-0 shadow-sm bg-light">
        <Card.Body className="p-2 p-md-3">
          <div className="d-flex align-items-center justify-content-center" style={{ height: '150px' }}>
            <div className="text-center">
              <Spinner animation="border" variant="primary" size="sm" />
              <p className="mt-2 text-muted small">Waiting for location...</p>
            </div>
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body className="p-2 p-md-3">
          <Alert variant="danger" className="mb-0 py-2 small">
            <FaExclamationTriangle className="me-2 flex-shrink-0" />
            {error}
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-3 border-0 shadow-sm">
      <Card.Body className="p-2 p-md-3">
        {/* Header */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-3 gap-2">
          <h6 className="mb-0 d-flex align-items-center">
            <FaMapMarkerAlt className="me-2 text-primary" size={14} />
            Geofence Status
          </h6>
          {loading ? (
            <Spinner size="sm" animation="border" variant="primary" className="ms-0 ms-sm-auto" />
          ) : (
            <Badge 
              bg={isInside ? 'success' : 'warning'} 
              pill
              className="px-3 py-2 ms-0 ms-sm-auto d-inline-flex align-items-center"
            >
              {isInside ? (
                <><FaCheckCircle className="me-1" size={10} /> Inside Geofence</>
              ) : (
                <><FaExclamationTriangle className="me-1" size={10} /> Outside Geofence</>
              )}
            </Badge>
          )}
        </div>

        {/* Map Visualization */}
        <div 
          className="position-relative mb-3" 
          style={{ 
            height: mapHeight, 
            background: 'linear-gradient(145deg, #2c3e50 0%, #3498db 100%)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          {/* Grid lines for visual reference */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 20px)',
            zIndex: 1
          }} />

          {/* Office Center */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '16px',
            height: '16px',
            background: '#dc3545',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 3,
            boxShadow: '0 0 0 4px rgba(220, 53, 69, 0.3)'
          }} title="Office Center" />
          
          {/* 50m Radius Circle */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '120px',
            height: '120px',
            border: '3px solid rgba(40, 167, 69, 0.8)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
            background: 'radial-gradient(circle, rgba(40,167,69,0.1) 0%, rgba(40,167,69,0) 70%)'
          }} title="50m Geofence Radius" />
          
          {/* User Location (if available) */}
          {userLocation && (
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '20px',
                height: '20px',
                transform: `translate(-50%, -50%) translate(${getOffset(userLocation, officeCoords).x}px, ${getOffset(userLocation, officeCoords).y}px)`,
                zIndex: 4
              }}
              title="Your Location"
            >
              <div style={{
                width: '14px',
                height: '14px',
                background: isInside ? '#28a745' : '#ffc107',
                borderRadius: '50%',
                border: '3px solid white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                animation: 'pulse 2s infinite'
              }} />
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="d-flex flex-wrap gap-3 small mb-3">
          <div className="d-flex align-items-center">
            <FaCircle className="text-danger me-2 flex-shrink-0" size={8} />
            <span className="text-muted">Office Center</span>
          </div>
          <div className="d-flex align-items-center">
            <div style={{ 
              width: '10px', 
              height: '10px', 
              border: '2px solid #28a745',
              borderRadius: '50%',
              marginRight: '8px',
              flexShrink: 0
            }} />
            <span className="text-muted">50m Geofence</span>
          </div>
          <div className="d-flex align-items-center">
            <div style={{ 
              width: '12px', 
              height: '12px', 
              background: isInside ? '#28a745' : '#ffc107',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
              marginRight: '6px',
              flexShrink: 0
            }} />
            <span className="text-muted">Your Location</span>
          </div>
        </div>

        {/* Distance and Status Details */}
        {distance !== null && (
          <div className="bg-light p-2 p-md-3 rounded">
            <Row className="g-2">
              <Col xs={12} sm={6} md={12} lg={6}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">Distance from office:</span>
                  <Badge bg={isInside ? 'success' : 'warning'} className="px-3 py-2 ms-2 text-nowrap">
                    {formatDistance(distance)}
                  </Badge>
                </div>
                
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">Geofence radius:</span>
                  <Badge bg="info" className="px-3 py-2 ms-2 text-nowrap">
                    {officeCoords.radius} meters
                  </Badge>
                </div>
              </Col>
              
              <Col xs={12} sm={6} md={12} lg={6}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">Status:</span>
                  <Badge bg={isInside ? 'success' : 'warning'} className="px-3 py-2 ms-2 text-nowrap">
                    {isInside ? '✓ Eligible' : '✗ Not eligible'}
                  </Badge>
                </div>

                {!isInside && distance && (
                  <div className="mt-2 text-warning small">
                    <FaExclamationTriangle className="me-1 flex-shrink-0" size={10} />
                    <span className="d-inline-block">
                      Need to be within {officeCoords.radius}m.
                      <span className="d-block d-sm-inline d-md-block d-lg-inline mt-1 mt-sm-0 mt-md-1 mt-lg-0">
                        You are {(distance - officeCoords.radius).toFixed(1)}m too far.
                      </span>
                    </span>
                  </div>
                )}
              </Col>
            </Row>
          </div>
        )}

        {/* Office Details */}
        {showDetails && (
          <div className="mt-3 pt-2 border-top small">
            <div className="d-flex align-items-start">
              <FaBuilding className="me-2 text-primary mt-1 flex-shrink-0" size={12} />
              <div className="text-wrap" style={{ wordBreak: 'break-word' }}>
                <span className="fw-semibold d-block">{officeCoords.name}</span>
                <span className="text-muted d-block text-wrap">{officeCoords.address}</span>
                <span className="text-muted d-block mt-1 text-wrap" style={{ fontSize: '0.75rem' }}>
                  📍 {officeCoords.latitude.toFixed(6)}, {officeCoords.longitude.toFixed(6)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* User Location Details */}
        {userLocation && showDetails && (
          <div className="mt-2 small text-muted">
            <div className="d-flex align-items-start">
              <FaLocationArrow className="me-2 mt-1 flex-shrink-0" size={10} />
              <span className="text-wrap" style={{ wordBreak: 'break-word' }}>
                Your location: {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                {userLocation.accuracy && (
                  <span className="d-block d-sm-inline d-md-block d-lg-inline ms-0 ms-sm-2 ms-md-0 ms-lg-2">
                    (±{userLocation.accuracy.toFixed(1)}m accuracy)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* CSS Animation */}
        <style jsx>{`
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
            }
          }
        `}</style>
      </Card.Body>
    </Card>
  );
};

// Distance calculation function (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// PropTypes for better documentation and type checking
GeofenceMap.propTypes = {
  userLocation: PropTypes.shape({
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
    accuracy: PropTypes.number,
    timestamp: PropTypes.number
  }),
  officeCoords: PropTypes.shape({
    name: PropTypes.string,
    address: PropTypes.string,
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
    radius: PropTypes.number
  }),
  showDetails: PropTypes.bool,
  mapHeight: PropTypes.string,
  onLocationUpdate: PropTypes.func
};

export default GeofenceMap;
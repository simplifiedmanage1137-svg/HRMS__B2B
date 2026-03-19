// src/components/Employee/OfficeMap.jsx
import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert, Badge } from 'react-bootstrap';
import { 
  FaMapMarkerAlt, 
  FaCircle, 
  FaInfoCircle,
  FaExclamationTriangle,
  FaCheckCircle,
  FaLocationArrow,
  FaBuilding
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

const OfficeMap = ({ 
  userLocation, 
  officeCoords = DEFAULT_OFFICE_COORDS,
  apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY',
  mapHeight = '300px',
  mapType = 'satellite',
  zoom = 18,
  showUserLocation = true,
  showDistance = true,
  onMapLoad 
}) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [distance, setDistance] = useState(null);
  const [isInside, setIsInside] = useState(false);

  useEffect(() => {
    if (userLocation && officeCoords) {
      calculateDistance();
    }
  }, [userLocation, officeCoords]);

  const calculateDistance = () => {
    const calculatedDistance = calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      officeCoords.latitude,
      officeCoords.longitude
    );
    setDistance(calculatedDistance);
    setIsInside(calculatedDistance <= officeCoords.radius);
  };

  // Build Google Maps Static API URL
  const buildMapUrl = () => {
    const center = `${officeCoords.latitude},${officeCoords.longitude}`;
    
    // Base parameters
    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=600x300&maptype=${mapType}`;
    
    // Add office marker
    url += `&markers=color:red%7Clabel:O%7C${officeCoords.latitude},${officeCoords.longitude}`;
    
    // Add geofence circle (50m radius)
    url += `&circle=radius:${officeCoords.radius}%7C${officeCoords.latitude},${officeCoords.longitude}`;
    
    // Add user location marker if available and requested
    if (showUserLocation && userLocation) {
      const markerColor = isInside ? 'green' : 'orange';
      url += `&markers=color:${markerColor}%7Clabel:Y%7C${userLocation.latitude},${userLocation.longitude}`;
    }
    
    // Add API key
    url += `&key=${apiKey}`;
    
    return url;
  };

  const handleImageLoad = () => {
    setMapLoaded(true);
    if (onMapLoad) {
      onMapLoad({ success: true });
    }
  };

  const handleImageError = () => {
    setMapError(true);
    if (onMapLoad) {
      onMapLoad({ success: false, error: 'Failed to load map' });
    }
  };

  const formatDistance = (meters) => {
    if (meters < 1) {
      return `${Math.round(meters * 100)} cm`;
    }
    if (meters < 1000) {
      return `${meters.toFixed(1)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const mapUrl = buildMapUrl();

  return (
    <Card className="mb-3 border-0 shadow-sm">
      <Card.Header className="bg-gradient text-white py-2 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <h6 className="mb-0 small fw-semibold d-flex align-items-center">
          <FaMapMarkerAlt className="me-2" size={14} />
          Office Location Map
        </h6>
        <Badge bg="light" text="dark" className="px-2 py-1 small ms-0 ms-sm-auto">
          {officeCoords.radius}m Geofence
        </Badge>
      </Card.Header>
      
      <Card.Body className="p-2 p-md-3">
        {/* Map Container */}
        <div className="position-relative mb-3">
          {!mapLoaded && !mapError && (
            <div className="d-flex justify-content-center align-items-center" 
              style={{ height: mapHeight, backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div className="text-center">
                <Spinner animation="border" variant="primary" size="sm" />
                <p className="mt-2 text-muted small">Loading map...</p>
              </div>
            </div>
          )}
          
          {mapError ? (
            <div className="d-flex justify-content-center align-items-center" 
              style={{ height: mapHeight, backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div className="text-center">
                <FaExclamationTriangle size={30} className="text-danger mb-2" />
                <p className="text-muted small">Failed to load map</p>
                <small className="text-muted">Please check your API key</small>
              </div>
            </div>
          ) : (
            <img 
              src={mapUrl} 
              alt="Office Location Map" 
              className={`img-fluid rounded ${mapLoaded ? 'd-block' : 'd-none'}`}
              style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </div>

        {/* Map Legend */}
        <div className="d-flex flex-wrap gap-2 gap-md-3 small mb-3">
          <div className="d-flex align-items-center">
            <div style={{ 
              width: '16px', 
              height: '16px', 
              backgroundColor: '#dc3545',
              borderRadius: '50%',
              marginRight: '8px',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              flexShrink: 0
            }} />
            <span className="text-muted">Office</span>
          </div>
          
          <div className="d-flex align-items-center">
            <div style={{ 
              width: '16px', 
              height: '16px', 
              border: '2px solid #28a745',
              borderRadius: '50%',
              marginRight: '8px',
              flexShrink: 0
            }} />
            <span className="text-muted">{officeCoords.radius}m Geofence</span>
          </div>
          
          {showUserLocation && userLocation && (
            <div className="d-flex align-items-center">
              <div style={{ 
                width: '16px', 
                height: '16px', 
                backgroundColor: isInside ? '#28a745' : '#ffc107',
                borderRadius: '50%',
                marginRight: '8px',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                flexShrink: 0
              }} />
              <span className="text-muted">
                You ({isInside ? 'Inside' : 'Outside'})
              </span>
            </div>
          )}
        </div>

        {/* Office Details */}
        <div className="bg-light p-2 p-md-3 rounded mb-3">
          <div className="d-flex align-items-start">
            <FaBuilding className="me-2 text-primary mt-1 flex-shrink-0" size={14} />
            <div className="text-wrap" style={{ wordBreak: 'break-word' }}>
              <span className="fw-semibold d-block">{officeCoords.name}</span>
              <span className="text-muted small d-block text-wrap">{officeCoords.address}</span>
              <span className="text-muted small d-block mt-1 text-wrap" style={{ fontSize: '0.7rem' }}>
                📍 {officeCoords.latitude.toFixed(6)}, {officeCoords.longitude.toFixed(6)}
              </span>
            </div>
          </div>
        </div>

        {/* Distance Information */}
        {showDistance && userLocation && distance !== null && (
          <div className="bg-light p-2 p-md-3 rounded">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
              <div className="d-flex align-items-center">
                <FaLocationArrow className="text-primary me-2 flex-shrink-0" size={12} />
                <span className="text-muted small">Distance from office:</span>
              </div>
              <Badge bg={isInside ? 'success' : 'warning'} className="px-3 py-2 ms-0 ms-sm-auto text-nowrap">
                {formatDistance(distance)}
              </Badge>
            </div>
            
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mt-2 gap-2">
              <span className="text-muted small">Status:</span>
              <Badge bg={isInside ? 'success' : 'warning'} className="px-3 py-2 ms-0 ms-sm-auto d-inline-flex align-items-center text-nowrap">
                {isInside ? (
                  <><FaCheckCircle className="me-1" size={10} /> Inside Geofence</>
                ) : (
                  <><FaExclamationTriangle className="me-1" size={10} /> Outside Geofence</>
                )}
              </Badge>
            </div>

            {!isInside && distance && (
              <div className="mt-2 text-warning small">
                <FaExclamationTriangle className="me-1 flex-shrink-0" size={10} />
                <span className="d-inline-block">
                  Need to be within {officeCoords.radius}m to clock in.
                  <span className="d-block d-sm-inline d-md-block d-lg-inline mt-1 mt-sm-0 mt-md-1 mt-lg-0">
                    You are {(distance - officeCoords.radius).toFixed(1)}m too far.
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* API Key Warning (only in development) */}
        {process.env.NODE_ENV === 'development' && apiKey === 'YOUR_GOOGLE_MAPS_API_KEY' && (
          <Alert variant="warning" className="mt-3 py-2 small">
            <div className="d-flex align-items-center">
              <FaInfoCircle className="me-2 flex-shrink-0" size={12} />
              <span className="text-wrap">Please set your Google Maps API key in environment variables</span>
            </div>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

// Haversine distance calculation function
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
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
OfficeMap.propTypes = {
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
  apiKey: PropTypes.string,
  mapHeight: PropTypes.string,
  mapType: PropTypes.oneOf(['roadmap', 'satellite', 'hybrid', 'terrain']),
  zoom: PropTypes.number,
  showUserLocation: PropTypes.bool,
  showDistance: PropTypes.bool,
  onMapLoad: PropTypes.func
};

export default OfficeMap;
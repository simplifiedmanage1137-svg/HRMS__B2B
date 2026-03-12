import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Alert, Modal } from 'react-bootstrap';
import { FaMapMarkerAlt, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import axios from 'axios';

const GeofenceSettings = () => {
  const [geofences, setGeofences] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState(null);
  const [formData, setFormData] = useState({
    location_name: '',
    latitude: '',
    longitude: '',
    radius_meters: 50
  });

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/geofence/list');
      setGeofences(response.data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingGeofence) {
        await axios.put(`http://localhost:5000/api/geofence/${editingGeofence.id}`, formData);
      } else {
        await axios.post('http://localhost:5000/api/geofence', formData);
      }
      fetchGeofences();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving geofence:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await axios.delete(`http://localhost:5000/api/geofence/${id}`);
        fetchGeofences();
      } catch (error) {
        console.error('Error deleting geofence:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      location_name: '',
      latitude: '',
      longitude: '',
      radius_meters: 50
    });
    setEditingGeofence(null);
  };

  return (
    <div className="p-4">
      <h2 className="mb-4">
        <FaMapMarkerAlt className="me-2 text-primary" />
        Geofence Settings
      </h2>

      <Button 
        variant="primary" 
        className="mb-3"
        onClick={() => setShowModal(true)}
      >
        <FaPlus className="me-2" />
        Add Location
      </Button>

      <Card>
        <Card.Body>
          <Table hover>
            <thead>
              <tr>
                <th>Location</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Radius (m)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {geofences.map(g => (
                <tr key={g.id}>
                  <td>{g.location_name}</td>
                  <td>{g.latitude}</td>
                  <td>{g.longitude}</td>
                  <td>{g.radius_meters}m</td>
                  <td>
                    <span className={`badge bg-${g.is_active ? 'success' : 'secondary'}`}>
                      {g.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <Button 
                      variant="outline-warning" 
                      size="sm" 
                      className="me-2"
                      onClick={() => {
                        setEditingGeofence(g);
                        setFormData(g);
                        setShowModal(true);
                      }}
                    >
                      <FaEdit />
                    </Button>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={() => handleDelete(g.id)}
                    >
                      <FaTrash />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); resetForm(); }}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingGeofence ? 'Edit Location' : 'Add Location'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Location Name</Form.Label>
              <Form.Control
                type="text"
                value={formData.location_name}
                onChange={(e) => setFormData({...formData, location_name: e.target.value})}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Latitude</Form.Label>
              <Form.Control
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) => setFormData({...formData, latitude: e.target.value})}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Longitude</Form.Label>
              <Form.Control
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) => setFormData({...formData, longitude: e.target.value})}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Radius (meters)</Form.Label>
              <Form.Control
                type="number"
                value={formData.radius_meters}
                onChange={(e) => setFormData({...formData, radius_meters: e.target.value})}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {editingGeofence ? 'Update' : 'Add'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default GeofenceSettings;
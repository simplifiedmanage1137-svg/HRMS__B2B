// src/components/Employee/HolidayCalendar.jsx
import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Badge, Form, Row, Col, Button, 
  Alert, Spinner, InputGroup 
} from 'react-bootstrap';
import { 
  FaCalendarAlt, 
  FaDownload, 
  FaPrint, 
  FaSun, 
  FaUmbrellaBeach,
  FaSearch,
  FaTimes,
  FaInfoCircle,
  FaGlobe,
  FaFlag
} from 'react-icons/fa';
import { holidays, getHolidaysByRegion, getHolidaysByYear } from '../../data/holidays';
import PropTypes from 'prop-types';

const HolidayCalendar = ({ 
  employeeRegion = 'All', 
  onHolidaySelect,
  maxHeight = '300px',
  showFilters = true 
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedRegion, setSelectedRegion] = useState(employeeRegion);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [filteredHolidays, setFilteredHolidays] = useState([]);

  const years = [2024, 2025, 2026, 2027, 2028];
  const regions = ['All', 'India', 'USA', 'Global'];

  useEffect(() => {
    filterHolidays();
  }, [selectedYear, selectedRegion, searchTerm]);

  const filterHolidays = () => {
    setLoading(true);
    
    // Get holidays by region and year
    let holidaysList = getHolidaysByRegion(selectedRegion)
      .filter(h => new Date(h.date).getFullYear() === selectedYear);

    // Apply search filter
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      holidaysList = holidaysList.filter(h => 
        h.name.toLowerCase().includes(term) ||
        h.region.toLowerCase().includes(term) ||
        formatDate(h.date).toLowerCase().includes(term)
      );
    }

    setFilteredHolidays(holidaysList);
    setLoading(false);
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  const handleRegionChange = (region) => {
    setSelectedRegion(region);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const getRegionBadge = (region) => {
    const colors = {
      'India': 'primary',
      'USA': 'danger',
      'Global': 'success'
    };
    
    const icons = {
      'India': <FaFlag className="me-1" size={10} />,
      'USA': <FaFlag className="me-1" size={10} />,
      'Global': <FaGlobe className="me-1" size={10} />
    };

    return (
      <Badge bg={colors[region] || 'secondary'} className="px-2 py-1 d-inline-flex align-items-center">
        {icons[region]}
        <span className="d-none d-sm-inline ms-1">{region}</span>
        <span className="d-inline d-sm-none ms-1">{region.substring(0, 1)}</span>
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatShortDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });
  };

  const handleDownload = () => {
    try {
      // Create CSV content
      const headers = ['Sr No', 'Date', 'Holiday', 'Region', 'Day'];
      const rows = filteredHolidays.map((h, index) => {
        const date = new Date(h.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        return [
          index + 1,
          formatDate(h.date),
          h.name,
          h.region,
          dayName
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Holidays_${selectedYear}_${selectedRegion}.csv`;
      a.click();
      
      setMessage({
        type: 'success',
        text: 'Holiday list downloaded successfully!'
      });
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 3000);
    } catch (error) {
      console.error('Error downloading file:', error);
      setMessage({
        type: 'danger',
        text: 'Failed to download holiday list'
      });
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleHolidayClick = (holiday) => {
    if (onHolidaySelect) {
      onHolidaySelect(holiday);
    }
  };

  const getDayOfWeek = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const isUpcoming = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const holidayDate = new Date(dateStr);
    holidayDate.setHours(0, 0, 0, 0);
    return holidayDate >= today;
  };

  return (
    <Card className="border-0 shadow-sm">
      {showMessage && (
        <Alert 
          variant={message.type} 
          className="mb-2 py-1 small mx-2 mx-md-3 mt-2" 
          onClose={() => setShowMessage(false)} 
          dismissible
        >
          <div className="d-flex align-items-center">
            {message.type === 'success' && <FaInfoCircle className="me-2 flex-shrink-0" size={12} />}
            {message.type === 'danger' && <FaTimes className="me-2 flex-shrink-0" size={12} />}
            <span>{message.text}</span>
          </div>
        </Alert>
      )}
      
      <Card.Header className="bg-gradient text-white py-2 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2" 
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <h6 className="mb-0 small fw-semibold d-flex align-items-center">
          <FaSun className="me-2" size={14} />
          Company Holidays {selectedYear}
        </h6>
        <Badge bg="light" text="dark" className="px-2 py-1 small ms-0 ms-sm-auto">
          Total: {filteredHolidays.length} Holidays
        </Badge>
      </Card.Header>
      
      <Card.Body className="p-2 p-md-3">
        {/* Filters */}
        {showFilters && (
          <>
            <Row className="mb-3 g-2">
              <Col xs={12} md={4}>
                <Form.Group>
                  <Form.Label className="small text-muted">Year</Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedYear}
                    onChange={(e) => handleYearChange(parseInt(e.target.value))}
                    className="bg-light border-0"
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={4}>
                <Form.Group>
                  <Form.Label className="small text-muted">Region</Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedRegion}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    className="bg-light border-0"
                  >
                    {regions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={4}>
                <Form.Group>
                  <Form.Label className="small text-muted">Search</Form.Label>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light border-0">
                      <FaSearch size={10} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Search holidays..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-0 bg-light"
                    />
                    {searchTerm && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={clearSearch}
                        className="border-0"
                      >
                        <FaTimes size={10} />
                      </Button>
                    )}
                  </InputGroup>
                </Form.Group>
              </Col>
            </Row>

            {/* Active Filters */}
            {(searchTerm || selectedRegion !== 'All') && (
              <div className="d-flex flex-wrap align-items-center mb-2 gap-2">
                <small className="text-muted">Active filters:</small>
                {selectedRegion !== 'All' && (
                  <Badge bg="info" className="px-2 py-1">
                    Region: {selectedRegion}
                  </Badge>
                )}
                {searchTerm && (
                  <Badge bg="info" className="px-2 py-1">
                    Search: "{searchTerm}"
                  </Badge>
                )}
              </div>
            )}
          </>
        )}

        {/* Holiday Table */}
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" size="sm" />
            <p className="mt-2 text-muted small">Loading holidays...</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight, overflowY: 'auto' }}>
            <Table size="sm" className="mb-0">
              <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                <tr>
                  <th className="small fw-semibold text-dark text-center" style={{ width: '50px' }}>#</th>
                  <th className="small fw-semibold text-dark">Date</th>
                  <th className="small fw-semibold text-dark d-none d-sm-table-cell">Day</th>
                  <th className="small fw-semibold text-dark">Holiday</th>
                  <th className="small fw-semibold text-dark">Region</th>
                  <th className="small fw-semibold text-dark text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHolidays.length > 0 ? (
                  filteredHolidays.map((holiday, index) => {
                    const upcoming = isUpcoming(holiday.date);
                    const dayOfWeek = getDayOfWeek(holiday.date);
                    
                    return (
                      <tr 
                        key={index} 
                        onClick={() => handleHolidayClick(holiday)}
                        style={{ cursor: onHolidaySelect ? 'pointer' : 'default' }}
                        className={upcoming ? 'table-light' : ''}
                      >
                        <td className="small text-center">{index + 1}</td>
                        <td className="small">
                          <span className="d-block d-sm-none">{formatShortDate(holiday.date)}</span>
                          <span className="d-none d-sm-block">{formatDate(holiday.date)}</span>
                          <small className="text-muted d-block d-sm-none">{formatDate(holiday.date)}</small>
                        </td>
                        <td className="small d-none d-sm-table-cell">{dayOfWeek}</td>
                        <td className="small fw-semibold text-wrap" style={{ wordBreak: 'break-word' }}>{holiday.name}</td>
                        <td>{getRegionBadge(holiday.region)}</td>
                        <td className="text-center">
                          {upcoming ? (
                            <Badge bg="success" pill className="px-2 py-1 text-nowrap">
                              Upcoming
                            </Badge>
                          ) : (
                            <Badge bg="secondary" pill className="px-2 py-1 text-nowrap">
                              Past
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      <FaSun size={30} className="text-muted mb-2 opacity-50" />
                      <p className="text-muted small mb-0">No holidays found</p>
                      {searchTerm && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          onClick={clearSearch}
                          className="mt-2"
                        >
                          Clear search
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        )}

        {/* Summary */}
        {filteredHolidays.length > 0 && (
          <div className="mt-2 p-2 bg-light rounded small">
            <Row className="g-2">
              <Col xs={6} sm={3}>
                <span className="text-muted">Total:</span>
                <strong className="ms-2">{filteredHolidays.length}</strong>
              </Col>
              <Col xs={6} sm={3}>
                <span className="text-muted">India:</span>
                <strong className="ms-2">
                  {filteredHolidays.filter(h => h.region === 'India').length}
                </strong>
              </Col>
              <Col xs={6} sm={3}>
                <span className="text-muted">USA:</span>
                <strong className="ms-2">
                  {filteredHolidays.filter(h => h.region === 'USA').length}
                </strong>
              </Col>
              <Col xs={6} sm={3}>
                <span className="text-muted">Global:</span>
                <strong className="ms-2">
                  {filteredHolidays.filter(h => h.region === 'Global').length}
                </strong>
              </Col>
            </Row>
            <Row className="mt-1 g-2">
              <Col xs={6}>
                <small className="text-muted">
                  Upcoming: {filteredHolidays.filter(h => isUpcoming(h.date)).length}
                </small>
              </Col>
              <Col xs={6}>
                <small className="text-muted">
                  Past: {filteredHolidays.filter(h => !isUpcoming(h.date)).length}
                </small>
              </Col>
            </Row>
          </div>
        )}

        {/* Download Buttons */}
        <div className="mt-3 d-flex flex-column flex-sm-row justify-content-end gap-2">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={handleDownload}
            disabled={filteredHolidays.length === 0}
            className="d-inline-flex align-items-center justify-content-center"
          >
            <FaDownload className="me-1" size={10} />
            Download CSV
          </Button>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={handlePrint}
            disabled={filteredHolidays.length === 0}
            className="d-inline-flex align-items-center justify-content-center"
          >
            <FaPrint className="me-1" size={10} />
            Print
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

// PropTypes for better documentation
HolidayCalendar.propTypes = {
  employeeRegion: PropTypes.oneOf(['All', 'India', 'USA', 'Global']),
  onHolidaySelect: PropTypes.func,
  maxHeight: PropTypes.string,
  showFilters: PropTypes.bool
};

export default HolidayCalendar;
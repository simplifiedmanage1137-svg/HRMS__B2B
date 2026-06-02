// src/components/Employee/HolidayCalendar.jsx

import React, { useState, useEffect } from 'react';
import { Card, Badge, Row, Col, Alert, Button } from 'react-bootstrap';
import { FaCalendarAlt, FaInfoCircle, FaGift, FaStar } from 'react-icons/fa';
import { holidays, getUpcomingHolidays } from '../../data/holidays';

const HolidayCalendar = ({ employeeRegion = 'All' }) => {
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [filteredHolidays, setFilteredHolidays] = useState([]);

  useEffect(() => {
    // Get upcoming holidays
    const upcoming = getUpcomingHolidays(new Date(), 10);
    setUpcomingHolidays(upcoming);

    // Filter holidays by year
    const yearHolidays = holidays.filter(h => h.date.startsWith(selectedYear.toString()));
    
    // Filter by employee region
    const regionFiltered = yearHolidays.filter(h => 
      h.region === 'USA & India' || 
      h.region === employeeRegion || 
      employeeRegion === 'All'
    );
    
    setFilteredHolidays(regionFiltered);
  }, [selectedYear, employeeRegion]);

  const getMonthName = (monthNumber) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[parseInt(monthNumber) - 1];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Group holidays by month
  const holidaysByMonth = filteredHolidays.reduce((acc, holiday) => {
    const month = holiday.date.split('-')[1];
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(holiday);
    return acc;
  }, {});

  return (
    <Card className="border-0 shadow-sm mt-4">
      <Card.Header className="bg-gradient py-3" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <h6 className="mb-1 text-dark d-flex align-items-center">
              <FaCalendarAlt className="me-2" />
              Company Holiday Calendar — {selectedYear}
            </h6>
            <p className="mb-0 text-black-50 small">United States & India</p>
          </div>
          <div className="d-flex gap-2">
            <Button 
              size="sm" 
              variant="light"
              onClick={() => setSelectedYear(2025)}
              active={selectedYear === 2025}
            >
              2025
            </Button>
            <Button 
              size="sm" 
              variant="light"
              onClick={() => setSelectedYear(2026)}
              active={selectedYear === 2026}
            >
              2026
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Body className="p-3 p-md-4">
        {/* Optional Holiday Note */}
        <Alert variant="info" className="mb-3 py-2 small">
          <FaInfoCircle className="me-2" />
          <strong>Note:</strong> Gandhi Jayanti is an optional holiday — employees who work on this day will receive double pay.
        </Alert>

        {/* Upcoming Holidays Widget */}
        {upcomingHolidays.length > 0 && (
          <div className="mb-4">
            <h6 className="mb-2 small fw-bold text-primary">🎉 Upcoming Holidays</h6>
            <div className="d-flex flex-wrap gap-2">
              {upcomingHolidays.map((holiday, index) => (
                <Badge 
                  key={index}
                  bg="warning" 
                  text="dark"
                  className="p-2 d-flex align-items-center gap-2"
                  style={{ fontSize: '0.75rem' }}
                >
                  <FaStar size={10} />
                  {formatDate(holiday.date)} - {holiday.name}
                  {holiday.type === 'optional_holiday' && (
                    <FaGift className="ms-1" size={10} />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Holiday Calendar Grid */}
        <div className="holiday-calendar">
          {Object.keys(holidaysByMonth).sort().map(month => (
            <div key={month} className="mb-4">
              <h6 className="mb-2 pb-1 border-bottom" style={{ color: '#4e73df' }}>
                {getMonthName(month)} {selectedYear}
              </h6>
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead className="bg-light">
                    <tr className="small">
                      <th style={{ width: '30%' }}>Date</th>
                      <th style={{ width: '50%' }}>Holiday</th>
                      <th style={{ width: '20%' }}>Region</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidaysByMonth[month].map((holiday, idx) => (
                      <tr key={idx} className={holiday.type === 'optional_holiday' ? 'table-warning' : ''}>
                        <td className="small">{formatDate(holiday.date)}</td>
                        <td className="small">
                          {holiday.name}
                          {holiday.type === 'optional_holiday' && (
                            <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '8px' }}>
                              Optional
                            </Badge>
                          )}
                          {holiday.note && (
                            <small className="text-muted d-block">{holiday.note}</small>
                          )}
                        </td>
                        <td className="small">
                          <Badge bg={holiday.region === 'India' ? 'info' : 'primary'} pill>
                            {holiday.region}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-3 pt-2 border-top">
          <small className="text-muted">
            <FaInfoCircle className="me-1" size={10} />
            This calendar is subject to change. Please contact HR for the latest updates.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default HolidayCalendar;
// src/components/Layout/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FaTachometerAlt, 
  FaUsers, 
  FaCalendarAlt, 
  FaMoneyBill, 
  FaUserCircle,
  FaSignOutAlt,
  FaFingerprint,
  FaClock,
  FaBars,
  FaChevronLeft,
  FaChevronRight,
  FaBell,
  FaPaperPlane
} from 'react-icons/fa';
import axios from 'axios';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [employeeName, setEmployeeName] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Sidebar widths
  const SIDEBAR_WIDTH_OPEN = '200px';
  const SIDEBAR_WIDTH_CLOSED = '80px';

  useEffect(() => {
    if (user) {
      fetchEmployeeName();
      if (user?.role === 'admin') {
        fetchPendingCount();
      }
    }
  }, [user]);

  // Check window size for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update main content margin when sidebar state changes
  useEffect(() => {
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    if (mainContentWrapper) {
      if (!isMobile) {
        const marginLeft = isOpen ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_CLOSED;
        mainContentWrapper.style.marginLeft = marginLeft;
      } else {
        mainContentWrapper.style.marginLeft = '0';
      }
    }
  }, [isOpen, isMobile]);

  const fetchEmployeeName = async () => {
    try {
      if (user?.role === 'admin') {
        setEmployeeName('Administrator');
        return;
      }
      
      const response = await axios.get(`http://localhost:5000/api/employees/profile/${user?.employeeId}`);
      if (response.data) {
        const fullName = `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim();
        setEmployeeName(fullName || 'Employee');
      }
    } catch (error) {
      console.error('Error fetching employee name:', error);
      setEmployeeName(user?.role === 'admin' ? 'Administrator' : 'Employee');
    }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/admin-updates/pending-count');
      setPendingCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const getSidebarWidth = () => {
    if (isMobile) {
      return isOpen ? SIDEBAR_WIDTH_OPEN : '0';
    }
    return isOpen ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_CLOSED;
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && !isOpen && (
        <button
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: '70px',
            left: '10px',
            zIndex: 1000,
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            border: 'none',
            background: 'linear-gradient(180deg, #d53f8c 0%, #97266d 100%)',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          <FaBars size={20} />
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* Sidebar */}
      <div
        className="sidebar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: getSidebarWidth(),
          background: 'linear-gradient(180deg, #d53f8c 0%, #97266d 100%)',
          color: 'white',
          transition: 'width 0.3s ease, left 0.3s ease',
          overflowX: 'hidden',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: isOpen ? '2px 0 10px rgba(0,0,0,0.3)' : 'none',
          left: isMobile && !isOpen ? '-280px' : '0'
        }}
      >
        {/* Toggle Button - Desktop */}
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            style={{
              position: 'absolute',
              top: '30px',
              right: '4px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#d53f8c',
              border: '2px solid white',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 1001,
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              padding: 0
            }}
          >
            {isOpen ? <FaChevronLeft size={12} /> : <FaChevronRight size={12} />}
          </button>
        )}

        {/* Sidebar Content */}
        <div style={{
          padding: isOpen ? '20px 10px' : '20px 5px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%'
        }}>
          {/* Header */}
          <div style={{ 
            marginBottom: '30px',
            textAlign: isOpen ? 'left' : 'center',
            marginTop: '10px'
          }}>
            {isOpen ? (
              <>
                <h4 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>EMS</h4>
                <p style={{ margin: '5px 0 0', fontSize: '12px', opacity: 0.8 }}>
                  {user?.role === 'admin' ? 'Administrator' : 'Employee'}
                </p>
              </>
            ) : (
              <h4 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>E</h4>
            )}
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, width: '100%' }}>
            {/* Dashboard - Common for all */}
            <NavLink 
              to="/" 
              end
              onClick={closeSidebar}
              style={({ isActive }) => ({
                color: 'white',
                padding: isOpen ? '12px 15px' : '12px 0',
                borderRadius: '8px',
                marginBottom: '5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isOpen ? 'flex-start' : 'center',
                gap: isOpen ? '10px' : '0',
                textDecoration: 'none',
                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                width: '100%',
                boxSizing: 'border-box'
              })}
              title={!isOpen ? 'Dashboard' : ''}
            >
              <FaTachometerAlt size={18} />
              {isOpen && <span>Dashboard</span>}
            </NavLink>

            {user?.role === 'admin' ? (
              // ✅ ADMIN MENU ITEMS
              <>
                <NavLink 
                  to="/admin/employees" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Employees' : ''}
                >
                  <FaUsers size={18} />
                  {isOpen && <span>Employees</span>}
                </NavLink>
                
                <NavLink 
                  to="/admin/leave-requests" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Leave Requests' : ''}
                >
                  <FaCalendarAlt size={18} />
                  {isOpen && <span>Leave Requests</span>}
                </NavLink>

                <NavLink 
                  to="/admin/attendance/reports" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Attendance' : ''}
                >
                  <FaClock size={18} />
                  {isOpen && <span>Attendance</span>}
                </NavLink>

                {/* ✅ SEND UPDATE REQUEST LINK */}
                <NavLink 
                  to="/admin/send-update-request" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Send Update' : ''}
                >
                  <FaPaperPlane size={18} />
                  {isOpen && <span>Send Update Request</span>}
                </NavLink>

                {/* ✅ UPDATE APPROVALS LINK - YAHI PE CLICK KARNA HAI */}
                <NavLink 
                  to="/admin/update-approvals" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box',
                    position: 'relative'
                  })}
                  title={!isOpen ? 'Update Approvals' : ''}
                >
                  <FaBell size={18} />
                  {isOpen && <span>Update Approvals</span>}
                  {isOpen && pendingCount > 0 && (
                    <span style={{
                      backgroundColor: '#ff4444',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '2px 6px',
                      fontSize: '10px',
                      marginLeft: 'auto'
                    }}>
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              </>
            ) : (
              // ✅ EMPLOYEE MENU ITEMS
              <>
                <NavLink 
                  to="/profile" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Profile' : ''}
                >
                  <FaUserCircle size={18} />
                  {isOpen && <span>My Profile</span>}
                </NavLink>
                
                <NavLink 
                  to="/attendance" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Attendance' : ''}
                >
                  <FaFingerprint size={18} />
                  {isOpen && <span>Daily Attendance</span>}
                </NavLink>
                
                <NavLink 
                  to="/apply-leave" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Apply Leave' : ''}
                >
                  <FaCalendarAlt size={18} />
                  {isOpen && <span>Apply Leave</span>}
                </NavLink>
                
                <NavLink 
                  to="/salary-slip" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Salary' : ''}
                >
                  <FaMoneyBill size={18} />
                  {isOpen && <span>Salary Slip</span>}
                </NavLink>

                {/* ✅ EMPLOYEE UPDATE REQUESTS LINK */}
                <NavLink 
                  to="/employee/update-requests" 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    color: 'white',
                    padding: isOpen ? '12px 15px' : '12px 0',
                    borderRadius: '8px',
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                    gap: isOpen ? '10px' : '0',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  })}
                  title={!isOpen ? 'Update Requests' : ''}
                >
                  <FaBell size={18} />
                  {isOpen && <span>Update Requests</span>}
                </NavLink>
              </>
            )}
          </nav>

          {/* User Info */}
          <div style={{ 
            marginTop: 'auto', 
            padding: isOpen ? '20px 0' : '20px 0',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            textAlign: isOpen ? 'left' : 'center',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {isOpen ? (
              <>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '10px',
                  width: '100%',
                  overflow: 'hidden'
                }}>
                  <FaUserCircle size={20} style={{ marginRight: '8px', flexShrink: 0 }} />
                  <div style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{employeeName}</div>
                    <small style={{ 
                      fontSize: '10px', 
                      opacity: 0.7,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {user?.role === 'admin' ? 'Admin' : `ID: ${user?.employeeId}`}
                    </small>
                  </div>
                </div>
                <button 
                  onClick={logout} 
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                >
                  <FaSignOutAlt size={14} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                width: '100%'
              }}>
                <FaUserCircle size={24} style={{ marginBottom: '8px' }} />
                <button 
                  onClick={logout} 
                  style={{
                    width: '32px',
                    height: '32px',
                    padding: '0',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                  title="Logout"
                >
                  <FaSignOutAlt size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
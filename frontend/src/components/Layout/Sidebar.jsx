// src/components/Layout/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  FaPaperPlane,
  FaFileAlt,
  FaChartBar,
  FaEdit,
  FaCheckCircle,
  FaHourglassHalf,
  FaTrophy
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { Badge, Spinner } from 'react-bootstrap';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [employeeName, setEmployeeName] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [overtimeStats, setOvertimeStats] = useState({
    hasOvertime: false,
    totalHours: 0
  });

  // Sidebar widths
  const SIDEBAR_WIDTH_OPEN = '200px';
  const SIDEBAR_WIDTH_CLOSED = '80px';

  useEffect(() => {
    if (user) {
      fetchEmployeeName();
      if (user?.role === 'admin') {
        fetchPendingCount();
      } else if (user?.role === 'employee') {
        fetchOvertimeStats();
      }
    }
  }, [user]);

  // 👇 Add event listener for approval/rejection updates
  useEffect(() => {
    if (user?.role === 'admin') {
      const handleUpdateApprovals = () => {
        console.log('📢 Update approvals changed, refreshing count...');
        fetchPendingCount();
      };
      
      window.addEventListener('updateApprovalsChanged', handleUpdateApprovals);
      
      return () => {
        window.removeEventListener('updateApprovalsChanged', handleUpdateApprovals);
      };
    }
  }, [user]);

  useEffect(() => {
    if (location.pathname === '/admin/update-approvals') {
      setPendingCount(0);
      markNotificationsAsRead();
    }
  }, [location.pathname]);

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

      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user?.employeeId));
      if (response.data) {
        const fullName = `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim();
        setEmployeeName(fullName || 'Employee');
      }
    } catch (error) {
      console.error('Error fetching employee name:', error);
      setEmployeeName(user?.role === 'admin' ? 'Administrator' : 'Employee');
    }
  };

  const fetchOvertimeStats = async () => {
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      const response = await axios.get(
        `${API_ENDPOINTS.ATTENDANCE}/overtime/${user?.employeeId}/${currentMonth}/${currentYear}`
      );
      
      if (response.data.success) {
        const totalHours = response.data.summary?.total_hours || 0;
        setOvertimeStats({
          hasOvertime: totalHours > 0,
          totalHours: totalHours
        });
      }
    } catch (error) {
      console.error('Error fetching overtime stats:', error);
    }
  };

  const fetchPendingCount = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_ENDPOINTS.ADMIN_UPDATES_PENDING_COUNT);
      const count = response.data.count || 0;
      setPendingCount(count);
      console.log('📊 Updated pending count:', count);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationsAsRead = async () => {
    try {
      await axios.post(API_ENDPOINTS.ADMIN_UPDATES_MARK_READ);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
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

  const NavItem = ({ to, icon, label, badge, onClick, end = false }) => (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
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
        position: 'relative',
        transition: 'all 0.2s ease',
        ':hover': {
          backgroundColor: 'rgba(255,255,255,0.1)'
        }
      })}
      title={!isOpen ? label : ''}
    >
      {icon}
      {isOpen && (
        <>
          <span style={{ flex: 1 }}>{label}</span>
          {badge > 0 && (
            <Badge
              bg="danger"
              pill
              style={{
                fontSize: '10px',
                padding: '2px 6px'
              }}
            >
              {badge}
            </Badge>
          )}
        </>
      )}
      {!isOpen && badge > 0 && (
        <Badge
          bg="danger"
          pill
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            fontSize: '8px',
            padding: '2px 4px'
          }}
        >
          {badge}
        </Badge>
      )}
    </NavLink>
  );

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

      {/* Desktop Toggle Button */}
      {!isMobile && (
        <button
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: '30px',
            left: isOpen ? '150px' : '60px',
            zIndex: 1001,
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
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            padding: 0,
            transition: 'left 0.3s ease',
            transform: 'translateX(-50%)'
          }}
        >
          {isOpen ? <FaChevronLeft size={12} /> : <FaChevronRight size={12} />}
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
            <NavItem
              to="/"
              end={true}
              icon={<FaTachometerAlt size={18} />}
              label="Dashboard"
              onClick={closeSidebar}
            />

            {user?.role === 'admin' ? (
              // ✅ ADMIN MENU ITEMS
              <>
                <NavItem
                  to="/admin/employees"
                  icon={<FaUsers size={18} />}
                  label="Employees"
                  onClick={closeSidebar}
                />

                <NavItem
                  to="/admin/leave-requests"
                  icon={<FaCalendarAlt size={18} />}
                  label="Leave Requests"
                  onClick={closeSidebar}
                />

                <NavItem
                  to="/admin/attendance-reports"
                  icon={<FaClock size={18} />}
                  label="Attendance"
                  onClick={closeSidebar}
                />



                {/* SEND UPDATE REQUEST LINK */}
                <NavItem
                  to="/admin/send-update-request"
                  icon={<FaPaperPlane size={18} />}
                  label="Send Update Request"
                  onClick={closeSidebar}
                />

                {/* UPDATE APPROVALS LINK WITH BADGE */}
                <NavItem
                  to="/admin/update-approvals"
                  icon={<FaBell size={18} />}
                  label="Update Approvals"
                  badge={pendingCount}
                  onClick={() => {
                    closeSidebar();
                    setPendingCount(0);
                    markNotificationsAsRead();
                  }}
                />
              </>
            ) : (
              // ✅ EMPLOYEE MENU ITEMS
              <>
                <NavItem
                  to="/profile"
                  icon={<FaUserCircle size={18} />}
                  label="My Profile"
                  onClick={closeSidebar}
                />

                <NavItem
                  to="/attendance"
                  icon={<FaFingerprint size={18} />}
                  label="Daily Attendance"
                  onClick={closeSidebar}
                />


                <NavItem
                  to="/apply-leave"
                  icon={<FaCalendarAlt size={18} />}
                  label="Apply Leave"
                  onClick={closeSidebar}
                />


                <NavItem
                  to="/salary-slip"
                  icon={<FaMoneyBill size={18} />}
                  label="Salary Slip"
                  onClick={closeSidebar}
                />

                {/* EMPLOYEE UPDATE REQUESTS LINK */}
                <NavItem
                  to="/employee/update-requests"
                  icon={<FaEdit size={18} />}
                  label="Update Requests"
                  onClick={closeSidebar}
                />
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
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    ':hover': {
                      background: 'rgba(255,255,255,0.2)'
                    }
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
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    ':hover': {
                      background: 'rgba(255,255,255,0.2)'
                    }
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
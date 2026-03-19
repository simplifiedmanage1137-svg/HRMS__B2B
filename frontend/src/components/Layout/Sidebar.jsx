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
      className="text-white text-decoration-none w-100 position-relative"
      style={({ isActive }) => ({
        padding: isOpen ? '12px 15px' : '12px 0',
        borderRadius: '8px',
        marginBottom: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isOpen ? 'flex-start' : 'center',
        gap: isOpen ? '10px' : '0',
        backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
        transition: 'all 0.2s ease',
        boxSizing: 'border-box'
      })}
      title={!isOpen ? label : ''}
    >
      <span className="flex-shrink-0">{icon}</span>
      {isOpen && (
        <>
          <span className="flex-grow-1 text-truncate">{label}</span>
          {badge > 0 && (
            <Badge
              bg="danger"
              pill
              className="ms-2"
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
          className="position-absolute"
          style={{
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
          className="btn position-fixed d-flex align-items-center justify-content-center border-0"
          style={{
            top: '70px',
            left: '10px',
            zIndex: 1000,
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            padding: '0',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
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
          className="btn position-fixed d-flex align-items-center justify-content-center border-0 p-0"
          style={{
            top: isOpen ? '30px' : '18px',
            left: isOpen ? '150px' : '60px',
            zIndex: 1001,
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'white',
            border: '2px solid white',
            color: 'black',
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
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
          className="position-fixed top-0 start-0 end-0 bottom-0"
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* Sidebar */}
      <div
        className="sidebar position-fixed top-0 start-0 vh-100 overflow-hidden"
        style={{
          width: getSidebarWidth(),
          background: 'linear-gradient(180deg, #d53f8c 0%, #97266d 100%)',
          color: 'white',
          transition: 'width 0.3s ease, left 0.3s ease',
          zIndex: 1000,
          boxShadow: isOpen ? '2px 0 10px rgba(0,0,0,0.3)' : 'none',
          left: isMobile && !isOpen ? '-280px' : '0'
        }}
      >
        {/* Sidebar Content */}
        <div className={`h-100 d-flex flex-column overflow-auto ${isOpen ? 'p-3' : 'p-2'}`}>
          {/* Header */}
          <div className={`mb-4 mt-2 ${isOpen ? 'text-start' : 'text-center'}`}>
            {isOpen ? (
              <>
                <h4 className="mb-0 fw-bold" style={{ fontSize: '24px' }}>EMS</h4>
                <p className="mb-0 mt-1 small opacity-75">
                  {user?.role === 'admin' ? 'Administrator' : 'Employee'}
                </p>
              </>
            ) : (
              <h4 className="mb-0 fw-bold" style={{ fontSize: '20px' }}>E</h4>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-grow-1 w-100">
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
                  to="/admin/attendance/reports"
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
          <div className={`mt-auto pt-3 border-top ${isOpen ? 'text-start' : 'text-center'}`} 
            style={{ borderTopColor: 'rgba(255,255,255,0.2)' }}>
            {isOpen ? (
              <>
                <div className="d-flex align-items-center mb-2 w-100 overflow-hidden">
                  <FaUserCircle size={20} className="me-2 flex-shrink-0" />
                  <div className="overflow-hidden">
                    <div className="fw-bold small text-truncate">{employeeName}</div>
                    <small className="opacity-75 d-block text-truncate" style={{ fontSize: '10px' }}>
                      {user?.role === 'admin' ? 'Admin' : `ID: ${user?.employeeId}`}
                    </small>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="btn w-100 d-flex align-items-center justify-content-center gap-2 border-0"
                  style={{
                    padding: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <FaSignOutAlt size={14} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <div className="d-flex flex-column align-items-center w-100">
                <FaUserCircle size={24} className="mb-2" />
                <button
                  onClick={logout}
                  className="btn border-0 d-flex align-items-center justify-content-center p-0"
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
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
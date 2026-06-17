import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FaTachometerAlt, FaUsers, FaCalendarAlt, FaMoneyBill,
  FaUserCircle, FaSignOutAlt, FaFingerprint, FaClock,
  FaBell, FaPaperPlane, FaEdit, FaUserTie,
  FaBullhorn, FaStar, FaChevronRight, FaLayerGroup
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { Badge } from 'react-bootstrap';

const SIDEBAR_OPEN   = '260px';
const SIDEBAR_CLOSED = '72px';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [employeeName, setEmployeeName]               = useState('');
  const [employeeDesignation, setEmployeeDesignation] = useState('');
  const [isOpen, setIsOpen]     = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  /* ── data fetching ── */
  useEffect(() => {
    if (user) {
      fetchEmployeeName();
      if (user?.role === 'admin') fetchPendingCount();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin') {
      const h = () => fetchPendingCount();
      window.addEventListener('updateApprovalsChanged', h);
      return () => window.removeEventListener('updateApprovalsChanged', h);
    }
  }, [user]);

  useEffect(() => {
    if (location.pathname === '/admin/update-approvals') {
      setPendingCount(0);
      markNotificationsAsRead();
    }
  }, [location.pathname]);

  /* ── responsive ── */
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsOpen(false);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ── main content margin ── */
  useEffect(() => {
    const el = document.getElementById('main-content-wrapper');
    if (el) {
      el.style.marginLeft = isMobile ? '0' : (isOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED);
      el.style.transition  = 'margin-left 0.25s ease';
    }
  }, [isOpen, isMobile]);

  const fetchEmployeeName = async () => {
    try {
      if (user?.role === 'admin') { setEmployeeName('Administrator'); return; }
      const res = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user?.employeeId));
      if (res.data) {
        setEmployeeName(`${res.data.first_name || ''} ${res.data.last_name || ''}`.trim() || 'Employee');
        setEmployeeDesignation(res.data.designation || '');
      }
    } catch {
      setEmployeeName(user?.role === 'admin' ? 'Administrator' : 'Employee');
    }
  };

  const fetchPendingCount = async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.ADMIN_UPDATES_PENDING_COUNT);
      setPendingCount(res.data.count || 0);
    } catch { /* silent */ }
  };

  const markNotificationsAsRead = async () => {
    try { await axios.post(API_ENDPOINTS.ADMIN_UPDATES_MARK_READ); } catch { /* silent */ }
  };

  const closeSidebar = () => { if (isMobile) setIsOpen(false); };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  /* ── NavItem ── */
  const NavItem = ({ to, icon, label, badge, onClick, end = false }) => (
    <NavLink
      to={to}
      end={end}
      onClick={() => { if (onClick) onClick(); closeSidebar(); }}
      className={({ isActive }) => `hrms-nav-item${isActive ? ' active' : ''}`}
      title={!isOpen ? label : ''}
    >
      <span className="hrms-nav-item__icon">{icon}</span>
      {isOpen && (
        <>
          <span className="hrms-nav-item__label">{label}</span>
          {badge > 0 && (
            <Badge bg="danger" pill style={{ fontSize: '10px', padding: '2px 6px', flexShrink: 0 }}>
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
            position: 'absolute', top: '-2px', right: '-2px',
            fontSize: '9px', padding: '2px 5px', minWidth: '16px'
          }}
        >
          {badge}
        </Badge>
      )}
    </NavLink>
  );

  /* ── Section label ── */
  const Section = ({ label }) => (
    isOpen
      ? <div className="hrms-sidebar__section">{label}</div>
      : <div style={{ height: '18px' }} />
  );

  const sidebarWidth = isMobile
    ? (isOpen ? SIDEBAR_OPEN : '-280px')
    : (isOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED);

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', top: '12px', left: '16px', zIndex: 400,
            width: '38px', height: '38px', borderRadius: '8px',
            background: 'var(--primary)', color: 'white', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: 'var(--shadow-md)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.5h14M1 8h14M1 13.5h14" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      )}

      {/* Desktop hover zone — edge of closed sidebar */}
      {!isMobile && (
        <div
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          style={{
            position: 'fixed', top: 0,
            left: isOpen ? `calc(${SIDEBAR_OPEN} - 6px)` : `calc(${SIDEBAR_CLOSED} - 6px)`,
            width: '12px', height: '100vh',
            zIndex: 301, cursor: 'ew-resize',
            transition: 'left 0.25s ease'
          }}
        />
      )}

      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div className="hrms-overlay" onClick={closeSidebar} />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`hrms-sidebar${!isOpen ? ' hrms-sidebar--collapsed' : ''}`}
        style={{
          left: isMobile ? (isOpen ? '0' : '-280px') : '0',
          width: isMobile ? SIDEBAR_OPEN : (isOpen ? SIDEBAR_OPEN : SIDEBAR_CLOSED),
        }}
        onMouseEnter={() => { if (!isMobile) setIsOpen(true); }}
        onMouseLeave={() => { if (!isMobile) setIsOpen(false); }}
      >

        {/* ── Logo ── */}
        <div className="hrms-sidebar__logo">
          <div className="hrms-sidebar__logo-mark">E</div>
          {isOpen && (
            <div className="hrms-sidebar__logo-text">
              <div className="hrms-sidebar__logo-title">EMS Portal</div>
              <div className="hrms-sidebar__logo-sub">
                {user?.role === 'admin' ? 'Admin Dashboard' : user?.role === 'manager' ? 'Manager Dashboard' : 'Employee Dashboard'}
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="hrms-sidebar__nav">

          <Section label="Overview" />
          <NavItem to="/" end icon={<FaTachometerAlt />} label="Dashboard" />

          {user?.role === 'admin' ? (
            <>
              <Section label="Management" />
              <NavItem to="/admin/employees"         icon={<FaUsers />}       label="Employees" />
              <NavItem to="/admin/leave-requests"    icon={<FaCalendarAlt />} label="Leave Requests" />
              <NavItem to="/admin/attendance/reports" icon={<FaClock />}      label="Attendance" />
              <NavItem to="/admin/ratings"           icon={<FaStar />}        label="Employee Ratings" />

              <Section label="Admin Tools" />
              <NavItem to="/admin/teams"             icon={<FaLayerGroup />}  label="Teams" />
              <NavItem to="/admin/send-update-request" icon={<FaPaperPlane />} label="Send Update Request" />
              <NavItem
                to="/admin/update-approvals"
                icon={<FaBell />}
                label="Update Approvals"
                badge={pendingCount}
                onClick={() => { setPendingCount(0); markNotificationsAsRead(); }}
              />
              <NavItem to="/admin/broadcast" icon={<FaBullhorn />} label="Broadcast" />
            </>
          ) : user?.role === 'manager' ? (
            <>
              <Section label="My Space" />
              <NavItem to="/profile"     icon={<FaUserCircle />}  label="My Profile" />
              <NavItem to="/attendance" icon={<FaFingerprint />} label="Daily Attendance" />
              <NavItem to="/apply-leave" icon={<FaCalendarAlt />} label="Apply Leave" />
              <NavItem to="/salary-slip" icon={<FaMoneyBill />}   label="Salary Slip" />
              <Section label="Team" />
              {/* <NavItem to="/admin/teams" icon={<FaLayerGroup />} label="My Teams" /> */}
              <NavItem to="/manager/panel" icon={<FaUserTie />} label="Team Panel" />
            </>
          ) : (
            <>
              <Section label="My Space" />
              <NavItem to="/profile"                 icon={<FaUserCircle />}  label="My Profile" />
              <NavItem to="/attendance"              icon={<FaFingerprint />} label="Daily Attendance" />
              <NavItem to="/apply-leave"             icon={<FaCalendarAlt />} label="Apply Leave" />
              <NavItem to="/salary-slip"             icon={<FaMoneyBill />}   label="Salary Slip" />
              <NavItem to="/employee/update-requests" icon={<FaEdit />}       label="Update Requests" />
            </>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className="hrms-sidebar__footer">
          {isOpen ? (
            <div className="hrms-sidebar__user">
              <div className="hrms-sidebar__user-avatar">
                {getInitials(employeeName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="hrms-sidebar__user-name">{employeeName}</div>
                <div className="hrms-sidebar__user-role">
                  {user?.role === 'admin' ? 'Administrator' : user?.role === 'manager' ? 'Manager' : `ID: ${user?.employeeId}`}
                </div>
              </div>
              <button className="hrms-logout-btn" onClick={logout} title="Logout">
                <FaSignOutAlt size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              <div className="hrms-sidebar__user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                {getInitials(employeeName)}
              </div>
              <button className="hrms-logout-btn" onClick={logout} title="Logout">
                <FaSignOutAlt size={11} />
              </button>
            </div>
          )}
        </div>

      </aside>
    </>
  );
};

export default Sidebar;

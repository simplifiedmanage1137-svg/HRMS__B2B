// src/App.jsx
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './index.css';

// Layout & Auth — always needed, load eagerly
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import Login from './components/Auth/Login';
import Unauthorized from './components/Auth/Unauthorized';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import GlobalNotification from './components/Common/GlobalNotification';
import { Spinner } from 'react-bootstrap';

// Admin — lazy loaded (only fetched when the route is visited)
const AdminDashboard      = lazy(() => import('./components/Admin/Dashboard'));
const EmployeeList        = lazy(() => import('./components/Admin/EmployeeList'));
const AddEmployee         = lazy(() => import('./components/Admin/AddEmployee'));
const EditEmployee        = lazy(() => import('./components/Admin/EditEmployee'));
const LeaveRequests       = lazy(() => import('./components/Admin/LeaveRequests'));
const LeaveReports        = lazy(() => import('./components/Admin/LeaveReports'));
const AttendanceDashboard = lazy(() => import('./components/Admin/AttendanceDashboard'));
const AttendanceReports   = lazy(() => import('./components/Admin/AttendanceReports'));
const SendUpdateRequest   = lazy(() => import('./components/Admin/SendUpdateRequest'));
const UpdateApprovals     = lazy(() => import('./components/Admin/UpdateApprovals'));
const SendNotice          = lazy(() => import('./components/Admin/SendNotice'));
const Announcements       = lazy(() => import('./components/Admin/Announcements'));
const AdminBroadcast      = lazy(() => import('./components/Admin/AdminBroadcast'));
const EmployeeProfileView = lazy(() => import('./components/Admin/EmployeeProfileView'));
const AdminRatings        = lazy(() => import('./components/Admin/AdminRatings'));
const Teams               = lazy(() => import('./components/Admin/Teams'));
const PayrollAdjustment   = lazy(() => import('./components/Admin/PayrollAdjustment'));

// Manager — lazy loaded
const ManagerDashboard = lazy(() => import('./components/Manager/Dashboard'));

// Employee — lazy loaded
const EmployeeDashboard      = lazy(() => import('./components/Employee/Dashboard'));
const Profile                = lazy(() => import('./components/Employee/Profile'));
const ProfileEdit            = lazy(() => import('./components/Employee/ProfileEdit'));
const ApplyLeave             = lazy(() => import('./components/Employee/ApplyLeave'));
const SalarySlip             = lazy(() => import('./components/Employee/SalarySlip'));
const Attendance             = lazy(() => import('./components/Employee/Attendance'));
const EmployeeUpdateRequests = lazy(() => import('./components/Employee/EmployeeUpdateRequests'));
const EmployeeUpdateForm     = lazy(() => import('./components/Employee/EmployeeUpdateForm'));
const ManagerLeaveRequests   = lazy(() => import('./components/Employee/ManagerLeaveRequests'));
const ManagerShiftUpdate     = lazy(() => import('./components/Employee/ManagerShiftUpdate'));
const ManagerPanel           = lazy(() => import('./components/Employee/ManagerPanel'));

// Shared fallback shown while a lazy chunk is being fetched
const PageLoader = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'var(--body-bg, #f8f9fa)', zIndex: 9999
  }}>
    <Spinner animation="border" variant="primary" />
  </div>
);

// Private Route Component
const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        zIndex: 9999
      }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

// Main App Content
function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isUnauthorizedPage = location.pathname === '/unauthorized';

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        zIndex: 9999
      }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // If on login/unauthorized page, render without layout
  if (isLoginPage) return <Login />;
  if (isUnauthorizedPage) return <Unauthorized />;

  // For all other pages, render with sidebar and navbar
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar */}
      {user && <Sidebar />}

      {/* Main Content Area */}
      <div
        id="main-content-wrapper"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--body-bg)',
          transition: 'margin-left 0.25s ease'
        }}
      >
        {/* Navbar */}
        {user && <Navbar />}

        {/* Page Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px',
          backgroundColor: 'var(--body-bg)'
        }}>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Dashboard Route - Conditional based on role */}
            <Route path="/" element={
              <PrivateRoute allowedRoles={['admin', 'manager', 'employee', 'desktop_support']}>
                {user?.role === 'admin' || user?.role === 'desktop_support' ? <AdminDashboard /> : user?.role === 'manager' ? <ManagerDashboard /> : <EmployeeDashboard />}
              </PrivateRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={
              <PrivateRoute allowedRoles={['admin', 'desktop_support']}>
                <AdminDashboard />
              </PrivateRoute>
            } />

            {/* Manager Routes */}
            <Route path="/manager/dashboard" element={
              <PrivateRoute allowedRoles={['admin', 'manager']}>
                <ManagerDashboard />
              </PrivateRoute>
            } />

            <Route path="/admin/employees" element={
              <PrivateRoute allowedRoles={['admin', 'desktop_support']}>
                <EmployeeList />
              </PrivateRoute>
            } />

            <Route path="/admin/add-employee" element={
              <PrivateRoute allowedRoles={['admin', 'desktop_support']}>
                <AddEmployee />
              </PrivateRoute>
            } />

            <Route path="/admin/edit-employee/:id" element={
              <PrivateRoute allowedRoles={['admin', 'desktop_support']}>
                <EditEmployee />
              </PrivateRoute>
            } />

            <Route path="/admin/employees/:employeeId" element={
              <PrivateRoute allowedRoles={['admin']}>
                <EmployeeProfileView />
              </PrivateRoute>
            } />

            <Route path="/admin/leave-requests" element={
              <PrivateRoute allowedRoles={['admin']}>
                <LeaveRequests />
              </PrivateRoute>
            } />

            <Route path="/admin/leave-reports" element={
              <PrivateRoute allowedRoles={['admin']}>
                <LeaveReports />
              </PrivateRoute>
            } />

            {/* Admin Attendance Routes */}
            <Route path="/admin/attendance/dashboard" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AttendanceDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/admin/attendance/reports" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AttendanceReports />
              </PrivateRoute>
            } />

            {/* Admin Ratings Route */}
            <Route path="/admin/ratings" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminRatings />
              </PrivateRoute>
            } />

            {/* Payroll Adjustment */}
            <Route path="/admin/payroll" element={
              <PrivateRoute allowedRoles={['admin']}>
                <PayrollAdjustment />
              </PrivateRoute>
            } />

            <Route path="/admin/teams" element={
              <PrivateRoute allowedRoles={['admin', 'manager', 'desktop_support']}>
                <Teams />
              </PrivateRoute>
            } />

            {/* Admin Update Routes */}
            <Route path="/employee/update-info/:requestId" element={
              <PrivateRoute allowedRoles={['employee']}>
                <EmployeeUpdateForm />
              </PrivateRoute>
            } />

            <Route path="/admin/send-update-request" element={
              <PrivateRoute allowedRoles={['admin']}>
                <SendUpdateRequest />
              </PrivateRoute>
            } />

            <Route path="/admin/update-approvals" element={
              <PrivateRoute allowedRoles={['admin']}>
                <UpdateApprovals />
              </PrivateRoute>
            } />

            {/* BROADCAST CENTER - combined notice + announcements */}
            <Route path="/admin/broadcast" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminBroadcast />
              </PrivateRoute>
            } />
            
            {/* old routes redirect */}
            <Route path="/admin/announcements" element={<Navigate to="/admin/broadcast" replace />} />
            <Route path="/admin/send-notice" element={<Navigate to="/admin/broadcast" replace />} />

            {/* Employee Routes */}
            <Route path="/employee/dashboard" element={
              <PrivateRoute allowedRoles={['employee', 'manager', 'admin']}>
                <EmployeeDashboard />
              </PrivateRoute>
            } />

            <Route path="/profile" element={
              <PrivateRoute allowedRoles={['admin', 'manager', 'employee']}>
                <Profile />
              </PrivateRoute>
            } />

            <Route path="/profile/edit" element={
              <PrivateRoute allowedRoles={['employee', 'manager']}>
                <ProfileEdit />
              </PrivateRoute>
            } />

            <Route path="/employee/update-requests" element={
              <PrivateRoute allowedRoles={['employee', 'manager']}>
                <EmployeeUpdateRequests />
              </PrivateRoute>
            } />

            <Route path="/apply-leave" element={
              <PrivateRoute allowedRoles={['employee', 'manager']}>
                <ApplyLeave />
              </PrivateRoute>
            } />

            <Route path="/salary-slip" element={
              <PrivateRoute allowedRoles={['employee', 'manager']}>
                <SalarySlip />
              </PrivateRoute>
            } />

            <Route path="/attendance" element={
              <PrivateRoute allowedRoles={['employee', 'manager']}>
                <Attendance />
              </PrivateRoute>
            } />

            <Route path="/manager/panel" element={
              <PrivateRoute allowedRoles={['employee', 'manager', 'admin']}>
                <ManagerPanel />
              </PrivateRoute>
            } />

            {/* Keep old routes as redirects for backward compatibility */}
            <Route path="/manager/leave-requests" element={<Navigate to="/manager/panel" replace />} />
            <Route path="/manager/shift-update" element={<Navigate to="/manager/panel" replace />} />
            <Route path="/manager/send-notice" element={<Navigate to="/manager/panel" replace />} />

            {/* Redirect for any unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </div>
      </div>

      {/* Global Notification */}
      <GlobalNotification />
    </div>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <AppContent />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
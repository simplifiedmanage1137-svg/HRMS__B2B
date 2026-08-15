import React, { useState, useMemo } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';
import { FaSearch, FaTimes, FaUserTie, FaUsers, FaUserShield, FaUserFriends, FaExclamationTriangle } from 'react-icons/fa';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildName = (emp) => `${emp?.first_name || ''} ${emp?.middle_name || ''} ${emp?.last_name || ''}`.trim() || emp?.employee_id || 'Unknown';
const getInitials = (name) => (name || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

// Role → group mapping is NOT self-explanatory in this app: role='sub_admin' is displayed
// elsewhere (Sidebar.jsx) as "Manager", and role='manager' as "Team Leader (TL)". Matched
// here exactly so "All Managers"/"All Team Leaders" picks the population a user actually
// expects, not the literal role string that sounds right.
const GROUPS = [
  { key: 'managers',   label: 'All Managers',      icon: FaUserTie,     roles: ['sub_admin'] },
  { key: 'team_leads', label: 'All Team Leaders',   icon: FaUsers,       roles: ['manager'] },
  { key: 'hr',         label: 'All HR',             icon: FaUserShield,  roles: ['hr'] },
  { key: 'admins',     label: 'All Admins',         icon: FaUserShield,  roles: ['admin'] },
];

/**
 * Reusable recipient picker: group quick-select buttons + search + individual multi-select
 * + selected-recipient chips. Used by the Admin/HR Email section — `employees` should be the
 * full active-employee list (role/email/first_name/last_name at minimum).
 *
 * Controlled: `selectedIds` (Set of employee_id) + `onChange(nextSet)`.
 */
export default function RecipientSelector({ employees, selectedIds, onChange }) {
  const [search, setSearch] = useState('');

  const activeEmployees = useMemo(() => (employees || []).filter(e => e.is_active !== false), [employees]);

  const byId = useMemo(() => {
    const m = new Map();
    activeEmployees.forEach(e => m.set(e.employee_id, e));
    return m;
  }, [activeEmployees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter(e => {
      const name = buildName(e).toLowerCase();
      return name.includes(q) || e.employee_id?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
    });
  }, [activeEmployees, search]);

  const addIds = (ids) => {
    const next = new Set(selectedIds);
    ids.forEach(id => next.add(id));
    onChange(next);
  };

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  };

  const removeOne = (id) => {
    const next = new Set(selectedIds);
    next.delete(id);
    onChange(next);
  };

  const selectGroup = (roles) => {
    const ids = activeEmployees.filter(e => roles.includes(e.role) && e.email).map(e => e.employee_id);
    addIds(ids);
  };

  const selectAllVisible = () => addIds(filtered.filter(e => e.email).map(e => e.employee_id));
  const clearAll = () => onChange(new Set());

  const selectedList = useMemo(
    () => Array.from(selectedIds).map(id => byId.get(id)).filter(Boolean),
    [selectedIds, byId]
  );

  return (
    <div>
      {/* Search */}
      <div className="mb-2">
        <div className="position-relative">
          <FaSearch style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8', fontSize: 13 }} />
          <Form.Control
            size="sm"
            placeholder="Search employees by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
      </div>

      {/* Group quick-select */}
      <div className="d-flex flex-wrap gap-2 mb-2">
        {GROUPS.map(g => {
          const Icon = g.icon;
          const count = activeEmployees.filter(e => g.roles.includes(e.role)).length;
          return (
            <Button
              key={g.key}
              type="button"
              size="sm"
              variant="outline-primary"
              onClick={() => selectGroup(g.roles)}
              disabled={count === 0}
            >
              <Icon className="me-1" size={11} /> {g.label} ({count})
            </Button>
          );
        })}
        <Button type="button" size="sm" variant="outline-secondary" onClick={selectAllVisible} disabled={filtered.length === 0}>
          <FaUserFriends className="me-1" size={11} /> Select All Visible
        </Button>
        <Button type="button" size="sm" variant="outline-danger" onClick={clearAll} disabled={selectedIds.size === 0}>
          <FaTimes className="me-1" size={11} /> Clear All
        </Button>
      </div>

      {/* Individual employee list (search-filtered, checkbox multi-select) */}
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, padding: 8, background: '#f8fafc', marginBottom: 14 }}>
        {filtered.length === 0 ? (
          <div className="text-muted small p-2">No employees match your search.</div>
        ) : filtered.map(emp => {
          const name = buildName(emp);
          const hasValidEmail = emp.email && EMAIL_REGEX.test(emp.email);
          return (
            <label
              key={emp.employee_id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', cursor: hasValidEmail ? 'pointer' : 'not-allowed', opacity: hasValidEmail ? 1 : 0.55 }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(emp.employee_id)}
                disabled={!hasValidEmail}
                onChange={() => toggleOne(emp.employee_id)}
              />
              <span className="small fw-semibold">{name}</span>
              <span className="text-muted small">({emp.employee_id})</span>
              <span className="text-muted small">{emp.email || 'no email on file'}</span>
              {!hasValidEmail && <FaExclamationTriangle className="text-warning" size={11} title="No valid email — cannot be selected" />}
            </label>
          );
        })}
      </div>

      {/* Selected recipients */}
      <div>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="small fw-semibold text-muted">Selected recipients ({selectedList.length})</span>
        </div>
        {selectedList.length === 0 ? (
          <div className="text-muted small">No recipients selected yet.</div>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {selectedList.map(emp => (
              <Badge
                key={emp.employee_id}
                bg="light"
                text="dark"
                className="d-flex align-items-center gap-2 border"
                style={{ fontWeight: 500, padding: '6px 10px', fontSize: 12 }}
              >
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#1e3a5f', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                  {getInitials(buildName(emp))}
                </span>
                {buildName(emp)} — {emp.email}
                <FaTimes
                  style={{ cursor: 'pointer', color: '#94a3b8' }}
                  onClick={() => removeOne(emp.employee_id)}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

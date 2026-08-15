import React, { useState } from 'react';
import { Badge } from 'react-bootstrap';
import { FaTimes } from 'react-icons/fa';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Free-text multi-email chip input — type an address, press Enter/Comma/Tab (or blur) to
 * add it as a chip. Used for CC/BCC fields where recipients aren't necessarily existing
 * employees (see RecipientSelector for that case).
 *
 * Controlled: `value` (string[]) + `onChange(nextArray)`.
 */
export default function EmailTagInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const commit = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setError(`"${draft.trim()}" is not a valid email address`);
      return;
    }
    if (value.includes(email)) {
      setError('That address is already added');
      setDraft('');
      return;
    }
    onChange([...value, email]);
    setDraft('');
    setError('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (draft.trim()) {
        e.preventDefault();
        commit();
      }
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const remove = (email) => onChange(value.filter(v => v !== email));

  return (
    <div>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          border: '1px solid #ced4da', borderRadius: 6, padding: '6px 8px', minHeight: 38,
        }}
      >
        {value.map(email => (
          <Badge key={email} bg="light" text="dark" className="d-flex align-items-center gap-1 border" style={{ fontWeight: 500, fontSize: 12, padding: '4px 8px' }}>
            {email}
            <FaTimes style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => remove(email)} />
          </Badge>
        ))}
        <input
          type="email"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={value.length === 0 ? (placeholder || 'Type an email and press Enter') : ''}
          style={{ border: 'none', outline: 'none', flex: 1, minWidth: 140, fontSize: 13 }}
        />
      </div>
      {error && <div className="small text-danger mt-1">{error}</div>}
    </div>
  );
}

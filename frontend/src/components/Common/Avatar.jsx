// src/components/Common/Avatar.jsx
//
// Circular avatar used across attendance/leave tables — shows the employee's uploaded
// profile photo when available, falling back to a colored initials circle (same palette
// as before) if there's no photo or it fails to load.
import React, { useState } from 'react';
import { avatarColorFor, initialsFor } from './attendanceTheme';

const Avatar = ({ photo, id, firstName, lastName, size = 36, fontSize }) => {
  const [error, setError] = useState(false);
  const fs = fontSize || Math.round(size * 0.36);

  if (photo && !error) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: avatarColorFor(id || `${firstName || ''}${lastName || ''}`), color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: fs,
      }}
    >
      {initialsFor(firstName, lastName)}
    </div>
  );
};

export default Avatar;

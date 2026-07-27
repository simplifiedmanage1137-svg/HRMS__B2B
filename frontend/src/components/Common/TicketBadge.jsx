import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

// Clickable ticket-count badge for dashboard headers — navigates to /tickets.
export default function TicketBadge({ variant = 'dark' }) {
    const navigate = useNavigate();
    const [count, setCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const fetchCount = async () => {
            try {
                const res = await axios.get(API_ENDPOINTS.TICKET_COUNT);
                if (!cancelled && res.data?.success) setCount(res.data.total || 0);
            } catch {
                // silent — badge just shows 0 if the count can't be fetched
            }
        };
        fetchCount();
        const interval = setInterval(fetchCount, 60000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const isDark = variant === 'dark';

    return (
        <button
            onClick={() => navigate('/tickets')}
            title="Support Tickets"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 20,
                border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb',
                background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                color: isDark ? '#fff' : '#374151',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
            }}
        >
            <Ticket size={15} />
            Ticket's
            {count > 0 && (
                <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );
}

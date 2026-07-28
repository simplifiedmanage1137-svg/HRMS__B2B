/**
 * Wishes Routes — /api/wishes
 *
 * Supabase tables required (see backend/scripts/create-birthday-wishes-tables.sql):
 * birthday_wishes, wish_comments
 */

const express = require('express');
const router  = express.Router();

module.exports = (supabase, authenticateToken) => {

    const getEmployeeName = async (employeeId) => {
        const { data } = await supabase.from('employees')
            .select('first_name, last_name')
            .eq('employee_id', employeeId)
            .maybeSingle();
        return data ? `${data.first_name} ${data.last_name}`.trim() : employeeId;
    };

    const decorateWish = (wish, viewerId, commentCounts) => ({
        ...wish,
        like_count: (wish.liked_by || []).length,
        liked_by_me: (wish.liked_by || []).includes(viewerId),
        comment_count: commentCounts[wish.id] || 0,
    });

    // ── GET /api/wishes ─────────────────────────────────────────────────────
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const { recipient_employee_id, event_date, event_type } = req.query;
            if (!recipient_employee_id || !event_date) {
                return res.status(400).json({ success: false, message: 'recipient_employee_id and event_date are required' });
            }

            let query = supabase.from('birthday_wishes')
                .select('*')
                .eq('recipient_employee_id', recipient_employee_id)
                .eq('event_date', event_date)
                .order('created_at', { ascending: true });
            if (event_type) query = query.eq('event_type', event_type);

            const { data: wishes, error } = await query;
            if (error) throw error;

            const wishIds = (wishes || []).map(w => w.id);
            let commentCounts = {};
            if (wishIds.length > 0) {
                const { data: comments } = await supabase.from('wish_comments')
                    .select('wish_id')
                    .in('wish_id', wishIds);
                commentCounts = (comments || []).reduce((acc, c) => {
                    acc[c.wish_id] = (acc[c.wish_id] || 0) + 1;
                    return acc;
                }, {});
            }

            const decorated = (wishes || []).map(w => decorateWish(w, req.user.employeeId, commentCounts));
            return res.json({ success: true, wishes: decorated });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/wishes ────────────────────────────────────────────────────
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { recipient_employee_id, recipient_name, event_type, message } = req.body;

            if (!recipient_employee_id || !recipient_name || !message?.trim()) {
                return res.status(400).json({ success: false, message: 'recipient_employee_id, recipient_name and message are required' });
            }

            const senderName = await getEmployeeName(employeeId);
            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase.from('birthday_wishes').insert({
                recipient_employee_id,
                recipient_name,
                sender_employee_id: employeeId,
                sender_name: senderName,
                event_type: event_type || 'birthday',
                event_date: today,
                message: message.trim(),
                liked_by: [],
            }).select().maybeSingle();

            if (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ success: false, message: "You've already wished them today 🎉" });
                }
                throw error;
            }

            // Notify the recipient — best-effort, never blocks the wish itself.
            try {
                const eventLabel = (event_type || 'birthday') === 'anniversary' ? 'work anniversary' : 'birthday';
                await supabase.from('notifications').insert({
                    employee_id: recipient_employee_id,
                    type: 'wish_received',
                    title: eventLabel === 'anniversary' ? '🏆 New Work Anniversary Wish' : '🎂 New Birthday Wish',
                    message: `${senderName} wished you a happy ${eventLabel}: "${message.trim().slice(0, 80)}"`,
                    is_read: false,
                });
            } catch (notifyErr) {
                console.error('[wishes] recipient notification failed:', notifyErr);
            }

            return res.json({ success: true, wish: decorateWish(data, employeeId, {}) });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/wishes/:id/like ──────────────────────────────────────────
    router.patch('/:id/like', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { data: wish, error } = await supabase.from('birthday_wishes')
                .select('id, liked_by').eq('id', req.params.id).maybeSingle();
            if (error) throw error;
            if (!wish) return res.status(404).json({ success: false, message: 'Wish not found' });

            const likedBy = wish.liked_by || [];
            const alreadyLiked = likedBy.includes(employeeId);
            const newLikedBy = alreadyLiked
                ? likedBy.filter(id => id !== employeeId)
                : [...likedBy, employeeId];

            const { error: updateErr } = await supabase.from('birthday_wishes')
                .update({ liked_by: newLikedBy }).eq('id', req.params.id);
            if (updateErr) throw updateErr;

            return res.json({ success: true, liked: !alreadyLiked, like_count: newLikedBy.length });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET /api/wishes/:id/comments ────────────────────────────────────────
    router.get('/:id/comments', authenticateToken, async (req, res) => {
        try {
            const { data, error } = await supabase.from('wish_comments')
                .select('*').eq('wish_id', req.params.id).order('created_at', { ascending: true });
            if (error) throw error;
            return res.json({ success: true, comments: data || [] });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/wishes/:id/comments ───────────────────────────────────────
    router.post('/:id/comments', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { comment } = req.body;
            if (!comment?.trim()) return res.status(400).json({ success: false, message: 'Comment is required' });

            const { data: wish } = await supabase.from('birthday_wishes')
                .select('id').eq('id', req.params.id).maybeSingle();
            if (!wish) return res.status(404).json({ success: false, message: 'Wish not found' });

            const commenterName = await getEmployeeName(employeeId);

            const { data, error } = await supabase.from('wish_comments').insert({
                wish_id: req.params.id,
                commenter_employee_id: employeeId,
                commenter_name: commenterName,
                comment: comment.trim(),
            }).select().maybeSingle();
            if (error) throw error;

            return res.json({ success: true, comment: data });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    console.log('✅ Wishes routes loaded');
    return router;
};

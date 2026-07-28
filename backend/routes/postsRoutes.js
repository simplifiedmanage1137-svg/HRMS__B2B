/**
 * Dashboard Posts Routes — /api/posts
 * Lightweight Post / Poll / Praise feed for the dashboard composer.
 *
 * Supabase tables required (see backend/scripts/create-dashboard-posts-tables.sql):
 * dashboard_posts, post_comments
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

    const decoratePost = (post, viewerId, commentCounts) => ({
        ...post,
        like_count: (post.liked_by || []).length,
        liked_by_me: (post.liked_by || []).includes(viewerId),
        comment_count: commentCounts[post.id] || 0,
    });

    // ── GET /api/posts — latest 20 ──────────────────────────────────────────
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const { data: posts, error } = await supabase.from('dashboard_posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;

            const postIds = (posts || []).map(p => p.id);
            let commentCounts = {};
            if (postIds.length > 0) {
                const { data: comments } = await supabase.from('post_comments')
                    .select('post_id')
                    .in('post_id', postIds);
                commentCounts = (comments || []).reduce((acc, c) => {
                    acc[c.post_id] = (acc[c.post_id] || 0) + 1;
                    return acc;
                }, {});
            }

            const decorated = (posts || []).map(p => decoratePost(p, req.user.employeeId, commentCounts));
            return res.json({ success: true, posts: decorated });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/posts ──────────────────────────────────────────────────────
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { post_type, content, poll_options, praised_employee_id, praised_employee_name, mentioned_employees } = req.body;

            if (!content?.trim()) {
                return res.status(400).json({ success: false, message: 'Content is required' });
            }
            const type = ['post', 'poll', 'praise'].includes(post_type) ? post_type : 'post';
            if (type === 'praise' && !praised_employee_name?.trim()) {
                return res.status(400).json({ success: false, message: 'Please specify who you are praising' });
            }

            const authorName = await getEmployeeName(employeeId);

            const { data, error } = await supabase.from('dashboard_posts').insert({
                employee_id: employeeId,
                author_name: authorName,
                post_type: type,
                content: content.trim(),
                poll_options: type === 'poll' ? (poll_options || []).filter(o => o?.trim()) : [],
                praised_employee_id: type === 'praise' ? (praised_employee_id || null) : null,
                praised_employee_name: type === 'praise' ? (praised_employee_name || null) : null,
                mentioned_employees: mentioned_employees || [],
                liked_by: [],
            }).select().maybeSingle();

            if (error) throw error;

            return res.json({ success: true, post: decoratePost(data, employeeId, {}) });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/posts/:id/like ────────────────────────────────────────────
    router.patch('/:id/like', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { data: post, error } = await supabase.from('dashboard_posts')
                .select('id, liked_by').eq('id', req.params.id).maybeSingle();
            if (error) throw error;
            if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

            const likedBy = post.liked_by || [];
            const alreadyLiked = likedBy.includes(employeeId);
            const newLikedBy = alreadyLiked
                ? likedBy.filter(id => id !== employeeId)
                : [...likedBy, employeeId];

            const { error: updateErr } = await supabase.from('dashboard_posts')
                .update({ liked_by: newLikedBy }).eq('id', req.params.id);
            if (updateErr) throw updateErr;

            return res.json({ success: true, liked: !alreadyLiked, like_count: newLikedBy.length });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET /api/posts/:id/comments ─────────────────────────────────────────
    router.get('/:id/comments', authenticateToken, async (req, res) => {
        try {
            const { data, error } = await supabase.from('post_comments')
                .select('*').eq('post_id', req.params.id).order('created_at', { ascending: true });
            if (error) throw error;
            return res.json({ success: true, comments: data || [] });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/posts/:id/comments ────────────────────────────────────────
    router.post('/:id/comments', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { comment } = req.body;
            if (!comment?.trim()) return res.status(400).json({ success: false, message: 'Comment is required' });

            const { data: post } = await supabase.from('dashboard_posts')
                .select('id').eq('id', req.params.id).maybeSingle();
            if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

            const commenterName = await getEmployeeName(employeeId);

            const { data, error } = await supabase.from('post_comments').insert({
                post_id: req.params.id,
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

    console.log('✅ Posts routes loaded');
    return router;
};

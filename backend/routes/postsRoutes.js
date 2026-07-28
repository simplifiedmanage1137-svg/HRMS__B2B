/**
 * Dashboard Posts Routes — /api/posts
 * Social feed for the dashboard "All Posts" drawer: posts/polls/appreciation,
 * multi-image galleries, 3-type reactions (like/love/clap), threaded comments,
 * a lightweight follow system, and auto-generated "updated profile photo" posts.
 *
 * Supabase tables required:
 * dashboard_posts, post_comments (create-dashboard-posts-tables.sql)
 * post_follows, dashboard_posts.media_urls/category (add-social-feed-features.sql)
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const { uploadFile } = require('../lib/supabaseStorage');

const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpe?g|png|gif|webp)$/i.test(path.extname(file.originalname));
        cb(null, allowed);
    },
});

const REACTION_TYPES = ['like', 'love', 'clap'];

module.exports = (supabase, authenticateToken) => {

    const getEmployeeName = async (employeeId) => {
        const { data } = await supabase.from('employees')
            .select('first_name, last_name')
            .eq('employee_id', employeeId)
            .maybeSingle();
        return data ? `${data.first_name} ${data.last_name}`.trim() : employeeId;
    };

    // Old rows stored `liked_by` as plain employee_id strings (before reactions had
    // types) — normalize those to a 'like' reaction so old data still renders.
    const normalizeReaction = (entry) =>
        typeof entry === 'string' ? { employee_id: entry, name: null, type: 'like' } : entry;

    const decoratePost = (post, viewerId, commentCounts, firstComments) => {
        const reactions = (post.liked_by || []).map(normalizeReaction);
        const mine = reactions.find(r => r.employee_id === viewerId);
        const reactionCounts = reactions.reduce((acc, r) => {
            acc[r.type] = (acc[r.type] || 0) + 1;
            return acc;
        }, {});
        return {
            ...post,
            reactions,
            reaction_counts: reactionCounts,
            like_count: reactions.length,
            my_reaction: mine ? mine.type : null,
            liked_by_me: !!mine,
            comment_count: (commentCounts && commentCounts[post.id]) || 0,
            first_comment: (firstComments && firstComments[post.id]) || null,
        };
    };

    // ── POST /api/posts/upload-image — returns a public URL for one photo ────
    // Frontend calls this once per selected file to build a multi-image gallery.
    router.post('/upload-image', authenticateToken, (req, res) => {
        uploadImage.single('file')(req, res, async (err) => {
            if (err) {
                const msg = err.code === 'LIMIT_FILE_SIZE'
                    ? 'Image exceeds the 5 MB limit.'
                    : (err.message || 'Upload error');
                return res.status(400).json({ success: false, message: msg });
            }
            try {
                if (!req.file) return res.status(400).json({ success: false, message: 'No file received' });
                const { publicUrl } = await uploadFile(req.file.buffer, req.file.originalname, 'posts', req.file.mimetype);
                return res.json({ success: true, url: publicUrl });
            } catch (uploadErr) {
                return res.status(500).json({ success: false, message: uploadErr.message });
            }
        });
    });

    // ── GET /api/posts/following — employee_ids the caller follows ───────────
    router.get('/following', authenticateToken, async (req, res) => {
        try {
            const { data, error } = await supabase.from('post_follows')
                .select('followed_employee_id')
                .eq('follower_employee_id', req.user.employeeId);
            if (error) throw error;
            return res.json({ success: true, following: (data || []).map(f => f.followed_employee_id) });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/posts/follow/:employeeId — toggle follow ────────────────────
    router.post('/follow/:employeeId', authenticateToken, async (req, res) => {
        try {
            const follower = req.user.employeeId;
            const followed = req.params.employeeId;
            if (follower === followed) return res.status(400).json({ success: false, message: "You can't follow yourself" });

            const { data: existing } = await supabase.from('post_follows')
                .select('id').eq('follower_employee_id', follower).eq('followed_employee_id', followed).maybeSingle();

            if (existing) {
                await supabase.from('post_follows').delete().eq('id', existing.id);
                return res.json({ success: true, following: false });
            }
            await supabase.from('post_follows').insert({ follower_employee_id: follower, followed_employee_id: followed });
            return res.json({ success: true, following: true });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET /api/posts — latest 50, newest first ──────────────────────────────
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const { data: posts, error } = await supabase.from('dashboard_posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;

            const postIds = (posts || []).map(p => p.id);
            let commentCounts = {};
            let firstComments = {};
            if (postIds.length > 0) {
                const { data: comments } = await supabase.from('post_comments')
                    .select('*')
                    .in('post_id', postIds)
                    .order('created_at', { ascending: true });
                (comments || []).forEach(c => {
                    commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
                    if (!c.parent_comment_id && !firstComments[c.post_id]) firstComments[c.post_id] = c;
                });
            }

            const decorated = (posts || []).map(p => decoratePost(p, req.user.employeeId, commentCounts, firstComments));
            return res.json({ success: true, posts: decorated });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/posts ────────────────────────────────────────────────────────
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const {
                post_type, content, poll_options, praised_employee_id, praised_employee_name,
                mentioned_employees, image_url, media_urls, category,
            } = req.body;

            const hasMedia = image_url || (media_urls && media_urls.length > 0);
            if (!content?.trim() && !hasMedia) {
                return res.status(400).json({ success: false, message: 'Content or a photo is required' });
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
                content: (content || '').trim(),
                image_url: image_url || (media_urls && media_urls[0]) || null,
                media_urls: media_urls || [],
                category: category || null,
                poll_options: type === 'poll' ? (poll_options || []).filter(o => o?.trim()) : [],
                praised_employee_id: type === 'praise' ? (praised_employee_id || null) : null,
                praised_employee_name: type === 'praise' ? (praised_employee_name || null) : null,
                mentioned_employees: mentioned_employees || [],
                liked_by: [],
            }).select().maybeSingle();

            if (error) throw error;

            // Notify anyone tagged in the post — best-effort, never blocks the post itself.
            if ((mentioned_employees || []).length > 0) {
                try {
                    const rows = mentioned_employees
                        .filter(m => (m.employee_id || m) !== employeeId)
                        .map(m => ({
                            employee_id: m.employee_id || m,
                            type: 'post_mention',
                            title: 'You were tagged in a post',
                            message: `${authorName} tagged you in a post: "${(content || '').trim().slice(0, 80)}"`,
                            is_read: false,
                        }));
                    if (rows.length > 0) await supabase.from('notifications').insert(rows);
                } catch (notifyErr) {
                    console.error('[posts] mention notification failed:', notifyErr);
                }
            }

            return res.json({ success: true, post: decoratePost(data, employeeId, {}, {}) });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── DELETE /api/posts/:id — author, or admin/sub_admin/hr ─────────────────
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            const { data: post } = await supabase.from('dashboard_posts')
                .select('id, employee_id').eq('id', req.params.id).maybeSingle();
            if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

            const canDelete = post.employee_id === employeeId || ['admin', 'sub_admin', 'hr'].includes(role);
            if (!canDelete) return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });

            const { error } = await supabase.from('dashboard_posts').delete().eq('id', req.params.id);
            if (error) throw error;
            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/posts/:id/like — legacy plain-heart toggle (kept for compat) ─
    router.patch('/:id/like', authenticateToken, async (req, res) => {
        req.body = { type: 'like' };
        return reactHandler(req, res);
    });

    // ── POST /api/posts/:id/react — { type: 'like'|'love'|'clap' } ────────────
    router.post('/:id/react', authenticateToken, (req, res) => reactHandler(req, res));

    async function reactHandler(req, res) {
        try {
            const { employeeId } = req.user;
            const type = REACTION_TYPES.includes(req.body.type) ? req.body.type : 'like';

            const { data: post, error } = await supabase.from('dashboard_posts')
                .select('id, liked_by').eq('id', req.params.id).maybeSingle();
            if (error) throw error;
            if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

            const reactions = (post.liked_by || []).map(normalizeReaction);
            const idx = reactions.findIndex(r => r.employee_id === employeeId);
            let myReaction = type;
            let newReactions;

            if (idx >= 0 && reactions[idx].type === type) {
                newReactions = reactions.filter((_, i) => i !== idx);
                myReaction = null;
            } else if (idx >= 0) {
                const name = await getEmployeeName(employeeId);
                newReactions = reactions.map((r, i) => i === idx ? { employee_id: employeeId, name, type } : r);
            } else {
                const name = await getEmployeeName(employeeId);
                newReactions = [...reactions, { employee_id: employeeId, name, type }];
            }

            const { error: updateErr } = await supabase.from('dashboard_posts')
                .update({ liked_by: newReactions }).eq('id', req.params.id);
            if (updateErr) throw updateErr;

            const reactionCounts = newReactions.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
            return res.json({ success: true, my_reaction: myReaction, like_count: newReactions.length, reactions: newReactions, reaction_counts: reactionCounts });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

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

    // ── POST /api/posts/:id/comments — optional parent_comment_id for replies ─
    router.post('/:id/comments', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { comment, parent_comment_id } = req.body;
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
                parent_comment_id: parent_comment_id || null,
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

/**
 * Dashboard Posts Routes — /api/posts
 * Social feed for the dashboard "All Posts" drawer: posts/polls/appreciation,
 * multi-image galleries, 3-type reactions (like/love/clap), threaded comments,
 * a lightweight follow system, and auto-generated "updated profile photo" posts.
 *
 * Supabase tables required:
 * dashboard_posts, post_comments (create-dashboard-posts-tables.sql)
 * post_follows, dashboard_posts.media_urls/category (add-social-feed-features.sql)
 *
 * Poll voting — additive columns on dashboard_posts (run once in Supabase SQL editor):
 * ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS poll_votes JSONB DEFAULT '[]';
 * ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS poll_status TEXT DEFAULT 'active';
 * ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS poll_settings JSONB
 *   DEFAULT '{"allowVoteChange": true, "showResultsBeforeVoting": false, "showVoterNames": false}';
 * -- poll_votes: [{ employee_id, name, option_index, voted_at }], one entry per employee per poll
 * -- (deduped in application code the same way `liked_by` reactions already are — see reactHandler
 * -- below — rather than a separate normalized votes table, to match this file's existing
 * -- JSONB-array-on-post convention for post-scoped social data).
 * -- Existing polls created before this migration have no poll_votes/poll_status/poll_settings —
 * -- code below always falls back to [] / 'active' / DEFAULT_POLL_SETTINGS so they keep rendering,
 * -- just with zero votes until someone votes.
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

// Same "who can see everything" set used for post deletion (line ~216) and mirrored client-side
// in PostsDrawer.jsx — reused here so poll-voter-visibility follows the one convention already
// established in this file, rather than inventing a second role list.
const ROLES_SEE_POLL_VOTERS = ['admin', 'sub_admin', 'hr'];

const DEFAULT_POLL_SETTINGS = { allowVoteChange: true, showResultsBeforeVoting: false, showVoterNames: false };

module.exports = (supabase, authenticateToken) => {

    const getEmployeeName = async (employeeId) => {
        const { data } = await supabase.from('employees')
            .select('first_name, last_name')
            .eq('employee_id', employeeId)
            .maybeSingle();
        return data ? `${data.first_name} ${data.last_name}`.trim() : employeeId;
    };

    // Current profile photo for a single author — fetched fresh (not stored on the post row)
    // so a post always shows the author's latest photo, same as the poll-voter enrichment does.
    const getEmployeePhoto = async (employeeId) => {
        const { data } = await supabase.from('employees')
            .select('profile_image').eq('employee_id', employeeId).maybeSingle();
        return data?.profile_image || null;
    };

    // Builds the `poll` object attached to every post_type='poll' post. Raw `poll_votes` (which
    // contains every voter's employee_id/name) is intentionally never sent to the client as-is —
    // callers of decoratePost() below strip it after this runs. Percentages/counts are always
    // computed here, server-side, from the actual vote records — the frontend never receives or
    // trusts a client-sent percentage.
    const decoratePoll = (post, viewerId, viewerRole) => {
        if (post.post_type !== 'poll') return undefined;
        const options  = post.poll_options || [];
        const votes    = post.poll_votes || [];
        const settings = { ...DEFAULT_POLL_SETTINGS, ...(post.poll_settings || {}) };
        const status   = post.poll_status || 'active';

        const myVote = votes.find(v => v.employee_id === viewerId);
        const total  = votes.length;

        const canManage = post.employee_id === viewerId || ROLES_SEE_POLL_VOTERS.includes(viewerRole);
        const resultsVisible = settings.showResultsBeforeVoting || !!myVote || canManage || status === 'closed';

        const optionStats = options.map((text, index) => {
            const count = votes.filter(v => v.option_index === index).length;
            return {
                index,
                text,
                count:      resultsVisible ? count : null,
                percentage: resultsVisible ? (total > 0 ? Math.round((count / total) * 100) : 0) : null,
            };
        });

        return {
            status,
            settings,
            total_votes:     total,
            my_vote:         myVote ? myVote.option_index : null,
            results_visible: resultsVisible,
            options:         optionStats,
            can_manage:      canManage,
            can_view_voters: canManage || settings.showVoterNames === true,
        };
    };

    // Old rows stored `liked_by` as plain employee_id strings (before reactions had
    // types) — normalize those to a 'like' reaction so old data still renders.
    const normalizeReaction = (entry) =>
        typeof entry === 'string' ? { employee_id: entry, name: null, type: 'like' } : entry;

    const decoratePost = (post, viewerId, commentCounts, firstComments, viewerRole) => {
        const reactions = (post.liked_by || []).map(normalizeReaction);
        const mine = reactions.find(r => r.employee_id === viewerId);
        const reactionCounts = reactions.reduce((acc, r) => {
            acc[r.type] = (acc[r.type] || 0) + 1;
            return acc;
        }, {});
        const poll = decoratePoll(post, viewerId, viewerRole);
        // eslint-disable-next-line no-unused-vars
        const { poll_votes, ...postWithoutRawVotes } = post; // never ship the raw voter list
        return {
            ...postWithoutRawVotes,
            reactions,
            reaction_counts: reactionCounts,
            like_count: reactions.length,
            my_reaction: mine ? mine.type : null,
            liked_by_me: !!mine,
            comment_count: (commentCounts && commentCounts[post.id]) || 0,
            first_comment: (firstComments && firstComments[post.id]) || null,
            poll,
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

            // Batch-fetch current profile photos for every author in this page of posts (one
            // query, not N) so the feed shows real photos instead of always falling back to
            // initials — the post row itself never stores a photo, it can go stale otherwise.
            const authorIds = [...new Set((posts || []).map(p => p.employee_id).filter(Boolean))];
            let photoMap = {};
            if (authorIds.length > 0) {
                const { data: authors } = await supabase.from('employees')
                    .select('employee_id, profile_image').in('employee_id', authorIds);
                photoMap = (authors || []).reduce((acc, e) => { acc[e.employee_id] = e.profile_image; return acc; }, {});
            }

            const decorated = (posts || []).map(p =>
                decoratePost({ ...p, author_photo: photoMap[p.employee_id] || null }, req.user.employeeId, commentCounts, firstComments, req.user.role)
            );
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
                post_type, content, poll_options, poll_settings, praised_employee_id, praised_employee_name,
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

            // Only the three recognized settings, coerced to booleans — never trust arbitrary
            // request-body keys straight into a JSONB column.
            const settings = {
                allowVoteChange:         poll_settings?.allowVoteChange         !== false, // default true
                showResultsBeforeVoting: poll_settings?.showResultsBeforeVoting === true, // default false
                showVoterNames:          poll_settings?.showVoterNames          === true, // default false
            };

            const basePayload = {
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
            };
            const pollPayload = type === 'poll' ? { poll_votes: [], poll_status: 'active', poll_settings: settings } : {};

            let { data, error } = await supabase.from('dashboard_posts')
                .insert({ ...basePayload, ...pollPayload }).select().maybeSingle();
            if (error && /poll_votes|poll_status|poll_settings|does not exist/i.test(error.message || '')) {
                // Poll-voting columns not migrated on this DB yet — post still gets created (with
                // its plain poll_options list, same as before this feature existed), just without
                // voting support until the ALTER TABLE above is run.
                ({ data, error } = await supabase.from('dashboard_posts').insert(basePayload).select().maybeSingle());
            }
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

            const authorPhoto = await getEmployeePhoto(employeeId);
            return res.json({ success: true, post: decoratePost({ ...data, author_photo: authorPhoto }, employeeId, {}, {}, req.user.role) });
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

    // ── POST /api/posts/:id/vote — cast or (if allowed) change a poll vote ────
    // Body: { option_index }. Backend is the source of truth for everything: which options
    // exist, whether the poll is still open, whether this employee already voted, and whether
    // vote-changing is allowed — never trust a percentage or vote count sent from the client.
    router.post('/:id/vote', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            const optionIndex = Number(req.body.option_index);

            const { data: post, error } = await supabase.from('dashboard_posts')
                .select('*').eq('id', req.params.id).maybeSingle();
            if (error) throw error;
            if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
            if (post.post_type !== 'poll') return res.status(400).json({ success: false, message: 'This post is not a poll' });

            const options = post.poll_options || [];
            if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
                return res.status(400).json({ success: false, message: 'Invalid poll option' });
            }

            const status = post.poll_status || 'active';
            if (status === 'closed') {
                return res.status(403).json({ success: false, message: 'This poll is closed. Voting is no longer allowed.' });
            }

            const settings = { ...DEFAULT_POLL_SETTINGS, ...(post.poll_settings || {}) };
            const votes = post.poll_votes || [];
            const existingIdx = votes.findIndex(v => v.employee_id === employeeId);

            if (existingIdx >= 0 && votes[existingIdx].option_index === optionIndex) {
                // Clicking the option they already voted for — idempotent no-op, not an error.
                return res.json({ success: true, poll: decoratePoll(post, employeeId, role) });
            }
            if (existingIdx >= 0 && !settings.allowVoteChange) {
                return res.status(403).json({ success: false, message: 'You have already voted in this poll.' });
            }

            const name = await getEmployeeName(employeeId);
            const voteEntry = { employee_id: employeeId, name, option_index: optionIndex, voted_at: new Date().toISOString() };
            const newVotes = existingIdx >= 0
                ? votes.map((v, i) => i === existingIdx ? voteEntry : v)
                : [...votes, voteEntry];

            const { error: updateErr } = await supabase.from('dashboard_posts')
                .update({ poll_votes: newVotes }).eq('id', req.params.id);
            if (updateErr) {
                if (/poll_votes|does not exist/i.test(updateErr.message || '')) {
                    return res.status(500).json({ success: false, message: 'Poll voting is not set up on this server yet. Please contact your administrator.' });
                }
                throw updateErr;
            }

            return res.json({ success: true, poll: decoratePoll({ ...post, poll_votes: newVotes }, employeeId, role) });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET /api/posts/:id/poll-voters — results + (permission-gated) voter list ──
    // Aggregate results respect the same `results_visible` rule as the feed card. The individual
    // voter list is additionally gated: only the poll creator, admin/sub_admin/hr, or (if the
    // poll creator opted in) any employee via `showVoterNames` may see who voted for what — this
    // is enforced here, server-side, not just by hiding the "View Details" button in the UI.
    router.get('/:id/poll-voters', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            const { data: post, error } = await supabase.from('dashboard_posts')
                .select('*').eq('id', req.params.id).maybeSingle();
            if (error) throw error;
            if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
            if (post.post_type !== 'poll') return res.status(400).json({ success: false, message: 'This post is not a poll' });

            const poll = decoratePoll(post, employeeId, role);
            const votersRestricted = !poll.can_view_voters;

            const response = {
                success: true,
                poll: {
                    question: post.content,
                    status: poll.status,
                    settings: poll.settings,
                    created_by: post.author_name,
                    created_at: post.created_at,
                    total_votes: poll.total_votes,
                    results_visible: poll.results_visible,
                    options: poll.options,
                },
                voters: null,
                voters_restricted: votersRestricted,
                participation: null,
            };

            if (votersRestricted) return res.json(response);

            const votes = post.poll_votes || [];
            const employeeIds = [...new Set(votes.map(v => v.employee_id))];

            let empMap = {};
            if (employeeIds.length > 0) {
                const { data: emps } = await supabase.from('employees')
                    .select('employee_id, first_name, last_name, department, designation, profile_image')
                    .in('employee_id', employeeIds);
                empMap = (emps || []).reduce((acc, e) => { acc[e.employee_id] = e; return acc; }, {});
            }

            const { count: eligible } = await supabase.from('employees')
                .select('employee_id', { count: 'exact', head: true }).eq('is_active', true);

            let voters = votes.map(v => {
                const emp = empMap[v.employee_id];
                return {
                    employee_id:   v.employee_id,
                    name:          emp ? `${emp.first_name} ${emp.last_name}`.trim() : v.name,
                    department:    emp?.department || null,
                    designation:   emp?.designation || null,
                    profile_image: emp?.profile_image || null,
                    option_index:  v.option_index,
                    option_text:   (post.poll_options || [])[v.option_index] || null,
                    voted_at:      v.voted_at,
                };
            });

            const { option, search, department } = req.query;
            if (option !== undefined && option !== '' && option !== 'all') {
                const idx = Number(option);
                voters = voters.filter(v => v.option_index === idx);
            }
            if (search?.trim()) {
                const q = search.trim().toLowerCase();
                voters = voters.filter(v => v.name?.toLowerCase().includes(q));
            }
            if (department && department !== 'all') {
                voters = voters.filter(v => v.department === department);
            }
            voters.sort((a, b) => new Date(b.voted_at) - new Date(a.voted_at));

            response.voters = voters;
            response.participation = {
                votes: poll.total_votes,
                eligible: eligible || 0,
                percentage: eligible ? Math.round((poll.total_votes / eligible) * 100) : 0,
            };
            return res.json(response);
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/posts/:id/poll-status — creator or admin/sub_admin/hr open/close a poll ──
    router.patch('/:id/poll-status', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            const status = req.body.status;
            if (!['active', 'closed'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Status must be "active" or "closed"' });
            }

            const { data: post, error } = await supabase.from('dashboard_posts')
                .select('*').eq('id', req.params.id).maybeSingle();
            if (error) throw error;
            if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
            if (post.post_type !== 'poll') return res.status(400).json({ success: false, message: 'This post is not a poll' });

            const canManage = post.employee_id === employeeId || ROLES_SEE_POLL_VOTERS.includes(role);
            if (!canManage) return res.status(403).json({ success: false, message: 'Not authorized to manage this poll' });

            const { error: updateErr } = await supabase.from('dashboard_posts')
                .update({ poll_status: status }).eq('id', req.params.id);
            if (updateErr) {
                if (/poll_status|does not exist/i.test(updateErr.message || '')) {
                    return res.status(500).json({ success: false, message: 'Poll status is not set up on this server yet. Please contact your administrator.' });
                }
                throw updateErr;
            }

            return res.json({ success: true, poll: decoratePoll({ ...post, poll_status: status }, employeeId, role) });
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

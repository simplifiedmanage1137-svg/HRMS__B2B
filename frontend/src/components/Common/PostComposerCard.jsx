import React, { useState, useEffect } from 'react';
import { FaEdit, FaChartBar, FaAward, FaBullhorn, FaHeart, FaRegHeart, FaCommentDots, FaTimes } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import Avatar from './Avatar';
import { QA, QA_CARD_STYLE } from './quickAccessTheme';

const TABS = [
  { key: 'post', label: 'Post', icon: FaEdit },
  { key: 'poll', label: 'Poll', icon: FaChartBar },
  { key: 'praise', label: 'Praise', icon: FaAward },
  { key: 'announcements', label: 'Announcements', icon: FaBullhorn },
];

const ANNOUNCEMENT_ICON = { announcement: '📢', notice: '📌', warning: '⚠️', holiday: '🎉', policy: '📋', event: '🎊', urgent: '🚨' };

function AnnouncementsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get(API_ENDPOINTS.ANNOUNCEMENTS)
      .then(res => { if (!cancelled) setItems(res.data?.announcements || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ fontSize: 12, color: QA.textMuted }}>Loading announcements…</div>;
  if (items.length === 0) return <div style={{ fontSize: 12, color: QA.textMuted }}>No announcements yet</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
      {items.map(a => (
        <div key={a.id} style={{ padding: '10px 12px', borderRadius: 10, background: '#f9fafb', border: `1px solid ${QA.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span>{ANNOUNCEMENT_ICON[a.type] || '📢'}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: QA.textDark }}>{a.title}</span>
          </div>
          <div style={{ fontSize: 12, color: QA.textMuted, lineHeight: 1.4 }}>{a.message}</div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
            {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PostCard({ post, onLikeToggle }) {
  const [openComments, setOpenComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [commentCount, setCommentCount] = useState(post.comment_count);

  const toggleComments = () => {
    setOpenComments(o => !o);
    if (comments === null) {
      axios.get(API_ENDPOINTS.POST_COMMENTS(post.id))
        .then(res => setComments(res.data?.comments || []))
        .catch(() => setComments([]));
    }
  };

  const submitComment = async () => {
    const text = commentInput.trim();
    if (!text) return;
    try {
      const res = await axios.post(API_ENDPOINTS.POST_COMMENTS(post.id), { comment: text });
      if (res.data?.success) {
        setComments(prev => [...(prev || []), res.data.comment]);
        setCommentInput('');
        setCommentCount(c => c + 1);
      }
    } catch { /* silent */ }
  };

  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Avatar id={post.employee_id} firstName={post.author_name?.split(' ')[0]} lastName={post.author_name?.split(' ')[1]} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: QA.textDark }}>
            {post.author_name}
            {post.post_type === 'praise' && post.praised_employee_name && (
              <span style={{ fontWeight: 400, color: QA.textMuted }}> praised <strong style={{ color: QA.purple }}>{post.praised_employee_name}</strong></span>
            )}
          </div>
          <div style={{ fontSize: 10, color: QA.textMuted, marginBottom: 6 }}>
            {new Date(post.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 13, color: QA.textDark, lineHeight: 1.5 }}>{post.content}</div>
          {post.post_type === 'poll' && (post.poll_options || []).length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {post.poll_options.map((opt, i) => (
                <div key={i} style={{ padding: '6px 10px', borderRadius: 8, background: QA.primaryLight, color: QA.primary, fontSize: 12, fontWeight: 600 }}>
                  {opt}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <button onClick={() => onLikeToggle(post.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: post.liked_by_me ? QA.danger : QA.textMuted, fontSize: 11, padding: 0 }}>
              {post.liked_by_me ? <FaHeart size={11} /> : <FaRegHeart size={11} />} {post.like_count > 0 ? post.like_count : 'Like'}
            </button>
            <button onClick={toggleComments}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: QA.textMuted, fontSize: 11, padding: 0 }}>
              <FaCommentDots size={11} /> {commentCount > 0 ? commentCount : 'Comment'}
            </button>
          </div>
          {openComments && (
            <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid #f3f4f6' }}>
              {(comments || []).map(c => (
                <div key={c.id} style={{ fontSize: 11, color: QA.textDark, marginBottom: 4 }}>
                  <strong>{c.commenter_name}</strong> {c.comment}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  placeholder="Write a comment…"
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: `1px solid ${QA.border}`, fontSize: 11, outline: 'none' }}
                  onKeyDown={e => { if (e.key === 'Enter') submitComment(); }}
                />
                <button onClick={submitComment} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#f3f4f6', color: QA.textDark, fontSize: 11, cursor: 'pointer' }}>Post</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostComposerCard() {
  const [tab, setTab] = useState('post');
  const [content, setContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [praisedName, setPraisedName] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = () => {
    axios.get(API_ENDPOINTS.POSTS)
      .then(res => { if (res.data?.success) setPosts(res.data.posts || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPosts(); }, []);

  const reset = () => { setContent(''); setPollOptions(['', '']); setPraisedName(''); setError(''); };

  const submit = async () => {
    if (!content.trim()) { setError('Write something first'); return; }
    if (tab === 'praise' && !praisedName.trim()) { setError('Please enter who you are praising'); return; }
    setPosting(true);
    setError('');
    try {
      const res = await axios.post(API_ENDPOINTS.POSTS, {
        post_type: tab,
        content: content.trim(),
        poll_options: tab === 'poll' ? pollOptions.filter(o => o.trim()) : undefined,
        praised_employee_name: tab === 'praise' ? praisedName.trim() : undefined,
      });
      if (res.data?.success) {
        reset();
        setPosts(prev => [res.data.post, ...prev]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId) => {
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
      : p));
    try {
      await axios.patch(API_ENDPOINTS.POST_LIKE(postId));
    } catch {
      fetchPosts();
    }
  };

  return (
    <div style={QA_CARD_STYLE}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setError(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: tab === t.key ? QA.primary : '#f3f4f6',
              color: tab === t.key ? '#fff' : QA.textMuted,
            }}>
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'announcements' ? (
        <AnnouncementsList />
      ) : (
        <>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={tab === 'poll' ? 'Ask a question…' : tab === 'praise' ? 'Say something nice…' : 'Write your post here and mention your peers'}
        rows={2}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${QA.border}`, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
      />

      {tab === 'poll' && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pollOptions.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                value={opt}
                onChange={e => setPollOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                placeholder={`Option ${i + 1}`}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: `1px solid ${QA.border}`, fontSize: 12, outline: 'none' }}
              />
              {pollOptions.length > 2 && (
                <button onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', color: QA.danger, cursor: 'pointer' }}>
                  <FaTimes size={11} />
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 4 && (
            <button onClick={() => setPollOptions(prev => [...prev, ''])}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: QA.primary, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              + Add option
            </button>
          )}
        </div>
      )}

      {tab === 'praise' && (
        <input
          value={praisedName}
          onChange={e => setPraisedName(e.target.value)}
          placeholder="Who are you praising?"
          style={{ marginTop: 8, width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${QA.border}`, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
        />
      )}

      {error && <div style={{ fontSize: 11, color: QA.danger, marginTop: 8 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button onClick={submit} disabled={posting}
          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: QA.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: posting ? 'not-allowed' : 'pointer', opacity: posting ? 0.6 : 1 }}>
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: QA.textMuted, marginTop: 10 }}>Loading feed…</div>
      ) : posts.length === 0 ? (
        <div style={{ fontSize: 12, color: QA.textMuted, marginTop: 10 }}>No posts yet — say hello to your team!</div>
      ) : (
        <div>
          {posts.map(p => <PostCard key={p.id} post={p} onLikeToggle={toggleLike} />)}
        </div>
      )}
        </>
      )}
    </div>
  );
}

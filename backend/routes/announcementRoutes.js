const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const multer = require('multer');
const { uploadFile, deleteFile } = require('../lib/supabaseStorage');
const { sendAnnouncementEmail } = require('../services/emailService');

// Memory storage — announcement images go to Supabase Storage (no local disk in serverless)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files allowed (jpg, png, gif, webp)'));
    },
});

// GET /api/announcements — all active announcements (all authenticated users)
router.get('/', async (req, res) => {
    try {
        let query = supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter out expired announcements
        const now = new Date().toISOString();
        query = query.or(`expires_at.is.null,expires_at.gt.${now}`);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, announcements: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch announcements', error: error.message });
    }
});

// POST /api/announcements — create with optional image (admin only)
router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        const { title, message, type, priority, expires_at } = req.body;
        if (!title?.trim() || !message?.trim()) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        // Upload image to Supabase Storage if provided
        let image_url = null;
        if (req.file) {
            const { publicUrl } = await uploadFile(
                req.file.buffer,
                req.file.originalname,
                'announcements',
                req.file.mimetype
            );
            image_url = publicUrl;
        }

        const { data, error } = await supabase
            .from('announcements')
            .insert([{
                title: title.trim(),
                message: message.trim(),
                type: type || 'announcement',
                priority: priority || 'normal',
                created_by: req.user.employeeId,
                expires_at: expires_at || null,
                image_url
            }])
            .select();
        if (error) throw error;
        res.json({ success: true, announcement: data[0] });

        // Non-blocking: email all active employees about the new announcement
        supabase.from('employees').select('email, first_name, last_name').eq('status', 'active')
            .then(({ data: employees }) => {
                sendAnnouncementEmail(employees || [], {
                    title: title.trim(),
                    message: message.trim(),
                    type: type || 'announcement',
                    priority: priority || 'normal',
                    createdBy: req.user?.employeeId || 'Admin',
                }).catch(err => console.error('⚠️ Announcement email error:', err.message));
            })
            .catch(err => console.error('⚠️ Announcement email fetch error:', err.message));

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create announcement', error: error.message });
    }
});

// DELETE /api/announcements/:id — delete with image cleanup (admin only)
router.delete('/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        // Fetch image_url before delete to clean up file
        const { data: ann } = await supabase
            .from('announcements').select('image_url').eq('id', req.params.id).single();
        
        const { error } = await supabase
            .from('announcements').delete().eq('id', req.params.id);
        if (error) throw error;

        // Remove image from Supabase Storage if one was attached
        if (ann?.image_url) {
            await deleteFile(ann.image_url).catch(e => console.warn('⚠️ Image delete skipped:', e.message));
        }

        res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete announcement', error: error.message });
    }
});

module.exports = router;

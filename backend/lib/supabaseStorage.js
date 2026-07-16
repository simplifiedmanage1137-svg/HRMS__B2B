/**
 * Supabase Storage helper for serverless file uploads.
 *
 * Replaces multer disk storage. Files arrive in memory (Buffer) from
 * multer memoryStorage(), are uploaded here, and the returned public
 * URL is stored in the database instead of a local filename.
 *
 * Bucket setup (one-time, in Supabase dashboard):
 *   1. Create bucket named "hrms-documents"  (set to Public)
 *   2. Add RLS policy: authenticated users can insert/select/delete
 *      their own objects, service-role bypasses RLS entirely.
 */

const supabase = require('../config/supabase');

const BUCKET = 'hrms-documents';

/**
 * Upload a file buffer to Supabase Storage.
 * @param {Buffer}  buffer       - File contents from multer memoryStorage
 * @param {string}  originalName - Original filename (used for extension)
 * @param {string}  folder       - Storage folder (e.g. 'profiles', 'documents')
 * @param {string}  mimeType     - MIME type of the file
 * @returns {{ path: string, publicUrl: string }}
 */
async function uploadFile(buffer, originalName, folder, mimeType) {
    const ext = originalName.split('.').pop().toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const storagePath = `${folder}/${unique}.${ext}`;

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) {
        console.error('[supabaseStorage] upload failed:', {
            bucket:    BUCKET,
            path:      storagePath,
            fileName:  originalName,
            fileSize:  buffer.length,
            mimeType,
            errorCode: error.statusCode || error.status,
            errorMsg:  error.message,
            errorFull: JSON.stringify(error, null, 2),
        });
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(data.path);

    return { path: data.path, publicUrl };
}

/**
 * Delete a file from Supabase Storage using its storage path.
 * Silently ignores "not found" errors (already deleted or never uploaded).
 * @param {string} storagePath - e.g. "documents/1234567890-abc.pdf"
 */
async function deleteFile(storagePath) {
    if (!storagePath) return;

    // Accept full public URLs — extract the path after the bucket name
    if (storagePath.startsWith('http')) {
        const marker = `/${BUCKET}/`;
        const idx = storagePath.indexOf(marker);
        if (idx !== -1) {
            storagePath = storagePath.slice(idx + marker.length);
        }
    }

    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error && error.message !== 'The resource was not found') {
        throw new Error(`Supabase Storage delete failed: ${error.message}`);
    }
}

/**
 * Map a multer fieldname to the correct storage folder.
 * Keeps files organised by type inside the bucket.
 */
function folderForField(fieldname) {
    if (fieldname === 'profile_image') return 'profiles';
    if (fieldname === 'image') return 'announcements';
    return 'documents';
}

module.exports = { uploadFile, deleteFile, folderForField, BUCKET };

// backend/utils/profilePhotoPost.js
// Auto-creates an "updated their profile photo" post in the dashboard social
// feed whenever an employee successfully changes their profile picture.
// Failure here must never break the actual photo upload it's attached to.

async function createProfilePhotoPost(supabase, employee) {
    try {
        if (!employee?.employee_id || !employee?.profile_image) return;
        const authorName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.employee_id;

        await supabase.from('dashboard_posts').insert({
            employee_id: employee.employee_id,
            author_name: authorName,
            post_type: 'profile_update',
            content: `${authorName} updated their profile photo.`,
            image_url: employee.profile_image,
            media_urls: [{ url: employee.profile_image, type: 'image' }],
            liked_by: [],
        });
    } catch (err) {
        console.error('[profilePhotoPost] failed to create auto-post:', err);
    }
}

module.exports = { createProfilePhotoPost };

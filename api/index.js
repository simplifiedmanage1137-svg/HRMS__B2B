/**
 * Vercel Serverless entry point.
 *
 * Wraps the Express app with serverless-http so every /api/* request is
 * handled by the existing route files unchanged.
 *
 * Vercel rewrites route /api/(.*) → /api/index.
 * serverless-http forwards the ORIGINAL req.url to Express, so all route
 * matching (/api/employees, /api/auth/login, etc.) works without modification.
 *
 * Specific cron endpoints in api/cron/*.js take precedence over this
 * catch-all because Vercel resolves exact file-system paths first.
 */

const serverless = require('serverless-http');

// Module-level singleton: Vercel reuses warm instances, so we cache the
// handler to avoid re-initialising the Express app on every request.
let _handler;

function getHandler() {
    if (!_handler) {
        const app = require('../backend/server');
        _handler = serverless(app);
    }
    return _handler;
}

module.exports = (req, res) => {
    // Instant diagnostic — responds before loading any backend code
    if (req.url === '/api/_ping' || req.url === '/_ping') {
        return res.end(JSON.stringify({
            ok: true,
            ts: new Date().toISOString(),
            NODE_ENV: process.env.NODE_ENV || 'MISSING',
            VERCEL: process.env.VERCEL || 'MISSING',
            SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
            JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
        }));
    }

    try {
        return getHandler()(req, res);
    } catch (err) {
        console.error('❌ [api/index] startup error:', err.message);
        console.error(err.stack);
        res.status(500).json({ error: 'Function failed to initialize', detail: err.message });
    }
};

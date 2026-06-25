/**
 * Vercel Serverless entry point.
 */

module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        ok: true,
        url: req.url,
        method: req.method,
        ts: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV || 'MISSING',
            VERCEL: process.env.VERCEL || 'MISSING',
            SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
            JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING',
        }
    }));
};

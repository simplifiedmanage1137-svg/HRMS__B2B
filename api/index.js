// Vercel Serverless Function entrypoint.
//
// This is the standard, documented way to run an Express app on Vercel: export the app
// instance from a file under /api, and route all /api/* traffic to it via vercel.json's
// rewrites. Express itself already registers every route under /api/... (see backend/server.js),
// so no path rewriting inside the handler is needed — the original request path is preserved.
//
// There is no special "/_/backend" prefix — the frontend calls /api/... directly (see
// frontend/src/config/axios.js's baseURL and frontend/.env.production's VITE_API_URL).
module.exports = require('../backend/server.js');

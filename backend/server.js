// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// Load environment variables
dotenv.config();

// Import Supabase configuration
const supabase = require('./config/supabase');

// Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes')(supabase);
const salaryRoutes = require('./routes/salaryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminUpdateRoutes = require('./routes/adminUpdateRoutes');
const employeeUpdateRoutes = require('./routes/employeeUpdateRoutes');
const updateResponseRoutes = require('./routes/updateResponseRoutes');

// Initialize Express app
const app = express();

// ============== DETERMINE ENVIRONMENT ==============
// On Render, NODE_ENV might not be set, so check for RENDER_EXTERNAL_URL
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER_EXTERNAL_URL;
const PORT = process.env.PORT || 5000;

console.log('='.repeat(70));
console.log('🚀 SERVER INITIALIZING');
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`Port: ${PORT}`);
console.log('='.repeat(70));

// ============== CORS CONFIGURATION ==============
// Get allowed origins from environment or use defaults
const getCorsOrigins = () => {
    // In production, use environment variable or specific domains
    if (isProduction) {
        const origins = [
            'https://employee-management-system-zeta-lac.vercel.app',
            'https://employee-management-system-phi-five.vercel.app',
            'https://employee-management-system-24rs0uvjz-b2bindemand-hubs-projects.vercel.app',
            'https://employee-management-system-96lz.onrender.com',
            // Add your frontend URLs here
        ];
        
        // Add any additional origins from environment variable
        if (process.env.CORS_ORIGINS) {
            const additionalOrigins = process.env.CORS_ORIGINS.split(',');
            origins.push(...additionalOrigins);
        }
        
        return origins;
    }
    
    // In development, allow localhost
    return [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
    ];
};

// Configure CORS with proper options
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = getCorsOrigins();
        
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }
        
        // In development, allow all origins
        if (!isProduction) {
            return callback(null, true);
        }
        
        // In production, check against whitelist
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ CORS blocked for origin:', origin);
            callback(new Error('CORS not allowed for this origin'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 
        'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Credentials'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Custom CORS middleware - explicitly set headers
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = getCorsOrigins();
    
    console.log(`📍 Request: ${req.method} ${req.url} from origin: ${origin || 'no-origin'}`);
    
    // Allow if no origin (Postman, curl, etc) OR in development OR origin is whitelisted
    if (!origin || !isProduction || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
        res.header('Access-Control-Expose-Headers', 'Content-Range,X-Content-Range');
    }
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// Also apply cors middleware for redundancy
app.use(cors(corsOptions));

// ============== OTHER MIDDLEWARE ==============
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// ============== CREATE UPLOAD DIRECTORIES ==============
const createUploadDirectories = () => {
    const uploadsDir = path.join(__dirname, 'uploads');
    const profilesDir = path.join(uploadsDir, 'profiles');
    const documentsDir = path.join(uploadsDir, 'documents');
    
    [uploadsDir, profilesDir, documentsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    });
    
    return { uploadsDir, profilesDir, documentsDir };
};

const { uploadsDir } = createUploadDirectories();

// Serve static files
app.use('/uploads', express.static(uploadsDir));

// ============== MULTER CONFIGURATION ==============
const documentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const documentsDir = path.join(__dirname, 'uploads', 'documents');
        cb(null, documentsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const fieldname = file.fieldname.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, fieldname + '-' + uniqueSuffix + ext);
    }
});

const uploadDocuments = multer({ 
    storage: documentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and documents are allowed'));
        }
    }
});

// ============== HEALTH CHECK ENDPOINTS ==============
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Backend is working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        cors: {
            origins: getCorsOrigins(),
            requestOrigin: req.headers.origin || 'No origin'
        }
    });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'Supabase connected successfully!',
            database: 'Supabase',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Supabase connection failed',
            error: error.message
        });
    }
});

// ============== ROOT ENDPOINT ==============
app.get('/', (req, res) => {
    res.json({
        name: 'Employee Management System API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            test: '/api/test',
            testDb: '/api/test-db',
            auth: '/api/auth/*',
            employees: '/api/employees/*',
            leaves: '/api/leaves/*',
            attendance: '/api/attendance/*',
            salary: '/api/salary/*',
            notifications: '/api/notifications/*',
            adminUpdates: '/api/admin-updates/*',
            employeeUpdates: '/api/employee-updates/*',
            updateResponses: '/api/update-responses/*'
        }
    });
});

// ============== AUTHENTICATION MIDDLEWARE ==============
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Access token required' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here', (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Token expired' 
                });
            }
            return res.status(403).json({ 
                success: false,
                message: 'Invalid or expired token' 
            });
        }
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
        req.employeeId = user.employeeId;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
            success: false,
            message: 'Admin access required' 
        });
    }
    next();
};

// ============== ROUTES ==============
app.use('/api/auth', authRoutes);
app.use('/api/employees', authenticateToken, employeeRoutes);
app.use('/api/leaves', authenticateToken, leaveRoutes);
app.use('/api/attendance', authenticateToken, attendanceRoutes);
app.use('/api/salary', authenticateToken, salaryRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/admin-updates', authenticateToken, adminUpdateRoutes);
app.use('/api/employee-updates', authenticateToken, employeeUpdateRoutes);
app.use('/api/update-responses', authenticateToken, updateResponseRoutes);

// ============== IP WHITELIST MIDDLEWARE (Optional) ==============
// const { checkAttendanceEligibility } = require('./middleware/ipWhitelist');
// app.use('/api/attendance', checkAttendanceEligibility);

// ============== ERROR HANDLING MIDDLEWARE ==============
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`,
        availableEndpoints: [
            '/api/health',
            '/api/test',
            '/api/test-db',
            '/api/auth/*',
            '/api/employees/*',
            '/api/leaves/*',
            '/api/attendance/*',
            '/api/salary/*',
            '/api/notifications/*',
            '/api/admin-updates/*',
            '/api/employee-updates/*',
            '/api/update-responses/*'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    
    // Handle CORS errors
    if (err.message === 'CORS not allowed for this origin') {
        return res.status(403).json({
            success: false,
            message: 'CORS error: Origin not allowed',
            error: err.message,
            origin: req.headers.origin
        });
    }
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: err.message
        });
    }
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============== START SERVER ==============
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log(`🚀 SERVER STARTED SUCCESSFULLY`);
    console.log('='.repeat(70));
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`🔗 Public URL: ${process.env.RENDER_EXTERNAL_URL || 'Not set'}`);
    console.log('='.repeat(70));
    console.log(`📝 TEST ENDPOINTS:`);
    console.log(`   - GET  /`);
    console.log(`   - GET  /api/health`);
    console.log(`   - GET  /api/test`);
    console.log(`   - GET  /api/test-db`);
    console.log('='.repeat(70));
    console.log(`🔐 AUTH ROUTES:`);
    console.log(`   - POST /api/auth/login`);
    console.log(`   - POST /api/auth/register`);
    console.log(`   - POST /api/auth/verify`);
    console.log('='.repeat(70));
    console.log(`👥 EMPLOYEE ROUTES:`);
    console.log(`   - GET    /api/employees`);
    console.log(`   - GET    /api/employees/:id`);
    console.log(`   - GET    /api/employees/profile/:employeeId`);
    console.log(`   - POST   /api/employees`);
    console.log(`   - PUT    /api/employees/:id`);
    console.log(`   - DELETE /api/employees/:id`);
    console.log(`   - GET    /api/employees/today-events`);
    console.log(`   - POST   /api/employees/:employeeId/documents`);
    console.log('='.repeat(70));
    console.log(`📅 LEAVE ROUTES:`);
    console.log(`   - GET    /api/leaves/types`);
    console.log(`   - GET    /api/leaves/balance/:employee_id`);
    console.log(`   - GET    /api/leaves`);
    console.log(`   - POST   /api/leaves/apply`);
    console.log(`   - PUT    /api/leaves/:id/status`);
    console.log('='.repeat(70));
    console.log(`⏰ ATTENDANCE ROUTES:`);
    console.log(`   - GET    /api/attendance/report`);
    console.log(`   - GET    /api/attendance/today/:employee_id`);
    console.log(`   - POST   /api/attendance/clock-in`);
    console.log(`   - POST   /api/attendance/clock-out`);
    console.log(`   - POST   /api/attendance/heartbeat`);
    console.log('='.repeat(70));
    console.log(`💰 SALARY ROUTES:`);
    console.log(`   - GET    /api/salary/employee/:employee_id`);
    console.log(`   - GET    /api/salary/:id`);
    console.log(`   - POST   /api/salary/generate`);
    console.log('='.repeat(70));
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
    console.log('='.repeat(70));
    console.log(`🔧 CORS Configuration:`);
    console.log(`   Allowed Origins:`);
    getCorsOrigins().forEach(origin => {
        console.log(`   - ${origin}`);
    });
    console.log('='.repeat(70));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
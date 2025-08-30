const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const logger = require('./utils/logger');

// Job scheduler - jobs are loaded from database at startup
const jobScheduler = require('./services/jobScheduler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Version information - loaded at startup
let versionInfo = {
    version: '1.0.0',
    build_time: 'unknown',
    git_commit: 'unknown',
    git_branch: 'unknown',
    environment: 'development'
};

// Function to fetch version information
async function loadVersionInfo() {
    try {
        // First, try to load from local version.json file (created by build script)
        const versionPath = path.join(__dirname, 'version.json');
        if (fs.existsSync(versionPath)) {
            const localVersion = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
            versionInfo = { ...versionInfo, ...localVersion };
            logger.info('Loaded version info from local file', versionInfo);
        }
        
        // Then, try to fetch from FastAPI backend
        const fastApiUrl = process.env.FASTAPI_BASE_URL;
        try {
            const response = await axios.get(`${fastApiUrl}/api/version`, {
                timeout: 5000, // 5 second timeout
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.data) {
                versionInfo = { ...versionInfo, ...response.data };
                logger.info('Updated version info from FastAPI backend', versionInfo);
            }
        } catch (backendError) {
            logger.warn('Could not fetch version info from backend:', {
                error: backendError.message,
                fastApiUrl
            });
        }
    } catch (error) {
        logger.error('Failed to load version information:', error);
    }
}

// Load version info at startup only
loadVersionInfo();

// Middleware to add version info and API environment to all requests
app.use((req, res, next) => {
    const apiBaseUrl = process.env.FASTAPI_BASE_URL;
    let apiEnvironment = 'development';
    
    // Environment is determined by which API we're connecting to, not NODE_ENV
    if (apiBaseUrl.includes('railway.app')) {
        apiEnvironment = 'production';
    } else if (apiBaseUrl.includes('localhost')) {
        apiEnvironment = 'localhost';
    } else {
        apiEnvironment = 'staging';
    }
    
    res.locals.versionInfo = versionInfo;
    res.locals.apiBaseUrl = apiBaseUrl;
    res.locals.apiEnvironment = apiEnvironment;
    res.locals.apiHost = new URL(apiBaseUrl).host;
    next();
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
            connectSrc: ["'self'", "ws:", "wss:"]
        }
    }
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3003',
    credentials: true
}));

// Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// Make socket.io available to API routes
app.use('/api', (req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/profiles', require('./routes/profiles'));
app.use('/companies', require('./routes/companies'));
app.use('/candidates', require('./routes/candidates'));
app.use('/jobs', require('./routes/jobs'));
app.use('/scoring', require('./routes/scoring'));
app.use('/templates', require('./routes/templates'));
app.use('/ingestion', require('./routes/ingestion'));
app.use('/system', require('./routes/system'));
app.use('/api', require('./routes/api'));

// Environment configuration page
app.get('/environment', (req, res) => {
    res.render('environment', {
        title: 'Environment Configuration'
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Basic health check - could be expanded
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: require('./package.json').version
        };
        
        res.json(health);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Version endpoint
app.get('/version', (req, res) => {
    res.json({
        ...versionInfo,
        admin_ui_version: require('./package.json').version,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Manual version refresh endpoint (optional, only when needed)
app.post('/version/refresh', async (req, res) => {
    try {
        await loadVersionInfo();
        res.json({
            status: 'success',
            message: 'Version info refreshed successfully',
            ...versionInfo,
            admin_ui_version: require('./package.json').version,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Version refresh failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to refresh version info',
            error: error.message
        });
    }
});

// Connect job scheduler to Socket.IO for real-time updates
jobScheduler.setSocketIO(io);

// WebSocket handling
io.on('connection', async (socket) => {
    logger.info('Client connected to WebSocket');
    
    socket.on('disconnect', () => {
        logger.info('Client disconnected from WebSocket');
    });
    
    // Send welcome message
    socket.emit('connected', {
        message: 'Connected to LinkedIn Ingestion Admin UI',
        timestamp: new Date().toISOString()
    });
    
    // Send current job status to newly connected clients
    try {
        const currentJobStatuses = await jobScheduler.getJobStatus();
        socket.emit('job-status-initial', currentJobStatuses);
    } catch (error) {
        logger.warn('Failed to send initial job status to client:', error.message);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).render('error', {
        title: 'Server Error',
        message: 'An unexpected error occurred while processing your request.',
        error: process.env.NODE_ENV === 'development' ? err : { message: 'Internal server error' }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The requested page could not be found.',
        error: { message: 'The requested page could not be found' }
    });
});

const PORT = process.env.PORT || 3003;

// Initialize jobs from database before starting server
async function initializeServer() {
    try {
        logger.info('Initializing job scheduler from database...');
        await jobScheduler.initializeJobs();
        logger.info('Job scheduler initialization complete');
    } catch (error) {
        logger.error('Failed to initialize job scheduler:', error);
        logger.info('Server will start but no jobs will be scheduled');
    }

    server.listen(PORT, () => {
        logger.info(`LinkedIn Ingestion Admin UI server running on port ${PORT}`, {
            environment: process.env.NODE_ENV || 'development',
            fastApiUrl: process.env.FASTAPI_BASE_URL
        });
    });
}

// Start the server with async initialization
initializeServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
    });
});

module.exports = app;

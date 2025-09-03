const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'linkedin-ingestion-admin-ui' },
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(meta).length > 0) {
                        try {
                            // Handle circular references safely
                            const safeStringify = (obj) => {
                                const cache = new Set();
                                return JSON.stringify(obj, (key, value) => {
                                    if (typeof value === 'object' && value !== null) {
                                        if (cache.has(value)) {
                                            return '[Circular]';
                                        }
                                        cache.add(value);
                                    }
                                    return value;
                                });
                            };
                            msg += ` ${safeStringify(meta)}`;
                        } catch (error) {
                            msg += ` [Logging Error: ${error.message}]`;
                        }
                    }
                    return msg;
                })
            )
        })
    ]
});

// Add file transport for production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
    }));
    logger.add(new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
    }));
}

module.exports = logger;

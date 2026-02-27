import winston from 'winston';
import crypto from 'crypto';

// Service identifier for Dr.Oc monitoring
const SERVICE_ID = 'USMM';

// Generate a deterministic fingerprint for error grouping
function generateFingerprint(message: string): string {
    if (!message) return 'UNKNOWN_ERROR';
    // Strip common volatile data that might be embedded directly in the message string
    const cleanMessage = message
        .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[UUID]') // UUIDs
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // IPs
        .replace(/0x[a-fA-F0-9]+/g, '[HEX]') // Hex addresses
        .replace(/-?\d+\.\d+,\s*-?\d+\.\d+/g, '[COORD]') // Coordinates
        .replace(/\b\d+\b/g, '[#]') // Standalone numbers
        .trim();
    
    return crypto.createHash('md5').update(cleanMessage).digest('hex').substring(0, 12);
}

// Standardized format for all services
const consoleFormat = winston.format.printf(({ timestamp, level, message, label, ...metadata }) => {
    const serviceLabel = (label as string) || SERVICE_ID;
    let msg = `[${timestamp}] [${serviceLabel}] [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

const fileFormat = winston.format.printf(({ timestamp, level, message, label, ...metadata }) => {
    const serviceLabel = (label as string) || SERVICE_ID;
    
    // Inject fingerprint for errors/warnings
    if (level === 'error' || level === 'warn') {
        metadata.droc_fp = generateFingerprint(message as string);
    }
    
    let msg = `[${timestamp}] [${serviceLabel}] [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    defaultMeta: { label: SERVICE_ID },
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                consoleFormat
            )
        }),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                fileFormat
            )
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                fileFormat
            )
        }),
    ],
});

export default logger;

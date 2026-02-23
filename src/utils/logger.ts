import winston from 'winston';

const { combine, timestamp, printf, colorize, json, label } = winston.format;

// Service identifier for Dr.Oc monitoring
const SERVICE_ID = 'USMM';

const consoleFormat = printf(({ level, message, timestamp, label, ...metadata }) => {
  const labelPart = label ? `[${label}]` : `[${SERVICE_ID}]`;
  let msg = `${timestamp} ${labelPart} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { label: SERVICE_ID },
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production' ? json() : combine(colorize(), consoleFormat)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

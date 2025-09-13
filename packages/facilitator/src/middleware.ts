import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';

/**
 * Request logging middleware
 */
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    });

    next();
  };
}

/**
 * Error handling middleware
 */
export function errorHandler(logger: Logger) {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      body: req.body
    });

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  };
}

/**
 * Rate limiting middleware (basic implementation)
 */
export function rateLimit(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }

    // Get or create client record
    let clientRecord = requests.get(clientId);
    if (!clientRecord || clientRecord.resetTime < windowStart) {
      clientRecord = { count: 0, resetTime: now + windowMs };
      requests.set(clientId, clientRecord);
    }

    // Check rate limit
    if (clientRecord.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((clientRecord.resetTime - now) / 1000)
      });
    }

    // Increment counter
    clientRecord.count++;

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - clientRecord.count).toString(),
      'X-RateLimit-Reset': new Date(clientRecord.resetTime).toISOString()
    });

    next();
  };
}

/**
 * Validation middleware for x402 requests
 */
export function validateX402Request(req: Request, res: Response, next: NextFunction) {
  const { x402Version, paymentHeader, paymentRequirements } = req.body;

  if (typeof x402Version !== 'number') {
    return res.status(400).json({
      error: 'Invalid x402Version: must be a number'
    });
  }

  if (typeof paymentHeader !== 'string' || !paymentHeader.trim()) {
    return res.status(400).json({
      error: 'Invalid paymentHeader: must be a non-empty string'
    });
  }

  if (!paymentRequirements || typeof paymentRequirements !== 'object') {
    return res.status(400).json({
      error: 'Invalid paymentRequirements: must be an object'
    });
  }

  // Validate payment requirements structure
  const required = ['scheme', 'network', 'maxAmountRequired', 'payTo', 'asset'];
  for (const field of required) {
    if (!paymentRequirements[field]) {
      return res.status(400).json({
        error: `Missing required field in paymentRequirements: ${field}`
      });
    }
  }

  next();
}

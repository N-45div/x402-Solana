import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';
/**
 * Request logging middleware
 */
export declare function requestLogger(logger: Logger): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Error handling middleware
 */
export declare function errorHandler(logger: Logger): (error: Error, req: Request, res: Response, next: NextFunction) => void;
/**
 * Rate limiting middleware (basic implementation)
 */
export declare function rateLimit(windowMs?: number, maxRequests?: number): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validation middleware for x402 requests
 */
export declare function validateX402Request(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=middleware.d.ts.map
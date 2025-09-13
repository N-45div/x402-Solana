"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const winston_1 = require("winston");
const facilitator_service_1 = require("./facilitator-service");
const middleware_1 = require("./middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Logger setup
const logger = (0, winston_1.createLogger)({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.errors({ stack: true }), winston_1.format.json()),
    transports: [
        new winston_1.transports.File({ filename: 'error.log', level: 'error' }),
        new winston_1.transports.File({ filename: 'combined.log' }),
        new winston_1.transports.Console({
            format: winston_1.format.combine(winston_1.format.colorize(), winston_1.format.simple())
        })
    ]
});
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, middleware_1.requestLogger)(logger));
// Initialize facilitator service
const facilitatorService = new facilitator_service_1.FacilitatorService(logger);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Get supported schemes and networks
app.get('/supported', async (req, res) => {
    try {
        const supported = await facilitatorService.getSupportedSchemes();
        res.json(supported);
    }
    catch (error) {
        logger.error('Error getting supported schemes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify payment endpoint
app.post('/verify', async (req, res) => {
    try {
        const { x402Version, paymentHeader, paymentRequirements } = req.body;
        if (!x402Version || !paymentHeader || !paymentRequirements) {
            return res.status(400).json({
                isValid: false,
                invalidReason: 'Missing required fields: x402Version, paymentHeader, or paymentRequirements'
            });
        }
        const result = await facilitatorService.verifyPayment(x402Version, paymentHeader, paymentRequirements);
        res.json(result);
    }
    catch (error) {
        logger.error('Error verifying payment:', error);
        res.status(500).json({
            isValid: false,
            invalidReason: 'Internal server error during verification'
        });
    }
});
// Settle payment endpoint
app.post('/settle', async (req, res) => {
    try {
        const { x402Version, paymentHeader, paymentRequirements } = req.body;
        if (!x402Version || !paymentHeader || !paymentRequirements) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: x402Version, paymentHeader, or paymentRequirements'
            });
        }
        const result = await facilitatorService.settlePayment(x402Version, paymentHeader, paymentRequirements);
        res.json(result);
    }
    catch (error) {
        logger.error('Error settling payment:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during settlement'
        });
    }
});
// Transaction status endpoint
app.get('/transaction/:signature', async (req, res) => {
    try {
        const { signature } = req.params;
        const { network } = req.query;
        if (!signature || !network) {
            return res.status(400).json({
                error: 'Missing required parameters: signature and network'
            });
        }
        const status = await facilitatorService.getTransactionStatus(signature, network);
        res.json(status);
    }
    catch (error) {
        logger.error('Error getting transaction status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Error handling middleware
app.use((0, middleware_1.errorHandler)(logger));
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Start server
app.listen(port, () => {
    logger.info(`x402 Solana Facilitator Server running on port ${port}`);
    logger.info('Supported endpoints:');
    logger.info('  GET  /health - Health check');
    logger.info('  GET  /supported - Get supported schemes');
    logger.info('  POST /verify - Verify payment');
    logger.info('  POST /settle - Settle payment');
    logger.info('  GET  /transaction/:signature - Get transaction status');
});
exports.default = app;
//# sourceMappingURL=index.js.map
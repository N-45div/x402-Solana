import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { FacilitatorService } from './facilitator-service';
import { errorHandler, requestLogger } from './middleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Logger setup
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger(logger));

// Initialize facilitator service
const facilitatorService = new FacilitatorService(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get supported schemes and networks
app.get('/supported', async (req, res) => {
  try {
    const supported = await facilitatorService.getSupportedSchemes();
    res.json(supported);
  } catch (error) {
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

    const result = await facilitatorService.verifyPayment(
      x402Version,
      paymentHeader,
      paymentRequirements
    );

    res.json(result);
  } catch (error) {
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

    const result = await facilitatorService.settlePayment(
      x402Version,
      paymentHeader,
      paymentRequirements
    );

    res.json(result);
  } catch (error) {
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

    const status = await facilitatorService.getTransactionStatus(
      signature,
      network as string
    );

    res.json(status);
  } catch (error) {
    logger.error('Error getting transaction status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use(errorHandler(logger));

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

export default app;

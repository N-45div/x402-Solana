import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import {
  PaymentRequiredResponse,
  SolanaPaymentRequirement,
  createSolTransferRequirement,
  createSplTransferRequirement,
  decodePaymentPayload,
  USDC_MINT_DEVNET,
} from '@x402-solana/core';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const facilitatorUrl = process.env.FACILITATOR_URL || 'http://localhost:3000';

// Your wallet address to receive payments
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS || 'YourSolanaAddressHere';

app.use(cors());
app.use(express.json());

// Middleware to check for x402 payment
function requirePayment(
  amount: string,
  description: string,
  resource: string,
  acceptSOL: boolean = true,
  acceptUSDC: boolean = true
) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const paymentHeader = req.headers['x-payment'] as string;

    if (!paymentHeader) {
      // No payment provided, return 402 with requirements
      const accepts: SolanaPaymentRequirement[] = [];

      if (acceptSOL) {
        accepts.push(createSolTransferRequirement(
          PAYMENT_ADDRESS,
          amount,
          resource,
          description,
          'solana-devnet'
        ));
      }

      if (acceptUSDC) {
        accepts.push(createSplTransferRequirement(
          PAYMENT_ADDRESS,
          amount,
          USDC_MINT_DEVNET,
          resource,
          description,
          'solana-devnet'
        ));
      }

      const paymentRequired: PaymentRequiredResponse = {
        x402Version: 1,
        accepts,
        error: 'Payment required to access this resource'
      };

      return res.status(402).json(paymentRequired);
    }

    try {
      // Verify payment with facilitator
      const paymentPayload = decodePaymentPayload(paymentHeader);
      
      // Find matching requirement
      const requirement = acceptSOL && paymentPayload.scheme === 'solana-transfer'
        ? createSolTransferRequirement(PAYMENT_ADDRESS, amount, resource, description, 'solana-devnet')
        : acceptUSDC && paymentPayload.scheme === 'solana-spl'
        ? createSplTransferRequirement(PAYMENT_ADDRESS, amount, USDC_MINT_DEVNET, resource, description, 'solana-devnet')
        : null;

      if (!requirement) {
        return res.status(402).json({
          x402Version: 1,
          accepts: [],
          error: 'Unsupported payment scheme'
        });
      }

      // Verify with facilitator
      const verifyResponse = await axios.post(`${facilitatorUrl}/verify`, {
        x402Version: 1,
        paymentHeader,
        paymentRequirements: requirement
      });

      if (!verifyResponse.data.isValid) {
        return res.status(402).json({
          x402Version: 1,
          accepts: [requirement],
          error: `Payment verification failed: ${verifyResponse.data.invalidReason}`
        });
      }

      // Settle payment
      const settleResponse = await axios.post(`${facilitatorUrl}/settle`, {
        x402Version: 1,
        paymentHeader,
        paymentRequirements: requirement
      });

      if (!settleResponse.data.success) {
        return res.status(402).json({
          x402Version: 1,
          accepts: [requirement],
          error: `Payment settlement failed: ${settleResponse.data.error}`
        });
      }

      // Payment successful, add settlement info to response headers
      res.set('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify({
        success: true,
        txHash: settleResponse.data.txHash,
        networkId: settleResponse.data.networkId
      })).toString('base64'));

      next();
    } catch (error) {
      console.error('Payment processing error:', error);
      return res.status(500).json({
        error: 'Payment processing failed'
      });
    }
  };
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Free endpoint
app.get('/free-data', (req, res) => {
  res.json({
    message: 'This is free data!',
    timestamp: new Date().toISOString(),
    data: {
      publicInfo: 'Anyone can access this',
      tip: 'Try the paid endpoints for premium content'
    }
  });
});

// Paid endpoint - Premium market data (0.01 SOL or USDC)
app.get('/api/market-data', 
  requirePayment('0.01', 'Premium market data access', '/api/market-data'),
  (req, res) => {
    res.json({
      message: 'Premium Market Data',
      timestamp: new Date().toISOString(),
      data: {
        btc: { price: 45000, change: '+2.5%' },
        eth: { price: 3200, change: '+1.8%' },
        sol: { price: 120, change: '+5.2%' },
        analysis: 'Market showing bullish sentiment with strong volume',
        predictions: {
          btc: 'Expected to reach $50k by end of month',
          eth: 'Strong support at $3000',
          sol: 'Potential breakout above $150'
        }
      }
    });
  }
);

// Paid endpoint - AI Analysis (0.05 SOL or USDC)
app.post('/api/ai-analysis',
  requirePayment('0.05', 'AI-powered analysis service', '/api/ai-analysis'),
  (req, res) => {
    const { query } = req.body;
    
    res.json({
      message: 'AI Analysis Result',
      timestamp: new Date().toISOString(),
      query: query || 'No query provided',
      analysis: {
        sentiment: 'Positive',
        confidence: 0.87,
        keyPoints: [
          'Strong technical indicators',
          'Positive market sentiment',
          'Increasing adoption metrics'
        ],
        recommendation: 'Consider long-term position with proper risk management',
        riskLevel: 'Medium',
        timeframe: '3-6 months'
      }
    });
  }
);

// Paid endpoint - Premium API access (0.1 SOL or USDC)
app.get('/api/premium-feed',
  requirePayment('0.1', 'Premium real-time data feed', '/api/premium-feed'),
  (req, res) => {
    res.json({
      message: 'Premium Real-time Feed',
      timestamp: new Date().toISOString(),
      data: {
        realTimePrice: {
          btc: 45123.45,
          eth: 3201.23,
          sol: 121.67
        },
        volume24h: {
          btc: '2.1B',
          eth: '1.8B',
          sol: '450M'
        },
        orderBook: {
          bids: [
            { price: 45120, size: 0.5 },
            { price: 45115, size: 1.2 },
            { price: 45110, size: 0.8 }
          ],
          asks: [
            { price: 45125, size: 0.3 },
            { price: 45130, size: 0.9 },
            { price: 45135, size: 1.1 }
          ]
        },
        alerts: [
          'BTC broke resistance at $45,000',
          'High volume detected in SOL/USDC pair'
        ]
      }
    });
  }
);

// SOL-only endpoint
app.get('/api/sol-only',
  requirePayment('0.02', 'SOL-only premium content', '/api/sol-only', true, false),
  (req, res) => {
    res.json({
      message: 'SOL-Only Premium Content',
      timestamp: new Date().toISOString(),
      data: {
        solanaEcosystem: {
          totalValueLocked: '$2.1B',
          activeValidators: 1500,
          tps: 2500,
          projects: [
            { name: 'Serum', category: 'DEX', tvl: '$150M' },
            { name: 'Raydium', category: 'AMM', tvl: '$200M' },
            { name: 'Mango', category: 'Derivatives', tvl: '$100M' }
          ]
        }
      }
    });
  }
);

// USDC-only endpoint
app.get('/api/usdc-only',
  requirePayment('0.03', 'USDC-only premium content', '/api/usdc-only', false, true),
  (req, res) => {
    res.json({
      message: 'USDC-Only Premium Content',
      timestamp: new Date().toISOString(),
      data: {
        stablecoinMetrics: {
          usdcSupply: '$45B',
          dailyVolume: '$8B',
          yieldOpportunities: [
            { protocol: 'Compound', apy: '3.2%' },
            { protocol: 'Aave', apy: '2.8%' },
            { protocol: 'Solend', apy: '4.1%' }
          ]
        }
      }
    });
  }
);

// Error handling
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`🚀 x402 Solana Example Resource Server running on port ${port}`);
  console.log(`💰 Payment address: ${PAYMENT_ADDRESS}`);
  console.log(`🔗 Facilitator URL: ${facilitatorUrl}`);
  console.log('\n📋 Available endpoints:');
  console.log('  GET  /health - Health check (free)');
  console.log('  GET  /free-data - Free sample data');
  console.log('  GET  /api/market-data - Premium market data (0.01 SOL/USDC)');
  console.log('  POST /api/ai-analysis - AI analysis service (0.05 SOL/USDC)');
  console.log('  GET  /api/premium-feed - Real-time premium feed (0.1 SOL/USDC)');
  console.log('  GET  /api/sol-only - SOL-only content (0.02 SOL)');
  console.log('  GET  /api/usdc-only - USDC-only content (0.03 USDC)');
  console.log('\n💡 Set PAYMENT_ADDRESS environment variable to your Solana address');
});

export default app;

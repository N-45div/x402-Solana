# Quick Start Guide

This guide will help you get started with x402 Solana payments in minutes.

## Prerequisites

- Node.js 18+
- Solana CLI tools
- A Solana wallet with some SOL for testing

## Installation

1. **Clone the repository:**
```bash
git clone <your-repo-url>
cd x402-Solana
```

2. **Run the setup script:**
```bash
./scripts/setup.sh
```

This will automatically:
- Install all dependencies with updated versions
- Build all packages
- Set up environment files
- Verify prerequisites

## Quick Test

### 1. Start the Facilitator Server

```bash
# Copy environment file
cp packages/facilitator/.env.example packages/facilitator/.env

# Start facilitator
npm run start:facilitator
```

The facilitator will run on `http://localhost:3000`

### 2. Start the Example Resource Server

```bash
# Set your payment address
export PAYMENT_ADDRESS=YourSolanaAddressHere

# Start resource server
npm run start:example
```

The resource server will run on `http://localhost:4000`

### 3. Test the Payment Flow

```bash
# Test all endpoints
npm run test:payment endpoints

# Test actual payment (requires funded wallet)
npm run test:payment
```

## Basic Usage

### For Resource Servers

```typescript
import express from 'express';
import { createSolTransferRequirement } from '@x402-solana/core';

const app = express();

// Middleware to require payment
function requirePayment(amount: string, description: string) {
  return async (req, res, next) => {
    const paymentHeader = req.headers['x-payment'];
    
    if (!paymentHeader) {
      // Return 402 with payment requirements
      return res.status(402).json({
        x402Version: 1,
        accepts: [
          createSolTransferRequirement(
            'YourSolanaAddress',
            amount,
            req.path,
            description
          )
        ]
      });
    }
    
    // Verify and settle payment with facilitator
    // ... (see full example in packages/examples/resource-server)
    
    next();
  };
}

// Protected endpoint
app.get('/premium-data', 
  requirePayment('0.01', 'Premium data access'),
  (req, res) => {
    res.json({ data: 'Premium content here!' });
  }
);
```

### For Clients

```typescript
import { X402Client } from '@x402-solana/client-sdk';

// Initialize client
const client = new X402Client({
  facilitatorUrl: 'http://localhost:3000',
  network: 'solana-devnet'
});

// Make request with automatic payment
const response = await client.request('http://localhost:4000/premium-data', {
  wallet: yourWalletAdapter,
  paymentOptions: {
    priorityFee: 5000
  }
});

console.log(response.data);
```

## Environment Variables

### Facilitator Server
```bash
PORT=3000
NODE_ENV=development
SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

### Resource Server
```bash
PORT=4000
PAYMENT_ADDRESS=YourSolanaAddressHere
FACILITATOR_URL=http://localhost:3000
```

## Testing with Real Payments

1. **Get devnet SOL:**
```bash
# Generate a test keypair
solana-keygen new --outfile test-wallet.json

# Get the address
solana address --keypair test-wallet.json

# Airdrop SOL
solana airdrop 1 <your-address> --url devnet
```

2. **Update test script with your wallet:**
```typescript
// In packages/examples/client-demo/src/test-payment.ts
const testKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync('test-wallet.json', 'utf8')))
);
```

3. **Run payment test:**
```bash
cd packages/examples/client-demo
npm run test:payment
```

## Next Steps

- Read the [Protocol Specification](./protocol.md)
- Explore [API Reference](./api.md)
- Check out more [Examples](../packages/examples/README.md)
- Deploy to production networks

## Troubleshooting

### Common Issues

**"Wallet not connected"**
- Ensure your wallet adapter is properly initialized
- Check that the wallet has approved the connection

**"Insufficient funds"**
- Make sure your wallet has enough SOL for the payment + transaction fees
- For devnet testing, use `solana airdrop`

**"Payment verification failed"**
- Check that the facilitator server is running
- Verify the payment amount matches requirements
- Ensure transaction signatures are valid

**"Network mismatch"**
- Make sure client, facilitator, and resource server are using the same network
- Check RPC endpoints are accessible

### Getting Help

- Check the [FAQ](./faq.md)
- Review [Examples](../packages/examples/)
- Open an issue on GitHub

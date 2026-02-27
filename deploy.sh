#!/usr/bin/env bash
# ============================================================
#  GameChanger Marketplace – One-command deploy
#  Usage: bash deploy.sh
# ============================================================
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   GameChanger Marketplace – Cloudflare Pages Deploy     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 1. Install dependencies
echo "▶  Installing dependencies..."
npm install

# 2. Deploy smart contract to Fuji
echo ""
echo "▶  Deploying GameChangerExchange to Avalanche Fuji Testnet..."
echo "   (Make sure DEPLOYER_PRIVATE_KEY is set in .env)"
npx hardhat run scripts/deploy.js --network fuji

# 3. Load the contract address written by deploy.js
source .env
echo ""
echo "   Contract: $VITE_CONTRACT_ADDRESS"

# 4. Set the contract address as a Cloudflare secret
echo ""
echo "▶  Setting Cloudflare secrets..."
echo "$VITE_CONTRACT_ADDRESS" | npx wrangler secret put CONTRACT_ADDRESS --project-name gamechanger-market || true

# 5. Build the React frontend
echo ""
echo "▶  Building React frontend..."
npm run build

# 6. Deploy to Cloudflare Pages
echo ""
echo "▶  Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name gamechanger-market

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETE                                  ║"
echo "║                                                          ║"
echo "║  Marketplace: https://gamechanger-market.pages.dev       ║"
echo "║  Fuji Contract (Snowtrace):                              ║"
echo "║    https://testnet.snowtrace.io/address/$VITE_CONTRACT_ADDRESS"
echo "╚══════════════════════════════════════════════════════════╝"

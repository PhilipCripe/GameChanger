const { ethers } = require("hardhat");
const fs = require("fs");

// ─── Seed data ──────────────────────────────────────────────────────────────
// Category enum: SKIN=0, DLC=1, BUNDLE=2, COSMETIC=3, OTHER=4
const INITIAL_LISTINGS = [
  {
    name:      "Bayraktar TB2",
    sku:       "BAYRAKTAR",
    category:  0,   // SKIN
    priceGCH:  200,
    supply:    0,   // unlimited
    modder:    ethers.ZeroAddress,
    modderBps: 0,
    expiresAt: 0,
  },
  {
    name:      "F-35 Lightning II",
    sku:       "F35",
    category:  0,   // SKIN
    priceGCH:  500,
    supply:    0,
    modder:    ethers.ZeroAddress,
    modderBps: 0,
    expiresAt: 0,
  },
];

const INITIAL_POLLS = [
  {
    question: "Next DLC: Which tank should we add?",
    options:  ["Leopard 2 A7", "T-90M Proryv", "Abrams SEP v3", "Challenger 3"],
    costGCH:  50,
    endsAt:   0,   // no deadline
  },
];
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "AVAX"
  );

  // 1. Deploy
  const Exchange = await ethers.getContractFactory("GameChangerExchange");
  const exchange = await Exchange.deploy(deployer.address);
  await exchange.waitForDeployment();
  const address = await exchange.getAddress();

  console.log("\n✅ GameChangerExchange deployed to:", address);
  console.log(
    "   Snowtrace: https://testnet.snowtrace.io/address/" + address
  );

  // 2. Seed listings
  console.log("\n📦 Seeding listings...");
  for (const l of INITIAL_LISTINGS) {
    const tx = await exchange.createListing(
      l.name, l.sku, l.category, l.priceGCH,
      l.supply, l.modder, l.modderBps, l.expiresAt
    );
    await tx.wait();
    console.log(`   ✔ ${l.name} (${l.priceGCH} GCH)`);
  }

  // 3. Seed polls
  console.log("\n🗳  Seeding polls...");
  for (const p of INITIAL_POLLS) {
    const tx = await exchange.createPoll(
      p.question, p.options, p.costGCH, p.endsAt
    );
    await tx.wait();
    console.log(`   ✔ "${p.question}" (${p.options.length} options)`);
  }

  // 4. Write env
  const envLine =
    `VITE_CONTRACT_ADDRESS=${address}\nVITE_CHAIN_ID=43113\n`;
  fs.appendFileSync(".env", envLine);
  console.log("\n📝 Contract address written to .env");
  console.log("\n🚀 Next: npm run build && npx wrangler pages deploy dist --project-name gamechanger-market");
}

main().catch((e) => { console.error(e); process.exit(1); });

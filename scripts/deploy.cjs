const { ethers } = require("hardhat");
const fs = require("fs");

// ─── Seed data ──────────────────────────────────────────────────────────────
// No listings seeded at deploy time.
// All country/content unlocks are created dynamically via Admin → Listings.
// Category enum: SKIN=0, DLC=1, BUNDLE=2, COSMETIC=3, COUNTRY=4, OTHER=5

const INITIAL_POLLS = [
  {
    question: "What should the next major development update focus on?",
    options:  [
      "Economics Overhaul + Argentina with Inflation/Deflation mechanics",
      "Disinformation & Media Manipulation update with Playable Russia",
    ],
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
  console.log("   ERC-1155 NFTs enabled — token ID == listing ID");

  // 2. Seed polls
  console.log("\n🗳  Seeding polls...");
  for (const p of INITIAL_POLLS) {
    const tx = await exchange.createPoll(
      p.question, p.options, p.costGCH, p.endsAt
    );
    await tx.wait();
    console.log(`   ✔ "${p.question}" (${p.options.length} options)`);
  }

  // 3. Write env
  // Clear any existing VITE_ lines then append fresh values
  let existing = "";
  try { existing = fs.readFileSync(".env", "utf8"); } catch { /* no file yet */ }
  const cleaned = existing
    .split("\n")
    .filter((l) => !l.startsWith("VITE_CONTRACT_ADDRESS") && !l.startsWith("VITE_CHAIN_ID"))
    .join("\n")
    .trimEnd();
  fs.writeFileSync(".env", cleaned + `\nVITE_CONTRACT_ADDRESS=${address}\nVITE_CHAIN_ID=43113\n`);
  console.log("\n📝 Contract address written to .env");
  console.log("\n📋 Next steps:");
  console.log("   1. npm run build");
  console.log("   2. npx wrangler pages deploy dist --project-name gamechanger");
  console.log("   3. Set CONTRACT_ADDRESS secret in Cloudflare Pages dashboard");
  console.log("   4. Add listings via Admin → Listings panel");
}

main().catch((e) => { console.error(e); process.exit(1); });

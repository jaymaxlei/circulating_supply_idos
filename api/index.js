const { ethers } = require("ethers");
const vestingContracts = require("../vesting_contracts.json");

const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
const IDOS_TOKEN = "0x68731d6F14B827bBCfFbEBb62b19Daa18de1d79c";
const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

// Fixed wallets to deduct (treasury/staking/glacier)
const FIXED_WALLETS = [
  "0x03ed348892a88182e74d8e76e6f7529224032ed8", // Staking Y1-2
  "0xd7740bf4fbd6f7633aec11e51f9b8d7dd6c0ae40", // Staking Y3-6
  "0x21d91cedf2cf162c87f14ce988a04c35737f7e0d", // Staking Y7-10
  "0x6a553c044a6a113b01be52372e8d7bc94594bbe8", // Treasury
  "0xbCf2428b30A2EEc281a8da2EC93C93B499a7987b", // Glacier
];

const ERC20_BALANCE_OF = "0x70a08231"; // balanceOf(address)

function encodeBalanceOf(address) {
  return ERC20_BALANCE_OF + ethers.zeroPadValue(address, 32).slice(2);
}

const MULTICALL_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])",
];

async function batchBalances(provider, addresses, batchSize = 500) {
  const multicall = new ethers.Contract(MULTICALL3, MULTICALL_ABI, provider);
  let totalLocked = 0n;

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const calls = batch.map((addr) => ({
      target: IDOS_TOKEN,
      allowFailure: true,
      callData: encodeBalanceOf(addr),
    }));

    const results = await multicall.aggregate3.staticCall(calls);

    for (const result of results) {
      if (result.success && result.returnData !== "0x") {
        totalLocked += BigInt(result.returnData);
      }
    }
  }

  return totalLocked;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);

    // Combine all addresses to query
    const allAddresses = [...FIXED_WALLETS, ...vestingContracts];

    const totalLocked = await batchBalances(provider, allAddresses);

    const circulating = TOTAL_SUPPLY - totalLocked;
    const circulatingFormatted = Number(circulating / 10n ** 18n);

    res.status(200).send(circulatingFormatted.toString());
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Failed to compute circulating supply" });
  }
};

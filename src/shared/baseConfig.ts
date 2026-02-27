import { createWalletClient, http, publicActions, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import "dotenv/config";

// Fallback for local testing if env is missing
export const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

export const CHAIN = baseSepolia; // chainId = 84532

let personalPkRaw = process.env.PERSONAL_AGENT_PK;
let photoPkRaw = process.env.PHOTO_AGENT_PK;

// Helper to normalize PK
function normalizePk(pk: string | undefined): `0x${string}` | undefined {
  if (!pk) return undefined;
  if (pk.startsWith("0x")) return pk as `0x${string}`;
  // If 64 chars hex, prepend 0x
  if (/^[0-9a-fA-F]{64}$/.test(pk)) return `0x${pk}` as `0x${string}`;
  return undefined;
}

let personalPk = normalizePk(personalPkRaw);
let photoPk = normalizePk(photoPkRaw);

console.log(`Loaded Env: RPC=${BASE_SEPOLIA_RPC_URL}`);

if (!personalPk || !photoPk) {
  console.warn("Invalid or missing PKs in .env (must be 32-byte hex, with or without 0x). Generating ephemeral keys.");
  if (!personalPk) personalPk = generatePrivateKey();
  if (!photoPk) photoPk = generatePrivateKey();
}

const personalAccount = privateKeyToAccount(personalPk);
const photoAccount = privateKeyToAccount(photoPk);

console.log(`Personal Agent Address: ${personalAccount.address}`);
console.log(`Photo Agent Address: ${photoAccount.address}`);

export const personalAgentClient = createWalletClient({
  chain: CHAIN,
  transport: http(BASE_SEPOLIA_RPC_URL),
  account: personalAccount
}).extend(publicActions);

export const photoAgentClient = createWalletClient({
  chain: CHAIN,
  transport: http(BASE_SEPOLIA_RPC_URL),
  account: photoAccount
}).extend(publicActions);

export const PERSONAL_AGENT_ADDRESS = personalAccount.address;
export const PHOTO_AGENT_ADDRESS = photoAccount.address;

export async function payNative(toAddress: `0x${string}`, amountEth: string) {
  const value = parseEther(amountEth);
  const hash = await personalAgentClient.sendTransaction({
    to: toAddress,
    value
  });
  const receipt = await personalAgentClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

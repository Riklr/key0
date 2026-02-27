import express from "express";
import crypto from "crypto";
import {
  AgentCard,
  RequestPhotoAccess,
  X402Challenge,
  PaymentProof,
  AccessGranted
} from "../shared/types.js";
import { CHAIN, photoAgentClient, PHOTO_AGENT_ADDRESS } from "../shared/baseConfig.js";

const PHOTO_AGENT_ID = "photo-agent-1";
const PHOTO_AGENT_ENDPOINT = "http://localhost:4001/a2a/receive";

const challenges = new Map<string, X402Challenge>();
const paidChallenges = new Set<string>();
const apiKeys = new Map<
  string,
  { key: string; ownerAgentId: string; expiresAt: string; quotaPhotos: number }
>();

const app = express();
app.use(express.json());

app.get("/agent-card", (_req, res) => {
  console.log(`[PhotoAgent] Serving Agent Card...`);
  const card: AgentCard = {
    id: PHOTO_AGENT_ID,
    endpoint: PHOTO_AGENT_ENDPOINT,
    capabilities: ["requestPhotoAccess"],
    paymentPolicy: {
      explanation: "Pay per photo album access via Base Sepolia x402",
      chainId: CHAIN.id,
      acceptedAsset: "ETH",
      destination: PHOTO_AGENT_ADDRESS,
      basePriceEth: "0.001"
    }
  };
  res.json(card);
});

app.post("/a2a/receive", async (req, res) => {
  const msg = req.body as RequestPhotoAccess | PaymentProof;
  console.log(`[PhotoAgent] Received A2A message: ${msg.type}`);
  
  if (msg.type === "RequestPhotoAccess") {
    const response = await handleRequestPhotoAccess(msg);
    return res.json(response);
  }
  if (msg.type === "PaymentProof") {
    const response = await handlePaymentProof(msg);
    return res.json(response);
  }
  return res.status(400).json({ error: "Unsupported message type" });
});

async function handleRequestPhotoAccess(
  reqMsg: RequestPhotoAccess
): Promise<X402Challenge> {
  console.log(`[PhotoAgent] Processing RequestPhotoAccess (reqId=${reqMsg.requestId})...`);
  const challengeId = crypto.randomUUID();
  const amountEth = "0.001";

  const challenge: X402Challenge = {
    type: "X402Challenge",
    challengeId,
    requestId: reqMsg.requestId,
    amountEth,
    asset: "ETH",
    chainId: CHAIN.id,
    destination: PHOTO_AGENT_ADDRESS,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    description: `Access to album ${reqMsg.albumId} for up to ${reqMsg.maxPhotos} photos`
  };
  challenges.set(challengeId, challenge);
  
  console.log(`[PhotoAgent] Created Challenge: Pay ${amountEth} ETH to ${PHOTO_AGENT_ADDRESS}`);
  return challenge;
}

async function handlePaymentProof(
  proof: PaymentProof
): Promise<AccessGranted | { error: string }> {
  console.log(`[PhotoAgent] Verifying PaymentProof for Challenge ${proof.challengeId} (tx=${proof.txHash})...`);
  
  const challenge = challenges.get(proof.challengeId);
  if (!challenge) {
    console.error(`[PhotoAgent] Unknown Challenge ID: ${proof.challengeId}`);
    return { error: "Unknown challengeId" };
  }
  if (paidChallenges.has(proof.challengeId)) {
    console.error(`[PhotoAgent] Challenge already used!`);
    return { error: "Challenge already used" };
  }
  if (challenge.chainId !== proof.chainId) return { error: "Wrong chainId" };
  if (challenge.destination.toLowerCase() !== PHOTO_AGENT_ADDRESS.toLowerCase()) {
    return { error: "Destination mismatch" };
  }

  console.log(`[PhotoAgent] Checking Tx status on-chain...`);
  try {
    const receipt = await photoAgentClient.getTransactionReceipt({
      hash: proof.txHash as `0x${string}`
    });
    if (receipt.status !== "success") {
      console.error(`[PhotoAgent] Tx failed on-chain! Status: ${receipt.status}`);
      return { error: "Tx failed on chain" };
    }
    console.log(`[PhotoAgent] Tx Verified!`);
  } catch (err) {
    console.error(`[PhotoAgent] Error checking tx:`, err);
    return { error: "Failed to verify tx" };
  }

  // Optional: could also check value/from/to via getTransaction here

  paidChallenges.add(proof.challengeId);

  const apiKey = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const quotaPhotos = 500;

  apiKeys.set(apiKey, {
    key: apiKey,
    ownerAgentId: proof.fromAgentId,
    expiresAt,
    quotaPhotos
  });

  console.log(`[PhotoAgent] Issued API Key (masked): ${apiKey.substring(0, 6)}... for agent ${proof.fromAgentId}`);

  const resp: AccessGranted = {
    type: "AccessGranted",
    requestId: proof.requestId,
    apiKey,
    scopes: ["photos:read"],
    expiresAt,
    quotaPhotos
  };
  return resp;
}

app.get("/photos", (req, res) => {
  const auth = req.header("authorization") || "";
  const apiKey = auth.replace(/^Bearer\s+/i, "");
  console.log(`[PhotoAgent] /photos Request with key (masked): ${apiKey.substring(0, 6)}...`);
  
  const entry = apiKeys.get(apiKey);
  if (!entry) {
    console.warn(`[PhotoAgent] Invalid API Key attempt.`);
    return res.status(401).json({ error: "Invalid apiKey" });
  }
  if (new Date(entry.expiresAt) < new Date()) {
    console.warn(`[PhotoAgent] Expired API Key attempt.`);
    return res.status(402).json({ error: "API key expired" });
  }

  const photos = [
    { id: "p1", url: "https://example.test/photo1.jpg" },
    { id: "p2", url: "https://example.test/photo2.jpg" }
  ];
  console.log(`[PhotoAgent] Serving ${photos.length} photos.`);
  res.json({ photos });
});

app.listen(4001, () => {
  console.log("PhotoServiceAgent listening on :4001");
});

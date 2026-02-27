import express from "express";
import crypto from "crypto";
import axios from "axios";
import {
  AgentCard,
  RequestPhotoAccess,
  X402Challenge,
  PaymentProof,
  AccessGranted
} from "../shared/types.js";
import { CHAIN, payNative } from "../shared/baseConfig.js";

const PERSONAL_AGENT_ID = "personal-agent-1";
const PHOTO_AGENT_CARD_URL = "http://localhost:4001/agent-card";

const app = express();
app.use(express.json());

let photoApiKey: string | null = null;
let apiKeyMeta: AccessGranted | null = null;

function randomId() {
  return crypto.randomUUID();
}

app.post("/fetch-photos", async (req, res) => {
  console.log(`[PersonalAgent] Received request to fetch photos:`, req.body);
  try {
    const { albumId, maxPhotos } = req.body as {
      albumId: string;
      maxPhotos: number;
    };

    if (!photoApiKey) {
      console.log(`[PersonalAgent] No API key found. Discovering Photo Agent...`);
      const cardResp = await axios.get<AgentCard>(PHOTO_AGENT_CARD_URL);
      const photoCard = cardResp.data;
      console.log(`[PersonalAgent] Found Photo Agent at: ${photoCard.endpoint}`);

      const requestId = randomId();
      const reqMsg: RequestPhotoAccess = {
        type: "RequestPhotoAccess",
        requestId,
        fromAgentId: PERSONAL_AGENT_ID,
        albumId,
        maxPhotos
      };

      console.log(`[PersonalAgent] Sending RequestPhotoAccess (reqId=${requestId})...`);
      const challengeResp = await axios.post<X402Challenge>(photoCard.endpoint, reqMsg);
      const challenge = challengeResp.data;

      console.log(`[PersonalAgent] Received x402 Challenge: Pay ${challenge.amountEth} ${challenge.asset} to ${challenge.destination}`);

      if (challenge.chainId !== CHAIN.id) {
        return res.status(400).json({ error: "Challenge on wrong chain" });
      }

      console.log(`[PersonalAgent] Paying on Base Sepolia...`);
      const payment = await payNative(
        challenge.destination as `0x${string}`,
        challenge.amountEth
      );
      console.log(`[PersonalAgent] Payment sent! Hash: ${payment.hash}`);

      const proof: PaymentProof = {
        type: "PaymentProof",
        challengeId: challenge.challengeId,
        requestId,
        chainId: CHAIN.id,
        txHash: payment.hash,
        amountEth: challenge.amountEth,
        asset: challenge.asset,
        fromAgentId: PERSONAL_AGENT_ID
      };

      console.log(`[PersonalAgent] Sending PaymentProof...`);
      const accessResp = await axios.post<AccessGranted | { error: string }>(
        photoCard.endpoint,
        proof
      );
      if ("error" in accessResp.data) {
        console.error(`[PersonalAgent] Payment proof rejected:`, accessResp.data.error);
        return res.status(400).json(accessResp.data);
      }
      
      const granted = accessResp.data as AccessGranted;
      photoApiKey = granted.apiKey;
      apiKeyMeta = granted;
      console.log(`[PersonalAgent] Access Granted! Received API Key (masked): ${photoApiKey.substring(0, 6)}...`);
    } else {
      console.log(`[PersonalAgent] Using cached API key (masked): ${photoApiKey.substring(0, 6)}...`);
    }

    console.log(`[PersonalAgent] Fetching photos from protected API...`);
    const photosResp = await axios.get("http://localhost:4001/photos", {
      headers: { Authorization: `Bearer ${photoApiKey}` }
    });
    console.log(`[PersonalAgent] Successfully fetched ${photosResp.data.photos.length} photos.`);

    return res.json({
      usedApiKeyMeta: apiKeyMeta,
      photos: photosResp.data.photos
    });
  } catch (err: any) {
    console.error(`[PersonalAgent] Error:`, err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
});

app.post("/a2a/receive", (_req, res) => {
  return res.json({ ok: true });
});

app.listen(4000, () => {
  console.log("PersonalAgent listening on :4000");
});

import express from "express";
import { agentGateRouter, validateAccessToken } from "@agentgate/sdk/express";
import { X402Adapter } from "@agentgate/sdk";
import type { AccessGrant, NetworkName } from "@agentgate/sdk";

const PORT = Number(process.env["PORT"] ?? 3000);
const PUBLIC_URL = process.env["PUBLIC_URL"] ?? `http://localhost:${PORT}`;
const NETWORK = (process.env["AGENTGATE_NETWORK"] ?? "testnet") as NetworkName;
const WALLET = (process.env["AGENTGATE_WALLET_ADDRESS"] ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const SECRET =
  process.env["AGENTGATE_ACCESS_TOKEN_SECRET"] ??
  "dev-secret-change-me-in-production-32chars!";

const app = express();
app.use(express.json());

// Create the x402 payment adapter
const adapter = new X402Adapter({
  network: NETWORK,
  rpcUrl: process.env["AGENTGATE_RPC_URL"],
});

// Mount AgentGate — serves agent card + A2A endpoint
app.use(
  agentGateRouter({
    config: {
      agentName: "Photo Gallery Agent",
      agentDescription:
        "Purchase access to premium photos via USDC payments on Base",
      agentUrl: PUBLIC_URL,
      providerName: "Example Corp",
      providerUrl: "https://example.com",
      walletAddress: WALLET,
      network: NETWORK,
      accessTokenSecret: SECRET,
      accessTokenTTLSeconds: 3600,
      challengeTTLSeconds: 900,
      products: [
        {
          tierId: "single-photo",
          label: "Single Photo",
          amount: "$0.10",
          resourceType: "photo",
          accessDurationSeconds: 3600,
        },
        {
          tierId: "full-album",
          label: "Full Album Access",
          amount: "$1.00",
          resourceType: "album",
          accessDurationSeconds: 86400,
        },
      ],
      onVerifyResource: async (resourceId: string, _tierId: string) => {
        // In a real app, check your database here
        const validResources = ["photo-1", "photo-2", "photo-3", "album-1"];
        return validResources.includes(resourceId);
      },
      onPaymentReceived: async (grant: AccessGrant) => {
        console.log(
          `[Payment] Received payment for ${grant.resourceId} (${grant.tierId})`,
        );
        console.log(`  TX: ${grant.explorerUrl}`);
      },
      resourceEndpointTemplate: `${PUBLIC_URL}/api/photos/{resourceId}`,
      basePath: "/agent",
    },
    adapter,
  }),
);

// BEFORE (traditional session/API key middleware):
// app.use("/api", async (req, res, next) => {
//   const apiKey = req.headers["x-api-key"];           // or Authorization: Bearer <sessionToken>
//   const user = await db.apiKeys.findOne({ key: apiKey }); // DB lookup on every request
//   if (!user) return res.status(401).json({ error: "Unauthorized" });
//   req.userId = user.id;
//   next();
// });
//
// Problems with the above for agent traffic:
//   - Agents cannot sign up, verify email, or generate API keys autonomously
//   - Every request hits your database for token validation
//   - No payment is attached — you can't monetize per-call or per-resource
//
// NOW — AgentGate replaces all of the above with validateAccessToken.
// On every request to /api it checks:
//   1. Authorization: Bearer <token> header is present and well-formed
//   2. JWT signature is valid — signed with AGENTGATE_ACCESS_TOKEN_SECRET (no DB hit)
//   3. Token is not expired (exp claim; TTL set per tier in products config)
//   4. Decodes payload and attaches to req.agentGateToken:
//        { resourceId, tierId, txHash, sub (requestId), jti (challengeId), iat, exp }
//   5. Calls next() — your route handler runs
//   6. If anything fails → 401 Unauthorized, route is never reached
app.use(
  "/api",
  validateAccessToken({ secret: SECRET }),
);

// Sample protected endpoint
app.get("/api/photos/:id", (req, res) => {
  // After validateAccessToken runs, req.agentGateToken contains the decoded JWT payload:
  //   { resourceId, tierId, txHash, sub (requestId), jti (challengeId), iat, exp }
  //
  // BEFORE: you'd check req.userId against a DB record to confirm the caller owns this resource.
  // NOW — optionally enforce that the token was issued for exactly this resource:
  //   const token = (req as Request & { agentGateToken?: { resourceId: string } }).agentGateToken;
  //   if (token?.resourceId !== req.params["id"]) {
  //     return res.status(403).json({ error: "Token not issued for this resource" });
  //   }
  const photoId = req.params["id"];
  res.json({
    id: photoId,
    url: `https://cdn.example.com/photos/${photoId}.jpg`,
    title: `Premium Photo ${photoId}`,
    resolution: "4K",
  });
});

app.listen(PORT, () => {
  console.log(`\nPhoto Gallery Agent running on ${PUBLIC_URL}`);
  console.log(`  Agent card: ${PUBLIC_URL}/.well-known/agent.json`);
  console.log(`  A2A endpoint: ${PUBLIC_URL}/agent`);
  console.log(`  Network: ${NETWORK}`);
  console.log(`  Wallet: ${WALLET}\n`);
});

/**
 * Minimal client agent demonstrating the full AgentGate flow:
 *
 *   1. Discover agent card
 *   2. Request access (receive payment challenge)
 *   3. (In production: pay on-chain)
 *   4. Submit payment proof
 *   5. Use the access token to call protected API
 *
 * Usage:
 *   1. Start the express-seller example: cd ../express-seller && bun run start
 *   2. Run this agent: bun run start
 */

import type { AgentCard, X402Challenge, AccessGrant } from "@agentgate/types";

const SELLER_URL = process.env["SELLER_URL"] ?? "http://localhost:3000";

async function main() {
  console.log("=== AgentGate Client Agent ===\n");

  // Step 1: Discover the agent card
  console.log("1. Discovering agent card...");
  const cardRes = await fetch(`${SELLER_URL}/.well-known/agent.json`);
  const card: AgentCard = await cardRes.json();
  console.log(`   Agent: ${card.name}`);
  console.log(`   Skills: ${card.skills.map((s) => s.id).join(", ")}`);
  console.log(`   Payment protocols: ${card.capabilities.paymentProtocols.join(", ")}`);

  const requestSkill = card.skills.find((s) => s.id === "request-access");
  if (!requestSkill?.pricing?.[0]) {
    console.error("   No pricing found on request-access skill");
    process.exit(1);
  }

  const tier = requestSkill.pricing[0];
  console.log(`   Tier: ${tier.label} — ${tier.amount} USDC on chain ${tier.chainId}\n`);

  // Step 2: Request access
  console.log("2. Requesting access...");
  const requestId = crypto.randomUUID();
  const basePath = "/agent"; // default A2A endpoint

  const accessRes = await fetch(`${SELLER_URL}${basePath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method: "tasks/send",
      params: {
        id: "task-1",
        message: {
          role: "user",
          parts: [
            {
              type: "data",
              data: {
                type: "AccessRequest",
                requestId,
                resourceId: "photo-1",
                tierId: tier.tierId,
                clientAgentId: "agent://example-client",
              },
              mimeType: "application/json",
            },
          ],
        },
      },
    }),
  });

  const accessBody = await accessRes.json();
  const challenge: X402Challenge =
    accessBody.result.status.message.parts[0].data;

  console.log(`   Challenge ID: ${challenge.challengeId}`);
  console.log(`   Amount: ${challenge.amount} USDC`);
  console.log(`   Chain: ${challenge.chainId}`);
  console.log(`   Destination: ${challenge.destination}`);
  console.log(`   Expires: ${challenge.expiresAt}\n`);

  // Step 3: Pay on-chain
  console.log("3. Payment step (simulated)...");
  console.log("   In production, the client agent would:");
  console.log(`   - Transfer ${challenge.amount} USDC to ${challenge.destination}`);
  console.log(`   - On chain ${challenge.chainId}`);
  console.log(`   - Wait for transaction confirmation`);
  console.log(`   - Get the txHash from the receipt\n`);

  // For this demo, we'll submit a mock txHash
  // The seller's MockPaymentAdapter (if used) would accept it
  // With a real X402Adapter, this would fail verification
  const mockTxHash = `0x${"ab".repeat(32)}`;

  // Step 4: Submit payment proof
  console.log("4. Submitting payment proof...");
  const proofRes = await fetch(`${SELLER_URL}${basePath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "2",
      method: "tasks/send",
      params: {
        id: "task-2",
        message: {
          role: "user",
          parts: [
            {
              type: "data",
              data: {
                type: "PaymentProof",
                challengeId: challenge.challengeId,
                requestId,
                chainId: challenge.chainId,
                txHash: mockTxHash,
                amount: challenge.amount,
                asset: "USDC",
                fromAgentId: "agent://example-client",
              },
              mimeType: "application/json",
            },
          ],
        },
      },
    }),
  });

  const proofBody = await proofRes.json();

  if (proofBody.result?.status?.state === "failed") {
    console.log("   Payment verification failed (expected with mock txHash + real adapter)");
    console.log(`   Error: ${JSON.stringify(proofBody.result.status.message)}\n`);
    console.log("=== Flow complete (proof submission demonstrated) ===");
    return;
  }

  const grant: AccessGrant = proofBody.result.status.message.parts[0].data;
  console.log(`   Access granted!`);
  console.log(`   Token type: ${grant.tokenType}`);
  console.log(`   Expires: ${grant.expiresAt}`);
  console.log(`   Resource endpoint: ${grant.resourceEndpoint}`);
  console.log(`   Explorer: ${grant.explorerUrl}\n`);

  // Step 5: Use the access token
  console.log("5. Calling protected API...");
  const apiRes = await fetch(grant.resourceEndpoint, {
    headers: {
      Authorization: `${grant.tokenType} ${grant.accessToken}`,
    },
  });

  if (apiRes.ok) {
    const data = await apiRes.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
  } else {
    const err = await apiRes.json();
    console.log(`   Error: ${JSON.stringify(err)}\n`);
  }

  console.log("=== Flow complete ===");
}

main().catch(console.error);

export type AgentCard = {
  id: string;
  endpoint: string;
  capabilities: string[];
  paymentPolicy?: {
    explanation: string;
    chainId: number;
    acceptedAsset: string;
    destination: string;
    basePriceEth: string;
  };
};

export type RequestPhotoAccess = {
  type: "RequestPhotoAccess";
  requestId: string;
  fromAgentId: string;
  albumId: string;
  maxPhotos: number;
};

export type X402Challenge = {
  type: "X402Challenge";
  challengeId: string;
  requestId: string;
  amountEth: string;
  asset: string;
  chainId: number;
  destination: string;
  expiresAt: string;
  description: string;
};

export type PaymentProof = {
  type: "PaymentProof";
  challengeId: string;
  requestId: string;
  chainId: number;
  txHash: string;
  amountEth: string;
  asset: string;
  fromAgentId: string;
};

export type AccessGranted = {
  type: "AccessGranted";
  requestId: string;
  apiKey: string;
  scopes: string[];
  expiresAt: string;
  quotaPhotos: number;
};

export type A2AIncoming =
  | RequestPhotoAccess
  | X402Challenge
  | PaymentProof
  | AccessGranted;


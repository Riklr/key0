# A2A + x402 Base Sepolia Demo

This project demonstrates a Personal Agent paying a Photo Service Agent via x402 on Base Sepolia to access a protected photo API.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment**:
    Create a `.env` file in the root directory:
    ```bash
    BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
    # Funded wallet (Payer)
    PERSONAL_AGENT_PK=0x...
    # Payee wallet
    PHOTO_AGENT_PK=0x...
    ```

3.  **Fund your Personal Agent**:
    Ensure `PERSONAL_AGENT_PK` account has Base Sepolia ETH (get from a faucet).

## Running the Demo

1.  **Start the Photo Service Agent** (Provider):
    ```bash
    npm run dev:photo
    # Runs on http://localhost:4001
    ```

2.  **Start the Personal Agent** (Consumer):
    ```bash
    npm run dev:personal
    # Runs on http://localhost:4000
    ```

3.  **Trigger the Flow**:
    ```bash
    curl -X POST http://localhost:4000/fetch-photos \
      -H "Content-Type: application/json" \
      -d '{"albumId":"vacation-2025","maxPhotos":5}'
    ```

## Flow Overview

1.  **Personal Agent** requests photo access via A2A.
2.  **Photo Agent** responds with an **x402 Challenge** (Payment Required: 0.001 ETH).
3.  **Personal Agent** pays 0.001 ETH on **Base Sepolia**.
4.  **Personal Agent** sends a **Payment Proof** (tx hash) to Photo Agent.
5.  **Photo Agent** verifies the tx on-chain, issues an **API Key**, and grants access.
6.  **Personal Agent** downloads the photos using the API Key.

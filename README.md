# Troca Pix Bridge: Escrow & ZK Verification

A trustless, privacy-preserving off-ramp for DAOs to send and receive payments via Brazil’s Pix network using on-chain escrows and zero-knowledge proofs.

---

## Overview

Troca seeks to facilitate payments between DAOs/protocols and real world entities with privacy and confidence.

This system enables:

- **DAO → Pix (Inbound):** DAOs lock stablecoins in an escrow, then a node executes a Pix payment off-chain. A ZK proof ties that Pix to the on-chain intent without revealing recipient keys, amounts, or txids.
- **Pix → DAO (Outbound):** Off-chain Pix senders generate a proof of payment to the DAO’s escrow, unlocking stablecoins back on-chain without exposing private details.

DAOs can send stablecoins to Troca escrow, where an intent is signed and triggers a payment through an offchain gateway, the details of this payment are then hashed/signed over and used to generate a ZK proof. Once the proof is validated on chain, the escrow closes the payment as successful. If no ZK proof is provided by our payment gateway within 1 week, the stablecoins are refunded to the sender. This removes the need for a DAO to have a corporate entity, bank accounts, and a trusted offchain spender to access traditional services. ZK guarantees that these payments are provable without exposing all details of the payment.

Alternatively, someone using a traditional payment method can send funds to our escrow account off-chain which then gets proven by a ZK proof to have actually occurred. Using our circuits, a user can prove on chain that a payment was made to our gateway off chain and can be redeemed for stables on chain.

For the current demo, we use Brazil's Pix payment system. This choice is because the Pix API is open and standard among banking instutions and works very well for internal payments. Pix has incredibly wide adoption within Brazil. For services and work, Brazil has a large labor pool and service sector that can now be engaged by DAOs without the roadblocks mentioned above.

The ultimate idea of this concept is to show how we can use blockchain infrastructure as building blocks for payment gateways. This design creates modular payment provider plugins that become interoperable through stablecoins. Think of Paypal USD payment finalizing in a WeChat RMB near instantly.

### Repo

Smart contracts are located in the `/contracts` directory
Noir Circuits are located in the `/circuits` directory

---

## Problem Statement

1. **DAO Off-Ramps:**
   DAOs cannot directly pay fiat-only vendors, hires, or charities.
2. **Privacy Requirements:**
   Pix details (recipient chave, txid, amounts) must remain confidential on-chain.
3. **Custodial Risks & Fees:**
   Traditional remitters introduce counterparty risk and high spreads.

---

## Solution Architecture

- **Escrow Contract:** Manages intents, on-chain funds, proof verification, time-locked refunds.
- **Pix Node (Server):** Orchestrates off-chain Pix calls, proof generation, and on-chain proof submission.
- **ZK Circuits:** Verify signatures and payload hashes for inbound & outbound flows. This is both done locally and on chain

---

## How To Use Troca

### For DAOs looking to send payments off-chain

- DAO approves Escrow contract as a USDC spender
- A DAO member initates a transaction to be executed by the DAO, calling the `intendPayment()` function on the escrow
- DAO sends funds to escrow and signer is delegated to pass a signature off-chain to our node
- The delegated signer signs an intent, designating a recipient in the form of a Pix chave (like a username, phone number, email, etc) to finish the payment off-chain
- Our node receives this signature and checks escrow for the funds, makes a Pix payment to the privately passed recipient
- Proof that the Pix API has recorded this payment gets passed to a ZK circuit, generates a proof
- This ZK proof of payment gets recorded on-chain by our node, finalizing the payment

### For Pix users looking to pay DAOs

## Smart Contract: `TrocaEscrow`

### Key State & Roles

| Role          | Permissions                                |
| ------------- | ------------------------------------------ |
| **DAO**       | `intendPayment` (inbound), `refundInbound` |
| **Initiator** | `registerOutboundIntent`, `refundOutbound` |
| **Node**      | `executeInbound`, `executeOutbound`        |

### Inbound Flow (DAO → Pix)

1. **intendPayment(signer, asset, amount)**

   - Pulls `amount` of `asset` from `msg.sender` into escrow.
   - Records `InboundIntent{ dao, signer, asset, amount, timestamp }`.
   - Emits `InboundRegistered(intentId, …)`.

2. **executeInbound(intentId, proof, publicInputs)** _(onlyNode)_

   - Verifies ZK proof via `inboundVerifier.verify`.
   - Marks intent closed and emits `InboundExecuted(intentId, node)`.

3. **refundInbound(intentId)** _(DAO after 1 week)_

   - If not closed and timed out, refunds `amount` back to DAO.
   - Emits `InboundRefunded(intentId, dao)`.

### Outbound Flow (Pix → DAO)

1. **registerOutboundIntent(asset, amount, recipient, payloadHash)**

   - Ensures escrow has sufficient balance.
   - Records `OutboundIntent{ initiator, asset, amount, recipient, payloadHash, timestamp }`.
   - Emits `OutboundRegistered(intentId, …)`.

2. **executeOutbound(intentId, proof, publicInputs)** _(onlyNode)_

   - Verifies ZK proof via `outboundVerifier.verify`.
   - Transfers `amount` of `asset` to `recipient`.
   - Marks intent closed and emits `OutboundExecuted(intentId, node)`.

3. **refundOutbound(intentId)** _(Initiator after 1 week)_

   - If not closed and timed out, refunds `amount` to initiator.
   - Emits `OutboundRefunded(intentId, initiator)`.

---

## ZK Circuits

### Inbound Circuit

- **Private Inputs**

  - `signature [u8;64]`: user’s ECDSA signature over intent payload
  - `txid_hash_bytes [u8;32]`
  - `chave_hash_bytes [u8;32]`
  - `amount_bytes [u8;8]`
  - `intent_id_bytes [u8;32]`

- **Public Inputs**

  - `signing_sender_x/y [u8;32]`: signer’s public key coordinates
  - `payload_hash [u8;32]`: keccak(txid_hash ∥ chave_hash ∥ amount_bytes)

- **Proves**

  1. Recomputes `payload_hash` from private inputs.
  2. Validates `signature` was produced by `signing_sender`.
  3. Links on-chain `intent_id` to off-chain Pix data.

### Outbound Circuit

- **Private Inputs**

  - `signature [u8;64]`: node’s ECDSA signature over outbound payload
  - `txid_bytes [u8;32]`
  - `chave_bytes [u8;32]`
  - `amount_bytes [u8;8]`
  - `nonce_bytes [u8;8]`

- **Public Inputs**

  - `payload_hash [u8;32]`: keccak(txid ∥ recipient ∥ amount ∥ nonce)
  - `recipient_bytes [u8;32]`

- **Proves**

  1. Recreates outbound `payload_hash` and compares to public input.
  2. Verifies node’s `signature` over that payload hash.
  3. Ensures only valid Pix payments unlock DAO funds.

---

## Server Integration: Inbound Controller

The `/send-inbound-pix` endpoint:

1. **Read Escrow State:**

   - Fetch `inboundNonces[signer]`, intent status, and expected amount.

2. **Sign Intent:**

   - Build `intentBytes = intentId ∥ keccak(chave) ∥ amountBytes`.
   - Recover or generate ECDSA `signature` over `intentHash`.

3. **Execute Pix:**

   - Call Inter’s Pix API; poll until status = `CONCLUIDA`/`PAGO`.

4. **Prepare ZK Inputs:**

   - Derive `payloadHash = keccak(txidHash ∥ chaveHash ∥ amountBytes)`.
   - Extract `signerPubX/Y` from recovered public key.
   - Assemble circuit inputs as per inbound circuit spec.

5. **Submit Proof On-Chain:**

   - Call `executeInbound(intentId, proof, publicInputs)` on `TrocaEscrow`.

---

## Getting Started

### Configuration

Create `.env`:

```
ESCROW_CONTRACT_ADDRESS=0x...
INBOUND_VERIFIER_ADDRESS=0x...
OUTBOUND_VERIFIER_ADDRESS=0x...
```

## Next Steps

- **Circuit Integration Tests:** Validate edge cases on-chain & off-chain.
- **Verifier Audits:** Formal review of ZK proof verifiers.
- **Outbound Server Flow:** Mirror inbound logic for Pix→DAO.
- **SDK & CLI:** Simplify integration for DAOs and Pix nodes.

---

use std::ecdsa_secp256k1::verify_signature;
use std::hash::keccak256;

fn main(
    // PRIVATE INPUTS
    signature: [u8; 64], // r (32 bytes) || s (32 bytes)
    txid_bytes: [u8; 32],
    chave_bytes: [u8; 32],
    amount_bytes: [u8; 8],
    nonce_bytes: [u8; 8],
    // PUBLIC INPUTS
    signing_sender: pub [u8; 32], // Ethereum-style address (last 20 bytes used for EVM compatibility)
    payload_hash: pub [u8; 32],
    commitment_hash: pub [u8; 32],
) {
    // ===================================================
    // Recreate the payload the user signed
    // (txid || chave || amount)
    // ===================================================
    let mut payload: [u8; 72] = [0; 72];
    for i in 0..32 {
        payload[i] = txid_bytes[i];
    }
    for i in 0..32 {
        payload[32 + i] = chave_bytes[i];
    }
    for i in 0..8 {
        payload[64 + i] = amount_bytes[i];
    }

    let computed_payload_hash = keccak256(payload, 72);
    assert(computed_payload_hash == payload_hash);

    // ===================================================
    // Verify the signature: payload_hash was signed by signing_sender
    // ===================================================
    let is_valid = verify_signature(signature, payload_hash, signing_sender);
    assert(is_valid);

    // ===================================================
    // Check recipient commitment hash: keccak256(chave || amount)
    // ===================================================
    let mut commitment_data: [u8; 40] = [0; 40];
    for i in 0..32 {
        commitment_data[i] = chave_bytes[i];
    }
    for i in 0..8 {
        commitment_data[32 + i] = amount_bytes[i];
    }

    let computed_commitment_hash = keccak256(commitment_data, 40);
    assert(computed_commitment_hash == commitment_hash);
}

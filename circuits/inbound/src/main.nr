use std::ecdsa_secp256k1::verify_signature;
use std::hash::keccak256;

fn main(
    // PRIVATE INPUTS
    signature: [u8; 64], // r (32 bytes) || s (32 bytes)
    txid_bytes: [u8; 32], //CHANGE TO txid_hash_bytes
    chave_bytes: [u8; 32], //CHANGE TO chave_hash_bytes
    amount_bytes: [u8; 8],
    nonce_bytes: [u8; 8],
    // PUBLIC INPUTS
    signing_sender_x: pub [u8; 32], // Ethereum-style address (last 20 bytes used for EVM compatibility)
    signing_sender_y: pub [u8; 32], // Ethereum-style address (last 20 bytes used for EVM compatibility)
    payload_hash: pub [u8; 32],
) {
    // ===================================================
    // Recreate the payload the user signed
    // (txid || chave || amount)
    // ===================================================
    // MAKE THE INTENT HASH (NONCE + CHAVE + AMOUNT)
    let mut intent_bytes: [u8; 48] = [0; 48];
    let mut payload: [u8; 72] = [0; 72];
    for i in 0..8 {
        intent_bytes[i] = nonce_bytes[i];
    }
    for i in 0..32 {
        payload[i] = txid_bytes[i];
    }
    for i in 0..32 {
        payload[32 + i] = chave_bytes[i];
        intent_bytes[8 + i] = chave_bytes[i];
    }
    for i in 0..8 {
        payload[64 + i] = amount_bytes[i];
        intent_bytes[40 + i] = amount_bytes[i];
    }

    let computed_payload_hash = keccak256(payload, 72);
    assert(computed_payload_hash == payload_hash);

    // ===================================================
    // Verify the signature: the intent was signed by signing_sender (using parts x and y)
    // ===================================================
    let intent_hash: [u8; 32] = keccak256(intent_bytes, 48);
    let is_valid = verify_signature(signing_sender_x, signing_sender_y, signature, intent_hash);
    assert(is_valid);
}

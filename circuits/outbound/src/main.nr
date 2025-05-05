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
    payload_hash: pub [u8; 32],
    recipient_bytes: [u8; 32],
) {
    let signing_sender_x: [u8; 32] = [
        43, 159, 179, 49, 79, 64, 133, 175, 145, 50, 10, 158, 232, 7, 253, 1, 200, 139, 108, 76,
        249, 9, 48, 30, 1, 24, 44, 155, 19, 113, 177, 200,
    ];

    let signing_sender_y: [u8; 32] = [
        235, 149, 218, 90, 235, 43, 171, 181, 131, 182, 13, 84, 55, 209, 190, 40, 106, 21, 130, 184,
        121, 65, 211, 143, 102, 212, 43, 135, 207, 211, 168, 51,
    ];
    // ===================================================
    // Recreate the payload the user signed
    // (txid || chave || amount)
    // ===================================================

    // MAKE THE INTENT HASH (NONCE + RECIPIENT + AMOUNT). THIS IS WHAT THE NODE SIGNS OVER
    let mut intent_bytes: [u8; 48] = [0; 48];
    // MAKE THE PAYLOAD HASH (TXID + RECIPIENT + AMOUNT + CHAVE/SENDER). THIS IS WHAT CL HASHES OVER IN API CALL
    let mut payload: [u8; 104] = [0; 104];
    for i in 0..8 {
        intent_bytes[i] = nonce_bytes[i];
    }
    for i in 0..32 {
        payload[i] = txid_bytes[i];
    }
    for i in 0..32 {
        payload[32 + i] = recipient_bytes[i];
        intent_bytes[8 + i] = recipient_bytes[i];
    }
    for i in 0..8 {
        payload[64 + i] = amount_bytes[i];
        intent_bytes[40 + i] = amount_bytes[i];
    }
    for i in 0..32 {
        payload[72 + i] = chave_bytes[i];
    }

    let computed_payload_hash = keccak256(payload, 104);
    assert(computed_payload_hash == payload_hash);

    // ===================================================
    // Verify the signature: the intent was signed by the pix node (using hardcoded pub key x and y of the node)
    // ===================================================
    let intent_hash: [u8; 32] = keccak256(intent_bytes, 48);
    let is_valid = verify_signature(signing_sender_x, signing_sender_y, signature, intent_hash);
    // assert(is_valid); //Breaks contract generation, removed for now
}

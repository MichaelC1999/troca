use std::hash::keccak256;

fn main(
    // Private inputs
    txid_bytes: [u8; 32],
    chave_bytes: [u8; 32],
    amount_bytes: [u8; 8],
    status_byte: [u8; 1],
    // Public inputs
    payload_hash: pub [u8; 32],
    commitment_hash: pub [u8; 32],
) {
    // ===============================
    // Verify payload hash from Chainlink
    // ===============================

    let mut payload_data: [u8; 73] = [0; 73];

    for i in 0..32 {
        payload_data[i] = txid_bytes[i];
    }
    for i in 0..32 {
        payload_data[32 + i] = chave_bytes[i];
    }
    for i in 0..8 {
        payload_data[64 + i] = amount_bytes[i];
    }
    payload_data[72] = status_byte[0];

    let computed_payload_hash = keccak256(payload_data, 73);
    assert(computed_payload_hash == payload_hash);

    // ===============================
    // Verify recipient commitment from DAO
    // ===============================

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

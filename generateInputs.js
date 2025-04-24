import { keccak256, toBytes, hexToBytes, bytesToHex } from 'viem'

/**
 * Converts a UTF-8 string to a keccak256 hash, sliced to 32 bytes.
 */
function hashStringToBytes32(input) {
  const hash = keccak256(toBytes(input))
  return Array.from(hexToBytes(hash)) // returns Uint8Array → number[]
}

/**
 * Converts a u64 number to an 8-byte big-endian array.
 */
function numberToU64Bytes(amount) {
  const buf = new Array(8).fill(0)
  let value = BigInt(amount)
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return buf
}

/**
 * Generates the inputs for Prover.toml, including commitment and payload hashes.
 */
function generateZKPixInputs({
  txid,
  chave,
  amount,
  status = 1,
}) {
  const txid_bytes = hashStringToBytes32(txid)
  const chave_bytes = hashStringToBytes32(chave)
  const amount_bytes = numberToU64Bytes(amount)
  const status_byte = [status]

  // === Payload Hash: keccak256(txid + chave + amount + status)
  const payload_input = new Uint8Array([
    ...txid_bytes,
    ...chave_bytes,
    ...amount_bytes,
    ...status_byte,
  ])
  const payload_hash = Array.from(hexToBytes(keccak256(payload_input)))

  // === Commitment Hash: keccak256(chave + amount)
  const commitment_input = new Uint8Array([
    ...chave_bytes,
    ...amount_bytes,
  ])
  const commitment_hash = Array.from(hexToBytes(keccak256(commitment_input)))

  return {
    txid_bytes,
    chave_bytes,
    amount_bytes,
    status_byte,
    payload_hash,
    commitment_hash,
  }
}

// Example usage
console.log(
  generateZKPixInputs({
    txid: '0x123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123a',
    chave: 'mikec5083@gmail.com',
    amount: 20000000,
    status: 1,
  })
)

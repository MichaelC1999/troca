import { Router } from 'express'
import { generateOutboundProof } from '../noir'
import { recoverAddress, keccak256, toBytes, hexToBytes, decodeAbiParameters, parseAbiParameters, recoverPublicKey, encodeAbiParameters } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

function numberToU64Bytes(amount: any) {
  const buf = new Array(8).fill(0)
  let value = BigInt(amount)
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return buf
}

const router = Router()

const PK  = process.env.PRIVATE_KEY as any


router.post('/receive-outbound-pix', async (req: any, res: any) => {
    // -User sends a pix to our chave with a memo (recipient, order id)
    // -Front end generates a proof of the payload hash
    // -----ROUTE LOGIC STARTS HERE--------
    // -Pix node webhook receives the pix, reads the payload
    // -Pix node generates signature over payload
    // -Node generates proof of the payload hash and the signature
    // -----ROUTE LOGIC ENDS HERE--------
    // -CL function brings payload hash and verifications on chain
    // -Escrow transfers to the recipient 


  // Get values from body
  const { senderChave, recipientData, txid, amount } = req.body

  const nonce = 0n

  if (!senderChave || !recipientData || !txid || !amount || nonce == null)
    return res.status(400).json({ error: 'Missing required fields' })

  // Hash the payload
      // MAKE THE PAYLOAD HASH (TXID + RECIPIENT + AMOUNT + CHAVE/SENDER). THIS IS WHAT CL HASHES OVER IN API CALL

  const encodedPayload = encodeAbiParameters(
    parseAbiParameters('bytes32 txid, string recipientData, uint256 amount, string senderChave'),
    [txid, recipientData, amount, senderChave]
  )

  const payloadBytes = toBytes(encodedPayload)
  const payloadHash = keccak256(payloadBytes)

  // Hash the payload
  const encodedIntent = encodeAbiParameters(
    parseAbiParameters('uint256 nonce, string intendedRecipient, uint256 amount'),
    [nonce, recipientData, amount]
  )

  const intentBytes = toBytes(encodedIntent)
  const intent_hash = keccak256(intentBytes)

  // Sign with node key

  const nodeAccount = privateKeyToAccount(PK)
  const signature = await nodeAccount.signMessage({ message: { raw: intent_hash } })

  // Prepare bytes
  const signatureBytes = Array.from(hexToBytes(signature))
  const txidBytes = Array.from(hexToBytes(txid))
  const chaveBytes = Array.from(hexToBytes(senderChave))
  const amountBytes = numberToU64Bytes(amount)
  const nonceBytes = numberToU64Bytes(nonce)

  const payloadHashBytes = Array.from(hexToBytes(payloadHash))
  const recipientBytes = Array.from(toBytes(recipientData))

  // Prepare circuit inputs
  const circuitInputs = {
    // PRIVATE
    signature: signatureBytes,
    chave_bytes: chaveBytes,
    amount_bytes: amountBytes,
    txid_bytes: txidBytes,
    nonce_bytes: nonceBytes,
    // PUBLIC
    payload_hash: payloadHashBytes,
    recipient_bytes: recipientBytes
  }

  const { proof } = await generateOutboundProof(circuitInputs)

  return res.json({ txid, senderChave, recipientData, amount, nonce, payloadHash, signature, proof })
})
export default router

import { Router } from 'express'
import { generateOutboundProof } from '../noir'
import { recoverAddress, keccak256, toBytes, hexToBytes, decodeAbiParameters, parseAbiParameters, recoverPublicKey, encodeAbiParameters, stringToHex, concat, bytesToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { checkPixReceived, checkPixSent } from '../pix'

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
  const receivedStatus =  await checkPixSent(txid)

  const nonce = 0n

  if (!senderChave || !recipientData || !txid || !amount || nonce == null)
    return res.status(400).json({ error: 'Missing required fields' })

  // Hash the payload
      // MAKE THE PAYLOAD HASH (TXID + RECIPIENT + AMOUNT + CHAVE/SENDER). THIS IS WHAT CL HASHES OVER IN API CALL


  // Build manually
  const payloadtxidBytes = hexToBytes(keccak256(stringToHex(txid)))
  const payloadchaveBytes = hexToBytes(keccak256(stringToHex(recipientData)))
  const payloadamountBytes = numberToU64Bytes(amount)
  const payloadsenderBytes = hexToBytes(keccak256(stringToHex(senderChave)))

  const payload: any = concat([
    payloadtxidBytes,      // 32 bytes
    payloadchaveBytes,     // 32 bytes
    payloadamountBytes ,    // 8 bytes
    payloadsenderBytes
  ] as any)

    const payloadHash = keccak256(payload)
    const payloadHashBytes = Array.from(hexToBytes(payloadHash))

    const intentBytes: any = concat([
        numberToU64Bytes(nonce) as any,    // 8 bytes
        hexToBytes(keccak256(toBytes(recipientData))),    // 32 bytes
        numberToU64Bytes(amount)    // 8 bytes
      ])
    const intent_hash = keccak256(intentBytes)

  // Sign with node key

  const nodeAccount = privateKeyToAccount(PK)
  const intentSignature = await nodeAccount.signMessage({ message: { raw: intent_hash } })

  // Prepare bytes
  
  const signatureBytes = Array.from(hexToBytes(intentSignature)).slice(0,64)
  const txidBytes = Array.from(payloadtxidBytes)
  const recipientBytes = Array.from(payloadchaveBytes)
  const senderBytes = Array.from(payloadsenderBytes)
    
  const nonceBytes = numberToU64Bytes(nonce)
  const amountBytes = numberToU64Bytes(amount)

  // Prepare circuit inputs
  const circuitInputs = {
    // PRIVATE
    signature: signatureBytes,
    chave_bytes: senderBytes,
    amount_bytes: amountBytes,
    txid_bytes: txidBytes,
    nonce_bytes: nonceBytes,
    // PUBLIC
    payload_hash: payloadHashBytes,
    recipient_bytes: recipientBytes
  }

  console.log(circuitInputs)

    let signerPub
    try {
      signerPub = await recoverPublicKey({
        hash: intent_hash,
        signature: intentSignature,
      })
    } catch (err) {
      return res.status(400).json({ error: 'Invalid signature - could not recover public key' })
    }

  const { proof } = await generateOutboundProof(circuitInputs)

  return res.json({ txid, senderChave, recipientData, amount: Number(amount), nonce: Number(nonce), payloadHash, signature: intentSignature, proof: bytesToHex(proof) })
})
export default router

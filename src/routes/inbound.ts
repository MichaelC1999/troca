import { Router } from 'express'
import { generateInboundProof } from '../noir'
import { recoverAddress, keccak256, toBytes, hexToBytes, decodeAbiParameters, parseAbiParameters, recoverPublicKey, encodeAbiParameters } from 'viem'
import { sendPix, checkPixSent } from '../pix'
import db from '../db'

function numberToU64Bytes(amount) {
  const buf = new Array(8).fill(0)
  let value = BigInt(amount)
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return buf
}

const router = Router()

router.post('/send-inbound-pix', async (req, res) => {
    // -Stablecoins are transfered to the escrow thru intendPayment(intentsigner,amount) which transfers assets from msg.sender, increments signer's nonce and adds signer => nonce => amount mapping
  // -Signing User signs over intent and sends this to the pix node
  // -----ROUTE LOGIC STARTS HERE--------
  // -Pix node sends pix 
  // -pix node generates proof over the intent
  // -----ROUTE LOGIC ENDS HERE--------
  // -CL function brings hash of the payload and proof verification on chain
  // -On chain escrow closes the intent as finalized



  // RATE LIMIT ON THE SIGNATURE SENDER 
  
  // MAKE READ CALL TO OUR ESCROW CONTRACT FOR THE SIGNER INTENT NONCE + WHETHER THIS NONCE HAS FINALIZED + THE NONCE AMOUNT 
  // 

  //intentHex is the data of the intent specifying the sender's nonce, the pix recipient, and the pix amount. Signature signs over a hash of this data
  const { signature, intentHex } = req.body

  if (!signature || !intentHex)
    return res.status(400).json({ error: 'Missing signature or payload' })

  // Step 1: Hash the payload that was originally signed
  const intentBytes = toBytes(intentHex)
  const intentHash = keccak256(intentBytes)

  // Step 2: Recover signer address from signature and hash
  let signerAddress
  try {
    signerAddress = await recoverAddress({
      hash: intentHash,
      signature,
    })
  } catch (err) {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  let signerPub
  try {
    signerPub = await recoverPublicKey({
      hash: intentHash,
      signature,
    })
  } catch (err) {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const pubkeyBytes = signerPub.slice(1) // remove 0x04 prefix
  const pub_key_x = pubkeyBytes.slice(0, 32)
  const pub_key_y = pubkeyBytes.slice(32, 64)

  // Step 3: Decode payload into components (uint256 nonce, string intendedRecipient, uint256 amount)
  let nonce, intendedRecipient, amount
  try {
    const decoded = decodeAbiParameters(
      parseAbiParameters('uint256 nonce, string intendedRecipient, uint256 amount'),
      intentBytes
    )
    nonce = decoded[0]
    intendedRecipient = decoded[1]
    amount = decoded[2]
  } catch (err) {
    return res.status(400).json({ error: 'Unable to decode payload' })
  }

  // -------------- ESCROW VERIFICATION (READ) ----------------
  // (1) Get escrow nonce for signer
  // (2) Check if finalized
  // (3) Verify amount (optional depending on design)
  // await readEscrowState(signerAddress, nonce)

  // -------------- SEND PIX ----------------
  const pixChave = intendedRecipient
  const { txid } = await sendPix(pixChave, amount)

  // Wait for it to finalize
  let statusData
  do {
    await new Promise(r => setTimeout(r, 2000))
    statusData = await checkPixSent(txid)
  } while (statusData.status !== 'CONCLUIDA')

  // -------- ZK INPUT PREP -------------


  // Create and hash the assumed payload to be confirmed from CL function
  const encodedPayload = encodeAbiParameters(
    parseAbiParameters('bytes32 txid, bytes32 recipientChave, uint256 amount'),
    [txid, amount, pixChave]
  )
  const payloadBytes = toBytes(encodedPayload)
  const payloadHash = keccak256(payloadBytes)
  const payloadHashBytes = Array.from(hexToBytes(payloadHash))

  const signatureBytes = Array.from(hexToBytes(signature))
  const txidBytes = Array.from(hexToBytes(txid))
  const chaveBytes = Array.from(hexToBytes(pixChave))
  const signerPubX = Array.from(hexToBytes(pub_key_x))
  const signerPubY = Array.from(hexToBytes(pub_key_y))


  const nonceBytes = numberToU64Bytes(nonce)
  const amountBytes = numberToU64Bytes(amount)

  // === Noir-compatible circuit inputs ===
  const circuitInputs = {
    //PRIVATE
    signature: signatureBytes,
    chave_bytes: chaveBytes,
    amount_bytes: amountBytes,
    txid_bytes: txidBytes,
    nonce_bytes: nonceBytes,
    //PUBLIC
    payload_hash: payloadHashBytes,
    signing_sender_x: signerPubX,
    signing_sender_y: signerPubY
  }
  // -------- GENERATE PROOF ----------
  const { proof } = await generateInboundProof(circuitInputs)


  // -------- STORE + RETURN ----------
  // db.prepare(
  //   `INSERT INTO proofs (id, type, public_inputs_json, proof_json)
  //    VALUES (?, 'inbound', ?, ?)`
  // ).run(
  //   txid,
  //   JSON.stringify(public_signals),
  //   JSON.stringify(proof),
  // )

  return res.json({ txid, signerAddress, nonce, intendedRecipient, amount, proof })
})
export default router

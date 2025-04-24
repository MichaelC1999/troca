import { Router } from 'express'
import { generateProof } from '../noir'
import { recoverAddress, keccak256, toBytes, hexToBytes, decodeAbiParameters, parseAbiParameters } from 'viem'
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

router.post('/create-proof', async (req, res) => {
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

  const { signature, payloadHex } = req.body

  if (!signature || !payloadHex)
    return res.status(400).json({ error: 'Missing signature or payload' })

  // Step 1: Hash the payload that was originally signed
  const payloadBytes = toBytes(payloadHex)
  const payloadHash = keccak256(payloadBytes)

  // Step 2: Recover signer address from signature and hash
  let signerAddress
  try {
    signerAddress = await recoverAddress({
      hash: payloadHash,
      signature,
    })
  } catch (err) {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  // Step 3: Decode payload into components (uint256 nonce, string intent, uint256 amount)
  let nonce, intent, amount
  try {
    const decoded = decodeAbiParameters(
      parseAbiParameters('uint256 nonce, string intent, uint256 amount'),
      payloadBytes
    )
    nonce = decoded[0]
    intent = decoded[1]
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
  const pixChave = intent
  const { txid } = await sendPix(pixChave, amount)

  // Wait for it to finalize
  let statusData
  do {
    await new Promise(r => setTimeout(r, 2000))
    statusData = await checkPixSent(txid)
  } while (statusData.status !== 'CONCLUIDA')

  // -------- ZK INPUT PREP -------------

  // (public: {signingSenderAddress, payloadHash}, private: {signature, nonce, chave, amount, txid})

  const signatureBytes = Array.from(hexToBytes(signature))
  const payloadHashBytes = Array.from(hexToBytes(payloadHash))
  const txidBytes = Array.from(hexToBytes(txid))
  const chaveBytes = Array.from(hexToBytes(pixChave))
  const signerBytes = Array.from(hexToBytes(signerAddress))



  const nonceBytes = numberToU64Bytes(nonce)
  const amountBytes = numberToU64Bytes(amount)

  // === Noir-compatible circuit inputs ===
  const circuitInputs = {
    signature: signatureBytes,
    nonce_bytes: nonceBytes,
    chave_bytes: chaveBytes,
    amount_bytes: amountBytes,
    txid_bytes: txidBytes,
    payload_hash: payloadHashBytes,
    signing_sender: signerBytes,
  }
  // -------- GENERATE PROOF ----------
  const { proof } = await generateProof(circuitInputs)


  // -------- STORE + RETURN ----------
  // db.prepare(
  //   `INSERT INTO proofs (id, type, public_inputs_json, proof_json)
  //    VALUES (?, 'inbound', ?, ?)`
  // ).run(
  //   txid,
  //   JSON.stringify(public_signals),
  //   JSON.stringify(proof),
  // )

  return res.json({ txid, signerAddress, nonce, intent, amount, proof })
})
export default router

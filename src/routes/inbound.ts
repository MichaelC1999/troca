import { Router } from 'express'
import { generateInboundProof, verifyInbound } from '../noir'
import { recoverAddress, keccak256, toBytes, hexToBytes, decodeAbiParameters, parseAbiParameters, recoverPublicKey, encodeAbiParameters, recoverMessageAddress, stringToHex, concat, bytesToHex, createWalletClient, http, Address, webSocket, createPublicClient } from 'viem'
import { sendPixInbound, checkPixSent } from '../pix'
import dotenv from 'dotenv'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

dotenv.config()

function numberToU64Bytes(amount: any) {
  const buf = new Array(8).fill(0)
  let value = BigInt(amount)
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return buf
}

const PK  = process.env.PRIVATE_KEY as any
const router = Router()

router.post('/send-inbound-pix', async (req: any, res: any) => {
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
  // const { signature, intentHex } = req.body

    const recipientChavePix = req.body.chave
    const intentId = req.body.intentId
    const amount = req.body.amount
    let intentSignature = req.body.signature

  const intentBytes: any = concat([
    hexToBytes(intentId) as any,
    hexToBytes(keccak256(toBytes(recipientChavePix))),    // 32 bytes
    numberToU64Bytes(amount)    // 8 bytes
  ])

    const intentHash = keccak256(intentBytes)
    const nodeAccount = privateKeyToAccount(PK)
    if (!intentSignature) {
      intentSignature = await nodeAccount.signMessage({ message: {raw: intentHash} })
    }
  
  //***************************************************************************** */



  if (!intentSignature || !bytesToHex(intentBytes)) {
    return res.status(400).json({ error: 'Missing signature or payload' })
  }

  // Step 2: Recover signer address from signature and hash
  let signerAddress
  try {
    signerAddress = await recoverMessageAddress({
      message: { raw: intentHash },
      signature: intentSignature,
    })
  } catch (err) {
    console.log('NO SIGNATURE')
    return res.status(400).json({ error: 'Invalid signature - could not recover address' })
  }

  let signerPub
  try {
    signerPub = await recoverPublicKey({
      hash: keccak256(intentHash),
      signature: intentSignature,
    })
  } catch (err) {
    return res.status(400).json({ error: 'Invalid signature - could not recover public key' })
  }

  console.log(signerAddress, signerPub)

  // -------------- ESCROW VERIFICATION (READ) ----------------
  // (1) Get escrow nonce for signer
  // (2) Check if finalized
  // (3) Verify amount (optional depending on design)
  // await readEscrowState(signerAddress, nonce)

  // -------------- SEND PIX ----------------
  console.log(recipientChavePix, Number(amount))
  const pixData = await sendPixInbound({chavePix: recipientChavePix,valor: Number(amount)})
  // Wait for it to finalize
  if (!pixData || (pixData.tipoRetorno !== "PROCESSADO"  && pixData.tipoRetorno !== "APROVADO")) {
    console.log(pixData)
    return res.status(400).json({ error: 'Pix not sent' })
  }

  let statusData
  do {
    await new Promise(r => setTimeout(r, 2000))
    statusData = await checkPixSent(pixData.codigoSolicitacao)
  } while (statusData.status !== 'CONCLUIDA' && statusData.status !== 'PAGO')

  // -------- ZK INPUT PREP -------------


// Build manually
const payloadtxidBytes = hexToBytes(keccak256(stringToHex(pixData.codigoSolicitacao)))
const payloadchaveBytes = hexToBytes(keccak256(stringToHex(recipientChavePix)))
const payloadamountBytes = numberToU64Bytes(amount)

const payload: any = concat([
  payloadtxidBytes,      // 32 bytes
  payloadchaveBytes,     // 32 bytes
  payloadamountBytes     // 8 bytes
] as any)

  const payloadHash = keccak256(payload)
  const payloadHashBytes = Array.from(hexToBytes(payloadHash))

  const signatureBytes = Array.from(hexToBytes(intentSignature)).slice(0,64)
  const txidBytes = Array.from(payloadtxidBytes)
  const chaveBytes = Array.from(payloadchaveBytes)
  const intentIdBytes = Array.from(hexToBytes(intentId))
  
  const pubkeyBytes = signerPub.slice(4) // remove 0x04 prefix
  const pub_key_x = '0x' + pubkeyBytes.slice(0, 64)
  const pub_key_y = '0x' + pubkeyBytes.slice(64)
  const signerPubX = Array.from(hexToBytes(pub_key_x as any))
  const signerPubY = Array.from(hexToBytes(pub_key_y as any))


  const amountBytes = numberToU64Bytes(amount)

  // === Noir-compatible circuit inputs ===
  const circuitInputs = {
    //PRIVATE
    signature: signatureBytes,
    chave_hash_bytes: chaveBytes,
    amount_bytes: amountBytes,
    txid_hash_bytes: txidBytes,
    intent_id_bytes: intentIdBytes,
    //PUBLIC
    payload_hash: payloadHashBytes,
    signing_sender_x: signerPubX,
    signing_sender_y: signerPubY
  }
  console.log(circuitInputs)
  // -------- GENERATE PROOF ----------
  const {proof, publicInputs}: any = await generateInboundProof(circuitInputs)
  await verifyInbound(proof, publicInputs)
  // -------- STORE + RETURN ----------
  // db.prepare(
  //   `INSERT INTO proofs (id, type, public_inputs_json, proof_json)
  //    VALUES (?, 'inbound', ?, ?)`
  // ).run(
  //   txid,
  //   JSON.stringify(public_signals),
  //   JSON.stringify(proof),
  // )

  const escrowAddress = process.env.ESCROW_ADDRESS

  const escrowABI = [{
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "intentId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "proof",
        "type": "bytes"
      },
      {
        "internalType": "bytes32[]",
        "name": "publicInputs",
        "type": "bytes32[]"
      }
    ],
    "name": "executeInbound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }]

  const wallet = createWalletClient({
    account: nodeAccount,
    chain: sepolia,
    transport: webSocket("wss://sepolia.infura.io/ws/v3/" + process.env.INFURA),

  });


  const executeInboundFinality = await wallet.writeContract({
    abi: escrowABI,
    functionName: "executeInbound",
    args: [intentId, bytesToHex(proof), publicInputs],
    address: escrowAddress as Address,
    gas: 15000000n
  })

  console.log('INBOUND FINALITY?', executeInboundFinality)




  

  return res.json({ txid: pixData.codigoSolicitacao, signerAddress, signerPubX: pub_key_x, signerPubY: pub_key_y, intendedRecipient: recipientChavePix, payloadHash, amount: Number(amount) })
})
export default router

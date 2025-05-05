// src/noir.ts
import { Noir } from "@noir-lang/noir_js";
import { splitHonkProof, UltraHonkBackend } from "@aztec/bb.js";
import fs from 'fs'
import path from 'path'

// assumes this file lives at e.g. project-root/src/server.js



// 1) Load your client key and cert (and optional CA bundle)
const circuitJsonDir = path.join(__dirname, '..', 'target')

const inboundPath  = path.join(circuitJsonDir, 'zkpix_inbound.json')
const outboundPath = path.join(circuitJsonDir, 'zkpix_outbound.json')
const inbound_circuit  = JSON.parse(fs.readFileSync(inboundPath, 'utf8'))
const outbound_circuit = JSON.parse(fs.readFileSync(outboundPath, 'utf8'))

// point this at whatever JSON your .nr compiler outputs
// import inbound_circuit from "../circuits/inbound/target/zkpix_inbound.json";
// import outbound_circuit from "../circuits/outbound/target/zkpix_outbound.json";

// 1) Instantiate your circuit once
const noirInbound = new Noir(inbound_circuit);
// 2) Create the Aztec Groth16 backend
const backendInbound = new UltraHonkBackend(inbound_circuit.bytecode);


// 1) Instantiate your circuit once
const noirOutbound = new Noir(outbound_circuit);
// 2) Create the Aztec Groth16 backend
const backendOutbound = new UltraHonkBackend(outbound_circuit.bytecode);

/**
 * Generate a ZK proof for your Pix‐transfer circuit.
 *
 * @param inputs  An object matching your .nr schema
 * @returns       The proof object and publicSignals array
 */
export async function generateInboundProof(inputs: Record<string, any>) {
  // a) run the circuit to get the witness & public signals
  const { witness } = await noirInbound.execute(inputs);

  // b) generate a Groth16 proof from that witness
  const rawProofData = await backendInbound.generateProof(witness, { keccak: true });
  
  // const proofNoPub = (splitHonkProof(rawProofData.proof, rawProofData.publicInputs.length)).proof

  return {proof:rawProofData.proof, publicInputs: rawProofData.publicInputs};
}


/**
 * Generate a ZK proof for your Pix‐transfer circuit.
 *
 * @param inputs  An object matching your .nr schema
 * @returns       The proof object and publicSignals array
 */
export async function generateOutboundProof(inputs: Record<string, any>) {
  // a) run the circuit to get the witness & public signals
  const { witness } = await noirOutbound.execute(inputs);

  // b) generate a Groth16 proof from that witness
  const proof = await backendOutbound.generateProof(witness);

  return proof;
}

export async function verifyInbound(proof: any, pubs: any[]) {
  const verified = await backendInbound.verifyProof({proof, publicInputs: pubs}, { keccak: true })
  console.log('verified?', verified)
}
// src/noir.ts
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
// point this at whatever JSON your .nr compiler outputs
import inbound_circuit from "../circuits/inbound/target/zkpix_inbound.json" assert { type: "json" };
import outbound_circuit from "../circuits/outbound/target/zkpix_outbound.json" assert { type: "json" };

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
  const proof = await backendInbound.generateProof(witness);

  return { proof };
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

  return { proof };
}
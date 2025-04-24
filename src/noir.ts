// src/noir.ts
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
// point this at whatever JSON your .nr compiler outputs
import circuit from "../circuits/inbound/target/zkpix_inbound.json" assert { type: "json" };

// 1) Instantiate your circuit once
const noir = new Noir(circuit);
// 2) Create the Aztec Groth16 backend
const backend = new UltraHonkBackend(circuit.bytecode);

/**
 * Generate a ZK proof for your Pix‐transfer circuit.
 *
 * @param inputs  An object matching your .nr schema
 * @returns       The proof object and publicSignals array
 */
export async function generateProof(inputs: Record<string, any>) {
  // a) run the circuit to get the witness & public signals
  const { witness } = await noir.execute(inputs);

  // b) generate a Groth16 proof from that witness
  const proof = await backend.generateProof(witness);

  return { proof };
}
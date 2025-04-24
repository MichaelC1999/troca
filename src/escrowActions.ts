import { createPublicClient, createWalletClient, encodeFunctionData, http } from 'viem'
import { mainnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import usdcAbi from './abis/erc20.json'  // just the ERC20 fragment

const RPC = process.env.RPC_URL!
const PK  = process.env.PRIVATE_KEY!

export const publicClient = createPublicClient({ chain: mainnet, transport: http(RPC) })
export const walletClient = createWalletClient({
  chain: mainnet,
  transport: http(RPC),
  account: privateKeyToAccount(PK),
})

/** transfer USDC */
export async function transferUSDC(to: string, amount: bigint) {
  const tx = await walletClient.sendTransaction({
    to: process.env.USDC_ADDRESS!,
    data: encodeFunctionData({
      abi: usdcAbi,
      functionName: 'transfer',
      args: [to, amount],
    })
  })
  // wait for inclusion
  await publicClient.waitForTransactionReceipt({ hash: tx })
  return tx
}

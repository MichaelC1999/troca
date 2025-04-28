import { Address, createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, zeroAddress } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const RPC = process.env.RPC_URL!
const PK  = process.env.PRIVATE_KEY as any

export const publicClient = createPublicClient({ chain: sepolia, transport: http(sepolia.rpcUrls.default.http[0]) })
export const walletClient = createWalletClient({
  chain: mainnet,
  transport: http(RPC),
  account: privateKeyToAccount(PK),
})

/** transfer USDC */
export async function transferUSDC(to: Address, amount: bigint) {
  const tx = await walletClient.sendTransaction({
    to: zeroAddress as Address,
    data: encodeFunctionData({
      abi: parseAbi(['function transfer(address rec, uint256 a) external']),
      functionName: 'transfer',
      args: [to, amount],
    })
  })
  // wait for inclusion
  await publicClient.waitForTransactionReceipt({ hash: tx })
  return tx
}

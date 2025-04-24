import { Router } from 'express'
import { transferUSDC } from '../web3'

const router = Router()

router.post('/transfer', async (req, res) => {
  const { to, amount } = req.body   // amount as string or bigint
  const txHash = await transferUSDC(to, BigInt(amount))
  res.json({ txHash })
})

export default router

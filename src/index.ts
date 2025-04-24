import express from 'express'
import dotenv from 'dotenv'
import inboundRouter from './routes/inbound.ts'
import stablecoinRouter from './routes/stablecoin.ts'
import './db'      // initialize SQLite tables

dotenv.config()

const app = express()
app.use(express.json())

// mount routers
app.use('/inbound', inboundRouter)
app.use('/stablecoin', stablecoinRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 zkPix backend listening on http://localhost:${PORT}`)
})
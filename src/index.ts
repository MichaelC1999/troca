import express from 'express'
import inboundRouter from './routes/inbound'
import outboundRouter from './routes/outbound'
import stablecoinRouter from './routes/stablecoin'
// import './db.ts'      // initialize SQLite tables
import cors from 'cors'

import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// mount routers
app.use('/inbound', inboundRouter)
app.use('/outbound', outboundRouter)

app.use('/stablecoin', stablecoinRouter)

const PORT = process.env.PORT || 2000
app.listen(PORT, () => {
  console.log(`🚀 zkPix backend listening on http://localhost:${PORT}`)
})
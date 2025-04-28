import express from 'express'
import inboundRouter from './routes/inbound'
import stablecoinRouter from './routes/stablecoin'
// import './db.ts'      // initialize SQLite tables
import dotenv from 'dotenv'

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
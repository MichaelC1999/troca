import axios from 'axios'
import dotenv from 'dotenv'
import https from 'https'
import fs from 'fs'
import path from 'path'

// assumes this file lives at e.g. project-root/src/server.js


dotenv.config()

//
// —————————————————————————————————————————
//  TOKEN SERVICE (in-memory state + expiry)
// —————————————————————————————————————————
//
let interToken = ""              // current bearer token
let tokenExpiresAt = 0           // ms-since-epoch when it expires

/**
 * Returns a valid token, refreshing if missing or expired.
 */
async function getInterToken(): Promise<string> {
  // refresh 1 minute before actual expiry
  if (!interToken || Date.now() > tokenExpiresAt - 60_000) {
    const { token, expiresIn } = await refreshInterTokens()
    interToken = token
    tokenExpiresAt = Date.now() + expiresIn * 1000
  }
  return interToken
}

/**
 * Calls your OAuth endpoint to fetch a new token + TTL.
 */
export async function refreshInterTokens(): Promise<{ token: string; expiresIn: number }> {
  const clientId = process.env.INTER_CLIENT_ID || ""
  const clientSecret = process.env.INTER_CLIENT_SECRET || ""
  const params = new URLSearchParams({
    'client_id': clientId,
    'client_secret': clientSecret,
    'scope': 'cob.read pix.read cob.write pagamento-pix.write pagamento-pix.read pix.write',
    'grant_type': 'client_credentials' 
  })

  const config = {
    httpsAgent,
    method: 'post' as const,
    url: 'https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token',

    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data:    params,
  }

  const res = await axios(config)
  const data = res.data
  const token     = data.access_token || data.accessToken
  const expiresIn = data.expires_in   || data.expiresIn

  return { token, expiresIn }
}

//
// —————————————————————————————————————————
//  HTTPS AGENT + CREDENTIALS (unchanged)
// —————————————————————————————————————————
//
const credentialsDir = path.join(__dirname, '..', 'src/credentials')
const key  = fs.readFileSync(path.join(credentialsDir, 'InterAPI_Chave.key'))
const cert = fs.readFileSync(path.join(credentialsDir, 'InterAPI_Chave.crt'))

const httpsAgent = new https.Agent({
  key,
  cert,
  rejectUnauthorized: true,
})

//
// —————————————————————————————————————————
//  HEADER BUILDER (always uses getInterToken)
// —————————————————————————————————————————
//
const BASE_HEADERS = async () => {
  const token = await getInterToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}  
  // 1. Send Pix to a recipient using their Pix key
  export async function sendPixInbound({
    chavePix,
    valor,
    attemptCount = 0
  }: any) {
    
    const data = {
      "valor": valor,
      "destinatario": {
        "tipo": "CHAVE",
        "chave": chavePix
      }
    };
    const config = {
      httpsAgent,
      method: 'post',
      url: 'https://cdpj-sandbox.partners.uatinter.co/banking/v2/pix',
      headers: await BASE_HEADERS(),
      data : data
    };
    try {
      const resp = await axios(config)
      return resp.data
    } catch (e: any) {
      if (e?.status == 401 && attemptCount === 0) {
        await refreshInterTokens()
        return await sendPixInbound({chavePix, valor, attemptCount: 1})
      } 
      console.log('err data', e?.message)
      return {}
    }
  }

export async function checkPixSent(codigoSolicitacao: any) {
    const url = `https://cdpj-sandbox.partners.uatinter.co/banking/v2/pix/${codigoSolicitacao}`
    const headers = await BASE_HEADERS()
    const config = {
      httpsAgent,
      method: 'get',
      url,
      headers
      
    };
  
    const response = await axios(config)
    return response.data.transacaoPix // includes status, endToEnd, valor, etc.
  }
  
  // 3. Chainlink-compatible: Check if a Pix was received by node using e2eId
  export async function checkPixReceived({
    e2eId,
  }: any) {
    const url = `https://cdpj-sandbox.partners.uatinter.co/pix/v2/pix/${e2eId}`
    const headers = await BASE_HEADERS()
  
    const response = await axios.get(url, { headers })
    return response.data // includes recebedor, valor, status, dataHoraMovimento, etc.
  }

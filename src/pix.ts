import axios from 'axios'

const INTER_BASE = process.env.INTER_API_URL!
const INTER_TOKEN = process.env.INTER_API_TOKEN!

const BASE_HEADERS = (accessToken) => ({
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  })
  
  // 1. Send Pix to a recipient using their Pix key
  export async function sendPixInbound({
    accessToken,
    chavePix,
    valor,
    descricao,
    dataPagamento, // optional
  }) {
    const url = 'https://cdpj-sandbox.partners.uatinter.co/banking/v2/pix'
  
    const body = {
      chavePix: {
        valor,
        descricao,
        dataPagamento: dataPagamento || new Date().toISOString().split('T')[0],
        destinatario: { chave: chavePix },
      },
    }
  
    const headers = BASE_HEADERS(accessToken, )
    const response = await axios.post(url, body, { headers })
    return response.data 
    // {
        // "tipoRetorno": "APROVACAO",
        // "codigoSolicitacao": "c42f0787-02cb-4b31-827e-459ec9d7ece1",
        // "dataPagamento": "2022-03-15",
        // "dataOperacao": "2022-03-15"
        // }
  }

// check Pix status
// 2. Chainlink-compatible: Check if Pix was sent by node using codigoSolicitacao
export async function checkPixSent({
    accessToken,
    codigoSolicitacao,
  }) {
    const url = `https://cdpj-sandbox.partners.uatinter.co/banking/v2/pix/${codigoSolicitacao}`
    const headers = BASE_HEADERS(accessToken, )
  
    const response = await axios.get(url, { headers })
    return response.data.transacaoPix // includes status, endToEnd, valor, etc.
  }
  
  // 3. Chainlink-compatible: Check if a Pix was received by node using e2eId
  export async function checkPixReceived({
    accessToken,
    e2eId,
  }) {
    const url = `https://cdpj-sandbox.partners.uatinter.co/pix/v2/pix/${e2eId}`
    const headers = BASE_HEADERS(accessToken, )
  
    const response = await axios.get(url, { headers })
    return response.data // includes recebedor, valor, status, dataHoraMovimento, etc.
  }

// checkPixSent.js
const { accessToken, codigoSolicitacao } = args

const response = await Functions.makeHttpRequest({
  url: `https://cdpj-sandbox.partners.uatinter.co/banking/v2/pix/${codigoSolicitacao}`,
  method: "GET",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
})

if (!response || response.error) {
  throw Error("Request failed or errored")
}

const tx = response.data.transacaoPix

return Functions.encodeString(
  JSON.stringify({
    status: tx.status,
    valor: tx.valor,
    e2eId: tx.endToEnd,
  })
)

// Arguments: [e2eId]
const [e2eId] = args;
const accessToken = secrets.accessToken;

const response = await Functions.makeHttpRequest({
  url: `https://cdpj-sandbox.partners.uatinter.co/pix/v2/pix/${e2eId}`,
  method: "GET",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  }
});

if (response.error) {
  throw Error(`Request failed: ${response.error}`);
}

const data = response.data;

// Extract necessary fields
const e2eIdValue = data.endToEndId;
const amount = data.valor;
const senderKey = data.chavePagador;
const memo = data.infoPagador || "";

// Concatenate fields
const concatenatedData = `${e2eIdValue}|${amount}|${senderKey}|${memo}`;

// Compute keccak256 hash
const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(concatenatedData));

return Functions.encodeString(hash);
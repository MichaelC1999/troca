// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/functions/contracts/dev/0.8/FunctionsClient.sol";
import "@chainlink/functions/contracts/dev/0.8/FunctionsRequest.sol";

contract PixVerifier is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public latestRequestId;
    bytes public latestResponse;
    bytes public latestError;

    constructor(address oracle) FunctionsClient(oracle) {}

    // Verify Pix Sent
    function verifyPixSent(string memory codigoSolicitacao) public {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(
            // JavaScript code as a string
            "const [codigoSolicitacao] = args; const accessToken = secrets.accessToken; const response = await Functions.makeHttpRequest({ url: `https://cdpj-sandbox.partners.uatinter.co/banking/v2/pix/${codigoSolicitacao}`, method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }); if (response.error) { throw Error(`Request failed: ${response.error}`); } return Functions.encodeString(JSON.stringify(response.data));"
        );
        req.addArgs([codigoSolicitacao]);
        latestRequestId = sendRequest(req.encode(), 100000);
    }

    // Verify Pix Received
    function verifyPixReceived(string memory e2eId) public {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(
            // JavaScript code as a string
            "const [e2eId] = args; const accessToken = secrets.accessToken; const response = await Functions.makeHttpRequest({ url: `https://cdpj-sandbox.partners.uatinter.co/pix/v2/pix/${e2eId}`, method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }); if (response.error) { throw Error(`Request failed: ${response.error}`); } const data = response.data; const e2eIdValue = data.endToEndId; const amount = data.valor; const senderKey = data.chavePagador; const memo = data.infoPagador || ''; const concatenatedData = `${e2eIdValue}|${amount}|${senderKey}|${memo}`; const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(concatenatedData)); return Functions.encodeString(hash);"
        );
        req.addArgs([e2eId]);
        latestRequestId = sendRequest(req.encode(), 100000);
    }

    // Handle the response
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        latestRequestId = requestId;
        latestResponse = response;
        latestError = err;
    }
}

function getMethodOuputs(abi, methodName) {
  for (const { name, outputs } of abi) {
    if (name === methodName) {
      return outputs;
    }
  }

  throw new Error("Method not found");
}

function decodeMethodReturn(web3, abi, methodName, returnValue) {
  if (returnValue === "0x") {
    throw new Error("Invalid hex data to decode")
  }
  
  const outputs = getMethodOuputs(abi, methodName);
  const result = web3.eth.abi.decodeParameters(outputs, returnValue);

  if (result.__length__ === 1) {
    return result[0];
  }

  delete result.__length__;
  return result;
}

exports.decodeMethodReturn = decodeMethodReturn;

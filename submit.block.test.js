const Web3 = require("web3");

const config = require("./config.json");

const NETWORK = "goerli";
// const NETWORK = "ganache";

const web3 = new Web3(config[NETWORK]["rpc"]);

/**
 * Check web3 connection
 */
async function checkConnection() {
  // Longtime no see - Couldn't find isConnected fn
  return web3.eth.getBlockNumber();
}

function decodeSubmitBlockData(data) {
  const fnSignature = "0x6a791f11";
  data = "0x" + data.split(fnSignature)[1];
  const result = web3.eth.abi.decodeParameters(["bytes", "bytes"], data);
  const dataParameters = [
    "address",
    "uint256",
    "uint256",
    "bytes32",
    "bytes32",
    "uint256",
  ];
  const blockData = web3.eth.abi.decodeParameters(dataParameters, result["0"]);

  return {
    proposer: blockData["0"],
    start: blockData["1"],
    end: blockData["2"],
    rootHash: blockData["3"],
    accountHash: blockData["4"],
    borChainID: blockData["5"],
  };
}

// Invoke this on start
async function test() {
  const blockNumber = await checkConnection();
  if (!blockNumber) {
    console.log("Connection failed ...");
    return;
  }

  // https://goerli.etherscan.io/tx/0x5ed3e1e5c46685ab227d9ce1a21e34d0a9bf6e30cec169a555659d65a922fb1a
  const data =
    "0x6a791f110000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000be188d6641e8b680743a4815dfa0f6208038960f0000000000000000000000000000000000000000000000000000000000168d000000000000000000000000000000000000000000000000000000000000168dff29a999b8d35ffdd5aed6b72a7898ca9d718f40614e9d1b89f2a6557d2e52921d1a2c704cdd05b1da028e06f6e0bfe0d914798e671b436237c2c05fadd363fe8f00000000000000000000000000000000000000000000000000000000000138810000000000000000000000000000000000000000000000000000000000000145a555a65620dac214532407c6d3e79d00407945ddcb4930f86f75980ca018ddb24b65884f344fbdc84e68b4d5c717769cc38e0f5433c1896b6774408f966d82cc01770ef4b67a99f2e436b4fed3a67d3d90d160ef8ec073ac63e8081ce868c7b3a4028493a6642e87a9f0366bf4af943586f9af8c45600d87fd6d8a177374f974d300d6f10d9ca9e3eef88294511e0eed67e3ad6925056eb0fbab8be57cb32cd5a3e31e33fa6b831dd2ebdee685d20f2ce83d2bed5dd80664450b6b1a43bcc8138b6601306bb4ae8f2ec8afea071d20d9c7a6af2169936c4c9fa54321cabd3206ec93cc7c26262fb4bb18a82932a6a36d481ba1e56a85478df8f0283fd0cff7259fd3f8013ba365e70e414b022c8674746865610ea29e6b309fe32bada65041146087229e528cfb91d778680a0d03aeac707094b5eacb2cddb789572c1442f844dc80a59001000000000000000000000000000000000000000000000000000000";
  const { proposer } = decodeSubmitBlockData(data);
  console.log("Proposer Address: ", proposer);
}

test();

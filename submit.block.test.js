const Web3 = require("web3");

const stakingManagerABI = require("./abi/stakingManagerABI.json");
const validatorShareABI = require("./abi/validatorShareABI.json");
const rootChainABI = require("./abi/rootChainABI.json");
const config = require("./config.json");
const { decodeMethodReturn } = require("./utils");

const DEBUG = false;
const NETWORK = "goerli";
// const NETWORK = "ganache";

// Meant for testing alone
const walletPrivateKey = config[NETWORK]["walletPrivateKey"];

const web3 = new Web3(config[NETWORK]["rpc"]);

/**
 * -------------------
 * CONTRACTS
 * -------------------
 */
const stakingManagerAddress = config[NETWORK]["stakingManagerAddress"];
const stakingManagerContract = new web3.eth.Contract(
  stakingManagerABI,
  stakingManagerAddress
);

const stakingManagerProxyAddress =
  config[NETWORK]["stakingManagerProxyAddress"];

const validatorShareAddress = config[NETWORK]["validatorShareAddress"];
const validatorShareContract = new web3.eth.Contract(
  validatorShareABI,
  stakingManagerProxyAddress
);

const rootChainProxyAddress = config[NETWORK]["rootChainProxyAddress"];
const rootChainContract = new web3.eth.Contract(
  rootChainABI,
  rootChainProxyAddress
);

/**
 * Check web3 connection
 */
async function checkConnection() {
  // Longtime no see - Couldn't find isConnected fn
  return web3.eth.getBlockNumber();
}

/**
 * web3.eth.call via proxy
 * @param {string} data Bytes of calldata
 * @param {string} address ProxyAddress
 */
async function wrapProxyAndCall(abi, methodName, data, address) {
  const returnValue = await web3.eth.call({
    to: address,
    data,
  });

  if (DEBUG) {
    console.log("Return value: ", returnValue);
  }

  return decodeMethodReturn(web3, abi, methodName, returnValue);
}

/**
 * Given a block data from a transaction, decode to readable values
 * @param {string} data - Hex data of transaction
 */
function decodeSubmitBlockData(data) {
  // constant - bytes4(sha3(submitHeaderBlock(bytes, bytes)))
  const fnSignature = "0x6a791f11";

  // Split fn. signature add `0x` prefix
  data = "0x" + data.split(fnSignature)[1];

  const result = web3.eth.abi.decodeParameters(["bytes", "bytes"], data);
  const blockDataBytes = result["0"];
  const sigDataBytes = result["1"];

  const dataParameters = [
    "address",
    "uint256",
    "uint256",
    "bytes32",
    "bytes32",
    "uint256",
  ];
  const blockData = web3.eth.abi.decodeParameters(
    dataParameters,
    blockDataBytes
  );

  return {
    proposer: blockData["0"],
    start: blockData["1"],
    end: blockData["2"],
    rootHash: blockData["3"],
    accountHash: blockData["4"],
    borChainID: blockData["5"],
  };
}

/**
 * Get ValidatorShare Contract Info.
 * @param {string} address
 */
async function readValidatorShareData(address) {
  const validatorRewards = await wrapProxyAndCall(
    validatorShareABI,
    "validatorRewards",
    validatorShareContract.methods.validatorRewards().encodeABI(),
    address
  );
  const rewardPerShare = await wrapProxyAndCall(
    validatorShareABI,
    "rewardPerShare",
    validatorShareContract.methods.rewardPerShare().encodeABI(),
    address
  );

  return {
    rewardPerShare,
    validatorRewards,
  };
}

/**
 * Get ValidatorShareProxy Address
 * @param {string} proposer - Proposer address from submitHeaderBlock
 */
async function getValidatorData(proposer) {
  const signerToValidator = await wrapProxyAndCall(
    stakingManagerABI,
    "signerToValidator",
    stakingManagerContract.methods.signerToValidator(proposer).encodeABI(),
    stakingManagerProxyAddress
  );

  const validatorInfo = await wrapProxyAndCall(
    stakingManagerABI,
    "validators",
    stakingManagerContract.methods.validators(signerToValidator).encodeABI(),
    stakingManagerProxyAddress
  );

  return {
    validatorShareProxyAddress: validatorInfo["contractAddress"],
  };
}

function subscribeToBlockHeaderEvents(startBlock) {
  rootChainContract.events
    .NewHeaderBlock(
      {
        from: Number(startBlock),
      },
      function (error, event) {
        console.log(event);
      }
    )
    .on("data", function (event) {
      console.log("New block found: ", event);
    });
}

async function getPastBlockHeaderEvents(blockNumber) {
  const lastChildBlock = await rootChainContract.methods
    .getLastChildBlock()
    .call();
  console.log("Last Child Block: ", lastChildBlock);

  console.log("startBlock: ", Number(blockNumber) - 500);

  const events = await rootChainContract.getPastEvents("NewHeaderBlock", {
    from: Number(blockNumber) - 500,
    to: `latest`,
  });
  return events;
}

async function replaySubmitBlockData(data) {
  // const { rawTransaction } = await web3.eth.accounts.signTransaction(
  //   {
  //     to: rootChainProxyAddress,
  //     data,
  //     gas: 400588,
  //   },
  //   walletPrivateKey
  // );
  // const { hash } = await web3.eth.sendSignedTransaction(rawTransaction);

  const result = await web3.eth.call({
    to: rootChainProxyAddress,
    data,
  });
  console.log(result);
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
    "0x6a791f110000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000be188d6641e8b680743a4815dfa0f6208038960f000000000000000000000000000000000000000000000000000000000016a200000000000000000000000000000000000000000000000000000000000016a2ffde483e31c59988b6dd050c3a3c4dce094e15e375d56251eebde03fe88232b0d91a2c704cdd05b1da028e06f6e0bfe0d914798e671b436237c2c05fadd363fe8f00000000000000000000000000000000000000000000000000000000000138810000000000000000000000000000000000000000000000000000000000000145aad394a5b0a36b4970b6f78a67ea67549e7807da49f638e9923dbaa3237523144616b6cf6341d063ea04716cad0e2915c327d79031c549c9cce883bb92acc784002676be3fe219bb919a0cedecedd00f21e9ed98cc2df3465ab88468e13f2002cf46659f91910b6d680c9706c84bd03d4a7f16eed46548f6cd372ccdadc77c2cac00e5b7a874799fd3d139b0bdec26e4ca4e27e9f3a544df1a51c675daf427d3e032694f77072be1cd248c130d2981a66988dbae59729ea6db2b7499c5b964d8dd700192c260b8a99203aaa8d16cc6431d853e8403c78b95182a2ccd3ceb1d46b74aec2b122781745dcea868e3f4f77c1f3b50833ff1f1a84c6d62f4917f1c7bdc8ba70131eff65a46bf0b5929c96335db1d18fb52b10d76a491b9e4935766871ab246c5078cb4fa189edb6aaf92661aee932198fe301bff8dbc5e4ed90f8edbb3f0dfcb00000000000000000000000000000000000000000000000000000000";
  const { proposer } = decodeSubmitBlockData(data);
  console.log("Proposer Address: ", proposer);

  const { validatorShareProxyAddress } = await getValidatorData(proposer);
  console.log("Validator Share Proxy Address: ", validatorShareProxyAddress);

  const { validatorRewards, rewardPerShare } = await readValidatorShareData(
    validatorShareProxyAddress
  );
  console.log("Validator Rewards: ", validatorRewards);
  console.log("Reward per share: ", rewardPerShare);

  // const events = await getPastBlockHeaderEvents(blockNumber);
  // console.log(events);

  await replaySubmitBlockData(data);
}

test();

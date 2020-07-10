const Web3 = require("web3");
const Bignumber = require("bignumber.js");

const stakingManagerABI = require("./stakingManagerABI.json");
const stakingManagerProxyABI = require("./stakingManagerProxyABI.json");
const { decodeMethodReturn } = require("./utils");
const { fromPrivate } = require("./elliptic");
const config = require("./config.json");

// const NETWORK = "goerli";
const NETWORK = "ganache";

// Meant for testing alone
const walletPrivateKey = config[NETWORK]["walletPrivateKey"];

const web3 = new Web3(config[NETWORK]["rpc"]);

const res = fromPrivate(web3, walletPrivateKey);
const walletPubKey = res.publicKey;
const walletAddress = res.address;

/**
 * Check web3 connection
 */
async function checkConnection() {
  // Longtime no see - Couldn't find isConnected fn
  return web3.eth.getBlockNumber();
}

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
const stakingManagerProxyContract = new web3.eth.Contract(
  stakingManagerProxyABI,
  stakingManagerProxyAddress
);

/**
 * web3.eth.call via proxy
 * @param {string} data Bytes of calldata
 * @param {string} address ProxyAddress
 */
async function wrapProxyAndCall(
  methodName,
  data,
  address = stakingManagerProxyAddress
) {
  const returnValue = await web3.eth.call({
    to: address,
    data,
  });
  return decodeMethodReturn(web3, stakingManagerABI, methodName, returnValue);
}

/**
 * web3.eth.send via proxy
 * @param {number} amountInWei
 * @param {string} data
 * @param {string} address
 */
async function wrapProxyAndSend(
  amountInWei,
  data,
  address = stakingManagerProxyAddress
) {
  return web3.eth.call({
    to: address,
    data,
    value: amountInWei,
  });
}

// Read current storage
async function readStakingManagerContract() {
  const nftAddress = await wrapProxyAndCall(
    "NFTContract",
    stakingManagerContract.methods.NFTContract().encodeABI()
  );
  console.log("NFT Address: ", nftAddress);

  const nftCounter = await wrapProxyAndCall(
    "NFTCounter",
    stakingManagerContract.methods.NFTCounter().encodeABI()
  );
  console.log("NFT Counter: ", nftCounter);

  const minHeimdallFee = await wrapProxyAndCall(
    "minHeimdallFee",
    stakingManagerContract.methods.minHeimdallFee().encodeABI()
  );
  console.log("Min HeimdallFee: ", minHeimdallFee);

  const minDeposit = await wrapProxyAndCall(
    "minDeposit",
    stakingManagerContract.methods.minDeposit().encodeABI()
  );
  console.log("Min Deposit: ", minDeposit);

  return {
    minDeposit,
    minHeimdallFee,
    nftCounter,
    nftAddress,
  };
}

/**
 * Main fn. to display vulnerability
 * @param {string | number} minDeposit
 * @param {string | number} minHeimdallFee
 * @param {boolean} toDelegate
 * @param {string} signerPubKey
 */
async function stake(
  minDeposit,
  minHeimdallFee,
  toDelegate = false,
  signerPubKey = walletPubKey
) {
  // Weird - minDeposit is actually minDeposit + 1
  // https://github.com/maticnetwork/contracts/blob/release-0.3/contracts/staking/stakeManager/StakeManager.sol#L323
  const actualDeposit = new Bignumber(minDeposit).plus(1);

  // const gasPrice = await web3.eth.getGasPrice();

  // const { rawTransaction } = await web3.eth.accounts.signTransaction(
  //   {
  //     to: stakingManagerProxyAddress,
  //     data: stakingManagerContract.methods
  //       .stake(actualDeposit, minHeimdallFee, toDelegate, signerPubKey)
  //       .encodeABI(),
  //     gas: 615410,
  //   },
  //   walletPrivateKey
  // );
  // const { hash } = await web3.eth.sendSignedTransaction(rawTransaction);

  const returnValue = await web3.eth.call({
    to: stakingManagerProxyAddress,
    data: stakingManagerContract.methods
      .stake(actualDeposit, minHeimdallFee, toDelegate, signerPubKey)
      .encodeABI(),
  });
  return decodeMethodReturn(web3, stakingManagerABI, "stake", returnValue);
}

// Invoke this on start
async function test() {
  const blockNumber = await checkConnection();
  if (!blockNumber) {
    console.log("Connection failed ...");
    return;
  }

  const { minDeposit, minHeimdallFee } = await readStakingManagerContract();
  console.log(await stake(minDeposit, minHeimdallFee));
}

test();

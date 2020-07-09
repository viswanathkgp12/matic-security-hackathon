const Web3 = require("web3");

const stakingManagerABI = require("./stakingABI.json");

const web3 = new Web3("http://18.209.48.15:80");

// Meant for testing alone
const walletPrivateKey =
  "574359B1F0297AEFA3C236B6EDE4A2AEEB09886F36C46DD5638FDAF198483F8C";
const walletAddress = "0x3005608304e10eA3713Dc4B366d45E82c5211753";

async function checkConnection() {
  // Longtime no see - Couldn't find isConnected fn
  return web3.eth.getBlockNumber();
}

const stakingManagerAddress = "0x5d8116c1d0026869a2025731eA9E383CB9b62bD4";
const stakingManagerContract = new web3.eth.Contract(
  stakingManagerABI,
  stakingManagerAddress
);

async function readStackingManagerContract() {
  const nftAddress = await stakingManagerContract.methods.NFTContract().call();
  console.log("NFT Address: ", nftAddress);

  const nftCounter = await stakingManagerContract.methods.NFTCounter().call();
  console.log("NFT Counter: ", nftCounter);

  const minHeimdallFee = await stakingManagerContract.methods
    .minHeimdallFee()
    .call();
  console.log("Min HeimdallFee: ", minHeimdallFee);

  const minDeposit = await stakingManagerContract.methods.minDeposit().call();
  console.log("Min Deposit: ", minDeposit);

  return {
    minDeposit,
    minHeimdallFee,
    nftCounter,
    nftAddress,
  };
}

async function estimateGasForStakeCall(
  minDeposit,
  minHeimdallFee,
  toDelegate = false,
  signerPubKey = walletAddress
) {
  // Weird - minDeposit is actually minDeposit + 1
  // https://github.com/maticnetwork/contracts/blob/release-0.3/contracts/staking/stakeManager/StakeManager.sol#L323
  const actualDeposit = minDeposit + 1;

  return stakingManagerContract.methods
    .stake(actualDeposit, minHeimdallFee, toDelegate, signerPubKey)
    .estimateGas({
      from: signerPubKey,
      value: actualDeposit + minHeimdallFee,
    });
}

async function test() {
  const blockNumber = await checkConnection();
  if (!blockNumber) {
    console.log("Connection failed ...");
    return;
  }

  const { minDeposit, minHeimdallFee } = await readStackingManagerContract();
  const gasEstimate = await estimateGasForStakeCall(minDeposit, minHeimdallFee);
  console.log("Gas est.: ", gasEstimate);
}

test();

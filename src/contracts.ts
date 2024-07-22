import fs from 'fs'
import chalk from "chalk";
import { exit } from "process";
import { bech32 } from "bech32";
import { BigNumber, ethers } from "ethersV5";
import { SignatureRequest } from "@flarenetwork/flarejs/dist/common"
import { ClaimRewardsInterface, OptOutOfAirdropInterface, Context, RegisterAddressInterface, UnsignedTxJson } from "./interfaces";
import { forDefiDirectory, forDefiUnsignedTxnDirectory } from './constants/forDefi';
import { NetworkConfig } from "./constants/network";
import {
  getAddressBinderABI, getFlareContractRegistryABI, defaultContractAddresses, addressBinderContractName,
  validatorRewardManagerContractName, contractTransactionName, getValidatorRewardManagerABI, pChainStakeMirror, getPChainStakeMirrorABI, distributionToDelegators, getDistributionToDelegatorsABI
} from "./constants/contracts";
import { walletConstants } from "./constants/screen";
import { prefix0x, saveUnsignedTxJson, integerToDecimal } from "./utils";
import { getNetworkConfig, hrpFromNetworkConfig, rpcUrlFromNetworkConfig } from "./context"
import { ledgerSign } from "./ledger/sign";

type DelegatedAmount = {
  stakeAmount: number,
  startTime: Date,
  endTime: Date
}

/**
 * @description checks if the address is registered with the addressBinder contract
 * @param ethAddressToCheck
 * @param network
 */
export async function isAddressRegistered(ethAddressToCheck: string, network: string): Promise<boolean> {

  // TODO: Change when contracts are deployed on Songbird and Coston
  if (network === "songbird" || network === "coston") {
    return true;
  }

  console.log("Checking Address Registration...")
  const rpcUrl = rpcUrlFromNetworkConfig(network)
  const addressBinderContractAddress = await getContractAddress(network, addressBinderContractName)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const abi = getAddressBinderABI() as ethers.ContractInterface
  const contract = new ethers.Contract(addressBinderContractAddress, abi, provider);

  const result = await contract.cAddressToPAddress(ethAddressToCheck);
  const pChainAddress = bech32.encode(network, bech32.toWords(Buffer.from(result.slice(2), 'hex')))

  if (result !== '0x0000000000000000000000000000000000000000') {
    console.log(chalk.green(`Address associated with key ${ethAddressToCheck}: ${pChainAddress}`))
    return true;
  } else {
    console.log(chalk.red(`No address found for key ${ethAddressToCheck}`))
    return false;
  }
}

/**
 * @description checks if there are any unclaimed rewards with the validatorRewardManager contract
 * @param ethAddressToCheck
 * @param network
 */
export async function isUnclaimedReward(ethAddressToCheck: string, network: string): Promise<boolean> {

  console.log("Checking your Rewards status...")
  const rpcUrl = rpcUrlFromNetworkConfig(network)
  const validatorRewardManagerContractAddress = await getContractAddress(network, validatorRewardManagerContractName)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const abi = getValidatorRewardManagerABI() as ethers.ContractInterface
  const contract = new ethers.Contract(validatorRewardManagerContractAddress, abi, provider);

  const rewards = await contract.getStateOfRewards(ethAddressToCheck);

  const totalRewardNumber: BigNumber = rewards[0]
  const claimedRewardNumber: BigNumber = rewards[1]
  const unclaimedRewards: BigNumber = totalRewardNumber.sub(claimedRewardNumber)

  if (unclaimedRewards.gt(BigNumber.from("0"))) {
    const unclaimedRewardsInFLR: BigNumber = unclaimedRewards.div(ethers.constants.WeiPerEther) // div by 1e18
    console.log(chalk.green(`You have unclaimed rewards worth ${unclaimedRewardsInFLR} FLR`))
    return true;
  } else {
    console.log(chalk.red(`No unclaimed rewards found`))
    return false;
  }
}

/**
 * @description cregisters address  with the addressBinder contract
 * @param {RegisterAddressInterface} addressParams
 */
export async function registerAddress(addressParams: RegisterAddressInterface) {
  const { publicKey, pAddress, cAddress, network, wallet, derivationPath, pvtKey, transactionId } = addressParams

  const rpcUrl = rpcUrlFromNetworkConfig(network)
  const addressBinderContractAddress = await getContractAddress(network, addressBinderContractName)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const abi = getAddressBinderABI() as ethers.ContractInterface
  const contract = new ethers.Contract(addressBinderContractAddress, abi, provider);

  const checksumAddress = ethers.utils.getAddress(cAddress);
  const nonce = await provider.getTransactionCount(checksumAddress);
  const config: NetworkConfig = getNetworkConfig(network)

  const pAddr = prefix0x(Buffer.from(bech32.fromWords(bech32.decode(pAddress.slice(2)).words)).toString('hex'));
  const publicKeyPrefixed = prefix0x(publicKey)
  const gasEstimate = await contract.estimateGas.registerAddresses(publicKeyPrefixed, pAddr, cAddress, { from: cAddress });
  const gasPrice = await provider.getGasPrice();

  const populatedTx = await contract.populateTransaction.registerAddresses(publicKeyPrefixed, pAddr, cAddress);
  const unsignedTx = {
    ...populatedTx,
    nonce,
    chainId: config.networkID,
    gasPrice,
    gasLimit: gasEstimate
  }

  await signContractTransaction(wallet, unsignedTx, contract, derivationPath, transactionId, pvtKey)
}

/**
 * @description claims rewards from the ValidatorRewardManager Contract
 * @param {ClaimRewardsInterface} rewardsParams
 */
export async function claimRewards(rewardsParams: ClaimRewardsInterface) {
  const { claimAmount, ownerAddress, receiverAddress, network, wallet, derivationPath, pvtKey, transactionId } = rewardsParams

  const rewardAmount: BigNumber = BigNumber.from(claimAmount).mul(ethers.constants.WeiPerEther)
  if (rewardAmount.gt(await getUnclaimedRewards(ownerAddress, network)) || !rewardAmount.gt(BigNumber.from("0"))) {
    throw new Error("Incorrect amount to claim")
  }

  const rpcUrl = rpcUrlFromNetworkConfig(network)
  const validatorRewardManagerContractAddress = await getContractAddress(network, validatorRewardManagerContractName)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const abi = getValidatorRewardManagerABI() as ethers.ContractInterface
  const contract = new ethers.Contract(validatorRewardManagerContractAddress, abi, provider);

  const checksumAddress = ethers.utils.getAddress(ownerAddress);
  const nonce = await provider.getTransactionCount(checksumAddress);
  const config: NetworkConfig = getNetworkConfig(network)

  let gasEstimate
  try {
    gasEstimate = await contract.estimateGas.claim(ownerAddress, prefix0x(receiverAddress), rewardAmount, false, { from: ownerAddress })
  } catch {
    console.log(chalk.red("Incorrect arguments passed"))
    exit()
  }

  const gasPrice = await provider.getGasPrice();

  const populatedTx = await contract.populateTransaction.claim(ownerAddress, prefix0x(receiverAddress), rewardAmount, false)
  const unsignedTx = {
    ...populatedTx,
    nonce,
    chainId: config.networkID,
    gasPrice,
    gasLimit: gasEstimate
  }

  await signContractTransaction(wallet, unsignedTx, contract, derivationPath, transactionId, pvtKey)
}


/**
 * @description submits signed ForDefi txn to the chain
 * @param id Id of the txn to submit
 * @param signature signature of the signed txn from ForDefi
 * @param network
 * @returns TxnHash
 */
export async function submitForDefiTxn(id: string, signature: string, network: string): Promise<string> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrlFromNetworkConfig(network));
  const serializedSignedTx = ethers.utils.serializeTransaction(readUnsignedEVMObject(id), prefix0x(signature))
  const chainId = await provider.sendTransaction(serializedSignedTx)
  return chainId.hash
}

function createUnsignedJsonObject(txHash: string): UnsignedTxJson {

  const signatureRequest: SignatureRequest = {
    message: txHash.slice(2),
    signer: "",
  };

  const unsignedTxJson: UnsignedTxJson = {
    transactionType: contractTransactionName,
    serialization: "",
    signatureRequests: [signatureRequest],
    unsignedTransactionBuffer: "",
    usedFee: "",
    txDetails: "",
  };

  return unsignedTxJson;
}



async function getContractAddress(network: string, contractName: string): Promise<string> {
  const rpcUrl = rpcUrlFromNetworkConfig(network)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const abi = getFlareContractRegistryABI() as ethers.ContractInterface
  const hrp = hrpFromNetworkConfig(network)
  if (hrp != "flare" && hrp != "costwo") throw new Error("Invalid network passed")
  const contract = new ethers.Contract(defaultContractAddresses.FlareContractRegistry[hrp], abi, provider);

  const result = await contract.getContractAddressByName(contractName);

  if (result !== '0x0000000000000000000000000000000000000000') return result

  const defaultAddress = defaultContractAddresses[contractName]?.[hrp]
  if (defaultAddress) return defaultAddress

  throw new Error("Contract Address not found")

}

function readUnsignedEVMObject(id: string): ethers.utils.UnsignedTransaction {
  const fname = `${forDefiDirectory}/${forDefiUnsignedTxnDirectory}/${id}.unsignedEVMObject.json`
  if (!fs.existsSync(fname)) {
    throw new Error(`unsigned EVM Object file ${fname} does not exist`)
  }
  const serialization = fs.readFileSync(fname).toString()
  let file = JSON.parse(serialization)
  file.gasPrice = BigNumber.from(file.gasPrice.hex)
  file.gasLimit = BigNumber.from(file.gasLimit.hex)
  return file as ethers.utils.UnsignedTransaction
}

function saveUnsignedEVMObject(unsignedTx: Object, id: string): void {
  const fname = `${forDefiDirectory}/${forDefiUnsignedTxnDirectory}/${id}.unsignedEVMObject.json`
  if (fs.existsSync(fname)) {
    throw new Error(`unsignedTx file ${fname} already exists`)
  }
  const serialization = JSON.stringify(unsignedTx, null, 2)
  fs.mkdirSync(`${forDefiDirectory}/${forDefiUnsignedTxnDirectory}`, { recursive: true })
  fs.writeFileSync(fname, serialization)
}

async function getUnclaimedRewards(ethAddress: string, network: string): Promise<BigNumber> {
  const rpcUrl = rpcUrlFromNetworkConfig(network)
  const validatorRewardManagerContractAddress = await getContractAddress(network, validatorRewardManagerContractName)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const abi = getValidatorRewardManagerABI() as ethers.ContractInterface
  const contract = new ethers.Contract(validatorRewardManagerContractAddress, abi, provider);

  const rewards = await contract.getStateOfRewards(ethAddress);

  const totalRewardNumber: BigNumber = rewards[0]
  const claimedRewardNumber: BigNumber = rewards[1]
  const unclaimedRewards: BigNumber = totalRewardNumber.sub(claimedRewardNumber)
  return unclaimedRewards
}

async function isOptedOut(ethAddress: string, network: string): Promise<boolean> {
  const rpcUrl = rpcUrlFromNetworkConfig(network)
  const distributionToDelegatorsContractAddress = await getContractAddress(network, distributionToDelegators)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const abi = getDistributionToDelegatorsABI() as ethers.ContractInterface
  const contract = new ethers.Contract(distributionToDelegatorsContractAddress, abi, provider);

  const isOptedOut = await contract.optOutCandidate(ethAddress);
  return isOptedOut
}

async function signContractTransaction(wallet: keyof typeof walletConstants, unsignedTx: Object, contract: ethers.Contract, derivationPath?: string,
  transactionId?: string, pvtKey?: string) {
  const serializedUnsignedTx = ethers.utils.serializeTransaction(unsignedTx);
  const txHash = ethers.utils.keccak256(serializedUnsignedTx);
  const unsignedTxObj = createUnsignedJsonObject(txHash)

  if (wallet === Object.keys(walletConstants)[0]) {
    if (!derivationPath) throw new Error("No derivation path passed")
    const sign = await ledgerSign(unsignedTxObj, derivationPath)
    const serializedSignedTx = ethers.utils.serializeTransaction(unsignedTx, prefix0x(sign.signature))
    console.log("Submitting txn to the chain")
    await contract.provider.sendTransaction(serializedSignedTx)
  }
  else if (wallet === Object.keys(walletConstants)[1]) {
    if (!transactionId) throw new Error("No transaction Id passed")
    saveUnsignedTxJson(unsignedTxObj, transactionId)
    saveUnsignedEVMObject(unsignedTx, transactionId)
  }
  else if (wallet === Object.keys(walletConstants)[2]) {
    if (!pvtKey) throw new Error("No private key passed")
    const wallet = new ethers.Wallet(pvtKey);
    const signedTx = await wallet.signTransaction(unsignedTx)
    await contract.provider.sendTransaction(signedTx)
  }
}

////////// MIRROR FUND /////////
// fetches current validator info
const fetchValidatorInfo = async (ctx: Context) => {
  const validator = await ctx.pchain.getCurrentValidators();
  return validator;
};

// fetches pending validator info
const fetchPendingValidatorInfo = async (ctx: Context) => {
  const pendingValidator = await ctx.pchain.getPendingValidators();
  return pendingValidator;
};

// fetches the delegation stake (from both current and pending validator) for the current user
const fetchDelegateStake = async (ctx: Context, validatorFunction: (ctx: Context) => {}) => {
  const validatorsInfo = await validatorFunction(ctx);
  const validatorData = (validatorsInfo as any)?.validators;
  let userStake = [];
  for (let i = 0; i < validatorData.length; i++) {
    for (let j = 0; j < (validatorData[i].delegators && validatorData[i].delegators?.length); j++) {
      if (
        validatorData[i].delegators[j] &&
        validatorData[i].delegators[j].rewardOwner.addresses.includes(ctx.pAddressBech32)

      ) {
        const startDate = new Date(parseInt(validatorData[i]?.delegators[j]?.startTime) * 1000)
        const endDate = new Date(parseInt(validatorData[i]?.delegators[j]?.endTime) * 1000)
        userStake.push({
          stakeAmount: parseFloat(validatorData[i]?.delegators[j]?.stakeAmount) / 1e9,
          startTime: startDate,
          endTime: endDate
        });
      }
    }
  }
  return userStake;
};

// calculates the total amount of delegation
const getTotalFromDelegation = (data: DelegatedAmount[]) => {
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    total += data[i].stakeAmount;
  }
  return total;
};

/**
 * @description returns the mirror fund details
 * @param ctx - context
 * @returns - total mirror funds and funds with start and end time
 */
export async function fetchMirrorFunds(ctx: Context) {
  console.log("Checking your Mirror Funds ...")
  // fetch from the contract
  const rpcUrl = rpcUrlFromNetworkConfig(ctx.config.hrp);
  const pChainStakeMirrorContractAddress = await getContractAddress(ctx.config.hrp, pChainStakeMirror)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const abi = getPChainStakeMirrorABI() as ethers.ContractInterface
  const contract = new ethers.Contract(pChainStakeMirrorContractAddress, abi, provider);
  const stakedAmount = await contract.balanceOf(ctx.cAddressHex);
  const stakedAmountInFLR = parseFloat(integerToDecimal(stakedAmount.toString(), 18));
  // fetch for the chain
  const delegationToCurrentValidator = await fetchDelegateStake(ctx, fetchValidatorInfo);
  const delegationToPendingValidator = await fetchDelegateStake(ctx, fetchPendingValidatorInfo);
  const totalDelegatedAmount =
    getTotalFromDelegation(delegationToCurrentValidator) +
    getTotalFromDelegation(delegationToPendingValidator)
  const totalInFLR = parseFloat(totalDelegatedAmount.toString());
  return {
    "Total Mirrored Amount": `${totalInFLR} FLR`,
    "Mirror Funds Details": {
      ...delegationToCurrentValidator,
      ...delegationToPendingValidator
    }
  };
}

/**
 * @description - function to opt you out of airdrop
 * @param {optOutOfAirdrop} params - optout parameters
 */
export async function optOutOfAirdrop(params: OptOutOfAirdropInterface) {
  console.log('Opting you out of airdrop')
  const { cAddress, network, wallet, derivationPath, pvtKey, transactionId } = params
  if (await isOptedOut(cAddress, network)) {
    throw new Error('You have already opted out of Airdrop')
  }
  const rpcUrl = rpcUrlFromNetworkConfig(network);
  const distributionToDelegatorsContractAddress = await getContractAddress(network, distributionToDelegators)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const abi = getDistributionToDelegatorsABI() as ethers.ContractInterface
  const contract = new ethers.Contract(distributionToDelegatorsContractAddress, abi, provider);
  const checksumAddress = ethers.utils.getAddress(cAddress);
  const nonce = await provider.getTransactionCount(checksumAddress);
  const config: NetworkConfig = getNetworkConfig(network);
  let gasEstimate
  try {
    gasEstimate = await contract.estimateGas.optOutOfAirdrop({ from: cAddress })
  } catch {
    console.log(chalk.red('Unable to estimate trx gas fees, Trx is likely to fail'))
    exit()
  }
  const gasPrice = await provider.getGasPrice();
  const populatedTx = await contract.populateTransaction.optOutOfAirdrop()
  const unsignedTx = {
    ...populatedTx,
    nonce,
    chainId: config.networkID,
    gasPrice,
    gasLimit: gasEstimate
  }
  await signContractTransaction(wallet, unsignedTx, contract, derivationPath, transactionId, pvtKey)
}
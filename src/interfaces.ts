import Web3 from 'web3'
import { SignatureRequest } from "@flarenetwork/flarejs/dist/common"
import { Avalanche } from '@flarenetwork/flarejs'
import { EVMAPI, KeyChain as EVMKeyChain, } from '@flarenetwork/flarejs/dist/apis/evm'
import { PlatformVMAPI as PVMAPI, KeyChain as PVMKeyChain } from '@flarenetwork/flarejs/dist/apis/platformvm'
import { NetworkConfig } from './constants/network'
import { walletConstants } from "./constants/screen"

export interface Context {
  privkHex?: string
  privkCB58?: string
  publicKey?: [Buffer, Buffer]
  rpcurl: string
  web3: Web3
  avalanche: Avalanche
  cchain: EVMAPI
  pchain: PVMAPI
  cKeychain: EVMKeyChain
  pKeychain: PVMKeyChain
  pAddressBech32?: string
  cAddressBech32?: string
  cAddressHex?: string
  cChainBlockchainID: string
  pChainBlockchainID: string
  avaxAssetID: string
  config: NetworkConfig
}

export interface ContextFile {
  wallet: string,
  publicKey: string
  network: string,
  flareAddress?: string
  ethAddress?: string
  vaultId?: string
  derivationPath?: string
  networkUrl?: string
}

export interface UnsignedTxJson {
  transactionType: string
  serialization: string
  signatureRequests: SignatureRequest[]
  unsignedTransactionBuffer: string // hex
  usedFee?: string // c-chain fee (don't know why is not logged inside buffer)
  txDetails?: string // JSON of the unsigned transaction
  forDefiTxId?: string
  forDefiHash?: string
}

export interface SignedTxJson extends UnsignedTxJson {
  signature: string,
  isSentToChain?: boolean
}

export interface UnsignedWithdrawalTxJson {
  rawTx: WithdrawalTxData
  message: string
  forDefiTxId?: string
  forDefiHash?: string
}

export interface SignedWithdrawalTxJson extends UnsignedWithdrawalTxJson {
  signature: string
}

export interface FlareTxParams {
  amount?: string
  fee?: string
  nodeId?: string
  startTime?: string
  endTime?: string
  nonce?: string
  delegationFee?: string,
  threshold?: string
}

interface WithdrawalTxData {
  nonce: number;
  gasPrice: number;
  gasLimit: number;
  to: string;
  value?: string | bigint;
  chainId: number;
  data?: string;
}

/**
 * Represents the various constants used by the CLI
 * @interface ScreenConstantsInterface
 */
export interface ScreenConstantsInterface {
  [key: string]: string;
}

/**
 * Represents the properties returned from the "connectWallet" function
 * @interface ConnectWalletInterface
 */
export interface ConnectWalletInterface {
  wallet: string;
  path?: string;
  network?: string;
}

/**
 * Represents a derived address from a Ledger device
 * @interface DerivedAddress
 */
export interface DerivedAddress {
  ethAddress: string,
  publicKey: string,
  balance?: string,
  derivationPath: string
}

/**
 * Represents the properties returned from the "getDetailsForDelegation" function
 * @interface DelegationDetailsInterface
 */
export interface DelegationDetailsInterface {
  amount: string,
  nodeId: string,
  startTime: string,
  endTime: string
  delegationFee?: string
}

/**
 * Represents the wallet params sent to the registerAddress Function
 * @interface RegisterAddressInterface
 */
export interface RegisterAddressInterface {
  publicKey: string,
  pAddress: string,
  cAddress: string,
  network: string,
  wallet: keyof typeof walletConstants,
  derivationPath?: string
  pvtKey?: string
  transactionId?: string
}

/**
 * Represents the wallet params sent to the claimRewards Function
 * @interface ClaimRewardsInterface
 */
export interface ClaimRewardsInterface {
  claimAmount: string,
  ownerAddress: string,
  receiverAddress: string,
  network: string,
  wallet: keyof typeof walletConstants,
  derivationPath?: string
  pvtKey?: string
  transactionId?: string
}

/**
 * Represents the wallet params sent to the optOutOfAirdrop Function
 * @interface OptOutOfAirdrop
 */
export interface OptOutOfAirdropInterface {
  cAddress: string,
  network: string,
  wallet: keyof typeof walletConstants,
  derivationPath?: string
  pvtKey?: string
  transactionId?: string
}

/**
 * Represents constant used to store values for contract addresses
 * @interface ContractAddressesInterface
 */
export interface ContractAddressesInterface {
  [contractName: string]: {
    flare: string;
    costwo: string;
  }
}

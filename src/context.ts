import fs from 'fs'
import Web3 from 'web3'
import { Avalanche, BinTools, Buffer as FlrBuffer } from '@flarenetwork/flarejs'
import { PrivateKeyPrefix, PublicKeyPrefix, Defaults } from '@flarenetwork/flarejs/dist/utils'
import { EVMAPI, KeyChain as EVMKeyChain } from '@flarenetwork/flarejs/dist/apis/evm'
import { PlatformVMAPI as PVMAPI, KeyChain as PVMKeyChain } from '@flarenetwork/flarejs/dist/apis/platformvm'
import { Context, ContextFile } from './interfaces'
import { flare, songbird, costwo, coston, localflare, local, NetworkConfig } from './constants/network'
import {
  unPrefix0x, publicKeyToBech32AddressString, publicKeyToEthereumAddressString,
  privateKeyToPublicKey, decodePublicKey
} from './utils'

const networkCostwoStaging: NetworkConfig = {
  protocol: '',
  ip: '',
  networkID: 114,
  hrp: 'costwo'
}

const networkCostonStaging: NetworkConfig = {
  protocol: '',
  ip: '',
  networkID: 7,
  hrp: 'coston'
}

/**
 * @param network
 * @returns {string} The RPC url of the given network
 */
export function rpcUrlFromNetworkConfig(network: string): string {
  const config: NetworkConfig = getNetworkConfig(network)
  return `${config.protocol}://${config.ip}/ext/bc/C/rpc`
}

export function hrpFromNetworkConfig(network: string): string {
  return getNetworkConfig(network).hrp
}

/**
 * @description - parses the file and returns the context of ctx.json
 * @param ctxFile - path to the context file
 * @returns - context
 */
export function readContextFile(ctxFile: string): ContextFile {
  const file = fs.readFileSync(ctxFile, 'utf8')
  return JSON.parse(file) as ContextFile
}

/**
 * @description Returns the context from .env file
 * @param path - path to the .env file
 * @param network - network info. can be localflare, costwo, flare
 * @returns - returns the context from .env file
 */
export function contextEnv(path: string, network: string): Context {
  require('dotenv').config({ path: path })
  return getContext(
    network,
    process.env.PUBLIC_KEY,
    process.env.PRIVATE_KEY_HEX,
    process.env.PRIVATE_KEY_CB58
  )
}

/**
 * @description - returns context from the file
 * @param ctxFile - path to the context file
 * @returns returns the context
 */
export function contextFile(ctxFile: string): Context {
  const ctx = readContextFile(ctxFile)
  return getContext(ctx.network, ctx.publicKey, undefined, undefined, ctx.networkUrl)
}

/**
 * @description - returns the network from the context file
 * @param ctxFile - context file
 * @returns returns the network from the context
 */
export function networkFromContextFile(ctxFile: string): string {
  const ctx = readContextFile(ctxFile)
  return ctx.network
}

/**
 * @description returns the context
 * @param network - network name: flare/localflare/costwo
 * @param publicKey - public key
 * @param privateKeyHex - private key in hex format
 * @param privateKeyCB58 - private key in cb58 format
 * @param networkIP - network IP
 * @returns context
 */
export function getContext(network: string, publicKey?: string, privateKeyHex?: string, privateKeyCB58?: string, networkURL?: string): Context {
  return context(getNetworkConfig(network), publicKey, privateKeyHex, privateKeyCB58, networkURL)
}

/**
 * @description - returns the network config based on network that was passed
 * @param network - network name: flare/localflare/costwo
 * @returns the network configuration
 */
export function getNetworkConfig(network: string | undefined): NetworkConfig {
  let networkConfig
  if (network == 'flare' || network === undefined) {
    networkConfig = flare
  } else if (network == 'songbird') {
    networkConfig = songbird
  } else if (network == 'costwo') {
    networkConfig = costwo
  } else if (network == 'costwo-staging') {
    networkConfig = networkCostwoStaging
  } else if (network == 'coston') {
    networkConfig = coston
  } else if (network == 'coston-staging') {
    networkConfig = networkCostonStaging
  } else if (network == 'localflare') {
    networkConfig = localflare
  } else if (network == 'local') {
    networkConfig = local
  } else throw Error('Invalid network')
  return networkConfig
}

/**
 * The main function that returns the cotext
 * @param config - network configuration
 * @param publicKey - public key
 * @param privkHex - private key in hex format
 * @param privkCB58 - private key in cb58 format
 * @returns the context object
 */
export function context(
  config: NetworkConfig,
  publicKey?: string, privkHex?: string, privkCB58?: string, networkURL?: string
): Context {
  const { protocol, ip, port, networkID } = config
  // if (networkURL) {
  //   // split into ip, port, protocol
  //   const url = new URL(networkURL)
  //   ip = url.hostname
  //   port = url.port ? Number(url.port) : undefined
  //   protocol = url.protocol.slice(0, -1) // remove the colon
  // }

  // those two addresses should be derived for most cli applications
  let cAddressHex: string | undefined
  let addressBech32: string | undefined

  // derive private key in both cb58 and hex if only one is provided
  const bintools = BinTools.getInstance()
  if (privkHex !== undefined && privkHex !== '') {
    privkHex = unPrefix0x(privkHex)
    const privkBuf = bintools.addChecksum(FlrBuffer.from(privkHex, 'hex'))
    privkCB58 = bintools.bufferToB58(privkBuf)
  } else if (privkCB58 !== undefined && privkCB58 !== '') {
    const privkBuf = bintools.cb58Decode(privkCB58)
    privkHex = privkBuf.toString('hex')
  }

  // derive the public key coords if private key is present and check that they match
  // the public key if provided
  let publicKeyPair: [Buffer, Buffer] | undefined
  if (publicKey) {
    publicKeyPair = decodePublicKey(publicKey)
    publicKey = "04" + Buffer.concat(publicKeyPair).toString('hex') // standardize
  }
  if (privkHex) {
    const [pubX, pubY] = privateKeyToPublicKey(Buffer.from(privkHex, 'hex'))
    if (publicKey && (!publicKeyPair![0].equals(pubX) || !publicKeyPair![1].equals(pubY))) {
      throw Error("provided private key does not match the public key")
    }
    publicKeyPair = [pubX, pubY]
  }

  const path = '/ext/bc/C/rpc'
  const iport = port ? `${ip}:${port}` : `${ip}`
  const rpcurl = `${protocol}://${iport}`
  const web3 = new Web3(`${rpcurl}${path}`)

  // derive addresses from public key if provided (bech32 is later derived again)
  if (publicKey) {
    cAddressHex = publicKeyToEthereumAddressString(publicKey)
    cAddressHex = web3.utils.toChecksumAddress(cAddressHex) // add checksum
    addressBech32 = publicKeyToBech32AddressString(publicKey, config.hrp)
  }

  const avalanche = new Avalanche(ip, port, protocol, networkID)
  const cchain: EVMAPI = avalanche.CChain()
  const pchain: PVMAPI = avalanche.PChain()
  const cKeychain: EVMKeyChain = cchain.keyChain()
  const pKeychain: PVMKeyChain = pchain.keyChain()

  if (privkCB58 || publicKey) {
    const key = (privkCB58) ? `${PrivateKeyPrefix}${privkCB58}` : `${PublicKeyPrefix}${publicKey!}`
    pKeychain.importKey(key)
    cKeychain.importKey(key)
  }

  const pAddressStrings: string[] = pchain.keyChain().getAddressStrings()
  const cAddressStrings: string[] = cchain.keyChain().getAddressStrings()
  const pAddressBech32 = pAddressStrings[0] || `P-${addressBech32}`
  const cAddressBech32 = cAddressStrings[0] || `C-${addressBech32}`

  if (privkHex) {
    const cAccount = web3.eth.accounts.privateKeyToAccount(privkHex)
    const _cAddressHex = cAccount.address
    if (cAddressHex && cAddressHex.toLowerCase() !== _cAddressHex.toLowerCase()) {
      throw Error('c-chain address does not match private key')
    }
    cAddressHex = _cAddressHex
  }

  const pChainBlockchainID: string =
    Defaults.network[networkID].P.blockchainID
  const cChainBlockchainID: string =
    Defaults.network[networkID].C.blockchainID
  const avaxAssetID: string = Defaults.network[networkID].P.avaxAssetID!

  return {
    privkHex: privkHex,
    privkCB58: privkCB58,
    publicKey: publicKeyPair,
    rpcurl: rpcurl,
    web3: web3,
    avalanche: avalanche,
    cchain: cchain,
    pchain: pchain,
    cKeychain: cKeychain,
    pKeychain: pKeychain,
    pAddressBech32: pAddressBech32,
    cAddressBech32: cAddressBech32,
    cAddressHex: cAddressHex,
    cChainBlockchainID: cChainBlockchainID,
    pChainBlockchainID: pChainBlockchainID,
    avaxAssetID: avaxAssetID,
    config: config
  }
}

export function updateNetworkUrl(network: string, networkUrl: string): void {
  if (!networkUrl)
    return;

  let networkCfg: NetworkConfig

  switch (network) {
    case 'costwo-staging':
      networkCfg = networkCostwoStaging
      break
    case 'coston-staging':
      networkCfg = networkCostonStaging
      break
    default:
      throw Error('Invalid network - only costwo-staging and coston-staging are allowed with custom network url')
  }

  const url = new URL(networkUrl)

  networkCfg.ip = url.hostname + (url.port ? `:${url.port}` : '')
  networkCfg.protocol = url.protocol.slice(0, -1) // remove the colon
}
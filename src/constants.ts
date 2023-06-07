import {
  costwo,
  flare,
  localflare,
  NetworkConfig,
  ConsumerAppConfig,
  ForDefi,
} from "./config";
import { unPrefix0x } from "./utils";
const Web3 = require("web3");
import { BinTools, Buffer } from "@flarenetwork/flarejs";
import { Avalanche } from "@flarenetwork/flarejs";
import {
  AVMAPI,
  KeyChain as AVMKeyChain,
} from "@flarenetwork/flarejs/dist/apis/avm";
import {
  EVMAPI,
  KeyChain as EVMKeyChain,
} from "@flarenetwork/flarejs/dist/apis/evm";
import {
  PlatformVMAPI,
  KeyChain as PVMKeyChain,
} from "@flarenetwork/flarejs/dist/apis/platformvm";
import { PrivateKeyPrefix, Defaults } from "@flarenetwork/flarejs/dist/utils";
import converter from "bech32-converting";

export interface Context {
  privkHex?: string;
  privkCB58?: string;
  rpcurl: string;
  web3: any;
  avalanche: Avalanche;
  xchain: AVMAPI;
  cchain: EVMAPI;
  pchain: PlatformVMAPI;
  xKeychain?: AVMKeyChain;
  cKeychain?: EVMKeyChain;
  pKeychain?: PVMKeyChain;
  xAddressBech32?: string;
  pAddressBech32: string;
  cAddressBech32: string;
  cAddressHex: string;
  xChainBlockchainID: string;
  cChainBlockchainID: string;
  pChainBlockchainID: string;
  avaxAssetID: string;
  config: NetworkConfig;
  consumerAppConfig?: ConsumerAppConfig;
}

export function contextEnv(path: string, network: string): Context {
  require("dotenv").config({ path: path });
  const config = getConfig(network);
  const privkHex = process.env.PRIVATE_KEY_HEX!;
  const privkCB58 = process.env.PRIVATE_KEY_CB58!;
  return context(config, privkHex, privkCB58);
}

export function contextEnvWhenConsumerApp(
  path: string,
  network: string
): Context {
  require("dotenv").config({ path: path });
  const config = getConfig(network);
  const pChainAddressBech32 = process.env.P_CHAIN_ADDRESS_BECH32!;
  const cChainAddressBech32 = process.env.C_CHAIN_ADDRESS_BECH32!;
  return contextWhenConsumerApp(
    config,
    pChainAddressBech32,
    cChainAddressBech32,
    getConsumerAppConfig()
  );
}

function getConsumerAppConfig(): ConsumerAppConfig {
  return ForDefi;
}

function getConfig(network: string): NetworkConfig {
  let networkConfig;
  if (network == "flare" || network === undefined) {
    networkConfig = flare;
  } else if (network == "costwo") {
    networkConfig = costwo;
  } else if (network == "localflare") {
    networkConfig = localflare;
  } else throw Error("Invalid network");
  return networkConfig;
}

function context(
  config: NetworkConfig,
  privkHex?: string,
  privkCB58?: string
): Context {
  const { protocol, ip, port, networkID, hrp } = config;

  // derive private key in both cb58 and hex if only one is provided
  const bintools = BinTools.getInstance();
  if (privkHex !== undefined && privkHex !== "") {
    privkHex = unPrefix0x(privkHex);
    const privkBuf = bintools.addChecksum(Buffer.from(privkHex, "hex"));
    privkCB58 = bintools.bufferToB58(privkBuf);
  } else if (privkCB58 !== undefined && privkCB58 !== "") {
    const privkBuf = bintools.cb58Decode(privkCB58);
    privkHex = privkBuf.toString("hex");
  }

  const path = "/ext/bc/C/rpc";
  const iport = port ? `${ip}:${port}` : `${ip}`;
  const rpcurl = `${protocol}://${iport}`;
  const web3 = new Web3(`${rpcurl}${path}`);

  const avalanche = new Avalanche(ip, port, protocol, networkID);
  const xchain: AVMAPI = avalanche.XChain();
  const cchain: EVMAPI = avalanche.CChain();
  const pchain: PlatformVMAPI = avalanche.PChain();
  const xKeychain: AVMKeyChain = xchain.keyChain();
  const cKeychain: EVMKeyChain = cchain.keyChain();
  const pKeychain: PVMKeyChain = pchain.keyChain();
  if (privkCB58) {
    const privKey = `${PrivateKeyPrefix}${privkCB58}`;
    xKeychain.importKey(privKey);
    cKeychain.importKey(privKey);
    pKeychain.importKey(privKey);
  }

  const pAddressStrings: string[] = pchain.keyChain().getAddressStrings();
  const cAddressStrings: string[] = cchain.keyChain().getAddressStrings();
  const xAddressStrings: string[] = xchain.keyChain().getAddressStrings();
  const pAddressBech32 = pAddressStrings[0];
  const cAddressBech32 = cAddressStrings[0];
  const xAddressBech32 = xAddressStrings[0];

  let cAddressHex: string = "";
  if (privkHex) {
    const cAccount = web3.eth.accounts.privateKeyToAccount(privkHex);
    cAddressHex = cAccount.address.toLowerCase();
  }

  const xChainBlockchainID: string = Defaults.network[networkID].X.blockchainID;
  const pChainBlockchainID: string = Defaults.network[networkID].P.blockchainID;
  const cChainBlockchainID: string = Defaults.network[networkID].C.blockchainID;
  const avaxAssetID: string = Defaults.network[networkID].P.avaxAssetID!;

  return {
    privkHex: privkHex,
    privkCB58: privkCB58,
    rpcurl: rpcurl,
    web3: web3,
    avalanche: avalanche,
    xchain: xchain,
    cchain: cchain,
    pchain: pchain,
    xKeychain: xKeychain,
    cKeychain: cKeychain,
    pKeychain: pKeychain,
    xAddressBech32: xAddressBech32,
    pAddressBech32: pAddressBech32,
    cAddressBech32: cAddressBech32,
    cAddressHex: cAddressHex,
    xChainBlockchainID: xChainBlockchainID,
    cChainBlockchainID: cChainBlockchainID,
    pChainBlockchainID: pChainBlockchainID,
    avaxAssetID: avaxAssetID,
    config: config,
    consumerAppConfig: undefined,
  };
}

function contextWhenConsumerApp(
  config: NetworkConfig,
  pChainAddressBech32: string,
  cChainAddressBech32: string,
  consumerAppConfig: ConsumerAppConfig
): Context {
  const { protocol, ip, port, networkID, hrp } = config;

  const path = "/ext/bc/C/rpc";
  const iport = port ? `${ip}:${port}` : `${ip}`;
  const rpcurl = `${protocol}://${iport}`;
  const web3 = new Web3(`${rpcurl}${path}`);

  const avalanche = new Avalanche(ip, port, protocol, networkID);
  const xchain: AVMAPI = avalanche.XChain();
  const cchain: EVMAPI = avalanche.CChain();
  const pchain: PlatformVMAPI = avalanche.PChain();
  const xKeychain: AVMKeyChain = xchain.keyChain();
  const cKeychain: EVMKeyChain = cchain.keyChain();
  const pKeychain: PVMKeyChain = pchain.keyChain();

  const pAddressBech32 = pChainAddressBech32;
  const cAddressBech32 = cChainAddressBech32;
  const xAddressBech32 = undefined;

  const cAddressHex: string = converter(hrp).toHex(cAddressBech32);

  const xChainBlockchainID: string = Defaults.network[networkID].X.blockchainID;
  const pChainBlockchainID: string = Defaults.network[networkID].P.blockchainID;
  const cChainBlockchainID: string = Defaults.network[networkID].C.blockchainID;
  const avaxAssetID: string = Defaults.network[networkID].P.avaxAssetID!;

  return {
    privkHex: undefined,
    privkCB58: undefined,
    rpcurl: rpcurl,
    web3: web3,
    avalanche: avalanche,
    xchain: xchain,
    cchain: cchain,
    pchain: pchain,
    xKeychain: xKeychain,
    cKeychain: cKeychain,
    pKeychain: pKeychain,
    xAddressBech32: xAddressBech32,
    pAddressBech32: pAddressBech32,
    cAddressBech32: cAddressBech32,
    cAddressHex: cAddressHex,
    xChainBlockchainID: xChainBlockchainID,
    cChainBlockchainID: cChainBlockchainID,
    pChainBlockchainID: pChainBlockchainID,
    avaxAssetID: avaxAssetID,
    config: config,
    consumerAppConfig: consumerAppConfig,
  };
}

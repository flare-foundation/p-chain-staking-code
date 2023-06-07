import {
  privateKeyToPublicKey,
  compressPublicKey,
  publicKeyToBech32AddressString,
  integerToDecimal,
  decimalToInteger,
  parseRelativeTime,
} from "./utils";
import { contextEnv, contextEnvWhenConsumerApp, Context } from "./constants";
import {
  exportTxCP,
  exportTxCPUsingConsumerApp,
  importTxPC,
  importTxPCUsingConsumerApp,
} from "./evmAtomicTx";
import {
  exportTxPC,
  exportTxPCUsingConsumerApp,
  importTxCP,
  importTxCPUsingConsumerApp,
} from "./pvmAtomicTx";
import { addValidator, addValidatorUsingConsumerApp } from "./addValidator";
import { Command, OptionValues } from "commander";
import { BN } from "@flarenetwork/flarejs/dist";
import createLogger from "logging";
import { addDelegator, addDelegatorUsingConsumerApp } from "./addDelegator";

const logger = createLogger("info");

export async function cli(program: Command) {
  // global configurations
  program
    .option("--network <network>", "Network name (flare or costwo)", "flare")
    .option("--env-path <path>", "Path to the .env file", "env");
  // information about the network
  program
    .command("info")
    .description("Relevant information")
    .argument("<type>", "Type of information")
    .action(async (type: string) => {
      const options = program.opts();
      const ctx = contextEnv(options.envPath, options.network);
      if (type == "addresses") {
        getAddressInfo(ctx);
      } else if (type == "balance") {
        await getBalanceInfo(ctx);
      } else if (type == "network") {
        getNetworkInfo(ctx);
      } else if (type == "livenetwork") {
        // implement this nicely
      } else if (type == "validators") {
        await getValidatorInfo(ctx);
      }
    });
  // moving funds from one chain to another
  program
    .command("crosschain")
    .description("Move funds from one chain to another")
    .argument("<type>", "Type of a crosschain transaction")
    .option("-a, --amount <amount>", "Amount to transfer")
    .option("-f, --fee <fee>", "Fee of a transaction")
    .action(async (type: string, options: OptionValues) => {
      options = { ...options, ...program.opts() };
      const ctx = contextEnv(options.envPath, options.network);
      if (type == "exportCP") {
        await exportCP(ctx, options.amount, options.fee);
      } else if (type == "importCP") {
        await importCP(ctx);
      } else if (type == "exportPC") {
        await exportPC(ctx, options.amount);
      } else if (type == "importPC") {
        await importPC(ctx, options.fee);
      }
    });
  // Moving funds from one chain to another using consumer app
  program
    .command("crossChainUsingConsumerApp")
    .description(
      "Move funds from one chain to another using consumer app that would help to collect signatures on the raw tx. \n Consumer app configuration should be present in .env file, see .env-template for more information"
    )
    .argument("<type>", "Type of a crosschain transaction")
    .option("-a, --amount <amount>", "Amount to transfer")
    .option("-f, --fee <fee>", "Fee of a transaction")
    .action(async (type: string, options: OptionValues) => {
      options = { ...options, ...program.opts() };
      const ctx = contextEnvWhenConsumerApp(options.envPath, options.network);
      if (type == "exportCP") {
        await exportCPUsingConsumerApp(ctx, options.amount, options.fee);
      } else if (type == "importCP") {
        await importCPUsingConsumerApp(ctx);
      } else if (type == "exportPC") {
        await exportPCUsingConsumerApp(ctx, options.amount);
      } else if (type == "importPC") {
        await importPCUsingConsumerApp(ctx, options.fee);
      }
    });
  // staking
  program
    .command("stake")
    .description("Stake funds on the P-chain")
    .option("-n, --node-id <nodeID>", "The staking node's id")
    .option("-a, --amount <amount>", "Amount to stake")
    .option(
      "-s, --start-time <start-time>",
      "Start time of the staking process"
    )
    .option("-e, --end-time <end-time>", "End time of the staking process")
    .action(async (options: OptionValues) => {
      options = { ...options, ...program.opts() };
      const ctx = contextEnv(options.envPath, options.network);
      await stake(
        ctx,
        options.nodeId,
        options.amount,
        options.startTime.startsWith("now+")
          ? parseRelativeTime(options.startTime)
          : options.startTime,
        options.endTime.startsWith("now+")
          ? parseRelativeTime(options.endTime)
          : options.endTime
      );
    });
  // staking using consumer app
  program
    .command("stakeUsingConsumerApp")
    .description(
      "Stake funds on the P-chain by using a consumer app that would help to collect signatures on the raw tx. \n Consumer app configuration should be present in .env file, see .env-template for more information"
    )
    .option("-n, --node-id <nodeID>", "The staking node's id")
    .option("-a, --amount <amount>", "Amount to stake")
    .option(
      "-s, --start-time <start-time>",
      "Start time of the staking process"
    )
    .option("-e, --end-time <end-time>", "End time of the staking process")
    .action(async (options: OptionValues) => {
      options = { ...options, ...program.opts() };
      const ctx = contextEnvWhenConsumerApp(options.envPath, options.network);
      await stakeUsingConsumerApp(
        ctx,
        options.nodeId,
        options.amount,
        options.startTime.startsWith("now+")
          ? parseRelativeTime(options.startTime)
          : options.startTime,
        options.endTime.startsWith("now+")
          ? parseRelativeTime(options.endTime)
          : options.endTime
      );
    });
  // delegating
  program
    .command("delegate")
    .description("Delegate funds on the P-chain")
    .option("-n, --node-id <nodeID>", "The staking node's id")
    .option("-a, --amount <amount>", "Amount to delegate")
    .option(
      "-s, --start-time <start-time>",
      "Start time of the delegation process"
    )
    .option("-e, --end-time <end-time>", "End time of the delegation process")
    .action(async (options: OptionValues) => {
      options = { ...options, ...program.opts() };
      const ctx = contextEnv(options.envPath, options.network);
      await delegate(
        ctx,
        options.nodeId,
        options.amount,
        options.startTime.startsWith("now+")
          ? parseRelativeTime(options.startTime)
          : options.startTime,
        options.endTime.startsWith("now+")
          ? parseRelativeTime(options.endTime)
          : options.endTime
      );
    });
  // delegating using consumer app
  program
    .command("delegateUsingConsumerApp")
    .description(
      "Delegate funds on the P-chain by using a consumer app that would help to collect signatures on the raw tx. \n Consumer app configuration should be present in .env file, see .env-template for more information"
    )
    .option("-n, --node-id <nodeID>", "The staking node's id")
    .option("-a, --amount <amount>", "Amount to delegate")
    .option(
      "-s, --start-time <start-time>",
      "Start time of the delegation process"
    )
    .option("-e, --end-time <end-time>", "End time of the delegation process")
    .action(async (options: OptionValues) => {
      options = { ...options, ...program.opts() };
      const ctx = contextEnvWhenConsumerApp(options.envPath, options.network);
      await delegateUsingConsumerApp(
        ctx,
        options.nodeId,
        options.amount,
        options.startTime.startsWith("now+")
          ? parseRelativeTime(options.startTime)
          : options.startTime,
        options.endTime.startsWith("now+")
          ? parseRelativeTime(options.endTime)
          : options.endTime
      );
    });
  // converting between address formats
  program
    .command("convert")
    .description("Utility for conversion of address formats")
    .argument("<type>", "Type of conversion")
    .option(
      "-p, --public-key <pubk>",
      "User's secp256k1 public key (encoded either 0x02, 0x03 or 0x04)"
    )
    .action((type: string, options: OptionValues) => {
      options = { ...options, ...program.opts() };
      const ctx = contextEnv(options.envPath, options.network);
      if (type == "public-key-to-p-chain-address") {
        getAddressFromPublicKey(ctx, options.publicKey);
      }
    });
}

function getAddressInfo(ctx: Context) {
  const [pubX, pubY] = privateKeyToPublicKey(Buffer.from(ctx.privkHex!, "hex"));
  const compressedPubKey = compressPublicKey(pubX, pubY).toString("hex");
  logger.info(`X-chain address: ${ctx.xAddressBech32}`);
  logger.info(`P-chain address: ${ctx.pAddressBech32}`);
  logger.info(`C-chain address hex: ${ctx.cAddressHex}`);
  logger.info(`secp256k1 public key: 0x${compressedPubKey}`);
}

async function getBalanceInfo(ctx: Context) {
  let cbalance = new BN(
    await ctx.web3.eth.getBalance(ctx.cAddressHex)
  ).toString();
  let pbalance = new BN(
    (await ctx.pchain.getBalance(ctx.pAddressBech32)).balance
  ).toString();
  let xbalance = new BN(
    (await ctx.xchain.getBalance(ctx.xAddressBech32!, ctx.avaxAssetID)).balance
  ).toString();
  cbalance = integerToDecimal(cbalance, 18);
  pbalance = integerToDecimal(pbalance, 9);
  xbalance = integerToDecimal(xbalance, 9);
  logger.info(`${ctx.cAddressHex}: ${cbalance}`);
  logger.info(`${ctx.pAddressBech32}: ${pbalance}`);
  logger.info(`${ctx.xAddressBech32}: ${xbalance}`);
}

function getNetworkInfo(ctx: Context) {
  const pchainId = ctx.pchain.getBlockchainID();
  const cchainId = ctx.cchain.getBlockchainID();
  const xchainId = ctx.xchain.getBlockchainID();
  logger.info(`blockchainId for P-chain: ${pchainId}`);
  logger.info(`blockchainId for C-chain: ${cchainId}`);
  logger.info(`blockchainId for X-chain: ${xchainId}`);
  logger.info(`assetId: ${ctx.avaxAssetID}`);
}

async function getValidatorInfo(ctx: Context) {
  const pending = await ctx.pchain.getPendingValidators();
  const current = await ctx.pchain.getCurrentValidators();
  const fpending = JSON.stringify(pending, null, 2);
  const fcurrent = JSON.stringify(current, null, 2);
  logger.info(`pending: ${fpending}`);
  logger.info(`current: ${fcurrent}`);
}

async function exportCP(ctx: Context, amount: string, fee?: string) {
  const famount: BN = new BN(decimalToInteger(amount, 9));
  const ffee = fee === undefined ? fee : new BN(decimalToInteger(fee, 9));
  const { txid, usedFee } = await exportTxCP(ctx, famount, ffee);
  if (fee !== usedFee) logger.info(`Used fee of ${usedFee}`);
  logger.info(`Success! TXID: ${txid}`);
}

async function exportCPUsingConsumerApp(
  ctx: Context,
  amount: string,
  fee?: string
) {
  const famount: BN = new BN(decimalToInteger(amount, 9));
  const ffee = fee === undefined ? fee : new BN(decimalToInteger(fee, 9));
  const { txid, usedFee } = await exportTxCPUsingConsumerApp(
    ctx,
    famount,
    ffee
  );
  if (fee !== usedFee) logger.info(`Used fee of ${usedFee}`);
  logger.info(`Success! TXID: ${txid}`);
}

async function importCP(ctx: Context) {
  const { txid } = await importTxCP(ctx);
  logger.info(`Success! TXID: ${txid}`);
}

async function importCPUsingConsumerApp(ctx: Context) {
  const { txid } = await importTxCPUsingConsumerApp(ctx);
  logger.info(`Success! TXID: ${txid}`);
}

async function exportPC(ctx: Context, amount?: string) {
  const famount =
    amount === undefined ? amount : new BN(decimalToInteger(amount, 9));
  const { txid } = await exportTxPC(ctx, famount);
  logger.info(`Success! TXID: ${txid}`);
}

async function exportPCUsingConsumerApp(ctx: Context, amount?: string) {
  const famount =
    amount === undefined ? amount : new BN(decimalToInteger(amount, 9));
  const { txid } = await exportTxPCUsingConsumerApp(ctx, famount);
  logger.info(`Success! TXID: ${txid}`);
}

async function importPC(ctx: Context, fee?: string) {
  const ffee = fee === undefined ? fee : new BN(decimalToInteger(fee, 9));
  const { txid, usedFee } = await importTxPC(ctx, ffee);
  if (fee !== usedFee) logger.info(`Used fee of ${usedFee}`);
  logger.info(`Success! TXID: ${txid}`);
}

async function importPCUsingConsumerApp(ctx: Context, fee?: string) {
  const ffee = fee === undefined ? fee : new BN(decimalToInteger(fee, 9));
  const { txid, usedFee } = await importTxPCUsingConsumerApp(ctx, ffee);
  if (fee !== usedFee) logger.info(`Used fee of ${usedFee}`);
  logger.info(`Success! TXID: ${txid}`);
}

async function stake(
  ctx: Context,
  nodeID: string,
  amount: string,
  start: string,
  end: string
) {
  const famount = new BN(decimalToInteger(amount, 9));
  const { txid } = await addValidator(
    ctx,
    nodeID,
    famount,
    new BN(start),
    new BN(end)
  );
  logger.info(`Success! TXID: ${txid}`);
}

async function stakeUsingConsumerApp(
  ctx: Context,
  nodeID: string,
  amount: string,
  start: string,
  end: string
) {
  const famount = new BN(decimalToInteger(amount, 9));
  const { txid } = await addValidatorUsingConsumerApp(
    ctx,
    nodeID,
    famount,
    new BN(start),
    new BN(end)
  );
  logger.info(`Success! TXID: ${txid}`);
}

async function delegate(
  ctx: Context,
  nodeID: string,
  amount: string,
  start: string,
  end: string
) {
  const famount = new BN(decimalToInteger(amount, 9));
  const { txid } = await addDelegator(
    ctx,
    nodeID,
    famount,
    new BN(start),
    new BN(end)
  );
  logger.info(`Success! TXID: ${txid}`);
}

async function delegateUsingConsumerApp(
  ctx: Context,
  nodeID: string,
  amount: string,
  start: string,
  end: string
) {
  const famount = new BN(decimalToInteger(amount, 9));
  const { txid } = await addDelegatorUsingConsumerApp(
    ctx,
    nodeID,
    famount,
    new BN(start),
    new BN(end)
  );
  logger.info(`Success! TXID: ${txid}`);
}

function getAddressFromPublicKey(ctx: Context, pubk: string) {
  const address = publicKeyToBech32AddressString(ctx.config.hrp, pubk);
  logger.info(`P-chain address: P-${address}`);
}

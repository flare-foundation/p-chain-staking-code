import { Context } from "./constants";
import { BN, Buffer } from "@flarenetwork/flarejs/dist";
import {
  UTXOSet,
  UnsignedTx,
  Tx,
} from "@flarenetwork/flarejs/dist/apis/platformvm";
import { UnixNow } from "@flarenetwork/flarejs/dist//utils";

/**
 * Import funds exported from C-chain to P-chain to P-chain
 * @param ctx - context with constants initialized from user keys
 */
export async function importTxCP(ctx: Context): Promise<{ txid: string }> {
  const { unsignedTx } = await generateUnsignedTxImportTxCP(ctx);
  const tx: Tx = unsignedTx.sign(ctx.pKeychain!);
  const txid: string = await ctx.pchain.issueTx(tx);
  return { txid: txid };
}

/**
 * Import funds exported from C-chain to P-chain to P-chain
 * @param ctx - context with constants initialized from user keys
 */
async function generateUnsignedTxImportTxCP(
  ctx: Context
): Promise<{ unsignedTx: UnsignedTx }> {
  const threshold = 1;
  const locktime: BN = new BN(0);
  const memo: Buffer = Buffer.from(
    "PlatformVM utility method buildImportTx to import AVAX to the P-Chain from the C-Chain"
  );
  const asOf: BN = UnixNow();
  const platformVMUTXOResponse: any = await ctx.pchain.getUTXOs(
    [ctx.pAddressBech32],
    ctx.cChainBlockchainID
  );
  const utxoSet: UTXOSet = platformVMUTXOResponse.utxos;
  const unsignedTx: UnsignedTx = await ctx.pchain.buildImportTx(
    utxoSet,
    [ctx.pAddressBech32],
    ctx.cChainBlockchainID,
    [ctx.pAddressBech32],
    [ctx.pAddressBech32],
    [ctx.pAddressBech32],
    memo,
    asOf,
    locktime,
    threshold
  );
  return { unsignedTx: unsignedTx };
}

/**
 * Import funds exported from C-chain to P-chain to P-chain
 * @param ctx - context with constants initialized from user keys
 */
export async function importTxCPUsingConsumerApp(
  ctx: Context
): Promise<{ txid: string }> {
  const { unsignedTx } = await generateUnsignedTxImportTxCP(ctx);

  // TODO: Transaction send to the Consumer app.
  const tx: Tx = await sendToSign(unsignedTx, obj);
  const txid: string = await ctx.pchain.issueTx(tx);
  return { txid: txid };
}

/**
 * Export funds from P-chain to C-chain.
 * @param ctx - context with constants initialized from user keys
 * @param amount - amount to export (if left undefined, it exports all funds on P-chain)
 */
export async function exportTxPC(
  ctx: Context,
  amount?: BN
): Promise<{ txid: string }> {
  const { unsignedTx } = await generateUnsignedTxExportTxPC(ctx, amount);
  const tx: Tx = unsignedTx.sign(ctx.pKeychain!);
  const txid: string = await ctx.pchain.issueTx(tx);
  return { txid: txid };
}

/**
 * Export funds from P-chain to C-chain.
 * @param ctx - context with constants initialized from user keys
 * @param amount - amount to export (if left undefined, it exports all funds on P-chain)
 */
async function generateUnsignedTxExportTxPC(
  ctx: Context,
  amount?: BN
): Promise<{ unsignedTx: UnsignedTx }> {
  const threshold: number = 1;
  const locktime: BN = new BN(0);
  const memo: Buffer = Buffer.from(
    "PlatformVM utility method buildExportTx to export FLR from the P-Chain to the C-Chain"
  );
  const asOf: BN = UnixNow();
  const platformVMUTXOResponse: any = await ctx.pchain.getUTXOs([
    ctx.pAddressBech32,
  ]);
  const utxoSet: UTXOSet = platformVMUTXOResponse.utxos;
  const fee = ctx.pchain.getDefaultTxFee();

  if (amount === undefined) {
    const getBalanceResponse: any = await ctx.pchain.getBalance(
      ctx.pAddressBech32
    );
    const unlocked = new BN(getBalanceResponse.unlocked);
    amount = unlocked.sub(fee);
  }

  const unsignedTx: UnsignedTx = await ctx.pchain.buildExportTx(
    utxoSet,
    amount,
    ctx.cChainBlockchainID,
    [ctx.cAddressBech32],
    [ctx.pAddressBech32],
    [ctx.pAddressBech32],
    memo,
    asOf,
    locktime,
    threshold
  );
  return { unsignedTx: unsignedTx };
}

/**
 * Export funds from P-chain to C-chain.
 * @param ctx - context with constants initialized from user keys
 * @param amount - amount to export (if left undefined, it exports all funds on P-chain)
 */
export async function exportTxPCUsingConsumerApp(
  ctx: Context,
  amount?: BN
): Promise<{ txid: string }> {
  const { unsignedTx } = await generateUnsignedTxExportTxPC(ctx, amount);

  // TODO: Transaction send to the Consumer app.
  const tx: Tx = await sendToSign(unsignedTx, obj);
  const txid: string = await ctx.pchain.issueTx(tx);
  return { txid: txid };
}

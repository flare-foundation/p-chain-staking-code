import { Context } from "./constants";
import { BN, Buffer } from "@flarenetwork/flarejs/dist";
import {
  UTXOSet,
  UnsignedTx,
  Tx,
  PlatformVMAPI,
} from "@flarenetwork/flarejs/dist/apis/platformvm";
import { UnixNow } from "@flarenetwork/flarejs/dist/utils";

export async function addDelegator(
  ctx: Context,
  nodeID: string,
  stakeAmount: BN,
  startTime: BN,
  endTime: BN
): Promise<{ txid: string }> {
  const unsignedTx: UnsignedTx = (
    await generateAddDelegatorUnsignedTx(
      ctx,
      nodeID,
      stakeAmount,
      startTime,
      endTime
    )
  ).unsignedTx;

  const tx: Tx = unsignedTx.sign(ctx.pKeychain!);
  const txid: string = await ctx.pchain.issueTx(tx);
  return { txid: txid };
}

async function generateAddDelegatorUnsignedTx(
  ctx: Context,
  nodeID: string,
  stakeAmount: BN,
  startTime: BN,
  endTime: BN
): Promise<{ unsignedTx: UnsignedTx }> {
  const threshold: number = 1;
  const locktime: BN = new BN(0);
  const memo: Buffer = Buffer.from(
    "PlatformVM utility method buildAddDelegatorTx to add a delegator to the primary subnet"
  );
  const asOf: BN = UnixNow();
  const platformVMUTXOResponse: any = await ctx.pchain.getUTXOs(
    ctx.pAddressBech32
  );
  const utxoSet: UTXOSet = platformVMUTXOResponse.utxos;

  const unsignedTx: UnsignedTx = await ctx.pchain.buildAddDelegatorTx(
    utxoSet,
    [ctx.pAddressBech32],
    [ctx.pAddressBech32],
    [ctx.pAddressBech32],
    nodeID,
    startTime,
    endTime,
    stakeAmount,
    [ctx.pAddressBech32],
    locktime,
    threshold,
    memo,
    asOf
  );

  return { unsignedTx: unsignedTx };
}

export async function addDelegatorUsingConsumerApp(
  ctx: Context,
  nodeID: string,
  stakeAmount: BN,
  startTime: BN,
  endTime: BN
): Promise<{ txid: string }> {
  const unsignedTx: UnsignedTx = (
    await generateAddDelegatorUnsignedTx(
      ctx,
      nodeID,
      stakeAmount,
      startTime,
      endTime
    )
  ).unsignedTx;

  // TODO: Transaction send to the Consumer app.
  const tx: Tx = await sendToSign(unsignedTx, obj);
  const txid: string = await ctx.pchain.issueTx(tx);
  return { txid: txid };
}

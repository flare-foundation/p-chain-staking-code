import { Context } from "./constants";
import { BN, Buffer } from "@flarenetwork/flarejs/dist";
import {
  UTXOSet,
  UnsignedTx,
  Tx,
} from "@flarenetwork/flarejs/dist/apis/platformvm";
import { UnixNow } from "@flarenetwork/flarejs/dist/utils";

/**
 * Stake by registring your node for validation
 * @param ctx - context with constants initialized from user keys
 * @param nodeID - id of the node you are running (can get it via rpc call)
 * @param stakeAmount - the amount of funds to stake during the node's validation
 * @param stakeDuration - the duration of the node's validation
 */
export async function addValidator(
  ctx: Context,
  nodeID: string,
  stakeAmount: BN,
  startTime: BN,
  endTime: BN
): Promise<{ txid: string }> {
  const unsignedTx: UnsignedTx = (
    await generateAddValidatorUnsignedTx(
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

async function generateAddValidatorUnsignedTx(
  ctx: Context,
  nodeID: string,
  stakeAmount: BN,
  startTime: BN,
  endTime: BN
): Promise<{ unsignedTx: UnsignedTx }> {
  const threshold = 1;
  const locktime: BN = new BN(0);
  const memo: Buffer = Buffer.from(
    "PlatformVM utility method buildAddValidatorTx to add a validator to the primary subnet"
  );
  const asOf: BN = UnixNow();
  const delegationFee = 10;
  // const stakeAmount: any = (await pchain.getMinStake()).minValidatorStake
  const platformVMUTXOResponse: any = await ctx.pchain.getUTXOs(
    ctx.pAddressBech32
  );
  const utxoSet: UTXOSet = platformVMUTXOResponse.utxos;

  const unsignedTx: UnsignedTx = await ctx.pchain.buildAddValidatorTx(
    utxoSet,
    [ctx.pAddressBech32],
    [ctx.pAddressBech32],
    [ctx.pAddressBech32],
    nodeID,
    startTime,
    endTime,
    stakeAmount,
    [ctx.pAddressBech32],
    delegationFee,
    locktime,
    threshold,
    memo,
    asOf
  );
  return { unsignedTx: unsignedTx };
}

export async function addValidatorUsingConsumerApp(
  ctx: Context,
  nodeID: string,
  stakeAmount: BN,
  startTime: BN,
  endTime: BN
): Promise<{ txid: string }> {
  const unsignedTx: UnsignedTx = (
    await generateAddValidatorUnsignedTx(
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

import fs from 'fs'
import chalk from 'chalk'
import { Command } from 'commander'
import { BN } from '@flarenetwork/flarejs/dist'
import {
  ClaimRewardsInterface,
  ConnectWalletInterface, Context, ContextFile, DelegationDetailsInterface, DerivedAddress,
  RegisterAddressInterface, ScreenConstantsInterface, OptOutOfAirdropInterface
} from '../interfaces'
import { taskConstants, walletConstants } from "../constants/screen"
import { contextEnv, contextFile, getContext, hrpFromNetworkConfig, updateNetworkUrl } from "../context"
import { prompts } from "./prompts"
import { claimRewards, isAddressRegistered, isUnclaimedReward, registerAddress, optOutOfAirdrop } from "../contracts"
import { getPathsAndAddresses } from '../ledger/utils'
import { compressPublicKey, publicKeyToBech32AddressString, publicKeyToEthereumAddressString, waitFinalize } from "../utils"
import { cli, initCtxJsonFromOptions } from '../cli'
import { logInfo } from '../output'


const DEFAULT_EVM_TX_FEE = new BN(1)

/***
 * @description Handles all operations pertaining to the interactive CLL. Creates a list of arguments and internally calls the comamnder based CLI after taking the relevant inputs from the user.
 * @param baseargv List of base arguments passed to the application to invoke the interactive CLI
 * @returns {void}
 */
export async function interactiveCli(baseargv: string[]) {
  let initialised = false
  let walletProperties: ConnectWalletInterface | null = null;
  while (true) {
    if (!initialised) {
      walletProperties = await connectWallet();
      initialised = true
    }
    if (!walletProperties) {
      throw new Error("Cannot connect to wallet")
    }
    const task = await selectTask()
    const program = new Command("Flare Stake Tool")
    await cli(program)

    // First 4 info functions
    if (Object.keys(taskConstants).slice(0, 4).includes(task.toString())) {

      if (walletProperties.wallet == Object.keys(walletConstants)[0] || walletProperties.wallet == Object.keys(walletConstants)[1]) {
        const argsInfo = [...baseargv.slice(0, 2), "info", taskConstants[task], `--ctx-file=ctx.json`]
        await program.parseAsync(argsInfo)
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.path && walletProperties.network) {
        const argsInfo = [...baseargv.slice(0, 2), "info", taskConstants[task], `--env-path=${walletProperties.path}`, `--network=${walletProperties.network}`, "--get-hacked"]
        await program.parseAsync(argsInfo)
      }
      else {
        console.log("Incorrect arguments passed!")
      }
    }

    // Functions for export and import to move funds between chains
    else if (Object.keys(taskConstants).slice(4, 6).includes(task.toString())) {

      if (walletProperties.wallet == Object.keys(walletConstants)[0] && fileExists("ctx.json")) {
        const { network: ctxNetwork, derivationPath: ctxDerivationPath, publicKey } = readInfoFromCtx("ctx.json")
        if (ctxNetwork && ctxDerivationPath) {
          const amount = await prompts.amount()
          const argsExport = [...baseargv.slice(0, 2), "transaction", `export${taskConstants[task].slice(-2)}`, '-a', `${amount.amount}`, "--blind", "true", "--derivation-path", ctxDerivationPath, `--network=${ctxNetwork}`, "--ledger"]
          // ask for fees if its exportCP transaction
          if (taskConstants[task].slice(0, 1) == 'C') {
            const exportFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
            argsExport.push('-f', `${exportFees.fees}`)
            // for exportCP we wait for the finalization before doing import
            await waitFinalize<any>(getContext(ctxNetwork, publicKey), program.parseAsync(argsExport))
            console.log(chalk.green("Transaction finalized!"))
          } else {
            await program.parseAsync(argsExport)
          }
          const argsImport = [...baseargv.slice(0, 2), "transaction", `import${taskConstants[task].slice(-2)}`, "--blind", "true", "--derivation-path", ctxDerivationPath, `--network=${ctxNetwork}`, "--ledger"]
          // ask for fees if its importTxPC
          if (taskConstants[task].slice(0, 1) == 'P') {
            const importFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
            argsImport.push('-f', `${importFees.fees}`)
          }
          console.log("Please approve import transaction")
          await program.parseAsync(argsImport)
        }
        else {
          console.log("Missing params in ctx file")
        }
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[1] && fileExists("ctx.json")) {
        const { network: ctxNetwork, vaultId: ctxVaultId, publicKey: ctxPublicKey } = readInfoFromCtx("ctx.json")
        if (ctxNetwork && ctxVaultId && ctxPublicKey) {
          const isContinue = await prompts.forDefiContinue()
          if (!isContinue.isContinue) {
            const txnType = await prompts.forDefiTxn()
            const txnId = await prompts.transactionId()
            if (txnType.txn.includes("Export")) {
              const amount = await prompts.amount()
              const argsExport = [...baseargv.slice(0, 2), "transaction", `export${taskConstants[task].slice(-2)}`, '-a', `${amount.amount}`, "-i", `${txnId.id}`]
              // ask for fees if its exportCP transaction
              if (taskConstants[task].slice(0, 1) == 'C') {
                const exportFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
                argsExport.push('-f', `${exportFees.fees}`)
              }
              await program.parseAsync(argsExport)
            }
            else if (txnType.txn.includes("Import")) {
              const argsImport = [...baseargv.slice(0, 2), "transaction", `import${taskConstants[task].slice(-2)}`, "-i", `${txnId.id}`]
              // ask for fees if its importTxPC
              if (taskConstants[task].slice(0, 1) == 'P') {
                const exportFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
                argsImport.push('-f', `${exportFees.fees}`)
              }
              await program.parseAsync(argsImport)
            }
            const argsSign = makeForDefiArguments("sign", baseargv, txnId.id)
            await program.parseAsync(argsSign)
          }
          else {
            const txnId = await prompts.transactionId()
            const argsFetch = makeForDefiArguments("fetch", baseargv, txnId.id)
            await program.parseAsync(argsFetch)
            const argsSend = makeForDefiArguments("send", baseargv, txnId.id)
            await program.parseAsync(argsSend)
          }
        }
        else {
          console.log("Missing params in ctx file")
        }
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.network && walletProperties.path) {
        // // explicitly throw error when ctx.json doesn't exist
        const amount = await prompts.amount()
        const argsExport = [...baseargv.slice(0, 2), "transaction", `export${taskConstants[task].slice(-2)}`, '-a', `${amount.amount}`, `--env-path=${walletProperties.path}`, `--network=${walletProperties.network}`, "--get-hacked"]
        // ask for fees if its exportCP transaction
        if (taskConstants[task].slice(0, 1) == 'C') {
          const exportFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
          argsExport.push('-f', `${exportFees.fees}`)
          await waitFinalize<any>(contextEnv(walletProperties.path, walletProperties.network), program.parseAsync(argsExport))
          console.log(chalk.green("Transaction finalized!"))
        } else {
          await program.parseAsync(argsExport)
        }
        const argsImport = [...baseargv.slice(0, 2), "transaction", `import${taskConstants[task].slice(-2)}`, `--env-path=${walletProperties.path}`, `--network=${walletProperties.network}`, "--get-hacked"]
        // ask for fees if its importTxPC
        if (taskConstants[task].slice(0, 1) == 'P') {
          const exportFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
          argsImport.push('-f', `${exportFees.fees}`)
        }
        await program.parseAsync(argsImport)
      }
      else {
        console.log("Incorrect arguments passed!")
      }
    }

    // Adding a validator
    else if (Object.keys(taskConstants)[6] == task.toString()) {
      if (walletProperties.wallet == Object.keys(walletConstants)[0] && fileExists("ctx.json")) {
        const { network: ctxNetwork, derivationPath: ctxDerivationPath, publicKey: ctxPublicKey } = readInfoFromCtx("ctx.json")
        const ctxPAddress = "P-" + publicKeyToBech32AddressString(ctxPublicKey, ctxNetwork)
        const ctxCAddress = publicKeyToEthereumAddressString(ctxPublicKey)
        if (ctxNetwork && ctxDerivationPath && ctxPAddress && ctxCAddress) {

          await checkAddressRegistrationLedger(walletProperties.wallet, ctxNetwork, ctxDerivationPath, ctxCAddress, ctxPublicKey, ctxPAddress)

          const { amount, nodeId, startTime, endTime, delegationFee } = await getDetailsForDelegation(taskConstants[task])
          if (ctxNetwork && ctxDerivationPath && delegationFee) {
            const argsValidator = [...baseargv.slice(0, 2), "transaction", taskConstants[task], '-n', `${nodeId}`, '-a', `${amount}`, '-s', `${startTime}`, '-e', `${endTime}`, '--delegation-fee', `${delegationFee}`, "--blind", "true", "--derivation-path", ctxDerivationPath, `--network=${ctxNetwork}`, "--ledger"]
            await program.parseAsync(argsValidator)
          } else {
            console.log("Missing values for certain params")
          }
        }
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[1] && fileExists("ctx.json")) {
        const { network: ctxNetwork, vaultId: ctxVaultId, publicKey: ctxPublicKey, networkUrl } = readInfoFromCtx("ctx.json")
        if (ctxNetwork && ctxVaultId && ctxPublicKey) {
          const isContinue = await prompts.forDefiContinue()
          if (!isContinue.isContinue) {

            const isRegistered: boolean = await checkAddressRegistrationForDefi(ctxNetwork)

            let txnId
            if (isRegistered) {
              txnId = await prompts.transactionId()
              txnId = txnId.id
              const { amount, nodeId, startTime, endTime, delegationFee } = await getDetailsForDelegation(taskConstants[task])
              const argsValidator = [...baseargv.slice(0, 2), "transaction", taskConstants[task], '-n', `${nodeId}`, `--network=${walletProperties.network}`, '-a', `${amount}`, '-s', `${startTime}`, '-e', `${endTime}`, '--delegation-fee', `${delegationFee}`, "-i", `${txnId}`]
              if (networkUrl) {
                argsValidator.push("--network-url", networkUrl)
              }
              await program.parseAsync(argsValidator)
            }
            else {
              txnId = await registerAddressForDefi(walletProperties.wallet, ctxNetwork, ctxPublicKey)
            }

            const argsSign = makeForDefiArguments("sign", baseargv, txnId)
            await program.parseAsync(argsSign)
          }
          else {
            const txnId = await prompts.transactionId()
            const argsFetch = makeForDefiArguments("fetch", baseargv, txnId.id)
            await program.parseAsync(argsFetch)
            const argsSend = makeForDefiArguments("send", baseargv, txnId.id)
            await program.parseAsync(argsSend)
          }
        }
        else {
          console.log("Missing params in ctx file")
        }
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.network && walletProperties.path) {

        await checkAddressRegistrationPrivateKey(walletProperties.wallet, walletProperties.network!, walletProperties.path!)

        const { amount, nodeId, startTime, endTime, delegationFee } = await getDetailsForDelegation(taskConstants[task])
        const argsValidator = [...baseargv.slice(0, 2), "transaction", taskConstants[task], '-n', `${nodeId}`, `--network=${walletProperties.network}`, '-a', `${amount}`, '-s', `${startTime}`, '-e', `${endTime}`, '--delegation-fee', `${delegationFee}`, `--env-path=${walletProperties.path}`, "--get-hacked"]
        await program.parseAsync(argsValidator)
      }
      else {
        console.log("only pvt key and ledger supported for staking right now")
      }
    }

    // Delegating to a Validator
    else if (Object.keys(taskConstants)[7] == task.toString()) {

      if (walletProperties.wallet == Object.keys(walletConstants)[0] && fileExists("ctx.json")) {
        const { network: ctxNetwork, derivationPath: ctxDerivationPath, ethAddress: ctxCAddress,
          publicKey: ctxPublicKey, flareAddress: ctxPAddress } = readInfoFromCtx("ctx.json")
        if (ctxNetwork && ctxDerivationPath && ctxPAddress && ctxCAddress) {

          await checkAddressRegistrationLedger(walletProperties.wallet, ctxNetwork, ctxDerivationPath, ctxCAddress, ctxPublicKey, ctxPAddress)

          const { amount, nodeId, startTime, endTime } = await getDetailsForDelegation(taskConstants[task])
          const argsDelegate = [...baseargv.slice(0, 2), "transaction", taskConstants[task], '-n', `${nodeId}`, '-a', `${amount}`, '-s', `${startTime}`, '-e', `${endTime}`, "--blind", "true", "--derivation-path", ctxDerivationPath, `--network=${ctxNetwork}`, "--ledger"]
          await program.parseAsync(argsDelegate)
        } else {
          console.log("Missing params in ctx file")
        }
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[1] && fileExists("ctx.json")) {
        const { network: ctxNetwork, vaultId: ctxVaultId, publicKey: ctxPublicKey } = readInfoFromCtx("ctx.json")
        if (ctxNetwork && ctxVaultId && ctxPublicKey) {
          const isContinue = await prompts.forDefiContinue()
          if (!isContinue.isContinue) {

            const isRegistered: boolean = await checkAddressRegistrationForDefi(ctxNetwork)

            let txnId
            if (isRegistered) {
              txnId = await prompts.transactionId()
              txnId = txnId.id
              const { amount, nodeId, startTime, endTime } = await getDetailsForDelegation(taskConstants[task])
              const argsDelegate = [...baseargv.slice(0, 2), "transaction", taskConstants[task], '-n', `${nodeId}`, `--network=${walletProperties.network}`, '-a', `${amount}`, '-s', `${startTime}`, '-e', `${endTime}`, "-i", `${txnId}`]
              await program.parseAsync(argsDelegate)
            }
            else {
              txnId = await registerAddressForDefi(walletProperties.wallet, ctxNetwork, ctxPublicKey)
            }

            const argsSign = makeForDefiArguments("sign", baseargv, txnId)
            await program.parseAsync(argsSign)
          }
          else {
            const txnId = await prompts.transactionId()
            const argsFetch = makeForDefiArguments("fetch", baseargv, txnId.id)
            await program.parseAsync(argsFetch)
            const argsSend = makeForDefiArguments("send", baseargv, txnId.id)
            await program.parseAsync(argsSend)
          }
        }
        else {
          console.log("Missing params in ctx file")
        }
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.network && walletProperties.path) {

        await checkAddressRegistrationPrivateKey(walletProperties.wallet, walletProperties.network!, walletProperties.path!)

        const { amount, nodeId, startTime, endTime } = await getDetailsForDelegation(taskConstants[task])
        const argsDelegate = [...baseargv.slice(0, 2), "transaction", taskConstants[task], '-n', `${nodeId}`, `--network=${walletProperties.network}`, '-a', `${amount}`, '-s', `${startTime}`, '-e', `${endTime}`, `--env-path=${walletProperties.path}`, "--get-hacked"]
        await program.parseAsync(argsDelegate)
      }
      else {
        console.log("only pvt key and ledger supported for delegation right now")
      }
    }

    // Mirror funds
    else if (Object.keys(taskConstants)[8] == (task.toString())) {

      if (walletProperties.wallet == Object.keys(walletConstants)[0] || walletProperties.wallet == Object.keys(walletConstants)[1]) {
        const argsInfo = [...baseargv.slice(0, 2), "info", taskConstants[task], `--ctx-file=ctx.json`]
        await program.parseAsync(argsInfo)
      }
      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.path && walletProperties.network) {
        const argsInfo = [...baseargv.slice(0, 2), "info", taskConstants[task], `--env-path=${walletProperties.path}`, `--network=${walletProperties.network}`, "--get-hacked"]
        await program.parseAsync(argsInfo)
      }
      else {
        console.log("Incorrect arguments passed!")
      }
    }

    // Claim Rewards
    else if (Object.keys(taskConstants)[9] == task.toString()) {
      if (walletProperties.wallet == Object.keys(walletConstants)[0] && fileExists("ctx.json")) {
        const { network: ctxNetwork, derivationPath: ctxDerivationPath, ethAddress: ctxCAddress } = readInfoFromCtx("ctx.json")
        const isUnclaimed = await isUnclaimedReward(ctxCAddress!, ctxNetwork)
        if (isUnclaimed) await claimRewardsLedger(walletProperties.wallet, ctxCAddress!, ctxDerivationPath!, ctxNetwork)
      }

      else if (walletProperties.wallet == Object.keys(walletConstants)[1] && fileExists("ctx.json")) {
        const context: Context = contextFile("ctx.json")
        const isUnclaimed = await isUnclaimedReward(context.cAddressHex!, context.config.hrp)
        if (isUnclaimed) {
          const isContinue = await prompts.forDefiContinue()
          const txnId = await prompts.transactionId()
          if (!isContinue.isContinue) {
            await claimRewardsForDefi(walletProperties.wallet, txnId.id)
            const argsSign = makeForDefiArguments("sign", baseargv, txnId.id)
            await program.parseAsync(argsSign)
          }
          else {
            const argsFetch = makeForDefiArguments("fetch", baseargv, txnId.id)
            await program.parseAsync(argsFetch)
            const argsSend = makeForDefiArguments("send", baseargv, txnId.id)
            await program.parseAsync(argsSend)
          }
        }
      }

      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.network && walletProperties.path) {
        const context: Context = contextEnv(walletProperties.path, walletProperties.network)
        const isUnclaimed = await isUnclaimedReward(context.cAddressHex!, context.config.hrp)
        if (isUnclaimed) await claimRewardsPrivateKey(walletProperties.wallet, context)
      }
    }

    // Withdraw funds
    else if (Object.keys(taskConstants)[10] == task.toString()) {
      if (walletProperties.wallet == Object.keys(walletConstants)[1] && fileExists("ctx.json")) {
        const isContinue = await prompts.forDefiContinue()
        const txnId = await prompts.transactionId()
        if (!isContinue.isContinue) {
          const amount = await prompts.amount()
          const withdrawAddress = await prompts.withdrawAddress()
          const argsWithdraw = [...baseargv.slice(0, 2), taskConstants[task], '-a', `${amount.amount}`, "-t", `${withdrawAddress.address}`, "-i", `${txnId.id}`]
          await program.parseAsync(argsWithdraw)
          const argsSign = [...makeForDefiArguments("sign", baseargv, txnId.id), "--withdrawal"]
          await program.parseAsync(argsSign)
        }
        else {
          const argsFetch = [...makeForDefiArguments("fetch", baseargv, txnId.id), "--withdrawal"]
          await program.parseAsync(argsFetch)
          const argsSend = [...baseargv.slice(0, 2), taskConstants[task], "-i", `${txnId.id}`, "--send-signed-tx"]
          await program.parseAsync(argsSend)
        }
      }
      else {
        throw new Error("Only Defi wallet supported for withdrawal, otherwise this is a standard ethereum transaction, for which you can use metamask.")
      }
    }

    else if (Object.keys(taskConstants)[11] == task.toString()) {
      const importDestChain = await prompts.importTrxType()
      let trxType;
      if (importDestChain.type == 'P')
        trxType = 'CP'
      if (importDestChain.type == 'C')
        trxType = 'PC'

      if (walletProperties.wallet == Object.keys(walletConstants)[0] && fileExists("ctx.json")) {
        const { network: ctxNetwork, derivationPath: ctxDerivationPath } = readInfoFromCtx("ctx.json")
        if (ctxNetwork && ctxDerivationPath) {
          const argsImport = [...baseargv.slice(0, 2), "transaction", `import${trxType}`, "--blind", "true", "--derivation-path", ctxDerivationPath, `--network=${ctxNetwork}`, "--ledger"]
          // ask for fees if its importTxPC
          if (importDestChain.type == 'C') {
            const importFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
            argsImport.push('-f', `${importFees.fees}`)
          }
          console.log("Please approve import transaction")
          await program.parseAsync(argsImport)
        }
        else {
          console.log("Missing params in ctx file")
        }
      }

      else if (walletProperties.wallet == Object.keys(walletConstants)[1] && fileExists("ctx.json")) {
        const { network: ctxNetwork, vaultId: ctxVaultId, publicKey: ctxPublicKey } = readInfoFromCtx("ctx.json")
        if (ctxNetwork && ctxVaultId && ctxPublicKey) {
          const isContinue = await prompts.forDefiContinue()
          if (!isContinue.isContinue) {
            const txnId = await prompts.transactionId()
            const argsImport = [...baseargv.slice(0, 2), "transaction", `import${trxType}`, "-i", `${txnId.id}`]
            // ask for fees if its importTxPC
            if (importDestChain.type == 'C') {
              const exportFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
              argsImport.push('-f', `${exportFees.fees}`)
            }
            await program.parseAsync(argsImport)
            const argsSign = makeForDefiArguments("sign", baseargv, txnId.id)
            await program.parseAsync(argsSign)
          } else {
            const txnId = await prompts.transactionId()
            const argsFetch = makeForDefiArguments("fetch", baseargv, txnId.id)
            await program.parseAsync(argsFetch)
            const argsSend = makeForDefiArguments("send", baseargv, txnId.id)
            await program.parseAsync(argsSend)
          }
        }
        else {
          console.log("Missing params in ctx file")
        }
      }

      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.network && walletProperties.path) {
        const argsImport = [...baseargv.slice(0, 2), "transaction", `import${trxType}`, `--env-path=${walletProperties.path}`, `--network=${walletProperties.network}`, "--get-hacked"]
        // ask for fees if its importTxPC
        if (importDestChain.type == 'C') {
          const importFees = await prompts.fees(DEFAULT_EVM_TX_FEE);
          argsImport.push('-f', `${importFees.fees}`)
        }
        console.log("Please approve import transaction")
        await program.parseAsync(argsImport)
      }
      else {
        console.log("Incorrect arguments passed!")
      }
    }

    // Optout
    else if (Object.keys(taskConstants)[12] == task.toString()) {
      if (walletProperties.wallet == Object.keys(walletConstants)[0] && fileExists("ctx.json")) {
        const { network: ctxNetwork, derivationPath: ctxDerivationPath } = readInfoFromCtx("ctx.json")
        const argsOptOut = [...baseargv.slice(0, 2), "opt-out", `--network=${ctxNetwork}`, "--ledger", `--derivation-path=${ctxDerivationPath!}`]
        try {
          await program.parseAsync(argsOptOut)
        } catch (error: any) {
          console.log(chalk.red(error.message))
        }
      }

      else if (walletProperties.wallet == Object.keys(walletConstants)[1] && fileExists("ctx.json")) {
        const isContinue = await prompts.forDefiContinue()
        const txnId = await prompts.transactionId()
        try {
          if (!isContinue.isContinue) {
            const { network: ctxNetwork } = readInfoFromCtx("ctx.json")
            const argsOptOut = [...baseargv.slice(0, 2), "opt-out", `--network=${ctxNetwork}`, `-i`, `${txnId.id}`]
            await program.parseAsync(argsOptOut)
            const argsSign = makeForDefiArguments("sign", baseargv, txnId.id)
            await program.parseAsync(argsSign)
          }
          else {
            const argsFetch = makeForDefiArguments("fetch", baseargv, txnId.id)
            await program.parseAsync(argsFetch)
            const argsSend = makeForDefiArguments("send", baseargv, txnId.id)
            await program.parseAsync(argsSend)
          }
        } catch (error: any) {
          console.log(chalk.red(error.message))
        }
      }

      else if (walletProperties.wallet == Object.keys(walletConstants)[2] && walletProperties.network && walletProperties.path) {
        const argsOptOut = [...baseargv.slice(0, 2), "opt-out", `--env-path=${walletProperties.path}`, `--network=${walletProperties.network}`, "--get-hacked"]
        try {
          await program.parseAsync(argsOptOut)
        } catch (error: any) {
          console.log(chalk.red(error.message))
        }
      }
    }

    // exit the interactive cli
    else if (Object.keys(taskConstants)[13] == task.toString()) {
      // exit the application
      logInfo('Exiting interactive cli.')
      process.exit(0)
    }

    else {
      console.log("Task not supported")
    }
  }
}

async function connectWallet(): Promise<ConnectWalletInterface> {
  const walletPrompt = await prompts.connectWallet()
  const wallet: string = walletPrompt.wallet

  if (wallet == Object.keys(walletConstants)[2]) {
    const pvtKeyPath = await prompts.pvtKeyPath()
    const path = pvtKeyPath.pvtKeyPath
    const network = await selectNetwork()
    return { wallet, path, network }
  }
  else if (wallet == Object.keys(walletConstants)[1]) {
    const isCreateCtx = await getCtxStatus(wallet)

    if (isCreateCtx) {
      const publicKey = await prompts.publicKey()
      const network = await selectNetwork()
      const networkUrl = await selectNetworkUrl(network)
      const vaultId = await prompts.vaultId()
      const optionsObject = {
        network,
        networkUrl,
        blind: false,
        ctxFile: 'ctx.json',
        publicKey: publicKey.publicKey,
        vaultId: vaultId.id
      }
      await initCtxJsonFromOptions(optionsObject)
    }

    return { wallet }
  }
  else if (wallet == Object.keys(walletConstants)[0]) {
    const isCreateCtx = await getCtxStatus(wallet)
    let network
    if (isCreateCtx) {
      network = await selectNetwork()
      const networkUrl = await selectNetworkUrl(network)
      const selectedDerivationPath = await selectDerivationPath(network)

      const optionsObject = {
        network,
        networkUrl,
        blind: false,
        ctxFile: 'ctx.json',
        ledger: true
      }
      await initCtxJsonFromOptions(optionsObject, selectedDerivationPath)
    }

    return { wallet }
  }
  else {
    return { wallet }
  }
}

async function selectNetwork() {
  const network = await prompts.selectNetwork()
  return network.network
}

async function selectNetworkUrl(network: string): Promise<string> {
  if (network == "costwo-staging" || network == "coston-staging") {
    const networkUrl = await prompts.selectNetworkUrl()
    return networkUrl.networkUrl
  }
  return '';
}


async function selectTask(): Promise<keyof ScreenConstantsInterface> {
  const task = await prompts.selectTask()
  return task.task
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function readInfoFromCtx(filePath: string): ContextFile {

  const ctxContent = fs.readFileSync('ctx.json', 'utf-8')
  const ctxData = JSON.parse(ctxContent)

  const wallet = ctxData.wallet
  const publicKey = ctxData.publicKey
  const network = ctxData.network
  const ethAddress = publicKeyToEthereumAddressString(publicKey)
  const flareAddress = "P-" + publicKeyToBech32AddressString(publicKey, hrpFromNetworkConfig(network))
  const derivationPath = ctxData.derivationPath || undefined
  const vaultId = ctxData.vaultId || undefined
  const networkUrl = ctxData.networkUrl || undefined

  updateNetworkUrl(network, networkUrl)
  return { wallet, publicKey, network, ethAddress, flareAddress, derivationPath, vaultId, networkUrl }
}

async function createChoicesFromAddress(pathList: DerivedAddress[]) {
  const choiceList: string[] = []

  for (let i = 0; i < 10; i++) {
    const choice = pathList[i].ethAddress
    choiceList.push(`${i + 1}. ${choice}`)
  }

  return choiceList
}

async function getCtxStatus(wallet: string): Promise<boolean> {
  let isCreateCtx = true
  const isFileExist: boolean = fileExists("ctx.json");

  if (isFileExist) {
    const { wallet: ctxWallet, network: ctxNetwork, publicKey: ctxPublicKey, ethAddress: ctxEthAddress, vaultId: ctxVaultId,
      networkUrl: ctxNetworkUrl } = readInfoFromCtx("ctx.json")
    if (wallet !== ctxWallet) {
      deleteFile()
      return isCreateCtx
    }
    console.log(chalk.magenta("You already have an existing Ctx file with the following parameters - "))
    console.log(chalk.hex('#FFA500')("Public Key:"), ctxPublicKey)
    console.log(chalk.hex('#FFA500')("Network:"), ctxNetwork)
    if (ctxNetwork === "costwo-staging" || ctxNetwork === "coston-staging") {
      console.log(chalk.hex('#FFA500')("Network url:"), ctxNetworkUrl)
    }
    if (ctxEthAddress) {
      console.log(chalk.hex('#FFA500')("Eth Address:"), ctxEthAddress)
    }
    if (ctxVaultId) {
      console.log(chalk.hex('#FFA500')("Vault Id:"), ctxVaultId)
    }
    const getUserChoice = await prompts.ctxFile();
    const isContinue: boolean = getUserChoice.isContinue

    if (isContinue) {
      isCreateCtx = false
    } else {
      deleteFile()
    }
  }

  return isCreateCtx
}

function deleteFile() {
  try {
    fs.unlinkSync('ctx.json');
    console.log('File "ctx.json" has been deleted.');
  } catch (error) {
    console.error('An error occurred while deleting the file:', error);
  }
}

async function getDetailsForDelegation(task: string): Promise<DelegationDetailsInterface> {
  const amount = await prompts.amount()
  const nodeId = await prompts.nodeId()
  const startTime = await prompts.unixTime("start")
  const endTime = await prompts.unixTime("end")
  const delegationDetails = {
    amount: amount.amount,
    nodeId: nodeId.id,
    startTime: startTime.time,
    endTime: endTime.time
  }
  if (task == "stake") {
    const fee = await prompts.delegationFee()
    return {
      ...delegationDetails,
      delegationFee: fee.fee
    }
  }
  return delegationDetails
}

function makeForDefiArguments(txnType: string, baseargv: string[], txnId: string) {
  if (txnType == "sign") {
    const argsSign = [...baseargv.slice(0, 2), "forDefi", "sign", "-i", `${txnId}`]
    return argsSign
  }
  if (txnType == "fetch") {
    const argsFetch = [...baseargv.slice(0, 2), "forDefi", "fetch", "-i", `${txnId}`]
    return argsFetch
  }
  if (txnType == "send") {
    const argsSign = [...baseargv.slice(0, 2), "send", "-i", `${txnId}`]
    return argsSign
  }
  return []
}

async function checkAddressRegistrationLedger(wallet: string, ctxNetwork: string, ctxDerivationPath: string,
  ctxCAddress: string, ctxPublicKey: string, ctxPAddress: string) {
  const isRegistered = await isAddressRegistered(ctxCAddress, ctxNetwork)
  if (!isRegistered) {
    console.log("Note: You need to register your wallet address before you can delegate your funds")
    console.log("Please sign this transaction on your ledger")
    const registerAddressParams: RegisterAddressInterface = {
      publicKey: ctxPublicKey,
      pAddress: ctxPAddress,
      cAddress: ctxCAddress,
      network: ctxNetwork,
      wallet: wallet,
      derivationPath: ctxDerivationPath
    };
    await registerAddress(registerAddressParams)
    console.log(chalk.green("Address successfully registered"))
  }
}

async function checkAddressRegistrationPrivateKey(wallet: string, ctxNetwork: string, pvtKeyPath: string) {

  const context: Context = contextEnv(pvtKeyPath, ctxNetwork)
  const isRegistered = await isAddressRegistered(context.cAddressHex!, ctxNetwork)
  if (!isRegistered) {
    console.log("Note: You need to register your wallet address before you can delegate your funds")
    console.log("Please complete this registration transaction to proceed")

    const [pubX, pubY] = context.publicKey!
    const compressedPubKey = compressPublicKey(pubX, pubY).toString('hex')
    const registerAddressParams: RegisterAddressInterface = {
      publicKey: compressedPubKey,
      pAddress: context.pAddressBech32!,
      cAddress: context.cAddressHex!,
      network: ctxNetwork,
      wallet: wallet,
      pvtKey: context.privkHex
    };
    await registerAddress(registerAddressParams)
    console.log(chalk.green("Address successfully registered"))
  }
}

async function registerAddressForDefi(wallet: string, ctxNetwork: string, ctxPublicKey: string): Promise<string> {

  console.log("Note: You need to register your wallet address before you can delegate your funds")
  console.log("Please complete this registration transaction to proceed")
  const txnId = await prompts.transactionId()
  const context: Context = contextFile("ctx.json")
  const registerAddressParams: RegisterAddressInterface = {
    publicKey: ctxPublicKey,
    pAddress: context.pAddressBech32!,
    cAddress: context.cAddressHex!,
    network: ctxNetwork,
    wallet: wallet,
    transactionId: txnId.id
  };
  await registerAddress(registerAddressParams)
  return txnId.id
}

async function checkAddressRegistrationForDefi(ctxNetwork: string): Promise<boolean> {
  const context: Context = contextFile("ctx.json")
  const isRegistered = await isAddressRegistered(context.cAddressHex!, ctxNetwork)
  return isRegistered
}

async function claimRewardsPrivateKey(wallet: string, ctx: Context) {
  const claimAmount = await prompts.amount("to claim ")
  const isOwnerReceiver = await prompts.isOwnerReceiver()
  const receiverAddress = isOwnerReceiver.isOwnerReceiver ? ctx.cAddressHex! : await getPromptsAddress()
  const claimRewardsParams: ClaimRewardsInterface = {
    claimAmount: claimAmount.amount,
    ownerAddress: ctx.cAddressHex!,
    receiverAddress: receiverAddress,
    network: ctx.config.hrp,
    wallet: wallet,
    pvtKey: ctx.privkHex
  };
  await claimRewards(claimRewardsParams)
  console.log(chalk.green("Rwards successfully claimed"))
}

async function claimRewardsLedger(wallet: string, ctxCAddress: string, ctxDerivationPath: string, ctxNetwork: string) {
  const claimAmount = await prompts.amount("to claim ")
  const isOwnerReceiver = await prompts.isOwnerReceiver()
  const receiverAddress = isOwnerReceiver.isOwnerReceiver ? ctxCAddress : await getPromptsAddress()
  const claimRewardsParams: ClaimRewardsInterface = {
    claimAmount: claimAmount.amount,
    ownerAddress: ctxCAddress,
    receiverAddress: receiverAddress,
    network: ctxNetwork,
    wallet: wallet,
    derivationPath: ctxDerivationPath
  };
  console.log("Please sign the transaction on your ledger")
  await claimRewards(claimRewardsParams)
  console.log(chalk.green("Rwards successfully claimed"))
}

async function claimRewardsForDefi(wallet: string, transactionId: string) {
  const claimAmount = await prompts.amount("to claim ")
  const context: Context = contextFile("ctx.json")
  const isOwnerReceiver = await prompts.isOwnerReceiver()
  const receiverAddress = isOwnerReceiver.isOwnerReceiver ? context.cAddressHex! : await getPromptsAddress();
  const claimRewardsParams: ClaimRewardsInterface = {
    claimAmount: claimAmount.amount,
    ownerAddress: context.cAddressHex!,
    receiverAddress: receiverAddress,
    network: context.config.hrp,
    wallet: wallet,
    transactionId: transactionId
  };
  await claimRewards(claimRewardsParams)

}

/**
 * @description - Get the prompts address
 * @returns - prompts address
 */
async function getPromptsAddress() {
  return (await prompts.receiverAddress()).address;
}

// querries user for their derivation path
async function selectDerivationPath(network: string) {
  const derivationTypePrompt = await prompts.derivationType()
  const derivation = derivationTypePrompt.derivation
  console.log("Fetching Addresses...")
  const pathList: DerivedAddress[] = await getPathsAndAddresses(network, derivation)
  const choiceList = await createChoicesFromAddress(pathList)
  const selectedAddress = await prompts.selectAddress(choiceList)
  const selectedDerivedAddress = pathList.find(item => item.ethAddress == selectedAddress.address)
  const selectedDerivationPath = selectedDerivedAddress?.derivationPath
  return selectedDerivationPath
}
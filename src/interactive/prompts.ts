import chalk from 'chalk'
import inquirer from 'inquirer';
import { taskConstants, networkConstants, walletConstants, derivationModeConstants } from '../constants/screen';


/**
 * Provides various prompts used in the CLI for user interaction.
 */
export const prompts = {
  connectWallet: async () => {
    const questions = [{
      type: 'list',
      name: 'wallet',
      message: chalk.magenta("How do you want to connect your wallet?"),
      choices: [...Object.values(walletConstants)],
      filter: (val: string) => {
        const key = Object.keys(walletConstants).find(key => walletConstants[key] == val)
        return key
      }
    }];
    return inquirer.prompt(questions);
  },
  derivationType: async () => {
    const questions = [{
      type: 'list',
      name: 'derivation',
      message: chalk.magenta("Choose derivation path..."),
      choices: [
        ...Object.values(derivationModeConstants)
      ],
      filter: (val: string) => {
        const key = Object.keys(derivationModeConstants).find(key => derivationModeConstants[key] == val)
        return key
      }
    }];
    return inquirer.prompt(questions);
  },
  pvtKeyPath: async () => {
    const questions = [
      {
        type: 'input',
        name: 'pvtKeyPath',
        message:
          chalk.magenta("Enter Path to Private Key file") + " " +
          chalk.yellow("(E.g. /home/wallet/pvtKeyFile)") +
          chalk.magenta(":"),
      },
    ];
    return inquirer.prompt(questions);
  },

  publicKey: async () => {
    const questions = [
      {
        type: 'input',
        name: 'publicKey',
        message:
          chalk.magenta("Enter your secp256k1 curve public key") + " " +
          chalk.yellow("(E.g. 0x02efe41c5d213089cb7a9e808505e9084bb9eb2bf3aa8050ea92a5ae9e20e5a692)") +
          chalk.magenta(":"),
      },
    ];
    return inquirer.prompt(questions);
  },

  amount: async (amountPurpose: string = "") => {
    const questions = [
      {
        type: 'input',
        name: 'amount',
        message:
          chalk.magenta(`Enter amount ${amountPurpose}`) + " " +
          chalk.magenta(`(in FLR):`)
      },
    ];
    return inquirer.prompt(questions);
  },

  fees: async (baseFees?: unknown) => {
    const questions = [{
      type: 'input',
      default: baseFees,
      name: 'fees',
      message: chalk.magenta("Enter fees (in FLR):")
      }];
      return inquirer.prompt(questions);
    },

    nodeId: async () => {
      const questions = [{
        type: 'input',
        name: 'id',
        message:
          chalk.magenta("Enter NodeId") + " " +
          chalk.yellow("(E.g. NodeID-FQKTLuZHEsjCxPeFTFgsojsucmdyNDsz1)") +
          chalk.magenta(":")
      }];
      return inquirer.prompt(questions);
    },

  unixTime: async (timeType: string) => {
    const questions = [{
      type: 'input',
      name: 'time',
      message:
        chalk.magenta(`Enter ${timeType} time`) + " " +
        chalk.yellow("(E.g. 1693185095") +
        chalk.magenta(":")
    }];
    return inquirer.prompt(questions);
  },

  ctxFile: async () => {
    const questions = [{
      type: 'list',
      name: 'isContinue',
      message: chalk.magenta("Do you wish to continue with this?"),
      choices: [
        "yes",
        "no"
      ],
      filter: (val: string) => {
        return val == "yes" ? true : false
      }
    }];
    return inquirer.prompt(questions);
  },

  selectNetwork: async () => {
    const questions = [{
      type: 'list',
      name: 'network',
      message: chalk.magenta("Which network do you want to connect to?"),
      choices: [
        ...Object.values(networkConstants)
      ],
      filter: (val: string) => {
        const key = Object.keys(networkConstants).find(key => networkConstants[key] == val)
        return key
      }
    }];
    return inquirer.prompt(questions);
  },

  selectNetworkUrl: async () => {
    const questions = [{
      type: 'input',
      name: 'networkUrl',
      message: chalk.magenta("Enter network url:"),
    }];
    return inquirer.prompt(questions);
  },

  selectTask: async () => {
    const questions = [{
      type: 'list',
      name: 'task',
      message: chalk.magenta("What do you want to do?"),
      choices: [
        ...Object.keys(taskConstants)
      ]
    }];
    return inquirer.prompt(questions);
  },

  selectAddress: async (choiceList: string[]) => {
    const questions = [{
      type: 'list',
      name: 'address',
      message: chalk.magenta("Which address do you want to use?"),
      choices: [
        ...choiceList
      ],
      filter: (val: string) => {
        const address = val.split(" ")[1]
        return address
      }
    }];
    return inquirer.prompt(questions);
  },

  delegationFee: async () => {
    const questions = [{
      type: 'input',
      name: 'fee',
      message:
        chalk.magenta("Enter delegation fee") + " " +
        chalk.yellow("(E.g. 10)") +
        chalk.magenta(":")
    }];
    return inquirer.prompt(questions);
  },

  vaultId: async () => {
    const questions = [{
      type: 'input',
      name: 'id',
      message:
        chalk.magenta("Enter a ForDefi VauldId") + " " +
        chalk.yellow("(E.g. 42989fc9-xxxx-xxxx-xxxx-xxxxxxxxxxxx)") +
        chalk.magenta(":")
    }];
    return inquirer.prompt(questions);
  },

  transactionId: async () => {
    const questions = [{
      type: 'input',
      name: 'id',
      message:
        chalk.magenta("Enter Transaction Id") + " " +
        chalk.yellow("(E.g. abc-txn)") +
        chalk.magenta(":"),
    }];
    return inquirer.prompt(questions);
  },

  forDefiTxn: async () => {
    const questions = [{
      type: 'list',
      name: 'txn',
      message: chalk.magenta("Which transaction do you want to do?"),
      choices: [
        "Export funds",
        "Import funds"
      ],
    }];
    return inquirer.prompt(questions);
  },

  forDefiContinue: async () => {
    const questions = [{
      type: 'list',
      name: 'isContinue',
      message: chalk.magenta("Choose an option"),
      choices: [
        "Start new transaction",
        "Continue existing transaction"
      ],
      filter: (val: string) => {
        return val.includes("existing") ? true : false
      }
    }];
    return inquirer.prompt(questions);
  },

  isOwnerReceiver: async () => {
    const questions = [{
      type: 'list',
      name: 'isOwnerReceiver',
      message: chalk.magenta("Where do you want to receive your rewards?"),
      choices: [
        "Send to my wallet",
        "Receive with another wallet"
      ],
      filter: (val: string) => {
        return val.includes("my") ? true : false
      }
    }];
    return inquirer.prompt(questions);
  },

  receiverAddress: async () => {
    const questions = [{
      type: 'input',
      name: 'address',
      message: chalk.magenta("Please enter the C-address where you want to receive your rewards:"),
    }];
    return inquirer.prompt(questions);
  },

  withdrawAddress: async () => {
    const questions = [{
      type: 'input',
      name: 'address',
      message: chalk.magenta("Please enter the C-address where you want to withdraw your funds:"),
    }];
    return inquirer.prompt(questions);
  },

  importTrxType: async () => {
    const questions = [{
      type: 'list',
      name: 'type',
      message: chalk.magenta("Please select the destination chain to which you want to import your funds?"),
      choices: [
        "P",
        "C"
      ],
    }];
    return inquirer.prompt(questions);
  },
}

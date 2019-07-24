import EthvaultENSRegistrarArtifact from '@ethvault/ens-registrar-contract/build/contracts/EthvaultENSRegistrar.json';

import { Contract, ContractFunction, getDefaultProvider, Wallet } from 'ethers';
import { BigNumberish } from 'ethers/utils';

const SIGNING_PRIVATE_KEY: string = process.env.SIGNING_PRIVATE_KEY || '';

export const ethereumProvider = getDefaultProvider('mainnet');
export const wallet = new Wallet(SIGNING_PRIVATE_KEY, ethereumProvider);

interface TransactionOverrides {
  gasPrice: BigNumberish;
  value: BigNumberish;
  chainId: 1;
}

interface EthvaultENSRegistrarContractFunctions {
  register(labelHashes: string[], addresses: string[], weiValues: BigNumberish[], overrides: TransactionOverrides): Promise<void>;

  [ name: string ]: ContractFunction;
}

interface EthvaultENSRegistrarContract extends Contract {
  functions: EthvaultENSRegistrarContractFunctions;
}

// Fix to 1 when deployed to mainnet
const CONTRACT_NETWORK_ID = '1';

let registrarContract: EthvaultENSRegistrarContract | null = null;

export function getRegistrarContract(): EthvaultENSRegistrarContract {
  if (registrarContract !== null) {
    return registrarContract;
  }

  const address = EthvaultENSRegistrarArtifact.networks[ CONTRACT_NETWORK_ID ].address;

  if (typeof address !== 'string') {
    throw new Error(`Network information does not have address for network with ID ${CONTRACT_NETWORK_ID}`);
  }

  return registrarContract = new Contract(address, EthvaultENSRegistrarArtifact.abi, wallet) as EthvaultENSRegistrarContract;
}

import EthvaultENSRegistrarArtifact from '@ethvault/ens-registrar-contract/build/contracts/EthvaultENSRegistrar.json';

import { Contract, ContractFunction, getDefaultProvider, Wallet } from 'ethers';
import { BigNumberish } from 'ethers/utils';

const SIGNING_PRIVATE_KEY: string = process.env.SIGNING_PRIVATE_KEY || '';

export const ethereumProvider = getDefaultProvider('mainnet');
const wallet = new Wallet(SIGNING_PRIVATE_KEY, ethereumProvider);

interface TransactionOverrides {
  gasPrice: BigNumberish;
  value: BigNumberish;
  chainId: 1;
}

interface EthvaultENSRegistrarContractFunctions {
  register(rootNode: string, labelHashes: string[], addresses: string[], weiValues: BigNumberish[], overrides: TransactionOverrides): Promise<void>;
  release(rootNode: string, labelHash: string, expirationTimestamp: BigNumberish, bytes: string): Promise<void>;

  [ name: string ]: ContractFunction;
}

interface EthvaultENSRegistrarContract extends Contract {
  functions: EthvaultENSRegistrarContractFunctions;
}

let registrarContract: EthvaultENSRegistrarContract | null = null;

export function getRegistrarContract(): EthvaultENSRegistrarContract {
  if (registrarContract !== null) {
    return registrarContract;
  }

  console.log('Constructing contract with wallet address', wallet.address);

  return registrarContract = new Contract(
    EthvaultENSRegistrarArtifact.networks[ '1' ].address,
    EthvaultENSRegistrarArtifact.abi,
    wallet
  ) as EthvaultENSRegistrarContract;
}

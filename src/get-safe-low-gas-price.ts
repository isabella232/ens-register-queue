import BigNumber from 'bignumber.js';
import fetch from 'node-fetch';

/**
 * Get the number vended by eth gas station
 */
async function getSafeLowGweiFromEthGasStation(): Promise<number> {
  const response = await fetch('https://ethgasstation.info/json/ethgasAPI.json');

  if (!response.ok) {
    throw new Error('eth gas station api returned status ' + response.status);
  }

  const json = await response.json();

  if (typeof json.safeLow !== 'number') {
    throw new Error('expected .safeLow to be a number: ' + JSON.stringify(json));
  }

  return json.safeLow / 10;
}

/**
 * Get the safe low gas price to send
 */
export async function getSafeLowGasPriceWEI(): Promise<BigNumber> {
  const safeLowGwei = await getSafeLowGweiFromEthGasStation();

  if (safeLowGwei > 10) {
    throw new Error('gas prices are too high right now');
  }

  // Convert it to GWEI
  return new BigNumber(safeLowGwei).multipliedBy(new BigNumber(10).exponentiatedBy(9));
}
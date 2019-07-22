import BigNumber from 'bignumber.js';
import fetch from 'node-fetch';

let usdPricePromise: Promise<BigNumber> | null = null;
let priceTimestamp: number | null;

/**
 * Get the price of ether in dollars. Safe to call multiple times.
 */
function getEtherPriceInUSD(): Promise<BigNumber> {
  if (
    usdPricePromise !== null &&
    (priceTimestamp === null || priceTimestamp > (new Date().getTime() - (1000 * 60)))
  ) {
    return usdPricePromise;
  }

  console.log('fetching price');

  return usdPricePromise = fetch('https://api.coinmarketcap.com/v1/ticker/ethereum/')
    .then(response => {
      if (!response.ok) {
        throw new Error('failed to get price data');
      }
      return response.json();
    })
    .then(json => {
      if (!Array.isArray(json)) {
        throw new Error('expected json array');
      }

      if (!json[ 0 ].price_usd || typeof json[ 0 ].price_usd !== 'string') {
        throw new Error('response did not have expected format: ' + JSON.stringify(json));
      }

      priceTimestamp = new Date().getTime();

      return new BigNumber(json[ 0 ].price_usd);
    })
    .catch(error => {
      console.error(error);
      usdPricePromise = null;
      priceTimestamp = null;
      throw error;
    });
}

/**
 * Convert some amount of USD to wei
 * @param dollars to convert
 */
export async function dollarsToWei(dollars: number): Promise<BigNumber> {
  const usdPrice = await getEtherPriceInUSD();

  const amount = new BigNumber(dollars);

  return amount
    .dividedBy(usdPrice)
    .multipliedBy(new BigNumber(10).exponentiatedBy(18))
    .integerValue(BigNumber.ROUND_FLOOR);
}
import BigNumber from 'bignumber.js';

/**
 * Convert a bignumber to hex
 * @param bn bignumber to convert
 */
export default function bn2hex(bn: BigNumber) {
  return `0x${bn.toString(16)}`;
}
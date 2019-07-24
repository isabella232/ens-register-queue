import BigNumber from 'bignumber.js';

export default function bn2hex(bn: BigNumber) {
  return `0x${bn.toString(16)}`;
}
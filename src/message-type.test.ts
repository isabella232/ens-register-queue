import { expect } from 'chai';
import { parseQueueMessage } from './message-type';

describe('parseQueueMessage', () => {
  [
    'abc',
    '"',
    '()',
  ].forEach(
    invalidJson => {
      it(`invalid json: ${invalidJson}`, () => {
        expect(() => parseQueueMessage(invalidJson)).to.throw('Invalid JSON: ');
      });
    }
  );

  [
    '"abc"',
    '2',
    '[]',
    '[1,2]',
    '["abc",2]',
    '{}',
    '{"ensName":".myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":5}', // invalid ens name
    '{"ensName":"moody.test.xyz","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":5}', // invalid ens name 2
    '{"ensName":"moody.myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD","dollarsToSend":5}', // invalid address
    '{"ensName":"moody.myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":6}', // too many dollars
    '{"ensName":"moody.myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":-1}', // negative dollars
    '{"ensName":"moody.myethvault.com","dollarsToSend":5}', // missing address
    '{"address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":5}', // missing ensName
    '{"ensName":"moody.myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1"}', // missing dollars to send
  ].forEach(
    wrongType => {
      it(`failed validation: ${wrongType}`, () => {
        expect(() => parseQueueMessage(wrongType)).to.throw('Failed validation: ');
      });
    }
  );

  [
    '{"ensName":"moody.myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":5}',
    '{"ensName":"moody.myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":0}',
    '{"ensName":"abc.myethvault.com","address":"0x1bd8437054ab40573816f965D95b359Ca2534fD1","dollarsToSend":0}',
  ].forEach(
    valid => {
      it(`succeeds: ${valid}`, () => {
        expect(parseQueueMessage(valid)).to.deep.eq(JSON.parse(valid));
      });
    }
  );
});
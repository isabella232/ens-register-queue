import { SQSHandler } from 'aws-lambda';
import * as SQS from 'aws-sdk/clients/sqs';
import { utils } from 'ethers';
import { groupBy, map, reduce } from 'lodash';
import { dollarsToWei } from './dollars-to-wei';
import { getSafeLowGasPriceWEI } from './get-safe-low-gas-price';
import { parseQueueMessage } from './message-type';
import { getQueueUrl } from './queue-urls';
import { ethereumProvider, getRegistrarContract } from './ethvault-ens-registrar-contract';
import BigNumber from 'bignumber.js';

const sqs = new SQS();

interface Registration {
  labelHash: string;
  address: string;
  value: BigNumber; // Hex value to send with the registration
}

export const handler: SQSHandler = async function (event) {
  const toDelete: { QueueUrl: string; Id: string; ReceiptHandle: string; }[] = [];

  const toRegister: Registration[] = [];

  await Promise.all(
    event.Records.map(
      async ({ body, eventSourceARN, messageId, receiptHandle }) => {
        try {
          const queueMessage = parseQueueMessage(body);

          let address: string | null = null;
          try {
            address = await ethereumProvider.lookupAddress(queueMessage.ensName);
          } catch (ignored) {
          }

          if (address !== null) {
            if (queueMessage.address.toLowerCase() !== address.toLowerCase()) {
              console.error('message received to register an address that is already registered', queueMessage);
            }

            toDelete.push({
              Id: messageId,
              ReceiptHandle: receiptHandle,
              QueueUrl: await getQueueUrl(sqs, eventSourceARN)
            });
          } else {
            toRegister.push({
              address: queueMessage.address,
              labelHash: utils.id(queueMessage.ensName.split('.')[ 0 ]),
              value: await dollarsToWei(queueMessage.dollarsToSend)
            });
          }
        } catch (error) {
          console.error(error);
          return null;
        }
      }
    )
  );

  // Group the deletions by the url and send them
  const grouped = groupBy(toDelete, 'QueueUrl');

  await Promise.all(
    map(
      grouped,
      async (messages, url) =>
        sqs.deleteMessageBatch({
          QueueUrl: url,
          Entries: messages.map(({ Id, ReceiptHandle }) => ({ ReceiptHandle, Id }))
        })
    )
  );

  const gasPrice = await getSafeLowGasPriceWEI();

  const contract = getRegistrarContract();

  if (toRegister.length > 0) {
    const labels = toRegister.map(({ labelHash }) => labelHash);
    const addresses = toRegister.map(({ address }) => address);
    const values = toRegister.map(({ value }) => `0x${value.toString(16)}`);
    const valueSum = reduce(values, (value, current) => {
      return value.plus(current);
    }, new BigNumber(0));

    try {
      const txHash = await contract.functions.register(
        labels,
        addresses,
        values,
        {
          gasPrice: `0x${gasPrice.toString(16)}`,
          value: `0x${valueSum.toString(16)}`,
          chainId: 1
        }
      );

      console.log('Submitted transaction', txHash);
    } catch (error) {
      console.error('Failed to send transaction', error);
    }
  } else {
    console.log('No new valid registrations.');
  }
};
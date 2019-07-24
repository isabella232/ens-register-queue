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
import bn2hex from './bn2hex';

const sqs = new SQS();

interface Registration {
  // The hash of the label to assign to the address
  labelHash: string;
  // Address to receive the registrarion
  address: string;
  // How much to send
  value: BigNumber;
}

interface DeleteMessageInfo {
  // The URL from which to delete the message
  QueueUrl: string;
  // The ID of the message to delete
  Id: string;
  // The handle from the receipt of this message
  ReceiptHandle: string;
}

export const handler: SQSHandler = async function (event) {
  const toDelete: DeleteMessageInfo[] = [];
  const toRegister: Registration[] = [];

  // For each of the records, decide what to do with them.
  await Promise.all(
    event.Records.map(
      async message => {
        const { body, eventSourceARN, messageId, receiptHandle } = message;

        try {
          const queueMessage = parseQueueMessage(body);

          const address = await ethereumProvider.lookupAddress(queueMessage.ensName);

          if (address !== null) {
            if (queueMessage.address.toLowerCase() !== address.toLowerCase()) {
              console.error(
                'Message received to register a subdomain that is already registered with a different address',
                queueMessage
              );
            } else {
              toDelete.push({
                Id: messageId,
                ReceiptHandle: receiptHandle,
                QueueUrl: await getQueueUrl(sqs, eventSourceARN)
              });
            }
          } else {
            toRegister.push({
              address: queueMessage.address,
              labelHash: utils.id(queueMessage.ensName.split('.')[ 0 ]),
              value: await dollarsToWei(queueMessage.dollarsToSend)
            });
          }
        } catch (error) {
          console.error('Error encountered while processing message', error, message);
        }
      }
    )
  );

  // Delete any messages from the queue that have already succeeded.
  if (toDelete.length > 0) {
    // Group the deletions by the url and send them
    const grouped = groupBy(toDelete, 'QueueUrl');

    try {
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
    } catch (error) {
      console.error('Failed to delete messages from the queue', error, toDelete);
    }
  }

  if (toRegister.length > 0) {
    const gasPrice = await getSafeLowGasPriceWEI();

    const contract = getRegistrarContract();

    const labels = toRegister.map(({ labelHash }) => labelHash);
    const addresses = toRegister.map(({ address }) => address);
    const values = toRegister.map(({ value }) => bn2hex(value));
    const valueSum = reduce(values, (value, current) => {
      return value.plus(current);
    }, new BigNumber(0));

    try {
      const txHash = await contract.functions.register(
        labels,
        addresses,
        values,
        {
          gasPrice: bn2hex(gasPrice),
          value: bn2hex(valueSum),
          chainId: 1
        }
      );

      console.log('Submitted transaction', txHash);
    } catch (error) {
      console.error('Failed to send transaction', error);
    }
  } else {
    console.log('No new registrations. Exiting without submitting transaction.');
  }
};
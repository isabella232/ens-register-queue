import { SQSEvent, SQSHandler } from 'aws-lambda';
import * as SQS from 'aws-sdk/clients/sqs';
import BigNumber from 'bignumber.js';
import { utils } from 'ethers';
import { groupBy, map, reduce } from 'lodash';
import 'source-map-support/register';
import bn2hex from './bn2hex';
import { dollarsToWei } from './dollars-to-wei';
import { ethereumProvider, getRegistrarContract } from './ethvault-ens-registrar-contract';
import { getSafeLowGasPriceWEI } from './get-safe-low-gas-price';
import { parseQueueMessage, QueueMessage } from './message-type';
import { getQueueUrl } from './queue-urls';

const sqs = new SQS();

interface Registration {
  // The root node where the registration should apply.
  rootNode: string;
  // The hash of the label to assign to the address
  labelHash: string;
  // Address to receive the registration
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

/**
 * Delete all the messages from the given queues
 * @param toDelete messages to delete
 */
async function deleteAllMessages(toDelete: DeleteMessageInfo[]): Promise<void> {
  if (toDelete.length === 0) {
    return;
  }

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

/**
 * Parse the messages
 * @param event
 */
async function parseMessages(event: SQSEvent): Promise<{ toDelete: DeleteMessageInfo[]; toRegister: Registration[]; }> {
  const toDelete: DeleteMessageInfo[] = [];
  const toRegister: Registration[] = [];

  // For each of the records, decide what to do with them.
  await Promise.all(
    event.Records.map(
      async message => {
        const { body, eventSourceARN, messageId, receiptHandle } = message;

        // First validate the message. In the case of an invalid message, we always delete it.
        let queueMessage: QueueMessage;
        try {
          queueMessage = parseQueueMessage(body);
        } catch (error) {
          console.error('Invalid message received', message, error);
          toDelete.push({
            Id: messageId,
            QueueUrl: await getQueueUrl(sqs, eventSourceARN),
            ReceiptHandle: receiptHandle
          });
          return;
        }

        try {
          const address = await ethereumProvider.resolveName(queueMessage.ensName);

          if (address !== null) {
            if (queueMessage.address.toLowerCase() !== address.toLowerCase()) {
              console.error(
                'Message received to register a subdomain that is already registered with a different address',
                queueMessage
              );
            }

            toDelete.push({
              Id: messageId,
              ReceiptHandle: receiptHandle,
              QueueUrl: await getQueueUrl(sqs, eventSourceARN)
            });
          } else {
            toRegister.push({
              // TODO: check this computation is correct (it's not)
              rootNode: utils.id(queueMessage.ensName.split('.').slice(1).join('.')),
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

  return {
    toDelete,
    toRegister
  };
}

/**
 * Send the transaction to register the listed registrations
 * @param toRegister accounts to register
 */
async function sendRegistrationTransaction(toRegister: Registration[]): Promise<void> {
  if (toRegister.length === 0) {
    return;
  }

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
      // TODO: we need to use a different root node for each registration
      toRegister[ 0 ].rootNode,
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
    console.error('Failed to send registration transaction', error);
    throw error;
  }
}

const isRegistrationDisabled: boolean = process.env.REGISTRATION_DISABLED === 'true';

/**
 * Handles the SQS events
 * @param event pushed from SQS
 */
export const handler: SQSHandler = async function (event) {
  const { toDelete, toRegister } = await parseMessages(event);

  // Delete any messages from the queue that have already succeeded.
  try {
    await deleteAllMessages(toDelete);
  } catch (error) {
    console.error('Encountered error while deleting messages', error);
    throw error;
  }

  // We can turn it off temporarily for migrations
  if (isRegistrationDisabled) {
    return;
  }

  // Delete any messages from the queue that have already succeeded.
  try {
    await sendRegistrationTransaction(toRegister);
  } catch (error) {
    console.error('Encountered error while sending registration transaction', error);
    throw error;
  }
};
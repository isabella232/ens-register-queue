import { SQSHandler } from 'aws-lambda';
import * as SQS from 'aws-sdk/clients/sqs';
import { getDefaultProvider, utils, Wallet } from 'ethers';
import { groupBy, map } from 'lodash';
import { dollarsToWei } from './dollars-to-wei';
import { getSafeLowGasPriceWEI } from './get-safe-low-gas-price';
import { parseQueueMessage } from './message-type';
import { getQueueUrl } from './queue-urls';

const sqs = new SQS();

const SIGNING_PRIVATE_KEY: string = process.env.SIGNING_PRIVATE_KEY || '';
const REGISTRAR_CONTRACT_ADDRESS: string = process.env.REGISTRAR_CONTRACT_ADDRESS || '';

const provider = getDefaultProvider('mainnet');
const wallet = new Wallet(SIGNING_PRIVATE_KEY, provider);

interface Registration {
  address: string;
  labelHash: string;
  value: string; // Hex value of the
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
            address = await provider.lookupAddress(queueMessage.ensName);
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
              value: `0x${(await dollarsToWei(queueMessage.dollarsToSend)).toString(16)}`
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

  // Construct and send a transaction to register the users
  console.log(REGISTRAR_CONTRACT_ADDRESS, toDelete, gasPrice, toRegister);

  const signedTransaction = await wallet.sign({
    gasPrice: `0x${gasPrice.toString(16)}`,
    from: wallet.address,
    to: REGISTRAR_CONTRACT_ADDRESS,
    value: 0,
    chainId: 1,
    nonce: await wallet.getTransactionCount('pending'),
    gasLimit: 0,
  });

  console.log(signedTransaction);
};
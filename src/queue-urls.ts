import * as SQS from 'aws-sdk/clients/sqs';

const QUEUE_URLS: { [ name: string ]: Promise<string> } = {};

/**
 * Get the URL for a given queue ARN. OK to call multiple times.
 * @param sqs sqs instance to use
 * @param queueArn arn of the queue
 */
export function getQueueUrl(sqs: SQS, queueArn: string): Promise<string> {
  if (QUEUE_URLS[ queueArn ]) {
    return QUEUE_URLS[ queueArn ];
  }

  return QUEUE_URLS[ queueArn ] = new Promise(async (resolve, reject) => {
    try {
      const pieces = queueArn.split(':');

      const queueName = pieces[ pieces.length - 1 ];

      const { QueueUrl } = await sqs.getQueueUrl({ QueueName: queueName }).promise();
      if (!QueueUrl) {
        delete QUEUE_URLS[ queueArn ];
        reject(new Error(`Failed to get queue url for name: "${queueName}"`));
      } else {
        resolve(QueueUrl);
      }
    } catch (error) {
      delete QUEUE_URLS[ queueArn ];
      reject(error);
    }
  });
}
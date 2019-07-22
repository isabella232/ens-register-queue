import jointz from 'jointz';

export interface QueueMessage {
  readonly ensName: string;
  readonly address: string;
  readonly dollarsToSend: number;
}

export const QueueMessageValidator = jointz.object().keys({
  ensName: jointz.string().pattern(/^[a-z0-9-]\.ethvault\.xyz$/),
  address: jointz.string().pattern(/^0x[a-fA-F0-9]{40}$/),
  dollarsToSend: jointz.number().min(0).max(5)
}).requiredKeys('ensName', 'address', 'dollarsToSend');

export function parseQueueMessage(message: string): QueueMessage {
  const parsed = JSON.parse(message);

  const errors = QueueMessageValidator.validate(parsed);

  if (errors.length > 0) {
    throw new Error('failed validation: ' + JSON.stringify(errors));
  }

  return parsed;
}
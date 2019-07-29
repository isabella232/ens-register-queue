import jointz from 'jointz';

export interface QueueMessage {
  readonly ensName: string;
  readonly address: string;
  readonly dollarsToSend: number;
}

export const QueueMessageValidator = jointz.object().keys({
  ensName: jointz.string().pattern(/^[a-z0-9-]+\.myethvault\.com$/),
  address: jointz.string().pattern(/^0x[a-fA-F0-9]{40}$/),
  dollarsToSend: jointz.number().min(0).max(5)
}).requiredKeys('ensName', 'address', 'dollarsToSend');

export function parseQueueMessage(message: string): QueueMessage {
  let parsed: any;
  try {
    parsed = JSON.parse(message);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  const errors = QueueMessageValidator.validate(parsed);

  if (errors.length > 0) {
    throw new Error('Failed validation: ' + JSON.stringify(errors));
  }

  return parsed;
}
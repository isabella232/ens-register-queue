import jointz, { ExtractResultType } from 'jointz';

export type QueueMessage = ExtractResultType<typeof QueueMessageValidator>;

export const QueueMessageValidator = jointz.object({
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

  return QueueMessageValidator.checkValid(parsed);
}
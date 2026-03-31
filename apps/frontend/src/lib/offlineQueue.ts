import { get, set, del, keys } from 'idb-keyval';

export interface QueuedMessage {
  id: string;
  channelId: string;
  content: string;
  timestamp: number;
}

const QUEUE_PREFIX = 'offline-msg-';

export async function enqueueMessage(
  channelId: string,
  content: string,
): Promise<QueuedMessage> {
  const msg: QueuedMessage = {
    id: `${QUEUE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`,
    channelId,
    content,
    timestamp: Date.now(),
  };
  await set(msg.id, msg);
  return msg;
}

export async function dequeueMessage(id: string): Promise<void> {
  await del(id);
}

export async function getPendingMessages(): Promise<QueuedMessage[]> {
  const allKeys = await keys();
  const msgKeys = allKeys.filter((k) => String(k).startsWith(QUEUE_PREFIX));
  const messages: QueuedMessage[] = [];
  for (const key of msgKeys) {
    const msg = await get<QueuedMessage>(key);
    if (msg) messages.push(msg);
  }
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export async function flushQueue(
  sendFn: (channelId: string, content: string) => void,
): Promise<number> {
  const pending = await getPendingMessages();
  let sent = 0;
  for (const msg of pending) {
    sendFn(msg.channelId, msg.content);
    await dequeueMessage(msg.id);
    sent++;
  }
  return sent;
}

// One sender per document: BroadcastChannel must not echo logout into this tab.
export const sessionBus = typeof BroadcastChannel === 'function'
  ? new BroadcastChannel('helpdesk_session')
  : undefined;

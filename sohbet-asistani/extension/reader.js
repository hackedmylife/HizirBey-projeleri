(() => {
  const roles = {'customer-message': 'user', 'agent-message': 'agent', 'bot_agent-message': 'bot', 'system-message': 'system'};
  function feeds(root) {return [...root.querySelectorAll('[data-testid="chat-feed"]')];}
  function readFeed(feed, index = 0) {
    const messages = [...feed.querySelectorAll('[data-testid="customer-message"], [data-testid="agent-message"], [data-testid="bot_agent-message"], [data-testid="system-message"]')].map(node => {
      const content = node.querySelector('[dir="auto"]');
      return {id: node.dataset.messageId || node.dataset.eventId || node.id || '', role: roles[node.dataset.testid], text: (content || node).textContent.trim().replace(/\\n/g, '\n')};
    }).filter(m => m.text).slice(-30);
    const owner = feed.closest('[data-chat-id], [data-conversation-id], [data-thread-id]');
    const fallback = `${globalThis.location?.pathname || 'active'}${index ? `|feed:${index}` : ''}`;
    const conversationId = feed.dataset.chatId || feed.dataset.conversationId || feed.dataset.threadId || owner?.dataset?.chatId || owner?.dataset?.conversationId || owner?.dataset?.threadId || fallback;
    return {messages, conversationId, found: true};
  }
  function read(root = document) {
    const all = feeds(root);
    const feed = all.find(node => node.getClientRects().length > 0) || all[0];
    return feed ? readFeed(feed, all.indexOf(feed)) : {messages: [], found: false};
  }
  function readAll(root = document) {return feeds(root).map(readFeed);}
  globalThis.HizirReader = {read, readAll};
})();

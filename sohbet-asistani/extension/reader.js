(() => {
  const roles = {'customer-message': 'user', 'agent-message': 'agent', 'bot_agent-message': 'bot', 'system-message': 'system'};
  function read(root = document) {
    const feed = root.querySelector('[data-testid="chat-feed"]');
    if (!feed) return {messages: [], found: false};
    const messages = [...feed.querySelectorAll('[data-testid="customer-message"], [data-testid="agent-message"], [data-testid="bot_agent-message"], [data-testid="system-message"]')].map((node) => {
      const content = node.querySelector('[dir="auto"]');
      return {role: roles[node.dataset.testid], text: (content || node).textContent.trim().replace(/\\n/g, '\n')};
    }).filter((m) => m.text).slice(-30);
    return {messages, found: true};
  }
  globalThis.HizirReader = {read};
})();

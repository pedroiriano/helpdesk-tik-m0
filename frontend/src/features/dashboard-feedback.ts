export function dashboardFeedback(node: HTMLElement, state: 'loading' | 'empty' | 'error' | 'ready', message = '') {
  node.dataset.state = state;
  node.textContent = message;
}

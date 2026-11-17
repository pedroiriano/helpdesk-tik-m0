import { createRoot } from 'react-dom/client';
import { ServiceStatus } from './components/ServiceStatus';

const host = document.querySelector('[data-helpdesk-health]');
if (host) {
  createRoot(host).render(<ServiceStatus admin={location.pathname.startsWith('/admin/')} />);
}

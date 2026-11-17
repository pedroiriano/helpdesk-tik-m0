// js/modules/contact.js — Enterprise Contact Form Sentinel & Honeypot Validation
function initContact() {
  const form = document.getElementById('vy-contact-form');
  const statusEl = document.getElementById('vy-contact-status');
  if (!form) return;

  // 1. Single-select inquiry focus
  const topics = Array.from(form.querySelectorAll('input[name="topic"]'));
  const requestedPlan = new URLSearchParams(window.location.search).get('plan');
  const requestedTopic = new URLSearchParams(window.location.search).get('topic');
  const planTopic = requestedTopic || (requestedPlan === 'starter' ? 'general' : requestedPlan);
  if (planTopic) {
    const requested = topics.find((topic) => topic.value === planTopic);
    if (requested) requested.checked = true;
  }

  // 2. Field validation definitions
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const FIELDS = [
    {
      id: 'vy-entry-name',
      errorId: 'vy-entry-name-warn',
      test: (v) => v.trim().length > 0,
      message: 'Please provide your name or organization.'
    },
    {
      id: 'vy-entry-email',
      errorId: 'vy-entry-email-warn',
      test: (v) => EMAIL_RE.test(v.trim()),
      message: 'Please enter a valid email address.'
    },
    {
      id: 'vy-entry-message',
      errorId: 'vy-entry-message-warn',
      test: (v) => v.trim().length > 0,
      message: 'Please provide a message or inquiry details.'
    }
  ];

  function clearError(input, errorSlot) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    if (errorSlot) {
      errorSlot.textContent = '';
      errorSlot.classList.remove('is-shown');
    }
  }

  function showError(input, errorSlot, message) {
    input.setAttribute('aria-invalid', 'true');
    if (errorSlot) {
      input.setAttribute('aria-describedby', errorSlot.id);
      errorSlot.textContent = message;
      errorSlot.classList.add('is-shown');
    }
  }

  FIELDS.forEach((f) => {
    const input = document.getElementById(f.id);
    const errorSlot = document.getElementById(f.errorId);
    if (input) {
      input.addEventListener('input', () => {
        if (input.hasAttribute('aria-invalid')) {
          clearError(input, errorSlot);
        }
      });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Honeypot spam check
    const honeypot = form.querySelector('input[name="hp_company"]');
    if (honeypot && honeypot.value.trim() !== '') {
      if (statusEl) {
        statusEl.textContent = 'Unable to prepare the draft because an unexpected field was filled. Clear browser autofill and try again.';
        statusEl.classList.add('is-shown');
      }
      return;
    }

    let firstInvalid = null;
    let isValid = true;

    FIELDS.forEach((f) => {
      const input = document.getElementById(f.id);
      const errorSlot = document.getElementById(f.errorId);
      if (input) {
        if (f.test(input.value)) {
          clearError(input, errorSlot);
        } else {
          showError(input, errorSlot, f.message);
          isValid = false;
          if (!firstInvalid) firstInvalid = input;
        }
      }
    });

    if (!isValid && firstInvalid) {
      firstInvalid.focus();
      if (statusEl) {
        statusEl.textContent = 'Please correct the highlighted fields above.';
        statusEl.classList.add('is-shown');
      }
      return;
    }

    // The static production contract is an honest local email composer.
    if (statusEl) {
      const topic = topics.find((item) => item.checked)?.value || 'general';
      const name = document.getElementById('vy-entry-name')?.value.trim() || '';
      const email = document.getElementById('vy-entry-email')?.value.trim() || '';
      const message = document.getElementById('vy-entry-message')?.value.trim() || '';
      const subject = `CourtSpec inquiry — ${topic}`;
      const body = [`Name / organization: ${name}`, `Reply email: ${email}`, `Inquiry focus: ${topic}`, '', message].join('\n');
      const mailLink = document.createElement('a');
      mailLink.className = 'btn btn-secondary vy-form-mail-link';
      mailLink.href = `mailto:scout@courtspec.io?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      mailLink.textContent = 'Open email draft';
      const note = document.createElement('span');
      note.textContent = 'Draft ready. Your information remains in this page until you open your mail application.';
      statusEl.replaceChildren(note, mailLink);
      statusEl.classList.add('is-shown');
    }
  });
}

// js/modules/security.js - Enterprise Native Security & Sanitization
export function sanitizeHTML(dirtyString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(dirtyString, 'text/html');
  const allowedTags = ['B', 'I', 'EM', 'STRONG', 'A', 'P', 'UL', 'LI', 'SPAN', 'CODE'];

  function clean(node) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.includes(child.tagName)) {
          child.remove();
          continue;
        }
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (child.tagName === 'A' && attr.name === 'href') {
            const url = attr.value.trim().toLowerCase();
            if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('vbscript:')) {
              child.removeAttribute(attr.name);
            }
          } else {
            child.removeAttribute(attr.name);
          }
        }
        clean(child);
      }
    }
  }

  clean(doc.body);
  const serializer = new XMLSerializer();
  return Array.from(doc.body.childNodes, (node) => serializer.serializeToString(node)).join('');
}

export function validateFormHoneypot(formElement) {
  const honeyInput = formElement.querySelector('input[name="website_url_check"]');
  if (honeyInput && honeyInput.value.trim() !== '') {
    // Terindikasi bot otomatis
    return false;
  }
  return true;
}

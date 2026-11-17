// js/modules/state.js - Zero-Dependency Reactive Micro-State Store
class MicroStore extends EventTarget {
  constructor(initialState = {}) {
    super();
    this._state = new Proxy(initialState, {
      set: (target, property, value) => {
        const oldValue = target[property];
        target[property] = value;
        this.dispatchEvent(new CustomEvent('change', {
          detail: { property, oldValue, newValue: value }
        }));
        this.dispatchEvent(new CustomEvent(`change:${property}`, {
          detail: { oldValue, newValue: value }
        }));
        return true;
      }
    });
  }

  get state() {
    return this._state;
  }

  subscribe(property, callback) {
    if (typeof property === 'function') {
      this.addEventListener('change', (e) => property(e.detail));
    } else {
      this.addEventListener(`change:${property}`, (e) => callback(e.detail.newValue, e.detail.oldValue));
    }
  }
}

export const appState = new MicroStore({
  isOnline: navigator.onLine,
  activeModal: null
});

// Pantau konektivitas jaringan global
window.addEventListener('online', () => { appState.state.isOnline = true; });
window.addEventListener('offline', () => { appState.state.isOnline = false; });

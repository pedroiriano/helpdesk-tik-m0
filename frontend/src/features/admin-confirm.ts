export interface AdminConfirmOptions {
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: 'warn' | 'primary';
  requireReason?: boolean;
  defaultReason?: string;
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<void>;
}

export function openAdminConfirmDialog(opts: AdminConfirmOptions): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-hd-archive-confirm]');
  if (!dialog) return;

  const titleEl = dialog.querySelector<HTMLElement>('[data-hd-arch-title]');
  const descEl = dialog.querySelector<HTMLElement>('[data-hd-arch-desc]');
  const reasonWrap = dialog.querySelector<HTMLElement>('[data-hd-arch-reason-wrap]');
  const reasonLabelEl = dialog.querySelector<HTMLLabelElement>('label[for="hd-arch-reason"]');
  const reasonInput = dialog.querySelector<HTMLTextAreaElement>('#hd-arch-reason');
  const statusEl = dialog.querySelector<HTMLElement>('[data-hd-arch-status]');
  const form = dialog.querySelector<HTMLFormElement>('[data-hd-arch-form]');
  const submitBtn = dialog.querySelector<HTMLButtonElement>('[data-hd-arch-submit]');
  const closeBtns = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-hd-arch-close]'));

  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (titleEl) titleEl.textContent = opts.title;
  if (descEl) descEl.textContent = opts.description;
  if (statusEl) statusEl.textContent = '';

  const needsReason = Boolean(opts.requireReason);
  if (reasonWrap) reasonWrap.hidden = !needsReason;
  if (reasonLabelEl) reasonLabelEl.textContent = opts.reasonLabel ?? 'Alasan perubahan (minimal 5 karakter)';
  if (reasonInput) {
    reasonInput.required = needsReason;
    reasonInput.disabled = !needsReason;
    reasonInput.value = opts.defaultReason ?? '';
  }
  if (submitBtn) {
    submitBtn.textContent = opts.confirmLabel;
    submitBtn.className = opts.confirmTone === 'warn'
      ? 'piui-btn piui-btn--secondary hd-btn-warn-outline'
      : 'piui-btn piui-btn--primary';
    submitBtn.disabled = false;
  }

  let submitting = false;
  const ac = new AbortController();

  const cleanup = () => {
    ac.abort();
    if (opener?.isConnected) opener.focus();
  };

  const closeDialog = () => {
    if (submitting) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  dialog.addEventListener('close', cleanup, { signal: ac.signal });
  dialog.addEventListener('cancel', event => {
    if (submitting) event.preventDefault();
  }, { signal: ac.signal });

  for (const btn of closeBtns) {
    btn.addEventListener('click', closeDialog, { signal: ac.signal });
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || (form && !form.reportValidity())) return;
    const reasonText = (reasonInput?.value ?? '').trim();
    if (needsReason && reasonText.length < 5) {
      if (statusEl) statusEl.textContent = 'Alasan minimal 5 karakter.';
      reasonInput?.focus();
      return;
    }

    submitting = true;
    if (submitBtn) submitBtn.disabled = true;
    for (const btn of closeBtns) btn.disabled = true;
    if (statusEl) statusEl.textContent = 'Memproses perubahan ke server…';

    try {
      await opts.onConfirm(reasonText);
      submitting = false;
      for (const btn of closeBtns) btn.disabled = false;
      closeDialog();
    } catch (err) {
      submitting = false;
      if (submitBtn) submitBtn.disabled = false;
      for (const btn of closeBtns) btn.disabled = false;
      if (statusEl) {
        statusEl.textContent = err instanceof Error ? err.message : 'Gagal memproses permintaan.';
      }
    }
  }, { signal: ac.signal });

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  if (needsReason && reasonInput) reasonInput.focus();
  else submitBtn?.focus();
}

with open('frontend/src/features/m0-04.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Ticket type definition
t_target = 'type Ticket = Components[\'Ticket\'];'
t_replacement = 'type Ticket = Components[\'Ticket\'] & { archived_at?: string | null };'
assert t_target in content, 'Ticket type target not found'
content = content.replace(t_target, t_replacement, 1)

# 2. Add archiveSec declarations in ticketDetail()
s_target = '  const escalateSec = $(\'[data-escalate-ticket]\');'
s_replacement = '''  const escalateSec = $('[data-escalate-ticket]');
  const archiveSec = $('[data-archive-ticket]');
  const btnArchive = $('[data-btn-archive]');
  const btnRestore = $('[data-btn-restore-archive]');
  const archiveDialog = $<HTMLDialogElement>('[data-archive-dialog]');
  const restoreDialog = $<HTMLDialogElement>('[data-restore-dialog]');'''
assert s_target in content, 'escalateSec target not found'
content = content.replace(s_target, s_replacement, 1)

# 3. Add archive/restore visibility in refresh()
r_target = '''      if (escalateSec) {
        escalateSec.hidden = !(currentTicket.state !== 'CLOSED' && currentTicket.state !== 'CANCELLED' && canEscalate);
      }'''
r_replacement = '''      if (escalateSec) {
        escalateSec.hidden = !(currentTicket.state !== 'CLOSED' && currentTicket.state !== 'CANCELLED' && canEscalate);
      }

      const isTerminal = currentTicket.state === 'CLOSED' || currentTicket.state === 'CANCELLED';
      const isArchived = Boolean(currentTicket.archived_at);
      const canArchive = isInternal && isTerminal && !isArchived;
      const canRestore = isInternal && isArchived;

      if (archiveSec) {
        archiveSec.hidden = !(canArchive || canRestore);
        if (btnArchive) btnArchive.hidden = !canArchive;
        if (btnRestore) btnRestore.hidden = !canRestore;
      }

      if (isArchived && detailSec) {
        const badge = el('span', ` (Diarsipkan: ${new Date(currentTicket.archived_at!).toLocaleString('id-ID')})`, 'court-badge');
        badge.style.background = '#6c757d';
        badge.style.color = '#fff';
        detailSec.querySelector('h2')?.after(badge);
      }'''
assert r_target in content, 'escalateSec.hidden target not found'
content = content.replace(r_target, r_replacement, 1)

# 4. Add dialog submit handlers after escalate handler
e_target = '''        await api(`/tickets/${ticketId}/escalations`, 'POST', {
          expected_version: currentTicket.version,
          level,
          reason
        }, keyGen('escalate', currentTicket.id + currentTicket.version));
        setStatus('Eskalasi tiket berhasil diajukan (202 Accepted).', '[data-escalate-status]');
        formEscalate.reset();
        await refresh();
      } catch (err) {
        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;
        setStatus(errorText(err), '[data-escalate-status]');
      } finally {
        escalatePending = false;
        if (btn) btn.disabled = false;
      }
    });
  }'''

e_replacement = '''        await api(`/tickets/${ticketId}/escalations`, 'POST', {
          expected_version: currentTicket.version,
          level,
          reason
        }, keyGen('escalate', currentTicket.id + currentTicket.version));
        setStatus('Eskalasi tiket berhasil diajukan (202 Accepted).', '[data-escalate-status]');
        formEscalate.reset();
        await refresh();
      } catch (err) {
        if (err instanceof APIError && err.status === 409 && conflictBanner) conflictBanner.hidden = false;
        setStatus(errorText(err), '[data-escalate-status]');
      } finally {
        escalatePending = false;
        if (btn) btn.disabled = false;
      }
    });
  }

  // Archive & Restore Archive Handlers (M11 AC22 & AC20)
  if (btnArchive && archiveDialog) {
    btnArchive.addEventListener('click', () => {
      if (typeof archiveDialog.showModal === 'function') archiveDialog.showModal();
      else archiveDialog.setAttribute('open', '');
    });
    document.querySelectorAll('[data-close-archive-dialog]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof archiveDialog.close === 'function') archiveDialog.close();
        else archiveDialog.removeAttribute('open');
      });
    });
    const formArchive = $<HTMLFormElement>('[data-form-archive]');
    if (formArchive) {
      let pendingArchive = false;
      formArchive.addEventListener('submit', async e => {
        e.preventDefault();
        if (pendingArchive || !currentTicket || !formArchive.reportValidity()) return;
        pendingArchive = true;
        const submitBtn = $<HTMLButtonElement>('button[type=submit]', formArchive);
        if (submitBtn) submitBtn.disabled = true;
        const reason = formValue(formArchive, 'reason');
        try {
          await api(`/tickets/${ticketId}/archive`, 'POST', {
            expected_version: currentTicket.version,
            reason
          }, keyGen('archive', currentTicket.id + currentTicket.version));
          if (typeof archiveDialog.close === 'function') archiveDialog.close();
          else archiveDialog.removeAttribute('open');
          setStatus('Tiket berhasil diarsipkan.', '[data-archive-status]');
          await refresh();
        } catch (err) {
          setStatus(errorText(err), '[data-archive-status]');
        } finally {
          pendingArchive = false;
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  if (btnRestore && restoreDialog) {
    btnRestore.addEventListener('click', () => {
      if (typeof restoreDialog.showModal === 'function') restoreDialog.showModal();
      else restoreDialog.setAttribute('open', '');
    });
    document.querySelectorAll('[data-close-restore-dialog]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof restoreDialog.close === 'function') restoreDialog.close();
        else restoreDialog.removeAttribute('open');
      });
    });
    const formRestore = $<HTMLFormElement>('[data-form-restore-archive]');
    if (formRestore) {
      let pendingRestore = false;
      formRestore.addEventListener('submit', async e => {
        e.preventDefault();
        if (pendingRestore || !currentTicket || !formRestore.reportValidity()) return;
        pendingRestore = true;
        const submitBtn = $<HTMLButtonElement>('button[type=submit]', formRestore);
        if (submitBtn) submitBtn.disabled = true;
        const reason = formValue(formRestore, 'reason');
        try {
          await api(`/tickets/${ticketId}/restore-archive`, 'POST', {
            expected_version: currentTicket.version,
            reason
          }, keyGen('restore-archive', currentTicket.id + currentTicket.version));
          if (typeof restoreDialog.close === 'function') restoreDialog.close();
          else restoreDialog.removeAttribute('open');
          setStatus('Arsip tiket berhasil dipulihkan.', '[data-archive-status]');
          await refresh();
        } catch (err) {
          setStatus(errorText(err), '[data-archive-status]');
        } finally {
          pendingRestore = false;
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }'''

assert e_target in content, 'escalation submit handler target not found'
content = content.replace(e_target, e_replacement, 1)

with open('frontend/src/features/m0-04.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated frontend/src/features/m0-04.ts successfully')

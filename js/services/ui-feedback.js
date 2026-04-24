export function setButtonBusy(button, busy, options = {}) {
  if (!button) return;
  const idleText = options.idleText ?? button.dataset.idleText ?? button.textContent;
  const busyText = options.busyText ?? button.dataset.busyText ?? 'Working...';
  if (!button.dataset.idleText) button.dataset.idleText = idleText;
  button.disabled = !!busy;
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
  button.classList.toggle('is-busy', !!busy);
  button.textContent = busy ? busyText : idleText;
}

export function setFormBusy(form, busy) {
  if (!form) return;
  form.setAttribute('aria-busy', busy ? 'true' : 'false');
  form.classList.toggle('is-busy', !!busy);
  form.querySelectorAll('input, select, textarea, button').forEach((node) => {
    if (node.dataset.allowBusy === 'true') return;
    node.disabled = !!busy;
  });
}

export function showInlineFeedback(node, message = '', type = 'info') {
  if (!node) return;
  if (!message) {
    node.hidden = true;
    node.textContent = '';
    node.className = 'inline-feedback';
    return;
  }
  node.hidden = false;
  node.textContent = message;
  node.className = `inline-feedback ${type}`;
}

export async function runBusyAction({ button = null, form = null, feedbackNode = null, busyText = 'Working...', successMessage = '', onSuccess = null, action }) {
  try {
    if (feedbackNode) showInlineFeedback(feedbackNode, '', 'info');
    if (form) setFormBusy(form, true);
    if (button) setButtonBusy(button, true, { busyText });
    const result = await action();
    if (successMessage && feedbackNode) showInlineFeedback(feedbackNode, successMessage, 'success');
    if (typeof onSuccess === 'function') await onSuccess(result);
    return result;
  } catch (error) {
    if (feedbackNode) showInlineFeedback(feedbackNode, error?.message || 'Something went wrong.', 'error');
    throw error;
  } finally {
    if (form) setFormBusy(form, false);
    if (button) setButtonBusy(button, false);
  }
}

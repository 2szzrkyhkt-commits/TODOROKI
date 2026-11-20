'use strict';

const headerAccount = document.querySelector('[data-header-account]');

if (headerAccount) {
  const login = headerAccount.querySelector(':scope > a');
  const details = headerAccount.querySelector('details');
  const logout = details.querySelector('button');
  const status = details.querySelector('[role="status"]');
  let busy = false;

  async function auth(path, method = 'GET') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/auth/' + path, {
        method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal
      });
      if (!response.ok) throw new Error('Account request failed');
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function showAccount(authenticated) {
    const focusWasInAccount = headerAccount.contains(document.activeElement);
    login.hidden = authenticated;
    details.hidden = !authenticated;
    if (!authenticated) {
      details.open = false;
      if (focusWasInAccount) login.focus();
    }
  }

  async function checkSession() {
    if (busy) return;
    busy = true;
    try {
      const { member } = await auth('me');
      if (member !== null && !(typeof member?.email === 'string' && member.email)) {
        throw new Error('Invalid session response');
      }
      showAccount(member !== null);
    } catch {
      // Let the login page handle an unavailable session check.
      if (details.hidden) showAccount(false);
    } finally {
      busy = false;
    }
  }

  logout.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    logout.disabled = true;
    status.hidden = true;
    try {
      const { ok } = await auth('logout', 'POST');
      if (ok !== true) throw new Error('Logout failed');
      showAccount(false);
      login.focus();
    } catch {
      status.textContent = 'ログアウトできませんでした。もう一度お試しください。';
      status.hidden = false;
    } finally {
      logout.disabled = false;
      busy = false;
    }
  });

  headerAccount.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !details.open) return;
    details.open = false;
    details.querySelector('summary').focus();
  });
  document.addEventListener('click', event => {
    if (!headerAccount.contains(event.target)) details.open = false;
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) checkSession();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkSession();
  });
  checkSession();
}

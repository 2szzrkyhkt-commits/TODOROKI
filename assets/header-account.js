'use strict';

const headerAccount = document.querySelector('[data-header-account]');

if (headerAccount) {
  const login = headerAccount.querySelector(':scope > a');
  const loginLabel = login.querySelector('[data-account-login-label]');
  const details = headerAccount.querySelector('details');
  const logout = details.querySelector('button');
  const edinet = details.querySelector('[data-edinet-connect]');
  const status = details.querySelector('[role="status"]');
  const sessionUnavailable = 'ログイン状態を更新できませんでした。接続を確認してください。';
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

  function showAccount(authenticated, unavailable = false) {
    const focusWasInAccount = headerAccount.contains(document.activeElement);
    if (loginLabel) loginLabel.textContent = unavailable ? '状態を確認' : 'ログイン';
    if (unavailable) login.setAttribute('aria-label', 'ログイン状態を確認できませんでした。ログイン画面で確認する');
    else login.removeAttribute('aria-label');
    login.hidden = authenticated;
    details.hidden = !authenticated;
    if (authenticated) edinet?.setAttribute('href', 'https://todoroki-edinet-connect.easysquid66.chatgpt.site/');
    else edinet?.removeAttribute('href');
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
      if (status.textContent === sessionUnavailable) status.hidden = true;
      showAccount(member !== null);
    } catch {
      // A failed check is not proof that the visitor is signed out.
      if (details.hidden) {
        showAccount(false, true);
      } else {
        status.textContent = sessionUnavailable;
        status.hidden = false;
      }
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

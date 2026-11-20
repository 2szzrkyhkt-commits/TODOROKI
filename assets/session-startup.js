'use strict';

window.todorokiSessionStartup = (onResult, { recheckOnResume = false } = {}) => {
  const page = document.getElementById('td-session-page');
  const splash = document.getElementById('td-splash');
  const error = document.getElementById('td-session-error');
  let state = 'checking';
  let pending = false;

  async function check() {
    if (pending) return;
    pending = true;
    error.hidden = true;
    if (page.hidden) splash.hidden = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal
      });
      if (!response.ok) throw new Error('Session check failed');
      const data = await response.json();
      if (data?.member === null) {
        state = 'unauthenticated';
      } else if (typeof data?.member?.email === 'string' && data.member.email) {
        state = 'authenticated';
      } else {
        throw new Error('Invalid session response');
      }
      if (onResult(state) === false) {
        page.hidden = true;
        splash.hidden = false;
        return;
      }
      page.hidden = false;
      splash.hidden = true;
    } catch {
      page.hidden = true;
      error.hidden = false;
      splash.hidden = true;
    } finally {
      clearTimeout(timeout);
      pending = false;
    }
  }

  document.getElementById('td-session-retry').addEventListener('click', check);
  if (recheckOnResume) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) check();
    });
  }
  check();
};

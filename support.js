(() => {
  const button = document.querySelector('#checkout');
  const status = document.querySelector('#status');
  const choices = [...document.querySelectorAll('[data-amount]')];
  let amount = 300, enabled = false, busy = false, requestId = null;
  choices.forEach(choice => choice.addEventListener('click', () => {
    if (busy) return;
    const next = Number(choice.dataset.amount);
    if (next !== amount) requestId = null;
    amount = next;
    choices.forEach(c => c.setAttribute('aria-pressed', String(c === choice)));
  }));
  const result = new URL(location.href).searchParams.get('result');
  fetch('/api/support/status', {cache:'no-store'}).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
    enabled = data.enabled === true;
    button.disabled = !enabled;
    button.textContent = enabled ? 'Stripeで応援する' : '受付準備中';
    status.textContent = enabled ? '金額を選んで決済画面へ進んでください。' : '現在、支援の受付を準備しています。';
    if (result === 'returned') status.textContent = '決済画面から戻りました。支払い結果はStripeの決済画面や領収メールでご確認ください。';
    if (result === 'cancelled') status.textContent = '決済を中断しました。';
  }).catch(() => { status.textContent = '受付状況を確認できません。時間をおいて再度お試しください。'; });
  button.addEventListener('click', async () => {
    if (!enabled || busy) return;
    busy = true; button.disabled = true; choices.forEach(c => c.disabled = true);
    status.textContent = '決済画面を開いています。';
    requestId ||= crypto.randomUUID();
    try {
      const response = await fetch('/api/support/checkout', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,requestId})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || '決済画面を開けませんでした。');
      if (new URL(data.url).origin !== 'https://checkout.stripe.com') throw Error('決済先を確認できません。');
      location.assign(data.url);
    } catch (error) {
      status.textContent = error.message || '接続できませんでした。もう一度お試しください。';
      busy = false; button.disabled = false; choices.forEach(c => c.disabled = false);
    }
  });
})();

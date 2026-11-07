const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
const submit = document.querySelector('#submit');
const message = document.querySelector('#message');
const result = document.querySelector('#result');

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.toggle('active', item === tab));
    views.forEach((view) => view.classList.toggle('active-view', view.id === tab.dataset.view));
  });
}

submit.addEventListener('click', () => {
  const text = message.value.trim();
  if (!text) {
    message.focus();
    return;
  }
  const issueKey = `CTX-${Math.floor(100 + Math.random() * 899)}`;
  const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
  document.querySelector('#console-message').textContent = text;
  document.querySelector('#console-surface').textContent = 'shipping';
  document.querySelector('#console-time').textContent = time;
  document.querySelector('#console-status').textContent = 'created';
  document.querySelector('#console-key').textContent = issueKey;
  document.querySelector('#console-envelope').textContent = 'header.payload.signature';
  result.hidden = false;
  result.innerHTML = `<strong>Report relayed.</strong> The first-party receiver created <code>${issueKey}</code> from the signed context assertion.`;
  tabs[1].click();
});

var NEWSLETTER_SUBSCRIBE_API = '/api/newsletter/subscribe';
var NEWSLETTER_BUTTON_LABEL = 'SUBSCRIBE';

async function handleNewsletterSubscribe(formId) {
  var ids = formId === 'hero'
    ? { email: 'heroEmail', btn: 'heroBtn', confirm: 'heroConfirm', error: 'heroError' }
    : { email: 'notifyEmail', btn: 'notifyBtn', confirm: 'emailConfirm', error: 'emailError' };

  var emailInput = document.getElementById(ids.email);
  var btn = document.getElementById(ids.btn);
  var confirmEl = document.getElementById(ids.confirm);
  var errorEl = document.getElementById(ids.error);

  if (!emailInput || !btn || !confirmEl || !errorEl) return;

  var email = emailInput.value.trim();
  if (!email || email.indexOf('@') === -1) {
    errorEl.textContent = 'Please enter a valid email address.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'SUBSCRIBING...';
  confirmEl.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    var res = await fetch(NEWSLETTER_SUBSCRIBE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, source: 'landing' }),
    });

    if (!res.ok) {
      var payload = null;
      try {
        payload = await res.json();
      } catch (parseErr) {
        payload = null;
      }
      errorEl.textContent = (payload && payload.error) || ('Server returned ' + res.status + '. Try again.');
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = NEWSLETTER_BUTTON_LABEL;
      return;
    }

    confirmEl.textContent = "You're subscribed — watch for Signal+ Weekly in your inbox.";
    confirmEl.style.display = 'block';
    emailInput.style.display = 'none';
    btn.style.display = 'none';
  } catch (err) {
    errorEl.textContent = 'Network error: ' + err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = NEWSLETTER_BUTTON_LABEL;
  }
}

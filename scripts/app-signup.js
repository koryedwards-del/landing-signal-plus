var APP_REQUEST_API = '/api/app/request';
var APP_BUTTON_LABEL = 'GET SIGNAL+ FREE';

async function handleAppSignup(formId) {
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
  btn.textContent = 'SENDING...';
  confirmEl.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    var res = await fetch(APP_REQUEST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    });

    var payload = null;
    try {
      payload = await res.json();
    } catch (parseErr) {
      payload = null;
    }

    if (!res.ok || !payload || payload.ok !== true) {
      errorEl.textContent = (payload && payload.error) || ('Could not send your link (server returned ' + res.status + '). Try again.');
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = APP_BUTTON_LABEL;
      return;
    }

    confirmEl.textContent = 'Check your email for your Signal+ app link.';
    confirmEl.style.display = 'block';
    emailInput.style.display = 'none';
    btn.style.display = 'none';
  } catch (err) {
    errorEl.textContent = 'Network error: ' + err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = APP_BUTTON_LABEL;
  }
}

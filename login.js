const loginForm = document.getElementById('login-form');
const loginSubmit = document.getElementById('login-submit');
const loginMessage = document.getElementById('login-message');

loginForm?.addEventListener('submit', event => {
  event.preventDefault();
  loginSubmit.disabled = true;
  loginSubmit.textContent = 'Validando...';
  loginMessage.textContent = '';

  fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('admin-username').value.trim(),
      password: document.getElementById('admin-password').value
    })
  })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo iniciar sesión.');
      window.location.href = '/admin';
    })
    .catch(error => {
      loginMessage.textContent = error.message;
    })
    .finally(() => {
      loginSubmit.disabled = false;
      loginSubmit.textContent = 'Ingresar';
    });
});

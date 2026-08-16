const loginView = document.getElementById('login-view');
const browserView = document.getElementById('browser-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const whoamiEl = document.getElementById('whoami');
const logoutBtn = document.getElementById('logout-btn');

function showLogin() {
  loginView.classList.remove('hidden');
  browserView.classList.add('hidden');
}

function showBrowser(username) {
  loginView.classList.add('hidden');
  browserView.classList.remove('hidden');
  whoamiEl.textContent = username;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.classList.add('hidden');
  const formData = new FormData(loginForm);
  try {
    const result = await api.login(formData.get('username'), formData.get('password'));
    showBrowser(result.username);
    window.uploadApp.setAllowedExtensions(result.allowedFileExtensions);
    window.browserApp.navigate('');
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', async () => {
  await api.logout();
  showLogin();
});

(async function init() {
  const me = await api.me();
  if (me) {
    showBrowser(me.username);
    window.uploadApp.setAllowedExtensions(me.allowedFileExtensions);
    window.browserApp.navigate('');
  } else {
    showLogin();
  }
})();

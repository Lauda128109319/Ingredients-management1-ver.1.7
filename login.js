const $ = (sel) => document.querySelector(sel);
const API_URL = '/api'; // 同じサーバー内なので省略URLでOK

function toggleForms(show) {
  $('#loginForm').style.display = (show === 'login') ? 'block' : 'none';
  $('#registerForm').style.display = (show === 'register') ? 'block' : 'none';
  $('#showLoginLink').style.display = (show === 'register') ? 'inline' : 'none';
  $('#showRegisterLink').style.display = (show === 'login') ? 'inline' : 'none';
  $('#loginError').style.display = 'none';
  $('#regError').style.display = 'none';
}

function showError(elId, msg) {
    const el = $(elId); el.textContent = msg; el.style.display = 'block';
}

// 新規登録
$('#registerBtn').onclick = async () => {
  const username = $('#regUser').value.trim();
  const password = $('#regPass').value.trim();
  if (!username || !password) return showError('#regError', '入力してください');

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
        alert('登録完了！ログインしてください');
        toggleForms('login');
    } else {
        showError('#regError', data.error);
    }
  } catch (e) { showError('#regError', 'サーバー接続エラー'); }
};

// ログイン
$('#loginBtn').onclick = async () => {
  const username = $('#loginUser').value.trim();
  const password = $('#loginPass').value.trim();
  if (!username || !password) return showError('#loginError', '入力してください');

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
        sessionStorage.setItem('loggedInUser', data.user.username);
        window.location.href = './index.html';
    } else {
        showError('#loginError', data.error);
    }
  } catch (e) { showError('#loginError', 'サーバー接続エラー'); }
};

$('#showRegisterLink').onclick = () => toggleForms('register');
$('#showLoginLink').onclick = () => toggleForms('login');

if (sessionStorage.getItem('loggedInUser')) window.location.href = './index.html';
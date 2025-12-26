// --- 認証チェック ---
const currentUser = sessionStorage.getItem('loggedInUser');
if (!currentUser) window.location.href = './login.html';

const API_URL = '/api';
const $ = (sel) => document.querySelector(sel);
const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
let currentDate = new Date();

// --- サーバー通信関数 (Fetch API) ---
async function apiGet(ep) { const r = await fetch(API_URL + ep); return r.json(); }
async function apiPost(ep, d) { await fetch(API_URL + ep, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(d) }); }
async function apiDel(ep) { await fetch(API_URL + ep, { method: 'DELETE' }); }
async function apiPut(ep, d) { await fetch(API_URL + ep, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(d) }); }

// --- データ読み込み ---
async function load() {
  // サーバーから自分のデータを取得
  return await apiGet(`/foods?username=${currentUser}`);
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

async function renderAll() {
    const foods = await load();
    renderCalendar(foods);
    renderListView(foods);
    updateAutocomplete(foods);
    checkAndNotify(foods);
}

// 履歴オートコンプリート更新
function updateAutocomplete(foods) {
  const historyList = $('#nameHistory');
  if (!historyList) return;
  historyList.innerHTML = '';
  const names = [...new Set(foods.map(f => f.name))].sort();
  names.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    historyList.appendChild(option);
  });
}

// --- リスト表示 ---
function renderListView(list) {
  const sortedList = [...list].sort((a, b) => a.expiry - b.expiry);
  const wrap = $('#list'); wrap.innerHTML = '';
  const now = Date.now();

  for (const f of sortedList) {
    const daysLeft = Math.ceil((f.expiry - now) / 86400000);
    const cls = daysLeft <= 0 ? 'danger' : (daysLeft <= 2 ? 'warn' : 'ok');
    let label = '';
    if (daysLeft < -3) label = '期限切れ';
    else if (daysLeft < 0) label = '消費してください';
    else if (daysLeft <= 0) label = '本日消費期限';
    else label = `あと${daysLeft}日`;

    const div = document.createElement('div');
    div.className = 'item';
    div.draggable = true;
    div.innerHTML = `
      <div>
        <div><strong>${escapeHtml(f.name)}</strong> × ${f.qty}</div>
        <div style="color:#9ca3af;font-size:12px">期限: ${new Date(f.originalExpiry || f.expiry).toLocaleDateString()}</div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span class="badge ${cls}" style="margin-right:4px">${label}</span>
        <button class="edit">編集</button>
        <button class="danger consume">消費</button>
      </div>`;

    // ドラッグ＆ボタンイベント
    div.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', f.id));
    div.querySelector('.edit').onclick = () => openEditModal(f.id);
    div.querySelector('.consume').onclick = () => consume(f.id);
    wrap.appendChild(div);
  }
}

// --- カレンダー表示 ---
function renderCalendar(foods) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  $('#monthYear').textContent = `${year}年 ${month + 1}月`;
  const calendarGrid = $('#calendar');
  calendarGrid.innerHTML = '';
  
  const foodsByDate = foods.reduce((acc, f) => {
    const d = new Date(f.originalExpiry || f.expiry);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  ['日','月','火','水','木','金','土'].forEach(d => {
      const el = document.createElement('div'); el.className = 'calendar-day header'; el.textContent = d;
      calendarGrid.appendChild(el);
  });
  for(let i=0; i<firstDay; i++) calendarGrid.appendChild(document.createElement('div'));

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    dayEl.dataset.date = dateStr;
    dayEl.innerHTML = `<span class="calendar-day-number">${day}</span>`;

    // ドロップ対応
    dayEl.ondragover = (e) => { e.preventDefault(); dayEl.classList.add('drag-over'); };
    dayEl.ondragleave = () => dayEl.classList.remove('drag-over');
    dayEl.ondrop = (e) => {
        e.preventDefault(); dayEl.classList.remove('drag-over');
        handleDropOnCalendar(e.dataTransfer.getData('text/plain'), dateStr);
    };

    if (foodsByDate[dateStr]) {
        foodsByDate[dateStr].forEach(f => {
            const item = document.createElement('div');
            item.className = 'calendar-item ok'; // 簡易表示
            item.textContent = f.name;
            item.draggable = true;
            item.ondragstart = (e) => { e.dataTransfer.setData('text/plain', f.id); e.stopPropagation(); };
            dayEl.appendChild(item);
        });
    }
    calendarGrid.appendChild(dayEl);
  }
}

// --- 機能ロジック ---
async function addFood() {
  const name = $('#name').value.trim();
  if (!name) return alert('名前を入れてください');
  const date = $('#date').value;
  const qty = parseFloat($('#qty').value || '1');
  
  const inputDate = date ? new Date(date + 'T00:00:00') : new Date();
  const originalExpiry = inputDate.getTime();
  const expiry = new Date(inputDate); expiry.setDate(expiry.getDate() - 3);

  const id = String(Date.now() + Math.random());
  
  // サーバーへ送信
  await apiPost('/foods', { 
      id, username: currentUser, name, qty, 
      expiry: expiry.getTime(), originalExpiry 
  });

  $('#name').value = '';
  renderAll();
}

async function consume(id) {
  if (confirm('消費しましたか？')) {
    await apiDel(`/foods/${id}`);
    renderAll();
  }
}

async function clearAllFoods() {
  if (!confirm('全データを削除しますか？')) return;
  const foods = await load();
  for (const f of foods) await apiDel(`/foods/${f.id}`);
  renderAll();
}

async function handleDropOnCalendar(foodId, newDateStr) {
  if (!foodId) return;
  const foods = await load();
  const target = foods.find(f => f.id === foodId);
  if (!target) return;

  if (confirm(`「${target.name}」の日付を ${newDateStr} に変更しますか？`)) {
      const newDate = new Date(newDateStr + 'T00:00:00');
      const originalExpiry = newDate.getTime();
      const expiry = new Date(newDate); expiry.setDate(expiry.getDate() - 3);
      
      await apiPut(`/foods/${foodId}`, { 
          ...target, originalExpiry, expiry: expiry.getTime() 
      });
      renderAll();
  }
}

// --- AIレシピ提案 (Gemini) ---
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function suggestRecipe() {
  const apiKey = $('#apiKey').value.trim();
  if (!apiKey) return alert('APIキーを入力してください');
  localStorage.setItem('gemini_api_key', apiKey);

  const foods = await load();
  if (foods.length === 0) return alert('食材がありません');

  const btn = $('#suggestBtn');
  const output = $('#recipeOutput');
  const originalText = btn.textContent;
  
  btn.disabled = true; btn.textContent = '思考中...🍳';
  output.style.display = 'block'; output.innerHTML = '生成中...';

  try {
    const ingredients = foods.map(f => `${f.name} ${f.qty}個`).join(', ');
    const prompt = `以下の食材でレシピを3つ提案して(HTML形式)。CSSやstyleタグは絶対に含めないでください: ${ingredients}`;
    
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';

    // タグ除去
    text = text.replace(/```html|```/g, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    output.innerHTML = text;

  } catch (err) {
    output.textContent = 'エラー: ' + err.message;
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}
const savedKey = localStorage.getItem('gemini_api_key');
if (savedKey) $('#apiKey').value = savedKey;


// --- 音声入力機能 (Voice) ---
const voiceBtn = $('#voiceBtn');
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  
  recognition.onstart = () => { voiceBtn.textContent = '👂'; voiceBtn.classList.add('recording'); };
  recognition.onend = () => { voiceBtn.textContent = '🎤'; voiceBtn.classList.remove('recording'); };
  
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.replace(/[。、]$/, '');
    const match = text.match(/(\d+)/);
    if (match) {
        $('#qty').value = match[0];
        $('#name').value = text.replace(/\d+/g, '').replace(/個|つ|本|枚|束|パック/g, '').trim();
    } else {
        $('#name').value = text;
    }
  };
  voiceBtn.onclick = () => recognition.start();
} else {
  voiceBtn.style.display = 'none';
}

// --- 編集機能 ---
let currentEditingId = null;
async function openEditModal(id) {
  const foods = await load();
  const target = foods.find(f => f.id === id);
  if (!target) return;
  currentEditingId = id;
  $('#editName').value = target.name;
  $('#editQty').value = target.qty;
  const d = new Date(target.originalExpiry || target.expiry);
  $('#editDate').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('#editDialog').showModal();
}

async function saveEdit() {
  if (!currentEditingId) return;
  const name = $('#editName').value.trim();
  const date = $('#editDate').value;
  const qty = parseFloat($('#editQty').value || '0');
  
  const foods = await load();
  const original = foods.find(f => f.id === currentEditingId);

  const inputDate = new Date(date + 'T00:00:00');
  const originalExpiry = inputDate.getTime();
  const expiry = new Date(inputDate); expiry.setDate(expiry.getDate() - 3);

  await apiPut(`/foods/${currentEditingId}`, { ...original, name, qty, expiry: expiry.getTime(), originalExpiry });
  $('#editDialog').close();
  renderAll();
}

// 通知チェック (ブラウザ起動中のみ簡易チェック)
function checkAndNotify(foods) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();
    const near = foods.filter(f => f.expiry - now <= twoDaysMs);
    if (near.length > 0) {
        console.log('期限が近い食材があります:', near.map(f=>f.name));
    }
}
async function reqPerm(){ if('Notification' in window) await Notification.requestPermission(); }
reqPerm();

// イベント
$('#add').onclick = addFood;
$('#suggestBtn').onclick = suggestRecipe;
$('#clearAllBtn').onclick = clearAllFoods;
$('#saveEditBtn').onclick = saveEdit;
$('#cancelEditBtn').onclick = () => $('#editDialog').close();
$('#prevMonthBtn').onclick = () => { currentDate.setMonth(currentDate.getMonth()-1); renderAll(); };
$('#nextMonthBtn').onclick = () => { currentDate.setMonth(currentDate.getMonth()+1); renderAll(); };
$('#logoutBtn').onclick = () => { sessionStorage.removeItem('loggedInUser'); location.href='./login.html'; };
$('h1').textContent = `${currentUser}の食材リスト`;

// PWA Service Worker (維持)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

renderAll();
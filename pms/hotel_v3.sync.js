// ============================================================
// クラウド同期（GAS + Googleドライブ）
// ============================================================
// ▼ GASデプロイ後にURLをここへ貼り付けてください
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxRIQQy4vygxy0NM9QlBBqwYUQucNmlwJI7TuIsCSwTkAkW7q585aO0qcLO0cjUIUpwnw/exec';

// ── APIキー（管理者キー）─────────────────────────────────
// 秘密のキーはコードに書かず、初回に入力して端末のlocalStorageへ保存する。
// GAS側で setupApiKeys() を実行するまでは未入力でも従来通り動作する（移行猶予）。
function _apiKey(){ try{ return localStorage.getItem('hotel_api_key')||''; }catch(e){ return ''; } }
function _withKey(url){
  const k=_apiKey();
  return k ? url + (url.indexOf('?')>=0?'&':'?') + 'key=' + encodeURIComponent(k) : url;
}
// キー入力（初回・キー変更時）。入力があればtrue
function promptApiKey(message){
  const cur=_apiKey();
  const k=prompt((message||'APIキー（管理者用）を入力してください。\nGASエディタで setupApiKeys() を実行すると表示されます。'), cur);
  if(k!==null && k.trim()){ try{ localStorage.setItem('hotel_api_key', k.trim()); }catch(e){} return true; }
  return false;
}
// unauthorized応答の共通判定。キー再入力を促し、入力されたらtrue（＝呼び出し元でリトライ可）
let _lastUnauthorizedPromptAt = 0;
function _handleUnauthorized(errMsg){
  if(String(errMsg||'').indexOf('unauthorized')<0) return false;
  // 30秒ポーリング等での連続ポップアップを防止（60秒以内の再表示は抑制）
  const now = Date.now();
  if(now - _lastUnauthorizedPromptAt < 60000) return false;
  _lastUnauthorizedPromptAt = now;
  return promptApiKey('⚠ APIキーが未設定または無効です。\n管理者キーを入力してください（GASの setupApiKeys() 実行ログに表示されます）。');
}

// ── チェックイン用URL（QR）生成 ──────────────────────────────
// 画像ではなくURL文字列のみを cloudData(guestData) 内に保存し肥大化を防ぐ。
// メール送信等でも流用できるよう共通関数として切り出し。
const CHECKIN_APP_BASE_URL = 'https://enoshimaguesthouse-crypto.github.io/checkin-app/checkin-app.html';
function generateCheckinUrl(reservationId){
  const id=String(reservationId||'').trim();
  if(!id)return '';
  return CHECKIN_APP_BASE_URL + '?reservationId=' + encodeURIComponent(id);
}

let cloudUpdatedAt = null;   // サーバーの最終更新時刻
let pollingTimer   = null;   // ポーリングタイマー
let isSyncing      = false;  // 二重リクエスト防止
let isDirty        = false;  // 未保存の変更あり（保存成功でfalse・ポーリング上書き/離脱警告の判定に使用）

// すべてのデータをオブジェクトにまとめる
// ══════════════════════════════════════════════
//  監査ログ（誰が・いつ・何を変更したか）
// ══════════════════════════════════════════════
// cloudData 内の auditLog テーブルに保持し、既存の cloudSave() 経路でDriveへ保存する。
// （localStorage・別JSONファイル・独自save関数は使わない）
// logAudit は記録のみを行い保存はしない。呼び出し元が既に autoSave()/cloudSave() を実行するため。
const AUDIT_LOG_MAX=500;   // JSON肥大化防止：直近500件のみ保持（超過分は古い順に破棄）
let auditLog=[];
function logAudit(action,target,detail){
  try{
    auditLog.push({
      ts:     new Date().toISOString(),
      user:   (typeof currentUserName!=='undefined' && currentUserName) || '未認証',
      role:   (typeof currentRole!=='undefined' && currentRole) || '-',
      action: String(action||''),
      target: String(target||''),
      detail: String(detail||'')
    });
    if(auditLog.length>AUDIT_LOG_MAX) auditLog.splice(0, auditLog.length-AUDIT_LOG_MAX);
  }catch(e){ console.warn('監査ログの記録に失敗:',e); }
}

// ── 監査ログ ビューア（閲覧専用。ログの改変はできない） ──────────────
function openAuditLog(){
  const mx=document.getElementById('al-max'); if(mx)mx.textContent=String(AUDIT_LOG_MAX);
  // フィルタ選択肢を実データから生成
  const fill=(id,vals)=>{
    const el=document.getElementById(id); if(!el)return;
    const cur=el.value;
    el.innerHTML='<option value="">すべて</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if(vals.includes(cur))el.value=cur;
  };
  fill('al-filter-action',[...new Set(auditLog.map(e=>e.action).filter(Boolean))].sort());
  fill('al-filter-user',  [...new Set(auditLog.map(e=>e.user).filter(Boolean))].sort());
  renderAuditLog();
  document.getElementById('audit-log-modal').classList.add('open');
}
function _auditFiltered(){
  const fa=(document.getElementById('al-filter-action')||{}).value||'';
  const fu=(document.getElementById('al-filter-user')||{}).value||'';
  const q=((document.getElementById('al-filter-q')||{}).value||'').trim().toLowerCase();
  return auditLog.filter(e=>{
    if(fa&&e.action!==fa)return false;
    if(fu&&e.user!==fu)return false;
    if(q&&!((e.target||'')+' '+(e.detail||'')).toLowerCase().includes(q))return false;
    return true;
  }).slice().reverse(); // 新しい順
}
function _auditFmtTs(iso){
  const d=new Date(iso);
  if(isNaN(d))return String(iso||'');
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function renderAuditLog(){
  const tb=document.getElementById('al-body'); if(!tb)return;
  const list=_auditFiltered();
  const cnt=document.getElementById('al-count');
  if(cnt)cnt.textContent=`${list.length}件 / 全${auditLog.length}件`;
  if(!list.length){
    tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">記録がありません</td></tr>';
    return;
  }
  tb.innerHTML=list.map((e,i)=>`
    <tr style="border-top:1px solid var(--sand-border);${i%2===1?'background:var(--sand);':''}">
      <td style="padding:8px 12px;white-space:nowrap;color:#666;">${esc(_auditFmtTs(e.ts))}</td>
      <td style="padding:8px 12px;white-space:nowrap;font-weight:600;">${esc(e.user||'')}</td>
      <td style="padding:8px 12px;white-space:nowrap;">${esc(e.action||'')}</td>
      <td style="padding:8px 12px;">${esc(e.target||'')}</td>
      <td style="padding:8px 12px;color:#666;">${esc(e.detail||'')}</td>
    </tr>`).join('');
}
function exportAuditLogCSV(){
  const list=_auditFiltered();
  let csv='﻿日時,操作者,権限,操作,対象,詳細\n';
  list.forEach(e=>{
    const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
    csv+=[q(_auditFmtTs(e.ts)),q(e.user),q(e.role),q(e.action),q(e.target),q(e.detail)].join(',')+'\n';
  });
  const b=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='監査ログ.csv';a.click();
}

// 監査ログ用の予約ラベル（部屋番号・日付・氏名）
function _auditGuestLabel(g){
  if(!g)return '-';
  const r=(rooms||[]).find(x=>x.id===g.roomId);
  return `${r?r.no:('部屋'+g.roomId)} ${g.day||'?'}日 ${g.name||'(無名)'}`;
}

function collectAllData() {
  return {
    guestData,cancelList,parkData,surfList,staffNotes,salesData,
    occCumul,cleaningData,roomSettings,rooms,roomPriorityMaster,unassignedReservations,
    budgets,staffNames,snTypes,priorityCleaningItems,priorityCleaningSettings,
    rentalSpaceReservations,propertySettings,repeatReminders,auditLog,
    posCategories,posProducts,posSales,posSettings,cleaningStaffList,
    updatedBy:(staffNames&&staffNames[0])||'操作者',
    baseUpdatedAt:cloudUpdatedAt,
  };
}

// サーバーから受け取ったデータをアプリへ反映
// ══════════════════════════════════════════════
//  チェックイン完了通知（リアルタイムポップアップ＋音声）
// ══════════════════════════════════════════════
const notifiedReservationIds = new Set();
let _notifFirstSync = true; // 初回同期では通知しない（既存のチェックイン済みを誤通知しないため）

// 予約IDごとの「直近のステータス」をマップ化
function _statusByReservation(gd){
  const map = {};
  Object.values(gd||{}).forEach(g=>{
    if(!g||g.cont)return;
    const id = g.reservationId || g.id;
    if(!id)return;
    // 同一IDで checked_in があればそれを優先記録
    if(map[String(id)]!=='checked_in'){
      map[String(id)] = { status:g.status, name:g.name, roomId:g.roomId, checkedInAt:g.checkedInAt||'' };
    }
  });
  return map;
}

function detectCheckInNotifications(prevGD, newGD){
  const prevMap = _statusByReservation(prevGD);
  const newMap  = _statusByReservation(newGD);

  // 初回同期：現状チェックイン済みのIDを「通知済み」として記録だけして終了
  if(_notifFirstSync){
    Object.keys(newMap).forEach(id=>{
      if(newMap[id].status==='checked_in') notifiedReservationIds.add(id);
    });
    _notifFirstSync = false;
    return;
  }

  Object.keys(newMap).forEach(id=>{
    const cur = newMap[id];
    if(cur.status!=='checked_in') return;
    if(notifiedReservationIds.has(id)) return; // 既に通知済み

    const prev = prevMap[id];
    // 予約済→チェックイン済 への変化（または新規にchecked_inで出現）
    const wasReserved = !prev || prev.status==='reserved' || prev.status==null;
    if(wasReserved){
      notifiedReservationIds.add(id);
      showCheckInNotification(cur);
    } else {
      // 既にchecked_inだった場合は通知せず記録のみ
      notifiedReservationIds.add(id);
    }
  });
}

function showCheckInNotification(info){
  const container = document.getElementById('notification-container');
  if(!container) return;

  // 部屋名を解決
  const room = rooms.find(r=>String(r.id)===String(info.roomId));
  const roomName = room ? `${room.no}　${room.type}` : '';

  // 日時整形
  let dt = '';
  if(info.checkedInAt){
    const m = String(info.checkedInAt).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if(m) dt = `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
    else dt = info.checkedInAt;
  }

  const card = document.createElement('div');
  card.className = 'checkin-notif';
  card.innerHTML = `
    <button class="cn-close" title="閉じる">✕</button>
    <div class="cn-head">✓ チェックイン完了</div>
    <div class="cn-name">${esc(info.name||'(no name)')} 様</div>
    ${roomName?`<div class="cn-room">${esc(roomName)}</div>`:''}
    <div class="cn-msg">チェックインが完了しました</div>
    ${dt?`<div class="cn-time">${dt}</div>`:''}
  `;
  card.querySelector('.cn-close').onclick = ()=>{ card.remove(); };
  container.prepend(card);

  playCheckInSound();
}

// ══════════════════════════════════════════════════════════════
// 🔴 現金払い・到着時刻超過アラート
// ──────────────────────────────────────────────────────────────
// ポップアップは既存の「チェックイン完了」通知（showCheckInNotification）と
// 同一の仕組みをそのまま流用する：同じ #notification-container に同じ .checkin-notif
// カードを prepend し、表示位置・サイズ・角丸・枠線・z-index・開閉操作をすべて共通化。
// 赤テーマの差分のみ .cash-alert 修飾クラスで与える（既存通知には一切影響しない）。
// ══════════════════════════════════════════════════════════════
const cashOverdueNotifiedIds = new Set(); // 同一予約で鳴らし続けないための記録
let _cashOverdueSignature = '';           // 対象集合が変化した時だけ再描画するための署名

function showCashOverdueNotification(info){
  const container = document.getElementById('notification-container');
  if(!container) return;

  const room = rooms.find(r=>String(r.id)===String(info.roomId));
  const roomName = room ? `${room.no}　${room.type}` : '';

  const card = document.createElement('div');
  card.className = 'checkin-notif cash-alert';   // ← 既存カードのCSSをそのまま継承
  card.innerHTML = `
    <button class="cn-close" title="閉じる">✕</button>
    <div class="cn-head">🔴 連絡が必要です</div>
    <div class="cn-name">${esc(info.name||'(no name)')} 様</div>
    ${roomName?`<div class="cn-room">${esc(roomName)}</div>`:''}
    <div class="cn-msg">【現金払い / 到着時刻超過】<br>
      到着予定時刻：${esc(info.arrivalTime||'')}（1時間以上経過しています）<br>
      お客様へ確認の連絡を行ってください。</div>
  `;
  card.querySelector('.cn-close').onclick = ()=>{ card.remove(); };
  container.prepend(card);

  playCashAlertSound();
}

// 現金アラート音（チェックイン音と同じWeb Audio方式・下降音で警告を区別）
function playCashAlertSound(){
  try{
    _audioCtx = _audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const ctx = _audioCtx;
    if(ctx.state==='suspended') ctx.resume();
    const now = ctx.currentTime;
    [ [880, 0], [660, 0.18] ].forEach(([freq, delay])=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now+delay);
      gain.gain.linearRampToValueAtTime(0.22, now+delay+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now+delay+0.45);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now+delay);
      osc.stop(now+delay+0.5);
    });
  }catch(e){
    console.warn('警告音の再生に失敗:', e);
  }
}

// 全予約を走査して超過対象を検出。1分ごとのタイマーから呼ばれる。
// リロード不要で「到着時刻＋1時間」を跨いだ瞬間に警告対象となる。
function checkCashArrivalOverdue(){
  if(!guestData) return;
  const now = new Date();
  const overdue = [];
  Object.entries(guestData).forEach(([k,g])=>{
    if(!g||g.cont) return;
    const p = parseKey(k);
    if(!p) return;
    if(!isCashArrivalOverdue(g,p.y,p.m,p.d,now)) return;
    overdue.push({
      id: String(g.reservationId||g.id||k),
      name: g.name, roomId: g.roomId, arrivalTime: g.arrivalTime
    });
  });

  // チェックイン完了などで対象外になった予約は記録から外す（再度該当すれば再通知される）
  const liveIds = new Set(overdue.map(o=>o.id));
  [...cashOverdueNotifiedIds].forEach(id=>{ if(!liveIds.has(id)) cashOverdueNotifiedIds.delete(id); });

  // 新規に超過した予約だけポップアップ
  overdue.forEach(o=>{
    if(cashOverdueNotifiedIds.has(o.id)) return;
    cashOverdueNotifiedIds.add(o.id);
    showCashOverdueNotification(o);
  });

  // 対象集合が変わった時だけ再描画（毎分の無駄な再描画とスクロール乱れを防ぐ）
  const sig = overdue.map(o=>o.id).sort().join(',');
  if(sig !== _cashOverdueSignature){
    _cashOverdueSignature = sig;
    if(typeof renderReg==='function') _withScrollPreserved(()=>renderReg());
  }
}

// 1分ごとの自動判定を開始
let _cashOverdueTimer = null;
function startCashOverdueWatch(){
  if(_cashOverdueTimer) clearInterval(_cashOverdueTimer);
  checkCashArrivalOverdue();
  _cashOverdueTimer = setInterval(checkCashArrivalOverdue, 60000);
}

// Web Audio API で通知音（チャリーン♪）を生成
let _audioCtx = null;
function playCheckInSound(){
  try{
    _audioCtx = _audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const ctx = _audioCtx;
    if(ctx.state==='suspended') ctx.resume();
    const now = ctx.currentTime;
    // 2音の上昇アルペジオ（C6 → E6）
    [ [1046.5, 0], [1318.5, 0.12] ].forEach(([freq, delay])=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now+delay);
      gain.gain.linearRampToValueAtTime(0.25, now+delay+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now+delay+0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now+delay);
      osc.stop(now+delay+0.45);
    });
  }catch(e){
    console.warn('通知音の再生に失敗:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// 擬似リアルタイム同期：3wayマージエンジン
// ──────────────────────────────────────────────────────────────
// 目的：他端末の追加・変更・削除を数秒で自端末へ反映しつつ、
//       自端末の未保存編集を巻き戻さない。
// 方式：最後にサーバーと一致していた状態を「基準(_syncBase)」として保持し、
//       基準・ローカル・サーバーの3者を比較する。
//         ・サーバーだけ変わったキー → サーバー値を採用（＋ハイライト）
//         ・ローカルだけ変わったキー → ローカル値を維持（次回保存で送信）
//         ・両方変わったキー         → ローカルを維持し「競合」として通知
// ══════════════════════════════════════════════════════════════
let _syncBase = null;              // 最後にサーバーと一致していたスナップショット
let _flashKeys = [];               // 次回描画後に光らせる予約キー
// guestData以外でローカル編集を保護するコレクション。
// 各グローバルは let 宣言のため window[名前] では参照できない。明示的なアクセサで扱う。
const MERGE_GUARDS = [
  {n:'cancelList',              g:()=>cancelList,              s:v=>{cancelList=v;}},
  {n:'staffNotes',              g:()=>staffNotes,              s:v=>{staffNotes=v;}},
  {n:'parkData',                g:()=>parkData,                s:v=>{parkData=v;}},
  {n:'rentalSpaceReservations', g:()=>rentalSpaceReservations, s:v=>{rentalSpaceReservations=v;}},
  {n:'rooms',                   g:()=>rooms,                   s:v=>{rooms=v;}},
  {n:'roomSettings',            g:()=>roomSettings,            s:v=>{roomSettings=v;}},
  {n:'roomPriorityMaster',      g:()=>roomPriorityMaster,      s:v=>{roomPriorityMaster=v;}},
  {n:'priorityCleaningItems',   g:()=>priorityCleaningItems,   s:v=>{priorityCleaningItems=v;}},
  {n:'priorityCleaningSettings',g:()=>priorityCleaningSettings,s:v=>{priorityCleaningSettings=v;}},
  {n:'cleaningStaffList',       g:()=>cleaningStaffList,       s:v=>{cleaningStaffList=v;}},
  {n:'propertySettings',        g:()=>propertySettings,        s:v=>{propertySettings=v;}},
  {n:'garbageRules',            g:()=>garbageRules,            s:v=>{garbageRules=v;}},
  {n:'repeatReminders',         g:()=>repeatReminders,         s:v=>{repeatReminders=v;}},
  {n:'staffNames',              g:()=>staffNames,              s:v=>{staffNames=v;}},
  {n:'snTypes',                 g:()=>snTypes,                 s:v=>{snTypes=v;}},
  {n:'budgets',                 g:()=>budgets,                 s:v=>{budgets=v;}}
];
const _J = v => { try{ return JSON.stringify(v ?? null); }catch(e){ return String(v); } };
const _clone = v => { try{ return JSON.parse(JSON.stringify(v ?? null)); }catch(e){ return v; } };

// サーバーと一致した時点の状態を基準として記録する
// マージ時はサーバー側のguestDataを基準にする（マージ結果ではない）
let _pendingBaseGuestData = null;
function snapshotSyncBase(){
  const snap = { guestData: _clone(_pendingBaseGuestData || guestData) };
  _pendingBaseGuestData = null;
  MERGE_GUARDS.forEach(a=>{ try{ snap[a.n] = _clone(a.g()); }catch(e){} });
  _syncBase = snap;
}

// guestData の3wayマージ。戻り値の out を新しい guestData として採用する。
function _mergeGuestData(serverGD){
  const base = (_syncBase && _syncBase.guestData) || {};
  const local = guestData || {};
  const out = {}, changed = [], conflicts = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(serverGD)]);
  keys.forEach(k=>{
    const b=_J(base[k]), l=_J(local[k]), s=_J(serverGD[k]);
    const locChanged = (l!==b), srvChanged = (s!==b);
    if(!locChanged){
      // 自分は触っていない → サーバーに従う（削除も反映される）
      if(serverGD[k]!==undefined) out[k]=serverGD[k];
      if(srvChanged) changed.push(k);
      return;
    }
    // 自分が編集済み → ローカルを維持
    if(local[k]!==undefined) out[k]=local[k];
    if(srvChanged && l!==s) conflicts.push(k);   // 同じ内容になった場合は競合としない
  });
  return { out, changed, conflicts };
}

// isDirty時、ローカルで変更済みのコレクションを退避しておく
function _beginMergeGuard(){
  if(!isDirty || !_syncBase) return null;
  const held = [];
  MERGE_GUARDS.forEach(a=>{
    try{ if(_J(a.g()) !== _J(_syncBase[a.n])) held.push({a, v:a.g()}); }catch(e){}
  });
  return held;
}
function _endMergeGuard(held){
  if(!held || !held.length) return false;
  held.forEach(h=>{ try{ h.a.s(h.v); }catch(e){} });
  return true;
}

// 更新された予約セルを一瞬だけ光らせる（④ 再描画は最小限・スクロール位置は維持）
function _flashUpdatedCells(){
  if(!_flashKeys.length) return;
  const keys = _flashKeys; _flashKeys = [];
  requestAnimationFrame(()=>{
    keys.forEach(k=>{
      document.querySelectorAll(`.gc[data-k="${CSS.escape(k)}"]`).forEach(el=>{
        el.classList.remove('sync-flash');
        void el.offsetWidth;              // アニメーション再起動
        el.classList.add('sync-flash');
        setTimeout(()=>el.classList.remove('sync-flash'), 2200);
      });
    });
  });
}

// 競合（同じ予約を同時編集）の通知。編集パネルが開いていれば該当欄を強調する。
function _notifyConflicts(keys){
  if(!keys.length) return;
  showToast(`⚠ 他のスタッフが同じ予約を更新しました（${keys.length}件）。あなたの編集内容を優先しています。`, 6000);
  if(typeof editKey!=='undefined' && editKey && keys.includes(editKey)){
    const panel = document.getElementById('modal');
    if(panel) panel.classList.add('sync-conflict');
    setTimeout(()=>{ const p=document.getElementById('modal'); if(p)p.classList.remove('sync-conflict'); }, 8000);
  }
}

// 描画中のスクロール位置を維持する（④ 画面のチラつき・スクロールリセット防止）
function _withScrollPreserved(fn){
  const sc = document.getElementById('reg-scroll');
  const x = sc ? sc.scrollLeft : 0, y = sc ? sc.scrollTop : 0;
  const py = window.scrollY;
  fn();
  const sc2 = document.getElementById('reg-scroll');
  if(sc2){ sc2.scrollLeft = x; sc2.scrollTop = y; }
  window.scrollTo(0, py);
}

function applyServerData(data){
  const held = _beginMergeGuard();
  _applyServerDataRaw(data);
  // ローカル編集済みコレクションを書き戻し、必要なら再描画
  if(_endMergeGuard(held)) _withScrollPreserved(()=>renderReg());
  _flashUpdatedCells();
  // 🔴 現金払い・到着時刻超過：データ到着直後にも判定する。
  // BOOT時点では guestData が未読込のため、これが無いと初回ポップアップが最大1分遅れる。
  if(typeof checkCashArrivalOverdue==='function'){
    try{ checkCashArrivalOverdue(); }catch(e){ console.warn('現金アラート判定エラー:',e); }
  }
}

function _applyServerDataRaw(data) {

  if (data.guestData)  {
    // ── チェックイン完了の検知（予約済→チェックイン済への変化）──
    const prevGuestData = guestData || {};
    // 正規化はマージ前に行う（基準との比較を同じ形式で行うため）
    const srvGD = data.guestData;
    Object.values(srvGD).forEach(g=>{
      if(!g)return;
      g.status = normalizeStatus(g.status);
      if(g.checkedInAt===undefined||g.checkedInAt===null)g.checkedInAt='';
    });
    if(isDirty && _syncBase){
      // ② 未保存の編集がある間も取り込む。自分が触っていないセルだけ差し替える。
      const m = _mergeGuestData(srvGD);
      guestData  = m.out;
      _pendingBaseGuestData = srvGD;   // 次回の基準はサーバー状態
      _flashKeys = m.changed.slice(0, 200);   // ③ 更新ブロックを一瞬ハイライト
      if(m.conflicts.length) setTimeout(()=>_notifyConflicts(m.conflicts), 0);
    } else {
      guestData = srvGD;
      // 前回スナップショットとの差分を光らせる（通常時の他端末更新）
      if(_syncBase && _syncBase.guestData){
        const b=_syncBase.guestData, ch=[];
        new Set([...Object.keys(b),...Object.keys(srvGD)]).forEach(k=>{ if(_J(b[k])!==_J(srvGD[k])) ch.push(k); });
        _flashKeys = ch.slice(0, 200);
      }
    }
    // 新データで checked_in になったレコードを検知して通知
    try{ detectCheckInNotifications(prevGuestData, guestData); }catch(e){ console.warn('通知検知エラー:',e); }
  }
  if (data.roomTypeRules && Array.isArray(data.roomTypeRules.rules)) { roomTypeRules = data.roomTypeRules; } // 部屋タイプ判定ルール（GAS配布・一元化）
  if (data.cancelList) { cancelList = data.cancelList;  }
  if (data.roomSettings) { roomSettings = data.roomSettings; saveRoomSettingsLS(); }
  if (data.roomPriorityMaster && typeof data.roomPriorityMaster==='object') {
    // TODO(staffNotes)や部屋設定と同じく、クラウド(cloudData)側の値で完全に上書きする
    const m={};
    Object.entries(data.roomPriorityMaster).forEach(([id,pri])=>{ m[Number(id)]=pri; });
    roomPriorityMaster=m;
    saveRoomPriorityLS();
  }
  if (data.rooms && Array.isArray(data.rooms) && data.rooms.length > 0) {
    rooms = data.rooms;
    // no を文字列として正規化（旧データの数値対応）
    rooms.forEach(r=>{ r.no = String(r.no ?? ''); });
    nextRoomId = Math.max(...rooms.map(r=>r.id||0)) + 1;
  }
  if (data.budgets && typeof data.budgets==='object'){
    // 月別予算：クラウドの値で完全に上書き（キーを数値に正規化）
    const b={};
    for(let m=1;m<=12;m++){
      const v=data.budgets[m]??data.budgets[String(m)];
      if(v!=null) b[m]=Number(v)||0;
    }
    if(Object.keys(b).length>0)budgets=b;
  }
  if (data.parkData){
    parkData=data.parkData;
    // 古い駐車場データを自動クリーンアップ（3ヶ月以上前のデータを除去）
    const now=new Date();
    const cutoff=new Date(now.getFullYear(),now.getMonth()-3,1);
    Object.keys(parkData).forEach(dk=>{
      const m=dk.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
      if(m){
        const dt=new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3]));
        if(dt<cutoff)delete parkData[dk];
      }
    });
  }
  if (data.surfList)   { surfList   = data.surfList;    }
  if (data.unassignedReservations) { unassignedReservations = data.unassignedReservations; }
  if (data.staffNotes) {
    staffNotes = data.staffNotes;
    nextSnId = staffNotes.reduce((m,x)=>Math.max(m,(x.id||0)+1), 0);
  }
  if (data.staffNames && Array.isArray(data.staffNames) && data.staffNames.length > 0) {
    staffNames = data.staffNames;
  }
  if (data.cleaningStaffList && Array.isArray(data.cleaningStaffList) && data.cleaningStaffList.length > 0) {
    cleaningStaffList = data.cleaningStaffList;
  }
  if (data.snTypes && Array.isArray(data.snTypes) && data.snTypes.length > 0) {
    snTypes = data.snTypes;
  }
  if (Array.isArray(data.repeatReminders)) {
    repeatReminders = data.repeatReminders;
    nextReminderId = Math.max(0,...repeatReminders.map(r=>r.id||0))+1;
  }
  if (Array.isArray(data.auditLog)) { auditLog = data.auditLog; } // 監査ログ
  // レジ（簡易POS）
  if (Array.isArray(data.posCategories)) { posCategories = data.posCategories; nextPosCatId = Math.max(0,...posCategories.map(c=>c.id||0))+1; }
  if (Array.isArray(data.posProducts))   { posProducts   = data.posProducts;   nextPosProdId = Math.max(0,...posProducts.map(p=>p.id||0))+1; }
  if (Array.isArray(data.posSales))      { posSales      = data.posSales;      nextPosSaleId = Math.max(0,...posSales.map(s=>s.id||0))+1; }
  if (data.posSettings && typeof data.posSettings==='object') { posSettings = data.posSettings; }
  if(Array.isArray(data.priorityCleaningItems)){
    priorityCleaningItems=data.priorityCleaningItems;
    nextPriorityCleaningId=Math.max(0,...priorityCleaningItems.map(x=>x.id||0))+1;
  }
  if(data.priorityCleaningSettings&&typeof data.priorityCleaningSettings==='object'){
    priorityCleaningSettings={...priorityCleaningSettings,...data.priorityCleaningSettings};
  }
  if (data.cleaningData){ Object.assign(cleaningData, data.cleaningData); }
  if (data.salesData){
    // JSON経由で年・月キーが両方文字列になるため数値に変換して代入
    Object.keys(data.salesData).forEach(y=>{
      const yi=parseInt(y);
      const monthObj={};
      Object.keys(data.salesData[y]).forEach(m=>{
        const key=m==='total'?'total':parseInt(m);
        monthObj[key]=data.salesData[y][m];
      });
      salesData[yi]=monthObj;
    });
  }
  if (data.rentalSpaceReservations && Array.isArray(data.rentalSpaceReservations)) {
    rentalSpaceReservations = data.rentalSpaceReservations;
    nextRentalId = rentalSpaceReservations.reduce((mx,r)=>Math.max(mx,(r.id||0)+1), 1);
  }
  if (data.propertySettings && typeof data.propertySettings==='object') {
    propertySettings = {...propertySettings, ...data.propertySettings};
    if (data.propertySettings.contractAgreement && typeof data.propertySettings.contractAgreement==='object') {
      propertySettings.contractAgreement = {
        ...propertySettings.contractAgreement,
        ...data.propertySettings.contractAgreement,
        texts:{...(propertySettings.contractAgreement.texts||{}), ...(data.propertySettings.contractAgreement.texts||{})}
      };
    }
    // タブレット表示設定（部屋タイプ×言語）はサーバ値をそのまま採用（上のスプレッドで反映済み）
    if (data.propertySettings.tabletDisplaySettings && typeof data.propertySettings.tabletDisplaySettings==='object') {
      propertySettings.tabletDisplaySettings = data.propertySettings.tabletDisplaySettings;
    }
    // ゴミ回収設定（マスターデータ）：サーバ値をそのまま採用。未設定なら初期値を投入。
    if (Array.isArray(data.propertySettings.garbageRules)) {
      propertySettings.garbageRules = data.propertySettings.garbageRules;
      garbageRules = data.propertySettings.garbageRules;
      nextGarbageRuleId = garbageRules.reduce((m,r)=>Math.max(m,Number(r.id)||0),0)+1;
    }
    if (typeof initGarbageRulesIfEmpty==='function') {
      initGarbageRulesIfEmpty();
      propertySettings.garbageRules = garbageRules;
    }
    // 自動メール配信設定：欠けているメール種別/言語をデフォルトで補完しつつサーバ値を採用
    const dms = data.propertySettings.mailSettings;
    if (dms && typeof dms==='object') {
      const base = propertySettings.mailSettings || {};
      ['reservationCreated','checkinCode','checkin','checkout'].forEach(mk=>{
        const def = base[mk] || _defaultMailCfg(mk==='checkinCode'?{qr:false,sendDaysBefore:3,sendTime:'09:00',resend:false}:undefined);
        const sv = dms[mk] || {};
        base[mk] = {
          ...def, ...sv,
          subject:{...(def.subject||{}), ...(sv.subject||{})},
          body:{...(def.body||{}), ...(sv.body||{})},
          attachments:{
            ja:(sv.attachments&&sv.attachments.ja)||[], en:(sv.attachments&&sv.attachments.en)||[],
            zh:(sv.attachments&&sv.attachments.zh)||[], ko:(sv.attachments&&sv.attachments.ko)||[]
          }
        };
      });
      propertySettings.mailSettings = base;
    }
  }
  if (data.occCumul){
    Object.keys(data.occCumul).forEach(y=>{
      const yi=parseInt(y);
      if(!occCumul[yi])occCumul[yi]={};
      Object.keys(data.occCumul[y]).forEach(m=>{
        const mi=parseInt(m);
        const serverArr=data.occCumul[y][m];
        const localArr=occCumul[yi][mi];
        // セル単位でマージ：ローカルに値があるセルは保護、nullはGASで補完
        if(!Array.isArray(localArr)){
          // ローカルに月データなし → GASをそのまま使用
          occCumul[yi][mi]=Array.isArray(serverArr)?serverArr:localArr;
        } else {
          // セル単位マージ：ローカルnull → GASの値で補完、ローカル有値 → 保持
          const merged=localArr.map((lv,i)=>{
            if(lv!=null)return lv; // 手動編集済みセルは保護
            return (Array.isArray(serverArr)&&serverArr[i]!=null)?serverArr[i]:null;
          });
          occCumul[yi][mi]=merged;
        }
      });
    });
  }
  cloudUpdatedAt = data.updatedAt || null;
  snapshotSyncBase();   // サーバーと一致した時点＝次回マージの基準
  _withScrollPreserved(()=>renderReg());
  renderRankAPanel();
  if(document.getElementById('page-cancel')?.classList.contains('active')) renderCancel();
  if(document.getElementById('page-surf')?.classList.contains('active'))   renderSurf();
  if(document.getElementById('page-parking')?.classList.contains('active'))renderParking();
  if(document.getElementById('page-sales')?.classList.contains('active'))  renderSales();
  if(document.getElementById('page-occupancy')?.classList.contains('active'))renderOcc();
  if(document.getElementById('page-rooms')?.classList.contains('active')&&typeof renderRooms==='function')renderRooms();
  updateSyncStatus('ok', '同期済み ' + fmtTime(cloudUpdatedAt));
}

// ── クラウド保存 ──────────────────────────────────────────
async function cloudSave() {
  if (!GAS_URL) { showToast('⚠ GAS URLが設定されていません'); return; }
  if (isSyncing) return;

  // ╔════════════════════════════════════════════════════╗
  // ║ 【重要】空データ保存防止：guestDataが空のクラウド保存は禁止 ║
  // ╚════════════════════════════════════════════════════╝
  // 起動直後（cloudLoad前）や初期化失敗時にguestDataが空のまま保存されると、
  // クラウド上の予約データを全消去してしまう重大事故になる。
  // 通常運用では予約が0件になることはあり得ないため、空ならブロックする。
  const guestCount = guestData ? Object.keys(guestData).length : 0;
  if (guestCount === 0) {
    console.error('[安全装置] guestData が空のためクラウド保存を中止しました。意図しないデータ消去を防止します。', {
      guestData, cancelListLen: (cancelList||[]).length, staffNotesLen: (staffNotes||[]).length
    });
    updateSyncStatus('warn', '保存スキップ（予約データ未読込）');
    showToast('⚠ 予約データが0件のため、クラウド保存をスキップしました（安全装置）', 5000);
    return;
  }
  // さらに念のため：直前にクラウドから読み込んだ件数より極端に減っていれば確認を求める
  if (typeof cloudUpdatedAt !== 'undefined' && cloudUpdatedAt && window._lastLoadedGuestCount != null) {
    const prevCount = window._lastLoadedGuestCount;
    // 50%以上減っているなら異常の可能性
    if (prevCount >= 10 && guestCount < prevCount * 0.5) {
      const ok = confirm(`⚠ 予約データが大幅に減少しています（${prevCount}件 → ${guestCount}件）。\nこのままクラウドに保存しますか？\n\n意図しない削除の場合は「キャンセル」してください。`);
      if (!ok) {
        updateSyncStatus('warn', '保存中止（ユーザー判断）');
        showToast('⚠ クラウド保存を中止しました');
        return;
      }
    }
  }

  isSyncing = true;
  updateSyncStatus('saving', '保存中...');
  try {
    const res = await fetch(_withKey(GAS_URL), {
      method: 'POST',
      body: JSON.stringify(collectAllData()),
    });
    const json = await res.json();
    if (json.status === 'conflict') {
      // 競合してもユーザーに破棄を迫らない。
      // サーバーの最新を3wayマージで取り込み（自分の編集は保持）、そのまま再保存する。
      applyServerData(json.serverData);
      window._lastLoadedGuestCount = guestData ? Object.keys(guestData).length : 0; // 異常検知の基準を更新
      if (_conflictRetry < 3) {
        _conflictRetry++;
        updateSyncStatus('saving', '他端末の更新を統合中...');
        isSyncing = false;
        setTimeout(()=>cloudSave(), 400);
        return;
      }
      _conflictRetry = 0;
      updateSyncStatus('warn', '未保存（競合が続いています）');
      showToast('⚠ 同期が競合し続けています。しばらく待って再度お試しください。', 6000);
    } else if (json.status === 'ok') {
      _conflictRetry = 0;
      cloudUpdatedAt = json.updatedAt;
      isDirty = false;              // 保存成功 → 未保存フラグ解除
      snapshotSyncBase();           // 保存内容＝サーバーと一致 → 次回マージの基準を更新
      _saveRetryCount = 0;          // リトライ回数リセット
      updateSyncStatus('ok', '保存済み ' + fmtTime(json.updatedAt));
      showToast('☁ クラウドに保存しました');
    } else {
      throw new Error(json.error || '不明なエラー');
    }
  } catch(e) {
    updateSyncStatus('error', '保存失敗');
    showToast('❌ 保存失敗: ' + e.message);
    // APIキー未設定/無効なら入力を促し、入力されたら自動リトライ
    if(_handleUnauthorized(e.message)){ isSyncing=false; setTimeout(()=>cloudSave(),300); return; }
    // ネットワーク瞬断など：最大5回まで指数バックオフで自動リトライ（未保存の変更を守る）
    if(_saveRetryCount < 5){
      _saveRetryCount++;
      const wait = Math.min(30000, 3000 * Math.pow(2, _saveRetryCount-1)); // 3,6,12,24,30秒
      updateSyncStatus('warn', `保存失敗（${_saveRetryCount}回目・${Math.round(wait/1000)}秒後に再試行）`);
      isSyncing = false;
      setTimeout(()=>{ if(isDirty)cloudSave(); }, wait);
      return;
    }
  } finally {
    isSyncing = false;
    if(pendingSave){pendingSave=false;setTimeout(()=>cloudSave(),500);}
  }
}
let _saveRetryCount = 0;
let _conflictRetry  = 0;   // 競合→マージ→再保存の連鎖上限

// ── クラウド読込 ──────────────────────────────────────────
async function cloudLoad(silent=false) {
  if (!GAS_URL) { if(!silent) showToast('⚠ GAS URLが設定されていません'); return; }
  if (isSyncing) return;
  isSyncing = true;
  if (!silent) updateSyncStatus('saving', '読込中...');
  try {
    const res = await fetch(_withKey(GAS_URL + '?t=' + Date.now())); // キャッシュ回避
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    // サーバーが新しい場合のみ反映
    if (!cloudUpdatedAt || json.updatedAt !== cloudUpdatedAt) {
      applyServerData(json);
      // クラウドから読み込んだ予約件数を基準値として記録（cloudSaveの異常検知用）
      window._lastLoadedGuestCount = guestData ? Object.keys(guestData).length : 0;
      if (!silent) showToast('🔄 最新データを読み込みました');
      else         showToast('🔄 自動更新しました', 2000);
    } else {
      // updatedAt変化なしでも基準値が未設定なら初期化
      if(window._lastLoadedGuestCount==null){
        window._lastLoadedGuestCount = guestData ? Object.keys(guestData).length : 0;
      }
      if (!silent) showToast('✓ すでに最新です');
      updateSyncStatus('ok', '同期済み ' + fmtTime(cloudUpdatedAt));
    }
  } catch(e) {
    updateSyncStatus('error', '読込失敗');
    if (!silent) showToast('❌ 読込失敗: ' + e.message);
    // APIキー未設定/無効なら入力を促し、入力されたら自動リトライ（初回のサイレント読込でも表示。60秒クールダウンで連発は防止）
    if(_handleUnauthorized(e.message)){ isSyncing=false; setTimeout(()=>cloudLoad(silent),300); return; }
  } finally {
    isSyncing = false;
  }
}

// ── 擬似リアルタイム同期：軽量ポーリング ──────────────────
// ① 7秒ごとに「最終更新日時のみ」を返す超軽量API(type=meta)を叩き、
//    自端末が保持する日時より新しい時だけフルデータを取得する。
//    未保存の編集がある間もポーリングを止めない（applyServerDataが3wayマージするので
//    自分の編集は巻き戻らない）。これにより保存時の競合ダイアログが発生しなくなる。
const POLL_INTERVAL_MS = 7000;
let _metaFailCount = 0;
async function _pollTick(){
  autoCalcTodayOcc();
  if (!GAS_URL || isSyncing) return;      // 保存中はサーバーが書換中なので見送る
  if (document.hidden) return;            // 非表示タブでは通信しない（GASクォータ節約）
  try{
    const res  = await fetch(_withKey(GAS_URL + '?type=meta&t=' + Date.now()));
    const json = await res.json();
    _metaFailCount = 0;
    if (!json.updatedAt) return;
    if (cloudUpdatedAt && json.updatedAt === cloudUpdatedAt) return;  // 変化なし＝ここで通信終了
    await cloudLoad(true);                // ③ 変化があった時だけフル取得してマージ
  }catch(e){
    // metaが使えない場合（GAS未再デプロイ等）は従来どおりフル取得へフォールバック
    if (++_metaFailCount >= 3 && !isDirty) { _metaFailCount = 0; cloudLoad(true); }
  }
}
function startPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  if (!GAS_URL) return;
  pollingTimer = setInterval(_pollTick, POLL_INTERVAL_MS);
  // タブへ復帰した瞬間にも確認（次のtickを待たずに他端末の変更を反映）
  if(!startPolling._vis){
    startPolling._vis = true;
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) _pollTick(); });
  }
}
// 未保存のまま離脱しようとしたら警告（保存完了前のタブ閉じ・リロードによる変更消失を防止）
window.addEventListener('beforeunload', (e) => {
  if (isDirty) { e.preventDefault(); e.returnValue = ''; return ''; }
});
function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

// ── ステータス表示ヘルパー ────────────────────────────────
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}
function updateSyncStatus(state, msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const colors = { ok:'#0F6E56', saving:'#185FA5', warn:'#854F0B', error:'#A32D2D' };
  const icons  = { ok:'☁', saving:'⏳', warn:'⚠', error:'❌' };
  el.textContent = (icons[state]||'') + ' ' + msg;
  el.style.color = colors[state] || '#555';
}
function showToast(msg, duration=3000) {
  let t = document.getElementById('toast');
  if (!t) { t=document.createElement('div'); t.id='toast'; t.style.cssText='position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 18px;border-radius:99px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity .3s;'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.style.opacity='0', duration);
}
let autoSaveTimer=null;
let pendingSave=false; // isSyncing中にautoSaveが来た場合のフラグ
// 保存デバウンス（ms）。編集直後の保存ラグを最小化。
// 連続操作は cloudSave 内の isSyncing / pendingSave ガードで自動的に集約されるため、
// 短くしてもGASへの過剰リクエストにはならない。
const AUTOSAVE_DEBOUNCE_MS=400;
function autoSave(){
  if(!GAS_URL)return;
  isDirty=true; // 未保存の変更あり（保存成功でクリア）
  updateSyncStatus('saving','保存中...');
  clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(async()=>{
    if(isSyncing){
      // 保存中の場合は終了後に再試行
      pendingSave=true;
      return;
    }
    await cloudSave();
  },AUTOSAVE_DEBOUNCE_MS);
}
function renderRankAPanel(){
  const el=document.getElementById('rank-a-list');if(!el)return;
  const items=staffNotes.filter(n=>n.rank==='A'&&!n.done); // 未完了Aランクのみ
  if(!items.length){
    el.innerHTML=`<div style="font-size:11px;color:var(--muted);padding:8px 4px;text-align:center;">Aランクはありません</div>`;
    return;
  }
  const RS={A:{bg:'#FCEBEB',color:'#A32D2D',border:'#E24B4A'},B:{bg:'#FAEEDA',color:'#854F0B',border:'#EF9F27'},C:{bg:'#F1EFE8',color:'#5F5E5A',border:'#B4B2A9'}};
  el.innerHTML=items.map(n=>{
    const ts=getSNTypeStyle(n.type);
    const rs=RS[n.rank||'C'];
    const borderColor=n.done?'#B4B2A9':ts.border;
    return `<div style="background:var(--white);border:1.5px solid ${borderColor}44;border-left:4px solid ${borderColor};border-radius:var(--radius-sm);padding:8px 9px;margin-bottom:7px;opacity:${n.done?0.55:1};">
      <div style="display:flex;align-items:flex-start;gap:6px;">
        <div onclick="toggleSN(${n.id});renderRankAPanel();"
          style="width:16px;height:16px;border-radius:4px;flex-shrink:0;margin-top:2px;cursor:pointer;
          border:2px solid ${n.done?'var(--seaglass)':'var(--sand-border)'};
          background:${n.done?'var(--seaglass)':'var(--white)'};
          display:flex;align-items:center;justify-content:center;">
          ${n.done?'<span style="color:#fff;font-size:9px;line-height:1;">✓</span>':''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;flex-wrap:wrap;">
            ${n.repeatReminderId?`<span style="font-size:9px;font-weight:700;color:#0e6b5e;background:#d1f2eb;border:1px solid #7fd6c4;border-radius:99px;padding:1px 6px;">🔁</span>`:''}
            ${snRankSelectHtml(n.id,n,10)}
            ${snTypeSelectHtml(n.id,n,10)}
          </div>
          <div class="sn-ce" contenteditable="true" data-ph="タイトルを入力"
            onblur="snInlineText(${n.id},'title',this)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
            style="font-size:12px;font-weight:700;line-height:1.4;color:${n.done?'var(--muted)':'var(--ink)'};${n.done?'text-decoration:line-through;':''}margin-bottom:3px;padding:1px 3px;">${esc(n.title||n.text||'')}</div>
          <div class="sn-ce" contenteditable="true" data-ph="詳細を入力（任意）"
            onblur="snInlineText(${n.id},'detail',this)"
            style="font-size:10.5px;color:var(--text);line-height:1.5;white-space:pre-wrap;padding:1px 3px;min-height:1.2em;">${esc(n.detail||'')}</div>
          <div style="display:flex;align-items:center;gap:4px;margin-top:4px;">
            <span style="font-size:10px;font-weight:600;color:var(--ink);">${esc(n.author)}</span>
            <span style="font-size:10px;color:var(--muted);">${esc(n.created)}</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  saveToLS();
}
let rankAPanelHidden=false;
function toggleRankAPanel(){
  rankAPanelHidden=!rankAPanelHidden;
  const panel=document.getElementById('rank-a-panel');
  const reopen=document.getElementById('rank-a-reopen');
  if(rankAPanelHidden){
    panel.style.width='0';
    if(reopen)reopen.style.display='';
  } else {
    panel.style.width='230px';
    if(reopen)reopen.style.display='none';
  }
  saveToLS();
}
// localStorage 保存・復元
function saveToLS(){
  try{localStorage.setItem('hotel_staffNotes',JSON.stringify(staffNotes));
      localStorage.setItem('hotel_staffNames',JSON.stringify(staffNames));
      localStorage.setItem('hotel_snTypes',JSON.stringify(snTypes));
      localStorage.setItem('hotel_repeatReminders',JSON.stringify(repeatReminders));
      localStorage.setItem('hotel_rankAPanelHidden',rankAPanelHidden?'1':'0');
      localStorage.setItem('hotel_roomFilter',JSON.stringify(roomFilter));
      localStorage.setItem('hotel_rooms',JSON.stringify(rooms));
      localStorage.setItem('hotel_budgets',JSON.stringify(budgets));}
  catch(e){}
}
function loadFromLS(){
  try{
    const n=localStorage.getItem('hotel_staffNotes');if(n){staffNotes=JSON.parse(n);nextSnId=staffNotes.reduce((m,x)=>Math.max(m,x.id+1),0);}
    const s=localStorage.getItem('hotel_staffNames');if(s)staffNames=JSON.parse(s);
    const t=localStorage.getItem('hotel_snTypes');if(t)snTypes=JSON.parse(t);
    const rr=localStorage.getItem('hotel_repeatReminders');if(rr){repeatReminders=JSON.parse(rr);nextReminderId=Math.max(0,...repeatReminders.map(r=>r.id||0))+1;}
    rankAPanelHidden=localStorage.getItem('hotel_rankAPanelHidden')==='1';
    const rf=localStorage.getItem('hotel_roomFilter');if(rf){const parsed=JSON.parse(rf);FILTER_GROUPS.forEach(g=>{if(parsed[g.key]!==undefined)roomFilter[g.key]=parsed[g.key];});}
    const bg=localStorage.getItem('hotel_budgets');if(bg){
      const parsed=JSON.parse(bg);
      for(let m=1;m<=12;m++){if(parsed[m]!=null)budgets[m]=Number(parsed[m])||0;}
    }
  }catch(e){}
}
function openSNTypeEdit(){
  document.getElementById('sn-type-inputs').innerHTML=snTypes.map((t,i)=>`
    <div style="display:flex;gap:6px;align-items:center;">
      <input type="text" value="${t.icon}" id="snt-icon-${i}" style="width:52px;text-align:center;font-size:16px;" placeholder="絵文字">
      <input type="text" value="${t.label}" id="snt-label-${i}" style="flex:1;" placeholder="種別名">
      <input type="color" value="${t.border}" id="snt-color-${i}" style="width:36px;height:36px;padding:2px;border-radius:6px;cursor:pointer;" title="ボーダー色">
      <button class="btn btn-xs btn-red" onclick="removeSNType(${i})">削除</button>
    </div>`).join('');
  document.getElementById('sn-type-modal').classList.add('open');
}
function addSNType(){
  snTypes.push({label:'新しい種別',icon:'🔵',color:'#0C447C',bg:'#E6F1FB',border:'#185FA5'});
  openSNTypeEdit();
}
function removeSNType(i){
  if(snTypes.length<=1){alert('種別は最低1つ必要です');return;}
  snTypes.splice(i,1);openSNTypeEdit();
}
function saveSNType(){
  snTypes=snTypes.map((_,i)=>{
    const icon=(document.getElementById(`snt-icon-${i}`)?.value||'⚪').trim();
    const label=(document.getElementById(`snt-label-${i}`)?.value||`種別${i+1}`).trim();
    const border=document.getElementById(`snt-color-${i}`)?.value||'#aaa';
    // bgはborderを20%透過に近い明るさで生成（固定セット or そのまま）
    const bg=border+'22';
    return{label,icon,color:border,bg,border};
  }).filter(t=>t.label);
  closeM('sn-type-modal');renderStaffNotes();saveToLS();autoSave();
}
// スタッフ名編集
function openSNStaffEdit(){
  document.getElementById('sn-staff-inputs').innerHTML=staffNames.map((name,i)=>`
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" value="${name}" id="sn-staff-${i}" style="flex:1;">
      <button class="btn btn-xs btn-red" onclick="removeSNStaff(${i})">削除</button>
    </div>`).join('');
  document.getElementById('sn-staff-modal').classList.add('open');
}
function addSNStaff(){staffNames.push('新しいスタッフ');openSNStaffEdit();}
function removeSNStaff(i){staffNames.splice(i,1);openSNStaffEdit();}
function saveSNStaff(){
  staffNames=staffNames.map((_,i)=>{
    const el=document.getElementById(`sn-staff-${i}`);
    return el?el.value.trim()||`スタッフ${i+1}`:`スタッフ${i+1}`;
  }).filter(Boolean);
  closeM('sn-staff-modal');renderStaffNotes();saveToLS();autoSave();
}
// 清掃担当者編集（スタッフ名編集と同じパターン）
function openCleaningStaffEdit(){
  document.getElementById('cleaning-staff-inputs').innerHTML=cleaningStaffList.map((name,i)=>`
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" value="${esc(name)}" id="cleaning-staff-${i}" style="flex:1;">
      <button class="btn btn-xs btn-red" onclick="removeCleaningStaff(${i})">削除</button>
    </div>`).join('');
  document.getElementById('cleaning-staff-modal').classList.add('open');
}
function addCleaningStaff(){cleaningStaffList.push('新しい担当者');openCleaningStaffEdit();}
function removeCleaningStaff(i){cleaningStaffList.splice(i,1);openCleaningStaffEdit();}
function saveCleaningStaff(){
  cleaningStaffList=cleaningStaffList.map((_,i)=>{
    const el=document.getElementById(`cleaning-staff-${i}`);
    return el?el.value.trim()||`担当者${i+1}`:`担当者${i+1}`;
  }).filter(Boolean);
  closeM('cleaning-staff-modal');renderCleaning();autoSave();
}
// 旧TODO互換
function renderTodos(){renderStaffNotes();}
function addTodo(){addStaffNote();}


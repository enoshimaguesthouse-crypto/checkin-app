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

function applyServerData(data) {
  if (data.guestData)  {
    // ── チェックイン完了の検知（予約済→チェックイン済への変化）──
    const prevGuestData = guestData || {};
    guestData  = data.guestData;
    // 既存データ互換：status/checkedInAt を補完・正規化
    Object.values(guestData).forEach(g=>{
      if(!g)return;
      g.status = normalizeStatus(g.status);
      if(g.checkedInAt===undefined||g.checkedInAt===null)g.checkedInAt='';
    });
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
  if (data.snTypes && Array.isArray(data.snTypes) && data.snTypes.length > 0) {
    snTypes = data.snTypes;
  }
  if (Array.isArray(data.repeatReminders)) {
    repeatReminders = data.repeatReminders;
    nextReminderId = Math.max(0,...repeatReminders.map(r=>r.id||0))+1;
  }
  if (Array.isArray(data.auditLog)) { auditLog = data.auditLog; } // 監査ログ
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
  renderReg();
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
      if (confirm('⚠ 他の端末が先に保存しています。\n最新データを読み込みますか？\n（現在の編集は破棄されます）')) {
        applyServerData(json.serverData);
        window._lastLoadedGuestCount = guestData ? Object.keys(guestData).length : 0; // 異常検知の基準を更新
        showToast('🔄 最新データを読み込みました');
      } else {
        updateSyncStatus('warn', '未保存（競合）');
        showToast('⚠ 競合中。保存されていません。');
      }
    } else if (json.status === 'ok') {
      cloudUpdatedAt = json.updatedAt;
      isDirty = false;              // 保存成功 → 未保存フラグ解除
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

// ── 30秒ポーリング ────────────────────────────────────────
function startPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  if (!GAS_URL) return;
  pollingTimer = setInterval(() => {
    // 未保存の変更がある間はポーリング取込をスキップ（編集内容がサーバー値で巻き戻るのを防止）
    if (isDirty || isSyncing) { autoCalcTodayOcc(); return; }
    cloudLoad(true); autoCalcTodayOcc();
  }, 30000);
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
function autoSave(){
  if(!GAS_URL)return;
  isDirty=true; // 未保存の変更あり（保存成功でクリア）
  updateSyncStatus('saving','変更あり（自動保存待機中...）');
  clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(async()=>{
    if(isSyncing){
      // 保存中の場合は終了後に再試行
      pendingSave=true;
      return;
    }
    await cloudSave();
  },2000);
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
// 旧TODO互換
function renderTodos(){renderStaffNotes();}
function addTodo(){addStaffNote();}


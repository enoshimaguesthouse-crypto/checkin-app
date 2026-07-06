// ============================================================
// 江ノ島ゲストハウス134 宿泊名簿 データ同期 GAS
// ============================================================
const FILE_NAME        = 'hotel134_data.json';
const RENTAL_FILE_NAME = 'rental_space_data.json';
const FOLDER_NAME      = '江ノ島GH宿泊データ';

// ── ファイル取得・作成ヘルパー ──────────────────────────────
function getFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

// 自動メール添付ファイル用フォルダ（実体はDrive保存・cloudDataにはIDのみ）
const MAIL_ATTACH_FOLDER = 'メール添付ファイル';
function getMailAttachFolder() {
  const parent = getFolder();
  const it = parent.getFoldersByName(MAIL_ATTACH_FOLDER);
  return it.hasNext() ? it.next() : parent.createFolder(MAIL_ATTACH_FOLDER);
}

function getOrCreateFile(fileName, emptyContent) {
  const files = DriveApp.getFilesByName(fileName);
  if (files.hasNext()) return files.next();
  return getFolder().createFile(fileName, JSON.stringify(emptyContent), MimeType.PLAIN_TEXT);
}

function getHotelFile() {
  return getOrCreateFile(FILE_NAME, {
    guestData:{}, cancelList:[], parkData:{}, surfList:[],
    staffNotes:[], salesData:{}, occCumul:{}, cleaningData:{},
    roomSettings:{}, rooms:[], roomPriorityMaster:{}, unassignedReservations:[],
    budgets:{},                                                    // ←追加
    staffNames:[], snTypes:[], priorityCleaningItems:[], priorityCleaningSettings:{},
    propertySettings:{},                                           // ←契約確認設定などタブレット表示設定
    updatedAt: new Date().toISOString(), updatedBy:'init'
  });
}

function getRentalFile() {
  return getOrCreateFile(RENTAL_FILE_NAME, {
    rentalSpaceReservations: [],
    updatedAt: new Date().toISOString(), updatedBy:'init'
  });
}

function jsonOut(str) {
  return ContentService.createTextOutput(str).setMimeType(ContentService.MimeType.JSON);
}

// ── GET ──────────────────────────────────────────────────
//  type=rental   : レンタルスペースファイル
//  type=settings : 設定類のみ（巨大な guestData を含めない軽量レスポンス）
//  type=search   : 予約ID一致レコードのみ（データ量に依存しない検索）
//  それ以外      : 宿泊データ全体
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const type = params.type || 'hotel';

    if (type === 'rental') {
      return jsonOut(getRentalFile().getBlob().getDataAsString());
    }

    // 軽量設定エンドポイント：宿泊者データが何件に増えてもサイズ一定
    if (type === 'settings') {
      const data = JSON.parse(getHotelFile().getBlob().getDataAsString());
      return jsonOut(JSON.stringify({
        propertySettings: data.propertySettings || {},
        roomSettings:     data.roomSettings     || {},
        rooms:            data.rooms            || [],
        updatedAt:        data.updatedAt        || ''
      }));
    }

    // 予約ID検索エンドポイント：一致する予約レコードのみ返す
    if (type === 'search') {
      const id = String(params.id || '').trim();
      const data = JSON.parse(getHotelFile().getBlob().getDataAsString());
      const guestData = data.guestData || {};
      const matches = {};
      if (id) {
        Object.keys(guestData).forEach(k => {
          const g = guestData[k];
          if (!g) return;
          const gid = g.reservationId || g.id;
          if (gid && String(gid).trim() === id) matches[k] = g;
        });
      }
      return jsonOut(JSON.stringify({ guestData: matches, rooms: data.rooms || [] }));
    }

    // デフォルト：宿泊データ全体（ただし重いパスポート画像は除外して軽量化）
    // 画像は type=search（予約編集を開いた時）でのみ取得する。
    const data = JSON.parse(getHotelFile().getBlob().getDataAsString());
    stripPassportImages(data.guestData);
    return jsonOut(JSON.stringify(data));
  } catch(err) {
    return jsonOut(JSON.stringify({ error: err.message }));
  }
}

// guestData内の guests[].passportImage を取り除く（メモリ上のみ・ファイルは変更しない）
function stripPassportImages(guestData) {
  if (!guestData) return;
  Object.keys(guestData).forEach(k => {
    const g = guestData[k];
    if (g && Array.isArray(g.guests)) {
      g.guests.forEach(x => { if (x && x.passportImage) delete x.passportImage; });
    }
  });
}

// 保存時に、payload側で欠落しているpassportImageを既存ファイルの値で補完（画像消失を防止）
function mergePassportImages(incomingGuestData, existingGuestData) {
  if (!incomingGuestData || !existingGuestData) return;
  Object.keys(incomingGuestData).forEach(k => {
    const ig = incomingGuestData[k];
    const eg = existingGuestData[k];
    if (ig && Array.isArray(ig.guests) && eg && Array.isArray(eg.guests)) {
      ig.guests.forEach((guest, i) => {
        if (guest && !guest.passportImage && eg.guests[i] && eg.guests[i].passportImage) {
          guest.passportImage = eg.guests[i].passportImage;
        }
      });
    }
  });
}

// ── POST：payload.type=rental なら rental ファイルに保存 ──────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.type === 'rental') {
      // レンタルスペース専用ファイルに保存
      const file = getRentalFile();
      const newData = {
        rentalSpaceReservations: payload.rentalSpaceReservations || [],
        updatedAt: new Date().toISOString(),
        updatedBy: payload.updatedBy || '不明'
      };
      file.setContent(JSON.stringify(newData));
      return ContentService
        .createTextOutput(JSON.stringify({ status:'ok', type:'rental', updatedAt:newData.updatedAt }))
        .setMimeType(ContentService.MimeType.JSON);

    } else if (payload.type === 'uploadAttachment') {
      // メール添付ファイルをDriveに保存し、cloudDataに格納するファイルID等を返す。
      // 実体はDrive、JSONにはIDのみ（Base64を保存しない設計）。
      const b64 = payload.dataBase64 || '';
      if (!b64) return jsonOut(JSON.stringify({ error: 'no file data' }));
      const name = payload.name || ('attachment_' + Date.now());
      const mime = payload.mimeType || 'application/octet-stream';
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
      const f = getMailAttachFolder().createFile(blob);
      return jsonOut(JSON.stringify({
        status: 'ok', type: 'uploadAttachment',
        id: f.getId(), name: f.getName(),
        url: 'https://drive.google.com/file/d/' + f.getId() + '/view'
      }));

    } else if (payload.type === 'mailPreview') {
      // メールプレビュー：実際に送信する完成データを返す（送信はしない）
      var prevData=_mailLoad_(); var prevGd=prevData.guestData||{};
      var prevResId=String(payload.reservationId||'').trim();
      var prevMailKey=String(payload.mailKey||'');
      var prevGkey=null, prevG=null;
      Object.keys(prevGd).some(function(k){ var r=prevGd[k]; if(r&&!r.cont&&String(r.reservationId||'').trim()===prevResId){prevGkey=k;prevG=r;return true;} return false; });
      if(!prevG) return jsonOut(JSON.stringify({error:'reservation not found'}));
      var prevMs=_msCfg_(prevData); var prevCfg=prevMs[prevMailKey];
      if(!prevCfg) return jsonOut(JSON.stringify({error:'mail type not configured: '+prevMailKey}));
      var prevLang=payload.lang||_mailLang_(prevG);
      var prevCtx=_mailCtx_(prevData, prevGkey, prevG, prevLang);
      // 部屋タイプ×言語のテンプレートを解決（送信時と同じフォールバックチェーン）
      var prevRt=_mailRoomTypeKey_(prevData, _mailRoomId_(prevGkey));
      var prevTpl=_mailResolveTpl_(prevCfg, prevRt, prevLang);
      if(!prevTpl) return jsonOut(JSON.stringify({error:'テンプレートが未設定です（部屋タイプ: '+(prevRt||'不明')+'）。自動メール配信設定で本文を入力してください。'}));
      var prevSubj=_mailRender_(prevTpl.subject, prevCtx);
      var prevBody=_mailRender_(prevTpl.body, prevCtx);
      var prevAttList=(prevTpl.attachments||[]).map(function(a){return{name:a.name||'',id:a.id||''};});
      var prevQrUrl=(prevMailKey==='checkinCode'&&prevCfg.qr)?prevCtx['チェックインURL']:null;
      return jsonOut(JSON.stringify({status:'ok',type:'mailPreview',to:prevG.email||'',lang:prevTpl.lang,roomType:prevRt||'',subject:prevSubj,body:prevBody,attachments:prevAttList,qrUrl:prevQrUrl||null}));

    } else if (payload.type === 'sendMail') {
      // 手動メール送信：1通送信してmailHistoryを保存
      var sndData=_mailLoad_(); var sndGd=sndData.guestData||{};
      var sndResId=String(payload.reservationId||'').trim();
      var sndMailKey=String(payload.mailKey||'');
      var sndGkey=null, sndG=null;
      Object.keys(sndGd).some(function(k){ var r=sndGd[k]; if(r&&!r.cont&&String(r.reservationId||'').trim()===sndResId){sndGkey=k;sndG=r;return true;} return false; });
      if(!sndG) return jsonOut(JSON.stringify({error:'reservation not found'}));
      if(!(sndG.email||'').trim()) return jsonOut(JSON.stringify({error:'no email address'}));
      var sndMs=_msCfg_(sndData); var sndCfg=sndMs[sndMailKey];
      if(!sndCfg) return jsonOut(JSON.stringify({error:'mail type not configured: '+sndMailKey}));
      var sndOpts={}; if(payload.lang)sndOpts.lang=payload.lang;
      var sndResult=_mailSendOne_(sndData, sndMailKey, sndG, sndGkey, sndMailKey, sndCfg, sndOpts);
      if(!sndResult||!sndResult.sent) return jsonOut(JSON.stringify({error:'send failed',detail:JSON.stringify(sndResult)}));
      var sndNow=new Date().toISOString();
      sndG.mailHistory=sndG.mailHistory||{}; sndG.mailHistory[sndMailKey]=sndNow;
      _mailSave_(sndData);
      return jsonOut(JSON.stringify({status:'ok',type:'sendMail',to:sndResult.to,sentAt:sndNow}));

    } else if (payload.type === 'checkinUpdate') {
      // ── チェックイン確定の「部分更新」：予約ID一致レコードだけをサーバー側で更新 ──
      // 全DBのダウンロード/再アップロードを回避し、クライアントは差分＋写真のみ送信。
      const file = getHotelFile();
      const data = JSON.parse(file.getBlob().getDataAsString());
      const guestData = data.guestData || {};
      const targetId = String(payload.reservationId || '').trim();
      if (!targetId) {
        return jsonOut(JSON.stringify({ error: 'checkinUpdate: no reservationId' }));
      }
      const status   = payload.status || 'checked_in';
      const nowIso   = payload.checkedInAt || new Date().toISOString();
      const agreement = payload.agreement || null;
      const contact   = payload.contact || {};
      const finalGuests = Array.isArray(payload.guests) ? payload.guests : [];
      // 連泊の画像重複を避けるため、画像付きはアンカー1件のみ。他は画像なし。
      const finalGuestsLight = finalGuests.map(function(g){
        var c = {}; for (var kk in g) { if (kk !== 'passportImage') c[kk] = g[kk]; } return c;
      });
      const keyDateNum = function(k){ var p=String(k).split(':'); return (parseInt(p[0])||0)*100 + (parseInt(p[2])||0); };
      const matchingKeys = Object.keys(guestData).filter(function(k){
        var g=guestData[k]; var gid=g&&(g.reservationId||g.id); return gid && String(gid).trim()===targetId;
      }).sort(function(a,b){ return keyDateNum(a)-keyDateNum(b); });
      const anchorKey = matchingKeys[0];
      var updated = 0;
      matchingKeys.forEach(function(k){
        var g = guestData[k]; if(!g) return;
        g.status = status;
        g.checkedInAt = nowIso;
        if (agreement && agreement.accepted) {
          g.agreementAccepted = true;
          g.agreementAcceptedAt = agreement.acceptedAt || '';
          g.agreementLanguage = agreement.language || '';
          g.agreementMethod = agreement.method || '';
          if (agreement.method === 'signature' && agreement.signature) g.agreementSignature = agreement.signature;
        }
        if (contact.email) g.email = contact.email;
        if (contact.phone) g.phone = contact.phone;
        if (finalGuests.length) {
          g.guests = (k === anchorKey) ? finalGuests : finalGuestsLight;
        }
        updated++;
      });
      data.updatedAt = new Date().toISOString();
      data.updatedBy = payload.updatedBy || 'checkin-app';
      file.setContent(JSON.stringify(data));
      return jsonOut(JSON.stringify({ status:'ok', type:'checkinUpdate', updated: updated }));

    } else {
      // 宿泊データファイルに保存（rentalSpaceReservations は含めない）
      // 防御ガード：guestData が未指定のPOSTでは絶対に全体を空で上書きしない（誤爆・データ消失防止）。
      if (payload.guestData === undefined || payload.guestData === null) {
        return jsonOut(JSON.stringify({ error: 'guestData missing; save skipped to prevent data loss' }));
      }
      const file = getHotelFile();
      // 既存ファイルのpassportImageを保持：起動時GETで画像を除外しているため、
      // クライアントが画像なしで保存しても既存の画像が消えないようマージする。
      const incomingGuestData = payload.guestData || {};
      try {
        const existing = JSON.parse(file.getBlob().getDataAsString());
        mergePassportImages(incomingGuestData, existing.guestData || {});
      } catch(mergeErr) { /* 既存読込失敗時はそのまま保存 */ }
      const newData = {
  guestData:   incomingGuestData   || {},
  cancelList:  payload.cancelList  || [],
  parkData:    payload.parkData    || {},
  surfList:    payload.surfList    || [],
  staffNotes:  payload.staffNotes  || [],
  salesData:   payload.salesData   || {},
  occCumul:    payload.occCumul    || {},
  cleaningData:payload.cleaningData|| {},
  roomSettings:        payload.roomSettings        || {},
  rooms:               payload.rooms               || [],
  roomPriorityMaster:  payload.roomPriorityMaster  || {},
  unassignedReservations: payload.unassignedReservations || [],
  budgets:             payload.budgets             || {},   // ←追加
  staffNames:              payload.staffNames              || [],
  snTypes:                 payload.snTypes                 || [],
  priorityCleaningItems:   payload.priorityCleaningItems   || [],
  priorityCleaningSettings:payload.priorityCleaningSettings|| {},
  propertySettings:        payload.propertySettings        || {},   // ←契約確認設定などタブレット表示設定
  updatedAt:   new Date().toISOString(),
  updatedBy:   payload.updatedBy   || '不明'
};
      file.setContent(JSON.stringify(newData));
      return ContentService
        .createTextOutput(JSON.stringify({ status:'ok', updatedAt:newData.updatedAt }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
//  自動メール送信（第2段階）  ※実ゲストへの誤送信を防ぐ安全設計
//   - 既定では自動送信は無効（Script Property MAIL_AUTOSEND='on' で有効化）
//   - 有効化前に primeMailFlags() で既存予約を「送信済み」にして過去分の一斉送信を防止
//   - sendTestMailToSelf() で自分宛にプレビュー送信可能
//   - 1回の実行あたり MAIL_SEND_CAP 通までに制限（暴走防止）
// ============================================================
const MAIL_KEYS = ['reservationCreated','checkinCode','checkin','checkout'];
const MAIL_SEND_CAP = 40;

function _mailOwner_(){ try { return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail(); } catch(e){ return Session.getEffectiveUser().getEmail(); } }
function _mailLoad_(){ return JSON.parse(getHotelFile().getBlob().getDataAsString()); }
function _mailSave_(data){ getHotelFile().setContent(JSON.stringify(data)); }
function _msCfg_(data){ return ((data.propertySettings||{}).mailSettings)||{}; }

// 言語判定：宿泊者名が日本語（ひらがな/カタカナ/漢字）を含めば日本語、それ以外は英語
function _mailLang_(g){
  var name=String((g&&g.name)||'');
  return /[぀-ヿ㐀-䶿一-鿿豈-﫿]/.test(name) ? 'ja' : 'en';
}
function _roomLangKey_(lang){ return lang==='zh'?'zh-CN':lang; }
function _roomNo_(data,roomId){ var r=(data.rooms||[]).filter(function(x){return String(x.id)===String(roomId);})[0]; return r?(r.no||String(roomId)):String(roomId); }
function _roomType_(data,roomId){ var r=(data.rooms||[]).filter(function(x){return String(x.id)===String(roomId);})[0]; return r?(r.type||''):''; }
function _roomLangObj_(data,roomId,lang){ var rs=(data.roomSettings||{})[roomId]; if(!rs)return {}; var L=rs.languages||{}; return L[_roomLangKey_(lang)]||L.ja||{}; }
function _keycode_(data,roomId){ var rs=(data.roomSettings||{})[roomId]; return rs?(rs.keycode||''):''; }

// ── 部屋タイプ別メールテンプレート ──────────────────────────
// guestDataキー "m:roomId:d" / "y:m:roomId:d" 両形式からroomIdを取り出す
function _mailRoomId_(key){
  var p=String(key).split(':');
  return p.length===4 ? p[2] : p[1];
}
// rooms[].group → メールテンプレートの部屋タイプキー（PMS側 MAIL_ROOM_TYPES と対応）
var MAIL_ROOM_TYPE_GROUPS_ = {
  '本館−個室':'honkan_private',
  '本館−男女混合ドミトリー':'honkan_dormitory',
  'ANNEX−個室':'annex_private',
  'ANNEX−ドミトリー':'annex_dormitory',
  'アパートメント−Southern Court':'apartment',
  'Sea Breeze 鎌倉':'sb_kamakura',
  'Sea Breeze 三浦':'sb_miura'
};
function _mailRoomTypeKey_(data, roomId){
  var r=(data.rooms||[]).filter(function(x){return String(x.id)===String(roomId);})[0];
  if(!r)return null;
  if(MAIL_ROOM_TYPE_GROUPS_[r.group])return MAIL_ROOM_TYPE_GROUPS_[r.group];
  // グループ名の表記ゆれに備えた部分一致フォールバック
  var g=String(r.group||'');
  if(g.indexOf('Sea Breeze')===0)return g.indexOf('三浦')>=0?'sb_miura':'sb_kamakura';
  if(g.indexOf('アパートメント')===0)return 'apartment';
  if(g.indexOf('ANNEX')===0)return g.indexOf('個室')>=0?'annex_private':'annex_dormitory';
  if(g.indexOf('本館')===0)return g.indexOf('個室')>=0?'honkan_private':'honkan_dormitory';
  return null;
}
// テンプレート解決：部屋タイプ×言語 → 同部屋タイプの日本語 → 旧構造（言語→日本語）の順でフォールバック。
// 本文が全て空なら null（＝送信スキップ）。件名・本文・添付は同じ言語ソースから一貫して取得する。
function _mailResolveTpl_(cfg, rtKey, lang){
  var cands=[];
  var rt=(cfg.roomTypes && rtKey) ? cfg.roomTypes[rtKey] : null;
  if(rt){ cands.push({src:rt,l:lang}); if(lang!=='ja')cands.push({src:rt,l:'ja'}); }
  cands.push({src:cfg,l:lang}); if(lang!=='ja')cands.push({src:cfg,l:'ja'});
  for(var i=0;i<cands.length;i++){
    var s=cands[i].src, l=cands[i].l;
    var body=(s.body&&s.body[l])||'';
    if(String(body).trim()){
      return {
        subject:(s.subject&&(s.subject[l]||s.subject.ja))||'',
        body:body,
        attachments:(s.attachments&&s.attachments[l])||[],
        lang:l
      };
    }
  }
  return null;
}

// キー "m:roomId:d"（年なし）→ 今日に最も近い年で Date を構築
function _keyToDate_(key){
  var p=String(key).split(':'); var m=parseInt(p[0]), d=parseInt(p[2]);
  if(isNaN(m)||isNaN(d))return null;
  var now=new Date(); var y=now.getFullYear();
  var dt=new Date(y,m-1,d);
  var diff=(dt-now)/(1000*60*60*24);
  if(diff<-45)dt=new Date(y+1,m-1,d); else if(diff>320)dt=new Date(y-1,m-1,d);
  return dt;
}
function _fmtDate_(dt){ if(!dt)return ''; var p=function(n){return String(n).padStart(2,'0');}; return dt.getFullYear()+'-'+p(dt.getMonth()+1)+'-'+p(dt.getDate()); }
function _dayStart_(dt){ return new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()).getTime(); }

// アンカー（予約開始）レコードから泊数を数えてチェックアウト日を算出
function _checkoutDate_(guestData, key, g){
  var p=String(key).split(':'); var m=parseInt(p[0]), roomId=p[1], d=parseInt(p[2]);
  var nights=1;
  while(true){
    var nk=m+':'+roomId+':'+(d+nights);
    var ng=guestData[nk];
    if(!ng)break;
    if(ng.charter&&ng.charterAnchor)break;
    if(!ng.cont&&!ng.charter)break;
    nights++;
    if(nights>60)break;
  }
  var ci=_keyToDate_(key); if(!ci)return null;
  return new Date(ci.getFullYear(),ci.getMonth(),ci.getDate()+nights);
}

// 差し込みキーワード置換
function _mailRender_(text, ctx){
  if(!text)return '';
  return String(text).replace(/\[([^\]]+)\]/g, function(_,kw){ return (ctx[kw]!==undefined&&ctx[kw]!==null)?String(ctx[kw]):('['+kw+']'); });
}
function _mailCtx_(data, key, g, lang){
  var roomId=String(key).split(':')[1];
  var ci=_keyToDate_(key), co=_checkoutDate_(data.guestData||{}, key, g);
  var Lo=_roomLangObj_(data,roomId,lang);
  var rs=(data.roomSettings||{})[roomId]||{};   // 部屋設定（施設情報・備考など建物単位の情報）
  var url=g.checkinUrl || (g.reservationId? ('https://enoshimaguesthouse-crypto.github.io/checkin-app/checkin-app.html?reservationId='+encodeURIComponent(g.reservationId)) : '');
  return {
    // 氏名・予約IDが正式名称。代表者名・予約番号は旧テンプレート互換のため同値を残す
    '氏名': g.name||'',
    '代表者名': g.name||'',
    '予約ID': g.reservationId||'',
    '予約番号': g.reservationId||'',
    '部屋タイプ名': _roomType_(data,roomId),
    '部屋番号': _roomNo_(data,roomId),
    // 玄関暗証番号（=keycode）：既存の[鍵番号][チェックインコード]と同一値で後方互換を維持
    '鍵番号': _keycode_(data,roomId),
    'チェックインコード': _keycode_(data,roomId),
    '玄関暗証番号': _keycode_(data,roomId),
    '部屋暗証番号': rs.roomCode||'',
    '施設名': rs.facilityName||'',
    '物件名': Lo.roomName||'',
    '電話番号': rs.phone||'',
    '住所': rs.address||'',
    'WiFiSSID': rs.wifiSsid||'',
    'WiFiパスワード': rs.wifiPass||'',
    'チェックイン案内URL': rs.checkinGuideUrl||'',
    '入室案内': Lo.guideText||'',
    '備考1': rs.note1||'',
    '備考2': rs.note2||'',
    '備考3': rs.note3||'',
    'チェックインURL': url,
    'チェックイン日': _fmtDate_(ci),
    'チェックアウト日': _fmtDate_(co)
  };
}

// 添付（Drive ID→Blob）。失敗は黙ってスキップ。
function _mailAttachBlobs_(list){
  var out=[];
  (list||[]).forEach(function(a){ try{ if(a&&a.id)out.push(DriveApp.getFileById(a.id).getBlob()); }catch(e){} });
  return out;
}
// チェックインURLのQR画像Blob（外部API・生成ロジックは変更なし）
function _mailQrBlob_(url){
  try{ if(!url)return null;
    var resp=UrlFetchApp.fetch('https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data='+encodeURIComponent(url));
    return resp.getBlob().setName('checkin_qr.png');
  }catch(e){ return null; }
}

// ── チェックインコード送信メール：QR・予約IDをファーストビューに配置するHTMLカード ──
// ラベルの多言語対応（mailSettingsの言語キー ja/en/zh/ko に対応）
var MAIL_QR_CARD_LABELS_ = {
  ja: { qr:'チェックインQRコード', id:'予約ID', property:'物件名', address:'住所', pin:'玄関：暗証番号' },
  en: { qr:'Check-in QR Code',   id:'Check-in Code', property:'Property', address:'Address', pin:'Entrance PIN / 玄関暗証番号' },
  zh: { qr:'入住二维码',          id:'入住代码', property:'物件名称', address:'地址', pin:'门禁密码 / 玄関暗証番号' },
  ko: { qr:'체크인 QR 코드',      id:'체크인 코드', property:'물건명', address:'주소', pin:'현관 비밀번호 / 玄関暗証番号' }
};
function _escapeHtml_(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// 既存のプレーンテキスト本文はそのまま、改行のみ<br>に変換して続ける（本文内容・変数は変更しない）
function _plainToHtml_(text){
  return _escapeHtml_(text).replace(/\r\n|\r|\n/g,'<br>');
}
// 物件情報カード（②）：白背景・薄グレー枠線・角丸10px・中央寄せ・max-width400px
function _mailPropertyCardHtml_(L, propertyName, address){
  return ''
    +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td align="center">'
        +'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:90%;max-width:400px;background-color:#FFFFFF;border:1px solid #D9D9D9;border-radius:10px;">'
          +'<tr><td align="center" style="padding:18px 20px;">'
            +'<div style="font-size:11px;color:#8a8a8a;font-family:Arial,Helvetica,sans-serif;margin-bottom:4px;">'+_escapeHtml_(L.property)+'</div>'
            +'<div style="font-size:16px;font-weight:700;color:#1a5276;font-family:Arial,Helvetica,sans-serif;margin-bottom:12px;">'+_escapeHtml_(propertyName)+'</div>'
            +'<div style="font-size:11px;color:#8a8a8a;font-family:Arial,Helvetica,sans-serif;margin-bottom:4px;">'+_escapeHtml_(L.address)+'</div>'
            +'<div style="font-size:14px;color:#2c3e50;font-family:Arial,Helvetica,sans-serif;">'+_escapeHtml_(address)+'</div>'
          +'</td></tr>'
        +'</table>'
      +'</td>'
    +'</tr></table>';
}
// 玄関暗証番号カード（③）：薄灰背景(#F7F7F7)・薄グレー枠線・角丸10px・中央寄せ・数字を大きく強調
function _mailPinCardHtml_(L, pin){
  return ''
    +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td align="center">'
        +'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:90%;max-width:400px;background-color:#F7F7F7;border:1px solid #D9D9D9;border-radius:10px;">'
          +'<tr><td align="center" style="padding:16px 20px;">'
            +'<div style="font-size:12px;color:#5a5a5a;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">'+_escapeHtml_(L.pin)+'</div>'
            +'<div style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#1a5276;font-family:Arial,Helvetica,sans-serif;">'+_escapeHtml_(pin)+'</div>'
          +'</td></tr>'
        +'</table>'
      +'</td>'
    +'</tr></table>';
}
// カード間の余白（marginではなく高さを持つ空行で確実にスペースを作る：Gmail/Outlook対応）
function _mailSpacerHtml_(px){
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="'+px+'" style="height:'+px+'px;line-height:'+px+'px;font-size:0;">&nbsp;</td></tr></table>';
}
// QR＋予約IDカード＋物件情報カード＋玄関暗証番号カード＋既存本文を1通のHTMLメールとして組み立てる。
// テーブルレイアウト＋インラインCSSのみ使用（Gmail/Yahoo/Outlook/Apple Mail対応）。
// QR画像はcid参照（inlineImagesでGmailApp.sendEmailに渡す）。
// 配色：PMS本体と同じ「湘南ビーチハウス」トーン（--ocean #1a5276 / --ocean-light #d6eaf8 / --sand #fdfaf5）。
function _mailQrCardHtml_(cid, resId, lang, bodyPlain, propertyName, address, pin){
  var L = MAIL_QR_CARD_LABELS_[lang] || MAIL_QR_CARD_LABELS_.ja;
  var bodyHtml = _plainToHtml_(bodyPlain);
  return ''
    // 全体背景：CSSグラデーションは使わず、行ごとのbgcolor属性で「海→波打ち際→砂浜」を表現
    // （bgcolor属性はOutlook/Gmail/Yahoo/Apple Mailすべてで確実に効くため、gradientより安全）
    +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">'
    // 深海カラーのヘッダーバー（施設名、白文字）
    +'<tr><td align="center" bgcolor="#1a5276" style="background-color:#1a5276;padding:22px 12px;">'
      +'<div style="font-size:20px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;letter-spacing:1px;">'
        +'江ノ島ゲストハウス134'
      +'</div>'
    +'</td></tr>'
    // 海泡カラーの帯：QR・予約IDカードを中央配置
    +'<tr><td align="center" bgcolor="#d6eaf8" style="background-color:#d6eaf8;padding:24px 12px;">'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;background-color:#ffffff;border:1px solid #BFE1F2;border-radius:12px;">'
        +'<tr><td style="background-color:#45b39d;height:6px;line-height:6px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>'
        +'<tr><td align="center" style="padding:24px;">'
          // QRコード：親tdに強制白背景（ダークモードでの反転・視認性低下を防止）
          +'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>'
            +'<td align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:0 0 16px 0;">'
              +'<img src="cid:'+cid+'" width="260" alt="QR" style="display:block;width:70%;max-width:260px;height:auto;background-color:#ffffff;border:0;">'
            +'</td>'
          +'</tr></table>'
          +'<div style="font-size:13px;color:#2c3e50;font-family:Arial,Helvetica,sans-serif;margin-bottom:20px;">'+_escapeHtml_(L.qr)+'</div>'
          // 予約ID：海泡色（ocean-light）背景＋枠線で強調
          +'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>'
            +'<td align="center" bgcolor="#d6eaf8" style="background-color:#d6eaf8;border:1px solid #9CCDEA;border-radius:8px;padding:14px 10px;">'
              +'<div style="font-size:12px;color:#1a5276;font-family:Arial,Helvetica,sans-serif;margin-bottom:4px;">'+_escapeHtml_(L.id)+'</div>'
              +'<div style="font-size:34px;font-weight:700;letter-spacing:4px;color:#1a5276;font-family:Arial,Helvetica,sans-serif;">'+_escapeHtml_(resId)+'</div>'
            +'</td>'
          +'</tr></table>'
        +'</td></tr>'
      +'</table>'
      +_mailSpacerHtml_(18)
      // ② 物件情報カード（物件名・住所）
      +_mailPropertyCardHtml_(L, propertyName, address)
      +_mailSpacerHtml_(15)
      // ③ 玄関暗証番号カード
      +_mailPinCardHtml_(L, pin)
    +'</td></tr>'
    +'<tr><td align="center" style="padding:0 12px 4px;background-color:#fdfaf5;">'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">'
        +'<tr><td style="font-size:14px;line-height:1.7;color:#2c3e50;font-family:Arial,Helvetica,sans-serif;text-align:left;padding-top:20px;">'+bodyHtml+'</td></tr>'
      +'</table>'
    +'</td></tr>'
    +'<tr><td align="center" style="background-color:#fdfaf5;padding:8px 12px 20px;">'
      +'<div style="font-size:11px;color:#7f8c8d;font-family:Arial,Helvetica,sans-serif;">Enoshima Guesthouse 134</div>'
    +'</td></tr>'
    +'</table>';
}

// 1通組み立て＆送信（toが空なら送らない）
function _mailSendOne_(data, key, g, gkey, mailKey, cfg, opts){
  opts=opts||{};
  var lang=opts.lang || _mailLang_(g);  // opts.lang で言語上書き可能
  var to=opts.forceTo || (g.email||'').trim();
  if(!to)return {skipped:'no-email'};
  var ctx=_mailCtx_(data, gkey, g, lang);
  // 部屋タイプ×言語のテンプレートを解決（空ならフォールバック、全て空なら送信スキップ）
  var rtKey=_mailRoomTypeKey_(data, _mailRoomId_(gkey));
  var tpl=_mailResolveTpl_(cfg, rtKey, lang);
  if(!tpl)return {skipped:'no-template', roomType:rtKey||'unknown'};
  var subject=_mailRender_(tpl.subject, ctx);
  var body=_mailRender_(tpl.body, ctx);
  var atts=_mailAttachBlobs_(tpl.attachments);
  // チェックインコード送信メールのみ：QRをcidインライン画像にしてQR＋予約IDのカードをファーストビューに配置
  var htmlBody=null, inlineImages=null;
  if(mailKey==='checkinCode' && cfg.qr){
    var qb=_mailQrBlob_(ctx['チェックインURL']);
    if(qb){
      var cid='qr_code_'+(g.reservationId||gkey);
      inlineImages={}; inlineImages[cid]=qb;
      htmlBody=_mailQrCardHtml_(cid, ctx['予約番号']||g.reservationId||'', lang, body,
        ctx['施設名']||'', ctx['住所']||'', ctx['玄関暗証番号']||'');
    }
    // QR取得失敗時はhtmlBody=nullのままプレーンテキストのみ送信（既存のフォールバック挙動を維持）
  }
  if(opts.dryRun)return {to:to,subject:subject,bodyLen:body.length,attachments:atts.length,lang:lang,htmlBody:!!htmlBody};
  var mailOptions={ attachments:atts, name:'江ノ島ゲストハウス134' };
  if(htmlBody){ mailOptions.htmlBody=htmlBody; mailOptions.inlineImages=inlineImages; }
  GmailApp.sendEmail(to, subject||'(no subject)', body, mailOptions);
  return {sent:true,to:to};
}

// 既存予約を「送信済み」として記録（過去分の一斉送信を防止）。有効化の直前に1回実行。
function primeMailFlags(){
  var data=_mailLoad_(); var gd=data.guestData||{}; var n=0; var stamp='primed:'+new Date().toISOString();
  Object.keys(gd).forEach(function(k){
    var g=gd[k]; if(!g||g.cont)return; if(g.charter&&!g.charterAnchor)return;
    g.mailSent=g.mailSent||{}; MAIL_KEYS.forEach(function(mk){ if(!g.mailSent[mk])g.mailSent[mk]=stamp; }); n++;
  });
  _mailSave_(data);
  PropertiesService.getScriptProperties().setProperty('MAIL_PRIMED','yes'); // 安全ロック解除
  return '既存予約 '+n+' 件に送信済みフラグを付与しました（安全ロック解除。今後の新規・期日到来分のみ送信されます）';
}

// ── テスト用ラッパー（GASエディタの「実行」から選んで実行。引数不要）──
function test_checkinCodeMail(){ var r=sendTestMailToSelf('checkinCode'); Logger.log(r); return r; }
function test_reservationCreatedMail(){ var r=sendTestMailToSelf('reservationCreated'); Logger.log(r); return r; }
function test_checkinMail(){ var r=sendTestMailToSelf('checkin'); Logger.log(r); return r; }
function test_checkoutMail(){ var r=sendTestMailToSelf('checkout'); Logger.log(r); return r; }

// 自分宛テスト送信：各メール種別を所有者アドレスへ（実ゲストには送らない）
function sendTestMailToSelf(mailKey, lang){
  var data=_mailLoad_(); var ms=_msCfg_(data); var cfg=ms[mailKey];
  if(!cfg)return 'メール種別が見つかりません: '+mailKey;
  var gd=data.guestData||{};
  // emailを持つ実予約を1件サンプルに（無ければダミー）
  var sample=null, skey=null;
  Object.keys(gd).some(function(k){ var g=gd[k]; if(g&&!g.cont&&(g.email||g.reservationId)){ sample=g; skey=k; return true; } return false; });
  if(!sample){ sample={name:'テスト 太郎',reservationId:'00000',email:_mailOwner_(),nat:'日本'}; skey=(new Date().getMonth()+1)+':0:1'; gd[skey]=sample; }
  var res=_mailSendOne_(data, mailKey, sample, skey, mailKey, cfg, {forceTo:_mailOwner_()});
  return 'テスト送信: '+mailKey+' → '+_mailOwner_()+' / '+JSON.stringify(res);
}

// 診断：なぜ送られないかを調べる（GASエディタから実行し、実行ログ/戻り値を確認）
function diagnoseMail(){
  var L=[];
  var props=PropertiesService.getScriptProperties();
  L.push('MAIL_AUTOSEND = '+(props.getProperty('MAIL_AUTOSEND')||'(未設定=送信されません)'));
  L.push('MAIL_PRIMED = '+(props.getProperty('MAIL_PRIMED')||'(未=primeMailFlags未実行のため送信ロック中)'));
  var trigs=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='runAutoMails';});
  L.push('runAutoMails トリガー = '+trigs.length+' 件'+(trigs.length?'':'（未設置）'));
  L.push('送信元(所有者) = '+_mailOwner_());
  var data=_mailLoad_(); var ms=_msCfg_(data); var gd=data.guestData||{};
  if(!ms||!Object.keys(ms).length)L.push('⚠ mailSettings がありません（物件情報＞自動メール配信設定で保存してください）');
  MAIL_KEYS.forEach(function(mk){
    var c=ms[mk]||{};
    var subj=(c.subject&&(c.subject.ja||c.subject.en))||'';
    var body=(c.body&&(c.body.ja||c.body.en))||'';
    // 部屋タイプ別テンプレートも本文有無の判定対象にする
    var rtWithBody=0, rtTotal=0;
    if(c.roomTypes){ Object.keys(c.roomTypes).forEach(function(rk){ rtTotal++; var t=c.roomTypes[rk]; if(t&&t.body&&String(t.body.ja||t.body.en||'').trim())rtWithBody++; }); }
    L.push('['+mk+'] enabled='+(!!c.enabled)+' / 件名あり='+(!!subj)+' / 本文あり='+(!!body)+(rtTotal?(' / 部屋タイプ別本文 '+rtWithBody+'/'+rtTotal):''));
  });
  var now=new Date(), todayMs=_dayStart_(now);
  var anchors=0, withEmail=0, future=0, sentRC=0, dueRC=0, sampleNoEmail=[];
  Object.keys(gd).forEach(function(k){
    var g=gd[k]; if(!g||g.cont)return; if(g.charter&&!g.charterAnchor)return;
    anchors++;
    var hasEmail=!!(g.email||'').trim(); if(hasEmail)withEmail++;
    var ci=_keyToDate_(k); var fut=ci&&_dayStart_(ci)>=todayMs; if(fut)future++;
    if(g.mailSent&&g.mailSent.reservationCreated)sentRC++;
    if(ms.reservationCreated&&ms.reservationCreated.enabled&&hasEmail&&!(g.mailSent&&g.mailSent.reservationCreated)&&fut)dueRC++;
    if(!hasEmail&&fut&&sampleNoEmail.length<3)sampleNoEmail.push((g.name||'?')+'/ID'+(g.reservationId||'-'));
  });
  L.push('予約(アンカー)総数='+anchors+' / メールアドレス有='+withEmail+' / 未来チェックイン='+future);
  L.push('reservationCreated 既送信フラグ='+sentRC+' / いま送信対象になり得る='+dueRC);
  if(sampleNoEmail.length)L.push('※メール無しの未来予約例: '+sampleNoEmail.join(', '));
  var out=L.join('\n'); Logger.log(out); return out;
}

// 手動で今すぐ自動送信を1回実行（MAIL_AUTOSEND=on のときのみ送信）
function runAutoMailsNow(){ var n=runAutoMails(); Logger.log('runAutoMailsNow: '+n+' 通'); return n; }

// 実際に送信された予約の一覧（mailSentがISO日時=実送信。primed:は除外）。お詫び対応用。
function listSentMails(){
  var data=_mailLoad_(); var gd=data.guestData||{};
  var rows=[];
  Object.keys(gd).forEach(function(k){
    var g=gd[k]; if(!g||!g.mailSent)return;
    MAIL_KEYS.forEach(function(mk){
      var v=g.mailSent[mk];
      // ISO日時で始まるものだけが実送信（'primed:'や'skip:'は対象外）
      if(v && /^\d{4}-\d{2}-\d{2}T/.test(String(v))){
        rows.push({ sentAt:v, type:mk, name:g.name||'', reservationId:g.reservationId||'', email:g.email||'', lang:_mailLang_(g) });
      }
    });
  });
  rows.sort(function(a,b){ return a.sentAt<b.sentAt?-1:1; });
  // 読みやすいテキストも作る
  var lines=['送信日時\t種別\t代表者名\t予約ID\tメール\t言語'];
  rows.forEach(function(r){ lines.push(r.sentAt+'\t'+r.type+'\t'+r.name+'\t'+r.reservationId+'\t'+r.email+'\t'+r.lang); });
  var text=lines.join('\n');
  Logger.log('実送信 '+rows.length+' 件\n'+text);
  return text; // タブ区切り（コピペでスプレッドシート貼付可）
}

// Gmailの「送信済み」から実際に送られたメールを一覧化（mailSentフラグが消えても確実）。
// 直近2日の送信済みを対象に、送信日時・宛先・件名を出力。
function listSentFromGmail(){
  var owner=_mailOwner_();
  var threads=GmailApp.search('in:sent newer_than:2d', 0, 300);
  var rows=[];
  threads.forEach(function(th){
    th.getMessages().forEach(function(m){
      var from=String(m.getFrom()||'');
      if(from.indexOf(owner)<0)return; // 自分が送ったメッセージのみ
      rows.push({ when:Utilities.formatDate(m.getDate(),'Asia/Tokyo','yyyy-MM-dd HH:mm'), to:m.getTo()||'', subject:m.getSubject()||'' });
    });
  });
  rows.sort(function(a,b){ return a.when<b.when?-1:1; });
  var lines=['送信日時\t宛先\t件名'];
  rows.forEach(function(r){ lines.push(r.when+'\t'+r.to+'\t'+r.subject); });
  var text=lines.join('\n');
  Logger.log('送信済み '+rows.length+' 件（直近2日）\n'+text);
  return text;
}

// Gmail送信済みをスプレッドシートに書き出してURLを返す
function exportSentFromGmailToSheet(){
  var owner=_mailOwner_();
  var threads=GmailApp.search('in:sent newer_than:2d', 0, 300);
  var rows=[['送信日時','宛先','件名']];
  threads.forEach(function(th){
    th.getMessages().forEach(function(m){
      if(String(m.getFrom()||'').indexOf(owner)<0)return;
      rows.push([Utilities.formatDate(m.getDate(),'Asia/Tokyo','yyyy-MM-dd HH:mm'), m.getTo()||'', m.getSubject()||'']);
    });
  });
  var ss=SpreadsheetApp.create('Gmail送信済み一覧 '+new Date().toISOString().slice(0,16));
  ss.getActiveSheet().getRange(1,1,rows.length,3).setValues(rows);
  Logger.log('送信済み '+(rows.length-1)+' 件 → '+ss.getUrl());
  return ss.getUrl();
}

// 実送信一覧をスプレッドシートに書き出してURLを返す（任意・確認しやすい）
function exportSentMailsToSheet(){
  var data=_mailLoad_(); var gd=data.guestData||{};
  var rows=[['送信日時','種別','代表者名','予約ID','メール','言語']];
  Object.keys(gd).forEach(function(k){
    var g=gd[k]; if(!g||!g.mailSent)return;
    MAIL_KEYS.forEach(function(mk){
      var v=g.mailSent[mk];
      if(v && /^\d{4}-\d{2}-\d{2}T/.test(String(v))) rows.push([v,mk,g.name||'',g.reservationId||'',g.email||'',_mailLang_(g)]);
    });
  });
  var ss=SpreadsheetApp.create('自動メール 実送信一覧 '+new Date().toISOString().slice(0,16));
  var sh=ss.getActiveSheet(); sh.getRange(1,1,rows.length,6).setValues(rows);
  var url=ss.getUrl();
  Logger.log('実送信 '+(rows.length-1)+' 件 → '+url);
  return url;
}

// トリガー本体：自動送信（現在は手動再開指示があるまで完全停止）
function runAutoMails(){
  // ★ 自動送信を完全停止。再開時はこの return 0 を削除し、primeMailFlags()→autosend_ON()→installMailTrigger() の順で実施。
  Logger.log('runAutoMails: 自動送信は停止中です（手動再開まで無効）');
  return 0;
  /* eslint-disable no-unreachable */
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('MAIL_AUTOSEND')!=='on'){ Logger.log('runAutoMails: 無効（MAIL_AUTOSEND≠on）'); return; }
  if(props.getProperty('MAIL_PRIMED')!=='yes'){ Logger.log('runAutoMails: 中止（先に primeMailFlags() を実行してください）'); return 0; }
  var data=_mailLoad_(); var ms=_msCfg_(data); var gd=data.guestData||{};
  var now=new Date(); var todayMs=_dayStart_(now); var nowMin=now.getHours()*60+now.getMinutes();
  var sent=0;
  var keys=Object.keys(gd);
  for(var i=0;i<keys.length;i++){
    if(sent>=MAIL_SEND_CAP)break;
    var k=keys[i], g=gd[k];
    if(!g||g.cont)continue; if(g.charter&&!g.charterAnchor)continue;
    if(!(g.email||'').trim())continue;
    g.mailSent=g.mailSent||{};
    var ci=_keyToDate_(k); var ciMs=ci?_dayStart_(ci):null;
    for(var t=0;t<MAIL_KEYS.length;t++){
      if(sent>=MAIL_SEND_CAP)break;
      var mk=MAIL_KEYS[t]; var cfg=ms[mk];
      if(!cfg||!cfg.enabled)continue;
      if(g.mailSent[mk])continue;
      var due=false;
      if(mk==='reservationCreated'){ if(ciMs!==null && ciMs>=todayMs)due=true; }
      else if(mk==='checkinCode'){
        if(ciMs!==null){ var daysUntil=Math.round((ciMs-todayMs)/86400000);
          var st=(cfg.sendTime||'09:00').split(':'); var stMin=(parseInt(st[0])||0)*60+(parseInt(st[1])||0);
          if(daysUntil===(parseInt(cfg.sendDaysBefore)||3) && nowMin>=stMin)due=true; }
      }
      else if(mk==='checkin'){ if(g.status==='checked_in'||g.status==='checkedin')due=true; }
      else if(mk==='checkout'){ var co=_checkoutDate_(gd,k,g); if(co&&_dayStart_(co)===todayMs)due=true; }
      if(!due)continue;
      try{
        var r=_mailSendOne_(data, mk, g, k, mk, cfg, {});
        if(r&&r.sent){ g.mailSent[mk]=new Date().toISOString(); sent++; }
        // テンプレート未設定は恒久スキップにしない（後からテンプレートを設定すれば次回送信される）
        else if(!(r&&r.skipped==='no-template')){ g.mailSent[mk]='skip:'+(r&&r.skipped||'?'); }
      }catch(e){ Logger.log('send error '+mk+' '+k+': '+e); }
    }
  }
  if(sent>0)_mailSave_(data);
  Logger.log('runAutoMails: 送信 '+sent+' 通');
  return sent;
}

// 有効化/無効化と定期トリガー設置（GASエディタから手動実行）
function setAutosend(on){ PropertiesService.getScriptProperties().setProperty('MAIL_AUTOSEND', on?'on':'off'); return 'MAIL_AUTOSEND='+(on?'on':'off'); }
// 引数なしラッパー（GASエディタの「実行」用）
function autosend_ON(){ var r=setAutosend(true); Logger.log(r); return r; }
function autosend_OFF(){ var r=setAutosend(false); Logger.log(r); return r; }
function installMailTrigger(){
  removeMailTrigger();
  ScriptApp.newTrigger('runAutoMails').timeBased().everyMinutes(30).create();
  return '30分間隔の自動送信トリガーを設置しました';
}
function removeMailTrigger(){
  var n=0; ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='runAutoMails'){ ScriptApp.deleteTrigger(t); n++; } });
  return '既存トリガー '+n+' 件を削除しました';
}
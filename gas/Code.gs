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

} else {
      // 宿泊データファイルに保存（rentalSpaceReservations は含めない）
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
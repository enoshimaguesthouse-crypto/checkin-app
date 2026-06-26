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

    // デフォルト：宿泊データ全体
    return jsonOut(getHotelFile().getBlob().getDataAsString());
  } catch(err) {
    return jsonOut(JSON.stringify({ error: err.message }));
  }
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
      const newData = {
  guestData:   payload.guestData   || {},
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
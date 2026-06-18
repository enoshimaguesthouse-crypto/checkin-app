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
    updatedAt: new Date().toISOString(), updatedBy:'init'
  });
}

function getRentalFile() {
  return getOrCreateFile(RENTAL_FILE_NAME, {
    rentalSpaceReservations: [],
    updatedAt: new Date().toISOString(), updatedBy:'init'
  });
}

// ── GET：type=rental なら rental ファイル、それ以外は宿泊データ ──
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const type = params.type || 'hotel';
    const file = type === 'rental' ? getRentalFile() : getHotelFile();
    return ContentService
      .createTextOutput(file.getBlob().getDataAsString())
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
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
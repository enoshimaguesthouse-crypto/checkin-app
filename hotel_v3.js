// ============================================================
// CONSTANTS
// ============================================================
const DOW=['日','月','火','水','木','金','土'];
const NOW=new Date(); // 現在時刻（グローバル）

// 予約サイト アイコン定義 {bg, text}
const SITE_ICONS={
  'Booking.com':  {bg:'#003580',t:'Bo'},
  'Expedia':      {bg:'#fbcc33',t:'Ex',tc:'#1a1a1a'},
  '楽天':         {bg:'#1a7a3e',t:'楽'},
  '楽天トラベル': {bg:'#1a7a3e',t:'楽'},
  'Rakuten Oyado':{bg:'#1a7a3e',t:'RO'},
  'じゃらん':     {bg:'#e65100',t:'じ'},
  'じゃらんnet':  {bg:'#e65100',t:'じ'},
  'agoda':        {bg:'#5392f9',t:'Ag'},
  'Agoda':        {bg:'#5392f9',t:'Ag'},
  'HafH':         {bg:'#23b5b5',t:'Ha'},
  'Hostelworld':  {bg:'#f26522',t:'Hw'},
  'Airbnb':       {bg:'#e02b44',t:'Ab'},
  'Trip.com':     {bg:'#1b6ac9',t:'Tr'},
  'skyticket':    {bg:'#00a0e9',t:'SC'},
  '一休.com':     {bg:'#00bcd4',t:'休'},
  'HP':           {bg:'#185FA5',t:'HP'},
  '直接':         {bg:'#555',   t:'直'},
  'Stripe':       {bg:'#635bff',t:'St'},
};
// HTMLエスケープ（XSS対策）：ユーザー入力・CSV・外部予約データ由来の文字列をinnerHTMLに入れる前に必ず通す
function esc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function siteIcon(site){
  const s=SITE_ICONS[site];
  if(!s)return `<span class="site-icon" style="background:#aaa;">${esc((site||'?').slice(0,2))}</span>`;
  return `<span class="site-icon" style="background:${s.bg};color:${s.tc||'#fff'};">${s.t}</span>`;
}

// 祝日（2026・2027年）。名称は HOLIDAY_NAMES を参照、判定は HOLIDAYS_2026（互換名。中身は複数年）を参照。
const HOLIDAY_NAMES={
  '2026-01-01':'元日','2026-01-12':'成人の日','2026-02-11':'建国記念日','2026-02-23':'天皇誕生日','2026-03-20':'春分の日','2026-04-29':'昭和の日','2026-05-03':'憲法記念日','2026-05-04':'みどりの日','2026-05-05':'こどもの日','2026-05-06':'振替休日','2026-07-20':'海の日','2026-08-11':'山の日','2026-09-21':'敬老の日','2026-09-22':'国民の休日','2026-09-23':'秋分の日','2026-10-12':'スポーツの日','2026-11-03':'文化の日','2026-11-23':'勤労感謝の日',
  '2027-01-01':'元日','2027-01-11':'成人の日','2027-02-11':'建国記念日','2027-02-23':'天皇誕生日','2027-03-21':'春分の日','2027-03-22':'振替休日','2027-04-29':'昭和の日','2027-05-03':'憲法記念日','2027-05-04':'みどりの日','2027-05-05':'こどもの日','2027-07-19':'海の日','2027-08-11':'山の日','2027-09-20':'敬老の日','2027-09-23':'秋分の日','2027-10-11':'スポーツの日','2027-11-03':'文化の日','2027-11-23':'勤労感謝の日'
};
const HOLIDAYS_2026=new Set(Object.keys(HOLIDAY_NAMES));

// 国籍リスト
const NATIONALITIES=['日本','中国','韓国','台湾','香港','アメリカ','カナダ','イギリス','フランス','ドイツ','イタリア','スペイン','オランダ','ベルギー','スイス','スウェーデン','ノルウェー','デンマーク','フィンランド','オーストラリア','ニュージーランド','シンガポール','タイ','ベトナム','インドネシア','マレーシア','フィリピン','インド','ブラジル','メキシコ','アルゼンチン','その他'];

// 住所1文字列から国籍を推定する関数
function natFromAddress(addr){
  if(!addr||!addr.trim())return '';
  const a=addr.trim();

  // 日本の都道府県で始まる場合
  const PREFS=['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
    '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
    '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
    '熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  if(a.startsWith('日本')||/^Japan/i.test(a)||PREFS.some(p=>a.startsWith(p)))return '日本';

  // 海外：日本語国名
  const JA_MAP={
    '中国':'中国','台湾':'台湾','韓国':'韓国','香港':'香港',
    'アメリカ':'アメリカ','アメリカ合衆国':'アメリカ','米国':'アメリカ',
    'カナダ':'カナダ','イギリス':'イギリス','英国':'イギリス',
    'フランス':'フランス','ドイツ':'ドイツ','イタリア':'イタリア',
    'スペイン':'スペイン','オランダ':'オランダ','ベルギー':'ベルギー',
    'スイス':'スイス','スウェーデン':'スウェーデン','ノルウェー':'ノルウェー',
    'デンマーク':'デンマーク','フィンランド':'フィンランド',
    'オーストラリア':'オーストラリア','ニュージーランド':'ニュージーランド',
    'シンガポール':'シンガポール','タイ':'タイ','ベトナム':'ベトナム',
    'インドネシア':'インドネシア','マレーシア':'マレーシア',
    'フィリピン':'フィリピン','インド':'インド',
    'ブラジル':'ブラジル','メキシコ':'メキシコ','アルゼンチン':'アルゼンチン',
  };
  for(const [k,v] of Object.entries(JA_MAP)){if(a.startsWith(k))return v;}

  // 海外：英語国名
  const EN_MAP={
    'China':'中国','Taiwan':'台湾','Korea':'韓国','Hong Kong':'香港',
    'USA':'アメリカ','United States':'アメリカ','America':'アメリカ',
    'Canada':'カナダ','UK':'イギリス','United Kingdom':'イギリス','England':'イギリス',
    'France':'フランス','Germany':'ドイツ','Italy':'イタリア','Spain':'スペイン',
    'Netherlands':'オランダ','Belgium':'ベルギー','Switzerland':'スイス',
    'Sweden':'スウェーデン','Norway':'ノルウェー','Denmark':'デンマーク','Finland':'フィンランド',
    'Australia':'オーストラリア','New Zealand':'ニュージーランド',
    'Singapore':'シンガポール','Thailand':'タイ','Vietnam':'ベトナム',
    'Indonesia':'インドネシア','Malaysia':'マレーシア','Philippines':'フィリピン','India':'インド',
    'Brazil':'ブラジル','Mexico':'メキシコ','Argentina':'アルゼンチン',
  };
  for(const [k,v] of Object.entries(EN_MAP)){
    if(a.toLowerCase().startsWith(k.toLowerCase()))return v;
  }

  return ''; // 判定不能 → ブランク
}
const NAT_CODE={
  '日本':'jp','中国':'cn','韓国':'kr','台湾':'tw','香港':'hk',
  'アメリカ':'us','カナダ':'ca','イギリス':'gb','フランス':'fr','ドイツ':'de',
  'イタリア':'it','スペイン':'es','オランダ':'nl','ベルギー':'be','スイス':'ch',
  'スウェーデン':'se','ノルウェー':'no','デンマーク':'dk','フィンランド':'fi',
  'オーストラリア':'au','ニュージーランド':'nz',
  'シンガポール':'sg','タイ':'th','ベトナム':'vn','インドネシア':'id',
  'マレーシア':'my','フィリピン':'ph','インド':'in',
  'ブラジル':'br','メキシコ':'mx','アルゼンチン':'ar',
};
function natFlag(nat){
  const code=NAT_CODE[nat];
  if(code)return `<span class="fi fi-${code}" title="${esc(nat)}" style="font-size:14px;border-radius:2px;flex-shrink:0;"></span>`;
  return nat?`<span style="font-size:9px;color:#666;">${esc(nat)}</span>`:'';
}

// ── 商品プラン名称・備考キーワードルールテーブル ──
// checkboxId: モーダルのチェックボックスID（nullなら備考判定のみ）
// noteTag: 備考に追記するタグ文字列
// autoAction: 'park'=駐車場, 'surf'=サーフィン, null=なし
const PLAN_RULES=[
  {keyword:'えのすぱ', icon:'♨',  noteTag:'えのすぱ',           checkboxId:'f-enospa', autoAction:null, cellBorder:'#9370DB', cellBg:'#f5f0ff'},
  {keyword:'えのすい', icon:'🐬', noteTag:'えのすい',           checkboxId:'f-enosui', autoAction:null, cellBorder:'#7B1FA2', cellBg:'#F3E5F5'},
  {keyword:'和食',     icon:'🍙', noteTag:'和食',               checkboxId:'f-wshoku', autoAction:null, cellBorder:'#FF8F00', cellBg:'#FFF8E1'},
  {keyword:'洋食',     icon:'🍳', noteTag:'洋食',               checkboxId:'f-yshoku', autoAction:null, cellBorder:'#FF5722', cellBg:'#FFF3EF'},
  {keyword:'レイトチェックアウト', icon:'🌙', noteTag:'レイトチェックアウト', checkboxId:'f-late',   autoAction:null, cellBorder:'#1A237E', cellBg:'#E8EAF6'},
  {keyword:'サーフィン', icon:'🏄', noteTag:'サーフィン',        checkboxId:'f-surf',   autoAction:'surf', cellBorder:'#E65100', cellBg:'#FFF3E0'},
];

// 月別・合計宿泊者数（各月のXX日時点の累計宿泊者数）— 実データ投入
// 2026年（画像1より）: 各日の累計人数
const occCumul={
  2017:{
    1:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    2:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    3:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    4:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    5:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    6:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    7:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    8:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    9:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    10:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    11:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    12:[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  },
  2018:{
    1:[118,123,120,121,127,135,138,138,138,139,150,153,154,154,156,160,163,168,169,172,172,182,186,192,192,197,204,204,206,208,211],
    2:[122,130,135,140,145,156,196,201,202,191,199,199,204,207,208,214,213,212,213,221,223,226,236,238,238,238,239,240,null,null,null],
    3:[201,212,220,226,227,225,233,235,229,236,256,274,275,280,281,282,283,286,289,289,292,299,303,305,311,314,315,315,319,321,321],
    4:[123,132,140,140,146,156,166,166,173,191,193,198,200,207,218,226,228,232,241,242,259,258,266,266,271,271,271,273,278,280,null],
    5:[143,144,146,148,152,155,158,163,167,171,171,182,182,193,206,206,208,209,216,222,224,234,241,242,243,242,244,246,250,250,251],
    6:[163,170,177,177,177,184,189,193,208,208,212,225,228,232,236,239,246,246,250,259,259,280,283,285,285,285,286,287,291,291,null],
    7:[192,204,232,240,240,252,256,288,292,302,311,314,323,321,327,337,339,338,338,341,341,344,344,347,356,364,362,364,366,364,368],
    8:[345,360,365,381,408,418,424,432,441,445,440,442,459,457,462,465,467,476,484,490,492,497,491,497,499,510,515,515,523,522,522],
    9:[250,264,268,283,290,297,309,313,309,315,324,323,328,338,336,343,347,351,351,359,364,365,365,369,371,377,380,381,381,379,null],
    10:[179,178,166,166,176,177,195,195,202,210,220,225,221,216,223,225,229,233,240,239,245,245,247,247,252,256,256,259,262,263,265],
    11:[157,162,162,176,191,191,188,197,199,200,204,210,218,218,224,232,235,236,239,243,247,252,259,259,261,262,265,269,270,273,null],
    12:[170,181,191,195,206,216,233,241,249,261,263,262,263,266,267,275,282,282,286,293,294,293,305,311,316,322,324,328,331,332,332],
  },
  2019:{
    1:[136,137,138,138,144,148,152,162,168,179,181,180,185,187,196,199,205,209,218,220,229,231,231,234,238,238,238,238,241,245,244],
    2:[176,182,192,195,204,213,222,227,229,234,238,242,253,254,257,266,268,268,277,279,286,291,293,293,296,296,297,295,null,null,null],
    3:[184,192,221,221,232,232,233,238,241,245,248,250,261,264,268,273,281,288,294,294,297,314,315,316,322,331,337,339,345,347,352],
    4:[155,161,162,166,174,175,176,182,189,200,199,208,213,217,219,230,233,237,242,245,250,251,251,255,255,257,256,257,258,258,null],
    5:[176,174,179,182,184,187,187,205,212,211,217,217,219,220,225,236,240,249,251,256,255,256,259,265,272,272,276,279,280,284,284],
    6:[178,179,179,189,188,192,196,204,205,208,218,234,247,249,254,255,255,266,279,290,301,302,310,314,322,329,334,340,341,344,null],
    7:[241,255,241,228,235,247,255,269,273,276,269,269,277,274,274,277,276,288,294,294,298,310,314,321,334,335,335,337,345,352,353],
    8:[495,528,528,544,561,562,565,567,579,582,583,583,583,568,598,598,598,638,645,655,666,677,688,690,691,700,705,710,715,722,721],
    9:[117,120,133,144,154,164,177,182,197,210,229,259,275,299,319,330,344,348,348,353,354,357,359,362,368,371,376,378,379,381,null],
    10:[247,252,257,265,273,281,287,293,278,262,257,251,249,253,266,271,277,286,287,287,304,304,305,311,316,329,329,335,335,336,null],
    11:[151,165,189,205,206,212,217,221,223,226,243,245,253,253,258,262,264,264,264,270,273,277,288,289,286,288,292,293,296,297,null],
    12:[151,156,160,159,161,185,190,199,199,223,224,234,235,240,244,245,250,250,258,261,263,264,271,271,272,281,287,291,307,307,307],
  },
  2020:{
    1:[160,160,171,181,181,181,183,198,198,205,210,210,215,217,237,241,243,246,249,256,260,259,261,264,264,263,268,268,285,301,302],
    2:[168,176,195,210,213,209,204,221,223,222,206,206,217,229,233,240,244,247,262,263,270,271,269,270,270,270,369,273,275,null,null],
    3:[139,146,159,161,163,209,234,235,241,265,265,272,272,288,348,372,386,386,381,395,372,375,393,395,397,387,398,398,397,null,null],
    4:[20,20,25,27,25,27,27,27,27,28,29,29,37,37,37,52,60,62,62,74,74,74,81,80,79,82,82,83,83,83,null],
    5:[38,41,42,43,43,44,44,50,50,50,50,58,62,63,67,67,69,69,69,69,62,62,70,70,74,90,96,101,107,109,111],
    6:[34,80,84,84,96,96,111,123,128,134,135,141,156,168,176,185,192,198,198,206,206,217,219,228,230,230,236,238,239,240,null],
    7:[115,118,161,160,179,200,211,211,218,220,224,226,234,236,237,244,246,243,248,243,252,250,255,256,258,263,264,265,267,267,267],
    8:[126,148,152,172,203,208,215,226,226,286,297,328,347,365,370,377,409,418,418,419,429,430,431,438,442,444,450,454,458,472,474],
    9:[153,189,203,236,240,244,249,257,276,277,279,284,285,291,314,326,349,350,349,354,354,355,359,382,399,399,402,403,404,406,null],
    10:[29,37,44,49,50,54,56,54,56,76,82,95,117,122,130,135,136,138,146,152,152,161,212,182,190,192,197,198,222,226,234],
    11:[61,61,68,72,72,83,98,114,119,129,134,138,167,169,168,187,191,200,218,225,227,231,235,240,240,239,239,242,245,247,null],
    12:[95,117,105,108,118,110,112,127,132,145,157,176,177,180,180,178,167,169,165,168,184,189,196,197,208,204,217,221,null,null,228],
  },
  2021:{
    1:[29,31,37,37,36,36,38,54,56,65,66,68,72,82,78,78,79,82,84,86,88,92,97,97,111,111,113,114,115,117,117],
    2:[32,35,47,47,51,59,67,77,77,77,86,100,108,114,114,123,123,140,148,171,176,176,181,181,184,185,190,192,192,null,null],
    3:[107,115,128,144,159,166,180,192,210,219,226,229,244,244,247,249,248,273,277,314,334,350,365,378,379,381,385,386,386,389,394],
    4:[56,61,73,76,79,100,102,103,106,114,120,124,128,128,138,147,160,164,165,170,173,181,179,185,194,195,201,201,198,198,null],
    5:[122,134,134,136,138,134,160,162,165,167,169,168,168,189,190,190,207,216,216,224,226,241,242,243,255,265,267,270,270,271,271],
    6:[274,276,81,81,88,93,101,104,106,114,129,139,139,140,140,141,143,146,156,162,166,166,172,172,172,173,179,180,null,null,null],
    7:[475,475,476,476,480,480,480,480,483,487,483,483,484,484,488,489,520,520,532,549,549,550,550,550,552,553,558,562,562,569,569],
    8:[213,237,242,252,261,265,272,272,270,299,299,322,319,318,321,330,335,335,340,344,340,343,355,363,377,380,385,389,391,395,395],
    9:[67,74,75,79,99,100,114,117,123,126,139,147,149,170,172,175,177,179,183,199,205,211,221,225,230,235,235,240,244,246,null],
    10:[58,101,103,107,111,118,124,125,126,130,139,153,156,172,172,180,180,180,201,215,217,219,224,225,227,244,246,248,249,252,252],
    11:[66,91,91,105,115,115,114,121,128,136,138,144,154,156,165,165,165,176,185,193,206,207,213,215,216,216,218,232,232,233,null],
    12:[50,59,66,71,74,81,86,86,87,91,94,94,105,108,109,113,117,120,124,130,135,139,144,147,149,150,151,163,163,163,160],
  },
  2022:{
    1:[46,50,54,55,54,55,70,72,75,72,73,75,74,75,75,80,82,82,88,90,92,96,97,100,116,118,120,123,126,127,null],
    2:[83,85,86,85,87,89,89,95,101,103,103,106,110,114,116,121,127,130,135,137,148,152,152,153,158,162,162,163,null,null,null],
    3:[131,150,162,179,206,212,234,242,253,260,273,286,297,315,319,328,340,345,354,361,359,365,375,376,386,387,386,382,387,389,391],
    4:[105,112,113,120,126,126,131,136,148,157,157,170,174,179,190,205,210,208,213,214,219,221,226,229,232,235,238,246,259,259,null],
    5:[141,156,159,162,162,164,172,176,179,187,187,187,196,225,230,236,239,239,243,250,267,267,273,278,281,286,288,303,304,305,306],
    6:[83,86,100,105,110,110,109,111,121,123,123,153,156,165,185,194,195,197,197,201,205,211,212,219,223,235,236,240,242,244,null],
    7:[202,217,225,226,230,234,240,247,250,257,252,267,271,273,273,275,276,284,293,302,315,325,333,346,352,357,368,376,384,384,385],
    8:[320,327,353,359,376,383,378,382,390,395,405,410,410,415,416,427,447,453,454,454,459,465,476,482,490,492,495,500,501,504,521],
    9:[153,162,175,184,191,197,207,210,214,223,227,233,235,241,251,251,254,259,262,259,289,289,290,290,294,295,294,294,296,297,null],
    10:[118,117,121,124,128,128,141,142,149,152,154,159,162,171,174,174,180,197,198,197,199,200,201,210,211,218,235,237,239,243,245],
    11:[132,146,155,165,186,190,195,203,223,235,239,243,243,260,268,273,272,272,288,318,324,328,328,334,228,339,339,340,341,342,null],
    12:[158,167,183,185,188,200,221,221,230,236,235,242,242,250,248,250,263,277,281,287,297,300,308,307,307,313,315,318,320,326,326],
  },
  2023:{
    1:[78,83,85,89,105,111,111,120,126,142,142,144,151,164,199,202,209,215,218,222,222,219,218,223,226,232,242,244,244,251,252],
    2:[136,148,157,165,173,182,194,198,212,222,234,248,244,250,252,255,263,267,272,281,290,299,302,308,306,310,312,312,null,null,null],
    3:[339,361,373,384,385,385,401,409,420,432,436,440,444,451,458,460,469,474,474,475,476,483,486,493,503,504,512,518,522,527,530],
    4:[140,152,168,175,181,191,214,221,226,228,231,239,247,254,254,263,270,277,281,287,287,294,294,304,310,312,312,322,324,325,null],
    5:[192,200,207,207,216,218,221,240,247,256,261,262,266,268,287,297,310,315,328,341,362,369,377,383,388,390,392,400,403,406,409],
    6:[181,185,188,198,207,221,230,247,251,266,280,290,291,307,318,333,341,358,364,371,375,380,381,384,389,393,403,411,416,420,null],
    7:[218,225,235,239,249,262,274,287,287,301,304,307,319,340,346,363,368,378,392,402,405,408,415,422,428,433,437,439,447,449,455],
    8:[331,364,359,369,375,384,390,391,398,397,407,410,422,425,434,440,448,463,468,488,497,500,509,515,527,534,543,551,559,565,566],
    9:[340,341,348,355,371,373,373,374,380,382,388,391,391,398,407,405,410,421,429,449,452,452,457,459,474,481,489,492,493,493,null],
    10:[179,184,190,190,194,202,210,204,208,219,228,242,266,269,270,275,284,285,287,287,290,303,306,310,310,327,328,330,331,335,337],
    11:[165,169,182,190,193,198,199,203,212,222,227,227,240,248,248,255,261,263,264,268,268,268,293,293,295,298,298,305,308,309,null],
    12:[175,175,192,192,209,209,230,234,255,256,265,266,276,276,286,292,295,297,297,303,303,306,305,308,309,312,312,313,315,313,313],
  },
  2024:{
    1:[73,78,92,92,95,100,103,110,114,119,119,120,130,133,139,141,149,166,171,175,172,177,188,192,191,191,196,197,197,199,202],
    2:[119,129,141,143,160,160,170,177,193,194,204,220,222,231,240,252,261,270,283,283,287,304,314,322,330,329,331,335,337,null,null],
    3:[304,308,308,328,340,362,370,376,390,397,409,409,415,415,420,423,431,431,445,455,470,481,486,490,497,508,517,518,518,518,523],
    4:[191,202,210,218,224,228,244,262,271,284,295,303,327,344,344,352,365,376,385,402,402,413,417,423,429,438,440,449,452,453,null],
    5:[216,230,241,243,262,272,274,293,306,316,321,335,344,367,387,393,396,400,414,427,448,448,453,456,464,470,475,479,482,485,486],
    6:[191,189,198,208,222,230,230,241,251,258,273,286,296,302,309,319,324,330,346,352,368,368,375,382,386,398,403,413,414,419,null],
    7:[245,269,278,286,301,310,325,325,329,335,340,350,350,367,379,389,396,399,410,418,428,436,443,449,461,466,465,471,481,484,487],
    8:[341,351,356,367,384,396,412,427,429,434,435,442,442,445,446,447,448,462,465,478,496,502,504,505,509,518,522,527,532,534,null],
    9:[179,187,200,211,245,253,274,284,300,311,315,333,342,350,350,362,366,384,390,392,392,396,402,403,405,410,412,414,416,419,null],
    10:[205,209,2223,242,250,261,285,305,317,337,340,341,382,382,382,397,412,412,418,424,427,442,463,469,472,478,489,489,496,491,492],
    11:[218,227,233,251,259,270,278,286,305,312,327,345,354,361,369,373,375,383,388,392,399,413,415,420,428,429,431,431,432,434,null],
    12:[201,222,226,231,237,240,245,249,251,260,266,268,285,288,290,294,295,302,320,320,326,327,329,333,335,336,338,341,349,354,354],
  },
  2025:{
    1: [122,124,127,133,133,137,137,139,142,149,149,151,151,161,165,168,177,185,192,194,196,204,206,216,216,221,221,222,223,225,225],
    2: [168,174,183,193,201,204,214,222,228,240,242,245,248,250,269,272,275,276,280,284,288,292,299,302,307,309,315,317,null,null,null],
    3: [270,280,278,287,294,311,302,310,317,329,339,349,368,389,400,413,431,437,459,455,459,463,468,486,499,500,500,500,501,503,null],
    4: [238,254,255,267,289,314,329,345,365,376,380,393,406,410,429,441,451,462,478,482,494,498,505,505,513,524,528,532,534,541,null],
    5: [249,245,246,251,259,262,277,296,305,316,332,342,350,368,384,392,393,394,402,411,419,422,428,431,440,440,443,446,449,454,455],
    6: [202,230,246,255,269,270,274,275,287,296,304,319,331,340,353,365,373,394,396,404,409,422,434,443,449,454,461,464,468,473,null],
    7: [321,334,356,374,386,396,400,413,415,419,423,429,437,452,455,458,497,487,486,494,494,611,522,531,535,535,543,539,545,543,542],
    8: [358,365,378,389,405,411,420,425,428,432,440,444,452,455,463,465,480,487,498,499,508,511,516,522,528,541,552,558,570,572,576],
    9: [220,238,245,273,286,292,304,313,324,336,344,356,356,358,368,372,384,393,399,401,407,414,419,423,429,439,447,449,451,453,null],
    10:[261,290,295,292,311,316,322,312,313,319,324,300,307,325,337,341,348,358,372,387,392,400,408,419,419,420,423,429,430,437,439],
    11:[201,205,215,218,230,260,270,279,295,300,304,318,335,340,352,357,363,371,374,379,384,389,394,395,404,408,417,423,426,426,null],
    12:[158,163,171,170,177,203,211,219,231,232,233,238,239,239,243,247,254,264,269,271,275,287,290,299,310,318,323,325,328,329,329],
  },
  2026:{
    1: [null,92,93,104,113,122,127,133,146,151,155,156,161,171,180,188,192,196,201,206,206,213,220,223,232,235,239,239,239,240,245],
    2: [199,214,221,219,235,244,266,269,271,271,278,287,287,301,307,313,318,318,330,338,339,339,333,338,339,340,343,347,null,null,null],
    3: [307,314,322,322,340,350,354,356,370,370,395,395,399,411,425,431,440,449,425,455,463,461,468,476,476,479,482,482,499,501,496],
    4: [190,202,212,223,233,250,264,267,277,287,292,301,307,315,324,338,353,359,370,379,386,392,403,413,419,431,437,446,446,449,null],
    5: [235,237,245,272,288,294,317,330,333,338,347,369,372,372,378,392,396,403,435,440,446,443,456,462,466,474,485,493,495,497,498],
    6: [151,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  },

};

// 各月末の累計最大値（稼働率100%の基準）
const occMaxCumul={
  2025:{1:225,2:317,3:503,4:541,5:455,6:473,7:611,8:576,9:453,10:439,11:426,12:329},
  2026:{1:245,2:347,3:496,4:449,5:498},
};
// 旧来のmonthlyTotal（推計データ）も残す
const occMonthlyTotal={
  2017:[null,null,null,null,null,null,null,null,null,null,null,null],
  2018:[211,240,321,280,251,291,368,522,379,265,273,332],
  2019:[244,295,352,258,284,344,353,721,381,336,297,307],
  2020:[302,275,397,83,111,240,267,474,406,234,247,228],
  2021:[117,192,394,198,271,180,569,395,246,252,233,160],
  2022:[127,163,391,259,306,244,385,521,297,245,342,326],
  2023:[252,312,530,325,409,420,455,566,493,337,309,313],
  2024:[202,337,523,453,486,419,487,534,419,492,434,354],
  2025:[225,317,503,541,455,473,611,576,453,439,426,329],
  2026:[245,347,496,449,396,null,null,null,null,null,null,null],
};

const CAP=22;

// 売上データ（円）- 画像2より
const salesData={
  2016:{1:null,2:null,3:null,4:null,5:null,6:null,7:null,8:null,9:414078,10:684553,11:1009781,12:null,total:2108412},
  2017:{1:561765,2:575947,3:1367436,4:1074762,5:1159261,6:1174786,7:1791544,8:2388895,9:1492241,10:1094261,11:783378,12:1050148,total:14514424},
  2018:{1:787965,2:815750,3:1338272,4:1053407,5:1049023,6:1154300,7:1728917,8:3277845,9:2234996,10:1445255,11:1459733,12:1753540,total:18099003},
  2019:{1:1221279,2:1319802,3:2023096,4:1616857,5:1820620,6:1708118,7:2189006,8:5259668,9:2336791,10:1740281,11:1939201,12:2075116,total:25249835},
  2020:{1:1566615,2:1565236,3:2144397,4:507930,5:563455,6:1130741,7:2094081,8:3429959,9:2358758,10:1335255,11:1450006,12:1308376,total:19454809},
  2021:{1:602973,2:865638,3:1987273,4:992670,5:1436879,6:1002548,7:6754629,8:2855425,9:1361809,10:1186484,11:1154734,12:1167024,total:21368086},
  2022:{1:686523,2:916827,3:2436363,4:1830450,5:1995639,6:1397421,7:2852490,8:5436908,9:2299353,10:1674180,11:2339270,12:2807359,total:26672783},
  2023:{1:1603991,2:1978579,3:3619540,4:2251172,5:2919281,6:2559059,7:3637172,8:5497791,9:3609929,10:2246740,11:2147016,12:1978440,total:34048710},
  2024:{1:1118159,2:1936182,3:3457674,4:2752799,5:3009986,6:2539696,7:3774777,8:5707231,9:2737113,10:2832206,11:2725433,12:2447901,total:35039157},
  2025:{1:1397119,2:1831164,3:3636210,4:3305281,5:3229813,6:2943503,7:4158383,8:5725284,9:3077267,10:2654784,11:2608753,12:2214583,total:36782144},
  2026:{1:1235654,2:1900768,3:null,4:null,5:null,6:null,7:null,8:null,9:null,10:null,11:null,12:null,total:null},
};

// ============================================================
// STATE
// ============================================================
let sbOpen=false;
let rooms=[
  // 本館−個室（ダブル・ツイン）
  {id:0, no:1, type:'本館−ダブル', group:'本館−個室', cap:2, color:'#185FA5', label:'①ダブル'},
  {id:1, no:2, type:'本館−ツイン', group:'本館−個室', cap:2, color:'#185FA5', label:'②ツイン'},
  // 本館−男女混合ドミトリー（G H I J K L M N O P の10部屋）
  {id:2, no:3, type:'本館−男女混合ドミトリー G', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:3, no:4, type:'本館−男女混合ドミトリー H', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:4, no:5, type:'本館−男女混合ドミトリー I', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:5, no:6, type:'本館−男女混合ドミトリー J', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:6, no:7, type:'本館−男女混合ドミトリー K', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:7, no:8, type:'本館−男女混合ドミトリー L', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:8, no:9, type:'本館−男女混合ドミトリー M', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:9, no:10,type:'本館−男女混合ドミトリー N', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:10,no:11,type:'本館−男女混合ドミトリー O', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:11,no:12,type:'本館−男女混合ドミトリー P', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  // ANNEX−個室（①②の2部屋）
  {id:12,no:13,type:'ANNEX−個室①',           group:'ANNEX−個室',       cap:4, color:'#993556'},
  {id:13,no:14,type:'ANNEX−個室②',           group:'ANNEX−個室',       cap:4, color:'#993556'},
  // ANNEX−ドミトリー（A B C D E F の6部屋）
  {id:14,no:15,type:'ANNEX−ドミトリー A',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:15,no:16,type:'ANNEX−ドミトリー B',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:16,no:17,type:'ANNEX−ドミトリー C',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:17,no:18,type:'ANNEX−ドミトリー D',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:18,no:19,type:'ANNEX−ドミトリー E',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:19,no:20,type:'ANNEX−ドミトリー F',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  // アパートメント−Southern Court（103・104の2部屋）
  {id:20,no:21,type:'アパートメント−Southern Court 103', group:'アパートメント−Southern Court', cap:4, color:'#534AB7'},
  {id:21,no:22,type:'アパートメント−Southern Court 104', group:'アパートメント−Southern Court', cap:4, color:'#534AB7'},
  // Sea Breeze 鎌倉・三浦
  {id:22,no:23,type:'Sea Breeze 鎌倉 101', group:'Sea Breeze 鎌倉', cap:4, color:'#0e7490'},
  {id:23,no:24,type:'Sea Breeze 鎌倉 102', group:'Sea Breeze 鎌倉', cap:4, color:'#0e7490'},
  {id:24,no:25,type:'Sea Breeze 三浦',     group:'Sea Breeze 三浦', cap:4, color:'#0f766e'},
];
let nextRoomId=25;
let guestData={};
// 表示中の年（複数年対応）。renderRegでsel-yearから更新。gk/addDaysの既定年。
let DISP_YEAR=2026;
let editKey=null,editRoomId=null,editCancelIdx=null,editSurfIdx=null,dragSrc=null;
let staffNotes=[],nextSnId=0,snFilter='all';

// ── 集計対象フィルタ ──
// groupKeyはrooms配列のgroupと一致させる
const FILTER_GROUPS=[
  {key:'本館−個室',                    label:'本館個室'},
  {key:'本館−男女混合ドミトリー',        label:'男女混合ドミトリー'},
  {key:'ANNEX−個室',                    label:'ANNEX個室'},
  {key:'ANNEX−ドミトリー',              label:'ANNEXドミトリー'},
  {key:'アパートメント−Southern Court', label:'アパートメント'},
  {key:'Sea Breeze 鎌倉',              label:'Sea Breeze 鎌倉'},
  {key:'Sea Breeze 三浦',              label:'Sea Breeze 三浦'},
];
// 選択状態（groupKey → true/false）初期値は全ON
let roomFilter=Object.fromEntries(FILTER_GROUPS.map(g=>[g.key,true]));
let cancelList=[];
let surfList=[];
let unassignedReservations=[]; // 自動割当に失敗した未割当予約キュー
let parkData={};
let rentalSpaceReservations=[];
let rentalYear=2026,rentalMonth=new Date().getMonth()+1;
let nextRentalId=1;
// 物件設定（タブレット表示設定など）。cloudData に集約して全端末同期。
// 自動メール配信設定のデフォルト生成（添付実体はDrive保存しIDのみ保持）
function _defaultMailCfg(extra){
  return Object.assign({
    enabled:false,
    subject:{ja:'',en:'',zh:'',ko:''},
    body:{ja:'',en:'',zh:'',ko:''},
    attachments:{ja:[],en:[],zh:[],ko:[]}  // 各要素は {id,name}
  }, extra||{});
}
let propertySettings={
  contractAgreement:{enabled:false,consentType:'checkbox',texts:{ja:'',en:'',zh:'',ko:''}},
  mailSettings:{
    reservationCreated:_defaultMailCfg(),
    checkinCode:_defaultMailCfg({qr:false, sendDaysBefore:3, sendTime:'09:00', resend:false}),
    checkin:_defaultMailCfg(),
    checkout:_defaultMailCfg()
  }
};
let editRentalId=null;
let parkYear=2026,parkMonth=new Date().getMonth()+1; // 現在月で初期化
let nextParkId=0;
let editParkDate=null,editParkEntryId=null;
let occCharts=[];
// 月別予算（円）
let budgets={1:1800000,2:1800000,3:2000000,4:2200000,5:2500000,6:2500000,7:3000000,8:3000000,9:2500000,10:2200000,11:1800000,12:1800000};

// ============================================================
// UTILS
// ============================================================
// 月跨ぎ・年跨ぎに対応した日付計算。基準年yは既定でDISP_YEAR。年も返す。
function addDays(m,d,n,y){
  y=(y==null?DISP_YEAR:y);
  const dt=new Date(y,m-1,d+n);
  return{y:dt.getFullYear(),m:dt.getMonth()+1,d:dt.getDate()};
}
// データキー。後方互換：2026年は従来形式(月:部屋:日)、それ以外は年付き(年:月:部屋:日)。
// yは既定でDISP_YEAR。月のオーバーフロー/アンダーフローは年へ繰り上げ/繰り下げ。
function gk(m,r,d,y){
  y=(y==null?DISP_YEAR:y);
  // 月・日のオーバーフロー/アンダーフローを実カレンダーで正規化。
  // 例: gk(6,r,31) → 7/1 → "7:r:1"（月跨ぎ連泊のキー不整合を防止）。
  // 有効な日付はDateで恒等変換されるため、既存の全呼び出しに影響なし。
  const dt=new Date(y,m-1,d);
  y=dt.getFullYear(); m=dt.getMonth()+1; d=dt.getDate();
  return y===2026 ? `${m}:${r}:${d}` : `${y}:${m}:${r}:${d}`;
}
// データキーを解析（後方互換）：3要素=2026(m:r:d)、4要素=(y:m:r:d)
function parseKey(k){
  const p=k.split(':').map(Number);
  return p.length===4 ? {y:p[0],m:p[1],r:p[2],d:p[3]} : {y:2026,m:p[0],r:p[1],d:p[2]};
}
// ステータスENUM判定（旧'checkedin'と新'checked_in'の両対応）
function isCheckedIn(status){return status==='checked_in'||status==='checkedin';}
// ステータス正規化（互換性補完：未設定はreserved）
function normalizeStatus(status){
  if(status==='checkedin')return 'checked_in';
  if(status==='checked_in'||status==='checked_out'||status==='cancelled'||status==='reserved')return status;
  return 'reserved';
}
function gDays(y,m){return new Date(y,m,0).getDate();}
function gDow(y,m,d){return new Date(y,m-1,d).getDay();}
function dateKey(y,m,d){return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function isHoliday(y,m,d){return HOLIDAYS_2026.has(dateKey(y,m,d));}
function isWeekendOrHoliday(y,m,d){const dow=gDow(y,m,d);return dow===0||dow===6||isHoliday(y,m,d);}
function parkPrice(y,m,d){
  if(isWeekendOrHoliday(y,m,d))return 2000;
  // 年末年始 12/28〜1/3
  if((m===12&&d>=28)||(m===1&&d<=3))return 2000;
  // GW 4/29〜5/5
  if((m===4&&d>=29)||(m===5&&d<=5))return 2000;
  // 夏季繁忙期 7/15〜9/15
  if((m===7&&d>=15)||m===8||(m===9&&d<=15))return 2000;
  return 1000;
}
function hasParkKw(note){if(!note)return false;const l=note.toLowerCase();return l.includes('🚙')||l.includes('駐車')||l.includes('parking')||l.includes('car ');}
function hasSurfKw(note){if(!note)return false;const l=note.toLowerCase();return l.includes('サーフィン')||l.includes('surf');}
// 備考・プランから表示アイコンを毎回再評価（データ保存なし）
function getPlanIcons(note){
  let icons='';
  // PLAN_RULES順で重複なくアイコン追加
  PLAN_RULES.forEach(rule=>{ if(note&&note.includes(rule.keyword))icons+=rule.icon; });
  return icons;
}
// 全アイコンをまとめて取得（描画で使用）
// 表示順: 🚗→PLAN_RULES順（🏄♨🐬🍙🍳🌙）
function getCellIcons(g){
  const park=(hasParkKw(g.note)||g.parking)?'🚗':'';
  const lower=g.lowerBunk?'🛏':'';
  const plan=getPlanIcons(g.note); // PLAN_RULESの順序（サーフィン含む）
  return {all:park+lower, plan, combined:park+lower+plan};
}
// ============================================================
// 複数選択・一括削除
// ============================================================
let selectedKeys=new Set();

function cellClick(e,k){
  if(currentRole==='reception'||currentRole==='watanabe')return;
  if(e.ctrlKey||e.metaKey){
    // Ctrl+クリック：複数選択トグル
    if(selectedKeys.has(k)){
      selectedKeys.delete(k);
    } else {
      selectedKeys.add(k);
    }
    updateSelectionUI();
  } else if(selectedKeys.size>0){
    // 選択中に通常クリック→選択解除
    selectedKeys.clear();
    updateSelectionUI();
    openEdit(k);
  } else {
    openEdit(k);
  }
}

function updateSelectionUI(){
  // 全gcのselectedクラスをリセット
  document.querySelectorAll('.gc.selected').forEach(el=>el.classList.remove('selected'));
  // 選択中のセルをハイライト
  selectedKeys.forEach(k=>{
    const el=document.querySelector(`.gc[data-k="${k}"]`);
    if(el)el.classList.add('selected');
  });
  const btn=document.getElementById('bulk-delete-btn');
  const cnt=document.getElementById('bulk-count');
  if(selectedKeys.size>0){
    btn.style.display='';
    cnt.textContent=`(${selectedKeys.size}件)`;
  } else {
    btn.style.display='none';
  }
}

function bulkDelete(){
  if(selectedKeys.size===0)return;
  // アンカーキーのみ抽出（連泊のcont:trueは除く）
  const anchorKeys=[...selectedKeys].filter(k=>{
    const g=guestData[k];
    return g&&!g.cont;
  });
  const total=anchorKeys.length;
  if(total===0){showToast('⚠ 選択した予約のアンカーセルがありません');return;}
  if(!confirm(`選択した予約 ${total}件を削除しますか？\n（連泊の全泊分が削除されます）`))return;
  saveHistory();
  const month=parseInt(document.getElementById('sel-month').value);
  anchorKeys.forEach(k=>{
    const g=guestData[k];
    if(!g)return;
    syncDeleteRelated(g,month);
    const allKeys=findAllKeys(g.roomId,month,g.day);
    allKeys.forEach(({k:ak})=>delete guestData[ak]);
  });
  selectedKeys.clear();
  updateSelectionUI();
  renderReg();autoSave();
  showToast(`🗑 ${total}件の予約を削除しました`);
}

// Escキーで選択解除
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&selectedKeys.size>0){
    selectedKeys.clear();updateSelectionUI();
  }
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undoHistory();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Z')){e.preventDefault();redoHistory();}
});

// ============================================================
// Undo / Redo
// ============================================================
const HISTORY_MAX=50;
let undoStack=[];
let redoStack=[];

function collectSnapshot(){
  return JSON.stringify({
    guestData,cancelList,parkData,surfList,staffNotes,salesData,rentalSpaceReservations
  });
}

function saveHistory(){
  undoStack.push(collectSnapshot());
  if(undoStack.length>HISTORY_MAX)undoStack.shift();
  redoStack=[];
  updateHistoryButtons();
}

function applySnapshot(snap){
  const s=JSON.parse(snap);
  guestData=s.guestData||{};
  cancelList=s.cancelList||[];
  parkData=s.parkData||{};
  if(s.rentalSpaceReservations){rentalSpaceReservations=s.rentalSpaceReservations;nextRentalId=rentalSpaceReservations.reduce((mx,r)=>Math.max(mx,(r.id||0)+1),1);}
  surfList=s.surfList||[];
  unassignedReservations=s.unassignedReservations||[];
  staffNotes=s.staffNotes||[];
  nextSnId=staffNotes.reduce((m,x)=>Math.max(m,(x.id||0)+1),0);
  if(s.salesData)Object.keys(s.salesData).forEach(y=>{
    const yi=parseInt(y);const mo={};
    Object.keys(s.salesData[y]).forEach(m=>{mo[m==='total'?'total':parseInt(m)]=s.salesData[y][m];});
    salesData[yi]=mo;
  });
}

function undoHistory(){
  if(undoStack.length===0)return;
  redoStack.push(collectSnapshot());
  const snap=undoStack.pop();
  applySnapshot(snap);
  renderReg();renderRankAPanel();autoSave();
  updateHistoryButtons();
  showToast('↶ 元に戻しました');
}

function redoHistory(){
  if(redoStack.length===0)return;
  undoStack.push(collectSnapshot());
  const snap=redoStack.pop();
  applySnapshot(snap);
  renderReg();renderRankAPanel();autoSave();
  updateHistoryButtons();
  showToast('↷ やり直しました');
}

function updateHistoryButtons(){
  const ub=document.getElementById('undo-btn');
  const rb=document.getElementById('redo-btn');
  if(ub){ub.disabled=undoStack.length===0;ub.style.opacity=undoStack.length===0?'.4':'1';}
  if(rb){rb.disabled=redoStack.length===0;rb.style.opacity=redoStack.length===0?'.4':'1';}
}

// ============================================================
// 清掃管理
// ============================================================
let cleaningData={};      // {roomId: {status, assignedTo, memo, startAt, completedAt, priority}}
// ── 重点清掃項目 ──────────────────────────────────────────
let priorityCleaningItems=[];
let priorityCleaningSettings={defaultAlertDays:30, viewMonth:null, showThisMonthOnly:false};
let nextPriorityCleaningId=1;
const PRIORITY_CLEAN_CATEGORIES=[
  {key:'ほこり',     icon:'🌫️', color:'#a89b8a'},
  {key:'湿気・カビ', icon:'💧',  color:'#5fa8a2'},
  {key:'害虫',       icon:'🐛',  color:'#9c7a52'},
  {key:'臭気',       icon:'👃',  color:'#c47b6f'},
  {key:'サビ',       icon:'🔧',  color:'#8a8077'},
  {key:'床',         icon:'🧴',  color:'#8b9b6e'},
  {key:'ペンキ',     icon:'🎨',  color:'#7e9aab'},
  {key:'整理',       icon:'📦',  color:'#b59169'},
  {key:'補充',       icon:'🧺',  color:'#9c8aaa'},
];
const PRIORITY_CLEAN_FREQUENCIES=['毎日','1週間','2週間','1ヶ月','2ヶ月','半年','1年'];
const PRIORITY_CLEAN_DEFAULTS=[
  {category:'ほこり',     name:'すのこ下',                                              place:'本館2階',         frequency:'1ヶ月', scheduledMonths:[11,12]},
  {category:'ほこり',     name:'玄関屋根',                                              place:'本館2階',         frequency:'1年',   scheduledMonths:[10]},
  {category:'ほこり',     name:'エアコンフィルター・換気扇・アパート浴室乾燥機',         place:'全館',           frequency:'1ヶ月', scheduledMonths:[1,2,3,4,5,6,7,8,9,10,11,12]},
  {category:'ほこり',     name:'オブジェ',                                              place:'全館',           frequency:'2ヶ月', scheduledMonths:[1,3,5,7,9,11]},
  {category:'湿気・カビ', name:'清掃時：ソファを上げる・地下倉庫開放',                   place:'本館地下',       frequency:'毎日',  scheduledMonths:[5,6,7,8,9]},
  {category:'湿気・カビ', name:'冷蔵庫の排水チェック',                                  place:'本館地下',       frequency:'毎日',  scheduledMonths:[6,7,8,9,10]},
  {category:'湿気・カビ', name:'エアコン常時送風',                                      place:'本館地下・ANNEXラウンジ', frequency:'毎日', scheduledMonths:[5,6,7,8,9]},
  {category:'湿気・カビ', name:'ソファ下に除湿剤設置（確認＆取替え）',                    place:'本館地下',       frequency:'2週間', scheduledMonths:[6,7,8,9]},
  {category:'湿気・カビ', name:'シャワーブース折れ戸清掃',                              place:'全館',           frequency:'1週間', scheduledMonths:[1,2,3,4,5,6,7,8,9,10,11,12]},
  {category:'湿気・カビ', name:'エアコン内部清掃',                                      place:'全館',           frequency:'1年',   scheduledMonths:[6,10]},
  {category:'湿気・カビ', name:'キッチン周り・冷蔵庫・冷凍庫清掃',                       place:'本館地下',       frequency:'1ヶ月', scheduledMonths:[1,2,3,4,5,6,7,8,9,10,11,12]},
  {category:'害虫',       name:'ゴキブリ用殺虫剤（1年用）設置',                          place:'全館',           frequency:'1年',   scheduledMonths:[5]},
  {category:'害虫',       name:'南京虫殺虫剤',                                          place:'本館',           frequency:'1年',   scheduledMonths:[6]},
  {category:'臭気',       name:'シャワーブース・洗面所の重点清掃（折れ戸すみ・配管）',    place:'全館',           frequency:'1ヶ月', scheduledMonths:[1,2,3,4,5,6,7,8,9,10,11,12]},
  {category:'臭気',       name:'洗面所パイプユニッシュ',                                place:'全館',           frequency:'2週間', scheduledMonths:[1,2,3,4,5,6,7,8,9,10,11,12]},
  {category:'サビ',       name:'自転車さび止め',                                        place:'',               frequency:'1年',   scheduledMonths:[4]},
  {category:'サビ',       name:'自転車 砂・ホコリ掃除・空気チェック',                    place:'',               frequency:'1ヶ月', scheduledMonths:[3,4,5,6,7,8,9,10,11,12]},
  {category:'床',         name:'ワックス塗り',                                          place:'本館',           frequency:'1年',   scheduledMonths:[1]},
  {category:'ペンキ',     name:'ペンキ塗り・補修',                                      place:'',               frequency:'1年',   scheduledMonths:[2]},
  {category:'整理',       name:'不要品整理',                                            place:'',               frequency:'半年',  scheduledMonths:[4,10]},
  {category:'補充',       name:'アルコール・消臭剤の補充（トイレ・玄関）',                place:'本館・ANNEX',    frequency:'1ヶ月', scheduledMonths:[1,2,3,4,5,6,7,8,9,10,11,12]},
];
const CLEANING_STAFF=['木村','鈴木','田中','佐藤','その他'];
const CLEANING_STATUS={
  waiting: {label:'清掃待ち', cls:'waiting'},
  cleaning:{label:'清掃中',   cls:'cleaning'},
  checking:{label:'確認待ち', cls:'checking'},
  completed:{label:'清掃済',  cls:'completed'},
};
let editingCleaningRoomId=null;

// 清掃対象リスト生成（当日CO予定部屋）
function generateCleaningList(){
  const now=new Date();
  const jst=new Date(now.getTime()+9*60*60*1000);
  const m=jst.getUTCMonth()+1, d=jst.getUTCDate();

  const newMap=new Map();

  // rooms配列順（宿泊名簿と同一）でスキャン
  rooms.forEach(room=>{
    const keyBefore=(n)=>{const{y,m:pm,d:pd}=addDays(m,d,-n);return gk(pm,room.id,pd,y);};
    const todayKey=gk(m,room.id,d);
    const yestKey=keyBefore(1);
    const todayG=guestData[todayKey];
    const yestG=guestData[yestKey];

    // ── チェックアウト判定：昨日宿泊（cont含む）& 今日は別人orなし ──
    // yestG が cont:true の場合でも、その連泊チェーンのアンカーを取得して判定
    let yestAnchor=yestG;
    if(yestG&&yestG.cont){
      for(let i=2;i<=31;i++){
        const pk=keyBefore(i);
        const pg=guestData[pk];
        if(!pg||pg.name!==yestG.name)break;
        if(!pg.cont){yestAnchor=pg;break;}
      }
    }
    if(yestAnchor&&yestAnchor.status!=='cancelled'
       &&(!todayG||todayG.name!==yestAnchor.name)){
      let nights=1;
      for(let i=2;i<=31;i++){
        const pk=keyBefore(i);
        if(guestData[pk]&&guestData[pk].name===yestAnchor.name)nights++;
        else break;
      }
      const hasNextBooking=!!(todayG&&todayG.status!=='cancelled');
      let priority='low';
      if(yestAnchor.charter||room.group==='ANNEX−個室'||room.group==='本館−個室')priority='high';
      else if(hasNextBooking)priority='high';
      else if(nights>=3||guestCountOf(yestAnchor)>=3)priority='mid';

      newMap.set(room.id,{
        room,guest:yestAnchor,nights,hasNextBooking,priority,
        nextGuest:todayG||null,type:'checkout',
      });
    }

    // ── 連泊判定：今日も宿泊中（cont:trueも含む） ──
    // todayGがcont:trueの場合はアンカーを遡って取得
    let effectiveTodayG=todayG;
    if(todayG&&todayG.cont){
      // アンカー（cont:false）を過去方向に探す
      for(let i=1;i<=31;i++){
        const pk=keyBefore(i);
        const pg=guestData[pk];
        if(!pg)break;
        if(!pg.cont){effectiveTodayG=pg;break;}
      }
    }
    if(effectiveTodayG&&effectiveTodayG.status!=='cancelled'){
      // 昨日も同じ人 → 連泊（yestGと氏名一致）
      const isStayover=!!(yestG&&(yestG.name===effectiveTodayG.name));
      if(isStayover){
        // 連泊開始日から泊数計算
        let nights=1;
        for(let i=1;i<=31;i++){
          const pk=keyBefore(i);
          if(guestData[pk]&&guestData[pk].name===effectiveTodayG.name)nights++;
          else break;
        }
        newMap.set(room.id+'_stay',{
          room,guest:effectiveTodayG,nights,hasNextBooking:false,priority:'low',
          nextGuest:null,type:'stayover',roomId:room.id,
        });
      }
    }
  });

  // cleaningDataを更新（既存ステータスを保持）
  const newIds=new Set([...newMap.keys()].map(String));
  Object.keys(cleaningData).forEach(rid=>{if(!newIds.has(rid))delete cleaningData[rid];});
  newMap.forEach((info,key)=>{
    const rid=String(key);
    if(!cleaningData[rid])cleaningData[rid]={status:'waiting',assignedTo:'',memo:'',startAt:null,completedAt:null};
    cleaningData[rid]._info=info;
  });

  renderCleaning();
  autoSave();
  const coCount=[...newMap.values()].filter(i=>i.type==='checkout').length;
  const stayCount=[...newMap.values()].filter(i=>i.type==='stayover').length;
  showToast(`🧹 CO:${coCount}部屋　連泊:${stayCount}部屋 を生成しました`);
}

// 清掃リスト描画
function renderCleaning(){
  const now=new Date();
  const jst=new Date(now.getTime()+9*60*60*1000);
  const h=jst.getUTCHours();
  const dateStr=`${jst.getUTCFullYear()}年${jst.getUTCMonth()+1}月${jst.getUTCDate()}日`;
  document.getElementById('cleaning-date-label').textContent=`${dateStr} の清掃リスト`;

  const filterStaff=document.getElementById('cleaning-filter-staff').value;
  const filterStatus=document.getElementById('cleaning-filter-status').value;
  const showStayover=(document.getElementById('cleaning-show-stayover')?.checked!==false);

  // 担当者セレクト更新
  const staffSel=document.getElementById('cleaning-filter-staff');
  const curVal=staffSel.value;
  staffSel.innerHTML='<option value="">全担当者</option>';
  const staffSet=new Set(CLEANING_STAFF);
  Object.values(cleaningData).forEach(d=>{if(d.assignedTo)staffSet.add(d.assignedTo);});
  staffSet.forEach(s=>staffSel.innerHTML+=`<option value="${s}"${s===curVal?' selected':''}>${s}</option>`);

  // datalist更新
  const dl=document.getElementById('cm-staff-list');
  if(dl)dl.innerHTML=CLEANING_STAFF.map(s=>`<option value="${s}">`).join('');

  // rooms配列順（=宿泊名簿順）でエントリを並べる
  const orderedEntries=[];
  rooms.forEach(room=>{
    // チェックアウト
    const coKey=String(room.id);
    if(cleaningData[coKey]){
      const d=cleaningData[coKey];
      if(d._info?.type==='checkout'){
        if(filterStaff&&d.assignedTo!==filterStaff)return;
        if(filterStatus&&d.status!==filterStatus)return;
        orderedEntries.push({rid:coKey,d,room});
      }
    }
    // 連泊
    const stayKey=String(room.id)+'_stay';
    if(cleaningData[stayKey]&&showStayover){
      const d=cleaningData[stayKey];
      if(filterStaff&&d.assignedTo!==filterStaff)return;
      if(filterStatus&&d.status!==filterStatus)return;
      orderedEntries.push({rid:stayKey,d,room});
    }
  });

  // サマリー
  const counts={waiting:0,cleaning:0,checking:0,completed:0};
  Object.values(cleaningData).forEach(d=>{if(counts[d.status]!==undefined)counts[d.status]++;});
  const total=Object.keys(cleaningData).length;
  const summaryColors={waiting:'#e0f2fe',cleaning:'#dbeafe',checking:'#ede9fe',completed:'#dcfce7'};
  const summaryTxt={waiting:'#0369a1',cleaning:'#1d4ed8',checking:'#6d28d9',completed:'#15803d'};
  document.getElementById('cleaning-summary').innerHTML=
    `<div class="cl-summary-chip" style="background:#f1f5f9;color:#475569;">合計 ${total}部屋</div>`+
    Object.entries(counts).map(([s,c])=>c>0
      ?`<div class="cl-summary-chip" style="background:${summaryColors[s]};color:${summaryTxt[s]};">${CLEANING_STATUS[s].label} ${c}</div>`:''
    ).join('');

  if(orderedEntries.length===0){
    document.getElementById('cleaning-cards').innerHTML=
      '<div style="color:var(--muted);font-size:13px;grid-column:1/-1;">表示する部屋がありません。「🔄 リスト生成」を押してください。</div>';
    // 清掃リストが0件でも、当月の重点清掃項目プレビューは表示する（早期returnで隠れないように）
    if(typeof renderPriorityCleaningPreview==='function')renderPriorityCleaningPreview();
    return;
  }

  // エリア別グループ化（rooms配列のgroup順を維持）
  const areaOrder=[];
  const areaMap=new Map();
  rooms.forEach(r=>{
    const area=r.group;
    if(!areaMap.has(area)){areaMap.set(area,[]);areaOrder.push(area);}
  });
  orderedEntries.forEach(e=>{
    const area=e.room.group;
    if(!areaMap.has(area))areaMap.set(area,[]);
    areaMap.get(area).push(e);
  });

  // 完了済みを末尾へ（各エリア内で）
  areaMap.forEach((list,area)=>{
    list.sort((a,b)=>{
      const ac=a.d.status==='completed'?1:0;
      const bc=b.d.status==='completed'?1:0;
      return ac-bc;
    });
  });

  let html='';
  areaOrder.forEach(area=>{
    const list=areaMap.get(area);
    if(!list||list.length===0)return;
    // エリアヘッダー
    const areaShort={'本館−個室':'本館 個室','本館−男女混合ドミトリー':'本館 ドミトリー',
      'ANNEX−個室':'ANNEX 個室','ANNEX−ドミトリー':'ANNEX ドミ',
      'アパートメント−Southern Court':'アパートメント',
      'Sea Breeze 鎌倉':'SB 鎌倉','Sea Breeze 三浦':'SB 三浦'}[area]||area;
    html+=`<div style="grid-column:1/-1;font-size:11px;font-weight:700;color:var(--muted);
      letter-spacing:.08em;padding:6px 0 2px;border-bottom:1px solid var(--sand-border);margin-top:4px;">
      ■ ${areaShort}</div>`;

    list.forEach(({rid,d,room})=>{
      const info=d._info||{};
      const guest=info.guest||{};
      const isStayover=info.type==='stayover';
      const prio=isStayover?'stayover':(info.priority||'low');
      const isAlert=h>=14&&d.status!=='completed'&&!isStayover;
      const isCompleted=d.status==='completed';

      const statusBtns=Object.entries(CLEANING_STATUS).map(([s,{label}])=>
        `<button class="cl-status-btn ${s}${d.status===s?' active':''}" onclick="setCleaningStatus('${rid}','${s}')">${label}</button>`
      ).join('');
      const elapsed=d.startAt&&d.completedAt
        ?`（${Math.round((new Date('2000/01/01 '+d.completedAt)-new Date('2000/01/01 '+d.startAt))/60000)}分）`:'';

      // カードのボーダー色
      const borderColor=isStayover?'#22c55e':isCompleted?'#3d9441':'#ef4444';
      const cardBg=isStayover?'#f0fdf4':isCompleted?'#f9f9f9':'#fff';

      html+=`<div class="cl-card ${d.status}" id="cl-card-${rid}"
        style="border-left-color:${borderColor};background:${cardBg};${isCompleted?'opacity:.7;':''}" >
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span class="cl-room">${room.type}</span>
          ${isStayover
            ?'<span class="cl-badge" style="background:#dcfce7;color:#15803d;">🏠 連泊中</span>'
            :'<span class="cl-badge" style="background:#fee2e2;color:#991b1b;">🔴 本日OUT</span>'}
        </div>
        <div class="cl-guest">${esc(guest.name||'—')}　${guestCountOf(guest)}名　${info.nights||1}泊</div>
        <div class="cl-badges">
          ${info.hasNextBooking
          ? `<span class="cl-badge mid">📅 次予約あり ${info.nextGuest?guestCountOf(info.nextGuest)+'名':''}</span>`
          : ''}
          ${guest.charter?'<span class="cl-badge high">🔒 貸切</span>':''}
          ${info.nights>=3?'<span class="cl-badge">長期'+info.nights+'泊</span>':''}
        </div>
        <div class="cl-status-row">${statusBtns}</div>
        <div class="cl-assignee">担当：${esc(d.assignedTo||'未割当')}
          ${d.startAt?` ／ 開始 ${esc(d.startAt)}`:''}
          ${d.completedAt?` ／ 完了 ${esc(d.completedAt)}${elapsed}`:''}
        </div>
        <button class="cl-memo-btn" onclick="openCleaningMemo('${rid}')">📝 メモ編集</button>
        ${d.memo?`<div class="cl-memo-text">${esc(d.memo)}</div>`:''}
      </div>`;
    });
  });

  document.getElementById('cleaning-cards').innerHTML=html;
  if(typeof renderPriorityCleaningPreview==='function')renderPriorityCleaningPreview();
}

// ── 重点清掃項目：ヘルパー関数群 ─────────────────────────
function initPriorityCleaningIfEmpty(){
  if(priorityCleaningItems&&priorityCleaningItems.length>0)return;
  priorityCleaningItems=PRIORITY_CLEAN_DEFAULTS.map((d,i)=>({id:i+1,...d,alertDays:null,order:i,history:[]}));
  nextPriorityCleaningId=priorityCleaningItems.length+1;
}
function getPriorityCleaningLastDate(item){
  if(!item.history||!item.history.length)return null;
  return [...item.history].sort().reverse()[0];
}
function getPriorityCleaningDaysSince(item){
  const last=getPriorityCleaningLastDate(item);if(!last)return null;
  const today=new Date();today.setHours(0,0,0,0);
  return Math.floor((today-new Date(last+'T00:00:00'))/86400000);
}
function getPriorityCleaningMonthCount(item,year,month){
  if(!item.history)return 0;
  const prefix=`${year}-${String(month).padStart(2,'0')}-`;
  return item.history.filter(d=>d.startsWith(prefix)).length;
}
function isPriorityCleaningAlert(item){
  // 周期内にすでに実施済みなら警告は出さない（未実施扱いにしない）
  if(isPriorityCleaningCompletedInPeriod(item))return false;
  const days=getPriorityCleaningDaysSince(item);
  if(days==null)return true;
  const threshold=item.alertDays!=null?item.alertDays:priorityCleaningSettings.defaultAlertDays;
  return days>=threshold;
}
function isScheduledThisMonth(item,month){
  return Array.isArray(item.scheduledMonths)&&item.scheduledMonths.includes(month);
}
// ── 清掃タスク表示判定（重点清掃項目・清掃予定表で共通利用）──────────
// 周期内にすでに実施済みか？（実施済み＝未実施リストから除外・警告解除）
//  ・1ヶ月（毎月）：カレンダー「月」単位でリセット。当月に履歴があれば実施済み
//  ・2ヶ月/半年/1年：最終実施日から所定の月数が経過するまで実施済み（非表示）
//  ・毎日/1週間/2週間：最終実施日から所定の日数が経過するまで実施済み
function isPriorityCleaningCompletedInPeriod(item,refDate){
  if(!item||!item.history||!item.history.length)return false;
  const ref=refDate?new Date(refDate):new Date();
  const last=getPriorityCleaningLastDate(item); // 'YYYY-MM-DD'（最新）
  if(!last)return false;
  const freq=item.frequency||'1ヶ月';
  // 毎月（1ヶ月）：当月のカレンダー月内に履歴があれば実施済み
  if(freq==='1ヶ月'){
    const prefix=`${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,'0')}-`;
    return item.history.some(d=>String(d).startsWith(prefix));
  }
  // 月数ベース：最終実施日＋月数 が未到来なら実施済み
  const MONTHS={'2ヶ月':2,'半年':6,'1年':12};
  const today=new Date(ref);today.setHours(0,0,0,0);
  if(MONTHS[freq]){
    const limit=new Date(last+'T00:00:00');
    limit.setMonth(limit.getMonth()+MONTHS[freq]);
    return today<limit;
  }
  // 日数ベース：毎日/1週間/2週間
  const DAYS={'毎日':1,'1週間':7,'2週間':14};
  const days=DAYS[freq]||1;
  const diff=Math.floor((today-new Date(last+'T00:00:00'))/86400000);
  return diff<days;
}
// このタスクを「今月の未実施リスト」に表示すべきか（今月予定 かつ 周期内未実施）
function shouldDisplayTask(item,refDate){
  const ref=refDate?new Date(refDate):new Date();
  const scheduled=isScheduledThisMonth(item,ref.getMonth()+1);
  const completed=isPriorityCleaningCompletedInPeriod(item,ref);
  const display=scheduled&&!completed;
  console.log({
    taskName:item.name,
    frequency:item.frequency,
    lastCompletedDate:getPriorityCleaningLastDate(item),
    today:ref.toISOString().split('T')[0],
    isCompletedInPeriod:completed,
    shouldDisplay:display
  });
  return display;
}
function togglePriorityCleaningDone(itemId){
  const item=priorityCleaningItems.find(x=>x.id===itemId);if(!item)return;
  const today=new Date();
  const key=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if(!item.history)item.history=[];
  const idx=item.history.indexOf(key);
  if(idx>=0)item.history.splice(idx,1);else item.history.push(key);
  renderPriorityCleaning();
  renderPriorityCleaningPreview();
  if(typeof cloudSave==='function')cloudSave();
}
let editingPriorityCleaningId=null;
function openPriorityCleaningEdit(itemId){
  editingPriorityCleaningId=itemId;
  const isNew=itemId==null;
  const item=isNew?{category:PRIORITY_CLEAN_CATEGORIES[0].key,name:'',place:'',frequency:'1ヶ月',scheduledMonths:[],alertDays:null,history:[]}:priorityCleaningItems.find(x=>x.id===itemId);
  if(!item)return;
  document.getElementById('pc-edit-title').textContent=isNew?'⭐ 重点清掃項目を追加':'⭐ 重点清掃項目を編集';
  const catSel=document.getElementById('pc-edit-category');
  catSel.innerHTML=PRIORITY_CLEAN_CATEGORIES.map(c=>`<option value="${c.key}"${c.key===item.category?' selected':''}>${c.icon} ${c.key}</option>`).join('');
  document.getElementById('pc-edit-name').value=item.name||'';
  document.getElementById('pc-edit-place').value=item.place||'';
  const freqSel=document.getElementById('pc-edit-frequency');
  freqSel.innerHTML=PRIORITY_CLEAN_FREQUENCIES.map(f=>`<option${f===item.frequency?' selected':''}>${f}</option>`).join('');
  const monthsArea=document.getElementById('pc-edit-months');
  monthsArea.innerHTML=Array.from({length:12},(_,i)=>{
    const m=i+1;const checked=item.scheduledMonths&&item.scheduledMonths.includes(m);
    return `<label style="display:inline-flex;align-items:center;gap:3px;padding:4px 7px;border:1.5px solid ${checked?'#5fa8a2':'var(--sand-border)'};border-radius:6px;background:${checked?'#e8f4f3':'#fff'};cursor:pointer;font-size:11px;"><input type="checkbox" data-month="${m}" ${checked?'checked':''} style="margin:0;">${m}月</label>`;
  }).join('');
  monthsArea.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const lbl=cb.parentElement;
      if(cb.checked){lbl.style.borderColor='#5fa8a2';lbl.style.background='#e8f4f3';}
      else{lbl.style.borderColor='var(--sand-border)';lbl.style.background='#fff';}
    });
  });
  document.getElementById('pc-edit-alert').value=item.alertDays!=null?item.alertDays:'';
  document.getElementById('pc-edit-delete').style.display=isNew?'none':'';
  document.getElementById('pc-edit-modal').classList.add('open');
  setTimeout(()=>document.getElementById('pc-edit-name').focus(),100);
}
function savePriorityCleaningEdit(){
  const category=document.getElementById('pc-edit-category').value;
  const name=document.getElementById('pc-edit-name').value.trim();
  if(!name){showToast('⚠ 項目名を入力してください');return;}
  const place=document.getElementById('pc-edit-place').value.trim();
  const frequency=document.getElementById('pc-edit-frequency').value;
  const scheduledMonths=[];
  document.querySelectorAll('#pc-edit-months input[type=checkbox]:checked').forEach(cb=>scheduledMonths.push(Number(cb.dataset.month)));
  scheduledMonths.sort((a,b)=>a-b);
  const alertVal=document.getElementById('pc-edit-alert').value;
  const alertDays=alertVal===''?null:Math.max(1,parseInt(alertVal)||30);
  if(editingPriorityCleaningId==null){
    const newOrder=Math.max(0,...priorityCleaningItems.map(x=>x.order||0))+1;
    priorityCleaningItems.push({id:nextPriorityCleaningId++,category,name,place,frequency,scheduledMonths,alertDays,order:newOrder,history:[]});
  } else {
    const it=priorityCleaningItems.find(x=>x.id===editingPriorityCleaningId);
    if(it)Object.assign(it,{category,name,place,frequency,scheduledMonths,alertDays});
  }
  document.getElementById('pc-edit-modal').classList.remove('open');
  editingPriorityCleaningId=null;
  renderPriorityCleaning();
  if(typeof cloudSave==='function')cloudSave();
  showToast('💾 保存しました');
}
function deletePriorityCleaningFromEdit(){
  if(editingPriorityCleaningId==null)return;
  if(!confirm('この重点清掃項目を削除しますか？\n実施履歴も削除されます。'))return;
  priorityCleaningItems=priorityCleaningItems.filter(x=>x.id!==editingPriorityCleaningId);
  document.getElementById('pc-edit-modal').classList.remove('open');
  editingPriorityCleaningId=null;
  renderPriorityCleaning();
  if(typeof cloudSave==='function')cloudSave();
  showToast('🗑 削除しました');
}
let _pcDragId=null;
function pcOnDragStart(ev,id){_pcDragId=id;ev.dataTransfer.effectAllowed='move';ev.target.style.opacity='0.4';}
function pcOnDragEnd(ev){ev.target.style.opacity='';_pcDragId=null;document.querySelectorAll('.pc-drop-over').forEach(el=>el.classList.remove('pc-drop-over'));}
function pcOnDragOver(ev,id){ev.preventDefault();ev.dataTransfer.dropEffect='move';if(_pcDragId&&_pcDragId!==id)ev.currentTarget.classList.add('pc-drop-over');}
function pcOnDragLeave(ev){ev.currentTarget.classList.remove('pc-drop-over');}
function pcOnDrop(ev,targetId){
  ev.preventDefault();ev.currentTarget.classList.remove('pc-drop-over');
  if(_pcDragId==null||_pcDragId===targetId)return;
  const from=priorityCleaningItems.findIndex(x=>x.id===_pcDragId);
  const to=priorityCleaningItems.findIndex(x=>x.id===targetId);
  if(from<0||to<0)return;
  const [moved]=priorityCleaningItems.splice(from,1);
  priorityCleaningItems.splice(to,0,moved);
  priorityCleaningItems.forEach((it,i)=>it.order=i);
  _pcDragId=null;
  renderPriorityCleaning();
  if(typeof cloudSave==='function')cloudSave();
}
function setPriorityCleaningAlertDays(){
  const v=prompt('未実施アラートの閾値（日数）を入力してください\n（個別設定がない項目に適用）',priorityCleaningSettings.defaultAlertDays);
  if(v==null)return;
  const n=parseInt(v);
  if(isNaN(n)||n<1){showToast('⚠ 1以上の整数を入力してください');return;}
  priorityCleaningSettings.defaultAlertDays=n;
  renderPriorityCleaning();
  if(typeof cloudSave==='function')cloudSave();
  showToast(`⚙ アラート閾値を${n}日に設定しました`);
}
function togglePriorityCleaningThisMonthOnly(){
  priorityCleaningSettings.showThisMonthOnly=!priorityCleaningSettings.showThisMonthOnly;
  renderPriorityCleaning();
}
function changePriorityCleaningViewMonth(ym){
  priorityCleaningSettings.viewMonth=ym||null;
  renderPriorityCleaning();
}
function renderPriorityCleaningPreview(){
  const el=document.getElementById('priority-cleaning-preview');if(!el)return;
  initPriorityCleaningIfEmpty();
  const now=new Date();
  const todayKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  // 今月予定かつ周期内に未実施の項目（共通判定 shouldDisplayTask）
  const items=[...priorityCleaningItems]
    .sort((a,b)=>(a.order||0)-(b.order||0))
    .filter(it=>shouldDisplayTask(it,now));
  if(!items.length){
    el.innerHTML=`<div style="background:#f0faf9;border:1.5px solid #c0e0dc;border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">✅</span>
      <span style="font-size:13px;color:#3b6c69;font-weight:600;">今月予定の重点清掃はすべて実施済みです</span>
      <button class="btn btn-xs" onclick="showP('cleaning-focus',document.getElementById('nitem-cleaning-focus'))" style="margin-left:auto;font-size:11px;">⭐ 詳細を見る</button>
    </div>`;
    return;
  }
  const alertItems=items.filter(it=>isPriorityCleaningAlert(it));
  let html=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
    <div style="font-size:13px;font-weight:700;color:#7a4f00;">⭐ 今月の重点清掃（未実施 ${items.length}件${alertItems.length?` ／ ⚠ 警告 ${alertItems.length}件`:''}）</div>
    <button class="btn btn-xs" onclick="showP('cleaning-focus',document.getElementById('nitem-cleaning-focus'))" style="margin-left:auto;font-size:11px;">すべて見る →</button>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px;">`;
  items.forEach(it=>{
    const alert=isPriorityCleaningAlert(it);
    const days=getPriorityCleaningDaysSince(it);
    const cat=PRIORITY_CLEAN_CATEGORIES.find(c=>c.key===it.category)||{icon:'⭐',color:'#aaa'};
    html+=`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff;border:1.5px solid ${alert?'#e67e6a44':'var(--sand-border)'};border-left:4px solid ${alert?'#e67e6a':cat.color};border-radius:8px;">
      <div class="pc-check ${it.history&&it.history.includes(todayKey)?'done':''}" onclick="togglePriorityCleaningDone(${it.id})" style="flex-shrink:0;" title="今日実施したことを記録"></div>
      <span style="font-size:13px;">${cat.icon}</span>
      <span style="font-size:12px;font-weight:600;flex:1;">${esc(it.name)}</span>
      ${it.place?`<span style="font-size:10px;color:var(--muted);">${esc(it.place)}</span>`:''}
      <span style="font-size:10px;background:#eef5f4;color:#3b6c69;padding:1px 7px;border-radius:99px;font-weight:600;">${it.frequency}</span>
      ${alert?`<span style="font-size:10px;background:#e67e6a;color:#fff;padding:1px 7px;border-radius:99px;font-weight:700;">⚠${days!=null?` ${days}日`:'未実施'}</span>`:''}
    </div>`;
  });
  html+=`</div>`;
  el.innerHTML=html;
}
function renderPriorityCleaning(){
  const el=document.getElementById('priority-cleaning-area');if(!el)return;
  initPriorityCleaningIfEmpty();
  const now=new Date();
  let viewY=now.getFullYear(),viewM=now.getMonth()+1;
  if(priorityCleaningSettings.viewMonth){
    const [y,m]=priorityCleaningSettings.viewMonth.split('-').map(Number);
    if(y&&m){viewY=y;viewM=m;}
  }
  const items=[...priorityCleaningItems].sort((a,b)=>(a.order||0)-(b.order||0));
  const filtered=priorityCleaningSettings.showThisMonthOnly?items.filter(it=>isScheduledThisMonth(it,viewM)):items;
  const scheduledCount=items.filter(it=>isScheduledThisMonth(it,viewM)).length;
  const doneCount=items.filter(it=>getPriorityCleaningMonthCount(it,viewY,viewM)>0).length;
  const alertCount=items.filter(it=>isPriorityCleaningAlert(it)).length;
  const monthCounts=items.map(it=>({name:it.name,count:getPriorityCleaningMonthCount(it,viewY,viewM)})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
  const zeroCount=items.filter(it=>getPriorityCleaningMonthCount(it,viewY,viewM)===0).slice(0,5);
  const monthOptions=[];
  for(let i=0;i<7;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const y=d.getFullYear(),m=d.getMonth()+1;
    const val=`${y}-${String(m).padStart(2,'0')}`;
    const isSel=priorityCleaningSettings.viewMonth===val||(!priorityCleaningSettings.viewMonth&&i===0);
    monthOptions.push(`<option value="${val}"${isSel?' selected':''}>${y}年${m}月</option>`);
  }
  const byCat={};
  PRIORITY_CLEAN_CATEGORIES.forEach(c=>byCat[c.key]=[]);
  filtered.forEach(it=>{if(!byCat[it.category])byCat[it.category]=[];byCat[it.category].push(it);});
  const todayKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const isThisYearMonth=(viewY===now.getFullYear()&&viewM===now.getMonth()+1);
  let html=`
  <div class="pc-section-header">
    <div class="pc-section-title">⭐ 重点清掃項目</div>
    <div class="pc-section-stats">
      <div>今月予定 <strong>${scheduledCount}</strong>件</div>
      <div>実施済 <strong style="color:#5fa8a2;">${doneCount}</strong>件</div>
      <div>未実施警告 <strong style="color:#e67e6a;">${alertCount}</strong>件</div>
      <div>項目数 <strong>${items.length}</strong></div>
    </div>
  </div>
  <div class="pc-toolbar">
    <button class="btn pc-btn-add" onclick="openPriorityCleaningEdit(null)">＋ 項目を追加</button>
    <button class="btn" onclick="setPriorityCleaningAlertDays()">⚙ アラート設定（${priorityCleaningSettings.defaultAlertDays}日）</button>
    <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;padding:6px 11px;border:1.5px solid ${priorityCleaningSettings.showThisMonthOnly?'#f4b860':'var(--sand-border)'};border-radius:6px;background:${priorityCleaningSettings.showThisMonthOnly?'#fff7e6':'#fff'};">
      <input type="checkbox" ${priorityCleaningSettings.showThisMonthOnly?'checked':''} onchange="togglePriorityCleaningThisMonthOnly()" style="margin:0;"> ⚡ 今月予定のみ表示
    </label>
    <div style="flex:1;"></div>
    <span style="font-size:11px;color:var(--muted);">💡 ⋮⋮ をドラッグで並び替え</span>
  </div>
  <div class="pc-month-summary">
    <div class="pc-month-head">
      <div class="pc-month-title">📊 ${viewY}年${viewM}月の実施回数</div>
      <select onchange="changePriorityCleaningViewMonth(this.value)" style="margin-left:auto;font-size:11px;padding:4px 8px;border:1px solid var(--sand-border);border-radius:6px;">${monthOptions.join('')}</select>
    </div>
    <div class="pc-month-pills">
      ${monthCounts.length===0?'<span style="font-size:11px;color:var(--muted);">この月はまだ実施記録がありません</span>':monthCounts.map(x=>`<div class="pc-month-pill"><span>${esc(x.name)}</span><strong>${x.count}回</strong></div>`).join('')}
      ${zeroCount.map(it=>`<div class="pc-month-pill" style="color:#aaa;"><span>${esc(it.name)}</span><strong style="color:#aaa;">0回</strong></div>`).join('')}
    </div>
  </div>
  <div class="pc-grid">`;
  PRIORITY_CLEAN_CATEGORIES.forEach(cat=>{
    const list=byCat[cat.key]||[];if(list.length===0)return;
    const scheduledInCat=list.filter(it=>isScheduledThisMonth(it,viewM)).length;
    html+=`<div class="pc-cat-card">
      <div class="pc-cat-head" style="border-left:3px solid ${cat.color};padding-left:10px;">
        <div class="pc-cat-icon">${cat.icon}</div>
        <div class="pc-cat-name">${cat.key}</div>
        <div class="pc-cat-count">${list.length}項目</div>
        ${scheduledInCat>0&&isThisYearMonth?`<div class="pc-cat-scheduled">⚡今月${scheduledInCat}件</div>`:''}
      </div><div>`;
    list.forEach(it=>{
      const days=getPriorityCleaningDaysSince(it);
      const last=getPriorityCleaningLastDate(it);
      const monthCount=getPriorityCleaningMonthCount(it,viewY,viewM);
      const alert=isPriorityCleaningAlert(it);
      const scheduledNow=isScheduledThisMonth(it,viewM)&&isThisYearMonth;
      const doneToday=it.history&&it.history.includes(todayKey);
      const completedInPeriod=isPriorityCleaningCompletedInPeriod(it);
      const cls=alert?'alert':((doneToday||completedInPeriod)?'recent':'');
      const lastLabel=last?(()=>{const dt=new Date(last+'T00:00:00');const y=dt.getFullYear(),m=String(dt.getMonth()+1).padStart(2,'0'),d=String(dt.getDate()).padStart(2,'0');return y===now.getFullYear()?`${m}/${d}`:`${y}/${m}/${d}`;})():'未実施';
      html+=`<div class="pc-task ${cls} ${scheduledNow?'scheduled':''}" draggable="true" ondragstart="pcOnDragStart(event,${it.id})" ondragend="pcOnDragEnd(event)" ondragover="pcOnDragOver(event,${it.id})" ondragleave="pcOnDragLeave(event)" ondrop="pcOnDrop(event,${it.id})">
        <div class="pc-drag">⋮⋮</div>
        <div class="pc-check ${doneToday?'done':''}" onclick="event.stopPropagation();togglePriorityCleaningDone(${it.id})" title="${doneToday?'今日の実施を取消':'今日実施したことを記録'}"></div>
        <div class="pc-body" onclick="openPriorityCleaningEdit(${it.id})">
          <div class="pc-title">${esc(it.name)}${scheduledNow?'<span class="pc-scheduled-tag">⚡今月予定</span>':''}</div>
          ${it.place?`<div class="pc-place">${esc(it.place)}</div>`:''}
          <div class="pc-meta">
            <span class="pc-freq">${it.frequency}</span>
            <span class="pc-last">📅 ${lastLabel}</span>
            ${monthCount>0?`<span class="pc-count">今月${monthCount}回</span>`:''}
            ${alert&&days!=null?`<span class="pc-alert-tag">⚠ ${days}日未実施</span>`:(alert&&days==null?'<span class="pc-alert-tag">⚠ 未実施</span>':'')}
          </div>
        </div>
        <div class="pc-actions"><button class="pc-icon-btn" onclick="event.stopPropagation();openPriorityCleaningEdit(${it.id})" title="編集">✏</button></div>
      </div>`;
    });
    html+=`</div></div>`;
  });
  if(filtered.length===0){
    html+=`<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--muted);font-size:13px;background:#fff;border:1px dashed var(--sand-border);border-radius:10px;">${priorityCleaningSettings.showThisMonthOnly?'今月予定の項目はありません':'重点清掃項目がありません。「項目を追加」から登録してください。'}</div>`;
  }
  html+=`</div>`;
  el.innerHTML=html;
}
function setCleaningStatus(roomId,status){
  const rid=String(roomId);
  if(!cleaningData[rid])return;
  const prev=cleaningData[rid].status;
  cleaningData[rid].status=status;
  const now=new Date();
  const jst=new Date(now.getTime()+9*60*60*1000);
  const t=`${String(jst.getUTCHours()).padStart(2,'0')}:${String(jst.getUTCMinutes()).padStart(2,'0')}`;
  if(status==='cleaning'&&!cleaningData[rid].startAt)cleaningData[rid].startAt=t;
  if(status==='completed')cleaningData[rid].completedAt=t;
  if(status!=='completed'&&prev==='completed')cleaningData[rid].completedAt=null;
  renderCleaning();autoSave();
}

function openCleaningMemo(roomId){
  const rid=String(roomId);
  editingCleaningRoomId=rid;
  const d=cleaningData[rid]||{};
  const info=d._info||{};
  const room=info.room||rooms.find(r=>r.id===parseInt(rid))||{type:'部屋'};
  document.getElementById('cm-room-title').textContent=`📝 ${room.type} メモ`;
  document.getElementById('cm-assignee').value=d.assignedTo||'';
  document.getElementById('cm-memo').value=d.memo||'';
  document.getElementById('cleaning-memo-modal').classList.add('open');
}

function saveCleaningMemo(){
  if(editingCleaningRoomId===null)return;
  const d=cleaningData[editingCleaningRoomId]||{};
  d.assignedTo=document.getElementById('cm-assignee').value.trim();
  d.memo=document.getElementById('cm-memo').value.trim();
  cleaningData[editingCleaningRoomId]=d;
  closeM('cleaning-memo-modal');
  renderCleaning();autoSave();
}

// LINE共有メッセージ生成
function copyLineMessage(){
  // cleaningDataから施設別・種別別に整理
  const co={};   // チェックアウト  {group: [{room, info, cleaningEntry}]}
  const stay={}; // 連泊

  Object.entries(cleaningData).forEach(([rid,d])=>{
    const info=d._info||{};
    const room=info.room||rooms.find(r=>r.id===parseInt(rid))||null;
    if(!room)return;
    const grp=room.group||'';
    const type=info.type||'checkout';
    const target=type==='stayover'?stay:co;
    if(!target[grp])target[grp]=[];
    target[grp].push({room,info,d});
  });

  // 部屋ラベル取得（ドミはベッド文字、個室は①②）
  const roomShort=(room)=>{
    const t=room.type||'';
    // ドミトリー：末尾のアルファベットを返す
    const dm=t.match(/[A-Z]$/);
    if(dm)return dm[0];
    // 個室①②
    const lbl=room.label||'';
    if(lbl.includes('①'))return '①';
    if(lbl.includes('②'))return '②';
    // アパートメント・SB：部屋番号
    const num=t.match(/\d+$/);
    if(num)return num[0];
    return t;
  };

  // 施設グループ定義（固定順）
  const FACILITIES=[
    {
      label:'本館',
      groups:['本館−個室','本館−男女混合ドミトリー'],
    },
    {
      label:'ANNEX',
      groups:['ANNEX−個室','ANNEX−ドミトリー'],
    },
    {
      label:'アパートメント',
      groups:['アパートメント−Southern Court'],
    },
    {
      label:'SB鎌倉',
      groups:['Sea Breeze 鎌倉'],
    },
    {
      label:'SB三浦',
      groups:['Sea Breeze 三浦'],
    },
    {
      label:'腰越',
      groups:[],  // 現在未使用
    },
  ];

  let msg='おはようございます。\n本日の清掃業務です。\n';

  FACILITIES.forEach(fac=>{
    // CO部屋を収集
    const coRooms=[];
    const stayRooms=[];

    fac.groups.forEach(grp=>{
      (co[grp]||[]).forEach(e=>coRooms.push(e));
      (stay[grp]||[]).forEach(e=>stayRooms.push(e));
    });

    msg+=`\n【${fac.label}】`;

    if(coRooms.length===0&&stayRooms.length===0){
      msg+='なし';
    } else {
      msg+='\n';
      // 個室・ドミ別に分ける
      const indiv=coRooms.filter(e=>
        e.room.group==='本館−個室'||e.room.group==='ANNEX−個室'
      );
      const dorm=coRooms.filter(e=>
        e.room.group==='本館−男女混合ドミトリー'||e.room.group==='ANNEX−ドミトリー'
      );
      const other=coRooms.filter(e=>
        !indiv.includes(e)&&!dorm.includes(e)
      );

      // 個室
      if(indiv.length>0){
        indiv.forEach(e=>{
          const short=roomShort(e.room);
          let line=`・個室${short}`;
          // 次予約あり（個室のみ表示）
          if(e.info.hasNextBooking&&e.info.nextGuest){
            line+=` 次予約あり${guestCountOf(e.info.nextGuest)}名`;
          }
          msg+=line+'\n';
        });
      }

      // ドミトリー：まとめて1行
      if(dorm.length>0){
        const letters=dorm.map(e=>roomShort(e.room)).join('');
        // ドミは次予約表示なし（仕様通り）
        msg+=`・ドミ ${letters}\n`;
      }

      // アパートメント・SBなどその他
      other.forEach(e=>{
        const num=roomShort(e.room);
        let line=`・${num}`;
        const guests=guestCountOf(e.info.guest);
        if(guests>0)line+=` ${guests}名分`;
        if(e.info.hasNextBooking&&e.info.nextGuest){
          line+=` 次予約あり${guestCountOf(e.info.nextGuest)}名`;
        }
        msg+=line+'\n';
      });

      // 連泊
      if(stayRooms.length>0){
        const letters=stayRooms.map(e=>roomShort(e.room)).join('');
        // ドミ系はアルファベット、個室は①②
        msg+=`連泊：${letters}\n`;
      }
    }
  });

  msg+='\n【ゴミ回収】なし';
  msg+='\n【その他】';
  msg+='\n☔湿気の出る季節のなってまいりましたので、例年通りカビ対策のため清掃時に下記対応の程お願いします。';
  msg+='\n・本館地下 エアコンの除湿設定 60';
  msg+='\n・本館地下ラウンジの倉庫の扉開放及びソファーマットの立ち上げ。';
  msg+='\n清掃完了後にご一報よろしくお願い致します😊';
  msg+='\n今日もよろしくお願い致します🙇';

  navigator.clipboard.writeText(msg).then(()=>showToast('✅ LINEメッセージをコピーしました'))
    .catch(()=>{
      const ta=document.createElement('textarea');
      ta.value=msg;document.body.appendChild(ta);ta.select();
      document.execCommand('copy');document.body.removeChild(ta);
      showToast('✅ コピーしました');
    });
}



function toggleSB(){sbOpen=!sbOpen;document.getElementById('sb').classList.toggle('open',sbOpen);}
function toggleMobileStats(){
  const area=document.getElementById('mobile-stats-area');
  const icon=document.getElementById('mobile-stats-icon');
  const open=area.classList.toggle('open');
  icon.textContent=open?'▲':'▼';
}
// ── 自動部屋割り優先順位マスター ──
// { roomId: priority(number) }  初期値は全1
let roomPriorityMaster = {};
function loadRoomPriority(){
  try{
    const s=localStorage.getItem('hotel_roomPriority');
    if(s) roomPriorityMaster=JSON.parse(s);
  }catch(e){}
}
function saveRoomPriorityLS(){
  try{ localStorage.setItem('hotel_roomPriority',JSON.stringify(roomPriorityMaster)); }catch(e){}
}
function getRoomPriority(roomId){
  const v=roomPriorityMaster[roomId];
  return(v!=null&&!isNaN(Number(v)))?Number(v):1;
}

function toggleCleaningMenu(btn){
  const sub=document.getElementById('cleaning-submenu');
  const chev=btn.querySelector('.cleaning-chevron');
  const open=sub.style.display==='none';
  sub.style.display=open?'block':'none';
  if(chev)chev.style.transform=open?'rotate(0deg)':'rotate(-90deg)';
}
function togglePropertyMenu(btn){
  const sub=document.getElementById('property-submenu');
  const chev=btn.querySelector('.property-chevron');
  const open=sub.style.display==='none';
  sub.style.display=open?'block':'none';
  if(chev)chev.style.transform=open?'rotate(0deg)':'rotate(-90deg)';
}

function openPropertyModal(type){
  if(type==='tablet'){ openContractSettings(); return; }
  if(type==='email'){ openMailSettings(); return; }
  const labels={tablet:['📱','タブレット表示設定'],email:['✉','自動メール配信設定']};
  const [icon,label]=labels[type]||['⚙','設定'];
  document.getElementById('property-stub-content').textContent=icon;
  document.getElementById('property-stub-label').textContent=label;
  document.getElementById('property-stub-modal').classList.add('open');
}

// ── タブレット表示設定（部屋タイプ×言語）──────────────────────
// データ構造: propertySettings.tabletDisplaySettings = {
//   enabled, consentType,
//   roomTypes:{ <rtKey>:{ ja:{agreement,guide,video,link}, en:{}, zh:{}, ko:{} }, ... }
// }
// rtKey は MAIL_ROOM_TYPES（8種）と共通。lang は ja/en/zh/ko。
function _tdEmptyLang(){ return {agreement:'',guide:'',video:'',link:''}; }
function _tdEmptyRT(){ return {ja:_tdEmptyLang(),en:_tdEmptyLang(),zh:_tdEmptyLang(),ko:_tdEmptyLang()}; }
// roomSettings.languages のキー（zhは zh-CN）へ変換
function _tdRoomLangKey(l){ return l==='zh'?'zh-CN':l; }
// ── 部屋タイプ判定（一元化・レビュー#12）───────────────────────────────
// 判定ルールの権威ソースは GAS の ROOM_TYPE_RULES_。GAS応答(roomTypeRules)を優先し、
// 未取得/オフライン時のみ下記の DEFAULT_ROOM_TYPE_RULES（GASと同一内容）へフォールバックする。
// エバリュエータ自体は汎用でめったに変わらないため、仕様変更はGAS側1箇所の編集で全画面へ伝播する。
const DEFAULT_ROOM_TYPE_RULES={
  version:1,
  rules:[
    {groupStartsWith:'本館',groupContains:'個室',typeContains:'ツイン',key:'honkan_twin'},
    {groupStartsWith:'本館',groupContains:'個室',key:'honkan_double'},
    {groupEquals:'本館−男女混合ドミトリー',key:'honkan_dormitory'},
    {groupEquals:'ANNEX−個室',key:'annex_private'},
    {groupEquals:'ANNEX−ドミトリー',key:'annex_dormitory'},
    {groupEquals:'アパートメント−Southern Court',key:'apartment'},
    {groupEquals:'Sea Breeze 鎌倉',key:'sb_kamakura'},
    {groupEquals:'Sea Breeze 三浦',key:'sb_miura'},
    {groupStartsWith:'Sea Breeze',groupContains:'三浦',key:'sb_miura'},
    {groupStartsWith:'Sea Breeze',key:'sb_kamakura'},
    {groupStartsWith:'アパートメント',key:'apartment'},
    {groupStartsWith:'ANNEX',groupContains:'個室',key:'annex_private'},
    {groupStartsWith:'ANNEX',key:'annex_dormitory'},
    {groupStartsWith:'本館',key:'honkan_dormitory'}
  ],
  fallback:{honkan_double:['honkan_queen','honkan_private'],honkan_twin:['honkan_queen','honkan_private']}
};
let roomTypeRules=null; // GAS応答で配布される判定ルール（applyServerDataで格納）
// 汎用エバリュエータ（GAS _roomTypeKeyByRules_ と同一仕様）
function roomTypeKeyByRules(room,rules){
  if(!room)return null;
  const g=String(room.group||''), ty=String(room.type||'');
  const list=(rules&&rules.rules)||[];
  for(const r of list){
    if(r.groupEquals!=null && g!==r.groupEquals)continue;
    if(r.groupStartsWith!=null && g.indexOf(r.groupStartsWith)!==0)continue;
    if(r.groupContains!=null && g.indexOf(r.groupContains)<0)continue;
    if(r.typeContains!=null && ty.indexOf(r.typeContains)<0)continue;
    return r.key;
  }
  return null;
}
// ある部屋がどの部屋タイプキーに属するか（配布ルール優先・未取得時はデフォルト）
function _tdRoomTypeKeyOf(room){
  return roomTypeKeyByRules(room, roomTypeRules||DEFAULT_ROOM_TYPE_RULES);
}
// 指定部屋タイプに属する部屋一覧
function _tdRoomsOfType(rtKey){ return (rooms||[]).filter(r=>_tdRoomTypeKeyOf(r)===rtKey); }

// tabletDisplaySettings を用意し、無ければ既存データから移行
function _ensureTabletDisplay(){
  if(!propertySettings.tabletDisplaySettings){
    const ca=(propertySettings&&propertySettings.contractAgreement)||{};
    const caTexts=ca.texts||{};
    const tds={ enabled:!!ca.enabled, consentType:ca.consentType||'checkbox', roomTypes:{} };
    MAIL_ROOM_TYPES.forEach(rt=>{
      const bucket=_tdEmptyRT();
      const typeRooms=_tdRoomsOfType(rt.key);
      ['ja','en','zh','ko'].forEach(l=>{
        // ① 宿泊約款：旧構造は言語別グローバル → 全部屋タイプへ複製
        bucket[l].agreement=caTexts[l]||'';
        // ② 施設案内：この部屋タイプの部屋のうち guideText が入力済みの最初の部屋を採用
        const rlk=_tdRoomLangKey(l);
        for(const r of typeRooms){
          const s=roomSettings[r.id]; const gt=s&&s.languages&&s.languages[rlk]&&s.languages[rlk].guideText;
          if(gt&&String(gt).trim()){ bucket[l].guide=gt; break; }
        }
        // ③④ 動画/外部リンク：media（言語非依存）の入力済み最初の部屋から。1件目=動画,2件目=外部リンク
        for(const r of typeRooms){
          const s=roomSettings[r.id];
          if(s&&Array.isArray(s.media)&&s.media.length){
            if(!bucket[l].video && s.media[0]&&s.media[0].url) bucket[l].video=s.media[0].url;
            if(!bucket[l].link && s.media[1]&&s.media[1].url) bucket[l].link=s.media[1].url;
            if(bucket[l].video) break;
          }
        }
      });
      tds.roomTypes[rt.key]=bucket;
    });
    propertySettings.tabletDisplaySettings=tds;
  }
  // 欠けている部屋タイプ・言語キーを補完（後方互換）
  const tds=propertySettings.tabletDisplaySettings;
  if(!tds.roomTypes)tds.roomTypes={};
  MAIL_ROOM_TYPES.forEach(rt=>{
    if(!tds.roomTypes[rt.key])tds.roomTypes[rt.key]=_tdEmptyRT();
    ['ja','en','zh','ko'].forEach(l=>{
      if(!tds.roomTypes[rt.key][l])tds.roomTypes[rt.key][l]=_tdEmptyLang();
      const o=tds.roomTypes[rt.key][l];
      ['agreement','guide','video','link'].forEach(f=>{ if(o[f]===undefined)o[f]=''; });
    });
  });
  return tds;
}

let _tdDraft=null, _tdCur={rt:'honkan_double', lang:'ja'};
function _tdCurTpl(){ return _tdDraft.roomTypes[_tdCur.rt][_tdCur.lang]; }
function _tdUpdateCurLabel(){
  const rtLbl=(MAIL_ROOM_TYPES.find(r=>r.key===_tdCur.rt)||{}).label||'';
  const langLbl={ja:'日本語',en:'英語',zh:'中国語',ko:'韓国語'}[_tdCur.lang];
  const el=document.getElementById('td-cur-label'); if(el)el.textContent=rtLbl+' × '+langLbl;
}
function _tdCommitInputs(){
  const t=_tdCurTpl();
  t.agreement=document.getElementById('td-agreement').value;
  t.guide=document.getElementById('td-guide').value;
  t.video=document.getElementById('td-video').value;
  t.link=document.getElementById('td-link').value;
}
function tdOnInput(){ _tdCommitInputs(); }
function tdRenderRTabs(){
  const el=document.getElementById('td-rtabs');
  if(el)el.innerHTML=MAIL_ROOM_TYPES.map(rt=>
    `<button type="button" class="ms-ltab ${rt.key===_tdCur.rt?'active':''}" onclick="tdSelectRoomType('${rt.key}')">${rt.label}</button>`).join('');
}
function tdRenderFields(){
  const t=_tdCurTpl();
  document.getElementById('td-agreement').value=t.agreement||'';
  document.getElementById('td-guide').value=t.guide||'';
  document.getElementById('td-video').value=t.video||'';
  document.getElementById('td-link').value=t.link||'';
  _tdUpdateCurLabel();
}
function tdSelectRoomType(rt){ _tdCommitInputs(); _tdCur.rt=rt; tdRenderRTabs(); tdRenderFields(); }
function tdSwitchLang(l){
  _tdCommitInputs(); _tdCur.lang=l;
  document.querySelectorAll('#contract-settings-modal .ca-tab').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
  tdRenderFields();
}
function openContractSettings(){
  const tds=_ensureTabletDisplay();
  _tdDraft=JSON.parse(JSON.stringify(tds));
  _tdCur={rt:'honkan_double', lang:'ja'};
  document.getElementById('ca-enabled').checked=!!_tdDraft.enabled;
  document.getElementById('ca-consent-type').value=_tdDraft.consentType||'checkbox';
  document.querySelectorAll('#contract-settings-modal .ca-tab').forEach(b=>b.classList.toggle('active',b.dataset.lang==='ja'));
  tdRenderRTabs();
  tdRenderFields();
  document.getElementById('contract-settings-modal').classList.add('open');
}
function saveTabletSettings(){
  _tdCommitInputs();
  _tdDraft.enabled=document.getElementById('ca-enabled').checked;
  _tdDraft.consentType=document.getElementById('ca-consent-type').value;
  propertySettings.tabletDisplaySettings=_tdDraft;
  // 旧 contractAgreement も同期（後方互換：旧チェックインアプリ/旧GAS参照時のフォールバック用に日本語ダブルの約款を代表値として保持）
  const rep=_tdDraft.roomTypes.honkan_double||{};
  propertySettings.contractAgreement={
    enabled:_tdDraft.enabled, consentType:_tdDraft.consentType,
    texts:{ ja:(rep.ja&&rep.ja.agreement)||'', en:(rep.en&&rep.en.agreement)||'', zh:(rep.zh&&rep.zh.agreement)||'', ko:(rep.ko&&rep.ko.agreement)||'' }
  };
  closeM('contract-settings-modal');
  cloudSave();
  showToast('📱 タブレット表示設定を保存しました');
}

// ══════════════════════════════════════════════════════════
//  自動メール配信設定
// ══════════════════════════════════════════════════════════
const MAIL_TYPES=[
  {key:'reservationCreated', label:'予約確定時'},
  {key:'checkinCode',        label:'QR・予約ID送信', code:true},
  {key:'checkin',            label:'チェックイン時'},
  {key:'checkout',           label:'チェックアウト時'},
];
// 差し込みキーワード（送信時にGAS側で実値へ置換する想定のトークン）
const MAIL_KEYWORDS=['氏名','予約ID','物件名','玄関暗証番号','住所','電話番号','WiFiSSID','WiFiパスワード','チェックイン案内URL','チェックイン日','チェックアウト日','部屋タイプ名','部屋番号','部屋暗証番号','備考1','備考2','備考3','入室案内'];
const MAIL_ATTACH_MAX=5*1024*1024; // 1ファイル5MB
// 部屋タイプ（メールテンプレート管理単位）。groupは rooms[].group と対応（GAS側の判定と共通）
const MAIL_ROOM_TYPES=[
  {key:'honkan_double',    label:'本館 ダブル',      group:'本館−個室'},
  {key:'honkan_twin',      label:'本館 ツイン',      group:'本館−個室'},
  {key:'honkan_dormitory', label:'本館 ドミトリー',   group:'本館−男女混合ドミトリー'},
  {key:'annex_private',    label:'ANNEX 個室',       group:'ANNEX−個室'},
  {key:'annex_dormitory',  label:'ANNEX ドミトリー',  group:'ANNEX−ドミトリー'},
  {key:'apartment',        label:'アパートメント',    group:'アパートメント−Southern Court'},
  {key:'sb_kamakura',      label:'SB 鎌倉',          group:'Sea Breeze 鎌倉'},
  {key:'sb_miura',         label:'SB 三浦',          group:'Sea Breeze 三浦'},
];
let _mailDraft=null, _mailCur={type:'reservationCreated', rt:'honkan_double', lang:'ja'};

function _msEmptyTpl(){ return {subject:{ja:'',en:'',zh:'',ko:''}, body:{ja:'',en:'',zh:'',ko:''}, attachments:{ja:[],en:[],zh:[],ko:[]}}; }
function _msEnsureCfg(key){
  if(!propertySettings.mailSettings)propertySettings.mailSettings={};
  if(!_mailDraft[key])_mailDraft[key]=_defaultMailCfg(key==='checkinCode'?{qr:false,sendDaysBefore:3,sendTime:'09:00',resend:false}:undefined);
  const c=_mailDraft[key];
  c.subject=c.subject||{ja:'',en:'',zh:'',ko:''};
  c.body=c.body||{ja:'',en:'',zh:'',ko:''};
  c.attachments=c.attachments||{ja:[],en:[],zh:[],ko:[]};
  ['ja','en','zh','ko'].forEach(l=>{ if(!Array.isArray(c.attachments[l]))c.attachments[l]=[]; });
  // ── マイグレーション：部屋タイプ階層が無ければ、既存の言語別テンプレートを全部屋タイプへコピー ──
  if(!c.roomTypes){
    c.roomTypes={};
    MAIL_ROOM_TYPES.forEach(rt=>{
      c.roomTypes[rt.key]=JSON.parse(JSON.stringify({subject:c.subject, body:c.body, attachments:c.attachments}));
    });
  }
  // 本館個室を「ダブル/ツイン」に分割した際の移行：旧テンプレートの内容を両方へ引き継ぐ
  // （空テンプレートで上書きされる前に実行。旧キーは残置＝旧GAS互換）
  // 引き継ぎ元の優先順位：honkan_queen（前回分割時の暫定キー）→ honkan_private（分割前）
  if(c.roomTypes){
    var _hkSrc=c.roomTypes.honkan_queen||c.roomTypes.honkan_private;
    if(_hkSrc){
      if(!c.roomTypes.honkan_double)c.roomTypes.honkan_double=JSON.parse(JSON.stringify(_hkSrc));
      if(!c.roomTypes.honkan_twin)c.roomTypes.honkan_twin=JSON.parse(JSON.stringify(c.roomTypes.honkan_private||_hkSrc));
    }
  }
  // 欠けている部屋タイプ・言語キーを補完（後方互換）
  MAIL_ROOM_TYPES.forEach(rt=>{
    if(!c.roomTypes[rt.key])c.roomTypes[rt.key]=_msEmptyTpl();
    const t=c.roomTypes[rt.key];
    t.subject=t.subject||{}; t.body=t.body||{}; t.attachments=t.attachments||{};
    ['ja','en','zh','ko'].forEach(l=>{
      if(t.subject[l]===undefined)t.subject[l]='';
      if(t.body[l]===undefined)t.body[l]='';
      if(!Array.isArray(t.attachments[l]))t.attachments[l]=[];
    });
  });
  return c;
}
// 現在選択中（送信タイミング×部屋タイプ）のテンプレートを取得
function _msCurTpl(){ return _msEnsureCfg(_mailCur.type).roomTypes[_mailCur.rt]; }

function openMailSettings(){
  // 作業用にディープコピー（保存ボタンまで本体へ反映しない）
  _mailDraft=JSON.parse(JSON.stringify(propertySettings.mailSettings||{}));
  MAIL_TYPES.forEach(m=>_msEnsureCfg(m.key));
  // 拡大表示状態を毎回リセット
  _msExpanded=false;
  const _box=document.getElementById('mail-settings-modal-box');
  if(_box){_box.style.setProperty('width','760px','important');_box.style.setProperty('max-width','96vw','important');}
  const _ta=document.getElementById('ms-body');
  if(_ta){_ta.style.height='';_ta.rows=11;}
  const _btn=document.getElementById('ms-expand-btn');
  if(_btn)_btn.textContent='🔍 拡大表示';
  _mailCur={type:'reservationCreated', rt:'honkan_double', lang:'ja'};
  // 送信時間の選択肢（00:00〜23:30, 30分刻み）
  const tsel=document.getElementById('ms-time');
  if(tsel && !tsel.options.length){
    let opt='';
    for(let h=0;h<24;h++)for(let m=0;m<60;m+=30){ const v=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); opt+=`<option value="${v}">${v}</option>`; }
    tsel.innerHTML=opt;
  }
  // キーワードボタン
  document.getElementById('ms-keywords').innerHTML=MAIL_KEYWORDS.map(k=>`<button type="button" class="ms-kw" onclick="msInsertKeyword('${k}')">${k}</button>`).join('');
  msRenderMTabs();
  msRenderCurrent();
  // ドラッグ＆ドロップ（一度だけバインド）
  const dz=document.getElementById('ms-dropzone');
  if(dz && !dz._dnd){
    dz._dnd=true;
    dz.addEventListener('dragover', e=>{ e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', ()=>dz.classList.remove('drag'));
    dz.addEventListener('drop', e=>{ e.preventDefault(); dz.classList.remove('drag'); if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length)msAddFiles(e.dataTransfer.files); });
  }
  document.getElementById('ms-upload-note').textContent='';
  document.getElementById('mail-settings-modal').classList.add('open');
}

function msRenderMTabs(){
  document.getElementById('ms-mtabs').innerHTML=MAIL_TYPES.map(m=>
    `<button type="button" class="ms-mtab ${m.key===_mailCur.type?'active':''}" onclick="msSelectType('${m.key}')">${m.label}</button>`).join('');
  msRenderRTabs();
}
function msRenderRTabs(){
  const el=document.getElementById('ms-rtabs');
  if(el)el.innerHTML=MAIL_ROOM_TYPES.map(rt=>
    `<button type="button" class="ms-ltab ${rt.key===_mailCur.rt?'active':''}" onclick="msSelectRoomType('${rt.key}')">${rt.label}</button>`).join('');
}
function msSelectType(key){ _msCommitInputs(); _mailCur.type=key; msRenderMTabs(); msRenderCurrent(); }
function msSelectRoomType(rt){ _msCommitInputs(); _mailCur.rt=rt; msRenderRTabs(); msRenderLangPart(); }
function msSwitchLang(l){
  _msCommitInputs(); _mailCur.lang=l;
  document.querySelectorAll('#mail-settings-modal .ms-ltab[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
  msRenderLangPart();
}

// 現在編集中の件名・本文をドラフトへ退避（送信タイミング×部屋タイプ×言語）
function _msCommitInputs(){
  const t=_msCurTpl();
  t.subject[_mailCur.lang]=document.getElementById('ms-subject').value;
  t.body[_mailCur.lang]=document.getElementById('ms-body').value;
}
function msOnInput(){ _msCommitInputs(); }

// 本文編集エリアの拡大表示トグル（モーダル自体を大きくして本文欄の高さも広げる）
let _msExpanded=false;
function msToggleExpand(){
  _msExpanded=!_msExpanded;
  const box=document.getElementById('mail-settings-modal-box');
  const ta=document.getElementById('ms-body');
  const btn=document.getElementById('ms-expand-btn');
  // 基本CSSの .modal{width:400px!important} を上書きするため setProperty(...,'important') を使用
  if(_msExpanded){
    box.style.setProperty('width','96vw','important');
    box.style.setProperty('max-width','96vw','important');
    ta.style.height='64vh';
    ta.rows=undefined;
    btn.textContent='🔎 縮小表示';
  } else {
    box.style.setProperty('width','760px','important');
    box.style.setProperty('max-width','96vw','important');
    ta.style.height='';
    ta.rows=11;
    btn.textContent='🔍 拡大表示';
  }
}

function msRenderCurrent(){
  const c=_msEnsureCfg(_mailCur.type);
  document.getElementById('ms-enabled').checked=!!c.enabled;
  // チェックインコード専用UI
  const isCode=_mailCur.type==='checkinCode';
  document.getElementById('ms-checkincode-extra').style.display=isCode?'':'none';
  if(isCode){
    document.getElementById('ms-days').value=String(c.sendDaysBefore||3);
    document.getElementById('ms-time').value=c.sendTime||'09:00';
    document.getElementById('ms-qr').value=c.qr?'1':'0';
    document.getElementById('ms-resend').checked=!!c.resend;
  }
  msRenderLangPart();
}
function msRenderLangPart(){
  const t=_msCurTpl(), l=_mailCur.lang;
  document.getElementById('ms-subject').value=(t.subject&&t.subject[l])||'';
  document.getElementById('ms-body').value=(t.body&&t.body[l])||'';
  const langLbl={ja:'日本語',en:'英語',zh:'中国語',ko:'韓国語'}[l];
  const rtLbl=(MAIL_ROOM_TYPES.find(r=>r.key===_mailCur.rt)||{}).label||'';
  document.getElementById('ms-att-lang').textContent=rtLbl+'・'+langLbl;
  msRenderAttachments();
}
function msOnEnabledChange(){ _msEnsureCfg(_mailCur.type).enabled=document.getElementById('ms-enabled').checked; }

// 本文のカーソル位置に [キーワード] を挿入
function msInsertKeyword(kw){
  const ta=document.getElementById('ms-body');
  const token='['+kw+']';
  const s=ta.selectionStart||0, e=ta.selectionEnd||0;
  ta.value=ta.value.slice(0,s)+token+ta.value.slice(e);
  ta.focus(); ta.selectionStart=ta.selectionEnd=s+token.length;
  _msCommitInputs();
}

function msRenderAttachments(){
  const t=_msCurTpl(), l=_mailCur.lang;
  const list=t.attachments[l]||[];
  document.getElementById('ms-attachments').innerHTML = list.length ? list.map((a,i)=>
    `<span class="ms-chip">
       ${i>0?`<span class="mv" title="前へ" onclick="msMoveAttachment(${i},-1)">◀</span>`:''}
       <span class="nm" title="${esc(a.name||'')}">📎 ${esc(a.name||a.id)}</span>
       ${i<list.length-1?`<span class="mv" title="後へ" onclick="msMoveAttachment(${i},1)">▶</span>`:''}
       <span class="x" title="削除" onclick="msRemoveAttachment(${i})">✕</span>
     </span>`).join('') : '<span style="font-size:11.5px;color:#aaa;">添付なし</span>';
}
function msRemoveAttachment(i){
  const t=_msCurTpl(), l=_mailCur.lang;
  t.attachments[l].splice(i,1); msRenderAttachments();
}
function msMoveAttachment(i,dir){
  const t=_msCurTpl(), l=_mailCur.lang, arr=t.attachments[l];
  const j=i+dir; if(j<0||j>=arr.length)return;
  [arr[i],arr[j]]=[arr[j],arr[i]]; msRenderAttachments();
}

// ファイル追加：5MB検証 → Driveへアップロード（IDのみ保持）
async function msAddFiles(files){
  const note=document.getElementById('ms-upload-note');
  const t=_msCurTpl(), l=_mailCur.lang;
  for(const f of files){
    if(f.size>MAIL_ATTACH_MAX){ alert(`「${f.name}」は5MBを超えています（${(f.size/1024/1024).toFixed(1)}MB）。5MB以下のファイルを選択してください。`); continue; }
    note.textContent=`「${f.name}」をアップロード中…`;
    try{
      const res=await uploadAttachmentToDrive(f);
      if(res&&res.id){ t.attachments[l].push({id:res.id, name:res.name||f.name}); msRenderAttachments(); note.textContent=`「${f.name}」を保存しました`; }
      else { note.textContent=`「${f.name}」の保存に失敗しました（GAS未対応の可能性）`; }
    }catch(e){ console.error('添付アップロード失敗',e); note.textContent=`「${f.name}」の保存に失敗しました`; }
  }
  document.getElementById('ms-file-input').value='';
}

// Driveへアップロード（base64で送信→GASがファイル化しIDを返す。cloudDataにはIDのみ保持）
function uploadAttachmentToDrive(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const b64=String(reader.result).split(',')[1]||'';
        // Content-Typeヘッダは付けない（application/jsonだとCORSプリフライトでApps Scriptが失敗するため）
        const r=await fetch(_withKey(GAS_URL),{method:'POST',
          body:JSON.stringify({type:'uploadAttachment', name:file.name, mimeType:file.type||'application/octet-stream', dataBase64:b64})});
        const j=await r.json();
        if(j&&j.id)resolve(j); else reject(new Error(j&&j.error||'no id'));
      }catch(e){ reject(e); }
    };
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function saveMailSettings(){
  _msCommitInputs();
  // チェックインコード送信の付加設定を反映
  const code=_msEnsureCfg('checkinCode');
  code.sendDaysBefore=parseInt(document.getElementById('ms-days').value)||3;
  code.sendTime=document.getElementById('ms-time').value||'09:00';
  code.qr=document.getElementById('ms-qr').value==='1';
  code.resend=document.getElementById('ms-resend').checked;
  // 本体へ反映してクラウド保存（cloudSaveのみ）
  propertySettings.mailSettings=_mailDraft;
  closeM('mail-settings-modal');
  cloudSave();
  showToast('✉ 自動メール配信設定を保存しました');
}

function openAutoAssignModal(){
  const groups={};
  rooms.forEach(r=>{
    if(!groups[r.group])groups[r.group]=[];
    groups[r.group].push(r);
  });
  const maxPri=rooms.length;
  let html='';
  Object.entries(groups).forEach(([grpName,grpRooms])=>{
    html+=`<div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:.05em;border-bottom:1px solid var(--sand-border);padding-bottom:4px;margin-bottom:8px;">${grpName}</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="font-size:11px;color:#aaa;">
          <th style="text-align:left;padding:4px 8px;font-weight:600;">部屋名</th>
          <th style="text-align:center;padding:4px 8px;font-weight:600;width:60px;">定員</th>
          <th style="text-align:center;padding:4px 8px;font-weight:600;width:100px;">優先順位</th>
        </tr></thead><tbody>`;
    grpRooms.forEach(r=>{
      const pri=getRoomPriority(r.id);
      html+=`<tr style="border-bottom:1px solid #f5f3ef;">
        <td style="padding:7px 8px;font-size:13px;">${r.type.replace(r.group+'−','').replace(r.group+'　','')}</td>
        <td style="text-align:center;padding:7px 8px;font-size:12px;color:#888;">${r.cap}名</td>
        <td style="text-align:center;padding:7px 8px;">
          <select data-room-id="${r.id}" style="padding:4px 6px;border:1px solid var(--sand-border);border-radius:6px;font-size:13px;width:64px;">
            ${Array.from({length:maxPri},(_,i)=>`<option value="${i+1}"${pri===i+1?' selected':''}>${i+1}</option>`).join('')}
          </select>
          <span style="font-size:11px;color:#aaa;margin-left:2px;">位</span>
        </td>
      </tr>`;
    });
    html+='</tbody></table></div>';
  });
  document.getElementById('auto-assign-body').innerHTML=html;
  document.getElementById('auto-assign-modal').classList.add('open');
}

function saveAutoAssignPriority(){
  document.querySelectorAll('#auto-assign-body select[data-room-id]').forEach(sel=>{
    roomPriorityMaster[Number(sel.dataset.roomId)]=Number(sel.value);
  });
  saveRoomPriorityLS();
  closeM('auto-assign-modal');
  cloudSave(); // TODO保存と同じ共通クラウド保存経路を使用
  showToast('🔀 自動部屋割り優先順位を保存しました');
}

// ── スクロール制御フラグ ──────────────────────────────
// true = 初回起動・「今日」ボタン・月変更時のみ今日へスクロール
let _regInitialLoad = true;
function _updateMonthDisplay(){
  const y=parseInt(document.getElementById('sel-year').value);
  const m=parseInt(document.getElementById('sel-month').value);
  const md=document.getElementById('month-display');
  if(md)md.textContent=`${y}年 ${m}月`;
}

function stepMonth(dir){
  const selY=document.getElementById('sel-year');
  const selM=document.getElementById('sel-month');
  let y=parseInt(selY.value), m=parseInt(selM.value);
  m+=dir;
  if(m<1){m=12;y--;}
  else if(m>12){m=1;y++;}
  // 年のoption追加（必要なら）
  if(!Array.from(selY.options).some(o=>parseInt(o.value)===y)){
    const opt=document.createElement('option');
    opt.value=opt.textContent=String(y);
    if(y<parseInt(selY.options[0].value))selY.prepend(opt);
    else selY.append(opt);
  }
  selY.value=String(y);
  selM.value=String(m);
  // 月変更時は常にスクロールリセット（当月なら今日、過去/未来なら月初）
  window._regScrollToToday=true;
  _updateMonthDisplay();
  renderReg();
}

function goToday(){
  const now=new Date();
  const selY=document.getElementById('sel-year');
  const selM=document.getElementById('sel-month');
  selY.value=String(now.getFullYear());
  selM.value=String(now.getMonth()+1);
  window._regScrollToToday=true;
  _updateMonthDisplay();
  renderReg();
}

function _saveRegScroll(){
  try{
    const scEl=document.getElementById('reg-scroll');
    const regPage=document.getElementById('page-register');
    const selY=document.getElementById('sel-year');
    const selM=document.getElementById('sel-month');
    if(!scEl)return;
    localStorage.setItem('hotel_regScroll',JSON.stringify({
      scrollLeft:scEl.scrollLeft,
      scrollTop:regPage?regPage.scrollTop:0,
      currentYear:selY?parseInt(selY.value):new Date().getFullYear(),
      currentMonth:selM?parseInt(selM.value):new Date().getMonth()+1
    }));
  }catch(e){}
}

function showP(n,el){
  // サイドバーからの画面遷移時は、開いている全てのモーダル（予約詳細・部屋詳細・各種編集ポップアップ等）を必ず閉じる
  // （予約内容保存・ステータス変更・メモ編集・QR表示・メール送信などモーダル内操作はshowPを呼ばないため対象外）
  document.querySelectorAll('.mbg.open').forEach(m=>m.classList.remove('open'));
  // 名簿から離れる直前にスクロール位置を保存
  const activePage=document.querySelector('.page.active');
  if(activePage&&activePage.id==='page-register'&&n!=='register'){
    _saveRegScroll();
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nitem').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+n).classList.add('active');if(el)el.classList.add('active');
  if(n==='rooms')renderRooms();if(n==='todo'){generateDueReminders();renderStaffNotes();renderRankAPanel();}
  if(n==='occupancy')renderOcc();if(n==='cancel')renderCancel();if(n==='surf')renderSurf();
  if(n==='parking')renderParking();if(n==='sales')renderSales();
  if(n==='rental')renderRental();
  if(n==='cleaning'){
    generateCleaningList();
    // 清掃管理サブメニューを開く
    const cs=document.getElementById('cleaning-submenu');
    if(cs)cs.style.display='block';
    const cc=document.querySelector('#cleaning-menu-btn .cleaning-chevron');
    if(cc)cc.style.transform='rotate(0deg)';
  }
  if(n==='cleaning-focus'){
    const cs=document.getElementById('cleaning-submenu');
    if(cs)cs.style.display='block';
    const cc=document.querySelector('#cleaning-menu-btn .cleaning-chevron');
    if(cc)cc.style.transform='rotate(0deg)';
    if(typeof renderPriorityCleaning==='function')renderPriorityCleaning();
  }
  if(n==='property-info'){
    document.getElementById('property-room-count').textContent=rooms.length+'部屋';
    // 物件管理サブメニューを開く
    const sub=document.getElementById('property-submenu');
    if(sub)sub.style.display='block';
  }
}
function findN(rid,sd,m){
  const g0=guestData[gk(m,rid,sd)];if(!g0)return 1;
  let n=1,days=gDays(DISP_YEAR,m);
  for(let d=sd+1;d<=days;d++){
    const g=guestData[gk(m,rid,d)];
    if(g&&g.cont&&!g.charterAnchor&&g.name===g0.name)n++;
    else break;
  }
  return n;
}

// 月跨ぎ対応：全泊分のキーを返す（最大180泊まで）
function findAllKeys(rid,startM,startD){
  const g0=guestData[gk(startM,rid,startD)];if(!g0)return [{m:startM,d:startD,k:gk(startM,rid,startD)}];
  const keys=[{m:startM,d:startD,k:gk(startM,rid,startD)}];
  let m=startM,d=startD,y=DISP_YEAR;
  for(let i=0;i<180;i++){
    const {y:ny,m:nm,d:nd}=addDays(m,d,1,y);
    const k=gk(nm,rid,nd,ny);
    const g=guestData[k];
    if(g&&g.cont&&!g.charterAnchor&&g.name===g0.name){
      keys.push({m:nm,d:nd,k});
      m=nm;d=nd;y=ny;
    } else break;
  }
  return keys;
}
function closeM(id){document.getElementById(id).classList.remove('open');}

// populate nationality select
function populateNat(selId, selected){
  const sel=document.getElementById(selId);
  sel.innerHTML=NATIONALITIES.map(n=>`<option value="${n}"${n===selected?' selected':''}>${n}</option>`).join('');
}

// ============================================================
// INIT
// ============================================================
function initData(){
  // rooms を localStorage から復元（GAS未接続時のフォールバック）
  try{
    const savedRooms=localStorage.getItem('hotel_rooms');
    if(savedRooms){
      const parsed=JSON.parse(savedRooms);
      if(Array.isArray(parsed)&&parsed.length>0){
        rooms=parsed;
        rooms.forEach(r=>{r.no=String(r.no??'');});
        nextRoomId=Math.max(...rooms.map(r=>r.id||0))+1;
      }
    }
  }catch(e){}
  // サンプル宿泊データは削除済み（GASクラウドからロード）
  // staffNotesが空の場合のみ初期サンプルを設定
  if(staffNotes.length===0){
    staffNotes=[
      {id:nextSnId++,type:'指示',  rank:'A',author:'オーナー', title:'ANNEX個室① 雨漏り確認', detail:'写真撮影のうえ修繕業者（山田工務店 090-XXXX）に連絡。日程調整して報告してください。', done:false, created:'5/14 09:00'},
      {id:nextSnId++,type:'引継ぎ',rank:'B',author:'スタッフA', title:'杉本様 22時到着・えのすぱ対応', detail:'鍵をフロントに預けておく。到着時にえのすぱ入場券を渡すこと。', done:false, created:'5/14 11:30'},
      {id:nextSnId++,type:'引継ぎ',rank:'B',author:'スタッフA', title:'103号室ドア鍵が固め', detail:'チェックイン時に一言添えて案内。直し方：ドアを手前に引きながら回す。', done:true,  created:'5/14 10:15'},
      {id:nextSnId++,type:'メモ',  rank:'C',author:'スタッフB', title:'Wi-Fiルーター再起動済み', detail:'フロント裏。問題あればもう一度再起動で直ります。', done:false, created:'5/13 18:00'},
    ];
  }
}

// ============================================================
// AUTO PARK / SURF
// ============================================================
function addAutoPark(g,month,year){
  year=(year==null?DISP_YEAR:year);
  const nights=findN(g.roomId,g.day,month);
  for(let n=0;n<nights;n++){
    const d=g.day+n;
    const dk=dateKey(year,month,d);
    const price=parkPrice(year,month,d);
    const pk=parkData[dk]||[];
    if(!pk.some(e=>e.name===g.name&&e.type==='park-auto')){
      pk.push({id:nextParkId++,name:g.name,price,note:'宿泊者（自動）',type:'park-auto'});
      parkData[dk]=pk;
    }
  }
}

function addAutoSurf(g,month,year){
  year=(year==null?DISP_YEAR:year);
  if(!surfList.some(s=>s.name===g.name&&(s.auto||s.guestLinked))){
    const d=g.day;
    const dk=`${year}/${String(month).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
    surfList.unshift({name:g.name,site:g.site,price:0,nat:g.nat||'',sex:g.sex||'男',cat:g.cat||'Ｓ',surfday:'',shop:'ミスティ',contact:'',payment:'',note:'宿泊名簿から自動追加',date:dk,auto:true,guestLinked:true});
  }
}

// 駐車場チェックOFF時：該当予約者の自動登録分を削除
function removeAutoPark(g,month,year){
  year=(year==null?DISP_YEAR:year);
  const nights=findN(g.roomId,g.day,month);
  for(let n=0;n<nights;n++){
    const d=g.day+n;
    const dk=dateKey(year,month,d);
    if(parkData[dk]){
      parkData[dk]=parkData[dk].filter(e=>!(e.name===g.name&&e.type==='park-auto'));
      if(parkData[dk].length===0)delete parkData[dk];
    }
  }
}

// サーフィンチェックOFF時：同名エントリを削除（autoフラグに関係なく）
function removeAutoSurf(g){
  // guestLinked フラグがあるもの、またはauto:trueのものを削除
  // サーフィンリスト側で編集されていても氏名+宿泊名簿連携フラグで判定
  surfList=surfList.filter(s=>!(s.name===g.name&&(s.auto||s.guestLinked)));
}

// ============================================================
// REGISTER
// ============================================================
function toggleFilterPanel(e){
  e.stopPropagation();
  const p=document.getElementById('filter-panel');
  const open=p.style.display==='none';
  p.style.display=open?'block':'none';
  if(open){
    const close=ev=>{if(!p.contains(ev.target)){p.style.display='none';document.removeEventListener('click',close);}};
    setTimeout(()=>document.addEventListener('click',close),0);
  }
}
function renderFilterUI(){
  const wrap=document.getElementById('filter-checks');if(!wrap)return;
  wrap.innerHTML=FILTER_GROUPS.map(g=>`
    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;white-space:nowrap;">
      <input type="checkbox" ${roomFilter[g.key]?'checked':''} onchange="onFilterChange('${g.key}',this.checked)" style="width:13px;height:13px;cursor:pointer;">
      ${g.label}
    </label>`).join('');
}
function onFilterChange(key,checked){
  roomFilter[key]=checked;
  saveToLS();
  renderReg();
  // 稼働率ページが表示中なら、分母（対象部屋の定員合計）も即時再計算して反映
  if(document.getElementById('page-occupancy')?.classList.contains('active'))renderOcc();
}
function setAllRoomFilter(val){
  FILTER_GROUPS.forEach(g=>roomFilter[g.key]=val);
  saveToLS();
  renderFilterUI();
  renderReg();
  if(document.getElementById('page-occupancy')?.classList.contains('active'))renderOcc();
}
// フィルタ済みのroom一覧を返す
function filteredRooms(){
  return rooms.filter(r=>roomFilter[r.group]!==false);
}
// 宿泊人数を堅牢に取得（チェックイン前=数値 / 後=guests配列 のどちらでも数値を返す）
// チェックインアプリは g.guests に宿泊者オブジェクト配列を保存するため、配列なら要素数を人数とする。
function guestCountOf(g){
  if(!g) return 1;
  if(Array.isArray(g.guests)) return g.guests.length || 1;
  return g.guests || g.guestCount || g.totalGuests || 1;
}

// 起動初期化中は再描画を抑制し、初期化完了時に1回だけ描画する（起動時の多重renderReg対策）
let _suppressRenderReg=false;
function renderReg(){
  if(_suppressRenderReg)return;
  const year=parseInt(document.getElementById('sel-year').value)||2026,month=parseInt(document.getElementById('sel-month').value),days=gDays(year,month);
  DISP_YEAR=year; // 以降のgk/addDaysが表示中の年を使うように同期
  // ── モバイル判定・セル幅計算 ──
  const _sw=Math.min(window.screen.width,window.screen.height);
  const isMob=_sw<=768;
  const isPhone=_sw<=480;
  const C1=isMob?24:60;  // グループ列幅(px)
  const C2=isMob?58:60;  // 部屋名列幅(px)
  // 列幅：PCは270px固定。スマホ/タブレットは「氏名が確実に表示される」幅を優先。
  //  - スマホ：1日をほぼ画面幅で表示（次の日が少しだけ覗くようpeek 28px）→ 氏名フル表示＆横スワイプで日送り
  //  - タブレット：2日表示だが各列を広め（最低210px確保）にして氏名を省略させない
  let DAY_W;
  if(!isMob){
    DAY_W=270;
  } else if(isPhone){
    DAY_W=Math.max(210, _sw-C1-C2-28);
  } else {
    DAY_W=Math.max(210, Math.floor((_sw-C1-C2-28)/2));
  }
  // ヘッダー：グループ縦結合列＋部屋名列＋日付列
  const _now=new Date(),_ty=_now.getFullYear(),_tm=_now.getMonth()+1,_td=_now.getDate();
  // ── colgroup：table-layout:fixedと併用し全列幅を明示固定（予約有無で幅がばらつくのを防止）──
  let html='<colgroup>';
  html+=`<col style="width:${C1}px">`;   // グループ列
  html+=`<col style="width:${C2}px">`;   // 部屋名列
  for(let d=1;d<=days;d++) html+=`<col style="width:${DAY_W}px">`; // 各日付列を均一幅に
  html+='</colgroup>';
  html+='<thead>';
  // 日付行（sticky top:0）
  html+='<tr>';
  // 左上コーナー：3分割ナビ（今日の日付／今日ボタン／月移動）を1セルに集約
  const cornerW=C1+C2;
  html+=`<th class="st" colspan="2" rowspan="2" style="width:${cornerW}px;min-width:${cornerW}px;max-width:${cornerW}px;padding:0;left:0;position:sticky;top:0;z-index:30;background:var(--white);">`
    +`<div class="cnav">`
      +`<div class="cnav-date">${_tm}/${_td}</div>`
      +`<button class="cnav-today" onclick="goToday()" title="今日の日付へ">今日</button>`
      +`<div class="cnav-month">`
        +`<button onclick="stepMonth(-1)" title="前の月">◀</button>`
        +`<span class="cnav-mlabel">${year===2026?`${month}月`:`${year}/${month}`}</span>`
        +`<button onclick="stepMonth(1)" title="次の月">▶</button>`
      +`</div>`
    +`</div>`
  +`</th>`;
  for(let d=1;d<=days;d++){
    const dow=gDow(year,month,d),hol=isHoliday(year,month,d);
    const rsCnt=rentalCountOnDate(year,month,d);
    const rentalBg=rsCnt>0?'background:#fff3e0;':'';
    const isToday=(year===_ty&&month===_tm&&d===_td);
    const todayId=isToday?' id="th-today"':'';
    const todayNumHtml=isToday
      ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#185FA5;color:#fff;border-radius:50%;font-size:12px;font-weight:700;line-height:1;">${d}</span>`
      : `${d}`;
    html+=`<th${todayId} style="width:${DAY_W}px;min-width:${DAY_W}px;border-top:${hol&&!isToday?'2px solid #c0392b':'none'};position:sticky;top:0;z-index:20;background:${isToday?'#ffedd5':'var(--white)'};${rentalBg}" onclick="${rsCnt>0?`showRentalDay(${year},${month},${d})`:''}">${todayNumHtml}${rsCnt>0?` <span style="display:inline-block;background:#e65100;color:#fff;font-size:13px;padding:1px 5px;border-radius:99px;font-weight:700;vertical-align:middle;line-height:1.5;">📷</span>`:''}</th>`;
  }
  html+=`</tr>`;
  // 曜日行（sticky top:日付行高さ分）
  html+=`<tr>`;
  for(let d=1;d<=days;d++){
    const dow=gDow(year,month,d),hol=isHoliday(year,month,d);
    const rsCnt2=rentalCountOnDate(year,month,d);
    const rentalBg2=rsCnt2>0?'background:#fff3e0;':'';
    const isToday2=(year===_ty&&month===_tm&&d===_td);
    html+=`<th style="font-size:10px;color:${isToday2?'#9a3412':dow===0||hol?'#c0392b':dow===6?'#2980b9':'#aaa'};font-weight:${isToday2?'700':'400'};position:sticky;top:var(--th-row1-h,32px);z-index:20;background:${isToday2?'#ffedd5':rsCnt2>0?'#fff3e0':'var(--white)'};">${DOW[dow]}${hol?'祝':''}</th>`;
  }
  html+='</tr></thead><tbody>';
  let tM=0,tF=0,cS=0,cG=0,cC=0,cF=0,tS=0,tCash=0;

  // ── 当月の貸切情報を予約単位で収集（日付→予約データのマップ）──
  // charterDayMap: { 'ANNEX': Map<day → {startDay,nights,meta}>, '本館': Map<...> }
  const charterDayMap={ANNEX:new Map(), 本館:new Map()};

  Object.entries(guestData).forEach(([k,gd])=>{
    if(!gd||!gd.charter||!gd.charterAnchor)return;
    const pk=parseKey(k);
    if(pk.m!==month||pk.y!==year)return;
    const startDay=pk.d;
    const cg=gd.charterGroup||'本館';

    // 泊数カウント：同一部屋で charter かつ cont:true（＝同一予約の連泊後続）のみ加算
    // 別の charterAnchor が来たら別予約なので止める
    let nights=1;
    while(true){
      const {m:_nm,d:_nd}=addDays(month,startDay,nights);
      // 月跨ぎした場合は当月内のbookingには含めない（当月分のみ登録）
      if(_nm!==month)break;
      const next=guestData[gk(_nm,gd.roomId,_nd)];
      if(!next||!next.charter)break;       // charter でない → 終了
      if(next.charterAnchor)break;         // 次のアンカー = 別予約の開始 → 終了
      if(!next.cont)break;                 // cont でない = 別予約の先頭 → 終了
      nights++;
    }

    // 各日 → この予約の {startDay, nights, meta} を登録
    const booking={startDay, nights, meta:gd};
    for(let n=0;n<nights;n++){
      charterDayMap[cg].set(startDay+n, booking);
    }
  });

  // グループごとにまとめて処理（縦結合ラベル）
  const groups=[];
  rooms.forEach(room=>{
    const g=room.group||room.type;
    let grp=groups.find(x=>x.name===g);
    if(!grp){grp={name:g,color:room.color,rooms:[]};groups.push(grp);}
    grp.rooms.push(room);
  });

  // グループ→貸切グループ名のマッピング
  const grpToCharterKey=name=>{
    if(name==='ANNEX−個室'||name==='ANNEX−ドミトリー')return 'ANNEX';
    if(name==='本館−個室'||name==='本館−男女混合ドミトリー')return '本館';
    return null;
  };
  // グループラベルの短縮表示（縦書き列の行高を揃えるため）
  const GRP_SHORT={
    '本館−個室':'本館\n個室',
    'アパートメント−Southern Court':'アパートメント',
    'Sea Breeze 鎌倉':'SB 鎌倉',
    'Sea Breeze 三浦':'SB 三浦',
  };

  // 貸切売上の二重・三重計上防止：'charterKey:startDay' ごとに1回だけ加算
  const charterSalesAccounted=new Set();

  groups.forEach(grp=>{
    const rowspan=grp.rooms.length;
    const isSingle=rowspan===1;
    const shortName=n=>n.replace(grp.name,'').replace(/^[\s\-−]+/,'').trim()||n;
    const charterKey=grpToCharterKey(grp.name);

    grp.rooms.forEach((room,ri)=>{
      const rowId=`row-${room.id}`;
      let row=`<tr id="${rowId}">`;

      // ── 左固定列：グループラベル（rowspan）──
      if(ri===0){
        row+=`<td rowspan="${rowspan}" class="st" style="width:${C1}px;min-width:${C1}px;max-width:${C1}px;left:0;z-index:11;padding:${isMob?'2px 1px':'4px 3px'};background:var(--sand);border-right:3px solid ${grp.color};text-align:center;vertical-align:middle;">`
          +`<span class="grp-lbl" style="color:${grp.color};">${GRP_SHORT[grp.name]||grp.name}</span>`
          +`</td>`;
      }

      // ── 部屋名列 ──
      const roomLabel=isSingle?'':(room.label||shortName(room.type));
      const _rs=roomSettings[room.id]||{};
      const _kc=_rs.keycode||'';
      row+=`<td class="st2 ri" style="width:${C2}px;min-width:${C2}px;max-width:${C2}px;padding:${isMob?'2px 3px':'4px 6px'};vertical-align:middle;left:${C1}px;overflow:hidden;background:var(--white);">`
        +`<span style="font-size:${isMob?'9':'10'}px;font-weight:600;color:${grp.color};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${roomLabel}</span>`
        +(_kc?`<span style="font-size:9px;color:#888;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">🔑${_kc}</span>`:'')
        +`</td>`;

      let rS=0,rM=0,rF=0,skip=0;
      const _drawnDays=new Set(); // 描画済み（colspanで占有された日を含む）実日付の記録
      for(let d=1;d<=days;d++){
        if(d<skip)continue;

        // cont セルの処理
        const _g=guestData[gk(month,room.id,d)];
        if(_g&&_g.cont&&!_g.charter){
          // 前日（同月）に同名データがあれば正常な連泊後続 → スキップ
          const prevG=d>1?guestData[gk(month,room.id,d-1)]:null;
          if(prevG&&prevG.name===_g.name){
            continue;
          }
          // d=1（月初）の場合は前月末を確認 → 月跨ぎ連泊の続き
          if(d===1){
            const prevMonth=month>1?month-1:12;
            const prevYear=month>1?year:year-1;
            const prevMonthDays=gDays(prevYear,prevMonth);
            const prevMonthG=guestData[gk(prevMonth,room.id,prevMonthDays,prevYear)];
            if(prevMonthG&&prevMonthG.name===_g.name){
              // 月跨ぎ連泊の月頭 → アンカーとして描画（cont:falseに一時変換）
              // _gをアンカー扱いにして描画させる（deleteしない）
              // fallthrough してアンカー描画へ
            } else {
              // 真の孤立cont → 削除して空きセル
              delete guestData[gk(month,room.id,d)];
            }
          } else {
            // 同月内で前日データなし → 真の孤立cont → 削除
            delete guestData[gk(month,room.id,d)];
          }
        }
        // 孤立した貸切cont（charter:true, anchor:false で charterDayMapに当該日のbookingが無い）
        // → アンカーが当月に存在しない貸切後続セル。空きセルとして扱う（欠落防止）
        if(_g&&_g.cont&&_g.charter&&!_g.charterAnchor){
          const _hasBooking=charterKey&&charterDayMap[charterKey]&&charterDayMap[charterKey].has(d);
          if(!_hasBooking){
            delete guestData[gk(month,room.id,d)]; // 孤立貸切cont → 空きセル化
          }
        }

        // ── 貸切日の処理（charterDayMapから日付ごとの正しい予約データを取得）──
        if(charterKey&&charterDayMap[charterKey]&&charterDayMap[charterKey].has(d)){
          const booking=charterDayMap[charterKey].get(d); // {startDay, nights, meta}
          const isAnchorDay=(booking.startDay===d); // この日が予約開始日か

          if(ri===0&&isAnchorDay){
            // グループ最初の部屋 × 予約開始日：rowspan でグループ全体をまとめる
            const charterSpan=Math.min(booking.nights, days-d+1); // 月末を超えないようクランプ
            skip=d+charterSpan;
            for(let _x=0;_x<charterSpan;_x++)_drawnDays.add(d+_x); // 占有日を記録
            const cMeta=booking.meta;
            // 売上：同一貸切予約の初回グループのみ加算（三重計上防止）
            const charterSalesKey=`${charterKey}:${booking.startDay}`;
            if(cMeta.price&&!charterSalesAccounted.has(charterSalesKey)){
              rS+=cMeta.price;
              charterSalesAccounted.add(charterSalesKey);
            }
            const cg=cMeta.charterGroup||charterKey;

            // ── パスBと同一の描画ロジックで貸切セルを描画 ──
            const isCashC=cMeta.pay==='現金'||cMeta.pay==='現地払い';
            const isStripeC=cMeta.pay==='Stripe決済';
            const isBankC=cMeta.pay==='銀行振込';
            const payLabelC=isCashC?'💴現金':isStripeC?'Stripe':isBankC?'振込':'事前';
            const payColorC=isCashC?'var(--coral)':isStripeC?'#7c3aed':isBankC?'var(--seaglass)':'var(--ocean)';
            const payBgC=isCashC?'var(--coral-lt)':isStripeC?'#ede9fe':isBankC?'var(--seaglass-lt)':'var(--ocean-light)';
            const cinC=isCheckedIn(cMeta.status); // 貸切のチェックイン済み判定
            const gcC=guestCountOf(cMeta);
            const guestsBadgeC=`<span class="c-guests${cinC?' ci':''}">${gcC}</span>`;
            const payChipC=`<span class="c-pay" style="color:${payColorC};background:${payBgC};">${payLabelC}</span>`;
            const priceChipC=cMeta.price
              ? isCashC
                ? `<span class="c-price" style="color:#c0392b;font-size:10.5px;font-weight:800;background:#fde8e6;border-radius:3px;padding:1px 5px;border:1px solid #e8877a;">¥${cMeta.price.toLocaleString()}</span>`
                : `<span class="c-price">¥${cMeta.price.toLocaleString()}</span>`
              : '';
            const timeChipC=cMeta.arrivalTime?`<span class="c-time">${esc(cMeta.arrivalTime)}</span>`:'';
            const totalNightsC=booking.nights;
            const nightsBadgeC=totalNightsC>1?`<span class="bdg c-nights">${totalNightsC}泊</span>`:'';
            const sexBadgeC=cMeta.sex?`<span class="bdg ${cMeta.sex==='男'?'bm':cMeta.sex==='女'?'bf':''}">${cMeta.sex}</span>`:'';
            const catLabelC=cg==='ANNEX'?'ANNEX🔒':'本館🔒';
            const {combined:allIconsC}=getCellIcons(cMeta);
            const planIconsHtmlC=allIconsC?`<span style="font-size:11px;margin-right:2px;flex-shrink:0;">${allIconsC}</span>`:'';
            const noteCleanC=(cMeta.note||'').replace(/🚙|🏄|surf|サーフ/gi,'').trim();

            // 貸切背景色
            let cBorder='#FF8F00',cBg='#FFF8E1';
            if(cg==='ANNEX'){cBorder='#9370DB';cBg='#f5f0ff';}

            row+=`<td colspan="${charterSpan}" rowspan="${rowspan}" `
              +`style="padding:0;vertical-align:top;cursor:pointer;" `
              +`ondragover="event.preventDefault();this.classList.add('dt')" `
              +`ondragleave="this.classList.remove('dt')" `
              +`ondrop="onDrop(event,${room.id},${d})">`
              +`<div class="gc charter${cinC?' ci':''}" `
              +`style="min-height:${rowspan*54}px;border-left:3px solid ${cBorder};background:${cBg};" `
              +`onclick="event.stopPropagation();openCharterEdit('${cg}',${booking.startDay},${month})" `
              +`oncontextmenu="event.preventDefault();charterCiFromContext('${cg}',${booking.startDay},${month})">`
              // 上段：🔒 + アイコン + 氏名 + 人数 + 支払 + 料金
              +`<div class="c-namerow">`
              +`<span style="font-size:8px;font-weight:700;color:#7d4c00;background:rgba(255,200,100,.3);border-radius:2px;padding:0 3px;flex-shrink:0;">🔒</span>`
              +planIconsHtmlC
              +`<span class="c-name" style="color:${cinC?'#92400e':'var(--ocean)'};">${esc(cMeta.name||'貸切')}</span>`
              +guestsBadgeC+payChipC+priceChipC
              +`</div>`
              // 下段：サイト + 性別 + 区分 + 国籍 + 時刻 + 泊数 + 備考
              +`<div class="c-sub">`
              +siteIcon(cMeta.site||'直接')
              +sexBadgeC
              +`<span class="bdg bdg-charter">${catLabelC}</span>`
              +(cMeta.nat?natFlag(cMeta.nat):'')
              +timeChipC
              +nightsBadgeC
              +(noteCleanC?`<span class="c-note">📌${esc(noteCleanC.slice(0,30))}</span>`:'')
              +`</div>`
              +`</div></td>`;
          } else if(ri===0&&!isAnchorDay){
            // 最初の部屋・後続日（rowspan結合済みのためスキップ）
            // booking.nightsは月跨ぎ絶対値の場合があるため当月内にクランプ
            skip=d+Math.min(booking.startDay+booking.nights-d, days-d+1);
            for(let _x=d;_x<skip;_x++)_drawnDays.add(_x);
          } else {
            // 2行目以降（rowspan結合済みのためスキップ）
            skip=d+Math.min(booking.startDay+booking.nights-d, days-d+1);
            for(let _x=d;_x<skip;_x++)_drawnDays.add(_x);
          }
          continue;
        }

        const k=gk(month,room.id,d),g=guestData[k],dow=gDow(year,month,d),hol=isHoliday(year,month,d);
        const bg=dow===0||hol?'rgba(255,240,240,.45)':dow===6?'rgba(240,247,255,.45)':'';
        // 月跨ぎ連泊の月頭（d=1でcont:true）はアンカーとして描画
        const isCrossMonthAnchor=g&&g.cont&&!g.charter&&d===1;
        if((g&&!g.cont&&!g.charter)||isCrossMonthAnchor){
          // 同月内のspanと全泊数を別々に計算
          const spanInMonth=findN(room.id,d,month); // colspan用（月内のみ）
          const allKeys=findAllKeys(room.id,month,d); // 全泊（月跨ぎ含む）
          const totalNights=allKeys.length;
          const span=Math.min(spanInMonth, days-d+1); // 月末を超えないようクランプ
          skip=d+span;
          for(let _x=0;_x<span;_x++)_drawnDays.add(d+_x); // 占有日を記録
          const cin=isCheckedIn(g.status),scls=cin?'ci':'rv',ncls=cin?'gn ci':'gn';
          const isCash=g.pay==='現金';
          const isStripe=g.pay==='Stripe決済';
          const isBank=g.pay==='銀行振込';
          // 区分バッジ（貸切catも対応）
          const ccls=g.cat==='Ｓ'?'bs':g.cat==='Ｇ'?'bg2':g.cat==='Ｆ'?'bf2'
            :g.cat==='本館貸切'||g.cat==='ANNEX貸切'?'bdg-charter':'bc';
          // 性別バッジ（空欄の場合は表示しない）
          const bcls=g.sex==='男'?'bm':g.sex==='女'?'bf':'';
          if(g.price)rS+=g.price;
          if(isCash&&g.price&&!isCheckedIn(g.status))tCash+=g.price;
          const gc=guestCountOf(g);
          // ── デバッグ（一時）：guests配列で保存された予約のみ出力 ──
          if(Array.isArray(g.guests)){
            console.log('Render reservation data:', g);
            console.log('Guest count display source:', gc, g.guests);
          }
          // 性別集計: 空欄は不明としてカウントしない
          if(g.sex==='男')rM+=gc;else if(g.sex==='女')rF+=gc;
          if(g.cat==='Ｓ')cS++;else if(g.cat==='Ｇ')cG++;else if(g.cat==='Ｆ')cF++;else cC++;
          const {combined:allIcons}=getCellIcons(g);
          const planIconsHtml=allIcons?`<span style="font-size:11px;margin-right:2px;flex-shrink:0;">${allIcons}</span>`:'';
          const isCharter=!!g.charter;
          const tdCls=isCharter?'charter-col':'';

          // キーワードによるセル色（複数マッチ時は最初のもの優先、背景は最初、ボーダーは最初）
          let planBorder='',planBg='';
          if(g.note){
            const matched=PLAN_RULES.filter(r=>r.noteTag&&g.note.includes(r.noteTag)&&r.cellBorder);
            if(matched.length===1){
              planBorder=matched[0].cellBorder;planBg=matched[0].cellBg;
            } else if(matched.length>1){
              planBg=matched[0].cellBg;
              planBorder=matched.map(r=>r.cellBorder).join(', ');
            }
          }
          // 駐車場利用：赤系（他キーワード未設定時のみ）
          if(g.parking&&!planBorder){
            planBorder='#E53935';planBg='#FFF5F5';
          }
          if(g.lowerBunk&&!planBorder){
            planBorder='#00897b';planBg='#e0f2f1';
          }
          // 貸切背景色：本館→薄オレンジ、ANNEX→薄紫（他キーワード未設定時のみ）
          if(isCharter&&!planBorder){
            if(g.charterGroup==='ANNEX'){planBorder='#9370DB';planBg='#f5f0ff';}
            else{planBorder='#FF8F00';planBg='#FFF8E1';}
          }
          const _pb=planBorder.includes(',')?planBorder.split(',')[0].trim():planBorder;
          const planStyle=planBorder
            ? (cin
                ? `box-shadow:inset 7px 0 0 0 ${_pb};`
                : `box-shadow:inset 7px 0 0 0 ${_pb};background:${planBg};`)
            : '';

          const isTodayCol=(year===_ty&&month===_tm&&d===_td);

          
          row+=`<td colspan="${span}" class="${tdCls}" style="padding:0;${isTodayCol&&!bg?'background:#ffedd5;':bg?'background:'+bg:''}" `
            +`ondragover="event.preventDefault();this.classList.add('dt-swap')" `
            +`ondragleave="this.classList.remove('dt');this.classList.remove('dt-swap')" `
            +`ondrop="onDrop(event,${room.id},${d})">`;

          row+=`<div class="gc ${scls} ${span===1?'solo':'spst'}${isCharter?' charter':''}" `
            +`draggable="true" data-k="${k}" `
            +`style="${planStyle}" `
            +`ondragstart="onDS(event,'${k}')" `
            +`onclick="event.stopPropagation();cellClick(event,'${k}')" `
            +`oncontextmenu="event.preventDefault();ciFromContext('${k}')">`;

          // ── 上段：アイコン + 氏名 + 人数 + 支払 + 料金（1行）──
          const payLabel=isCash?'💴現金':isStripe?'Stripe':isBank?'振込':'事前';
          const payColor=isCash?'var(--coral)':isStripe?'#7c3aed':isBank?'var(--seaglass)':'var(--ocean)';
          const payBg=isCash?'var(--coral-lt)':isStripe?'#ede9fe':isBank?'var(--seaglass-lt)':'var(--ocean-light)';
          const guestsBadge=`<span class="c-guests${cin?' ci':''}">${gc}</span>`;
          const payChip=`<span class="c-pay" style="color:${payColor};background:${payBg};">${payLabel}</span>`;
          const priceChip=g.price
            ? isCash
              ? `<span class="c-price" style="color:#c0392b;font-size:10.5px;font-weight:800;background:#fde8e6;border-radius:3px;padding:1px 5px;border:1px solid #e8877a;">¥${g.price.toLocaleString()}</span>`
              : `<span class="c-price">¥${g.price.toLocaleString()}</span>`
            : '';
          const timeChip=g.arrivalTime?`<span class="c-time">${esc(g.arrivalTime)}</span>`:'';
          // 氏名・人数・支払・料金をすべて1行に
          row+=`<div class="c-namerow">`;
          if(isCharter)row+=`<span style="font-size:8px;font-weight:700;color:#7d4c00;background:rgba(255,200,100,.3);border-radius:2px;padding:0 3px;flex-shrink:0;">🔒</span>`;
          if(allIcons)row+=planIconsHtml;
          row+=`<span class="${ncls} c-name">${esc(g.name)}</span>`;
          if(g.reservationId)row+=`<span style="font-size:9px;font-weight:600;color:#185FA5;background:#e8f0fe;border-radius:3px;padding:0 4px;flex-shrink:0;">${esc(g.reservationId)}</span>`;
          row+=guestsBadge+payChip+priceChip;
          row+=`</div>`;

          // ── 下段：サイトアイコン + 性別 + 区分 + 国籍 + 到着時刻 + 泊数 ──
          const sexBadge=g.sex?`<span class="bdg ${bcls}">${g.sex}</span>`:'';
          const catLabel=g.cat==='本館貸切'?'本館🔒':g.cat==='ANNEX貸切'?'ANNEX🔒':g.cat||'';
          const nightsBadge=totalNights>1?`<span class="bdg c-nights">${totalNights}泊${totalNights>span?'↗':''}</span>`:'';
          row+=`<div class="c-sub">`;
          row+=siteIcon(g.site);
          row+=sexBadge;
          if(catLabel)row+=`<span class="bdg ${ccls}">${catLabel}</span>`;
          if(g.nat)row+=natFlag(g.nat);
          if(timeChip)row+=timeChip;
          row+=nightsBadge;
          // 備考：泊数の右に表示（駐車・サーフ除外）
          const noteClean=(g.note||'').replace(/🚙|🏄|surf|サーフ/gi,'').trim();
          if(noteClean)row+=`<span class="c-note">📌${esc(noteClean.slice(0,30))}</span>`;
          row+=`</div>`;

          row+=`</div></td>`;

        } else if(g&&g.cont&&!g.charter){
          // 通常連泊の後続セル → アンカーのcolspanで既に描画済み → tdを出さない
          // （この分岐が無いとどのifにも入らずtd欠落で列がズレる：過去の不具合の根本原因）
          continue;

        } else if(!g||(g&&g.charter&&!g.charterAnchor)){
          // 空きセル（または貸切のcont行: rowspanで既に描画済みなのでスキップ）
          if(g&&g.charter)continue; // 貸切cont行はスキップ
          const isTodayColE=(year===_ty&&month===_tm&&d===_td);

          
          row+=`<td style="padding:0;width:${DAY_W}px;min-width:${DAY_W}px;${isTodayColE&&!bg?'background:#ffedd5;':bg?'background:'+bg:''};max-height:62px;" `
            +`ondragover="event.preventDefault();this.classList.add('dt')" `
            +`ondragleave="this.classList.remove('dt');this.classList.remove('dt-swap')" `
            +`ondrop="onDrop(event,${room.id},${d})">`;
          row+=`<div class="ec" ondblclick="event.stopPropagation();openAddAt(${room.id},${d})">—</div></td>`;
          _drawnDays.add(d);
        }
      }
      // ── 堅牢化：未描画の日を実日付で補填（土日色も実日付で正確に）──
      for(let d=1; d<=days; d++){
        if(_drawnDays.has(d))continue; // 既に描画済み（colspan占有含む）
        const _dw=gDow(year,month,d),_hl=isHoliday(year,month,d);
        const _pbg=_dw===0||_hl?'rgba(255,240,240,.45)':_dw===6?'rgba(240,247,255,.45)':'';
        const _pToday=(year===_ty&&month===_tm&&d===_td);
        row+=`<td style="padding:0;width:${DAY_W}px;min-width:${DAY_W}px;${_pToday?'background:#ffedd5;':_pbg?'background:'+_pbg:''};max-height:62px;" `
          +`ondragover="event.preventDefault();this.classList.add('dt')" `
          +`ondragleave="this.classList.remove('dt');this.classList.remove('dt-swap')" `
          +`ondrop="onDrop(event,${room.id},${d})">`
          +`<div class="ec" ondblclick="event.stopPropagation();openAddAt(${room.id},${d})">—</div></td>`;
        _drawnDays.add(d);
      }
      // フィルタONの部屋のみ売上・男女集計に加算
      if(roomFilter[grp.name]!==false){tS+=rS;tM+=rM;tF+=rF;}
      row+=`</tr>`;
      html+=row;
    }); // end grp.rooms.forEach

    // グループ間の区切り帯（4px 濃いグレー）
    html+=`<tr><td colspan="${days+2}" style="height:4px;background:#b0bec5;padding:0;border:none;"></td></tr>`;
  }); // end groups.forEach
  document.getElementById('main-table').innerHTML=html+'</tbody>';
  // 曜日行のtopを日付行の高さに合わせて動的設定
  requestAnimationFrame(()=>{
    const thead=document.querySelector('#main-table thead tr:first-child th:not(.st):not(.st2)');
    if(thead){
      const h=thead.getBoundingClientRect().height||32;
      document.querySelectorAll('#main-table thead tr:last-child th').forEach(th=>{
        th.style.top=h+'px';
      });
    }
  });

  // ── カテゴリ別ダッシュボード集計（フィルタ適用）──
  const CAT_GROUPS=[
    {key:'本館−個室',      label:'本館個室',        color:'#185FA5',
     roomIds:rooms.filter(r=>r.group==='本館−個室').map(r=>r.id)},
    {key:'本館−男女混合ドミトリー',label:'本館 ドミトリー',color:'#854F0B',
     roomIds:rooms.filter(r=>r.group==='本館−男女混合ドミトリー').map(r=>r.id)},
    {key:'ANNEX−個室',      label:'ANNEX 個室',      color:'#993556',
     roomIds:rooms.filter(r=>r.group==='ANNEX−個室').map(r=>r.id)},
    {key:'ANNEX−ドミトリー',label:'ANNEX ドミトリー',color:'#7C3AED',
     roomIds:rooms.filter(r=>r.group==='ANNEX−ドミトリー').map(r=>r.id)},
    {key:'アパートメント−Southern Court',label:'アパートメント',color:'#534AB7',
     roomIds:rooms.filter(r=>r.group==='アパートメント−Southern Court').map(r=>r.id)},
    {key:'Sea Breeze 鎌倉',label:'Sea Breeze 鎌倉',color:'#0e7490',
     roomIds:rooms.filter(r=>r.group==='Sea Breeze 鎌倉').map(r=>r.id)},
    {key:'Sea Breeze 三浦',label:'Sea Breeze 三浦',color:'#0f766e',
     roomIds:rooms.filter(r=>r.group==='Sea Breeze 三浦').map(r=>r.id)},
  ];
  const catStats=CAT_GROUPS.filter(cat=>roomFilter[cat.key]!==false).map(cat=>{
    let sales=0,cells=0,pricedCells=0;
    const totalCells=cat.roomIds.length*days;
    for(let d=1;d<=days;d++){
      cat.roomIds.forEach(rid=>{
        const g=guestData[gk(month,rid,d)];
        if(!g||g.charter)return;
        cells++;
        if(g.price&&!g.cont){sales+=g.price;pricedCells++;}
      });
    }
    const occ=totalCells>0?Math.round(cells/totalCells*1000)/10:0;
    const adr=pricedCells>0?Math.round(sales/pricedCells):0;
    return{...cat,sales,cells,occ,adr,totalCells};
  });
  // 売上最大カテゴリ特定
  const maxSales=Math.max(...catStats.map(c=>c.sales),0);
  const dashEl=document.getElementById('cat-dashboard');
  if(dashEl){
    dashEl.innerHTML=catStats.map(c=>{
      const isTop=c.sales>0&&c.sales===maxSales;
      const border=isTop?`3px solid ${c.color}`:`1.5px solid var(--sand-border)`;
      const bg=isTop?c.color+'0d':'var(--white)';
      return `<div style="background:${bg};border:${border};border-radius:12px;padding:10px 12px;position:relative;overflow:hidden;">
        ${isTop?`<div style="position:absolute;top:6px;right:8px;font-size:9px;font-weight:700;color:${c.color};background:${c.color}22;border-radius:99px;padding:1px 6px;">TOP</div>`:''}
        <div style="font-size:10px;font-weight:700;color:${c.color};margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.label}</div>
        <div style="font-size:16px;font-weight:800;color:var(--ink);line-height:1.1;margin-bottom:4px;">${c.sales>0?'¥'+c.sales.toLocaleString():'—'}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:10px;font-weight:700;color:${c.occ>=70?'#16a34a':c.occ>=40?c.color:'var(--muted)'};">${c.occ}%</span>
          <span style="font-size:9px;color:var(--muted);">${c.cells}/${c.totalCells}泊</span>
          ${c.adr>0?`<span style="font-size:10px;color:var(--muted);">ADR ¥${c.adr.toLocaleString()}</span>`:''}
        </div>
      </div>`;
    }).join('');
  }

  // 貸切列ヘッダーハイライト（charterDayMapから全貸切日を収集）
  const allCharterDays=new Set([
    ...charterDayMap.ANNEX.keys(),
    ...(charterDayMap['本館']?charterDayMap['本館'].keys():[])
  ]);
  if(allCharterDays.size>0){
    const table=document.getElementById('main-table');
    table.querySelectorAll('thead tr:first-child th').forEach(th=>{
      if(th.classList.contains('st')||th.classList.contains('st2'))return; // 左上コーナー(ナビ)は除外
      const dayNum=parseInt(th.textContent);
      if(!isNaN(dayNum)&&allCharterDays.has(dayNum)){
        th.style.background='#fef9c3';
        th.style.color='#92400e';
        th.style.fontWeight='700';
      }
    });
  }
  document.getElementById('s-male').textContent=tM;
  document.getElementById('s-female').textContent=tF;
  document.getElementById('s-sgc').textContent=`${cS}/${cG}/${cC}/${cF}`;
  document.getElementById('s-sales').textContent='¥'+tS.toLocaleString();

  // ── 使用セル数（＝予約数）＆稼働率を一元算出（フィルタ適用）──
  const fRooms=filteredRooms(); // フィルタ済み部屋
  const totalCells=fRooms.length*days;

  const honkanRooms=fRooms.filter(r=>
    r.group==='本館−個室'||r.group==='本館−男女混合ドミトリー'
  ).length;
  const annexRooms=fRooms.filter(r=>
    r.group==='ANNEX−個室'||r.group==='ANNEX−ドミトリー'
  ).length;

  let usedCells=0;
  const charterCounted=new Set();

  for(let d=1;d<=days;d++){
    fRooms.forEach(room=>{  // ← filteredRooms を使用
      const g=guestData[gk(month,room.id,d)];
      if(!g)return;
      if(g.charter){
        if(g.charterAnchor){
          const cg=g.charterGroup||'本館';
          const key=`${cg}:${d}`;
          if(!charterCounted.has(key)){
            charterCounted.add(key);
            let cNights=1;
            while(true){
              const next=guestData[gk(month,room.id,d+cNights)];
              if(!next||!next.charter)break;
              if(next.charterAnchor)break;
              if(!next.cont)break;
              cNights++;
            }
            usedCells+=(cg==='ANNEX'?annexRooms:honkanRooms)*cNights;
          }
        }
      } else {
        usedCells++;
      }
    });
  }

  // usedCells を「今月予約数」（メイン）と「稼働率」（サブ）の両方に表示
  const occPct=totalCells>0?Math.round(usedCells/totalCells*1000)/10:0;
  document.getElementById('s-total').textContent=usedCells;
  document.getElementById('s-occ').textContent=`${occPct}%`;
  document.getElementById('s-occ-sub').textContent=`${usedCells} / ${totalCells} セル`;
  const occBar=document.getElementById('s-occ-bar');
  occBar.style.width=Math.min(occPct,100)+'%';
  occBar.style.background=occPct>=80?'#16a34a':occPct>=50?'#0F6E56':'#f59e0b';

  // usedCellsをautoCalcTodayOccに渡す（当日の値として直接使用）
  window._lastRenderRegYear=year;
  window._lastRenderRegMonth=month;
  window._lastUsedCells=usedCells; // 名簿の今月予約数と完全一致

  // 予算・進捗
  const budget=budgets[month]||0;
  const pct=budget>0?Math.min(Math.round(tS/budget*100),999):0;
  document.getElementById('s-budget-label').textContent=budget?'¥'+budget.toLocaleString():'未設定';
  document.getElementById('s-progress-pct').textContent=budget?(pct+'%'):'—';
  const bar=document.getElementById('s-progress-bar');
  bar.style.width=Math.min(pct,100)+'%';
  bar.style.background=pct>=100?'#16a34a':pct>=70?'#185FA5':'#f59e0b';

  // ── スクロール制御 ──────────────────────────────
  // 今日へジャンプするのは：初回起動 / 「今日」ボタン / 月変更時のみ
  requestAnimationFrame(()=>{
    const scEl=document.getElementById('reg-scroll');
    if(!scEl)return;
    const now2=new Date();
    const isCurrentMonth=(year===now2.getFullYear()&&month===now2.getMonth()+1);

    if(window._regScrollToToday||_regInitialLoad){
      // 明示的な今日スクロール指示
      window._regScrollToToday=false;
      _regInitialLoad=false;
      if(isCurrentMonth){
        const todayTh=document.getElementById('th-today');
        if(todayTh){
          // モバイルは今日列を左端に揃える、PCは中央寄せ
          const target=isMob
            ? todayTh.offsetLeft-C1-C2
            : todayTh.offsetLeft-(scEl.offsetWidth/2)+(todayTh.offsetWidth/2);
          scEl.scrollLeft=Math.max(0,target);
        }
      } else {
        scEl.scrollLeft=0;
      }
    } else {
      // 通常の再描画：スクロール位置を維持（何もしない）
    }
  });
  // 再描画でセルが作り直されるため検索ハイライトを再適用
  if(typeof applyRegSearch==='function')applyRegSearch();
}

// 直近の入力デバイス種別を記録（タッチ長押し=contextmenu からのチェックイン誤操作を防ぐため）
let _lastPointerType='mouse';
document.addEventListener('pointerdown',function(e){ _lastPointerType=e.pointerType||'mouse'; },true);
// contextmenu（PCの右クリック / スマホ・タブレットの長押し）経由のチェックイン。
// スマホ・タブレットの長押しでは実行しない（誤操作防止）。PCの右クリックのみ有効。
function ciFromContext(k){ if(_lastPointerType==='touch')return; toggleCI(k); }
function charterCiFromContext(cg,startDay,month){ if(_lastPointerType==='touch')return; toggleCharterCI(cg,startDay,month); }

// チェックイン状態トグル（PCの右クリックのみ。スマホ・タブレットの長押しは無効）
let pressTimer=null;
function toggleCI(k){
  if(currentRole==='reception'||currentRole==='watanabe')return;
  const g=guestData[k];if(!g)return;
  const month=parseInt(document.getElementById('sel-month').value);
  const newStatus=isCheckedIn(g.status)?'reserved':'checked_in';
  const now=new Date();
  const p=n=>String(n).padStart(2,'0');
  const checkedInAt=newStatus==='checked_in'
    ?`${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`:'';
  const allKeys=findAllKeys(g.roomId,month,g.day);
  allKeys.forEach(({k:ck})=>{
    if(guestData[ck]){
      guestData[ck].status=newStatus;
      guestData[ck].checkedInAt=checkedInAt;
    }
  });
  // 手動チェックインは自分の操作なので通知済みに登録（ポーリングでの誤通知防止）
  if(newStatus==='checked_in'&&g.reservationId){
    notifiedReservationIds.add(String(g.reservationId));
  }
  showToast(newStatus==='checked_in'?`🩷 チェックイン済み`:'↩ 予約済みに戻しました');
  renderReg();autoSave();
}

// 貸切のチェックイン状態トグル（右クリック）。通常予約の toggleCI と同じ思想で、
// 貸切予約に属する全部屋×全泊の status / checkedInAt を一括更新し、即時再描画＋cloudSave。
function toggleCharterCI(charterGroup, startDay, m){
  if(currentRole==='reception'||currentRole==='watanabe')return;
  startDay=parseInt(startDay); m=parseInt(m);
  const targetRooms=rooms.filter(r=>{
    if(charterGroup==='ANNEX')return r.group==='ANNEX−個室'||r.group==='ANNEX−ドミトリー';
    return r.group==='本館−個室'||r.group==='本館−男女混合ドミトリー';
  });
  if(!targetRooms.length)return;
  const maxDays=gDays(2026,m);
  // この貸切予約に属するキーを収集（startDay以降、次の貸切アンカー or 非貸切で停止）
  const keys=[];
  targetRooms.forEach(room=>{
    for(let d=startDay;d<=maxDays;d++){
      const g=guestData[gk(m,room.id,d)];
      if(!g||!g.charter)break;
      if(d>startDay&&g.charterAnchor)break;
      keys.push(gk(m,room.id,d));
    }
  });
  if(!keys.length)return;
  // アンカー（先頭室の開始日）の現状から新ステータスを決定
  const anchor=guestData[gk(m,targetRooms[0].id,startDay)];
  const newStatus=isCheckedIn(anchor&&anchor.status)?'reserved':'checked_in';
  const now=new Date(),p=n=>String(n).padStart(2,'0');
  const checkedInAt=newStatus==='checked_in'
    ?`${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`:'';
  keys.forEach(k=>{
    if(guestData[k]){ guestData[k].status=newStatus; guestData[k].checkedInAt=checkedInAt; }
  });
  showToast(newStatus==='checked_in'?`🩷 貸切チェックイン済み`:'↩ 予約済みに戻しました');
  renderReg();autoSave();
}
function showToast(msg){
  let t=document.getElementById('ci-toast');
  if(!t){t=document.createElement('div');t.id='ci-toast';t.className='ci-toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1800);
}
function startPress(e,k){
  if(e.button!==undefined&&e.button!==0)return; // 左ボタンのみ
  endPress();
  const el=e.currentTarget;
  pressTimer=setTimeout(()=>{
    pressTimer=null;
    el.classList.remove('pressing');
    toggleCI(k);
  },600);
  el.classList.add('pressing');
}
function endPress(e){
  if(pressTimer){clearTimeout(pressTimer);pressTimer=null;}
  // remove pressing class from any cell
  document.querySelectorAll('.gc.pressing').forEach(el=>el.classList.remove('pressing'));
}

function onDS(e,k){
  endPress();
  // cont（連泊後続）セルはドラッグ不可 → アンカーキーに差し替え
  const month=parseInt(document.getElementById('sel-month').value);
  let g=guestData[k];
  if(g&&g.cont){
    // アンカーを探す
    let anchorDay=g.day;
    while(anchorDay>1){
      const prev=guestData[gk(month,g.roomId,anchorDay-1)];
      if(!prev||prev.name!==g.name)break;
      anchorDay--;
    }
    k=gk(month,g.roomId,anchorDay);
  }
  dragSrc=k;
  setTimeout(()=>{const el=document.querySelector(`[data-k="${k}"]`);if(el)el.classList.add('dragging');},0);
}
function onDrop(e,rid,day){
  e.preventDefault();
  document.querySelectorAll('.dt,.dt-swap').forEach(el=>{el.classList.remove('dt');el.classList.remove('dt-swap');});
  if(!dragSrc)return;
  const month=parseInt(document.getElementById('sel-month').value);
  let src=guestData[dragSrc];if(!src)return;

  // ── cont（連泊後続）セルをドラッグした場合 → アンカー（先頭）に遡る ──
  if(src.cont){
    let anchorDay=src.day;
    while(anchorDay>1){
      const prev=guestData[gk(month,src.roomId,anchorDay-1)];
      if(!prev||prev.name!==src.name)break;
      anchorDay--;
    }
    // アンカーに差し替え
    const anchorKey=gk(month,src.roomId,anchorDay);
    src=guestData[anchorKey];
    if(!src||src.cont)return; // アンカーが見つからない場合は中断
    dragSrc=anchorKey;
  }

  // ── 権限ガード：渡辺千尋はSea Breeze 鎌倉/三浦のセル移動のみ許可（移動元・移動先とも） ──
  if(currentRole==='watanabe' && (!_isSBRoom(src.roomId)||!_isSBRoom(rid))){
    dragSrc=null;
    showToast('⚠ Sea Breeze 鎌倉・三浦のセルのみ移動できます');
    return;
  }

  // ── ① 同一セルへのドロップ → 何もしない ──
  if(src.roomId===rid&&src.day===day){dragSrc=null;return;}

  const srcRoom=src.roomId, srcDay=src.day;
  // 月跨ぎ対応：全泊キーを取得
  const srcAllKeys=findAllKeys(srcRoom,month,srcDay);
  const srcNights=srcAllKeys.length; // 全泊数（月跨ぎ含む）
  const srcMonthNights=findN(srcRoom,srcDay,month); // 同月内のみ

  // 移動元キー群（全月分）
  const srcKeys=new Set(srcAllKeys.map(({k})=>k));
  // 同月内キーも追加（念のため）
  for(let n=0;n<srcMonthNights;n++) srcKeys.add(gk(month,srcRoom,srcDay+n));

  // ── ②-0 貸切セルガード：移動先に貸切があれば中断（レビュー#10）──
  // 貸切は複数部屋に跨るためスワップ不可。ここで弾かないと下の !g2.charter 除外により
  // 「空きセル」と誤判定され、貸切予約を黙って上書きしてしまう。
  for(let n=0;n<srcMonthNights;n++){
    const k2=gk(month,rid,day+n);
    if(srcKeys.has(k2))continue;
    const g2=guestData[k2];
    if(g2&&g2.charter){
      showToast('⚠ 移動先が貸切期間のため移動できません');
      dragSrc=null;return;
    }
  }

  // ── ② 移動先の全日程を事前スキャン（同月内、アトミック保証）──
  const dstBlockedKeys=new Set();
  for(let n=0;n<srcMonthNights;n++){
    const k2=gk(month,rid,day+n);
    if(srcKeys.has(k2))continue;
    const g2=guestData[k2];
    if(g2&&!g2.charter){
      if(g2.cont){
        let anchorDay2=day+n;
        while(anchorDay2>1){
          const prev=guestData[gk(month,rid,anchorDay2-1)];
          if(!prev||prev.name!==g2.name)break;
          anchorDay2--;
        }
        const anchor=guestData[gk(month,rid,anchorDay2)];
        if(anchor&&!anchor.cont){
          const aNights=findN(rid,anchorDay2,month);
          for(let a=0;a<aNights;a++){
            const kk=gk(month,rid,anchorDay2+a);
            if(!srcKeys.has(kk))dstBlockedKeys.add(kk);
          }
        }
      } else {
        const aNights=findN(rid,day+n,month);
        for(let a=0;a<aNights;a++){
          const kk=gk(month,rid,day+n+a);
          if(!srcKeys.has(kk))dstBlockedKeys.add(kk);
        }
      }
    }
  }

  if(dstBlockedKeys.size===0){
    // ── ③ 通常移動：移動先が全日程空き ──
    // 全泊（月跨ぎ含む）をコピー→削除→書き戻し
    const srcCopyAll=srcAllKeys.map(({m:sm,d:sd,k})=>({...guestData[k],_m:sm,_d:sd}));
    srcAllKeys.forEach(({k})=>delete guestData[k]);
    srcCopyAll.forEach((g,n)=>{
      const {y:ny,m:nm,d:nd}=addDays(month,day,n);
      guestData[gk(nm,rid,nd,ny)]={...g,roomId:rid,day:nd,cont:n>0,_m:undefined,_d:undefined};
    });

  } else {
    // ── ④ スワップ：移動先に予約あり ──
    const dstAnchors=new Map();
    dstBlockedKeys.forEach(k2=>{
      const g2=guestData[k2];
      if(!g2||g2.cont)return;
      const dstAllKeys=findAllKeys(rid,month,g2.day);
      dstAnchors.set(k2,{anchorDay:g2.day,allKeys:dstAllKeys});
    });

    if(dstAnchors.size>1){
      showToast('⚠ 移動先に複数の予約があるため移動できません');
      dragSrc=null;return;
    }

    const [{anchorDay:dstDay,allKeys:dstAllKeys}]=dstAnchors.values();

    // ── 逆方向衝突判定（Reverse Collision Check）──
    // 押し出される予約（dst）が移動元の部屋（srcRoom）に収まるか確認。
    // dstの各日程について srcRoom の同日セルに「src自身ではない別予約」があれば中断。
    for(let n=0;n<dstAllKeys.length;n++){
      const {y:ny,m:nm,d:nd}=addDays(month,dstDay,n);
      const targetKey=gk(nm,srcRoom,nd,ny);
      const existing=guestData[targetKey];
      if(existing&&!srcKeys.has(targetKey)){
        showToast('⚠ スワップ先の部屋に別の予約があるため入れ替えできません');
        dragSrc=null;return;
      }
    }

    // 全泊コピー→全泊削除→書き戻し（アトミック）
    const srcCopyAll=srcAllKeys.map(({k})=>({...guestData[k]}));
    const dstCopyAll=dstAllKeys.map(({k})=>({...guestData[k]}));

    srcAllKeys.forEach(({k})=>delete guestData[k]);
    dstAllKeys.forEach(({k})=>delete guestData[k]);

    srcCopyAll.forEach((g,n)=>{
      const {y:ny,m:nm,d:nd}=addDays(month,day,n);
      guestData[gk(nm,rid,nd,ny)]={...g,roomId:rid,day:nd,cont:n>0};
    });
    dstCopyAll.forEach((g,n)=>{
      const {y:ny,m:nm,d:nd}=addDays(month,dstDay,n);
      guestData[gk(nm,srcRoom,nd,ny)]={...g,roomId:srcRoom,day:nd,cont:n>0};
    });
    showToast('⇄ 予約を入れ替えました');
  }

  saveHistory(); // Undo履歴保存
  dragSrc=null;renderReg();autoSave();
}

function openAdd(){
  editKey=null;document.getElementById('modal-title').textContent='予約追加';document.getElementById('del-btn').style.display='none';
  ['f-name','f-price','f-note','f-arrival','f-resid'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  // 電話番号・住所をクリア
  document.getElementById('f-phone').value='';
  document.getElementById('f-address').value='';
  document.getElementById('f-email').value='';
  const selMonth=parseInt(document.getElementById('sel-month').value);
  const today=new Date();
  const defDate=`${DISP_YEAR}-${String(selMonth).padStart(2,'0')}-01`;
  document.getElementById('f-day').value=defDate;
  document.getElementById('f-nights').value='1';
  document.getElementById('f-guests').value='1';
  document.getElementById('f-status').value='reserved';
  document.getElementById('f-parking').checked=false;
  document.getElementById('f-lower').checked=false;
  PLAN_RULES.forEach(r=>{if(r.checkboxId){const el=document.getElementById(r.checkboxId);if(el)el.checked=false;}});
  const ppRow=document.getElementById('f-passports-row'); if(ppRow)ppRow.style.display='none'; // 追加時はパスポート欄を隠す
  const qrRow=document.getElementById('f-qr-row'); if(qrRow)qrRow.style.display='none'; // 追加時はQR欄を隠す（保存後に表示）
  const mailPanel=document.getElementById('f-mail-panel'); if(mailPanel)mailPanel.style.display='none'; // 追加時はメール欄を隠す
  populateNat('f-nat','日本');populateRS(-1);document.getElementById('modal').classList.add('open');
}
function openAddAt(rid,day){
  openAdd();
  const selMonth=parseInt(document.getElementById('sel-month').value);
  document.getElementById('f-day').value=`${DISP_YEAR}-${String(selMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  document.getElementById('f-room').value=rid;
}
function openEdit(k){
  const g=guestData[k];if(!g||g.cont)return;
  editKey=k;document.getElementById('modal-title').textContent='予約詳細';document.getElementById('del-btn').style.display='block';
  document.getElementById('f-name').value=g.name||'';
  // チェックイン日：guestDataのキー(年:month:roomId:day / month:roomId:day)から年・monthを逆引き
  const _pk=editKey?parseKey(editKey):null;
  const editY=_pk?_pk.y:DISP_YEAR;
  const editM=_pk?_pk.m:parseInt(document.getElementById('sel-month').value);
  document.getElementById('f-day').value=`${editY}-${String(editM).padStart(2,'0')}-${String(g.day||1).padStart(2,'0')}`;
  const month=parseInt(document.getElementById('sel-month').value);
  document.getElementById('f-nights').value=findN(g.roomId,g.day,month);
  document.getElementById('f-guests').value=guestCountOf(g);
  document.getElementById('f-price').value=g.price||'';
  document.getElementById('f-note').value=g.note||'';
  document.getElementById('f-arrival').value=g.arrivalTime||'';
  if(document.getElementById('f-resid'))document.getElementById('f-resid').value=g.reservationId||'';
  document.getElementById('f-pay').value=g.pay||'事前決済';document.getElementById('f-sex').value=g.sex||'男';
  document.getElementById('f-cat').value=g.cat||'Ｇ';
  // 予約サイト: selectにない値（CSV由来など）は動的にoptionを追加してセット
  const fSite=document.getElementById('f-site');
  const siteVal=g.site||'HP';
  if(![...fSite.options].some(o=>o.value===siteVal)){
    const opt=document.createElement('option');opt.value=siteVal;opt.text=siteVal;fSite.appendChild(opt);
  }
  fSite.value=siteVal;
  document.getElementById('f-status').value=normalizeStatus(g.status);
  document.getElementById('f-parking').checked=hasParkKw(g.note)||!!g.parking;
  if(document.getElementById('f-lower'))document.getElementById('f-lower').checked=!!g.lowerBunk;
  PLAN_RULES.forEach(r=>{if(r.checkboxId){const el=document.getElementById(r.checkboxId);if(el)el.checked=!!(g.note&&g.note.includes(r.noteTag));}});
  // 電話番号・住所を入力欄にセット
  document.getElementById('f-phone').value=g.phone||'';
  document.getElementById('f-address').value=g.address||'';
  document.getElementById('f-email').value=g.email||'';
  populateNat('f-nat',g.nat||'日本');populateRS(g.roomId);document.getElementById('modal').classList.add('open');
  // チェックイン用QRコードを表示（保存済みURL優先、無ければ予約IDから生成）
  renderCheckinQr(g);
  // パスポート写真を遅延取得（起動データには画像を含めず、開いた予約の分だけ取得）
  loadPassportPhotos(g.reservationId);
  // 手動メール送信パネルを更新
  renderMailPanel(g);
}

// 予約詳細のQR表示。checkinUrlは保存済み優先・無ければ予約IDから生成。画像は外部APIで描画。
let _currentCheckinUrl='';
function renderCheckinQr(g){
  const row=document.getElementById('f-qr-row');
  if(!row)return;
  const url=(g&&g.checkinUrl)||(g&&g.reservationId?generateCheckinUrl(g.reservationId):'');
  _currentCheckinUrl=url||'';
  if(!url){ row.style.display='none'; return; }
  document.getElementById('f-qr-img').src='https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data='+encodeURIComponent(url);
  const link=document.getElementById('f-qr-link');
  link.textContent=url; link.href=url;
  row.style.display='';
}
function copyCheckinUrl(){
  if(!_currentCheckinUrl)return;
  (navigator.clipboard?navigator.clipboard.writeText(_currentCheckinUrl):Promise.reject())
    .then(()=>showToast('🔗 チェックインURLをコピーしました'))
    .catch(()=>{ const ta=document.createElement('textarea');ta.value=_currentCheckinUrl;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');showToast('🔗 チェックインURLをコピーしました');}catch(e){}document.body.removeChild(ta); });
}
function openCheckinQrTab(){
  if(_currentCheckinUrl)window.open('https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data='+encodeURIComponent(_currentCheckinUrl),'_blank');
}
function populateRS(sid){document.getElementById('f-room').innerHTML=rooms.map(r=>`<option value="${r.id}"${r.id===sid?' selected':''}>${r.no} (${r.type})</option>`).join('');}

// ── 手動メール送信パネル ─────────────────────────────────────────
const MAIL_TYPE_LABELS = {
  reservationCreated: '予約確定時',
  checkinCode:        'QR・予約ID送信'
};
let _mailPreviewCtx = null; // {mailKey, lang, reservationId, to}

function _fmtMailDt(iso){
  try{
    const d=new Date(iso);
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }catch(e){return iso;}
}

function renderMailPanel(g){
  const panel=document.getElementById('f-mail-panel');
  if(!panel)return;
  if(!g||!g.reservationId){panel.style.display='none';return;}
  const email=(g.email||'').trim();
  const history=g.mailHistory||{};
  const ms=(propertySettings&&propertySettings.mailSettings)||{};
  let rowsHtml='';
  if(!email){
    rowsHtml+='<div style="font-size:11px;color:#c0392b;margin-bottom:8px;">⚠ メールアドレスが登録されていません</div>';
  }
  Object.keys(MAIL_TYPE_LABELS).forEach(key=>{
    const label=MAIL_TYPE_LABELS[key];
    const lastStr=history[key]?_fmtMailDt(history[key]):'なし';
    const noEmail=!email;
    const disAttr=noEmail?'disabled':'';
    rowsHtml+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;">
      <div>
        <div style="font-size:12px;font-weight:600;">${label}</div>
        <div style="font-size:11px;color:var(--muted);">前回送信：${lastStr}</div>
      </div>
      <button class="btn btn-xs btn-blue" ${disAttr} style="white-space:nowrap;flex-shrink:0;" onclick="openMailPreview('${key}',this)">送信</button>
    </div>`;
  });
  document.getElementById('f-mail-rows').innerHTML=rowsHtml;
  panel.style.display='';
}

async function openMailPreview(mailKey, btn){
  const g=guestData[editKey];
  if(!g||!g.reservationId)return;
  const origText=btn?btn.textContent:'';
  if(btn){btn.textContent='読込中…';btn.disabled=true;}
  try{
    const res=await fetch(_withKey(GAS_URL),{method:'POST',
      body:JSON.stringify({type:'mailPreview',reservationId:g.reservationId,mailKey})});
    const data=await res.json();
    if(data.error){alert('プレビュー取得エラー:\n'+data.error);return;}
    _mailPreviewCtx={mailKey,lang:data.lang,reservationId:g.reservationId,to:data.to};
    document.getElementById('mpm-title').textContent=MAIL_TYPE_LABELS[mailKey]+' プレビュー';
    document.getElementById('mpm-to').textContent=data.to||'(未登録)';
    document.getElementById('mpm-lang').textContent=data.lang==='ja'?'🇯🇵 日本語':'🌐 English';
    document.getElementById('mpm-subject').textContent=data.subject||'';
    document.getElementById('mpm-body').textContent=data.body||'';
    // 添付ファイル
    const attEl=document.getElementById('mpm-attachments');
    const attRow=document.getElementById('mpm-attach-row');
    if(data.attachments&&data.attachments.length){
      attEl.innerHTML=data.attachments.map(a=>`<span style="display:inline-flex;align-items:center;gap:4px;background:var(--sand);border:1px solid var(--sand-border);border-radius:6px;padding:3px 8px;">📎 ${esc(a.name)}</span>`).join('');
      attRow.style.display='';
    }else{attRow.style.display='none';}
    // QRコード
    const qrRow=document.getElementById('mpm-qr-row');
    if(data.qrUrl){
      document.getElementById('mpm-qr-img').src='https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data='+encodeURIComponent(data.qrUrl);
      qrRow.style.display='';
    }else{qrRow.style.display='none';}
    const sendBtn=document.getElementById('mpm-send-btn');
    sendBtn.textContent='この内容で送信';sendBtn.disabled=false;
    document.getElementById('mail-preview-modal').classList.add('open');
  }catch(e){
    alert('プレビュー取得に失敗しました:\n'+e.message);
  }finally{
    if(btn){btn.textContent=origText;btn.disabled=!!(!(guestData[editKey]&&(guestData[editKey].email||'').trim()));}
  }
}

function confirmAndSendMail(){
  if(!_mailPreviewCtx)return;
  const {mailKey,lang,reservationId,to}=_mailPreviewCtx;
  const label=MAIL_TYPE_LABELS[mailKey]||mailKey;
  if(!confirm(`送信先: ${to}\n「${label}」を送信します。よろしいですか？`))return;
  _doSendMail(mailKey,lang,reservationId);
}

async function _doSendMail(mailKey,lang,reservationId){
  const sendBtn=document.getElementById('mpm-send-btn');
  sendBtn.textContent='Sending…';sendBtn.disabled=true;
  try{
    const res=await fetch(_withKey(GAS_URL),{method:'POST',
      body:JSON.stringify({type:'sendMail',reservationId,mailKey,lang})});
    const data=await res.json();
    if(data.error){
      alert('送信エラー:\n'+data.error);
      sendBtn.textContent='この内容で送信';sendBtn.disabled=false;
      return;
    }
    showToast('📧 送信完了: '+data.to);
    closeM('mail-preview-modal');
    // ローカルのmailHistoryを更新してパネルを再描画
    const g=guestData[editKey];
    if(g){
      g.mailHistory=g.mailHistory||{};
      g.mailHistory[mailKey]=data.sentAt||new Date().toISOString();
      renderMailPanel(g);
      cloudSave(); // cloudDataへ反映してDriveと同期
    }
  }catch(e){
    alert('送信に失敗しました:\n'+e.message);
    sendBtn.textContent='この内容で送信';sendBtn.disabled=false;
  }
}

// データURLを新規タブで開く（大きな画像でも確実に表示）
function openDataUrl(dataUrl){
  try{
    const parts=dataUrl.split(','); const mime=(parts[0].match(/:(.*?);/)||[])[1]||'image/jpeg';
    const bin=atob(parts[1]); const arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([arr],{type:mime})),'_blank');
  }catch(e){ window.open(dataUrl,'_blank'); }
}

// 予約編集を開いた時のみ type=search でパスポート画像を取得して表示（遅延読み込み）
async function loadPassportPhotos(resId){
  const row=document.getElementById('f-passports-row');
  const box=document.getElementById('f-passports');
  if(!row||!box)return;
  box.innerHTML=''; row.style.display='none';
  if(!resId)return;
  try{
    const res=await fetch(_withKey(GAS_URL+'?type=search&id='+encodeURIComponent(String(resId).trim())+'&t='+Date.now()));
    const data=await res.json();
    const gd=data.guestData||{};
    // 画像付きの guests 配列を持つレコード（アンカー1件）を探す
    let guestsArr=null;
    Object.values(gd).forEach(g=>{
      if(g&&Array.isArray(g.guests)&&g.guests.some(x=>x&&x.passportImage))guestsArr=g.guests;
    });
    const imgs=guestsArr?guestsArr.filter(x=>x&&x.passportImage):[];
    if(!imgs.length)return;
    box.innerHTML=imgs.map((x,i)=>{
      const nm=((x.familyName||'')+' '+(x.givenName||'')).trim()||('宿泊者'+(i+1));
      return `<div style="text-align:center;">
        <img src="${x.passportImage}" title="クリックで拡大" style="width:120px;height:90px;object-fit:cover;border:1px solid var(--sand-border);border-radius:6px;cursor:pointer;" onclick="openDataUrl(this.src)">
        <div style="font-size:10px;color:#888;margin-top:2px;">${esc(nm)}</div>
        <a href="${x.passportImage}" download="passport_${String(resId)}_${i+1}.jpg" style="font-size:10px;color:#185FA5;text-decoration:none;">⬇ 保存</a>
      </div>`;
    }).join('');
    row.style.display='';
  }catch(e){ console.warn('パスポート写真の取得に失敗:',e); }
}
function saveGuest(){
  const dateVal=document.getElementById('f-day').value; // YYYY-MM-DD
  const dateParts=dateVal?dateVal.split('-'):null;
  const yearSel=dateParts?parseInt(dateParts[0]):DISP_YEAR;   // 選択された年（キー生成に使用）
  const month=dateParts?parseInt(dateParts[1]):parseInt(document.getElementById('sel-month').value);
  const day=dateParts?parseInt(dateParts[2]):1;
  const rid=parseInt(document.getElementById('f-room').value),nights=parseInt(document.getElementById('f-nights').value)||1,status=document.getElementById('f-status').value;
  const note=document.getElementById('f-note').value;
  // チェックボックスから備考タグを自動追記（重複なし）
  let noteWithTags=note;
  PLAN_RULES.forEach(rule=>{
    const cb=rule.checkboxId?document.getElementById(rule.checkboxId):null;
    const checked=cb&&cb.checked;
    if(checked){
      // チェックON：noteTagが未追加なら追記
      if(!noteWithTags.includes(rule.noteTag))
        noteWithTags=noteWithTags?noteWithTags+' '+rule.noteTag:rule.noteTag;
    } else {
      // チェックOFF：noteTagを備考から削除
      noteWithTags=noteWithTags.replace(rule.noteTag,'').replace(/\s+/g,' ').trim();
    }
  });
  const finalNote=noteWithTags.trim();
  const arrivalTime=(document.getElementById('f-arrival').value||'').trim();
  const reservationId=(document.getElementById('f-resid')?.value||'').replace(/\D/g,'').slice(0,6);
  const useParking=document.getElementById('f-parking').checked||hasParkKw(finalNote);
  const useSurf=!!(document.getElementById('f-surf')&&document.getElementById('f-surf').checked)||hasSurfKw(finalNote);
  const lowerBunk=!!(document.getElementById('f-lower')?.checked);
  const guests=parseInt(document.getElementById('f-guests').value)||1;
  const prevCharter=editKey?!!(guestData[editKey]?.charter):false;
  const base={
    name:document.getElementById('f-name').value||'(unnamed)',
    site:document.getElementById('f-site').value,
    pay:document.getElementById('f-pay').value,
    price:parseInt(document.getElementById('f-price').value)||null,
    nat:document.getElementById('f-nat').value,
    sex:document.getElementById('f-sex').value,
    cat:document.getElementById('f-cat').value,
    note:finalNote,arrivalTime,status,roomId:rid,day,parking:useParking,guests,
    charter:prevCharter,reservationId,checkinUrl:generateCheckinUrl(reservationId),lowerBunk,
    // 電話番号・住所：フォームから取得
    phone:String(document.getElementById('f-phone')?.value||'').trim(),
    address:String(document.getElementById('f-address')?.value||'').trim(),
    email:String(document.getElementById('f-email')?.value||'').trim(),
  };
  // チェックイン時に保存された宿泊者配列(guests)・約款同意・チェックイン日時などは
  // フォームに無いため、編集保存で消えないよう既存レコードから引き継ぐ。
  const _preserve={};
  if(editKey&&guestData[editKey]){
    ['guests','agreementAccepted','agreementAcceptedAt','agreementLanguage','agreementMethod','agreementSignature','checkedInAt','checkedOutAt','passport'].forEach(f=>{
      if(guestData[editKey][f]!==undefined)_preserve[f]=guestData[editKey][f];
    });
  }
  saveHistory(); // Undo履歴保存
  // ── キャンセル済みの場合：名簿から全泊削除→cancelListへ追加 ──
  if(status==='cancelled'){
    if(editKey){
      const og=guestData[editKey];
      if(og){
        const room=rooms.find(r=>r.id===og.roomId);
        const now=new Date();
        const cancelledAt=`${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        // 月跨ぎ含む全泊キーを収集して削除
        const allKeys=findAllKeys(og.roomId,month,og.day);
        // 復元用データを保持
        const restoreData=allKeys.map(({m:km,d:kd,k})=>({m:km,d:kd,data:{...guestData[k]}}));
        allKeys.forEach(({k})=>delete guestData[k]);
        // cancelListに登録（cm-dateはYYYY-MM-DD形式）
        const dateStr=`${DISP_YEAR}-${String(month).padStart(2,'0')}-${String(og.day).padStart(2,'0')}`;
        cancelList.unshift({
          date:dateStr,
          name:og.name,
          site:og.site||'',
          price:og.price||0,
          nat:og.nat||'',
          sex:og.sex||'男',
          cat:og.cat||'Ｓ',
          room:room?room.type:String(og.roomId),
          note:(og.note||'')+(og.note?' ':'')+'【キャンセル済み '+cancelledAt+'】',
          pay:og.pay||'',
          payDone:false, // 支払完了フラグ
          restoreData,
        });
        if(typeof renderCancel==='function')renderCancel();
      }
    }
    closeM('modal');renderReg();autoSave();
    showToast('🗑 キャンセル済みにしてキャンセルリストへ追加しました');
    return;
  }

  // ── 衝突チェック（削除前に実施）：書き込み先に自分以外の予約がないか確認 ──
  // 編集中の予約が元々占めていたキーセットを取得（これらは衝突対象外）
  const editOccupiedKeys=new Set();
  if(editKey){
    const og=guestData[editKey];
    // 月跨ぎ対応：findAllKeysで全泊分（翌月含む）のキーを取得し、旧セルを漏れなく除外・削除対象に
    if(og){findAllKeys(og.roomId,month,og.day).forEach(({k})=>editOccupiedKeys.add(k));}
  }
  for(let n=0;n<nights;n++){
    const ck=gk(month,rid,day+n);
    const existing=guestData[ck];
    if(existing&&!editOccupiedKeys.has(ck)){
      showToast('⚠ 変更先の日程・部屋に別の予約が入っているため保存できません');
      return;
    }
  }

  // 既存予約を削除（編集時・衝突なし確認後）
  editOccupiedKeys.forEach(k=>delete guestData[k]);

  // 月跨ぎ対応：各泊の実カレンダー日付(y,m,d)を算出してキー・dayフィールドを正しく設定（CSV取込と同一ロジックへ統一）
  for(let n=0;n<nights;n++){
    const {y:ny,m:nm,d:nd}=addDays(month,day,n,yearSel);   // 選択年を基準に月末・年末跨ぎを正規化
    guestData[gk(nm,rid,nd,ny)]={..._preserve,...base,roomId:rid,day:nd,price:n===0?base.price:null,cont:n>0};
  }

  // 駐車場：チェックONなら追加、OFFなら自動登録分を削除
  if(useParking){
    for(let n=0;n<nights;n++){
      const d=day+n;
      const dk=dateKey(DISP_YEAR,month,d);
      const price=parkPrice(DISP_YEAR,month,d);
      const pk=parkData[dk]||[];
      if(!pk.some(e=>e.name===base.name&&e.type==='park-auto')){
        pk.push({id:nextParkId++,name:base.name,price,note:'宿泊者（自動）',type:'park-auto'});
        parkData[dk]=pk;
      }
    }
  } else {
    // チェックOFF：同名の自動登録分を削除
    removeAutoPark(base,month);
  }

  // サーフィン：チェックONなら追加、OFFなら自動登録分を削除
  if(useSurf){ addAutoSurf(base,month); }
  else { removeAutoSurf(base); }

  closeM('modal');renderReg();autoSave();
}
// 予約削除時に関連リスト（駐車場・サーフィン）を連動削除
function syncDeleteRelated(g, month){
  // 駐車場：park-autoエントリを全泊分削除
  if(g.parking){
    const nights=findN(g.roomId,g.day,month);
    for(let n=0;n<nights;n++){
      const dk=dateKey(DISP_YEAR,month,g.day+n);
      if(parkData[dk]){
        parkData[dk]=parkData[dk].filter(e=>!(e.name===g.name&&e.type==='park-auto'));
        if(parkData[dk].length===0)delete parkData[dk];
      }
    }
  }
  // サーフィン：guestLinkedまたはautoエントリを削除
  if(g.note&&g.note.includes('サーフィン')){
    surfList=surfList.filter(s=>!(s.name===g.name&&(s.auto||s.guestLinked)));
  }
}

function deleteGuest(){
  if(!editKey)return;
  const g=guestData[editKey];
  if(!g)return;
  saveHistory();
  const month=parseInt(document.getElementById('sel-month').value);
  syncDeleteRelated(g,month);
  // 月跨ぎ対応：findAllKeysで全泊分（翌月含む）のキーを削除
  findAllKeys(g.roomId,month,g.day).forEach(({k})=>delete guestData[k]);
  closeM('modal');renderReg();autoSave();
}
function exportCSV(){
  const month=parseInt(document.getElementById('sel-month').value);let csv='部屋,日,氏名,予約サイト,支払,料金,国籍,性別,区分,ステータス,備考\n';
  const year=parseInt(document.getElementById('sel-year').value)||2026;
  Object.entries(guestData).forEach(([k,g])=>{if(!g||g.cont)return;const pk=parseKey(k);if(pk.m!==month||pk.y!==year)return;const r=rooms.find(x=>x.id===g.roomId);csv+=`${r?r.type:''},${g.day}日,${g.name},${g.site},${g.pay},${g.price||''},${g.nat||''},${g.sex},${g.cat},${g.status||'reserved'},"${g.note}"\n`;});
  const b=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`宿泊者名簿_2026_${month}月.csv`;a.click();
}

// ============================================================
// CSV IMPORT
// ============================================================
function handleDrop(e){e.preventDefault();document.getElementById('drop-zone').classList.remove('drag');const file=e.dataTransfer.files[0];if(file)processCSV(file);}
function handleFileSelect(e){const file=e.target.files[0];if(file)processCSV(file);e.target.value='';}
// CSV取込: 部屋タイプ名 → group → 空き部屋を順番に割当
// ── エラー理由判定 ──────────────────────────────────────
function _judgeAssignError(typeName,month,day,nights,guests,year){
  year=(year==null?DISP_YEAR:year);
  let group=null;
  if(/本館.*ダブル|本館.*クイーン|本館.*ツイン/i.test(typeName)) group='本館−個室';
  else if(/本館.*ドミトリー|本館.*混合/i.test(typeName)) group='本館−男女混合ドミトリー';
  else if(/ANNEX.*個室/i.test(typeName))           group='ANNEX−個室';
  else if(/ANNEX.*ドミトリー/i.test(typeName))     group='ANNEX−ドミトリー';
  else if(/Southern Court|サザン|アパートメント/i.test(typeName)) group='アパートメント−Southern Court';
  else if(/Sea Breeze.*鎌倉/i.test(typeName)) group='Sea Breeze 鎌倉';
  else if(/Sea Breeze.*三浦/i.test(typeName)) group='Sea Breeze 三浦';
  if(!group)return '部屋タイプ不明';
  const groupRooms=rooms.filter(r=>r.group===group);
  if(!groupRooms.length)return '対象部屋なし';
  let anyFreeOneNight=false;
  for(const r of groupRooms){
    if(!guestData[gk(month,r.id,day,year)]){anyFreeOneNight=true;break;}
  }
  if(!anyFreeOneNight)return '空室不足';
  if(nights>1)return '連泊可能な空床なし';
  return '空室不足';
}

function getRoomIdByType(typeName, month, day, nights, year){
  year=(year==null?DISP_YEAR:year);
  // 空き判定ヘルパー（月跨ぎ・年跨ぎ対応）
  const _isFree=(rid)=>{
    for(let n=0;n<(nights||1);n++){
      const {y:ny,m:nm,d:nd}=addDays(month,(day||1),n,year);
      if(guestData[gk(nm,rid,nd,ny)])return false;
    }
    return true;
  };
  // 完全一致（空いている場合のみ）
  const exact=rooms.find(r=>r.type===typeName);
  if(exact&&_isFree(exact.id))return exact.id;

  // 本館ダブル・ツインは固定割当（空いている場合のみ）
  if(/本館.*ダブル|本館.*クイーン/i.test(typeName)) return _isFree(0)?0:null;
  if(/本館.*ツイン/i.test(typeName))                return _isFree(1)?1:null;

  // グループ判定（部屋タイプ名からグループを特定）
  let group=null;
  if(/本館.*ドミトリー|本館.*混合/i.test(typeName)) group='本館−男女混合ドミトリー';
  else if(/ANNEX.*個室/i.test(typeName))           group='ANNEX−個室';
  else if(/ANNEX.*ドミトリー/i.test(typeName))     group='ANNEX−ドミトリー';
  else if(/Southern Court|サザン|アパートメント/i.test(typeName)) group='アパートメント−Southern Court';
  else if(/Sea Breeze.*鎌倉|鎌倉.*Sea Breeze/i.test(typeName)) group='Sea Breeze 鎌倉';
  else if(/Sea Breeze.*三浦|三浦.*Sea Breeze/i.test(typeName)) group='Sea Breeze 三浦';

  if(group){
    // グループ内で対象日程が空いている部屋を探す（優先順位ソート済み・月跨ぎ対応）
    const groupRooms=rooms.filter(r=>r.group===group)
      .slice().sort((a,b)=>getRoomPriority(a.id)-getRoomPriority(b.id));
    for(const r of groupRooms){
      if(_isFree(r.id))return r.id;
    }
    // 全部埋まっていたら null を返す（既存予約の上書きを防止）
    return null;
  }

  // 未知タイプ→新規作成
  const newId=nextRoomId++;
  rooms.push({id:newId,no:rooms.length+1,type:typeName,group:typeName,cap:1,color:'#5F5E5A'});
  return newId;
}
// CSVレコード分割：クォート内の改行をまたぐ複数物理行を1レコードに結合する
function splitCSVRecords(text){
  const records=[];
  let buf='';
  let inQ=false;
  // \r\n / \r / \n を統一して処理
  const chars=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<chars.length;i++){
    const c=chars[i];
    if(c==='"'){
      inQ=!inQ;
      buf+=c;
    } else if(c==='\n'&&!inQ){
      // クォート外の改行 = レコード区切り
      if(buf.trim())records.push(buf);
      buf='';
    } else {
      buf+=c;
    }
  }
  if(buf.trim())records.push(buf);
  return records;
}
function parseCSVLine(line){
  const result=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){inQ=!inQ;}
    else if(c===','&&!inQ){result.push(cur.trim());cur='';}
    else if(c==='\n'&&inQ){cur+=' ';} // クォート内改行はスペースに
    else cur+=c;
  }
  result.push(cur.trim());
  return result;
}
function processCSV(file){
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const bytes=new Uint8Array(e.target.result);
      let text='';
      try{
        const dec=new TextDecoder('utf-8',{fatal:true});
        text=dec.decode(bytes);
      } catch(e1){
        const dec=new TextDecoder('shift-jis',{fatal:false});
        text=dec.decode(bytes);
      }
      // CSV種別判定（ファイル名優先、次にヘッダー）
      if(detectCsvType(file.name,text)==='airhost'){
        importAirhostCSV(text);
      } else {
        importCSVText(text);
      }
    }catch(err){
      console.error(err.stack);
      document.getElementById('import-result').innerHTML=`<div class="import-warn">エラー: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// CSV種別自動判定
function detectCsvType(filename,text){
  const fname=(filename||'').toLowerCase();
  if(fname.startsWith('booking'))return 'airhost';
  if(fname.startsWith('reservationlist'))return 'neppan';
  // ヘッダーで判定（AirHostはユニークな列名を持つ）
  const firstLine=(text||'').split('\n')[0];
  if(firstLine.includes('AirHost予約ID')||firstLine.includes('チャンネル予約ID'))return 'airhost';
  return 'neppan';
}

// Airhost 物件名×部屋番号 → roomId
function normalizeRoomName(propName,roomNo){
  const p=propName||'';const r=roomNo||'';
  if(p.includes('Sea Breeze')&&p.includes('鎌倉')){
    if(r.includes('102'))return 23;
    return 22; // 101 or 未指定
  }
  if(p.includes('Sea Breeze')&&(p.includes('三浦')||p.includes('Miura')))return 24;
  if(p.includes('Southern Court')||p.includes('Southern')){
    if(r.includes('104'))return 21;
    return 20; // 103 or 未指定
  }
  if(p.includes('ANNEX')){
    if(r.includes('個室')&&r.includes('②'))return 13;
    if(r.includes('個室'))return 12;
    // ANNEXドミ A-F
    const m=r.match(/[A-F]/);
    if(m)return 14+('ABCDEF'.indexOf(m[0]));
    return 14;
  }
  if(p.includes('本館')||p.includes('ゲストハウス')){
    if(r.includes('ダブル')||r.includes('クイーン'))return 0;
    if(r.includes('ツイン'))return 1;
    const m=r.match(/[G-P]/);
    if(m)return 2+('GHIJKLMNOP'.indexOf(m[0]));
    return 2;
  }
  return null;
}

// Airhost CSV取込
function importAirhostCSV(text){
  const lines=text.split('\n').filter(l=>l.trim());
  if(lines.length<2){
    document.getElementById('import-result').innerHTML='<div class="import-warn">データが空です</div>';
    return;
  }
  const headers=parseCSVLine(lines[0]);
  const idx={};headers.forEach((h,i)=>idx[h.trim()]=i);
  const get=(cols,key)=>{
    if(idx[key]===undefined)return '';
    const v=cols[idx[key]];
    return (v===undefined||v===null)?'':(v+'').trim();
  };

  // サイト正規化
  const normSite=s=>{
    if(!s)return 'その他';
    if(s.includes('Booking')||s.includes('booking'))return 'Booking.com';
    if(s.includes('Rakuten Oyado')||s.includes('Vacation Stay'))return 'Rakuten Oyado';
    if(s.includes('楽天')||s.includes('Rakuten'))return '楽天トラベル';
    if(s.includes('Airbnb')||s.includes('airbnb'))return 'Airbnb';
    if(s.includes('Expedia'))return 'Expedia';
    if(s.includes('agoda')||s.includes('Agoda'))return 'Agoda';
    if(s.includes('じゃらん'))return 'じゃらん';
    return s;
  };

  // 既存reservationIdをMapで高速検索
  const existingIds=new Set(
    Object.values(guestData).filter(g=>g&&g.reservationId&&!g.cont).map(g=>String(g.reservationId))
  );

  let imported=0,skipped=0,cancelled=0;
  const monthCounts={};

  for(let ri=1;ri<lines.length;ri++){
    const cols=parseCSVLine(lines[ri]);
    if(!cols||cols.length<5)continue;

    // キャンセル除外
    const status=get(cols,'状態');
    if(status==='キャンセル'){cancelled++;continue;}

    // reservationId：AirHost予約ID（文字列のまま保持）
    const reservationId=String(get(cols,'AirHost予約ID')||'');

    // 重複チェック
    if(reservationId&&existingIds.has(reservationId)){skipped++;continue;}

    // 日程
    const ciStr=get(cols,'チェックイン'); // 2026-05-30
    const coStr=get(cols,'チェックアウト');
    if(!ciStr)continue;
    const [cy,cm,cd]=ciStr.split('-').map(Number);
    if(!cy||!cm||!cd)continue;
    const nights=parseInt(get(cols,'合計日数'))||1;

    // 部屋
    const propName=get(cols,'物件名');
    const roomNo=get(cols,'部屋番号');
    const rid=normalizeRoomName(propName,roomNo);
    if(rid===null||rid===undefined)continue;

    // 各フィールド
    const name=get(cols,'ゲスト名')||get(cols,'宿泊者名')||'';
    // ゲスト名が空欄の行はスキップ（仮データ・無効行）
    if(!name){ skipped++; continue; }

    const site=normSite(get(cols,'予約サイト'));
    const priceRaw=parseFloat(get(cols,'受取金')||get(cols,'販売')||'0');
    const price=priceRaw>0?Math.round(priceRaw):null;
    const nat=get(cols,'国籍')||'';
    const guestCount=parseInt(get(cols,'ゲスト数'))||1;
    const note=''; // CSVのコメントは取り込まない（スタッフ手入力のみ備考扱い）
    // 連絡先・住所を独立フィールドへ（noteへの混在を解消）
    const phone=String(get(cols,'電話番号')||'').trim();
    const address=String(get(cols,'ゲスト住所')||'').trim();
    const email=String(
      get(cols,'メールアドレス')||get(cols,'メール')||
      get(cols,'Email')||get(cols,'E-mail')||get(cols,'email')||get(cols,'EMAIL')||''
    ).trim();
    // 支払判定：現金列>0なら現金、それ以外事前決済
    const cashAmt=parseFloat(get(cols,'現金')||'0');
    const pay=cashAmt>0?'現金':'事前決済';

    if(reservationId)existingIds.add(reservationId);

    const gBase={
      name,site,pay,price,nat,sex:'',cat:'Ｓ',note,
      phone,address,email,
      status:'reserved',roomId:rid,day:cd,guests:guestCount,
      arrivalTime:'',charter:false,charterGroup:null,
      reservationId,checkinUrl:generateCheckinUrl(reservationId),
    };

    // 全nights分書き込み
    for(let n=0;n<nights;n++){
      const {y:ny,m:nm,d:nd}=addDays(cm,cd,n,cy);
      guestData[gk(nm,rid,nd,ny)]={...gBase,day:nd,price:n===0?price:null,cont:n>0};
    }
    imported++;
    monthCounts[cm]=(monthCounts[cm]||0)+1;
  }

  const monthSummary=Object.entries(monthCounts).sort((a,b)=>a[0]-b[0]).map(([m,c])=>`${m}月:${c}件`).join('、');
  const msg=`✅ Airhost: ${imported}件取込${monthSummary?`（${monthSummary}）`:''} / ${skipped}件重複スキップ${cancelled?` / キャンセル${cancelled}件除外`:''}`;
  const resultEl=document.getElementById('import-result');
  if(resultEl)resultEl.innerHTML=`<div class="import-ok">${msg}</div>`;
  showToast(msg);
  renderReg();autoSave();
}
// ── CSV取込：予約ID重複・変更検知ヘルパー ──────────────────
function findExistingReservationInfo(resId){
  if(!resId)return null;
  let anchorKey=null,anchorG=null;
  for(const k of Object.keys(guestData)){
    const g=guestData[k];
    if(g&&!g.cont&&String(g.reservationId)===String(resId)){anchorKey=k;anchorG=g;break;}
  }
  if(!anchorKey)return null;
  const _pk=parseKey(anchorKey);
  const month=_pk.m,roomId=_pk.r,day=_pk.d;
  const nights=Object.keys(guestData).filter(k=>{
    const g=guestData[k];return g&&String(g.reservationId)===String(resId);
  }).length;
  return {key:anchorKey,data:anchorG,month,roomId,day,nights};
}
function detectReservationChanges(ex,incoming){
  const changes=[];
  if(ex.month!==incoming.checkinMonth || ex.day!==incoming.checkinDay) changes.push('\u65e5\u7a0b\u5909\u66f4');
  else if(ex.nights!=null && incoming.nights!=null && ex.nights!==incoming.nights) changes.push('\u6cca\u6570\u5909\u66f4');
  if(ex.data.guests!=null && incoming.guests!=null && Number(ex.data.guests)!==Number(incoming.guests)) changes.push('\u4eba\u6570\u5909\u66f4');
  if(ex.data.price!=null && incoming.price!=null && Number(ex.data.price)!==Number(incoming.price)) changes.push('\u6599\u91d1\u5909\u66f4');
  if((ex.data.phone||'')!==(incoming.phone||'')) changes.push('\u96fb\u8a71\u5909\u66f4');
  if((ex.data.email||'')!==(incoming.email||'')) changes.push('\u30e1\u30fc\u30eb\u5909\u66f4');
  if((ex.data.address||'')!==(incoming.address||'')) changes.push('\u4f4f\u6240\u5909\u66f4');
  return changes;
}
function clearReservationCells(resId){
  if(!resId)return;
  Object.keys(guestData).forEach(k=>{
    const g=guestData[k];
    if(g&&String(g.reservationId)===String(resId))delete guestData[k];
  });
}

function importCSVText(text){
  // クォート内改行を考慮したレコード分割
  const records=splitCSVRecords(text);
  if(records.length<2)return;
  const headers=parseCSVLine(records[0]);const idx={};headers.forEach((h,i)=>idx[h.trim()]=i);
  const get=(cols,key)=>{
    if(idx[key]===undefined)return '';
    const v=cols[idx[key]];
    return (v===undefined||v===null||v==='NaN')?'':(v+'').trim();
  };
  let imported=0,cancelled=0,skipped=0,parkAdded=0,surfAdded=0,charterCount=0,unassignedCount=0,updatedCount=0;
  const updatedList=[]; // 変更反映された予約 {name,reservationId,changes:[]}
  const dupSkipList=[]; // 完全重複でスキップした予約 {name,reservationId}
  const monthCounts={};
  // 貸切の重複予約番号を管理（同一予約番号は1回だけ取り込む）
  const processedCharter=new Set();
  // 既存reservationId を Map で高速検索（value=true は通常予約、false は cont）
  const existingIdMap=new Map(
    Object.values(guestData)
      .filter(g=>g&&g.reservationId&&!g.cont)
      .map(g=>[String(g.reservationId),true])
  );
  // 名簿上に既に存在する予約IDが未割当エラーキューにも残っていれば、
  // 古いエラー表示の残骸として一括削除する（過去の不具合・再取込で解消済みのケース）
  if(existingIdMap.size>0 && unassignedReservations.length>0){
    const beforeLen=unassignedReservations.length;
    unassignedReservations=unassignedReservations.filter(u=>!(u.reservationId&&existingIdMap.has(String(u.reservationId))));
    if(unassignedReservations.length<beforeLen){
      console.log(`[未割当キュー清掃] 名簿に既存の予約ID ${beforeLen-unassignedReservations.length}件を未割当エラーから除去しました`);
    }
  }

  for(let li=1;li<records.length;li++){
    const cols=parseCSVLine(records[li]);if(cols.length<5)continue;
    const kubun=get(cols,'予約区分');
    if(kubun==='キャンセル'){cancelled++;continue;}
    const ten=parseInt(get(cols,'泊目')||'1');if(ten!==1){skipped++;continue;}
    const cin=get(cols,'チェックイン日');if(!cin)continue;
    const [cy,cm,cd]=cin.split('/').map(Number);
    if(!cm||!cd)continue;
    const nights=parseInt(get(cols,'泊数')||'1');
    const typeName=get(cols,'部屋タイプ名称');
    const planName=get(cols,'商品プラン名称');
    const yoyakuNo=get(cols,'予約番号');

    // 備考：CSVのOTA文言は取り込まない（スタッフ手入力のみ備考扱い）
    // ただしチェックボックス自動判定用に、判定元テキストは別変数で保持
    const _detectText=[get(cols,'備考1'),get(cols,'備考2'),get(cols,'メモ')].filter(Boolean).join(' ').replace(/\n/g,' ');
    let note=''; // 表示用備考は空で初期化（手入力のみ反映）

    // ─── 商品プランルール適用（PLAN_RULES テーブル） ───────────
    // planName・判定元テキストにキーワードが含まれる場合、noteTagを備考に追記
    // （noteTagはgetCellIconsのアイコン自動判定に使用。OTA本文は含めない）
    PLAN_RULES.forEach(rule=>{
      if(planName.includes(rule.keyword)){
        if(!note.includes(rule.noteTag))note=note?note+' '+rule.noteTag:rule.noteTag;
      }
    });
    // 判定元テキスト（CSV備考）にキーワードが含まれる場合もnoteTagを追記
    PLAN_RULES.forEach(rule=>{
      if(_detectText.includes(rule.keyword)&&!note.includes(rule.noteTag))
        note=note?note+' '+rule.noteTag:rule.noteTag;
    });
    note=note.trim().slice(0,120);

    // ─── ④ 支払判定（根本修正）─────────────────────────────
    // CSVの決済方法パターン:「事前決済」「事前カード決済」「オンラインカード決済」
    //「クレジットカード」「決済代行」「NaN（空）」
    // 「Stripe」はCSVには存在しない。カード系は全て「事前決済」として扱う
    const payRaw=get(cols,'決済方法');
    const pointDiscount=parseFloat(get(cols,'ポイント割引額'))||0;
    let payMethod='事前決済';
    if(!payRaw&&pointDiscount>0){
      // 決済方法空欄かつポイント割引あり → 現金（ねっぱん仕様）
      payMethod='現金';
    } else if(payRaw){
      if(/現金|現地精算/i.test(payRaw)) payMethod='現金';
      else if(/銀行|振込/i.test(payRaw)) payMethod='銀行振込';
      // 事前決済・事前カード決済・オンラインカード決済・クレジットカード・決済代行
      // → すべて「事前決済」（Stripeはシステム内部でのみ使用）
      else payMethod='事前決済';
    }

    // ─── 予約サイト判定 ───────────────────────────────────
    const siteName=get(cols,'予約サイト名称');
    let site=siteName||'その他';
    if((siteName==='楽天トラベル'||siteName==='楽天')&&yoyakuNo.startsWith('TY'))site='HP';

    // ─── ⑤ 料金取得（Hostelworld専用ロジック）──────────────
    const priceRaw=get(cols,'料金合計額');
    const pointDiscount2=parseFloat(get(cols,'ポイント割引額'))||0;
    const biko1=get(cols,'備考1')||'';

    let price=priceRaw&&priceRaw!=='0'?parseFloat(priceRaw)||null:null;

    if(siteName==='Hostelworld'){
      // ① 備考1から「現地精算額」を正規表現で抽出
      const localMatch=biko1.match(/現地精算額[:\uff1a]([\d,.]+)/);
      const paidMatch=biko1.match(/支払済金額[:\uff1a]([\d,.]+)/);
      const localAmount=localMatch?Math.round(parseFloat(localMatch[1].replace(',',''))):null;
      const paidAmount=paidMatch?Math.round(parseFloat(paidMatch[1].replace(',',''))):null;

      if(localAmount!==null){
        // ① 最優先：現地精算額
        price=localAmount;
        // 支払方法：現地精算額と支払済金額が両方ある → 現金
        if(paidAmount!==null) payMethod='現金';
      } else if(pointDiscount2>0){
        // ② 代替：ポイント割引額（現地精算額として使われている）
        price=pointDiscount2;
        payMethod='現金';
      }
      // ③ どちらもない場合はpriceRawをそのまま使用（上で設定済み）
    }

    // ─── ⑥ 人数取得（性別はCSVに存在しない）────────────────
    const adults=parseInt(get(cols,'大人人数計'))||1;
    const children=parseInt(get(cols,'子供人数計'))||0;
    const guestCount=adults+children;
    // 性別情報はCSVに存在しないため空欄（手動で設定）
    const sex='';

    // ─── ⑦ 区分の自動判定（人数ベース）──────────────────────
    // 貸切は後で上書きするのでここでは部屋タイプで判定
    let cat='Ｇ';
    if(guestCount===1){
      cat='Ｓ'; // 1名→シングル
    } else if(guestCount===2){
      cat='Ｃ'; // 2名→カップル（男女混合の場合が多い）
    } else if(guestCount>=3){
      cat='Ｇ'; // 3名以上→グループ
    }
    // ドミトリー系は人数に関わらずS
    if(typeName&&(typeName.includes('ドミ')||typeName.includes('Dormitory'))){
      cat='Ｓ';
    }

    // ─── チェックイン時刻 ─────────────────────────────────
    let arrivalTime=get(cols,'チェックイン時刻')||'';
    if(!arrivalTime){
      const timeMatch=note.match(/(\d{1,2})[:\:時](\d{2})?/);
      if(timeMatch)arrivalTime=timeMatch[2]?`${timeMatch[1]}:${timeMatch[2]}`:`${timeMatch[1]}:00`;
    }
    if(arrivalTime){
      const tm=arrivalTime.replace(/[^\d:]/g,'').replace(/(\d{1,2})(\d{2})$/,'$1:$2');
      arrivalTime=tm.length>=4?tm:'';
    }

    // ─── 連絡先・住所・予約ID（貸切変更検知・部屋割当より前に必要なため早期定義） ──────
    const addr1=get(cols,'住所1')||'';
    const natGuessed=natFromAddress(addr1);
    const reservationId=(get(cols,'予約ID')||'').replace(/\D/g,'').slice(0,6);
    const phone=String(get(cols,'電話番号')||'').trim();
    let address=String(addr1).trim();
    if(!address && yoyakuNo && yoyakuNo.startsWith('TY')){
      const biko2addr=String(get(cols,'備考2')||'').trim();
      if(biko2addr){
        address=biko2addr.replace(/^\d+[:：]\s*/,'').trim();
      }
    }
    const _emailRe=/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/;
    let email=String(
      get(cols,'メールアドレス')||get(cols,'メール')||
      get(cols,'Email')||get(cols,'E-mail')||get(cols,'email')||get(cols,'EMAIL')||''
    ).trim();
    if(!email){
      const biko2=String(get(cols,'備考2')||get(cols,'メモ2')||'');
      const m2=biko2.match(_emailRe);
      if(m2) email=m2[0];
    }
    const guestName=get(cols,'宿泊者氏名')||get(cols,'予約者氏名')||'';
    if(!guestName){skipped++;continue;}

    // ─── ③ 貸切判定と重複除去 ─────────────────────────────
    const isCharter=planName.includes('貸切');
    const isAnnexCharter=isCharter&&(planName.includes('ANNEX')||planName.includes('annex'));
    const charterType=isCharter?(isAnnexCharter?'ANNEX貸切':'本館貸切'):null;

    // 同一予約番号の貸切は重複取り込みを防ぐ
    if(isCharter&&yoyakuNo&&processedCharter.has(yoyakuNo)){skipped++;continue;}
    if(isCharter&&yoyakuNo)processedCharter.add(yoyakuNo);

    // ─── 貸切変更検知（人数・金額・泊数の変更を反映）──────────────
    if(isCharter&&reservationId){
      const exCharter=findExistingReservationInfo(reservationId);
      if(exCharter){
        const changes=detectReservationChanges(exCharter,{
          checkinMonth:cm,checkinDay:cd,nights,guests:guestCount,
          price,note:'',phone:'',email:'',address:''
        });
        if(changes.length===0){
          dupSkipList.push({name:guestName,reservationId});
          skipped++;continue;
        }
        // 変更あり → 既存貸切セルを全削除して再書き込みへ
        clearReservationCells(reservationId);
        updatedCount++;
        updatedList.push({name:guestName,reservationId,changes,status:'反映'});
      }
    }

    // 貸切の区分は専用値
    if(isCharter)cat=charterType;

    // ─── 予約ID 3分岐判定（部屋割当の前に実施）─────────────────
    // ★重要：自分自身の既存セルが「空室なし」原因にならないよう、
    //   部屋を検索する前に既存予約の重複・変更を判定する
    let preservedNote=null; // CSV更新時にスタッフ手入力の備考を保護
    if(!isCharter && reservationId){
      const existing=findExistingReservationInfo(reservationId);
      if(existing){
        // 名簿上に既に存在する＝以前の取込エラーは解消済みのはず。
        // 残骸として未割当キューに残っていれば削除する（古いエラー表示を防ぐ）
        const staleIdx=unassignedReservations.findIndex(u=>u.reservationId&&String(u.reservationId)===String(reservationId));
        if(staleIdx>=0)unassignedReservations.splice(staleIdx,1);
        const changes=detectReservationChanges(existing,{
          checkinMonth:cm,checkinDay:cd,nights,guests:guestCount,
          price,note,phone,email,address
        });
        if(changes.length===0){
          // パターンB：完全重複 → スキップ（部屋検索すら不要）
          dupSkipList.push({name:guestName,reservationId});
          skipped++;continue;
        }
        // パターンC：変更あり → 既存セルを先に削除してから後続の部屋割当へ進む
        // （削除しておくことで、自分の古いセルが空室判定の邪魔にならない）
        preservedNote=existing.data.note||''; // スタッフ手入力の備考を保存
        clearReservationCells(reservationId);
        updatedCount++;
        updatedList.push({name:guestName,reservationId,changes,status:'反映'});
      } else {
        // 既存予約IDなし→新規。ただし手入力等で予約IDなしの同一予約が
        // カレンダー上にあれば重複スキップ（氏名＋チェックイン日で判定）
        const sameByNameDate=Object.values(guestData).some(d=>
          d&&!d.cont&&d.name===guestName&&d.day===cd&&!d.reservationId
        );
        if(sameByNameDate){
          dupSkipList.push({name:guestName,reservationId});
          skipped++;continue;
        }
      }
    } else if(!isCharter && !reservationId && yoyakuNo){
      // 予約IDなし：氏名+日付で重複チェック（reservationIdなしの既存のみ）
      const alreadyExists=Object.values(guestData).some(d=>
        d&&d.name===guestName&&d.day===cd&&!d.cont&&!d.reservationId
      );
      if(alreadyExists){skipped++;continue;}
    }

    // ─── 部屋割当 ────────────────────────────────────────
    let rid=0;
    let charterGroupRooms=[];
    let effectiveType=typeName||'';
    if(isCharter){
      if(isAnnexCharter){
        charterGroupRooms=rooms.filter(r=>r.group==='ANNEX−個室'||r.group==='ANNEX−ドミトリー');
      } else {
        charterGroupRooms=rooms.filter(r=>
          r.group==='本館−個室'||r.group==='本館−男女混合ドミトリー'
        );
      }
      rid=charterGroupRooms.length>0?charterGroupRooms[0].id:0;
    } else {
      rid=effectiveType?getRoomIdByType(effectiveType,cm,cd,nights,cy):0;
    }

    // 自動割当に失敗（空室なし）→ 未割当キューへ退避（既存予約を上書きしない）
    if(rid===null){
      if(guestName){
        // 既に未割当キューにある同一予約は重複追加しない
        if(!unassignedReservations.some(u=>u.reservationId&&u.reservationId===reservationId&&reservationId)){
          unassignedReservations.push({
            name:guestName,
            reservationId,
            yoyakuNo:yoyakuNo||'',
            checkinMonth:cm,checkinDay:cd,checkinYear:cy,nights,
            guests:guestCount,
            site,cat,sex,pay:payMethod,price,
            typeName:effectiveType,
            reason:_judgeAssignError(effectiveType,cm,cd,nights,guestCount,cy),
            addedAt:new Date().toISOString(),
          });
          if(updatedList.length && updatedList[updatedList.length-1].reservationId===reservationId){
            // 変更反映からの競合（日程変更で空室がなくなったケース）は理由を上書き
            unassignedReservations[unassignedReservations.length-1].reason='日程変更による部屋競合';
            updatedList[updatedList.length-1].status='競合エラー';
          }
        }
      }
      unassignedCount++;
      continue; // カレンダーには一切書き込まない
    }

    // ─── guestData への書き込み ───────────────────────────
    // 更新時はスタッフ手入力の備考を維持し、CSVのキーワードタグのみ追記
    if(preservedNote!==null){
      let merged=preservedNote;
      (note||'').split(' ').filter(Boolean).forEach(tag=>{if(!merged.includes(tag))merged=merged?merged+' '+tag:tag;});
      note=merged.trim();
    }
    const gBase={
      name:guestName,
      site,pay:payMethod,price,nat:natGuessed,sex,cat,note,
      phone,address,email,
      status:'reserved',roomId:rid,day:cd,guests:guestCount,
      arrivalTime,charter:isCharter,
      charterGroup:isCharter?(isAnnexCharter?'ANNEX':'本館'):null,
      reservationId,checkinUrl:generateCheckinUrl(reservationId),
    };

    if(isCharter&&charterGroupRooms.length>0){
      // 貸切: グループ全部屋×全泊に書き込み（月跨ぎ対応）
      // 【最終防衛】既存予約のある部屋・日程は上書きしない
      charterGroupRooms.forEach((room,ri)=>{
        for(let n=0;n<nights;n++){
          const {y:ny,m:nm,d:nd}=addDays(cm,cd,n,cy);
          if(guestData[gk(nm,room.id,nd,ny)])continue; // 既存予約を保護
          guestData[gk(nm,room.id,nd,ny)]={
            ...gBase,roomId:room.id,day:nd,
            price:ri===0&&n===0?gBase.price:null,
            cont:ri>0||n>0,
            charterAnchor:ri===0&&n===0,
          };
        }
      });
      charterCount++;
    } else {
      // 通常予約：3分岐判定（重複スキップ・変更検知）は部屋割当より前で完了済み。
      // ここでは既存IDの記録のみ行う（次の行との重複防止のため）。
      if(reservationId)existingIdMap.set(String(reservationId),true);
      // ドミトリーかつ大人2名以上 → 人数分のベッドに展開
      const isDorm=/ドミトリー/.test(typeName);
      const expandCount=(isDorm&&guestCount>=2)?guestCount:1;

      if(expandCount>=2){
        // 同一ドミエリア内で空きベッドを人数分探す
        const groupRooms=rooms.filter(r=>r.group===rooms.find(x=>x.id===rid)?.group)
          .slice().sort((a,b)=>getRoomPriority(a.id)-getRoomPriority(b.id));
        const assignedRoomIds=[];
        for(const r of groupRooms){
          if(assignedRoomIds.length>=expandCount)break;
          // 全泊空いているかチェック
          let avail=true;
          for(let n=0;n<nights;n++){
            const {y:ny,m:nm,d:nd}=addDays(cm,cd,n,cy);
            if(guestData[gk(nm,r.id,nd,ny)]){avail=false;break;}
          }
          if(avail)assignedRoomIds.push(r.id);
        }
        // 人数分のベッドが確保できた分だけ展開
        assignedRoomIds.forEach((roomId,gi)=>{
          const isFirst=gi===0;
          const extraNote=isFirst?note:(note?note+' ':'')+`[人数展開データ: ${reservationId||yoyakuNo}]`;
          for(let n=0;n<nights;n++){
            const {y:ny,m:nm,d:nd}=addDays(cm,cd,n,cy);
            guestData[gk(nm,roomId,nd,ny)]={
              ...gBase,roomId,day:nd,guests:1,note:extraNote,
              price:(isFirst&&n===0)?gBase.price:null,  // 料金は1人目の1泊目のみ
              cont:n>0,
            };
          }
        });
      } else {
        // 通常：月跨ぎ対応で全nights分を書き込む
        // 【最終防衛】書き込み先に既存予約があれば上書きせず未割当キューへ退避
        let blocked=false;
        for(let n=0;n<nights;n++){
          const {y:ny,m:nm,d:nd}=addDays(cm,cd,n,cy);
          if(guestData[gk(nm,rid,nd,ny)]){blocked=true;break;}
        }
        if(blocked){
          if(!unassignedReservations.some(u=>u.reservationId&&u.reservationId===reservationId&&reservationId)){
            unassignedReservations.push({
              name:guestName,reservationId,yoyakuNo:yoyakuNo||'',
              checkinMonth:cm,checkinDay:cd,checkinYear:cy,nights,guests:guestCount,
              site,cat,sex,pay:payMethod,price,typeName:typeName||'',
              reason:'連泊可能な空床なし',addedAt:new Date().toISOString(),
            });
          }
          unassignedCount++;
          continue;
        }
        for(let n=0;n<nights;n++){
          const {y:ny,m:nm,d:nd}=addDays(cm,cd,n,cy);
          guestData[gk(nm,rid,nd,ny)]={...gBase,day:nd,price:n===0?gBase.price:null,cont:n>0};
        }
      }
    }

    if(hasParkKw(note)){
      for(let n=0;n<nights;n++){
        const {y:ny,m:nm,d:nd}=addDays(cm,cd,n,cy);
        const dk=dateKey(ny,nm,nd);
        const pp=parkPrice(ny,nm,nd);const pk=parkData[dk]||[];
        if(!pk.some(e=>e.name===gBase.name&&e.type==='park-auto')){
          pk.push({id:nextParkId++,name:gBase.name,price:pp,note:'宿泊者（自動）',type:'park-auto'});
          parkData[dk]=pk;parkAdded++;
        }
      }
    }
    if(hasSurfKw(note)){addAutoSurf(gBase,cm);surfAdded++;}
    imported++;
    monthCounts[cm]=(monthCounts[cm]||0)+1;
  }

  const monthSummary=Object.entries(monthCounts).sort((a,b)=>a[0]-b[0]).map(([m,c])=>`${m}月:${c}件`).join('、');
  document.getElementById('import-result').innerHTML=`<div class="import-result">
    ✓ 取込完了：<strong>${imported}件</strong>（${monthSummary}）、<strong>${cancelled}件</strong>キャンセル除外
    ${updatedCount>0?`<br>🔄 変更反映：<strong>${updatedCount}件</strong>`:''}
    ${dupSkipList.length>0?`<br>ℹ 重複スキップ：<strong>${dupSkipList.length}件</strong>`:''}
    ${parkAdded>0?`<br>🚙 駐車場に<strong>${parkAdded}件</strong>自動追加`:''}
    ${surfAdded>0?`<br>🏄 サーフィンリストに<strong>${surfAdded}件</strong>自動追加`:''}
    ${charterCount>0?`<br>🔒 貸切予約 <strong>${charterCount}件</strong>検出`:''}
    ${unassignedCount>0?`<br><span style="color:#c0392b;font-weight:700;">⚠ 割当エラー：${unassignedCount}件（名簿へ未反映・下記から手動割当してください）</span>`:''}
  </div>${skipped>0?`<div class="import-warn">※ 2泊目以降（${skipped}行）はスキップ</div>`:''}
  ${updatedList.length>0?`<div class="import-changes" style="background:#fff8e1;border-left:4px solid #f9a825;padding:10px 14px;border-radius:6px;margin-top:8px;font-size:12px;">
    <div style="font-weight:700;margin-bottom:6px;color:#7a5800;">🔄 予約内容の変更（${updatedList.length}件）</div>
    ${updatedList.map(u=>`<div style="padding:3px 0;border-bottom:1px dashed #eee;">
      <strong>${esc(u.name)}</strong> <span style="color:#888;">#${esc(u.reservationId||'')}</span>
      <span style="margin-left:8px;color:#7a5800;">${esc(u.changes.join('・'))}</span>
      ${u.status==='競合エラー'?'<span style="color:#c0392b;font-weight:700;margin-left:8px;">⚠ 競合（手動割当が必要）</span>':''}
    </div>`).join('')}
  </div>`:''}
  ${dupSkipList.length>0?`<div class="import-dups" style="background:#f0f4f8;border-left:4px solid #90a4ae;padding:10px 14px;border-radius:6px;margin-top:8px;font-size:12px;">
    <div style="font-weight:700;margin-bottom:6px;color:#546e7a;">ℹ 重複スキップ（${dupSkipList.length}件・変更なしのため未処理）</div>
    <div style="color:#546e7a;font-size:11px;">${dupSkipList.map(d=>`${esc(d.name)} <span style="color:#999;">#${esc(d.reservationId||'')}</span>`).join(' / ')}</div>
  </div>`:''}`;
  renderUnassignedPanel();
  renderReg();autoSave();
}

// ══════════════════════════════════════════════
//  未割当予約パネル＆手動割当
// ══════════════════════════════════════════════
function renderUnassignedPanel(){
  const el=document.getElementById('unassigned-panel');
  if(!el)return;
  if(!unassignedReservations.length){ el.innerHTML=''; el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML=`
    <div style="margin-top:16px;padding:14px 16px;background:#fff5f5;border:1.5px solid #f0b0b0;border-radius:8px;">
      <div style="font-size:13px;font-weight:700;color:#c0392b;margin-bottom:10px;">⚠ 部屋割当エラー（${unassignedReservations.length}件）</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${unassignedReservations.map((u,i)=>{
          const co=_calcCheckout(u.checkinMonth,u.checkinDay,u.nights);
          return `<div style="background:#fff;border:1px solid #e0c0c0;border-radius:6px;padding:10px 12px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;color:#1a2b3a;font-size:13px;margin-bottom:3px;">${esc(u.name)} <span style="font-weight:400;color:#888;font-size:11px;">${u.reservationId?'#'+esc(u.reservationId):''}</span></div>
                <div style="color:#666;line-height:1.6;">
                  ${u.checkinMonth}/${u.checkinDay} → ${co}　${u.nights}泊　${u.guests}名　${esc(u.site||'')}<br>
                  希望: ${esc(u.typeName||'-')}　区分: ${esc(u.cat||'-')}<br>
                  <span style="color:#c0392b;font-weight:600;">理由: ${esc(u.reason||'空室不足')}</span>
                </div>
              </div>
              <button onclick="openManualAssign(${i})" class="btn btn-blue btn-xs" style="flex-shrink:0;white-space:nowrap;">名簿へ手動追加</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function _calcCheckout(m,d,nights){
  const {m:om,d:od}=addDays(m,d,nights||1);
  return `${om}/${od}`;
}

let _manualAssignIdx=null;
function openManualAssign(idx){
  _manualAssignIdx=idx;
  const u=unassignedReservations[idx];
  if(!u)return;
  // 部屋セレクト生成（全部屋、空き状況付き）
  const sel=document.getElementById('ma-room');
  sel.innerHTML=rooms.map(r=>{
    let free=true;
    for(let n=0;n<(u.nights||1);n++){
      const {y:ny,m:nm,d:nd}=addDays(u.checkinMonth,u.checkinDay,n,u.checkinYear);
      if(guestData[gk(nm,r.id,nd,ny)]){free=false;break;}
    }
    return `<option value="${r.id}">${r.no}　${r.type}　${free?'（空き）':'⚠ 埋まっています'}</option>`;
  }).join('');
  document.getElementById('ma-info').textContent=`${u.name} / ${u.checkinMonth}/${u.checkinDay} ${u.nights}泊 ${u.guests}名`;
  document.getElementById('manual-assign-modal').classList.add('open');
}

function saveManualAssign(){
  const idx=_manualAssignIdx;
  const u=unassignedReservations[idx];
  if(!u)return;
  const rid=parseInt(document.getElementById('ma-room').value);
  // 空き再チェック（保険：既存予約を絶対上書きしない）
  for(let n=0;n<(u.nights||1);n++){
    const {y:ny,m:nm,d:nd}=addDays(u.checkinMonth,u.checkinDay,n,u.checkinYear);
    if(guestData[gk(nm,rid,nd,ny)]){
      alert('選択した部屋は'+nm+'/'+nd+'に既に予約が入っています。別の部屋を選んでください。');
      return;
    }
  }
  // guestDataへ書き込み（全泊）
  const gBase={
    name:u.name,site:u.site,pay:u.pay,price:u.price,nat:'',sex:u.sex||'',cat:u.cat||'Ｓ',note:'',
    phone:'',address:'',email:'',
    status:'reserved',roomId:rid,day:u.checkinDay,guests:u.guests||1,
    arrivalTime:'',charter:false,charterGroup:null,
    reservationId:u.reservationId||'',checkinUrl:generateCheckinUrl(u.reservationId||''),
  };
  for(let n=0;n<(u.nights||1);n++){
    const {y:ny,m:nm,d:nd}=addDays(u.checkinMonth,u.checkinDay,n,u.checkinYear);
    guestData[gk(nm,rid,nd,ny)]={...gBase,day:nd,price:n===0?u.price:null,cont:n>0};
  }
  // キューから削除
  unassignedReservations.splice(idx,1);
  _manualAssignIdx=null;
  document.getElementById('manual-assign-modal').classList.remove('open');
  renderUnassignedPanel();
  renderReg();saveToLS();autoSave();
  showToast('✓ '+u.name+'様を名簿へ追加しました');
}

// ============================================================
// OCCUPANCY — 実データ版（日別累計予約者数）
// ============================================================
function getTodayGuestCount(month){
  if(NOW.getFullYear()!==2026||NOW.getMonth()+1!==month)return null;
  const day=NOW.getDate();
  const hour=NOW.getHours();
  if(hour<22)return null;
  // ③ roomFilter適用
  const targetRooms=rooms.filter(r=>roomFilter[r.group]!==false);
  let count=0;
  for(let m2=1;m2<=month;m2++){
    const days2=m2<month?gDays(2026,m2):day;
    for(let d=1;d<=days2;d++){
      targetRooms.forEach(room=>{
        const k=gk(m2===month?month:m2,room.id,d);
        const g=guestData[k];
        if(g&&!g.cont&&g.status!=='cancelled')count++;
      });
    }
  }
  return count>0?count:null;
}

// ============================================================
// 稼働率：自動計算・編集
// ============================================================

// ① 22時以降に当日guestDataを集計してoccCumulに反映
function autoCalcTodayOcc(force=false){
  const now=new Date();
  const jst=new Date(now.getTime()+9*60*60*1000);
  const h=jst.getUTCHours(), m=jst.getUTCMonth()+1, d=jst.getUTCDate(), y=jst.getUTCFullYear();
  if(!force && h<22)return;

  // renderRegのusedCells（名簿の今月予約数と完全一致）を直接使用
  const usedCells=window._lastUsedCells;
  const monthMatch=(window._lastRenderRegYear===y && window._lastRenderRegMonth===m);

  if(!monthMatch || usedCells==null){
    if(force)showToast('⚠ 先に名簿画面（'+m+'月表示）を開いてから反映してください');
    return;
  }

  // 既存データをコピー（過去日のExcelデータを維持）
  const days=gDays(y,m);
  if(!occCumul[y])occCumul[y]={};
  if(!occCumul[y][m])occCumul[y][m]=Array(days).fill(null);
  const cumul=[...occCumul[y][m]];

  // 当日(d日)に usedCells を書き込む（d-1より前は変更しない）
  cumul[d-1]=usedCells;
  occCumul[y][m]=cumul;

  if(force){
    showToast(`📊 ${m}月${d}日に${usedCells}セルを反映しました`);
  } else {
    showToast(`📊 ${m}月${d}日の稼働データを自動保存しました`, 4000);
  }
  stopPolling();autoSave();setTimeout(()=>startPolling(),5000);
  if(document.getElementById('page-occupancy')?.classList.contains('active'))renderOcc();
}

// ② セル編集
let occEditYear=null,occEditMonth=null,occEditDay=null;
function openOccEdit(y,m,d){
  occEditYear=y;occEditMonth=m;occEditDay=d;
  const v=occCumul[y]&&occCumul[y][m]?occCumul[y][m][d-1]:null;
  document.getElementById('occ-edit-title').textContent=`${y}年${m}月${d}日 累計宿泊者数`;
  document.getElementById('occ-edit-val').value=v!=null?v:'';
  document.getElementById('occ-edit-modal').classList.add('open');
  setTimeout(()=>document.getElementById('occ-edit-val').select(),50);
}
function saveOccEdit(){
  const raw=document.getElementById('occ-edit-val').value.trim();
  const val=raw===''?null:parseInt(raw);
  if(!occCumul[occEditYear])occCumul[occEditYear]={};
  if(!occCumul[occEditYear][occEditMonth])
    occCumul[occEditYear][occEditMonth]=Array(gDays(occEditYear,occEditMonth)).fill(null);
  occCumul[occEditYear][occEditMonth][occEditDay-1]=val;
  closeM('occ-edit-modal');
  renderOcc();autoSave();
  showToast(`☁ ${occEditYear}年${occEditMonth}月${occEditDay}日を保存しました`);
}
function clearOccEdit(){
  document.getElementById('occ-edit-val').value='';saveOccEdit();
}

function getOccData(year,month){
  // ③ 集計対象フィルタ適用（名簿側と同一の「室数ベース」に統一：部屋数×日数を100%とする）
  const targetRooms=rooms.filter(r=>roomFilter[r.group]!==false);
  const totalRoomCount=targetRooms.length;
  const days=gDays(year,month);
  const maxCumul=totalRoomCount*days; // 例: 30室×30日=900セルが100%（名簿側のtotalCellsと同一定義）

  // 実データあり
  if(occCumul[year]&&occCumul[year][month]){
    return {data:occCumul[year][month],max:maxCumul,isReal:true};
  }
  // 推計データ
  const total=(occMonthlyTotal[year]||[])[month-1];
  if(total==null)return null;
  const cumul=[];
  let sum=0;
  for(let d=1;d<=days;d++){
    const dow=gDow(year,month,d);
    const w=dow===0||dow===6?1.5:0.85;
    sum+=Math.max(1,Math.round(total/days*w));
    cumul.push(Math.min(total,Math.round(sum)));
  }
  return {data:cumul,max:maxCumul,isReal:false};
}

function renderOcc(){
  const year=parseInt(document.getElementById('occ-year').value);
  const cmpYearVal=document.getElementById('occ-cmp-year').value;
  const cmpYear=cmpYearVal?parseInt(cmpYearVal):null;

  // 今日の通知
  const noticeEl=document.getElementById('occ-today-notice');
  if(year===2026&&NOW.getFullYear()===2026){
    const m=NOW.getMonth()+1,d=NOW.getDate(),h=NOW.getHours();
    noticeEl.textContent=h>=22?`✓ 今日（${m}/${d}）22時時点のデータを反映済み`:`今日（${m}/${d}）のデータは22時以降に自動反映`;
  } else {noticeEl.textContent='';}

  // 年間サマリー
  const months=Array.from({length:12},(_,i)=>i+1);
  const yearTotals=months.map(m=>{const d=getOccData(year,m);return d?d.data.filter(v=>v!=null).reduce((a,b)=>Math.max(a,b||0),0):null;});
  const validTotals=yearTotals.filter(v=>v);
  const grandMax=validTotals.length?validTotals.reduce((s,v)=>s+v,0):0;
  document.getElementById('occ-stats').innerHTML=`
    <div class="sc" style="flex:1;"><div class="sl">${year}年 累計最大値</div><div class="sv">${grandMax.toLocaleString()}</div><div class="ss">人</div></div>
    <div class="sc" style="flex:1;"><div class="sl">データ月数</div><div class="sv">${validTotals.length}</div><div class="ss">ヶ月</div></div>
    ${cmpYear?`<div class="sc" style="flex:1;"><div class="sl">${cmpYear}年 比較</div><div class="sv" style="font-size:13px;color:#888;">${cmpYear}年と比較中</div></div>`:''}`;

  // 現在月を初期選択（当年なら今月、それ以外は1月）
  const defaultMonth=(year===NOW.getFullYear())?NOW.getMonth()+1:
    validTotals.findIndex(v=>v!=null)+1||1;

  // 月タブ生成
  const monthLabels=['1','2','3','4','5','6','7','8','9','10','11','12'];
  const tabsEl=document.getElementById('occ-month-tabs');
  tabsEl.innerHTML=monthLabels.map((mn,mi)=>{
    const cur=getOccData(year,mi+1);
    const hasData=!!cur;
    const curLast=cur?cur.data.filter(v=>v!=null).slice(-1)[0]:null;
    const pct=cur&&curLast?Math.round(curLast/cur.max*1000)/10:null;
    const isActive=mi+1===defaultMonth;
    const pctColor=pct!=null?(pct>=80?'#16a34a':pct>=50?'#185FA5':'#888'):'#ccc';
    return `<button id="occ-tab-${mi+1}" onclick="selectOccMonth(${mi+1})"
      style="padding:6px 10px;border-radius:8px;border:1.5px solid ${isActive?'#185FA5':'#e8e6e0'};background:${isActive?'#eef4fc':'#fff'};cursor:pointer;min-width:52px;text-align:center;transition:all .12s;${!hasData?'opacity:.4;':''}">
      <div style="font-size:12px;font-weight:${isActive?'600':'400'};color:${isActive?'#185FA5':'#333'};">${mn}月</div>
      <div style="font-size:10px;font-weight:600;color:${pctColor};">${pct!=null?pct+'%':'—'}</div>
    </button>`;
  }).join('');

  selectOccMonth(defaultMonth,year,cmpYear);
}

function selectOccMonth(month,year,cmpYear){
  // 引数なしで呼ばれた場合は現在の選択値から取得
  if(year===undefined)year=parseInt(document.getElementById('occ-year').value);
  if(cmpYear===undefined){const v=document.getElementById('occ-cmp-year').value;cmpYear=v?parseInt(v):null;}

  // タブのアクティブ状態更新
  Array.from({length:12},(_,i)=>i+1).forEach(m=>{
    const btn=document.getElementById(`occ-tab-${m}`);
    if(!btn)return;
    const isActive=m===month;
    btn.style.border=`1.5px solid ${isActive?'#185FA5':'#e8e6e0'}`;
    btn.style.background=isActive?'#eef4fc':'#fff';
    btn.querySelector('div').style.fontWeight=isActive?'600':'400';
    btn.querySelector('div').style.color=isActive?'#185FA5':'#333';
  });

  const monthLabel=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'][month-1];
  const cur=getOccData(year,month);
  const cmp=cmpYear?getOccData(cmpYear,month):null;
  const days=gDays(year,month);
  const curMax=cur?cur.max:null;
  const cmpMax=cmp?cmp.max:null;
  let curLast=cur?cur.data.filter(v=>v!=null).slice(-1)[0]:null;
  // 集計対象部屋フィルタのリアルタイム反映：
  // 名簿（renderReg）が同じ年月を最後に描画していれば、その時点のフィルター後usedCellsで上書きする
  if(window._lastRenderRegYear===year && window._lastRenderRegMonth===month && window._lastUsedCells!=null){
    curLast=window._lastUsedCells;
  }
  const pct=curMax&&curLast!=null?Math.round(curLast/curMax*1000)/10:null;
  const cmpLast=cmp?cmp.data.filter(v=>v!=null).slice(-1)[0]:null;
  const cmpPct=cmpMax&&cmpLast?Math.round(cmpLast/cmpMax*1000)/10:null;
  const dataTag=cur&&cur.isReal?'<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:1px 5px;border-radius:3px;margin-left:6px;">実データ</span>':'<span style="font-size:10px;background:#f1f5f9;color:#64748b;padding:1px 5px;border-radius:3px;margin-left:6px;">推計</span>';

  document.getElementById('occ-month-title').innerHTML=`${year}年 ${monthLabel} ${cur?dataTag:''}`;
  document.getElementById('occ-month-stats').innerHTML=`
    <div class="sc" style="flex:1;min-width:0;"><div class="sl">${year}年 月末累計</div><div class="sv" style="font-size:17px;">${curLast!=null?curLast+'人':'—'}</div></div>
    <div class="sc" style="flex:1;min-width:0;"><div class="sl">稼働率</div><div class="sv" style="font-size:17px;color:${pct!=null?(pct>=80?'#16a34a':pct>=50?'#185FA5':'#888'):'#ccc'};">${pct!=null?pct+'%':'—'}</div></div>
    ${cmpYear?`<div class="sc" style="flex:1;min-width:0;"><div class="sl">${cmpYear}年 月末累計</div><div class="sv" style="font-size:17px;color:#888;">${cmpLast!=null?cmpLast+'人':'—'}</div></div>`:''}
    ${cmpYear?`<div class="sc" style="flex:1;min-width:0;"><div class="sl">${cmpYear}年 稼働率</div><div class="sv" style="font-size:17px;color:#ea580c;">${cmpPct!=null?cmpPct+'%':'—'}</div></div>`:''}`;

  // チャート描画
  occCharts.forEach(c=>{try{c.destroy();}catch(e){}});occCharts=[];
  const ctx=document.getElementById('occ-chart');if(!ctx)return;
  const labels=Array.from({length:days},(_,i)=>i+1);
  const curData=cur?cur.data.slice(0,days):null;
  const cmpData=cmp?cmp.data.slice(0,days):null;
  const pctLine=curData&&curMax?curData.map(v=>v!=null?Math.min(100,Math.round(v/curMax*100)):null):null;
  const cmpPctLine=cmpData&&cmpMax?cmpData.map(v=>v!=null?Math.min(100,Math.round(v/cmpMax*100)):null):null;
  const todayCount=(year===2026)?getTodayGuestCount(month):null;

  const datasets=[];
  if(curData)datasets.push({type:'bar',label:`${year}年 累計`,data:curData,backgroundColor:'rgba(96,165,250,0.55)',borderColor:'rgba(59,130,246,0.7)',borderWidth:0.5,borderRadius:2,yAxisID:'y'});
  if(cmpData)datasets.push({type:'bar',label:`${cmpYear}年 累計`,data:cmpData,backgroundColor:'rgba(251,146,60,0.38)',borderColor:'rgba(234,88,12,0.55)',borderWidth:0.5,borderRadius:2,yAxisID:'y'});
  if(pctLine)datasets.push({type:'line',label:`稼働率(${year})`,data:pctLine,borderColor:'#185FA5',borderWidth:2,pointRadius:0,fill:false,tension:0.4,yAxisID:'y2'});
  if(cmpPctLine)datasets.push({type:'line',label:`稼働率(${cmpYear})`,data:cmpPctLine,borderColor:'#ea580c',borderWidth:1.5,pointRadius:0,fill:false,tension:0.4,yAxisID:'y2',borderDash:[4,3]});
  if(todayCount&&NOW.getMonth()+1===month){
    datasets.push({type:'scatter',label:'今日',data:[{x:NOW.getDate(),y:todayCount}],backgroundColor:'#dc2626',borderColor:'#dc2626',pointRadius:6,pointHoverRadius:8,yAxisID:'y'});
  }

  const chart=new Chart(ctx,{
    data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      onClick(e,els){
        // バーをクリックで編集モーダル
        if(els.length){
          const idx=els[0].index;
          openOccEdit(year,month,idx+1);
        }
      },
      plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false,callbacks:{
        title:items=>`${year}年${month}月${items[0].label}日`,
        label:i=>`${i.dataset.label}: ${i.parsed.y!=null?i.parsed.y+(i.dataset.yAxisID==='y2'?'%':'人'):'—'}`
      }}},
      scales:{
        x:{ticks:{callback:(v,i)=>((i+1)%5===0||(i+1)===1||(i+1)===days)?i+1:'',font:{size:10}},grid:{display:false}},
        y:{min:0,position:'left',title:{display:true,text:'累計人数',font:{size:10}},ticks:{font:{size:10},maxTicksLimit:5},grid:{color:'rgba(0,0,0,.04)'}},
        y2:{min:0,max:100,position:'right',title:{display:true,text:'稼働率',font:{size:10}},ticks:{callback:v=>v+'%',font:{size:10},stepSize:25},grid:{display:false}}
      }
    }
  });
  occCharts.push(chart);
}

// ============================================================
// SALES TABLE & CHART
// ============================================================
// ── 売上イベント帯 ──────────────────────────────
let salesEvents=[];
function loadSalesEvents(){
  try{const s=localStorage.getItem('hotel_salesEvents');if(s)salesEvents=JSON.parse(s);}catch(e){}
  // 初期プリセット（コロナ禍）
  if(!salesEvents.length){
    salesEvents=[{id:1,name:'コロナ禍',sy:2020,sm:4,ey:2022,em:3,color:'#E24B4A'}];
    saveSalesEventsLS();
  }
}
function saveSalesEventsLS(){
  try{localStorage.setItem('hotel_salesEvents',JSON.stringify(salesEvents));}catch(e){}
}
function openSalesEventModal(){
  document.getElementById('sales-event-modal').classList.add('open');
}
function saveSalesEvent(){
  const name=document.getElementById('se-name').value.trim();
  if(!name){showToast('イベント名を入力してください');return;}
  const sy=parseInt(document.getElementById('se-sy').value);
  const sm=parseInt(document.getElementById('se-sm').value);
  const ey=parseInt(document.getElementById('se-ey').value);
  const em=parseInt(document.getElementById('se-em').value);
  const color=document.querySelector('input[name="se-color"]:checked').value;
  salesEvents.push({id:Date.now(),name,sy,sm,ey,em,color});
  saveSalesEventsLS();
  closeM('sales-event-modal');
  renderSales();
  document.getElementById('se-name').value='';
}
function deleteSalesEvent(id){
  salesEvents=salesEvents.filter(e=>e.id!==id);
  saveSalesEventsLS();
  renderSales();
}
function renderSalesEventsList(){
  const el=document.getElementById('sales-events-list');
  if(!el)return;
  if(!salesEvents.length){el.innerHTML='';return;}
  el.innerHTML=salesEvents.map(ev=>`
    <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:16px;border:1.5px solid ${ev.color};background:${ev.color}18;font-size:11px;">
      <span style="width:10px;height:10px;border-radius:2px;background:${ev.color};flex-shrink:0;"></span>
      <span style="font-weight:600;color:#333;">${ev.name}</span>
      <span style="color:#888;">${ev.sy}/${ev.sm}〜${ev.ey}/${ev.em}</span>
      <button onclick="deleteSalesEvent(${ev.id})" style="background:none;border:none;cursor:pointer;color:#aaa;font-size:13px;padding:0 0 0 4px;line-height:1;">✕</button>
    </div>`).join('');
}

let salesChart=null;
let salesEditYear=null,salesEditMonth=null;
function openSalesEdit(y,m){
  salesEditYear=y; salesEditMonth=m;
  const v=salesData[y]&&salesData[y][m];
  document.getElementById('sales-edit-title').textContent=`${y}年${m}月の売上`;
  document.getElementById('sales-edit-val').value=v||'';
  document.getElementById('sales-edit-modal').classList.add('open');
  setTimeout(()=>document.getElementById('sales-edit-val').select(),50);
}
function saveSalesEdit(){
  const raw=document.getElementById('sales-edit-val').value.trim();
  const val=raw===''?null:parseInt(raw)||null;
  const y=parseInt(salesEditYear),m=parseInt(salesEditMonth);
  if(!salesData[y])salesData[y]={};
  salesData[y][m]=val; // 数値キーで保存
  closeM('sales-edit-modal');
  renderSales();
  autoSave();
  showToast(`☁ ${y}年${m}月を保存しました`);
}
function clearSalesEdit(){
  document.getElementById('sales-edit-val').value='';
  saveSalesEdit();
}
function renderSales(){
  const years=[2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
  // JSON復元後は年・月キーが文字列になるため毎回数値に正規化
  Object.keys(salesData).forEach(yk=>{
    const yi=parseInt(yk);
    const src=salesData[yk];
    if(!src)return;
    const normalized={};
    Object.keys(src).forEach(mk=>{
      const key=mk==='total'?'total':parseInt(mk);
      normalized[key]=src[mk];
    });
    salesData[yi]=normalized;
    if(String(yi)!==String(yk))delete salesData[yk]; // 文字列キーを削除
  });
  const months=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月','合計'];
  const colors=['#94a3b8','#60a5fa','#34d399','#f59e0b','#f87171','#a78bfa','#fb923c','#4ade80','#38bdf8','#e879f9','#185FA5'];

  // イベント帯ヘルパー：hex色→rgba変換
  function hexToRgba(hex,a){
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  // 年・月がいずれかのイベント帯に含まれるか判定
  function getEventForCell(y,m){
    for(const ev of salesEvents){
      const start=ev.sy*12+ev.sm;
      const end=ev.ey*12+ev.em;
      const cur=y*12+m;
      if(cur>=start&&cur<=end)return ev;
    }
    return null;
  }

  // Table ヘッダー（1行のみ：イベント枠なし）
  let th='<tr><th style="background:#faf9f6;padding:7px 10px;border:1px solid #e8e6e0;font-size:11px;color:#888;min-width:48px;">年</th>';
  for(let m=1;m<=12;m++){
    th+=`<th style="background:#faf9f6;padding:7px 8px;border:1px solid #e8e6e0;font-size:11px;color:#888;text-align:right;min-width:72px;">${m}月</th>`;
  }
  th+='<th style="background:#faf9f6;padding:7px 8px;border:1px solid #e8e6e0;font-size:11px;color:#888;text-align:right;min-width:64px;">合計</th></tr>';

  let rows='';
  years.forEach((y,yi)=>{
    const d=salesData[y];if(!d)return;
    rows+=`<tr>`;
    rows+=`<td style="padding:6px 10px;border:1px solid #e8e6e0;font-weight:600;font-size:12px;color:#333;background:#faf9f6;">${y}</td>`;
    for(let m=1;m<=12;m++){
      const v=d[m];
      const ev=getEventForCell(y,m);
      const evBg=ev?hexToRgba(ev.color,0.1):'';
      const evBorderTop=ev?`border-top:2px solid ${hexToRgba(ev.color,0.5)};`:'';
      const hoverBg=ev?hexToRgba(ev.color,0.22):'#f0f4ff';
      const cellStyle=`padding:6px 8px;border:1px solid #e8e6e0;${evBorderTop}text-align:right;font-size:11px;cursor:pointer;transition:background .12s;${evBg?'background:'+evBg+';':''}`;
      const valStyle=v?'color:#1a1a1a;':'color:#ccc;';
      rows+=`<td style="${cellStyle}${valStyle}" onclick="openSalesEdit(${y},${m})" title="${y}年${m}月を編集${ev?' ['+ev.name+']':''}"
        onmouseenter="this.style.background='${hoverBg}'" onmouseleave="this.style.background='${evBg}'"
        >${v?'¥'+(v/10000).toFixed(0)+'万':'—'}</td>`;
    }
    // 合計列
    const tot=Object.keys(d).filter(k=>k!=='total'&&d[k]).reduce((s,k)=>s+(d[k]||0),0)||null;
    salesData[y].total=tot;
    rows+=`<td style="padding:6px 8px;border:1px solid #e8e6e0;text-align:right;font-size:11px;font-weight:600;color:#185FA5;background:#eef4fc;">${tot?'¥'+(tot/10000).toFixed(0)+'万':'—'}</td>`;
    rows+='</tr>';
  });
  document.getElementById('sales-table').innerHTML=`<thead>${th}</thead><tbody>${rows}</tbody>`;

  // Chart
  if(salesChart){salesChart.destroy();salesChart=null;}
  const datasets=years.map((y,yi)=>{
    const d=salesData[y];if(!d)return null;
    const vals=Array.from({length:12},(_,mi)=>d[mi+1]||null);
    return {label:String(y),data:vals,borderColor:colors[yi],backgroundColor:colors[yi]+'22',borderWidth:y===2026?2.5:1.5,pointRadius:y===2026?3:2,pointHoverRadius:5,fill:false,tension:0.3,borderDash:y===2026?[4,3]:[]};
  }).filter(Boolean);

  const ctx=document.getElementById('sales-chart');
  salesChart=new Chart(ctx,{
    type:'line',
    data:{labels:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{mode:'index',intersect:false,callbacks:{label:i=>`${i.dataset.label}: ¥${i.parsed.y?Math.round(i.parsed.y/10000)+'万':'—'}`}}
      },
      scales:{
        x:{ticks:{font:{size:11}},grid:{color:'rgba(0,0,0,.05)'}},
        y:{ticks:{callback:v=>'¥'+(v/10000).toFixed(0)+'万',font:{size:10}},grid:{color:'rgba(0,0,0,.05)'}}
      }
    }
  });
  renderSalesEventsList();

  const leg=document.getElementById('sales-legend');
  leg.innerHTML=years.map((y,i)=>`<div style="display:flex;align-items:center;gap:4px;"><div style="width:20px;height:3px;background:${colors[i]};border-radius:2px;${y===2026?'border:1px dashed '+colors[i]+';background:transparent;':''}" ></div><span style="color:#555;">${y}</span></div>`).join('');
}

// ============================================================
// PARKING
// ============================================================
function renderParking(){
  const y=parkYear,m=parkMonth;
  document.getElementById('park-month-label').textContent=`${y}年${m}月`;
  const firstDay=new Date(y,m-1,1).getDay();
  const days=gDays(y,m);
  let html='';let monthTotal=0;
  for(let i=0;i<firstDay;i++)html+=`<div class="park-cell other-month"></div>`;
  for(let d=1;d<=days;d++){
    const dow=new Date(y,m-1,d).getDay();
    const dk=dateKey(y,m,d);
    const hol=HOLIDAYS_2026.has(dk);
    const price=parkPrice(y,m,d);
    const dowCls=dow===0||hol?'sun':dow===6?'sat':'';
    const holCls=hol?'holiday':'';
    const entries=(parkData[dk]||[]).filter(e=>e.type!=='surf-auto');
    entries.forEach(e=>{monthTotal+=(e.price||0);});
    html+=`<div class="park-cell ${dowCls} ${holCls}" ondblclick="openParkAdd('${dk}')">`;
    html+=`<div class="park-date">${d}</div>`;
    if(hol)html+=`<div class="park-hol">${HOLIDAY_NAMES[dk]||'祝'}</div>`;
    html+=`<div class="park-price">¥${price.toLocaleString()}/日</div>`;
    entries.forEach(e=>{
      const cls=e.type==='park-auto'?'auto-park':'';
      html+=`<div class="park-entry ${cls}" onclick="event.stopPropagation();openParkEdit('${dk}',${e.id})" title="${esc(e.name)} ¥${(e.price||0).toLocaleString()}">🚙${esc(e.name.split(/\s/)[0])} ${e.price?'¥'+e.price.toLocaleString():''}</div>`;
    });
    html+=`</div>`;
  }
  const trail=(7-(firstDay+days)%7)%7;
  for(let i=0;i<trail;i++)html+=`<div class="park-cell other-month"></div>`;
  document.getElementById('park-grid').innerHTML=html;
  // サマリーチップ
  let manualTotal=0,manualCnt=0,autoCnt=0,autoTotal=0;
  Object.values(parkData).forEach(entries=>(entries||[]).forEach(e=>{
    if(e.type==='surf-auto')return;
    const ym=Object.keys(parkData).find(k=>parkData[k]===entries)||'';
    // 当月分のみ集計（park-gridで使ったmonthTotalと同じ範囲）
  }));
  // 当月分のみ再集計
  manualTotal=0;manualCnt=0;autoCnt=0;autoTotal=0;
  for(let d=1;d<=days;d++){
    const dk=dateKey(y,m,d);
    (parkData[dk]||[]).filter(e=>e.type!=='surf-auto').forEach(e=>{
      if(e.type==='park-auto'){autoCnt++;autoTotal+=(e.price||0);}
      else{manualCnt++;manualTotal+=(e.price||0);}
    });
  }
  const totalCnt=manualCnt+autoCnt;
  document.getElementById('park-summary').innerHTML=
    `<div class="rs-summary-chip" style="background:#eef2ff;color:#3730a3;"><span style="font-size:10px;">今月売上</span><span style="font-size:16px;">¥${monthTotal.toLocaleString()}</span></div>`
   +`<div class="rs-summary-chip" style="background:#f0fdf4;color:#166534;"><span style="font-size:10px;">利用件数</span><span style="font-size:16px;">${totalCnt}件</span></div>`
  ;
}

// ============================================================
// レンタルスペース専用 クラウド保存・読込
// ============================================================
async function rentalCloudSave(){
  if(!GAS_URL)return;
  try{
    const res=await fetch(_withKey(GAS_URL),{
      method:'POST',
      // Content-Typeヘッダーなし（既存cloudSaveと同じパターン）
      body:JSON.stringify({
        type:'rental',
        rentalSpaceReservations,
        updatedBy:(staffNames&&staffNames[0])||'操作者',
      }),
    });
    const json=await res.json();
    if(json.status==='ok'){
      showToast('📷 レンタルデータを保存しました');
    } else if(json.error){
      showToast('⚠ レンタル保存エラー: '+json.error);
    }
  }catch(e){
    console.warn('rentalCloudSave失敗',e);
    showToast('⚠ レンタル保存失敗');
  }
}

async function rentalCloudLoad(silent=false){
  if(!GAS_URL)return;
  try{
    // GASのdoGetはURLパラメータをe.parameterで受け取る
    const res=await fetch(_withKey(GAS_URL+'?type=rental&t='+Date.now()));
    const text=await res.text();
    let json;
    try{ json=JSON.parse(text); }
    catch(pe){ throw new Error('レスポンスのJSONパース失敗: '+text.slice(0,100)); }
    if(json.error)throw new Error(json.error);
    if(json.rentalSpaceReservations){
      rentalSpaceReservations=json.rentalSpaceReservations;
      nextRentalId=rentalSpaceReservations.reduce((mx,r)=>Math.max(mx,(r.id||0)+1),1);
      if(!silent)showToast('📷 レンタルデータ読込: '+rentalSpaceReservations.length+'件');
    } else {
      if(!silent)showToast('📷 レンタルデータなし（新規）');
    }
    if(document.getElementById('page-rental')?.classList.contains('active'))renderRental();
  }catch(e){
    console.warn('rentalCloudLoad失敗',e);
    if(!silent)showToast('⚠ レンタル読込失敗: '+e.message);
  }
}


const RENTAL_SITE_CLASS={'直接':'rs-site-直接','スペースマーケット':'rs-site-スペースマーケット','インスタベース':'rs-site-インスタベース','カシカシ':'rs-site-カシカシ'};

function rentalDateOf(r){ return (r.start||'').slice(0,10); } // YYYY-MM-DD

function getFilteredRentals(){
  const kw=(document.getElementById('rental-search')?.value||'').toLowerCase().trim();
  const fSite=document.getElementById('rental-filter-site')?.value||'';
  const fPurpose=document.getElementById('rental-filter-purpose')?.value||'';
  const fFac=document.getElementById('rental-filter-facility')?.value||'';
  return rentalSpaceReservations.filter(r=>{
    if(fSite&&r.site!==fSite)return false;
    if(fPurpose&&r.purpose!==fPurpose)return false;
    if(fFac&&r.facility!==fFac)return false;
    if(kw){
      const hay=((r.name||'')+' '+(r.facility||'')).toLowerCase();
      if(!hay.includes(kw))return false;
    }
    return true;
  });
}

function renderRental(){
  const y=rentalYear,m=rentalMonth;
  document.getElementById('rental-month-label').textContent=`${y}年${m}月`;
  const firstDay=new Date(y,m-1,1).getDay();
  const days=gDays(y,m);
  const list=getFilteredRentals();

  // 当月のみ
  const monthList=list.filter(r=>{const d=rentalDateOf(r);return d.startsWith(`${y}-${String(m).padStart(2,'0')}`);});

  // サマリー
  let monthTotal=0;const siteAgg={};
  monthList.forEach(r=>{
    monthTotal+=(r.price||0);
    if(!siteAgg[r.site])siteAgg[r.site]={count:0,sum:0};
    siteAgg[r.site].count++;siteAgg[r.site].sum+=(r.price||0);
  });
  const cnt=monthList.length;
  const avg=cnt?Math.round(monthTotal/cnt):0;
  let summaryHtml=`<div class="rs-summary-chip" style="background:#eef2ff;color:#3730a3;"><span style="font-size:10px;">今月売上</span><span style="font-size:16px;">¥${monthTotal.toLocaleString()}</span></div>`
    +`<div class="rs-summary-chip" style="background:#f0fdf4;color:#166534;"><span style="font-size:10px;">予約件数</span><span style="font-size:16px;">${cnt}件</span></div>`
    +`<div class="rs-summary-chip" style="background:#fef9c3;color:#854d0e;"><span style="font-size:10px;">平均単価</span><span style="font-size:16px;">¥${avg.toLocaleString()}</span></div>`;
  Object.entries(siteAgg).forEach(([s,a])=>{
    summaryHtml+=`<div class="rs-summary-chip ${RENTAL_SITE_CLASS[s]||''}"><span style="font-size:10px;">${s}</span><span style="font-size:13px;">${a.count}件 ¥${a.sum.toLocaleString()}</span></div>`;
  });
  document.getElementById('rental-summary').innerHTML=summaryHtml;

  // カレンダー
  let html='';
  for(let i=0;i<firstDay;i++)html+=`<div class="park-cell other-month"></div>`;
  for(let d=1;d<=days;d++){
    const dow=new Date(y,m-1,d).getDay();
    const dk=dateKey(y,m,d);
    const hol=HOLIDAYS_2026.has(dk);
    const dowCls=dow===0||hol?'sun':dow===6?'sat':'';
    const dayRes=monthList.filter(r=>rentalDateOf(r)===dk);
    html+=`<div class="park-cell ${dowCls} ${hol?'holiday':''}" ondblclick="openRentalAdd('${dk}')">`;
    html+=`<div class="park-date">${d}</div>`;
    if(hol)html+=`<div class="park-hol">${HOLIDAY_NAMES[dk]||'祝'}</div>`;
    dayRes.forEach(r=>{
      const t1=(r.start||'').slice(11,16),t2=(r.end||'').slice(11,16);
      html+=`<div class="rs-cell-entry ${RENTAL_SITE_CLASS[r.site]||''}" onclick="event.stopPropagation();openRentalEdit(${r.id})" title="${esc(r.name)} / ${esc(r.facility)} / ${esc(r.purpose)}">`
        +`<div style="display:flex;justify-content:space-between;align-items:center;gap:2px;">`
        +`<span style="font-weight:700;font-size:12px;">${t1}〜${t2}</span>`
        +`<span style="font-size:11px;background:rgba(0,0,0,.1);border-radius:3px;padding:0 3px;">${esc(r.facility)}</span>`
        +`</div>`
        +`<div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.name||'')}（${r.guests||1}名）</div>`
        +`<div style="display:flex;justify-content:space-between;align-items:center;gap:2px;">`
        +`<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.purpose||'')}</span>`
        +`<span style="font-weight:700;white-space:nowrap;">¥${(r.price||0).toLocaleString()}</span>`
        +`</div>`
        +`<div style="font-size:11px;opacity:.7;text-align:right;">${r.site||''}</div>`
        +`</div>`;
    });
    html+=`</div>`;
  }
  const trail=(7-(firstDay+days)%7)%7;
  for(let i=0;i<trail;i++)html+=`<div class="park-cell other-month"></div>`;
  document.getElementById('rental-grid').innerHTML=html;
}

function rentalPrev(){rentalMonth--;if(rentalMonth<1){rentalMonth=12;rentalYear--;}renderRental();}
function rentalNext(){rentalMonth++;if(rentalMonth>12){rentalMonth=1;rentalYear++;}renderRental();}

function openRentalAdd(dk){
  editRentalId=null;
  document.getElementById('rsm-title').textContent='レンタルスペース予約追加';
  document.getElementById('rsm-del-btn').style.display='none';
  document.getElementById('rsm-facility').value='本館';
  document.getElementById('rsm-site').value='直接';
  const base=dk?dk:`${rentalYear}-${String(rentalMonth).padStart(2,'0')}-01`;
  document.getElementById('rsm-start').value=base+'T10:00';
  document.getElementById('rsm-end').value=base+'T14:00';
  document.getElementById('rsm-name').value='';
  document.getElementById('rsm-guests').value='1';
  document.getElementById('rsm-price').value='';
  document.getElementById('rsm-purpose').value='撮影';
  document.getElementById('rsm-mode').value='';
  document.getElementById('rsm-detail').value='';
  document.querySelectorAll('#rsm-options input').forEach(c=>c.checked=false);
  document.getElementById('rental-modal').classList.add('open');
}

function openRentalEdit(id){
  const r=rentalSpaceReservations.find(x=>x.id===id);if(!r)return;
  editRentalId=id;
  document.getElementById('rsm-title').textContent='レンタルスペース予約編集';
  document.getElementById('rsm-del-btn').style.display='block';
  document.getElementById('rsm-facility').value=r.facility||'本館';
  document.getElementById('rsm-site').value=r.site||'直接';
  document.getElementById('rsm-start').value=r.start||'';
  document.getElementById('rsm-end').value=r.end||'';
  document.getElementById('rsm-name').value=r.name||'';
  document.getElementById('rsm-guests').value=r.guests||1;
  document.getElementById('rsm-price').value=r.price||'';
  document.getElementById('rsm-purpose').value=r.purpose||'撮影';
  document.getElementById('rsm-mode').value=r.mode||'';
  document.getElementById('rsm-detail').value=r.detail||'';
  const opts=r.options||[];
  document.querySelectorAll('#rsm-options input').forEach(c=>c.checked=opts.includes(c.value));
  document.getElementById('rental-modal').classList.add('open');
}

function saveRental(){
  const opts=[];document.querySelectorAll('#rsm-options input:checked').forEach(c=>opts.push(c.value));
  const data={
    id:editRentalId!=null?editRentalId:nextRentalId++,
    facility:document.getElementById('rsm-facility').value,
    site:document.getElementById('rsm-site').value,
    start:document.getElementById('rsm-start').value,
    end:document.getElementById('rsm-end').value,
    name:document.getElementById('rsm-name').value.trim(),
    guests:parseInt(document.getElementById('rsm-guests').value)||1,
    price:parseInt(document.getElementById('rsm-price').value)||0,
    purpose:document.getElementById('rsm-purpose').value,
    mode:document.getElementById('rsm-mode').value.trim(),
    detail:document.getElementById('rsm-detail').value.trim(),
    options:opts,
  };
  if(!data.start){showToast('⚠ 開始日時を入力してください');return;}
  if(editRentalId!=null){
    const idx=rentalSpaceReservations.findIndex(x=>x.id===editRentalId);
    if(idx>=0)rentalSpaceReservations[idx]=data;
  } else {
    rentalSpaceReservations.push(data);
  }
  closeM('rental-modal');renderRental();renderReg();saveToLS();rentalCloudSave();
  showToast('📷 レンタルスペース予約を保存しました');
}

function deleteRental(){
  if(editRentalId==null)return;
  rentalSpaceReservations=rentalSpaceReservations.filter(x=>x.id!==editRentalId);
  closeM('rental-modal');renderRental();renderReg();saveToLS();rentalCloudSave();
  showToast('🗑 削除しました');
}

function exportRentalCSV(){
  const y=rentalYear,m=rentalMonth;
  const monthList=rentalSpaceReservations.filter(r=>rentalDateOf(r).startsWith(`${y}-${String(m).padStart(2,'0')}`));
  let csv='\ufeff利用日,施設,予約者名,人数,利用目的,予約サイト,料金\n';
  monthList.forEach(r=>{
    csv+=`${rentalDateOf(r)},${r.facility},${r.name},${r.guests},${r.purpose},${r.site},${r.price}\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`rental_${y}年${m}月.csv`;a.click();
}

// メインカレンダー日付ヘッダー用：その日にレンタル予約があるか
function rentalCountOnDate(y,m,d){
  const dk=dateKey(y,m,d);
  return rentalSpaceReservations.filter(r=>rentalDateOf(r)===dk).length;
}
function showRentalDay(y,m,d){
  const dk=dateKey(y,m,d);
  const list=rentalSpaceReservations.filter(r=>rentalDateOf(r)===dk);
  document.getElementById('rdm-title').textContent=`📷 ${m}/${d} のレンタルスペース予約`;
  let html='';
  if(list.length===0)html='<div style="color:#aaa;">予約なし</div>';
  list.forEach(r=>{
    const t1=(r.start||'').slice(11,16),t2=(r.end||'').slice(11,16);
      html+=`<div style="padding:8px;border-bottom:1px solid #eee;cursor:pointer;" onclick="closeM('rental-day-modal');showP('rental',document.querySelector('.nitem[onclick*=rental]'));openRentalEdit(${r.id});">`
        +`<strong>${t1}-${t2}</strong> ${esc(r.facility)} ／ ${esc(r.name)}（${r.guests}名）<br>`
        +`<span style="font-size:11px;color:#666;">${esc(r.purpose)} ／ ${esc(r.site)} ／ ¥${(r.price||0).toLocaleString()}</span>`
        +(r.options&&r.options.length?`<br><span style="font-size:11px;color:#888;">🔧 ${esc(r.options.join('・'))}</span>`:'')
        +(r.detail?`<br><span style="font-size:11px;color:#555;white-space:pre-wrap;">${esc(r.detail)}</span>`:'')
        +`</div>`;
  });
  document.getElementById('rdm-list').innerHTML=html;
  document.getElementById('rental-day-modal').classList.add('open');
}

function parkPrev(){parkMonth--;if(parkMonth<1){parkMonth=12;parkYear--;}renderParking();}
function parkNext(){parkMonth++;if(parkMonth>12){parkMonth=1;parkYear++;}renderParking();}

function openParkAdd(dk){
  editParkDate=dk;editParkEntryId=null;
  document.getElementById('pm-title').textContent='駐車場利用追加';
  document.getElementById('pm-del-btn').style.display='none';
  document.getElementById('pm-name').value='';document.getElementById('pm-note').value='';
  if(dk){
    document.getElementById('pm-date').value=dk;
    const p=parkPrice(parkYear,...dk.split('-').slice(1).map(Number));
    document.getElementById('pm-price').value=p;
    document.getElementById('pm-auto-price').textContent=`（自動: ¥${p.toLocaleString()}）`;
  } else {
    document.getElementById('pm-date').value='';document.getElementById('pm-price').value='1000';
    document.getElementById('pm-auto-price').textContent='';
  }
  document.getElementById('pm-date').addEventListener('change',function(){
    const parts=this.value.split('-').map(Number);
    if(parts.length===3){const p=parkPrice(parts[0],parts[1],parts[2]);document.getElementById('pm-price').value=p;document.getElementById('pm-auto-price').textContent=`（自動: ¥${p.toLocaleString()}）`;}
  });
  document.getElementById('park-modal').classList.add('open');
}
function openParkEdit(dk,entryId){
  editParkDate=dk;editParkEntryId=entryId;
  const pk=parkData[dk]||[];const e=pk.find(x=>x.id===entryId);if(!e)return;
  document.getElementById('pm-title').textContent='駐車場利用編集';
  document.getElementById('pm-del-btn').style.display='block';
  document.getElementById('pm-date').value=dk;document.getElementById('pm-name').value=e.name;
  document.getElementById('pm-price').value=e.price||'';document.getElementById('pm-note').value=e.note||'';
  document.getElementById('pm-auto-price').textContent='';
  document.getElementById('park-modal').classList.add('open');
}
function saveParkEntry(){
  const dk=document.getElementById('pm-date').value;if(!dk)return;
  const entry={id:editParkEntryId!=null?editParkEntryId:nextParkId++,name:document.getElementById('pm-name').value,price:parseInt(document.getElementById('pm-price').value)||0,note:document.getElementById('pm-note').value,type:'manual'};
  if(!parkData[dk])parkData[dk]=[];
  if(editParkEntryId!=null){const idx=parkData[dk].findIndex(x=>x.id===editParkEntryId);if(idx>=0)parkData[dk][idx]=entry;}
  else parkData[dk].push(entry);
  closeM('park-modal');renderParking();autoSave();
}
function deleteParkEntry(){
  if(editParkDate&&editParkEntryId!=null){
    const entry=(parkData[editParkDate]||[]).find(x=>x.id===editParkEntryId);
    parkData[editParkDate]=(parkData[editParkDate]||[]).filter(x=>x.id!==editParkEntryId);

    // 自動登録（park-auto）の場合：宿泊名簿の備考と駐車場フラグを同期
    if(entry&&entry.type==='park-auto'&&entry.name){
      Object.keys(guestData).forEach(k=>{
        const g=guestData[k];
        if(!g||g.name!==entry.name)return;
        // parkingフラグをOFF
        g.parking=false;
        // 備考から駐車場キーワードを除去
        if(g.note){
          g.note=g.note.replace(/🚗/g,'').replace(/駐車場/g,'').replace(/parking/gi,'').replace(/\s+/g,' ').trim();
        }
      });
      renderReg();
    }
  }
  closeM('park-modal');renderParking();autoSave();
}

// ============================================================
// CANCEL / SURF / ROOMS / TODO
// ============================================================


// 2026年キャンセルリスト（Excelインポート）
function importCancelList2026(){
  const data=[{"date": "2026-01-03", "name": "Felicia Martinez　キャンセル料", "site": "Airbnb", "pay": "事前決済", "price": 5746, "nat": "", "sex": "女", "cat": "Ｓ", "note": "2連泊・", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-01-09", "name": "ブ シドウ　キャンセル料", "site": "じゃらん", "pay": "事前決済", "price": 1210, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "23時/メッセージ送信済み・08040187245", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-01-27", "name": "小彤 林　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3182, "nat": "中国", "sex": "男", "cat": "Ｓ", "note": "", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-01-29", "name": "xueming ZHANG　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 2784, "nat": "", "sex": "男", "cat": "Ｓ", "note": "", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-02-01", "name": "KATSUYA SUTO　キャンセル料", "site": "楽天トラベル", "pay": "事前決済", "price": 3364, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "049696・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-02-15", "name": "赤松 吉太郎　キャンセル料", "site": "じゃらん", "pay": "事前決済", "price": 2766, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "689798・22時着・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-02-23", "name": "Jonaliza Sy　キャンセル料", "site": "Airbnb", "pay": "事前決済", "price": 10774, "nat": "", "sex": "女", "cat": "Ｓ", "note": "6連泊・", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-02-25", "name": "加藤 加奈子　キャンセル料", "site": "Airbnb", "pay": "事前決済", "price": 2873, "nat": "日本", "sex": "女", "cat": "Ｓ", "note": "", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-03-10", "name": "いいじま あやみ　キャンセル料", "site": "楽天トラベル", "pay": "事前決済", "price": 3000, "nat": "日本", "sex": "女", "cat": "Ｇ", "note": "2名・15時着・", "room": "ANNEX−個室", "payDone": false}, {"date": "2026-03-16", "name": "KAZUKA YAMASHITA　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3579, "nat": "日本", "sex": "女", "cat": "Ｓ", "note": "664837・", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-03-18", "name": "さとう よしひろ　キャンセル料", "site": "楽天トラベル", "pay": "事前決済", "price": 2800, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "16時", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-03-21", "name": "門脇 有加　キャンセル料", "site": "じゃらん", "pay": "事前決済", "price": 2272, "nat": "日本", "sex": "女", "cat": "Ｓ", "note": "17時着・", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-03-25", "name": "村田 菜那子　キャンセル料", "site": "じゃらん", "pay": "事前決済", "price": 3705, "nat": "日本", "sex": "女", "cat": "Ｇ", "note": "2名・15時着・", "room": "ANNEX−個室", "payDone": false}, {"date": "2026-03-22", "name": "井上 結夏　キャンセル料", "site": "じゃらん", "pay": "事前決済", "price": 6175, "nat": "日本", "sex": "女", "cat": "Ｇ", "note": "2 名・17時・住所：神奈川県藤沢市片瀬海岸2-15-13？", "room": "ANNEX−個室", "payDone": false}, {"date": "2026-03-21", "name": "遠藤 淑子　キャンセル料", "site": "じゃらん", "pay": "事前決済", "price": 7409, "nat": "日本", "sex": "女", "cat": "Ｆ", "note": "2名・小学生連れ・19時", "room": "ANNEX−個室", "payDone": false}, {"date": "2026-03-25", "name": "Ramona Jane Bayoneta　キャンセル料", "site": "Agoda", "pay": "事前決済", "price": 6336, "nat": "モルディブ", "sex": "女", "cat": "Ｇ", "note": "", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-03-25", "name": "Kanami Takemura　キャンセル料", "site": "Agoda", "pay": "事前決済", "price": 3520, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-03-26", "name": "CHEN YUYEN　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3938, "nat": "台湾", "sex": "男", "cat": "Ｓ", "note": "048818・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-03-29", "name": "もりた さとえ　キャンセル料", "site": "HP", "pay": "現金", "price": 3150, "nat": "日本", "sex": "女", "cat": "Ｓ", "note": "558281・21時着・", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-03-30", "name": "yukawa sae　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 11500, "nat": "日本", "sex": "女", "cat": "Ｇ", "note": "486591・", "room": "本館−クイーン", "payDone": false}, {"date": "2026-03-30", "name": "Siau Chin Lie　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 63640, "nat": "", "sex": "男", "cat": "Ｇ", "note": "739815・2名・4連泊・", "room": "アパート", "payDone": false}, {"date": "2026-03-30", "name": "Siau Chin Lie　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 63640, "nat": "", "sex": "男", "cat": "Ｇ", "note": "2名・4連泊・", "room": "アパート", "payDone": false}, {"date": "2026-04-01", "name": "西村 徳之　キャンセル料", "site": "じゃらん", "pay": "事前決済", "price": 7089, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "3連泊・18時着・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-02", "name": "Mason Devries　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3579, "nat": "オーストラリア", "sex": "男", "cat": "Ｓ", "note": "", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-02", "name": "CHANGHWAN CHOI　キャンセル料", "site": "Expedia", "pay": "事前決済", "price": 7292, "nat": "", "sex": "男", "cat": "Ｓ", "note": "2連泊・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-04", "name": "栗原 稔　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 4680, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "989010・22:00 and 23:00", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-08", "name": "Evelyn Peuker　キャンセル料", "site": "Hostelworld", "pay": "現金", "price": 8670, "nat": "ドイツ", "sex": "男", "cat": "Ｓ", "note": "3連・キャンセル", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-09", "name": "Dea Tannada　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3182, "nat": "シンガポール", "sex": "女", "cat": "Ｓ", "note": "411443・19～20時着・", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-04-12", "name": "Christopher John Birkenstamm　キャンセル料", "site": "Hostelworld", "pay": "現金", "price": 3570, "nat": "アメリカ", "sex": "男", "cat": "Ｓ", "note": "367216・15時着・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-16", "name": "Pham Minh　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3182, "nat": "", "sex": "男", "cat": "Ｓ", "note": "459617・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-16", "name": "Tep Monymorokot　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 9100, "nat": "カンボジア", "sex": "男", "cat": "Ｇ", "note": "399935・", "room": "本館−ツイン", "payDone": false}, {"date": "2026-04-28", "name": "SATOSHI MATSUSHIMA　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3579, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "22：00", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-28", "name": "Pedro Ovalle　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 2864, "nat": "", "sex": "男", "cat": "Ｓ", "note": "最終メッセージ送信済み", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-04-30", "name": "みずの ひろかず　キャンセル料", "site": "楽天トラベル", "pay": "事前決済", "price": 8000, "nat": "日本", "sex": "男", "cat": "Ｃ", "note": "16時着・駐車場", "room": "本館−クイーン", "payDone": false}, {"date": "2026-05-01", "name": "SUGIYAMA MINAMI　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 3579, "nat": "日本", "sex": "女", "cat": "Ｓ", "note": "065937・21:00 - 22:00", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-05-01", "name": "かなみね しゅん　キャンセル料", "site": "HP", "pay": "現金", "price": 12000, "nat": "日本", "sex": "男", "cat": "Ｇ", "note": "668335・21:30・09045804226", "room": "本館−ツイン", "payDone": false}, {"date": "2026-05-04", "name": "Bennett Alleyah Madrid　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 5568, "nat": "", "sex": "女", "cat": "Ｓ", "note": "", "room": "ANNEX−ドミトリー", "payDone": false}, {"date": "2026-05-04", "name": "Hào Cao　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 5568, "nat": "", "sex": "男", "cat": "Ｓ", "note": "898237・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-05-16", "name": "ごとう ひろよし　キャンセル料", "site": "楽天トラベル", "pay": "事前決済", "price": 4200, "nat": "日本", "sex": "男", "cat": "Ｓ", "note": "841731・15時着・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-05-16", "name": "JongUk Kim　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 4773, "nat": "香港", "sex": "男", "cat": "Ｓ", "note": "014032・", "room": "本館−男女混合ドミトリー", "payDone": false}, {"date": "2026-05-21", "name": "DINH NHAT VY　キャンセル料", "site": "Booking.com", "pay": "事前決済", "price": 15300, "nat": "ベトナム", "sex": "女", "cat": "Ｇ", "note": "795338・2名・天候不良キャンセル依頼あり。　却下　駐車場", "room": "ANNEX−個室", "payDone": false}];
  let added=0;
  data.filter(c=>c.date&&/^\d{4}-\d{2}-\d{2}$/.test(c.date)).forEach(c=>{
    const exists=cancelList.some(x=>x.name===c.name&&x.date===c.date);
    if(!exists){cancelList.push(c);added++;}
  });
  renderCancel();autoSave();
  if(added>0)showToast('✅ キャンセルリスト '+added+'件を追加しました');
  return added;
}

// クラウドロード完了後に2026キャンセルを自動取込（初回のみ）
function autoImportCancelIfNeeded(){
  const has2026=cancelList.some(c=>(c.date||'').startsWith('2026'));
  if(!has2026) importCancelList2026();
}

function renderCancel(){
  const table=document.getElementById('cancel-table');if(!table)return;
  const yearFilter=document.getElementById('cancel-year-filter')?.value||'';
  const filtered=(yearFilter
    ?cancelList.filter(c=>(c.date||'').startsWith(yearFilter))
    :cancelList).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const lbl=document.getElementById('cancel-count-label');
  if(lbl)lbl.textContent=`${filtered.length}件`;
  // 支払済み合計
  const paidTotal=filtered.filter(c=>c.payDone).reduce((s,c)=>s+(c.price||0),0);
  const totalEl=document.getElementById('cancel-paid-total');
  if(totalEl)totalEl.textContent='¥'+paidTotal.toLocaleString();
  let html='<thead><tr><th>支払</th><th>日程</th><th>氏名</th><th>予約サイト</th><th>支払方法</th><th>キャンセル料</th><th>国籍</th><th>性別</th><th>区分</th><th>部屋</th><th>備考</th><th></th></tr></thead><tbody>';
  filtered.forEach(function(c){
    const i=cancelList.indexOf(c);
    const cc=c.cat==='Ｓ'?'ts':c.cat==='Ｇ'?'tg2':'tc2';
    const rowBg=!c.payDone?'background:#fff8f8;':'';
    const chk='<input type="checkbox" '+(c.payDone?'checked':'')+' onchange="toggleCancelPayDone('+i+',this.checked)" style="width:16px;height:16px;cursor:pointer;accent-color:var(--seaglass);">';
    const restore=c.restoreData?'<button class="btn btn-xs" style="margin-right:4px;background:var(--ocean-light);color:var(--ocean);border-color:var(--ocean);" onclick="restoreCancel('+i+')">復元</button>':'';
    html+='<tr style="'+rowBg+'">'
      +'<td style="text-align:center;">'+chk+'</td>'
      +'<td>'+esc(c.date||'')+'</td>'
      +'<td style="font-weight:600;">'+esc(c.name||'')+'</td>'
      +'<td>'+esc(c.site||'')+'</td>'
      +'<td style="font-size:11px;">'+esc(c.pay||'')+'</td>'
      +'<td>¥'+(c.price||0).toLocaleString()+'</td>'
      +'<td>'+esc(c.nat||'')+'</td>'
      +'<td><span class="tag '+(c.sex==='男'?'tm':'tf')+'">'+esc(c.sex||'')+'</span></td>'
      +'<td><span class="tag '+cc+'">'+esc(c.cat||'')+'</span></td>'
      +'<td style="font-size:11px;">'+esc(c.room||'')+'</td>'
      +'<td style="font-size:11px;">'+esc(c.note||'')+'</td>'
      +'<td style="white-space:nowrap;">'+restore+'<button class="btn btn-xs" onclick="openCancelEdit('+i+')">編集</button></td>'
      +'</tr>';
  });
  if(!filtered.length)html+='<tr><td colspan="12" style="text-align:center;color:#aaa;padding:16px;">データなし</td></tr>';
  table.innerHTML=html+'</tbody>';
}
function exportCancelCSV(){
  let csv='\uFEFF支払済み,日程,氏名,予約サイト,支払方法,キャンセル料,国籍,性別,区分,部屋,備考\n';
  cancelList.forEach(c=>{
    csv+=[c.payDone?'済み':'未収',c.date||'',c.name||'',c.site||'',c.pay||'',c.price||0,c.nat||'',c.sex||'',c.cat||'',c.room||'','"'+(c.note||'').replace(/"/g,'""')+'"'].join(',')+'\n';
  });
  const b=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='キャンセルリスト.csv';a.click();
}
function restoreCancel(i){
  const c=cancelList[i];
  if(!c||!c.restoreData)return;
  if(!confirm(`「${c.name}」の予約を宿泊名簿へ復元しますか？`))return;
  c.restoreData.forEach(({m,d,data})=>{ guestData[gk(m,data.roomId,d)]={...data}; });
  cancelList.splice(i,1);
  renderCancel();renderReg();autoSave();
  showToast('✅ 宿泊名簿へ復元しました');
}
function openCancelAdd(){editCancelIdx=null;document.getElementById('cm-title').textContent='キャンセル追加';document.getElementById('cm-del-btn').style.display='none';['cm-name','cm-nat','cm-room','cm-note','cm-price'].forEach(id=>document.getElementById(id).value='');document.getElementById('cm-date').value='';document.getElementById('cm-pay').value='';document.getElementById('cm-pay-done').checked=false;document.getElementById('cancel-modal').classList.add('open');}
function openCancelEdit(i){
  editCancelIdx=i;const c=cancelList[i];
  document.getElementById('cm-title').textContent='キャンセル編集';
  document.getElementById('cm-del-btn').style.display='block';
  document.getElementById('cm-name').value=c.name||'';
  document.getElementById('cm-nat').value=c.nat||'';
  document.getElementById('cm-room').value=c.room||'';
  document.getElementById('cm-note').value=c.note||'';
  document.getElementById('cm-price').value=c.price||'';
  // 予約サイト：selectにない値は動的に追加してセット
  const cSite=document.getElementById('cm-site');
  const sv=c.site||'';
  if(sv&&![...cSite.options].some(o=>o.value===sv)){const opt=document.createElement('option');opt.value=sv;opt.text=sv;cSite.appendChild(opt);}
  cSite.value=sv;
  document.getElementById('cm-sex').value=c.sex||'男';
  document.getElementById('cm-cat').value=c.cat||'Ｓ';
  document.getElementById('cm-date').value=c.date||'';
  document.getElementById('cm-pay').value=c.pay||'';
  document.getElementById('cm-pay-done').checked=!!c.payDone;
  document.getElementById('cancel-modal').classList.add('open');
}
function saveCancel(){const item={date:document.getElementById('cm-date').value,name:document.getElementById('cm-name').value,site:document.getElementById('cm-site').value,price:parseInt(document.getElementById('cm-price').value)||0,nat:document.getElementById('cm-nat').value,sex:document.getElementById('cm-sex').value,cat:document.getElementById('cm-cat').value,room:document.getElementById('cm-room').value,note:document.getElementById('cm-note').value,pay:document.getElementById('cm-pay').value,payDone:document.getElementById('cm-pay-done').checked};if(editCancelIdx!=null){const prev=cancelList[editCancelIdx];item.restoreData=prev.restoreData;cancelList[editCancelIdx]=item;}else cancelList.unshift(item);closeM('cancel-modal');renderCancel();autoSave();}
function toggleCancelPayDone(i,val){if(cancelList[i])cancelList[i].payDone=val;renderCancel();autoSave();}
function deleteCancelItem(){if(editCancelIdx!=null){cancelList.splice(editCancelIdx,1);closeM('cancel-modal');renderCancel();}}

function renderSurf(){
  const yearFilter=document.getElementById('surf-year-filter')?.value||'';
  const filtered=yearFilter
    ?surfList.filter(s=>(s.date||'').startsWith(yearFilter))
    :surfList;
  const lbl=document.getElementById('surf-count-label');
  if(lbl)lbl.textContent=`${filtered.length}件`;
  let html='<thead><tr><th>日程</th><th>氏名</th><th>予約サイト</th><th>料金</th><th>性別</th><th>サーフィン日</th><th>ショップ</th><th>連絡日</th><th>入金日</th><th>備考</th><th></th></tr></thead><tbody>';
  filtered.forEach(s=>{
    const i=surfList.indexOf(s);
    html+=`<tr><td>${esc(s.date)}</td><td style="font-weight:600;">${esc(s.name)}${s.auto?' <span style="font-size:9px;color:#aaa;">自動</span>':''}</td><td>${esc(s.site)}</td><td>${s.price?'¥'+s.price.toLocaleString():'—'}</td><td><span class="tag ${s.sex==='男'?'tm':'tf'}">${esc(s.sex)}</span></td><td style="font-size:11px;">${esc(s.surfday||'—')}</td><td>${esc(s.shop||'—')}</td><td style="font-size:11px;">${esc(s.contact||'—')}</td><td style="font-size:11px;">${esc(s.payment||'—')}</td><td style="font-size:11px;">${esc(s.note)}</td><td><button class="btn btn-xs" onclick="openSurfEdit(${i})">編集</button></td></tr>`;
  });
  if(!filtered.length)html+='<tr><td colspan="11" style="text-align:center;color:#aaa;padding:16px;">データなし</td></tr>';
  document.getElementById('surf-table').innerHTML=html+'</tbody>';
}
function openSurfAdd(){editSurfIdx=null;document.getElementById('sm-title').textContent='サーフィン追加';document.getElementById('sm-del-btn').style.display='none';['sm-name','sm-nat','sm-surfday','sm-note','sm-price'].forEach(id=>document.getElementById(id).value='');document.getElementById('sm-date').value='';document.getElementById('sm-contact').value='';document.getElementById('sm-payment').value='';document.getElementById('sm-shop').value='ミスティ';document.getElementById('surf-modal').classList.add('open');}
function openSurfEdit(i){
  editSurfIdx=i;const s=surfList[i];
  document.getElementById('sm-title').textContent='サーフィン編集';
  document.getElementById('sm-del-btn').style.display='block';
  document.getElementById('sm-name').value=s.name;
  document.getElementById('sm-nat').value=s.nat||'';
  document.getElementById('sm-surfday').value=s.surfday||'';
  document.getElementById('sm-note').value=s.note;
  document.getElementById('sm-price').value=s.price||'';
  document.getElementById('sm-shop').value=s.shop||'ミスティ';
  document.getElementById('sm-site').value=s.site;
  document.getElementById('sm-sex').value=s.sex;
  document.getElementById('sm-cat').value=s.cat;
  document.getElementById('sm-contact').value=s.contact||'';
  document.getElementById('sm-payment').value=s.payment||'';
  // 日程：YYYY/MM/DD → YYYY-MM-DD に変換してセット
  const dateVal=s.date?s.date.replace(/\//g,'-'):'';
  document.getElementById('sm-date').value=dateVal;
  document.getElementById('surf-modal').classList.add('open');
}
function savesurf(){
  const item={date:document.getElementById('sm-date').value,name:document.getElementById('sm-name').value,site:document.getElementById('sm-site').value,price:parseInt(document.getElementById('sm-price').value)||0,nat:document.getElementById('sm-nat').value,sex:document.getElementById('sm-sex').value,cat:document.getElementById('sm-cat').value,surfday:document.getElementById('sm-surfday').value,shop:document.getElementById('sm-shop').value,contact:document.getElementById('sm-contact').value,payment:document.getElementById('sm-payment').value,note:document.getElementById('sm-note').value,auto:false};
  if(editSurfIdx!=null){
    const prev=surfList[editSurfIdx];
    if(prev){
      // 日程が空の場合は元の値を引き継ぐ
      if(!item.date&&prev.date)item.date=prev.date;
      // 宿泊名簿連携フラグを引き継ぐ
      if(prev.guestLinked)item.guestLinked=true;
    }
    surfList[editSurfIdx]=item;
  } else {
    surfList.unshift(item);
  }
  closeM('surf-modal');renderSurf();autoSave();
}
function deleteSurfItem(){
  if(editSurfIdx==null)return;
  const s=surfList[editSurfIdx];
  surfList.splice(editSurfIdx,1);

  // 宿泊名簿の備考からサーフィンタグを削除・parkingフラグを解除
  if(s&&s.guestLinked){
    Object.keys(guestData).forEach(k=>{
      const g=guestData[k];
      if(!g||g.name!==s.name)return;
      // 備考からサーフィンタグを除去
      if(g.note&&g.note.includes('サーフィン')){
        g.note=g.note.replace('サーフィン','').replace(/\s+/g,' ').trim();
      }
    });
    renderReg();
  }

  closeM('surf-modal');renderSurf();autoSave();
}

function renderRooms(){
  const tbody=document.getElementById('room-list-body');
  if(!tbody)return;
  tbody.innerHTML=rooms.map((r,i)=>`
    <tr style="border-bottom:1px solid var(--sand-border);${i%2===1?'background:var(--sand);':''}">
      <td style="padding:12px 16px;color:#555;">${esc((roomSettings[r.id]&&roomSettings[r.id].facilityName)||'江の島ゲストハウス134')}</td>
      <td style="padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${r.color};flex-shrink:0;display:inline-block;"></span>
          <span style="font-weight:600;color:var(--text);">${esc(r.no)}</span>
        </div>
      </td>
      <td style="padding:12px 16px;color:#333;">${esc(r.type)}</td>
      <td style="padding:12px 16px;text-align:center;color:#555;">${r.cap}名</td>
      <td style="padding:12px 16px;text-align:center;">
        <button class="btn btn-xs" onclick="openRoomEdit(${r.id})" style="font-size:11px;padding:4px 12px;">詳細</button>
      </td>
    </tr>`).join('');
}
// ── 部屋別多言語設定 roomSettings ──────────────────────────
// { roomId: { phone, address, wifiSsid, wifiPass, keycode, languages:{ja:{roomName,guideText},...} } }
let roomSettings = {};
// チェックインアプリの対応言語に合わせ4言語（日本語・英語・簡体中文・韓国語）。繁體中文(zh-TW)は廃止
const ROOM_LANGS = ['ja','en','zh-CN','ko'];
const ROOM_LANG_LABELS = {'ja':'日本語','en':'English','zh-CN':'简体中文','ko':'한국어'};
let _rmCurrentLang = 'ja';
let _rmLangBuffer = {}; // 編集中の言語別バッファ

// LocalStorage フォールバック（GAS未接続時も永続化）
function saveRoomSettingsLS(){
  try{ localStorage.setItem('hotel_roomSettings', JSON.stringify(roomSettings)); }catch(e){}
}
// 部屋設定をGoogle Drive（メインGAS JSON）へ即時保存
// file:// からでも書き込めるよう no-cors + text/plain でPOST（プリフライト回避）
async function saveRoomSettingsToCloud(){
  if(!GAS_URL) return;
  try{
    // 1) 最新データを取得（GETはno-corsでなくてもfile://から読める場合が多い）
    let data={};
    try{
      const res=await fetch(_withKey(GAS_URL+'?t='+Date.now()));
      data=await res.json();
    }catch(getErr){
      // GETも失敗した場合はローカルの全データで構築
      console.warn('最新データ取得に失敗、ローカルデータで保存:',getErr);
      data=collectAllData();
    }
    // 2) roomSettings / rooms を差し替え
    data.roomSettings=roomSettings;
    data.rooms=rooms;
    // 3) no-cors + text/plain でPOST（プリフライトを発生させない＝file://でも通る）
    await fetch(_withKey(GAS_URL),{
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(data)
    });
    if(typeof updateSyncStatus==='function')updateSyncStatus('ok','部屋設定を保存しました');
    showToast('☁ 部屋設定をクラウドに保存しました');
  }catch(e){
    console.warn('部屋設定のクラウド保存に失敗（localStorageには保存済み）:',e);
    showToast('⚠ クラウド保存に失敗（ローカルには保存済み）');
  }
}
function loadRoomSettingsLS(){
  try{
    const s=localStorage.getItem('hotel_roomSettings');
    if(s){ const d=JSON.parse(s); if(d&&typeof d==='object') roomSettings=d; }
  }catch(e){}
}

function _ensureRoomSetting(id){
  if(!roomSettings[id]){
    roomSettings[id]={facilityName:'',phone:'',address:'',wifiSsid:'',wifiPass:'',keycode:'',checkinGuideUrl:'',roomCode:'',note1:'',note2:'',note3:'',languages:{},media:[]};
  }
  // 既存データへの新フィールド補完（後方互換）
  const _s=roomSettings[id];
  ['facilityName','checkinGuideUrl','roomCode','note1','note2','note3'].forEach(f=>{ if(_s[f]===undefined)_s[f]=''; });
  if(!Array.isArray(roomSettings[id].media))roomSettings[id].media=[];
  ROOM_LANGS.forEach(l=>{
    if(!roomSettings[id].languages[l])roomSettings[id].languages[l]={roomName:'',guideText:''};
  });
  return roomSettings[id];
}

// ── 部屋メディア管理（URL方式） ──────────────────────────
let _rmMediaBuffer = []; // 編集中の media 配列
let _rmMediaDragIdx = null;

// URLからメディア種別を判定（youtube / vimeo / gslides / gdrive / video / image）
function _detectMediaType(url){
  const u=String(url||'').trim();
  if(/youtube\.com|youtu\.be/i.test(u)) return 'youtube';
  if(/vimeo\.com/i.test(u)) return 'vimeo';
  if(/docs\.google\.com\/presentation/i.test(u)) return 'gslides';
  if(/drive\.google\.com/i.test(u)) return 'gdrive';
  if(/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return 'video';
  if(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u)) return 'image';
  return 'iframe'; // 不明はiframeで試行
}

function _typeLabel(t){
  return ({youtube:'▶ YouTube',vimeo:'▶ Vimeo',gslides:'📊 Googleスライド',gdrive:'🎬 Google Drive',video:'🎬 動画',image:'🖼 画像',iframe:'🔗 埋め込み'})[t]||'🔗';
}

function _addRoomMediaUrl(){
  const inp=document.getElementById('rm-media-url');
  const url=(inp.value||'').trim();
  if(!url){ inp.focus(); return; }
  if(!/^https?:\/\//i.test(url)){ showToast('⚠ http(s):// から始まるURLを入力してください'); return; }
  const type=_detectMediaType(url);
  _rmMediaBuffer.push({
    id:'m_'+Date.now()+'_'+Math.floor(Math.random()*1000),
    type, name:_typeLabel(type), url
  });
  inp.value='';
  _renderRoomMediaList();
}

function _renderRoomMediaList(){
  const list=document.getElementById('rm-media-list');
  if(!list)return;
  if(!_rmMediaBuffer.length){ list.innerHTML='<div style="font-size:11px;color:#bbb;padding:4px;">メディアは登録されていません</div>'; return; }
  list.innerHTML=_rmMediaBuffer.map((m,i)=>`
    <div class="rm-media-item" draggable="true" data-idx="${i}"
      style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#f9f8f5;border-radius:8px;cursor:grab;">
      <span style="color:#ccc;font-size:13px;">⠿</span>
      <span style="font-size:13px;flex-shrink:0;">${_typeLabel(m.type).split(' ')[0]}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;color:#888;">${_typeLabel(m.type)}</div>
        <div style="font-size:11px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.url}</div>
      </div>
      <button onclick="_removeRoomMedia(${i})" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:12px;padding:4px 8px;flex-shrink:0;">削除</button>
    </div>`).join('');
  // D&D並び替え
  list.querySelectorAll('.rm-media-item').forEach(el=>{
    el.ondragstart=e=>{_rmMediaDragIdx=Number(el.dataset.idx);el.style.opacity='0.4';};
    el.ondragend=e=>{el.style.opacity='1';};
    el.ondragover=e=>{e.preventDefault();};
    el.ondrop=e=>{
      e.preventDefault();
      const to=Number(el.dataset.idx);
      if(_rmMediaDragIdx==null||_rmMediaDragIdx===to)return;
      const moved=_rmMediaBuffer.splice(_rmMediaDragIdx,1)[0];
      _rmMediaBuffer.splice(to,0,moved);
      _rmMediaDragIdx=null;
      _renderRoomMediaList();
    };
  });
}

function _removeRoomMedia(i){
  _rmMediaBuffer.splice(i,1);
  _renderRoomMediaList();
}

function _initRoomMediaUI(){
  const inp=document.getElementById('rm-media-url');
  if(inp&&!inp._mediaBound){
    inp._mediaBound=true;
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); _addRoomMediaUrl(); } });
  }
}

// タブレット表示（施設案内・入室案内・動画）は物件情報＞タブレット表示設定へ移設したため no-op（後方互換で関数は残置）
function switchRoomLang(lang, btn){}

function _loadRoomSettingToForm(id){
  const s=_ensureRoomSetting(id);
  document.getElementById('rm-facilityname').value=s.facilityName||'';
  document.getElementById('rm-keycode').value=s.keycode||'';
  document.getElementById('rm-phone').value=s.phone||'';
  document.getElementById('rm-wifissid').value=s.wifiSsid||'';
  document.getElementById('rm-wifipass').value=s.wifiPass||'';
  document.getElementById('rm-address').value=s.address||'';
  document.getElementById('rm-checkinurl').value=s.checkinGuideUrl||'';
  document.getElementById('rm-roomcode').value=s.roomCode||'';
  document.getElementById('rm-note1').value=s.note1||'';
  document.getElementById('rm-note2').value=s.note2||'';
  document.getElementById('rm-note3').value=s.note3||'';
  // languages / media は物件情報側で管理。既存データはそのまま保持（移行元として温存）
}

function _clearRoomSettingForm(){
  ['rm-facilityname','rm-keycode','rm-phone','rm-wifissid','rm-wifipass','rm-address','rm-checkinurl','rm-roomcode','rm-note1','rm-note2','rm-note3'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

function openRoomAdd(){editRoomId=null;document.getElementById('rm-title').textContent='部屋追加';document.getElementById('rm-del-btn').style.display='none';['rm-no','rm-type','rm-cap'].forEach(id=>document.getElementById(id).value='');_clearRoomSettingForm();document.getElementById('room-modal').classList.add('open');}
function openRoomEdit(id){const r=rooms.find(x=>x.id===id);if(!r)return;editRoomId=id;document.getElementById('rm-title').textContent='部屋詳細';document.getElementById('rm-del-btn').style.display='block';document.getElementById('rm-no').value=r.no;document.getElementById('rm-type').value=r.type;document.getElementById('rm-cap').value=r.cap;document.getElementById('rm-color').value=r.color;_loadRoomSettingToForm(id);document.getElementById('room-modal').classList.add('open');}
function saveRoom(){
  const no=String(document.getElementById('rm-no').value||'').trim()||'?',type=document.getElementById('rm-type').value||'新規部屋',cap=parseInt(document.getElementById('rm-cap').value)||2,color=document.getElementById('rm-color').value;
  let targetId;
  if(editRoomId!=null){const r=rooms.find(x=>x.id===editRoomId);if(r){r.no=no;r.type=type;r.cap=cap;r.color=color;}targetId=editRoomId;}
  else {targetId=nextRoomId++;rooms.push({id:targetId,no,type,cap,color});}
  const s=_ensureRoomSetting(targetId);
  s.facilityName=document.getElementById('rm-facilityname').value.trim();
  s.keycode=document.getElementById('rm-keycode').value.trim();
  s.phone=document.getElementById('rm-phone').value.trim();
  s.wifiSsid=document.getElementById('rm-wifissid').value.trim();
  s.wifiPass=document.getElementById('rm-wifipass').value.trim();
  s.address=document.getElementById('rm-address').value.trim();
  s.checkinGuideUrl=document.getElementById('rm-checkinurl').value.trim();
  s.roomCode=document.getElementById('rm-roomcode').value.trim();
  s.note1=document.getElementById('rm-note1').value.trim();
  s.note2=document.getElementById('rm-note2').value.trim();
  s.note3=document.getElementById('rm-note3').value.trim();
  // languages / media（施設案内・動画）は物件情報＞タブレット表示設定で管理。既存値はそのまま保持
  closeM('room-modal');renderRooms();saveRoomSettingsLS();saveToLS();cloudSave();
  showToast('🚪 部屋情報を保存しました');
}
function deleteRoom(){if(editRoomId==null)return;rooms=rooms.filter(r=>r.id!==editRoomId);delete roomSettings[editRoomId];closeM('room-modal');renderRooms();saveRoomSettingsLS();saveToLS();cloudSave();}

// ============================================================
// TODO（スタッフノート）
// ============================================================
let staffNames=['スタッフA','スタッフB','スタッフC','オーナー'];
// 種別マスタ：{label:表示名, icon:絵文字, color:文字色, bg:背景色, border:左ボーダー色}
let snTypes=[
  {label:'指示',  icon:'🔴', color:'#791F1F', bg:'#FCEBEB', border:'#E24B4A'},
  {label:'引継ぎ',icon:'🟠', color:'#633806', bg:'#FAEEDA', border:'#EF9F27'},
  {label:'メモ',  icon:'⚪', color:'#444441', bg:'#F1EFE8', border:'#B4B2A9'},
];
let snDragId=null;

// ══════════════════════════════════════════════════════════
//  定期リマインド（毎週/毎月/毎年 → 対象日にTODOへ自動生成）
//  repeatReminders: [{ id, title, detail, rank, type, repeat, weekday, monthday, month, day, lastGeneratedDate }]
//   repeat: 'weekly'|'monthly'|'yearly'
//   weekly  : weekday 0(日)〜6(土)
//   monthly : monthday 1〜31 または 'end'（月末）
//   yearly  : month 1〜12, day 1〜31
//   lastGeneratedDate: 最後にTODO生成した日付 'YYYY-MM-DD'（同周期内の再生成を防止）
// ══════════════════════════════════════════════════════════
let repeatReminders=[];
let nextReminderId=1;
// 初期シード（未登録時のみ投入）
const REPEAT_REMINDER_SEED=[
  {title:'料金カレンダー変更',              detail:'', rank:'A', type:'指示', repeat:'weekly',  weekday:5},                 // 毎週 金曜
  {title:'シフト作成',                      detail:'', rank:'A', type:'指示', repeat:'monthly', monthday:15},               // 毎月 15日
  {title:'送信業務',                        detail:'', rank:'A', type:'指示', repeat:'monthly', monthday:20},               // 毎月 20日
  {title:'給与計算・給与支払い',            detail:'', rank:'A', type:'指示', repeat:'monthly', monthday:'end'},            // 毎月 月末
  {title:'Booking.com 当日締め切り設定変更',detail:'', rank:'A', type:'指示', repeat:'yearly',  month:10, day:1},           // 毎年 10月1日
];
function _seedRemindersIfEmpty(){
  if(!Array.isArray(repeatReminders)||repeatReminders.length===0){
    repeatReminders=REPEAT_REMINDER_SEED.map((r,i)=>({id:i+1, ...r, detail:r.detail||'', lastGeneratedDate:''}));
    nextReminderId=repeatReminders.length+1;
  } else {
    nextReminderId=Math.max(0,...repeatReminders.map(r=>r.id||0))+1;
  }
}
// その月の最終日（28/29/30/31を動的判定）
function _lastDayOfMonth(y,m){ return new Date(y,m,0).getDate(); } // m:1〜12
// 指定リマインドが指定日(Date)に該当するか
function _reminderDueOn(r,dt){
  const y=dt.getFullYear(), m=dt.getMonth()+1, d=dt.getDate(), wd=dt.getDay();
  if(r.repeat==='weekly')  return Number(r.weekday)===wd;
  if(r.repeat==='monthly'){
    if(r.monthday==='end') return d===_lastDayOfMonth(y,m);
    // 指定日が存在しない月（例:31日指定の2月）は月末に寄せる
    const target=Math.min(Number(r.monthday), _lastDayOfMonth(y,m));
    return d===target;
  }
  if(r.repeat==='yearly')  return Number(r.month)===m && d===Math.min(Number(r.day), _lastDayOfMonth(y,m));
  return false;
}
function _todayStr(){ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
// 起動時・TODO表示時に呼ぶ：今日が対象日で未生成のリマインドをTODOへ生成
function generateDueReminders(){
  _seedRemindersIfEmpty();
  const now=new Date();
  const todayStr=_todayStr();
  const created=`${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  let generated=0;
  repeatReminders.forEach(r=>{
    if(r.lastGeneratedDate===todayStr)return;        // 本日分は生成済み → 再生成しない（削除後も再生成されない）
    if(!_reminderDueOn(r,now))return;                // 今日は対象日でない
    staffNotes.unshift({
      id:nextSnId++, type:r.type||'指示', rank:r.rank||'A',
      author:(staffNames&&staffNames[0])||'オーナー',
      title:r.title||'', detail:r.detail||'', done:false, created,
      repeatReminderId:r.id                          // 生成元の判別用
    });
    r.lastGeneratedDate=todayStr;                    // 最終生成日を記録
    generated++;
  });
  if(generated>0){ saveToLS(); autoSave(); }
  return generated;
}

// ── 定期リマインド設定モーダル ─────────────────────────────
let _rmdEditId=null;
const _WEEKDAY_LABEL={0:'日',1:'月',2:'火',3:'水',4:'木',5:'金',6:'土'};
function rmdOnRepeatChange(){
  const rep=document.getElementById('rmd-repeat').value;
  document.getElementById('rmd-weekly-wrap').style.display  = rep==='weekly' ?'':'none';
  document.getElementById('rmd-monthly-wrap').style.display = rep==='monthly'?'':'none';
  document.getElementById('rmd-yearly-wrap').style.display  = rep==='yearly' ?'':'none';
}
function openReminderSettings(){
  _seedRemindersIfEmpty();
  // 種類セレクトをsnTypesから生成
  document.getElementById('rmd-type').innerHTML=snTypes.map(t=>`<option value="${t.label}">${t.icon} ${t.label}</option>`).join('');
  // 日付セレクト（1〜31＋月末）
  let md='<option value="end">月末</option>';
  for(let d=1;d<=31;d++)md+=`<option value="${d}">${d}日</option>`;
  document.getElementById('rmd-monthday').innerHTML=md;
  // 年次：月・日
  document.getElementById('rmd-month').innerHTML=Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}月</option>`).join('');
  document.getElementById('rmd-yday').innerHTML=Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}日</option>`).join('');
  rmdResetForm();
  rmdRenderList();
  document.getElementById('reminder-modal').classList.add('open');
}
function rmdResetForm(){
  _rmdEditId=null;
  document.getElementById('rmd-title').value='';
  document.getElementById('rmd-detail').value='';
  document.getElementById('rmd-rank').value='A';
  document.getElementById('rmd-type').selectedIndex=0;
  document.getElementById('rmd-repeat').value='weekly';
  document.getElementById('rmd-weekday').value='5';
  document.getElementById('rmd-monthday').value='1';
  document.getElementById('rmd-month').value='1';
  document.getElementById('rmd-yday').value='1';
  document.getElementById('rmd-edit-badge').style.display='none';
  document.getElementById('rmd-cancel-edit').style.display='none';
  rmdOnRepeatChange();
}
function rmdEdit(id){
  const r=repeatReminders.find(x=>x.id===id);if(!r)return;
  _rmdEditId=id;
  document.getElementById('rmd-title').value=r.title||'';
  document.getElementById('rmd-detail').value=r.detail||'';
  document.getElementById('rmd-rank').value=r.rank||'A';
  document.getElementById('rmd-type').value=r.type||snTypes[0].label;
  document.getElementById('rmd-repeat').value=r.repeat||'weekly';
  if(r.repeat==='weekly')document.getElementById('rmd-weekday').value=String(r.weekday??5);
  if(r.repeat==='monthly')document.getElementById('rmd-monthday').value=String(r.monthday??1);
  if(r.repeat==='yearly'){document.getElementById('rmd-month').value=String(r.month??1);document.getElementById('rmd-yday').value=String(r.day??1);}
  document.getElementById('rmd-edit-badge').style.display='';
  document.getElementById('rmd-cancel-edit').style.display='';
  rmdOnRepeatChange();
  document.getElementById('reminder-modal').scrollTop=0;
}
function rmdSave(){
  const title=document.getElementById('rmd-title').value.trim();
  if(!title){ showToast('⚠ タイトルを入力してください'); return; }
  const rep=document.getElementById('rmd-repeat').value;
  const base={
    title, detail:document.getElementById('rmd-detail').value.trim(),
    rank:document.getElementById('rmd-rank').value, type:document.getElementById('rmd-type').value,
    repeat:rep
  };
  if(rep==='weekly')  base.weekday=parseInt(document.getElementById('rmd-weekday').value);
  if(rep==='monthly'){ const v=document.getElementById('rmd-monthday').value; base.monthday=(v==='end'?'end':parseInt(v)); }
  if(rep==='yearly'){ base.month=parseInt(document.getElementById('rmd-month').value); base.day=parseInt(document.getElementById('rmd-yday').value); }
  if(_rmdEditId!=null){
    const r=repeatReminders.find(x=>x.id===_rmdEditId);
    if(r)Object.assign(r, base); // lastGeneratedDateは保持
  } else {
    repeatReminders.push({ id:nextReminderId++, ...base, lastGeneratedDate:'' });
  }
  saveToLS(); autoSave();
  rmdResetForm(); rmdRenderList();
  showToast('🔁 定期リマインドを保存しました');
}
function rmdDelete(id){
  if(!confirm('この定期リマインド設定を削除しますか？\n（生成済みのTODOは残ります）'))return;
  repeatReminders=repeatReminders.filter(x=>x.id!==id);
  saveToLS(); autoSave();
  if(_rmdEditId===id)rmdResetForm();
  rmdRenderList();
}
function _rmdScheduleLabel(r){
  if(r.repeat==='weekly')  return `毎週 ${_WEEKDAY_LABEL[r.weekday]||'?'}曜`;
  if(r.repeat==='monthly') return r.monthday==='end'?'毎月 月末':`毎月 ${r.monthday}日`;
  if(r.repeat==='yearly')  return `毎年 ${r.month}月${r.day}日`;
  return '';
}
function rmdRenderList(){
  const el=document.getElementById('rmd-list');if(!el)return;
  if(!repeatReminders.length){ el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px;">登録済みのリマインドはありません</div>'; return; }
  el.innerHTML=repeatReminders.map(r=>{
    const ts=getSNTypeStyle(r.type);
    return `<div style="display:flex;align-items:center;gap:10px;background:var(--white);border:1px solid var(--sand-border);border-left:4px solid ${ts.border};border-radius:var(--radius-sm);padding:9px 12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px;">${esc(r.title)}</div>
        <div style="font-size:11px;color:var(--muted);display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <span style="font-weight:700;color:${(SN_RANK_STYLE[r.rank]||{}).color||'#555'};">Rank ${esc(r.rank)}</span>
          <span style="padding:1px 7px;border-radius:99px;${ts.badge}">${esc(ts.label)}</span>
          <span>🔁 ${esc(_rmdScheduleLabel(r))}</span>
        </div>
      </div>
      <button class="btn btn-xs" onclick="rmdEdit(${r.id})">編集</button>
      <button class="btn btn-xs btn-red" onclick="rmdDelete(${r.id})">削除</button>
    </div>`;
  }).join('');
}

// 種別スタイルをsnTypesから動的に取得
function getSNTypeStyle(label){
  const t=snTypes.find(x=>x.label===label);
  if(!t)return{badge:'background:#F1EFE8;color:#444441;border:1px solid #D3D1C7;',label,border:'#B4B2A9'};
  return{badge:`background:${t.bg};color:${t.color};border:1px solid ${t.border};`,label:`${t.icon} ${t.label}`,border:t.border};
}
function populateSNType(){
  const sel=document.getElementById('sn-type');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=snTypes.map(t=>`<option value="${t.label}"${t.label===cur?' selected':''}>${t.icon} ${t.label}</option>`).join('');
}
const SN_RANK_STYLE={
  'A':{bg:'#FCEBEB',color:'#A32D2D'},
  'B':{bg:'#FAEEDA',color:'#854F0B'},
  'C':{bg:'#F1EFE8',color:'#5F5E5A'},
};
function populateSNAuthor(){
  const sel=document.getElementById('sn-author');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=staffNames.map(n=>`<option${n===cur?' selected':''}>${n}</option>`).join('');
}
function setSNFilter(f){
  snFilter=f;
  document.querySelectorAll('.sn-filter').forEach(b=>b.classList.toggle('active',b.dataset.f===f));
  renderStaffNotes();
}
function renderStaffNotes(){
  populateSNAuthor();populateSNType();
  const el=document.getElementById('sn-list');if(!el)return;
  let notes=[...staffNotes];
  if(snFilter==='A'||snFilter==='B'||snFilter==='C') notes=notes.filter(n=>n.rank===snFilter);
  else if(snFilter==='未確認') notes=notes.filter(n=>!n.done);
  // 未確認→確認済、同じ状態内ではランクA→B→C、同ランク内は配列順（ユーザー並び替え順）
  notes.sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    const ro={A:0,B:1,C:2};
    const rd=(ro[a.rank]??2)-(ro[b.rank]??2);
    if(rd!==0)return rd;
    return staffNotes.indexOf(a)-staffNotes.indexOf(b);
  });
  const undone=staffNotes.filter(n=>!n.done).length;
  const cntEl=document.getElementById('sn-count');
  if(cntEl)cntEl.textContent=`未確認 ${undone}件 / 全${staffNotes.length}件`;
  if(!notes.length){
    el.innerHTML=`<div class="card" style="color:var(--muted);text-align:center;padding:2rem;">TODOはありません</div>`;
    return;
  }
  el.innerHTML=notes.map(n=>{
    const ts=getSNTypeStyle(n.type);
    const rs=SN_RANK_STYLE[n.rank||'C'];
    return `<div class="card" style="margin-bottom:8px;border-left:4px solid ${n.done?'#B4B2A9':ts.border};opacity:${n.done?0.6:1};"
      data-snid="${n.id}"
      ondragover="event.preventDefault();this.style.outline='2px dashed var(--ocean)'"
      ondragleave="this.style.outline=''"
      ondrop="snDrop(event,${n.id})">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div draggable="true" ondragstart="snDragStart(event,${n.id})" title="ドラッグで並び替え" style="color:var(--light);font-size:18px;cursor:grab;padding-top:1px;flex-shrink:0;line-height:1;">⠿</div>
        <div onclick="toggleSN(${n.id})" style="width:22px;height:22px;border-radius:6px;border:2px solid ${n.done?'var(--seaglass)':'var(--sand-border)'};background:${n.done?'var(--seaglass)':'var(--white)'};flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-top:2px;">
          ${n.done?'<span style="color:#fff;font-size:13px;line-height:1;">✓</span>':''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            ${n.repeatReminderId?`<span style="font-size:10px;font-weight:700;color:#0e6b5e;background:#d1f2eb;border:1px solid #7fd6c4;border-radius:99px;padding:2px 8px;">🔁 定期</span>`:''}
            ${snRankSelectHtml(n.id,n,11)}
            ${snTypeSelectHtml(n.id,n,11)}
            <span style="font-size:11px;font-weight:600;color:var(--ink);">${esc(n.author)}</span>
            <span style="font-size:11px;color:var(--muted);">${esc(n.created)}</span>
            ${n.done?`<span style="font-size:10px;color:var(--seaglass);margin-left:auto;">✓ 確認済</span>`:''}
          </div>
          <!-- タイトル（タップで直接編集） -->
          <div class="sn-ce" contenteditable="true" data-ph="タイトルを入力"
            onblur="snInlineText(${n.id},'title',this)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
            style="font-size:14.5px;font-weight:700;line-height:1.4;color:${n.done?'var(--muted)':'var(--ink)'};${n.done?'text-decoration:line-through;':''}margin-bottom:3px;padding:2px 4px;">${esc(n.title||n.text||'')}</div>
          <!-- 詳細（タップで直接編集・改行可） -->
          <div class="sn-ce" contenteditable="true" data-ph="詳細を入力（任意）"
            onblur="snInlineText(${n.id},'detail',this)"
            style="font-size:12px;color:${n.done?'var(--light)':'var(--text)'};line-height:1.65;white-space:pre-wrap;padding:2px 4px;min-height:1.2em;">${esc(n.detail||'')}</div>
        </div>
        <button onclick="deleteSN(${n.id})" class="btn btn-xs" style="flex-shrink:0;color:var(--muted);">✕</button>
      </div>
    </div>`;
  }).join('');
}
function addStaffNote(){
  const titleEl=document.getElementById('sn-title');
  const title=titleEl.value.trim();if(!title)return titleEl.focus();
  const detail=document.getElementById('sn-detail').value.trim();
  const now=new Date();
  const created=`${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  staffNotes.unshift({
    id:nextSnId++,
    type:document.getElementById('sn-type').value,
    rank:document.getElementById('sn-rank').value,
    author:document.getElementById('sn-author').value,
    title,detail,done:false,created
  });
  titleEl.value='';document.getElementById('sn-detail').value='';
  renderStaffNotes();renderRankAPanel();saveToLS();autoSave();
}
function toggleSN(id){const n=staffNotes.find(x=>x.id===id);if(n)n.done=!n.done;renderStaffNotes();renderRankAPanel();saveToLS();autoSave();}
function deleteSN(id){if(!confirm('このTODOを削除しますか？'))return;staffNotes=staffNotes.filter(x=>x.id!==id);renderStaffNotes();renderRankAPanel();saveToLS();autoSave();}

// ── TODO編集 ─────────────────────────────────────────────
let _snEditId=null;
function editSN(id){
  const n=staffNotes.find(x=>x.id===id);
  if(!n)return;
  _snEditId=id;
  document.getElementById('sn-edit-type').value=n.type||'指示';
  document.getElementById('sn-edit-rank').value=n.rank||'C';
  document.getElementById('sn-edit-title').value=n.title||n.text||'';
  document.getElementById('sn-edit-detail').value=n.detail||'';
  document.getElementById('sn-edit-modal').classList.add('open');
  setTimeout(()=>document.getElementById('sn-edit-title').focus(),80);
}
function saveSN(){
  const n=staffNotes.find(x=>x.id===_snEditId);
  if(!n)return;
  n.type=document.getElementById('sn-edit-type').value;
  n.rank=document.getElementById('sn-edit-rank').value;
  const t=document.getElementById('sn-edit-title').value.trim();
  if(t)n.title=t;
  n.detail=document.getElementById('sn-edit-detail').value.trim();
  document.getElementById('sn-edit-modal').classList.remove('open');
  _snEditId=null;
  renderStaffNotes();renderRankAPanel();saveToLS();autoSave();
  showToast('✏ TODOを更新しました');
}
function deleteSNFromEdit(){
  if(_snEditId==null)return;
  if(!confirm('このTODOを削除しますか？'))return;
  staffNotes=staffNotes.filter(x=>x.id!==_snEditId);
  document.getElementById('sn-edit-modal').classList.remove('open');
  _snEditId=null;
  renderStaffNotes();renderRankAPanel();saveToLS();autoSave();
  showToast('🗑 TODOを削除しました');
}
// ── TODOインライン編集（Googleタスク風） ─────────────────
// タイトル/詳細をその場で編集（contenteditableのblur時に保存）
function snInlineText(id,field,el){
  const n=staffNotes.find(x=>x.id===id);
  if(!n)return;
  const v=el.innerText.replace(/ /g,' ').replace(/\n+$/,'').trim();
  if(field==='title'){
    if(!v){el.innerText=n.title||n.text||'';return;} // タイトル空は元に戻す
    if(v===(n.title||n.text))return;
    n.title=v;
  }else{
    if(v===(n.detail||''))return;
    n.detail=v;
  }
  saveToLS();autoSave();
}
// 種別/ランクをその場で変更（selectのchange時に保存・再描画）
function snInlineMeta(id,field,value){
  const n=staffNotes.find(x=>x.id===id);
  if(!n)return;
  n[field]=value;
  renderStaffNotes();renderRankAPanel();saveToLS();autoSave();
}
// 種別selectのHTMLを生成（バッジ風）
function snTypeSelectHtml(id,n,fontSize){
  const ts=getSNTypeStyle(n.type);
  return `<select class="sn-metasel" onchange="snInlineMeta(${id},'type',this.value)" title="種別を変更"
    style="font-size:${fontSize}px;font-weight:700;padding:2px 8px;border-radius:99px;${ts.badge}">`
    +snTypes.map(t=>`<option value="${t.label}"${t.label===n.type?' selected':''}>${t.icon} ${t.label}</option>`).join('')
    +`</select>`;
}
// ランクselectのHTMLを生成（バッジ風）
function snRankSelectHtml(id,n,fontSize){
  const rs=SN_RANK_STYLE[n.rank||'C'];
  return `<select class="sn-metasel" onchange="snInlineMeta(${id},'rank',this.value)" title="ランクを変更"
    style="font-size:${fontSize}px;font-weight:800;padding:2px 8px;border-radius:99px;background:${rs.bg};color:${rs.color};">`
    +['A','B','C'].map(r=>`<option value="${r}"${r===(n.rank||'C')?' selected':''}>Rank ${r}</option>`).join('')
    +`</select>`;
}
// ドラッグ並び替え
function snDragStart(e,id){snDragId=id;e.dataTransfer.effectAllowed='move';}
function snDrop(e,targetId){
  e.preventDefault();
  document.querySelectorAll('#sn-list .card').forEach(c=>c.style.outline='');
  if(snDragId===null||snDragId===targetId){snDragId=null;return;}
  const fi=staffNotes.findIndex(n=>n.id===snDragId);
  const ti=staffNotes.findIndex(n=>n.id===targetId);
  if(fi<0||ti<0){snDragId=null;return;}
  const [moved]=staffNotes.splice(fi,1);
  staffNotes.splice(ti,0,moved);
  snDragId=null;renderStaffNotes();renderRankAPanel();saveToLS();autoSave();
}
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
function collectAllData() {
  return {
    guestData,cancelList,parkData,surfList,staffNotes,salesData,
    occCumul,cleaningData,roomSettings,rooms,roomPriorityMaster,unassignedReservations,
    budgets,staffNames,snTypes,priorityCleaningItems,priorityCleaningSettings,
    rentalSpaceReservations,propertySettings,repeatReminders,
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

// ============================================================
// CHARTER EDIT / DELETE
// ============================================================
// 編集中の貸切を特定するためのキー保持
let editCharterGroup=null, editCharterStartDay=null, editCharterMonth=null;

function openCharterNew(){
  editCharterGroup=null;
  editCharterStartDay=null;
  editCharterMonth=parseInt(document.getElementById('sel-month').value);
  document.getElementById('cm2-form').style.display='';
  document.getElementById('cm2-confirm').style.display='none';
  document.getElementById('cm2-title').textContent='🔒 貸切 新規追加';
  document.getElementById('cm2-group').value='ANNEX';
  // 表示月の1日をデフォルト
  const y=parseInt(document.getElementById('sel-year')?document.getElementById('sel-year').value:2026);
  const m=editCharterMonth;
  document.getElementById('cm2-day').value=`${y}-${String(m).padStart(2,'0')}-01`;
  document.getElementById('cm2-nights').value='1';
  document.getElementById('cm2-arrival').value='';
  document.getElementById('cm2-guests').value='1';
  document.getElementById('cm2-price').value='';
  document.getElementById('cm2-name').value='';
  document.getElementById('cm2-site').value='直接';
  document.getElementById('cm2-pay').value='事前決済';
  document.getElementById('cm2-note').value='';
  document.getElementById('cm2-status').value='reserved';
  populateNat('cm2-nat','');
  document.getElementById('cm2-sex').value='';
  document.getElementById('cm2-note').value='';
  document.getElementById('cm2-parking').checked=false;
  document.getElementById('cm2-surf').checked=false;
  document.getElementById('cm2-enospa').checked=false;
  document.getElementById('cm2-enosui').checked=false;
  document.getElementById('cm2-wshoku').checked=false;
  document.getElementById('cm2-yshoku').checked=false;
  document.getElementById('cm2-late').checked=false;
  document.getElementById('cm2-del-btn').style.display='none';
  document.getElementById('charter-modal').classList.add('open');
}

function openCharterEdit(charterGroup, startDay, month){
  if(currentRole==='reception'||currentRole==='watanabe')return;
  editCharterGroup=charterGroup;
  editCharterStartDay=parseInt(startDay);
  editCharterMonth=parseInt(month);

  // フォームを表示・確認パネルを隠す
  document.getElementById('cm2-form').style.display='';
  document.getElementById('cm2-confirm').style.display='none';

  // 編集時は削除ボタンを表示
  document.getElementById('cm2-del-btn').style.display='';

  // アンカー部屋からメタデータ取得（なければデフォルト値で開く）
  const charterGroupRooms=rooms.filter(r=>{
    if(charterGroup==='ANNEX')return r.group==='ANNEX−個室'||r.group==='ANNEX−ドミトリー';
    return r.group==='本館−個室'||r.group==='本館−男女混合ドミトリー';
  });
  const anchorRoom=charterGroupRooms[0];
  const meta=anchorRoom?guestData[gk(editCharterMonth,anchorRoom.id,editCharterStartDay)]:null;

  // 泊数を計算
  let nights=1;
  if(anchorRoom&&meta){
    while(true){
      const next=guestData[gk(editCharterMonth,anchorRoom.id,editCharterStartDay+nights)];
      if(!next||!next.charter)break;
      if(next.charterAnchor)break;
      if(!next.cont)break;
      nights++;
    }
  }

  document.getElementById('cm2-title').textContent=`貸切 詳細（${charterGroup}）`;
  document.getElementById('cm2-group').value=charterGroup;
  // 日付をYYYY-MM-DD形式でセット
  const y2=2026;
  document.getElementById('cm2-day').value=`${y2}-${String(month).padStart(2,'0')}-${String(editCharterStartDay).padStart(2,'0')}`;
  document.getElementById('cm2-nights').value=nights;
  document.getElementById('cm2-arrival').value=meta?meta.arrivalTime||'':'';
  document.getElementById('cm2-guests').value=meta?meta.guests||1:1;
  document.getElementById('cm2-price').value=meta&&meta.price?meta.price:'';
  document.getElementById('cm2-name').value=meta?meta.name||'':'';
  document.getElementById('cm2-site').value=meta?meta.site||'直接':'直接';
  document.getElementById('cm2-pay').value=meta?meta.pay||'事前決済':'事前決済';
  document.getElementById('cm2-note').value=meta?meta.note||'':'';
  document.getElementById('cm2-status').value=isCheckedIn(meta&&meta.status)?'checked_in':'reserved';
  populateNat('cm2-nat', meta?meta.nat||'':'');
  document.getElementById('cm2-sex').value=meta?meta.sex||'':'';
  document.getElementById('cm2-note').value=meta?meta.note||'':'';
  document.getElementById('cm2-parking').checked=!!(meta&&meta.parking);
  const metaNote=meta?meta.note||'':'';
  document.getElementById('cm2-surf').checked=hasSurfKw(metaNote)||!!(meta&&meta.surf);
  document.getElementById('cm2-enospa').checked=metaNote.includes('えのすぱ');
  document.getElementById('cm2-enosui').checked=metaNote.includes('えのすい');
  document.getElementById('cm2-wshoku').checked=metaNote.includes('和食');
  document.getElementById('cm2-yshoku').checked=metaNote.includes('洋食');
  document.getElementById('cm2-late').checked=metaNote.includes('レイトチェックアウト');
  document.getElementById('charter-modal').classList.add('open');
}

function saveCharter(){
  const newGroup=document.getElementById('cm2-group').value;
  // 日付をYYYY-MM-DD形式からmonth/dayに分解
  const dateVal=document.getElementById('cm2-day').value;
  let m=editCharterMonth, newDay=1;
  if(dateVal){
    const parts=dateVal.split('-');
    m=parseInt(parts[1])||editCharterMonth;
    newDay=parseInt(parts[2])||1;
    editCharterMonth=m;
  }
  const newNights=parseInt(document.getElementById('cm2-nights').value)||1;
  const newArrival=document.getElementById('cm2-arrival').value.trim();
  const newGuests=parseInt(document.getElementById('cm2-guests').value)||1;
  const newPrice=parseInt(document.getElementById('cm2-price').value)||null;
  const newName=document.getElementById('cm2-name').value||'貸切';
  const newSite=document.getElementById('cm2-site').value||'直接';
  const newPay=document.getElementById('cm2-pay').value;
  const newNat=document.getElementById('cm2-nat').value||'';
  const newSex=document.getElementById('cm2-sex').value||'';
  // プランキーワードをnoteに追記
  let newNote=document.getElementById('cm2-note').value;
  const planCbs=[
    {id:'cm2-enospa',tag:'えのすぱ'},{id:'cm2-enosui',tag:'えのすい'},
    {id:'cm2-wshoku',tag:'和食'},{id:'cm2-yshoku',tag:'洋食'},
    {id:'cm2-late',tag:'レイトチェックアウト'},
  ];
  planCbs.forEach(({id,tag})=>{
    const checked=document.getElementById(id).checked;
    if(checked&&!newNote.includes(tag))newNote=newNote?newNote+' '+tag:tag;
    else if(!checked)newNote=newNote.replace(tag,'').replace(/\s+/g,' ').trim();
  });
  const useParking=document.getElementById('cm2-parking').checked||hasParkKw(newNote);
  const useSurf=document.getElementById('cm2-surf').checked||hasSurfKw(newNote);
  // ステータス（予約済み / チェックイン済み）。通常予約と同じ status / checkedInAt を持たせる
  const newStatus=isCheckedIn(document.getElementById('cm2-status').value)?'checked_in':'reserved';
  const _p=n=>String(n).padStart(2,'0');
  const _nowD=new Date();
  const newCheckedInAt=newStatus==='checked_in'
    ?`${_nowD.getFullYear()}-${_p(_nowD.getMonth()+1)}-${_p(_nowD.getDate())}T${_p(_nowD.getHours())}:${_p(_nowD.getMinutes())}:${_p(_nowD.getSeconds())}`:'';

  // 編集時のみ旧データを削除（新規作成時はスキップ）
  if(editCharterStartDay!==null){
    _deleteCharterData(editCharterGroup, editCharterStartDay, m);
  }

  const newGroupRooms=rooms.filter(r=>{
    if(newGroup==='ANNEX')return r.group==='ANNEX−個室'||r.group==='ANNEX−ドミトリー';
    return r.group==='本館−個室'||r.group==='本館−男女混合ドミトリー';
  });

  // ── 衝突チェック：貸切の書込先セルに既存予約（通常/別の貸切）が無いか ──
  // 編集時は自分の旧セルを上で削除済みのため、ここで残っているのは他予約のみ。
  // これが無いと貸切作成で既存の通常予約を黙って上書きしてしまう（レビュー#10）。
  for(const room of newGroupRooms){
    for(let n=0;n<newNights;n++){
      if(guestData[gk(m,room.id,newDay+n)]){
        showToast('⚠ 貸切期間に既存の予約があるため保存できません（先に該当予約を移動・削除してください）');
        return;
      }
    }
  }

  const gBase={
    name:newName, site:newSite, pay:newPay, price:newPrice,
    nat:newNat, sex:newSex, cat:newGroup==='ANNEX'?'ANNEX貸切':'本館貸切',
    note:newNote, status:newStatus, checkedInAt:newCheckedInAt, guests:newGuests,
    arrivalTime:newArrival, parking:useParking,
    charter:true, charterGroup:newGroup,
  };
  newGroupRooms.forEach((room,ri)=>{
    for(let n=0;n<newNights;n++){
      guestData[gk(m,room.id,newDay+n)]={
        ...gBase, roomId:room.id, day:newDay+n,
        price:ri===0&&n===0?newPrice:null,
        cont:ri>0||n>0, charterAnchor:ri===0&&n===0,
      };
    }
  });
  // 駐車場：チェックONなら自動追加、OFFなら既存を削除
  if(useParking){
    const anchor={...gBase, roomId:newGroupRooms[0]?.id||0, day:newDay};
    addAutoPark(anchor, m);
  } else {
    removeAutoPark({name:newName, roomId:newGroupRooms[0]?.id||0, day:newDay}, m);
  }
  if(useSurf){ addAutoSurf(gBase, m); }
  else { removeAutoSurf(gBase); }
  closeM('charter-modal');
  renderReg();autoSave();
}
// 削除確認パネルを表示（confirm()を使わずモーダル内で完結）
function showCharterDeleteConfirm(){
  document.getElementById('cm2-form').style.display='none';
  document.getElementById('cm2-confirm-detail').textContent=
    `${editCharterGroup} / ${editCharterMonth}月${editCharterStartDay}日〜`;
  document.getElementById('cm2-confirm').style.display='';
}
function hideCharterDeleteConfirm(){
  document.getElementById('cm2-form').style.display='';
  document.getElementById('cm2-confirm').style.display='none';
}
function execDeleteCharter(){
  _deleteCharterData(editCharterGroup, editCharterStartDay, editCharterMonth);
  closeM('charter-modal');
  renderReg();autoSave();
}
// 後方互換
function deleteCharter(){ execDeleteCharter(); }

// 内部用：貸切の全データを guestData から削除する
function _deleteCharterData(charterGroup, startDay, m){
  if(!charterGroup||!startDay||!m)return; // 引数が揃っていない場合は安全終了
  const targetRooms=rooms.filter(r=>{
    if(charterGroup==='ANNEX')return r.group==='ANNEX−個室'||r.group==='ANNEX−ドミトリー';
    return r.group==='本館−個室'||r.group==='本館−男女混合ドミトリー';
  });
  const maxDays=gDays(2026,m);
  // ① 先にキーをすべて収集してから削除（削除しながら参照するとbreakが誤動作する）
  const keysToDelete=[];
  targetRooms.forEach(room=>{
    for(let d=startDay;d<=maxDays;d++){
      const g=guestData[gk(m,room.id,d)];
      if(!g||!g.charter)break;
      if(d>startDay&&g.charterAnchor)break; // 別の貸切の開始日なら止める
      keysToDelete.push(gk(m,room.id,d));
    }
  });
  // ② 一括削除
  keysToDelete.forEach(k=>delete guestData[k]);
}

// ============================================================
// BUDGET
// ============================================================
function openBudgetEdit(){
  const months=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('budget-inputs').innerHTML=months.map((mn,i)=>`
    <div class="fl"><label>${mn}</label><input type="number" id="bgt-${i+1}" value="${budgets[i+1]||''}" placeholder="0"></div>`).join('');
  document.getElementById('budget-modal').classList.add('open');
}
function saveBudget(){
  for(let m=1;m<=12;m++){
    const v=parseInt(document.getElementById(`bgt-${m}`).value)||0;
    budgets[m]=v;
  }
  closeM('budget-modal');
  renderReg();
  saveToLS();
  cloudSave(); // TODO・部屋設定と同じ共通クラウド保存経路を使用
  showToast('💰 月別予算を保存しました');
}

// ============================================================
// BOOT
// ============================================================
loadFromLS();
// 現在年月をセレクタに反映
(function(){
  const now=new Date();
  const sel=document.getElementById('sel-month');
  if(sel)sel.value=String(now.getMonth()+1);
})();
loadRoomPriority();
loadSalesEvents();
loadRoomSettingsLS();
initData();
renderFilterUI();
_updateMonthDisplay();
// GAS連携時は初期描画を抑制し、cloudLoad完了時に1回だけ描画する（起動時の多重renderReg対策）。
// GAS未設定時はローカルデータで即時描画する。
_suppressRenderReg=!!GAS_URL;
renderReg();
renderRankAPanel();
// ── 検索バー：氏名・予約ID・国籍・備考・サイト等で絞り込み ──────────
// 検索対象テキストを生成（予約データ1件分）
function _searchHay(g){
  return [g&&g.name,g&&g.reservationId,g&&g.nat,g&&g.note,g&&g.site,g&&g.phone,g&&g.email,g&&g.cat]
    .filter(Boolean).join(' ').toLowerCase();
}
function _searchTerms(){
  const input=document.getElementById('reg-search-input');
  return input ? (input.value||'').trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
}
// 表示中の月のセルに強調/淡色化を適用。jump:true で先頭ヒットへスクロール。
function applyRegSearch(opts){
  const terms=_searchTerms();
  const cells=document.querySelectorAll('#page-register .gc');
  if(terms.length===0){
    cells.forEach(c=>c.classList.remove('search-hit','search-dim'));
    return 0;
  }
  let hitCount=0,firstHit=null;
  cells.forEach(c=>{
    const g=guestData[c.getAttribute('data-k')];
    const hit=terms.every(t=>_searchHay(g).includes(t));
    c.classList.toggle('search-hit',hit);
    c.classList.toggle('search-dim',!hit);
    if(hit){hitCount++;if(!firstHit)firstHit=c;}
  });
  if(opts&&opts.jump&&firstHit){
    firstHit.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
  }
  return hitCount;
}
// 全月・全年を横断検索し、当月に無ければ該当月へ移動してから強調する。
function runRegSearch(){
  const value=(document.getElementById('reg-search-input').value||'').trim();
  const terms=value.toLowerCase().split(/\s+/).filter(Boolean);
  console.log('Search query:',value,terms);
  if(terms.length===0){applyRegSearch();return;}
  const curY=parseInt(document.getElementById('sel-year').value)||2026;
  const curM=parseInt(document.getElementById('sel-month').value);
  // guestData全体を走査（アンカー行のみ＝cont:falseで予約単位にカウント）
  const matches=[];
  for(const k in guestData){
    const g=guestData[k];
    if(!g||g.cont)continue;
    if(terms.every(t=>_searchHay(g).includes(t)))matches.push(parseKey(k));
  }
  if(matches.length===0){
    applyRegSearch();
    if(typeof showToast==='function')showToast('🔍 該当する予約はありません');
    return;
  }
  // 移動先：当月にヒットがあれば当月を維持、無ければ最も早い年月へ
  const inCurrent=matches.some(p=>p.y===curY&&p.m===curM);
  const monthSet=new Set(matches.map(p=>p.y*100+p.m));
  let target;
  if(inCurrent){
    target={y:curY,m:curM};
  } else {
    target=matches.slice().sort((a,b)=>a.y-b.y||a.m-b.m||a.d-b.d)[0];
    document.getElementById('sel-year').value=String(target.y);
    document.getElementById('sel-month').value=String(target.m);
    DISP_YEAR=target.y;
    _updateMonthDisplay();
    renderReg(); // renderReg内でapplyRegSearch()が呼ばれ強調が反映される
  }
  applyRegSearch({jump:true});
  if(typeof showToast==='function'){
    const label=`${target.y===2026?'':target.y+'/'}${target.m}月`;
    const more=monthSet.size>1?`（${monthSet.size}か月に分散・${label}を表示）`:'';
    showToast(`🔍 全${matches.length}件ヒット${more}`);
  }
}
(function initRegSearch(){
  const input=document.getElementById('reg-search-input');
  if(!input)return;
  input.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    runRegSearch();
  });
  // 入力が空になったら強調を即解除
  input.addEventListener('input',()=>{
    if(input.value.trim()==='')applyRegSearch();
  });
})();
// ── 全パネルに右上の閉じる(×)ボタンを付与 ──────────────────────
(function addModalCloseButtons(){
  document.querySelectorAll('.mbg').forEach(mbg=>{
    if(!mbg.id||mbg.querySelector(':scope > .mbg-close'))return;
    const btn=document.createElement('button');
    btn.className='mbg-close';
    btn.setAttribute('aria-label','閉じる');
    btn.setAttribute('title','閉じる');
    btn.innerHTML='&times;';
    btn.onclick=()=>closeM(mbg.id);
    mbg.appendChild(btn);
  });
})();
if(typeof renderUnassignedPanel==='function')renderUnassignedPanel();
if(rankAPanelHidden){
  const panel=document.getElementById('rank-a-panel');
  const reopen=document.getElementById('rank-a-reopen');
  if(panel)panel.style.width='0';
  if(reopen)reopen.style.display='';
}
// クラウド同期：初回読込→最新データをGASに保存
// ── スマホ：スクロール領域高さをJSで直接設定 ──────────────
function adjustRegScrollHeight(){
  if(Math.min(window.screen.width,window.screen.height)>768)return;
  const el=document.getElementById('reg-scroll');
  if(!el)return;
  const top=el.getBoundingClientRect().top;
  // visualViewport APIでアドレスバーを除いた正確な高さを取得
  const vh=window.visualViewport?window.visualViewport.height:window.innerHeight;
  el.style.maxHeight='none';
  el.style.height=(vh-top-8)+'px';
  el.style.overflowY='auto';
}
window.addEventListener('resize',adjustRegScrollHeight);
if(window.visualViewport)window.visualViewport.addEventListener('resize',adjustRegScrollHeight);
// renderReg後にも再計算
const _rrOrig=renderReg;
renderReg=function(){_rrOrig.apply(this,arguments);setTimeout(adjustRegScrollHeight,100);};

if(GAS_URL){
  cloudLoad(true).then(()=>{ _suppressRenderReg=false; autoImportCancelIfNeeded(); generateDueReminders(); renderStaffNotes(); renderRankAPanel(); renderReg(); setTimeout(()=>cloudSave(),3000); });
  // フォールバック：クラウド応答が遅延/停止しても画面が空白のままにならないよう、
  // 一定時間経っても初期描画が終わっていなければローカルデータで描画する。
  setTimeout(()=>{ if(_suppressRenderReg){ _suppressRenderReg=false; renderReg(); } }, 1500);
  startPolling(); rentalCloudLoad(true);
}
else { updateSyncStatus('warn','GAS URL未設定'); autoImportCancelIfNeeded(); generateDueReminders(); }

// reg-scroll の横スクロールをdebounceで保存
(()=>{
  const scEl=document.getElementById('reg-scroll');
  if(!scEl)return;
  let _t;
  scEl.addEventListener('scroll',()=>{
    clearTimeout(_t);
    _t=setTimeout(_saveRegScroll,400);
  },{passive:true});
})();
// 初期表示後にスマホ高さ調整
setTimeout(adjustRegScrollHeight,300);

// ── PIN認証 ──────────────────────────────────────────────────
// PINは平文ではなくSHA-256ハッシュで保持（公開リポジトリからPIN値を秘匿）。
// PINを変更するときは、コンソールで
//   crypto.subtle.digest('SHA-256',new TextEncoder().encode('新PIN')).then(b=>console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
// を実行してハッシュを取得し、下記キーを差し替える。
const PIN_ROLES={
  '739ec77b846ad913811cc124579cc44f902f83f5bd4e89256ff0e826ddb64ce4':{role:'admin',    name:'管理者',       pages:'all'},
  '9b8f2fa45e4b5f1962f98a562df2f105c9b3bd7b9ef70aca4bc2fd07692b7958':{role:'cleaning', name:'清掃スタッフ', pages:['cleaning']},
  '52a6932d5af5316a815af86286167054ebaa4953cedb82e3914a5c126e363ea4':{role:'reception',name:'接客スタッフ', pages:['register','parking','rental','surf','cleaning']},
  // 渡辺千尋：宿泊者名簿・清掃予定表の閲覧のみ。ただしSea Breeze 鎌倉/三浦のセル移動は可能
  'ae9123de2fc403666c9f48a6546fffc5257ff69536f7c4d8f8d5d327d6a4e061':{role:'watanabe', name:'渡辺千尋',     pages:['register','cleaning']},
};
// 入力PINをSHA-256ハッシュ化（照合用）
async function _hashPin(pin){
  const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(pin)));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
// Sea Breeze 鎌倉・三浦の部屋か判定（roleごとのセル移動許可に使用）
function _isSBRoom(rid){
  const r=(rooms||[]).find(x=>String(x.id)===String(rid));
  return !!(r && typeof r.group==='string' && r.group.indexOf('Sea Breeze')===0);
}
let _pinBuffer='';
let currentRole=null;

function pinInput(d){
  if(_pinBuffer.length>=4)return;
  _pinBuffer+=d;
  _updatePinDots();
  if(_pinBuffer.length===4)setTimeout(_checkPin,80);
}
function pinBackspace(){_pinBuffer=_pinBuffer.slice(0,-1);_updatePinDots();}
function pinClear(){_pinBuffer='';_updatePinDots();}
function _updatePinDots(){
  for(let i=0;i<4;i++){
    document.getElementById('pd'+i)?.classList.toggle('filled',i<_pinBuffer.length);
  }
  document.getElementById('pin-error').textContent='';
}
async function _checkPin(){
  const entered=_pinBuffer;
  const hash=await _hashPin(entered);
  const r=PIN_ROLES[hash];
  if(!r){
    _pinBuffer='';_updatePinDots();
    document.getElementById('pin-error').textContent='PINが違います'; // _updatePinDotsがクリアするので後に設定
    return;
  }
  sessionStorage.setItem('hotel_pin_role',r.role);
  sessionStorage.setItem('hotel_pin_name',r.name);
  _applyRole(r.role,r.name);
  document.getElementById('pin-overlay').style.display='none';
  setTimeout(()=>{if(typeof adjustRegScrollHeight==='function')adjustRegScrollHeight();},100);
}
function _applyRole(role,name){
  currentRole=role;
  document.body.classList.remove('role-admin','role-cleaning','role-reception','role-watanabe','viewonly');
  document.body.classList.add('role-'+role);
  if(role!=='admin')document.body.classList.add('viewonly');
  if(role==='reception'){
    document.addEventListener('dragstart',function _receptionNoDrag(e){
      if(e.target.closest&&e.target.closest('.gc'))e.preventDefault();
    },true);
  }
  const badge=document.getElementById('role-badge');
  if(badge){badge.textContent=name+' ログイン中';badge.style.display='';}
  // 許可ページ以外にいたら先頭許可ページへ移動
  if(role==='cleaning'){
    showP('cleaning',document.getElementById('nitem-cleaning'));
    // 清掃サブメニューを開く
    const cs=document.getElementById('cleaning-submenu');
    if(cs)cs.style.display='block';
  } else if(role==='reception'){
    showP('register',document.querySelector('.nitem[onclick*="showP(\'register\'"]'));
  } else if(role==='watanabe'){
    // Sea Breeze 鎌倉/三浦以外のセルはドラッグ開始を抑止（移動不可）
    document.addEventListener('dragstart',function _watanabeDragGuard(e){
      const cell=e.target.closest&&e.target.closest('[data-k]');
      if(cell){ if(!_isSBRoom(parseKey(cell.getAttribute('data-k')).r))e.preventDefault(); }
    },true);
    showP('register',document.querySelector('.nitem[onclick*="showP(\'register\'"]'));
  }
}
function pinLogout(){
  if(!confirm('ログアウトしますか？'))return;
  sessionStorage.removeItem('hotel_pin_role');
  sessionStorage.removeItem('hotel_pin_name');
  currentRole=null;_pinBuffer='';
  document.body.classList.remove('role-admin','role-cleaning','role-reception','role-watanabe','viewonly');
  document.getElementById('role-badge').style.display='none';
  _updatePinDots();
  document.getElementById('pin-error').textContent='';
  document.getElementById('pin-overlay').style.display='flex';
}
// ページ遷移時に権限チェック
const _showPOrig=showP;
showP=function(n,el){
  if(currentRole&&currentRole!=='admin'){
    const allowed=PIN_ROLES[Object.keys(PIN_ROLES).find(k=>PIN_ROLES[k].role===currentRole)]?.pages||[];
    if(allowed!=='all'&&!allowed.includes(n))return;
  }
  _showPOrig(n,el);
};
// セッション復元
(()=>{
  const r=sessionStorage.getItem('hotel_pin_role');
  const name=sessionStorage.getItem('hotel_pin_name');
  if(r&&PIN_ROLES[Object.keys(PIN_ROLES).find(k=>PIN_ROLES[k].role===r)]){
    _applyRole(r,name||r);
    document.getElementById('pin-overlay').style.display='none';
  }
})();

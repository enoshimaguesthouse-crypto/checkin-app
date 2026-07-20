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
let sbOpen=true;
let rooms=[
  // 本館−個室（ダブル・ツイン）
  // ※ no は「部屋情報」画面に表示される部屋番号そのもの（表示専用の文字列）。
  //    チェックインアプリの DEFAULT_ROOMS と必ず同じ値に保つこと（ズレると誤室案内の原因）。
  {id:0, no:'①', type:'本館−ダブル', group:'本館−個室', cap:2, color:'#185FA5', label:'①ダブル'},
  {id:1, no:'②', type:'本館−ツイン', group:'本館−個室', cap:2, color:'#185FA5', label:'②ツイン'},
  // 本館−男女混合ドミトリー（3号室のベッド G H I J K L M N O P の10部屋）
  {id:2, no:'③−G', type:'本館−男女混合ドミトリー G', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:3, no:'③−H', type:'本館−男女混合ドミトリー H', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:4, no:'③−I', type:'本館−男女混合ドミトリー I', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:5, no:'③−J', type:'本館−男女混合ドミトリー J', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:6, no:'③−K', type:'本館−男女混合ドミトリー K', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:7, no:'③−L', type:'本館−男女混合ドミトリー L', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:8, no:'③−M', type:'本館−男女混合ドミトリー M', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:9, no:'③−N', type:'本館−男女混合ドミトリー N', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:10,no:'③−O', type:'本館−男女混合ドミトリー O', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  {id:11,no:'③−P', type:'本館−男女混合ドミトリー P', group:'本館−男女混合ドミトリー', cap:1, color:'#854F0B'},
  // ANNEX−個室（①②の2部屋）
  {id:12,no:'①', type:'ANNEX−個室①',           group:'ANNEX−個室',       cap:4, color:'#993556'},
  {id:13,no:'②', type:'ANNEX−個室②',           group:'ANNEX−個室',       cap:4, color:'#993556'},
  // ANNEX−ドミトリー（3号室のベッド A B C D E F の6部屋）
  {id:14,no:'③−A', type:'ANNEX−ドミトリー A',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:15,no:'③−B', type:'ANNEX−ドミトリー B',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:16,no:'③−C', type:'ANNEX−ドミトリー C',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:17,no:'③−D', type:'ANNEX−ドミトリー D',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:18,no:'③−E', type:'ANNEX−ドミトリー E',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  {id:19,no:'③−F', type:'ANNEX−ドミトリー F',      group:'ANNEX−ドミトリー', cap:1, color:'#7C3AED'},
  // アパートメント−Southern Court（103・104の2部屋）
  {id:20,no:'１０３', type:'アパートメント−Southern Court 103', group:'アパートメント−Southern Court', cap:4, color:'#534AB7'},
  {id:21,no:'１０４', type:'アパートメント−Southern Court 104', group:'アパートメント−Southern Court', cap:4, color:'#534AB7'},
  // Sea Breeze 鎌倉・三浦
  {id:22,no:'１０１', type:'Sea Breeze 鎌倉 101', group:'Sea Breeze 鎌倉', cap:4, color:'#0e7490'},
  {id:23,no:'１０２', type:'Sea Breeze 鎌倉 102', group:'Sea Breeze 鎌倉', cap:4, color:'#0e7490'},
  {id:24,no:'25',    type:'Sea Breeze 三浦',     group:'Sea Breeze 三浦', cap:4, color:'#0f766e'},
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
    // トグル：既に同じセルの予約詳細が開いていれば閉じる。別セル/未オープンなら開く
    // （別パネルからの排他制御・他セルからの切替は openEdit 内の closeAllPanels で担保）
    const modalOpen=document.getElementById('modal').classList.contains('open');
    if(modalOpen && _openPanelType==='reservation' && editKey===k){ closeAllPanels(); return; }
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
  if(_isDetailOpen('rental','rental:add:'+(dk||''),'rental-modal')){ closeAllPanels(); return; } // トグル
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
  closeAllPanels();document.getElementById('rental-modal').classList.add('open');_openPanelType='rental';_openPanelKey='rental:add:'+(dk||'');
}

function openRentalEdit(id){
  const r=rentalSpaceReservations.find(x=>x.id===id);if(!r)return;
  if(_isDetailOpen('rental','rental:edit:'+id,'rental-modal')){ closeAllPanels(); return; } // トグル
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
  closeAllPanels();document.getElementById('rental-modal').classList.add('open');_openPanelType='rental';_openPanelKey='rental:edit:'+id;
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
  if(_isDetailOpen('parking','park:add:'+(dk||''),'park-modal')){ closeAllPanels(); return; } // トグル
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
  closeAllPanels();document.getElementById('park-modal').classList.add('open');_openPanelType='parking';_openPanelKey='park:add:'+(dk||'');
}
function openParkEdit(dk,entryId){
  const pk0=parkData[dk]||[];const e0=pk0.find(x=>x.id===entryId);if(!e0)return;
  if(_isDetailOpen('parking','park:edit:'+dk+':'+entryId,'park-modal')){ closeAllPanels(); return; } // トグル
  editParkDate=dk;editParkEntryId=entryId;
  const pk=parkData[dk]||[];const e=pk.find(x=>x.id===entryId);if(!e)return;
  document.getElementById('pm-title').textContent='駐車場利用編集';
  document.getElementById('pm-del-btn').style.display='block';
  document.getElementById('pm-date').value=dk;document.getElementById('pm-name').value=e.name;
  document.getElementById('pm-price').value=e.price||'';document.getElementById('pm-note').value=e.note||'';
  document.getElementById('pm-auto-price').textContent='';
  closeAllPanels();document.getElementById('park-modal').classList.add('open');_openPanelType='parking';_openPanelKey='park:edit:'+dk+':'+entryId;
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
  logAudit(editRoomId!=null?'部屋更新':'部屋追加', `${no} ${type}`, `定員:${cap}名`);
  closeM('room-modal');renderRooms();saveRoomSettingsLS();saveToLS();cloudSave();
  showToast('🚪 部屋情報を保存しました');
}
function deleteRoom(){
  if(editRoomId==null)return;
  const _r=rooms.find(r=>r.id===editRoomId);
  logAudit('部屋削除', _r?`${_r.no} ${_r.type}`:('部屋'+editRoomId), '');
  rooms=rooms.filter(r=>r.id!==editRoomId);delete roomSettings[editRoomId];closeM('room-modal');renderRooms();saveRoomSettingsLS();saveToLS();cloudSave();
}

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
// CHARTER EDIT / DELETE
// ============================================================
// 編集中の貸切を特定するためのキー保持
let editCharterGroup=null, editCharterStartDay=null, editCharterMonth=null;

function openCharterNew(){
  if(_isDetailOpen('charter','charter:new','charter-modal')){ closeAllPanels(); return; } // トグル
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
  closeAllPanels();document.getElementById('charter-modal').classList.add('open');_openPanelType='charter';_openPanelKey='charter:new';
}

function openCharterEdit(charterGroup, startDay, month){
  if(currentRole==='reception'||currentRole==='watanabe')return;
  if(_isDetailOpen('charter','charter:'+charterGroup+':'+startDay+':'+month,'charter-modal')){ closeAllPanels(); return; } // トグル
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
  closeAllPanels();document.getElementById('charter-modal').classList.add('open');_openPanelType='charter';_openPanelKey='charter:'+charterGroup+':'+startDay+':'+month;
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
  logAudit(editCharterGroup?'貸切更新':'貸切作成', `${newGroup} ${m}月${newDay}日〜`,
           `${newNights}泊 ${newName||'(無名)'} 料金:${gBase.price||0}`);
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
  logAudit('貸切削除', `${editCharterGroup} ${editCharterMonth}月${editCharterStartDay}日〜`, '');
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
    <div class="fl"><label>${mn}</label><input type="number" id="bgt-${i+1}" value="${budgets[i+1]||''}" placeholder="0" oninput="updateBudgetTotal()"></div>`).join('');
  updateBudgetTotal();
  document.getElementById('budget-modal').classList.add('open');
}
function updateBudgetTotal(){
  let sum=0;
  for(let m=1;m<=12;m++){ sum+=parseInt(document.getElementById(`bgt-${m}`)?.value)||0; }
  const el=document.getElementById('budget-total');
  if(el)el.textContent='¥'+sum.toLocaleString();
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
posInit(); // レジ（簡易POS）初期化・初期データ投入
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
  '52a6932d5af5316a815af86286167054ebaa4953cedb82e3914a5c126e363ea4':{role:'reception',name:'接客スタッフ', pages:['register','parking','rental','surf','cleaning','pos-order']},
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
let currentUserName=null; // 監査ログの「誰が」に使用（PIN認証で確定）

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
  currentUserName=name||role;
  document.body.classList.remove('role-admin','role-cleaning','role-reception','role-watanabe','viewonly');
  document.body.classList.add('role-'+role);
  if(role!=='admin')document.body.classList.add('viewonly');
  if(role==='reception'){
    document.addEventListener('dragstart',function _receptionNoDrag(e){
      if(e.target.closest&&e.target.closest('.gc'))e.preventDefault();
    },true);
  }
  // ログアウトボタン（サイドバー下部。LINE等と同様に役割名は表示せずアイコンのみ）
  const badge=document.getElementById('role-badge');
  if(badge)badge.style.display='';
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

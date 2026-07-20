// ============================================================
// REGISTER
// ============================================================
// 今日の列を強調する色（チェックイン済みのアンバー・部屋色のブルー等と被らないティール系）
const TODAY_COLOR='#0e7490';
const TODAY_COLOR_WASH='#f4fbfc';
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
    // 今日の列：チェックイン済み(アンバー)・部屋色(ブルー等)と被らないティール系で強調（レビュー要望）
    const todayNumHtml=isToday
      ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#fff;color:${TODAY_COLOR};border-radius:50%;font-size:12px;font-weight:700;line-height:1;">${d}</span>`
      : `${d}`;
    const todayBorder=isToday?`border-left:3px solid ${TODAY_COLOR};border-right:3px solid ${TODAY_COLOR};`:'';
    html+=`<th${todayId} style="width:${DAY_W}px;min-width:${DAY_W}px;border-top:${hol&&!isToday?'2px solid #c0392b':'none'};${todayBorder}position:sticky;top:0;z-index:20;background:${isToday?TODAY_COLOR:'var(--white)'};color:${isToday?'#fff':''};${rentalBg}" onclick="${rsCnt>0?`showRentalDay(${year},${month},${d})`:''}">${todayNumHtml}${rsCnt>0?` <span style="display:inline-block;background:#e65100;color:#fff;font-size:13px;padding:1px 5px;border-radius:99px;font-weight:700;vertical-align:middle;line-height:1.5;">📷</span>`:''}</th>`;
  }
  html+=`</tr>`;
  // 曜日行（sticky top:日付行高さ分）
  html+=`<tr>`;
  for(let d=1;d<=days;d++){
    const dow=gDow(year,month,d),hol=isHoliday(year,month,d);
    const rsCnt2=rentalCountOnDate(year,month,d);
    const rentalBg2=rsCnt2>0?'background:#fff3e0;':'';
    const isToday2=(year===_ty&&month===_tm&&d===_td);
    const todayBorder2=isToday2?`border-left:3px solid ${TODAY_COLOR};border-right:3px solid ${TODAY_COLOR};`:'';
    html+=`<th style="font-size:10px;color:${isToday2?'#fff':dow===0||hol?'#c0392b':dow===6?'#2980b9':'#aaa'};font-weight:${isToday2?'700':'400'};${todayBorder2}position:sticky;top:var(--th-row1-h,32px);z-index:20;background:${isToday2?TODAY_COLOR:rsCnt2>0?'#fff3e0':'var(--white)'};">${DOW[dow]}${hol?'祝':''}</th>`;
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
          const todayColBorder=isTodayCol?`border-left:3px solid ${TODAY_COLOR};border-right:3px solid ${TODAY_COLOR};`:'';


          row+=`<td colspan="${span}" class="${tdCls}" style="padding:0;${todayColBorder}${isTodayCol&&!bg?'background:'+TODAY_COLOR_WASH+';':bg?'background:'+bg:''}" `
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
          const todayColBorderE=isTodayColE?`border-left:3px solid ${TODAY_COLOR};border-right:3px solid ${TODAY_COLOR};`:'';

          row+=`<td style="padding:0;width:${DAY_W}px;min-width:${DAY_W}px;${todayColBorderE}${isTodayColE&&!bg?'background:'+TODAY_COLOR_WASH+';':bg?'background:'+bg:''};max-height:62px;" `
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
        const _pTodayBorder=_pToday?`border-left:3px solid ${TODAY_COLOR};border-right:3px solid ${TODAY_COLOR};`:'';
        row+=`<td style="padding:0;width:${DAY_W}px;min-width:${DAY_W}px;${_pTodayBorder}${_pToday?'background:'+TODAY_COLOR_WASH+';':_pbg?'background:'+_pbg:''};max-height:62px;" `
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

  const _dstRoom=(rooms||[]).find(x=>x.id===rid);
  logAudit('予約移動', _auditGuestLabel(src),
           `移動先: ${_dstRoom?_dstRoom.no:('部屋'+rid)} ${day}日`);
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
  populateNat('f-nat','日本');populateRS(-1);
  closeAllPanels();document.getElementById('modal').classList.add('open');_openPanelType='reservation';_openPanelKey='reservation:add'; // 排他制御：他パネルを閉じて予約詳細を開く
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
  populateNat('f-nat',g.nat||'日本');populateRS(g.roomId);
  closeAllPanels();document.getElementById('modal').classList.add('open');_openPanelType='reservation';_openPanelKey='reservation:'+k; // 排他制御：他パネルを閉じて予約詳細を開く
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

  logAudit(editKey?'予約更新':'予約作成', _auditGuestLabel({...base,roomId:rid,day}),
           `${nights}泊 料金:${base.price||0} 予約ID:${base.reservationId||'-'}`);
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
  logAudit('予約削除', _auditGuestLabel(g), `予約ID:${g.reservationId||g.id||'-'} 料金:${g.price||0}`);
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


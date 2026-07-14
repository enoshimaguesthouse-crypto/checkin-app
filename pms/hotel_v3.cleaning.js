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

// 上部タブ（自動メール配信設定の送信タイミングタブと同一UI）。UI表示単位のみで、保存データには影響しない。
const TD_TABS=[{key:'agreement',label:'宿泊約款'},{key:'guide',label:'施設案内'}];
let _tdDraft=null, _tdCur={rt:'honkan_double', lang:'ja', tab:'agreement'};
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
// 上部タブ（宿泊約款／施設案内）の描画・切替。表示の出し分けのみでデータは触らない。
function tdRenderMTabs(){
  const el=document.getElementById('td-mtabs');
  if(el)el.innerHTML=TD_TABS.map(t=>
    `<button type="button" class="ms-mtab ${t.key===_tdCur.tab?'active':''}" onclick="tdSelectTab('${t.key}')">${t.label}</button>`).join('');
}
function tdRenderPanels(){
  const a=document.getElementById('td-panel-agreement');
  const g=document.getElementById('td-panel-guide');
  if(a)a.style.display=(_tdCur.tab==='agreement')?'':'none';
  if(g)g.style.display=(_tdCur.tab==='guide')?'':'none';
}
function tdSelectTab(key){ _tdCommitInputs(); _tdCur.tab=key; tdRenderMTabs(); tdRenderPanels(); }
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
  document.querySelectorAll('#contract-settings-modal .ms-ltab[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
  tdRenderFields();
}
function openContractSettings(){
  const tds=_ensureTabletDisplay();
  _tdDraft=JSON.parse(JSON.stringify(tds));
  _tdCur={rt:'honkan_double', lang:'ja', tab:'agreement'};
  document.getElementById('ca-enabled').checked=!!_tdDraft.enabled;
  document.getElementById('ca-consent-type').value=_tdDraft.consentType||'checkbox';
  document.querySelectorAll('#contract-settings-modal .ms-ltab[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang==='ja'));
  tdRenderMTabs();
  tdRenderPanels();
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
  logAudit('設定変更', 'タブレット表示設定', `契約確認:${_tdDraft.enabled?'有効':'無効'} 同意方法:${_tdDraft.consentType||'checkbox'}`);
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
  logAudit('設定変更', '自動メール配信設定', MAIL_TYPES.map(m=>`${m.label}:${(_mailDraft[m.key]&&_mailDraft[m.key].enabled)?'ON':'OFF'}`).join(' / '));
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


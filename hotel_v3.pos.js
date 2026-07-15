// ============================================================
// レジ（簡易POS：現金 / PayPay / その他）
// データは全て cloudData 経由（collectAllData/applyServerData→cloudSave→Drive）で保存。
// 価格は全て税込。外税・複数税率のロジックは持たない。
// ============================================================

// ── 状態（applyServerData で上書き、collectAllData で保存）──
let posCategories = [];   // {id,name,color,visible,order}
let posProducts   = [];   // {id,name,catId,price,visible,order}
let posSales      = [];   // {id,ts,items:[{name,qty,price}],total,paid,change,pay,staff}
let posSettings   = {};   // {paypayQr:<dataURL>}
let nextPosCatId  = 1, nextPosProdId = 1, nextPosSaleId = 1;

// ── 画面ローカル状態 ──
let _posCart = [];        // {prodId,name,price,qty}
let _posCurCat = null;    // 絞り込み中カテゴリID（null=すべて）
let _posPay = 'cash';     // 選択中の支払方法
let _posReceived = 0;     // 預り金（現金）
let _posTileEdit = false; // タイル配置変更モード
let _posDragId = null;

// カテゴリ色パレット（AirREGI風）
const POS_COLORS = ['#4db6d6','#f2c94c','#f2994a','#4caf50','#2f6fba','#9e9e9e','#c8a96a','#e2574c','#8e44ad','#16a085','#e91e63','#607d8b'];

function _posYen(n){ return '¥' + (Number(n)||0).toLocaleString(); }
function _posCat(id){ return posCategories.find(c=>c.id===id)||null; }
function _posCatColor(id){ const c=_posCat(id); return c?c.color:'#9e9e9e'; }

// 初回のみ：カテゴリ・商品の初期データを投入
function _posSeedIfEmpty(){
  if(posCategories.length) return;
  const seedCats = [
    {name:'ソフトドリンク',color:'#4db6d6'},{name:'アルコール',color:'#f2c94c'},
    {name:'フード',color:'#f2994a'},{name:'朝食',color:'#4caf50'},
    {name:'宿泊費',color:'#2f6fba'},{name:'アメニティ',color:'#9e9e9e'},
    {name:'駐車場',color:'#c8a96a'},{name:'レンタル',color:'#e2574c'},{name:'チケット',color:'#8e44ad'}
  ];
  posCategories = seedCats.map((c,i)=>({id:i+1,name:c.name,color:c.color,visible:true,order:i}));
  nextPosCatId = posCategories.length+1;
  const drinkId=1, alcId=2;
  const seedProds = [
    ['ホットコーヒー',drinkId,200],['コーラ',drinkId,300],['アイスコーヒー',drinkId,200],
    ['ジンジャーエール',drinkId,300],['アイスティー',drinkId,300],['オレンジジュース',drinkId,200],
    ['アップルジュース',drinkId,200],['ハニージンジャーティー',drinkId,300],['かき氷セットドリンク',drinkId,200],
    ['ビール',alcId,500],['ウイスキー',alcId,500],['日本酒',alcId,700]
  ];
  posProducts = seedProds.map((p,i)=>({id:i+1,name:p[0],catId:p[1],price:p[2],visible:true,order:i}));
  nextPosProdId = posProducts.length+1;
}

function posInit(){
  _posSeedIfEmpty();
  // 年・月セレクト
  const nowY=new Date().getFullYear();
  const ysel=document.getElementById('pos-sales-year');
  if(ysel&&!ysel.options.length){ let o=''; for(let y=nowY+1;y>=nowY-3;y--)o+=`<option value="${y}"${y===nowY?' selected':''}>${y}年</option>`; ysel.innerHTML=o; }
  const msel=document.getElementById('pos-sales-month');
  if(msel&&!msel.options.length){ let o=''; for(let m=1;m<=12;m++)o+=`<option value="${m}"${m===new Date().getMonth()+1?' selected':''}>${m}月</option>`; msel.innerHTML=o; }
}

// ── 担当者セレクト ──
function _posFillStaff(){
  const sel=document.getElementById('pos-staff'); if(!sel)return;
  const names=(typeof staffNames!=='undefined'&&staffNames.length)?staffNames:['オーナー'];
  const cur=sel.value;
  sel.innerHTML=names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  const def=(typeof currentUserName!=='undefined'&&currentUserName)||names[0];
  sel.value=(cur&&names.includes(cur))?cur:(names.includes(def)?def:names[0]);
}

// ══════════════════ ① 注文入力 ══════════════════
function renderPosOrder(){
  _posFillStaff();
  renderPosCatFilter();
  renderPosTiles();
  renderPosCart();
}
function renderPosCatFilter(){
  const el=document.getElementById('pos-cat-filter'); if(!el)return;
  const cats=posCategories.filter(c=>c.visible).sort((a,b)=>a.order-b.order);
  let html=`<button class="pos-catbtn ${_posCurCat===null?'active':''}" style="${_posCurCat===null?'background:var(--ocean);':''}" onclick="posSelectCat(null)">すべて</button>`;
  html+=cats.map(c=>`<button class="pos-catbtn ${_posCurCat===c.id?'active':''}" style="${_posCurCat===c.id?'background:'+c.color+';':''}" onclick="posSelectCat(${c.id})">${esc(c.name)}</button>`).join('');
  el.innerHTML=html;
}
function posSelectCat(id){ _posCurCat=id; renderPosCatFilter(); renderPosTiles(); }
function renderPosTiles(){
  const el=document.getElementById('pos-tiles'); if(!el)return;
  let list=posProducts.filter(p=>p.visible);
  if(_posCurCat!==null)list=list.filter(p=>p.catId===_posCurCat);
  list=list.sort((a,b)=>a.order-b.order);
  if(!list.length){ el.innerHTML=`<div style="grid-column:1/-1;color:#bbb;text-align:center;padding:30px;font-size:13px;">商品がありません（商品設定から追加）</div>`; return; }
  el.innerHTML=list.map(p=>`
    <button class="pos-tile ${_posTileEdit?'editing':''}" style="background:${_posCatColor(p.catId)};"
      ${_posTileEdit?`draggable="true" ondragstart="posTileDragStart(event,${p.id})" ondragover="event.preventDefault()" ondrop="posTileDrop(event,${p.id})" ondragend="posTileDragEnd(event)"`:`onclick="posAddToCart(${p.id})"`}>
      <span>${esc(p.name)}</span><span class="pos-tile-price">${_posYen(p.price)}</span>
    </button>`).join('');
}
function posAddToCart(prodId){
  if(_posTileEdit)return;
  const p=posProducts.find(x=>x.id===prodId); if(!p)return;
  const ex=_posCart.find(c=>c.prodId===prodId);
  if(ex)ex.qty++; else _posCart.push({prodId,name:p.name,price:p.price,qty:1});
  renderPosCart();
}
function _posCartTotal(){ return _posCart.reduce((s,c)=>s+c.price*c.qty,0); }
function _posCartCount(){ return _posCart.reduce((s,c)=>s+c.qty,0); }
function renderPosCart(){
  const el=document.getElementById('pos-cart'); if(!el)return;
  if(!_posCart.length){ el.innerHTML=`<div class="pos-cart-empty">タイルをタップして<br>商品を追加してください</div>`; }
  else {
    el.innerHTML=_posCart.map((c,i)=>`
      <div class="pos-cart-row">
        <span class="pcr-name">${esc(c.name)}</span>
        <span class="pcr-price">${_posYen(c.price*c.qty)}</span>
        <button class="pos-qbtn" onclick="posCartQty(${i},-1)">－</button>
        <span class="pcr-qty">${c.qty}</span>
        <button class="pos-qbtn" onclick="posCartQty(${i},1)">＋</button>
        <span class="pcr-del" onclick="posCartDel(${i})" title="削除">×</span>
      </div>`).join('');
  }
  document.getElementById('pos-cart-count').textContent=_posCartCount()+'点';
  document.getElementById('pos-cart-total').textContent=_posYen(_posCartTotal());
}
function posCartQty(i,d){ const c=_posCart[i]; if(!c)return; c.qty+=d; if(c.qty<=0)_posCart.splice(i,1); renderPosCart(); }
function posCartDel(i){ _posCart.splice(i,1); renderPosCart(); }
function posClearCart(){ if(_posCart.length&&!confirm('会計内容をクリアしますか？'))return; _posCart=[]; renderPosCart(); }

// ── タイル配置変更 ──
function posToggleTileEdit(){
  _posTileEdit=!_posTileEdit;
  const btn=document.getElementById('pos-tileedit-btn');
  if(btn)btn.textContent=_posTileEdit?'✓ 配置を保存':'⚙ タイル配置変更';
  if(!_posTileEdit){ _posReorderNormalize(); logAudit('設定変更','レジ：タイル配置',''); cloudSave(); showToast('🧾 タイル配置を保存しました'); }
  renderPosTiles();
}
function posTileDragStart(e,id){ _posDragId=id; e.target.closest('.pos-tile').classList.add('dragging'); }
function posTileDragEnd(e){ e.target.closest('.pos-tile')?.classList.remove('dragging'); }
function posTileDrop(e,targetId){
  e.preventDefault();
  if(_posDragId==null||_posDragId===targetId)return;
  const arr=posProducts.slice().sort((a,b)=>a.order-b.order);
  const from=arr.findIndex(p=>p.id===_posDragId), to=arr.findIndex(p=>p.id===targetId);
  if(from<0||to<0)return;
  const [m]=arr.splice(from,1); arr.splice(to,0,m);
  arr.forEach((p,i)=>{ const t=posProducts.find(x=>x.id===p.id); if(t)t.order=i; });
  _posDragId=null;
  renderPosTiles();
}
function _posReorderNormalize(){ posProducts.slice().sort((a,b)=>a.order-b.order).forEach((p,i)=>p.order=i); }

// ══════════════════ ③④ 支払い（電卓・PayPay QR）══════════════════
function posOpenPay(){
  if(!_posCart.length){ showToast('⚠ 会計内容がありません'); return; }
  _posPay='cash'; _posReceived=0;
  document.querySelectorAll('#pos-pay-methods .pos-pm').forEach(b=>b.classList.toggle('active',b.dataset.pm==='cash'));
  posSetPay('cash');
  _posRenderQuickAmounts();
  _posRenderKeypad();
  _posUpdatePayView();
  document.getElementById('pos-pay-modal').classList.add('open');
}
function posSetPay(pm){
  _posPay=pm;
  document.querySelectorAll('#pos-pay-methods .pos-pm').forEach(b=>b.classList.toggle('active',b.dataset.pm===pm));
  document.getElementById('pos-pay-cash').style.display   = pm==='cash'  ?'':'none';
  document.getElementById('pos-pay-paypay').style.display = pm==='paypay'?'':'none';
  document.getElementById('pos-pay-other').style.display  = pm==='other' ?'':'none';
  if(pm==='paypay')_posRenderQR();
  _posUpdatePayView();
}
function _posRenderQuickAmounts(){
  const total=_posCartTotal();
  const wrap=document.getElementById('pos-quick-amounts'); if(!wrap)return;
  const rounds=[total];
  [1000,5000,10000].forEach(v=>{ if(v>total)rounds.push(v); });
  // ちょうど・千円単位の候補
  const set=[...new Set([total, Math.ceil(total/1000)*1000, Math.ceil(total/5000)*5000, 10000].filter(v=>v>=total))].slice(0,4);
  wrap.innerHTML=`<button class="pos-quick" onclick="posQuickAmount(${total})">ちょうど</button>`+
    set.filter(v=>v!==total).map(v=>`<button class="pos-quick" onclick="posQuickAmount(${v})">${_posYen(v)}</button>`).join('');
}
function _posRenderKeypad(){
  const el=document.getElementById('pos-keypad'); if(!el)return;
  const keys=['7','8','9','4','5','6','1','2','3','00','0','C'];
  el.innerHTML=keys.map(k=>`<button class="pos-key" onclick="posKey('${k}')">${k}</button>`).join('');
}
function posKey(k){
  if(k==='C'){ _posReceived=0; }
  else if(k==='00'){ _posReceived=_posReceived*100; }
  else { _posReceived=_posReceived*10+parseInt(k); }
  if(_posReceived>99999999)_posReceived=99999999;
  _posUpdatePayView();
}
function posQuickAmount(v){ _posReceived=v; _posUpdatePayView(); }
function _posUpdatePayView(){
  const total=_posCartTotal();
  document.getElementById('pos-pay-total').textContent=_posYen(total);
  document.getElementById('pos-pay-received').textContent=_posYen(_posReceived);
  const change=_posReceived-total;
  document.getElementById('pos-pay-change').textContent=change>=0?_posYen(change):_posYen(0);
  document.getElementById('pos-paypay-total').textContent=_posYen(total);
  document.getElementById('pos-other-total').textContent=_posYen(total);
}
function _posRenderQR(){
  const wrap=document.getElementById('pos-paypay-qr-wrap'); if(!wrap)return;
  if(posSettings&&posSettings.paypayQr){
    wrap.innerHTML=`<img src="${posSettings.paypayQr}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
  } else {
    wrap.innerHTML=`<div style="color:#bbb;font-size:12px;padding:12px;text-align:center;">PayPay QR画像が未登録です<br>（商品設定＞店舗設定）</div>`;
  }
}

// ══════════════════ ⑤ 会計完了 ══════════════════
function posComplete(){
  const total=_posCartTotal();
  if(!_posCart.length){ showToast('⚠ 会計内容がありません'); return; }
  if(_posPay==='cash'&&_posReceived<total){ showToast('⚠ 預り金が不足しています'); return; }
  if(!confirm('会計を完了しますか？'))return;
  const staff=(document.getElementById('pos-staff')||{}).value||'';
  const paid=_posPay==='cash'?_posReceived:total;
  posSales.push({
    id: nextPosSaleId++,
    ts: new Date().toISOString(),
    items: _posCart.map(c=>({name:c.name,qty:c.qty,price:c.price})),
    total, paid, change: Math.max(0,paid-total), pay:_posPay, staff
  });
  logAudit('レジ会計', _posYen(total), `${_posPay==='cash'?'現金':_posPay==='paypay'?'PayPay':'その他'} ${_posCartCount()}点 担当:${staff}`);
  _posCart=[]; _posReceived=0;
  cloudSave();
  closeM('pos-pay-modal');
  renderPosCart();
  showToast('✅ 会計を完了しました');
}

// ══════════════════ ⑥ 商品設定 ══════════════════
function renderPosProducts(){
  posInit();
  _posRenderQRPreview();
  const tb=document.getElementById('pos-product-list'); if(!tb)return;
  const list=posProducts.slice().sort((a,b)=>a.order-b.order);
  if(!list.length){ tb.innerHTML=`<tr><td colspan="5" style="text-align:center;color:#bbb;padding:20px;">商品がありません</td></tr>`; return; }
  tb.innerHTML=list.map(p=>{
    const c=_posCat(p.catId);
    return `<tr style="border-bottom:1px solid var(--sand-border);">
      <td style="padding:10px 14px;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${c?c.color:'#ccc'};margin-right:6px;"></span>${esc(c?c.name:'—')}</td>
      <td style="padding:10px 14px;font-weight:600;">${esc(p.name)}</td>
      <td style="padding:10px 14px;text-align:right;">${_posYen(p.price)}</td>
      <td style="padding:10px 14px;text-align:center;">${p.visible?'✅':'—'}</td>
      <td style="padding:10px 14px;text-align:center;"><button class="btn btn-xs" onclick="openPosProductEdit(${p.id})">編集</button></td>
    </tr>`;
  }).join('');
}
let _posEditProdId=null;
function openPosProductEdit(id){
  _posEditProdId=id;
  const catSel=document.getElementById('pos-prod-cat');
  catSel.innerHTML=posCategories.slice().sort((a,b)=>a.order-b.order).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const p=id!=null?posProducts.find(x=>x.id===id):null;
  document.getElementById('pos-product-title').textContent=p?'商品を編集':'商品を追加';
  document.getElementById('pos-prod-name').value=p?p.name:'';
  document.getElementById('pos-prod-price').value=p?p.price:'';
  document.getElementById('pos-prod-cat').value=p?p.catId:(posCategories[0]&&posCategories[0].id)||'';
  document.getElementById('pos-prod-visible').checked=p?p.visible:true;
  document.getElementById('pos-prod-del').style.display=p?'':'none';
  document.getElementById('pos-product-modal').classList.add('open');
}
function savePosProduct(){
  const name=document.getElementById('pos-prod-name').value.trim();
  const price=parseInt(document.getElementById('pos-prod-price').value)||0;
  const catId=parseInt(document.getElementById('pos-prod-cat').value)||(posCategories[0]&&posCategories[0].id);
  const visible=document.getElementById('pos-prod-visible').checked;
  if(!name){ showToast('⚠ 商品名を入力してください'); return; }
  if(_posEditProdId!=null){
    const p=posProducts.find(x=>x.id===_posEditProdId);
    if(p){ p.name=name; p.price=price; p.catId=catId; p.visible=visible; }
    logAudit('商品更新（レジ）', name, _posYen(price));
  } else {
    const order=posProducts.length?Math.max(...posProducts.map(p=>p.order))+1:0;
    posProducts.push({id:nextPosProdId++,name,catId,price,visible,order});
    logAudit('商品追加（レジ）', name, _posYen(price));
  }
  closeM('pos-product-modal'); renderPosProducts(); cloudSave(); showToast('🧾 商品を保存しました');
}
function deletePosProduct(){
  if(_posEditProdId==null)return;
  const p=posProducts.find(x=>x.id===_posEditProdId);
  if(!confirm(`「${p?p.name:''}」を削除しますか？`))return;
  logAudit('商品削除（レジ）', p?p.name:'', '');
  posProducts=posProducts.filter(x=>x.id!==_posEditProdId);
  closeM('pos-product-modal'); renderPosProducts(); cloudSave(); showToast('🗑 商品を削除しました');
}

// ── カテゴリー設定 ──
function openPosCategoryModal(){ renderPosCategoryList(); document.getElementById('pos-category-modal').classList.add('open'); }
function renderPosCategoryList(){
  const el=document.getElementById('pos-category-list'); if(!el)return;
  const cats=posCategories.slice().sort((a,b)=>a.order-b.order);
  el.innerHTML=cats.map(c=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--sand);">
      <div style="display:flex;gap:3px;flex-wrap:wrap;width:118px;">
        ${POS_COLORS.map(col=>`<span onclick="posSetCatColor(${c.id},'${col}')" title="${col}" style="width:16px;height:16px;border-radius:4px;background:${col};cursor:pointer;box-shadow:${c.color===col?'0 0 0 2px #1a5276':'inset 0 0 0 1px rgba(0,0,0,.1)'};"></span>`).join('')}
      </div>
      <input value="${esc(c.name)}" oninput="posSetCatName(${c.id},this.value)" style="flex:1;min-width:80px;border:1.5px solid var(--sand-border);border-radius:6px;padding:6px 9px;font-size:13px;font-family:inherit;">
      <label style="font-size:11px;color:#888;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" ${c.visible?'checked':''} onchange="posSetCatVisible(${c.id},this.checked)">表示</label>
      <span onclick="deletePosCategory(${c.id})" style="color:var(--coral);cursor:pointer;font-weight:700;padding:0 4px;" title="削除">🗑</span>
    </div>`).join('')||`<div style="color:#bbb;text-align:center;padding:16px;">カテゴリーがありません</div>`;
}
function posSetCatColor(id,col){ const c=_posCat(id); if(c)c.color=col; renderPosCategoryList(); }
function posSetCatName(id,v){ const c=_posCat(id); if(c)c.name=v; }
function posSetCatVisible(id,v){ const c=_posCat(id); if(c)c.visible=v; }
function addPosCategory(){
  const order=posCategories.length?Math.max(...posCategories.map(c=>c.order))+1:0;
  posCategories.push({id:nextPosCatId++,name:'新規カテゴリー',color:POS_COLORS[posCategories.length%POS_COLORS.length],visible:true,order});
  renderPosCategoryList();
}
function deletePosCategory(id){
  const used=posProducts.some(p=>p.catId===id);
  if(used&&!confirm('このカテゴリーの商品が残っています。削除しますか？（商品のカテゴリーは未設定になります）'))return;
  else if(!used&&!confirm('このカテゴリーを削除しますか？'))return;
  posCategories=posCategories.filter(c=>c.id!==id);
  renderPosCategoryList();
}
function savePosCategories(){
  posCategories.forEach(c=>{ if(!c.name.trim())c.name='（無名）'; });
  logAudit('設定変更','レジ：カテゴリー',posCategories.map(c=>c.name).join(', '));
  closeM('pos-category-modal'); renderPosProducts(); cloudSave(); showToast('🎨 カテゴリーを保存しました');
}

// ── 店舗設定：PayPay QR 画像（Base64でJSONへ保存）──
function _posRenderQRPreview(){
  const el=document.getElementById('pos-qr-preview'); if(!el)return;
  if(posSettings&&posSettings.paypayQr){ el.innerHTML=`<img src="${posSettings.paypayQr}" style="max-width:100%;max-height:100%;object-fit:contain;">`; }
  else { el.textContent='未登録'; }
}
function posUploadQR(files){
  const f=files&&files[0]; if(!f)return;
  if(!/^image\/(png|jpeg|svg\+xml)$/.test(f.type)){ showToast('⚠ PNG / JPG / SVG を選択してください'); return; }
  if(f.size>1024*1024){ showToast('⚠ 画像は1MB以下にしてください'); return; }
  const r=new FileReader();
  r.onload=()=>{ posSettings.paypayQr=r.result; _posRenderQRPreview(); logAudit('設定変更','レジ：PayPay QR画像','登録/更新'); cloudSave(); showToast('🏪 PayPay QRを登録しました'); };
  r.readAsDataURL(f);
}
function posRemoveQR(){
  if(!posSettings.paypayQr){ return; }
  if(!confirm('PayPay QR画像を削除しますか？'))return;
  posSettings.paypayQr=''; _posRenderQRPreview(); document.getElementById('pos-qr-input').value=''; cloudSave(); showToast('🗑 QR画像を削除しました');
}

// ══════════════════ ⑦ 日別売上・CSV ══════════════════
function _posSaleDateStr(iso){ const d=new Date(iso); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}`; }
function renderPosSales(){
  posInit();
  const mode=(document.getElementById('pos-sales-mode')||{}).value||'day';
  const y=parseInt((document.getElementById('pos-sales-year')||{}).value)||new Date().getFullYear();
  const m=parseInt((document.getElementById('pos-sales-month')||{}).value)||1;
  // 月セレクトの表示可否
  const msel=document.getElementById('pos-sales-month'); if(msel)msel.style.display=mode==='day'?'':'none';
  // 対象売上を絞り込み
  let sales=posSales.filter(s=>{ const d=new Date(s.ts); if(d.getFullYear()!==y)return false; if(mode==='day'&&d.getMonth()+1!==m)return false; return true; });
  // 集計キー
  const keyOf=s=>{ const d=new Date(s.ts); const p=n=>String(n).padStart(2,'0'); if(mode==='day')return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}`; if(mode==='month')return `${d.getFullYear()}/${p(d.getMonth()+1)}`; return `${d.getFullYear()}`; };
  const groups={};
  sales.forEach(s=>{ const k=keyOf(s); (groups[k]=groups[k]||{count:0,total:0,cash:0,paypay:0,other:0,ids:[]}); const g=groups[k]; g.count++; g.total+=s.total; g[s.pay]=(g[s.pay]||0)+s.total; g.ids.push(s.id); });
  const keys=Object.keys(groups).sort().reverse();
  _posSalesGroupsCache=groups; // 行クリック時に該当取引を引くためのキャッシュ
  // サマリー
  let sum={count:0,total:0,cash:0,paypay:0,other:0};
  sales.forEach(s=>{ sum.count++; sum.total+=s.total; sum[s.pay]=(sum[s.pay]||0)+s.total; });
  document.getElementById('pos-sum-total').textContent=_posYen(sum.total);
  document.getElementById('pos-sum-count').textContent=sum.count;
  document.getElementById('pos-sum-cash').textContent=_posYen(sum.cash);
  document.getElementById('pos-sum-paypay').textContent=_posYen(sum.paypay);
  document.getElementById('pos-sum-other').textContent=_posYen(sum.other);
  // テーブル
  const tb=document.getElementById('pos-sales-list'); if(!tb)return;
  if(!keys.length){ tb.innerHTML=`<tr><td colspan="6" style="text-align:center;color:#bbb;padding:20px;">売上データがありません</td></tr>`; return; }
  tb.innerHTML=keys.map((k,i)=>{ const g=groups[k]; return `<tr style="border-bottom:1px solid var(--sand-border);cursor:pointer;${i%2?'background:var(--sand);':''}" onclick="openPosSaleList('${k}')" title="クリックで取引明細を表示">
    <td style="padding:9px 14px;font-weight:600;color:var(--ocean);text-decoration:underline;">${esc(k)}</td>
    <td style="padding:9px 14px;text-align:right;">${g.count}</td>
    <td style="padding:9px 14px;text-align:right;font-weight:700;">${_posYen(g.total)}</td>
    <td style="padding:9px 14px;text-align:right;">${_posYen(g.cash)}</td>
    <td style="padding:9px 14px;text-align:right;">${_posYen(g.paypay)}</td>
    <td style="padding:9px 14px;text-align:right;">${_posYen(g.other)}</td>
  </tr>`; }).join('');
}
let _posSalesGroupsCache={};

// ── 取引明細一覧（行クリックで開く）──
function openPosSaleList(key){
  const g=_posSalesGroupsCache[key]; if(!g)return;
  document.getElementById('pos-sale-list-title').textContent=`取引明細（${key}）`;
  _posRenderSaleList(g.ids);
  document.getElementById('pos-sale-list-modal').classList.add('open');
}
function _posPayLabel(p){ return p==='cash'?'現金':p==='paypay'?'PayPay':'その他'; }
function _posRenderSaleList(ids){
  const body=document.getElementById('pos-sale-list-body'); if(!body)return;
  const list=ids.map(id=>posSales.find(s=>s.id===id)).filter(Boolean).sort((a,b)=>b.ts.localeCompare(a.ts));
  if(!list.length){ body.innerHTML=`<div style="color:#bbb;text-align:center;padding:20px;">取引がありません</div>`; closeM('pos-sale-list-modal'); renderPosSales(); return; }
  body.innerHTML=list.map(s=>{
    const d=new Date(s.ts); const p=n=>String(n).padStart(2,'0'); const time=`${p(d.getHours())}:${p(d.getMinutes())}`;
    const itemsStr=s.items.map(it=>`${esc(it.name)}×${it.qty}`).join('、');
    return `<div style="padding:10px 4px;border-bottom:1px solid var(--sand);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-weight:700;">${time}</span>
        <span style="font-weight:800;font-size:15px;">${_posYen(s.total)}</span>
      </div>
      <div style="font-size:12px;color:#666;margin:3px 0;">${itemsStr}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:#999;">${_posPayLabel(s.pay)}・担当:${esc(s.staff||'—')}</span>
        <span style="display:flex;gap:6px;">
          <button class="btn btn-xs" onclick="openPosSaleEdit(${s.id})">編集</button>
          <button class="btn btn-xs btn-red" onclick="posDeleteSale(${s.id})">削除</button>
        </span>
      </div>
    </div>`;
  }).join('');
}
function posDeleteSale(id){
  const s=posSales.find(x=>x.id===id); if(!s)return;
  if(!confirm(`この取引（${_posYen(s.total)}）を削除しますか？`))return;
  logAudit('レジ売上削除', _posYen(s.total), `${_posPayLabel(s.pay)} 担当:${s.staff||'—'}`);
  posSales=posSales.filter(x=>x.id!==id);
  cloudSave();
  // 明細一覧を再描画（同一グループの他取引が残っていればそのまま表示、無ければ閉じる）
  renderPosSales();
  const cur=document.getElementById('pos-sale-list-title').textContent.match(/（(.+)）/);
  if(cur&&_posSalesGroupsCache[cur[1]]){ _posRenderSaleList(_posSalesGroupsCache[cur[1]].ids); }
  else { closeM('pos-sale-list-modal'); }
  showToast('🗑 取引を削除しました');
}

// ── 取引編集 ──
let _posSaleEditId=null, _posSaleEditItems=[];
function openPosSaleEdit(id){
  const s=posSales.find(x=>x.id===id); if(!s)return;
  _posSaleEditId=id;
  _posSaleEditItems=s.items.map(it=>({...it})); // 作業用コピー
  document.getElementById('pos-sale-edit-ts').textContent=new Date(s.ts).toLocaleString('ja-JP');
  document.getElementById('pos-sale-edit-pay').value=s.pay;
  const staffSel=document.getElementById('pos-sale-edit-staff');
  const names=(typeof staffNames!=='undefined'&&staffNames.length)?staffNames:['オーナー'];
  staffSel.innerHTML=names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  staffSel.value=names.includes(s.staff)?s.staff:names[0];
  const addSel=document.getElementById('pos-sale-edit-addprod');
  addSel.innerHTML=posProducts.slice().sort((a,b)=>a.order-b.order).map(p=>`<option value="${p.id}">${esc(p.name)}（${_posYen(p.price)}）</option>`).join('');
  _posRenderSaleEditItems();
  document.getElementById('pos-sale-list-modal').classList.remove('open');
  document.getElementById('pos-sale-edit-modal').classList.add('open');
}
function _posRenderSaleEditItems(){
  const el=document.getElementById('pos-sale-edit-items'); if(!el)return;
  if(!_posSaleEditItems.length){ el.innerHTML=`<div style="color:#bbb;text-align:center;padding:12px;font-size:12px;">商品がありません</div>`; }
  else {
    el.innerHTML=_posSaleEditItems.map((it,i)=>`
      <div class="pos-cart-row">
        <span class="pcr-name">${esc(it.name)}</span>
        <span class="pcr-price">${_posYen(it.price*it.qty)}</span>
        <button class="pos-qbtn" onclick="posSaleEditQty(${i},-1)">－</button>
        <span class="pcr-qty">${it.qty}</span>
        <button class="pos-qbtn" onclick="posSaleEditQty(${i},1)">＋</button>
        <span class="pcr-del" onclick="posSaleEditRemoveItem(${i})" title="削除">×</span>
      </div>`).join('');
  }
  const total=_posSaleEditItems.reduce((s,it)=>s+it.price*it.qty,0);
  document.getElementById('pos-sale-edit-total').textContent=_posYen(total);
}
function posSaleEditQty(i,d){ const it=_posSaleEditItems[i]; if(!it)return; it.qty+=d; if(it.qty<=0)_posSaleEditItems.splice(i,1); _posRenderSaleEditItems(); }
function posSaleEditRemoveItem(i){ _posSaleEditItems.splice(i,1); _posRenderSaleEditItems(); }
function posSaleEditAddItem(){
  const pid=parseInt(document.getElementById('pos-sale-edit-addprod').value); if(!pid)return;
  const p=posProducts.find(x=>x.id===pid); if(!p)return;
  const ex=_posSaleEditItems.find(it=>it.name===p.name&&it.price===p.price);
  if(ex)ex.qty++; else _posSaleEditItems.push({name:p.name,price:p.price,qty:1});
  _posRenderSaleEditItems();
}
function savePosSaleEdit(){
  if(_posSaleEditId==null)return;
  if(!_posSaleEditItems.length){ showToast('⚠ 商品が0件です。削除する場合は「削除」ボタンをご利用ください'); return; }
  const s=posSales.find(x=>x.id===_posSaleEditId); if(!s)return;
  const total=_posSaleEditItems.reduce((sum,it)=>sum+it.price*it.qty,0);
  const pay=document.getElementById('pos-sale-edit-pay').value;
  const staff=document.getElementById('pos-sale-edit-staff').value;
  s.items=_posSaleEditItems.map(it=>({...it}));
  s.total=total; s.pay=pay; s.staff=staff;
  s.paid=Math.max(s.paid||0,total); s.change=Math.max(0,(s.paid||total)-total);
  logAudit('レジ売上編集', _posYen(total), `${_posPayLabel(pay)} 担当:${staff}`);
  cloudSave();
  closeM('pos-sale-edit-modal');
  renderPosSales();
  showToast('✅ 取引を更新しました');
}
function exportPosSalesCSV(){
  const y=parseInt((document.getElementById('pos-sales-year')||{}).value)||new Date().getFullYear();
  const m=parseInt((document.getElementById('pos-sales-month')||{}).value)||(new Date().getMonth()+1);
  // 1ヶ月分の会計明細（1商品=1行）
  const rows=posSales.filter(s=>{ const d=new Date(s.ts); return d.getFullYear()===y&&d.getMonth()+1===m; })
    .sort((a,b)=>a.ts.localeCompare(b.ts));
  const payLabel=p=>p==='cash'?'現金':p==='paypay'?'PayPay':'その他';
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  let csv='﻿日付,時刻,商品,数量,単価,金額,支払方法,担当者\n'; // BOM付きUTF-8
  rows.forEach(s=>{ const d=new Date(s.ts); const p=n=>String(n).padStart(2,'0');
    const date=`${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}`, time=`${p(d.getHours())}:${p(d.getMinutes())}`;
    s.items.forEach(it=>{ csv+=[q(date),q(time),q(it.name),it.qty,it.price,it.price*it.qty,q(payLabel(s.pay)),q(s.staff)].join(',')+'\n'; });
  });
  const b=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`レジ売上_${y}年${m}月.csv`; a.click();
}

// サイドバー：レジメニュー開閉
function togglePosMenu(btn){
  const sub=document.getElementById('pos-submenu');
  const chev=btn.querySelector('.pos-chevron');
  const open=sub.style.display==='none';
  sub.style.display=open?'block':'none';
  if(chev)chev.style.transform=open?'rotate(0deg)':'rotate(-90deg)';
}

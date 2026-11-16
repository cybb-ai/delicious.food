/**
 * 煎好日 線上訂單 → Google Sheets
 * 部署方式見 gas/README.md
 */

/* ===== 設定 ===== */
var CONFIG = {
  // 新訂單通知信箱（留空則不寄信），例如 'store@example.com'
  NOTIFY_EMAIL: '',
  // 允許的取餐方式
  FULFILLMENT: ['外帶', '內用', '宅配'],
  // 宅配運費（0 = 免運）
  SHIPPING_FEE: 0,
  // 每張訂單最多件數（防惡意大量下單）
  MAX_QTY_PER_ITEM: 50,
  TIMEZONE: 'Asia/Taipei'
};

/* 價格以伺服器端為準，前端送來的價格只做參考，避免被竄改。
 * 修改菜單或價格時，請同步更新這裡與 index.html 的 products。 */
var MENU = {
  p01: { name: '經典鮮肉鍋貼', price: 85 },
  p02: { name: '香辣川椒鍋貼', price: 95 },
  p03: { name: '玉米起司鍋貼', price: 100 },
  p04: { name: '高麗菜鮮肉水餃', price: 80 },
  p05: { name: '韭菜鮮肉水餃', price: 85 },
  p06: { name: '酸辣湯', price: 45 },
  p07: { name: '古早味紅茶', price: 30 },
  p08: { name: '涼拌小黃瓜', price: 40 },
  p09: { name: '香滷豆干', price: 40 },
  gift01: { name: '招牌招財鍋貼禮盒', price: 499 }
};

var SHEET_ORDERS = '訂單';
var SHEET_ITEMS = '訂單明細';
var SHEET_DAILY = '每日統計';
var STATUSES = ['新訂單', '製作中', '可取餐', '已完成', '已取消'];
var ORDER_HEADERS = ['訂單編號', '建立時間', '狀態', '取餐方式', '姓名', '電話', '地址', '備註', '品項摘要', '件數', '小計', '運費', '總金額', '來源', '狀態更新時間'];
var ITEM_HEADERS = ['訂單編號', '建立時間', '品項代碼', '品名', '單價', '數量', '小計'];

/* ===== Web App 入口 ===== */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(createOrder_(body));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'menu') return json_({ ok: true, menu: MENU });
  return json_({ ok: true, service: '煎好日訂單 API', time: new Date().toISOString() });
}

/* ===== 建立訂單 ===== */
function createOrder_(body) {
  // 機器人陷阱欄位：真人看不到，有填就拒絕
  if (body.website) throw new Error('無效的請求');

  var name = clean_(body.name, 40);
  var phone = clean_(body.phone, 20);
  var fulfillment = clean_(body.fulfillment, 10);
  var address = clean_(body.address, 120);
  var note = clean_(body.note, 200);
  var requestId = clean_(body.requestId, 64);

  if (!name) throw new Error('請填寫姓名');
  if (!/^[0-9+() -]{8,20}$/.test(phone)) throw new Error('電話格式不正確');
  if (CONFIG.FULFILLMENT.indexOf(fulfillment) < 0) throw new Error('取餐方式不正確');
  if (fulfillment === '宅配' && !address) throw new Error('宅配請填寫地址');
  if (fulfillment !== '宅配') address = '';

  // 重新以伺服器價格計算
  var items = [];
  var raw = body.items || [];
  for (var i = 0; i < raw.length; i++) {
    var id = String(raw[i].id || '');
    var qty = Math.floor(Number(raw[i].qty));
    if (!MENU[id]) throw new Error('找不到品項：' + id);
    if (!(qty >= 1 && qty <= CONFIG.MAX_QTY_PER_ITEM)) throw new Error('數量不正確：' + MENU[id].name);
    items.push({ id: id, name: MENU[id].name, price: MENU[id].price, qty: qty, subtotal: MENU[id].price * qty });
  }
  if (!items.length) throw new Error('購物車是空的');

  var subtotal = items.reduce(function (s, it) { return s + it.subtotal; }, 0);
  var shipping = fulfillment === '宅配' ? CONFIG.SHIPPING_FEE : 0;
  var total = subtotal + shipping;
  var qtySum = items.reduce(function (s, it) { return s + it.qty; }, 0);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // 防止同一筆訂單重複送出（網路重試、連點）
    var cache = CacheService.getScriptCache();
    if (requestId) {
      var dup = cache.get('req_' + requestId);
      if (dup) return JSON.parse(dup);
    }

    var ss = SpreadsheetApp.getActive();
    var orders = ensureSheet_(ss, SHEET_ORDERS, ORDER_HEADERS);
    var detail = ensureSheet_(ss, SHEET_ITEMS, ITEM_HEADERS);
    var now = new Date();
    var orderId = nextOrderId_(now);
    var summary = items.map(function (it) { return it.name + ' x' + it.qty; }).join('、');

    orders.appendRow([orderId, now, STATUSES[0], fulfillment, safe_(name), "'" + phone, safe_(address), safe_(note), summary, qtySum, subtotal, shipping, total, 'website', now]);
    detail.getRange(detail.getLastRow() + 1, 1, items.length, ITEM_HEADERS.length).setValues(
      items.map(function (it) { return [orderId, now, it.id, it.name, it.price, it.qty, it.subtotal]; })
    );

    var result = { ok: true, orderId: orderId, total: total, items: items.length };
    if (requestId) cache.put('req_' + requestId, JSON.stringify(result), 600);

    notify_(orderId, now, fulfillment, name, phone, address, note, items, total);
    return result;
  } finally {
    lock.releaseLock();
  }
}

/* JGD-20261116-0001，每天重新計數 */
function nextOrderId_(now) {
  var day = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd');
  var props = PropertiesService.getScriptProperties();
  var key = 'seq_' + day;
  var n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return 'JGD-' + day + '-' + ('000' + n).slice(-4);
}

function notify_(orderId, now, fulfillment, name, phone, address, note, items, total) {
  if (!CONFIG.NOTIFY_EMAIL) return;
  try {
    var lines = items.map(function (it) { return '・' + it.name + ' x' + it.qty + '  NT$' + it.subtotal; });
    MailApp.sendEmail({
      to: CONFIG.NOTIFY_EMAIL,
      subject: '【煎好日】新訂單 ' + orderId + '（' + fulfillment + '）NT$' + total,
      body: [
        '訂單編號：' + orderId,
        '時間：' + Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm'),
        '取餐方式：' + fulfillment,
        '姓名：' + name,
        '電話：' + phone,
        address ? '地址：' + address : '',
        note ? '備註：' + note : '',
        '',
        lines.join('\n'),
        '',
        '總金額：NT$' + total,
        '',
        '試算表：' + SpreadsheetApp.getActive().getUrl()
      ].filter(function (s) { return s !== null; }).join('\n')
    });
  } catch (err) {
    console.error('通知信寄送失敗', err);
  }
}

/* ===== 試算表工具 ===== */

/** 第一次使用請在 Apps Script 編輯器執行這個函式 */
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);
  var orders = ensureSheet_(ss, SHEET_ORDERS, ORDER_HEADERS);
  ensureSheet_(ss, SHEET_ITEMS, ITEM_HEADERS);

  // 狀態下拉選單
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  orders.getRange(2, 3, orders.getMaxRows() - 1, 1).setDataValidation(rule);
  // 狀態顏色
  var rng = orders.getRange('A2:O');
  var colors = { '新訂單': '#fde2c8', '製作中': '#fff2b3', '可取餐': '#d4edc9', '已完成': '#e6e6e6', '已取消': '#f4c7c3' };
  orders.setConditionalFormatRules(Object.keys(colors).map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="' + s + '"').setBackground(colors[s]).setRanges([rng]).build();
  }));
  orders.getRange('B:B').setNumberFormat('yyyy/mm/dd hh:mm');
  orders.getRange('O:O').setNumberFormat('yyyy/mm/dd hh:mm');
  orders.getRange('K:M').setNumberFormat('"NT$"#,##0');
  ss.getSheetByName(SHEET_ITEMS).getRange('B:B').setNumberFormat('yyyy/mm/dd hh:mm');

  // 每日統計（排除已取消）
  var daily = ss.getSheetByName(SHEET_DAILY) || ss.insertSheet(SHEET_DAILY);
  daily.clear();
  daily.getRange('A1').setFormula(
    "=IFERROR(QUERY({ARRAYFORMULA(IF(訂單!A2:A=\"\",,INT(訂單!B2:B))),訂單!C2:C,訂單!J2:J,訂單!M2:M}," +
    "\"select Col1, count(Col1), sum(Col3), sum(Col4) where Col1 is not null and Col2 <> '已取消' group by Col1 order by Col1 desc " +
    "label Col1 '日期', count(Col1) '訂單數', sum(Col3) '件數', sum(Col4) '營業額'\",0),\"尚無訂單\")"
  );
  daily.getRange('A:A').setNumberFormat('yyyy/mm/dd');
  daily.getRange('D:D').setNumberFormat('"NT$"#,##0');
  daily.setFrozenRows(1);

  // 用右下角提示取代會卡住執行的對話框
  ss.toast('訂單、訂單明細、每日統計已設定完成', '煎好日', 8);
  console.log('設定完成');
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#38271f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* 修改「狀態」欄時自動記錄更新時間 */
function onEdit(e) {
  var sh = e.range.getSheet();
  if (sh.getName() !== SHEET_ORDERS || e.range.getColumn() !== 3 || e.range.getRow() < 2) return;
  sh.getRange(e.range.getRow(), 15).setValue(new Date());
}

/* 試算表上方的自訂選單 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('煎好日')
    .addItem('初始化 / 重建工作表格式', 'setup')
    .addItem('將選取訂單標為「製作中」', 'markMaking')
    .addItem('將選取訂單標為「可取餐」', 'markReady')
    .addItem('將選取訂單標為「已完成」', 'markDone')
    .addToUi();
}
function markMaking() { markSelected_('製作中'); }
function markReady() { markSelected_('可取餐'); }
function markDone() { markSelected_('已完成'); }
function markSelected_(status) {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEET_ORDERS) { SpreadsheetApp.getActive().toast('請在「訂單」工作表選取訂單列', '煎好日', 5); return; }
  var r = sh.getActiveRange(), now = new Date();
  for (var i = r.getRow(); i < r.getRow() + r.getNumRows(); i++) {
    if (i < 2) continue;
    sh.getRange(i, 3).setValue(status);
    sh.getRange(i, 15).setValue(now);
  }
}

/* ===== 共用 ===== */
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}
/* 避免使用者輸入被試算表當成公式執行（例如以 = 開頭） */
function safe_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

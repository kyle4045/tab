// Tab's AI proxy: receipt reading and the bill assistant, run on Gemini in
// Vertex AI and billed to the Google Cloud project in Secrets.gs.
//
// The web app runs as its owner and accepts anonymous requests, so every
// request must carry the caller's Firebase sign-in (an ID token). It is
// checked by reading the caller's own members/{uid} record in Firestore with
// that token: Firestore verifies the token, and the security rules only let
// an account read its own record, which exists only for invited friends.
//
// Request (POST, Content-Type text/plain to avoid a CORS preflight):
//   {token, input: string | [{role: 'user'|'assistant', content}], images: [{mimeType, data(base64)}]}
// Response: {ok: true, data: <the model's JSON answer>} or {ok: false, code}

var MODEL = 'gemini-3.8-flash';
var LOCATION = 'global'; // the Flash models answer only on the global endpoint for this project
var FIREBASE_PROJECT = 'tab-bill-splitter';
var PER_USER_PER_HOUR = 20;
var ALL_USERS_PER_DAY = 300;
var MAX_IMAGES = 4;
var MAX_IMAGE_CHARS = 4 * 1024 * 1024; // base64 characters per image, about 3 MB

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var uid = checkUser_(req.token);
    limit_(uid);
    return reply_({ ok: true, data: callGemini_(req.input, req.images || []) });
  } catch (err) {
    if (!err || !err.code) console.error(err && err.stack || err);
    return reply_({ ok: false, code: (err && err.code) || 'error' });
  }
}

// A quick check that the web app is up.
function doGet() {
  return reply_({ ok: true, service: 'tab-ai' });
}

// Run once from the editor so Google asks the owner to allow the scopes.
function authorize() {
  ScriptApp.getOAuthToken();
  UrlFetchApp.fetch('https://aiplatform.googleapis.com/', { muteHttpExceptions: true });
}

function fail_(code) {
  var err = new Error(code);
  err.code = code;
  return err;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Returns the caller's uid, or throws session_expired / not_granted.
function checkUser_(token) {
  if (typeof token !== 'string' || token.split('.').length !== 3) throw fail_('session_expired');
  var claims;
  try {
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());
  } catch (e) {
    throw fail_('session_expired');
  }
  var uid = claims.sub || claims.user_id;
  if (!uid || claims.aud !== FIREBASE_PROJECT || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw fail_('session_expired');
  if (claims.exp && claims.exp * 1000 < Date.now()) throw fail_('session_expired');

  var url = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT +
    '/databases/(default)/documents/members/' + encodeURIComponent(uid) + '?mask.fieldPaths=joinedAt';
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  var status = res.getResponseCode();
  if (status === 200) return uid;
  if (status === 401) throw fail_('session_expired');
  if (status === 403 || status === 404) throw fail_('not_granted');
  throw fail_('unavailable');
}

// 20 calls an hour per account, and a ceiling for everyone together per day,
// so the Cloud credits can't be drained.
function limit_(uid) {
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var hour = Math.floor(Date.now() / 3600000);
    var userKey = 'u:' + uid + ':' + hour;
    var used = Number(cache.get(userKey) || 0);
    if (used >= PER_USER_PER_HOUR) throw fail_('rate_limited');

    var props = PropertiesService.getScriptProperties();
    var dayKey = 'day:' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    var today = Number(props.getProperty(dayKey) || 0);
    if (today >= ALL_USERS_PER_DAY) throw fail_('rate_limited');

    cache.put(userKey, String(used + 1), 3600);
    props.setProperty(dayKey, String(today + 1));
    // Forget earlier days.
    props.getKeys().forEach(function (k) { if (/^day:/.test(k) && k !== dayKey) props.deleteProperty(k); });
  } finally {
    lock.releaseLock();
  }
}

// Turns the app's prompt (a string or chat turns) into Gemini's contents,
// with any images attached to the last user turn, and returns the parsed
// JSON answer.
function callGemini_(input, images) {
  var turns = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
  if (!Array.isArray(turns) || !turns.length) throw fail_('invalid_request');
  var contents = [];
  turns.forEach(function (t) {
    var role = t && t.role === 'assistant' ? 'model' : 'user';
    var text = String(t && t.content != null ? t.content : '').slice(0, 20000);
    var last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: text });
    else contents.push({ role: role, parts: [{ text: text }] });
  });
  if (contents.length > 40) throw fail_('invalid_request');

  if (!Array.isArray(images) || images.length > MAX_IMAGES) throw fail_('image_rejected');
  var lastUser = contents.filter(function (c) { return c.role === 'user'; }).pop();
  images.forEach(function (img) {
    var type = img && img.mimeType;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(type) || typeof img.data !== 'string' || img.data.length > MAX_IMAGE_CHARS) {
      throw fail_('image_rejected');
    }
    lastUser.parts.push({ inlineData: { mimeType: type, data: img.data } });
  });

  var host = LOCATION === 'global' ? 'aiplatform.googleapis.com' : LOCATION + '-aiplatform.googleapis.com';
  var url = 'https://' + host + '/v1/projects/' + SECRETS.PROJECT_ID + '/locations/' + LOCATION +
    '/publishers/google/models/' + MODEL + ':generateContent';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': SECRETS.PROJECT_ID },
    payload: JSON.stringify({
      contents: contents,
      // The length cap stops a rare JSON-mode runaway that otherwise runs for minutes.
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 }
    }),
    muteHttpExceptions: true
  });
  var status = res.getResponseCode();
  if (status === 429) throw fail_('rate_limited');
  if (status === 400) throw fail_('image_rejected');
  if (status !== 200) {
    console.error('Vertex AI ' + status + ': ' + res.getContentText().slice(0, 500));
    throw fail_('unavailable');
  }
  var body = JSON.parse(res.getContentText());
  var cand = body.candidates && body.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT' || cand.finishReason === 'BLOCKLIST') {
    throw fail_('refused');
  }
  var text = ((cand.content && cand.content.parts) || []).map(function (p) { return p.text || ''; }).join('');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw fail_('invalid_json');
  }
}

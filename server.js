/*
  Bulgarian Quiz Night — local Wi-Fi game server.
  Node.js only, no installs, no internet. Run:  node server.js
  Everyone on the same Wi-Fi opens the address it prints and plays.
*/
'use strict';
var http = require('http');
var fs   = require('fs');
var os   = require('os');
var path = require('path');

var PORT_FIRST = 8080, PORT_LAST = 8090;
var FILE = path.join(__dirname, 'quiz.html');

/* ---------- the page, and the questions inside it ---------- */
var HTML, ROUNDS;
try {
  HTML = fs.readFileSync(FILE, 'utf8');
} catch (e) {
  console.error('\n  Could not find quiz.html next to server.js.\n  Keep both files in the same folder.\n');
  process.exit(1);
}
try {
  var m = HTML.match(/var ROUNDS = (\[[\s\S]*?\n\]);/);
  ROUNDS = new Function('return ' + m[1])();
} catch (e) {
  console.error('\n  Could not read the questions out of quiz.html.\n');
  process.exit(1);
}
var RMAP = {};
ROUNDS.forEach(function (r) { RMAP[r.id] = r; });
function question(id) {
  var p = String(id).split(':'), r = RMAP[p[0]];
  return r ? r.qs[+p[1]] : null;
}

/* ---------- the page as a real document, with the role injected ---------- */
var SPLIT = HTML.indexOf('<div id="app"></div>');
var HEAD = SPLIT > 0 ? HTML.slice(0, SPLIT) : '';
var BODY = SPLIT > 0 ? HTML.slice(SPLIT) : HTML;
var PLAYER_URL = '';
function page(role, key) {
  var boot = '<script>window.LAN=' + JSON.stringify({ role: role, key: key || '', addr: PLAYER_URL }) + ';</script>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' + HEAD +
         '</head><body>' + boot + BODY + '</body></html>';
}

/* ---------- game state ---------- */
var HOST_KEY = Math.random().toString(36).slice(2, 8).toUpperCase();
var G = { status: 'setup', qIndex: -1, qStartAt: 0, limit: 30, deck: [], rev: 0 };
var PLAYERS = {};          // id -> {id,name,score,streak,answers}
var CLIENTS = [];          // open event streams
var TIMER = null;

function order() {
  return Object.keys(PLAYERS).map(function (k) { return PLAYERS[k]; })
    .sort(function (a, b) { return (b.score - a.score) || a.name.localeCompare(b.name); });
}
function snapshot() {
  return JSON.stringify({
    now: Date.now(), rev: G.rev, status: G.status, qIndex: G.qIndex,
    qStartAt: G.qStartAt, limit: G.limit, deck: G.deck,
    players: order().map(function (p) {
      return { id: p.id, name: p.name, score: p.score, streak: p.streak, answers: p.answers };
    })
  });
}
function broadcast() {
  G.rev++;
  var data = 'data: ' + snapshot() + '\n\n';
  CLIENTS.slice().forEach(function (res) {
    try { res.write(data); } catch (e) { drop(res); }
  });
}
function drop(res) {
  var i = CLIENTS.indexOf(res);
  if (i >= 0) CLIENTS.splice(i, 1);
}
function askQuestion(i) {
  G.qIndex = i; G.status = 'question'; G.qStartAt = Date.now();
  clearTimeout(TIMER);
  TIMER = setTimeout(reveal, G.limit * 1000 + 400);
  broadcast();
}
function reveal() {
  if (G.status !== 'question') return;
  clearTimeout(TIMER); TIMER = null;
  G.status = 'reveal';
  broadcast();
}
function everyoneIn() {
  var ids = Object.keys(PLAYERS);
  if (!ids.length) return false;
  return ids.every(function (k) { return PLAYERS[k].answers[String(G.qIndex)] !== undefined; });
}

/* ---------- host commands ---------- */
function command(body) {
  if (body.key !== HOST_KEY) return { ok: false, error: 'not the host' };
  var c = body.cmd;
  if (c === 'open') {
    G.deck = Array.isArray(body.deck) ? body.deck : [];
    G.limit = Math.max(5, Math.min(120, +body.limit || 30));
    G.status = 'lobby'; G.qIndex = -1;
    Object.keys(PLAYERS).forEach(function (k) {
      PLAYERS[k].score = 0; PLAYERS[k].streak = 0; PLAYERS[k].answers = {};
    });
    clearTimeout(TIMER); TIMER = null;
  } else if (c === 'start') {
    if (!G.deck.length) return { ok: false, error: 'no questions chosen' };
    askQuestion(0); return { ok: true };
  } else if (c === 'reveal') {
    reveal(); return { ok: true };
  } else if (c === 'next') {
    if (G.qIndex >= G.deck.length - 1) { G.status = 'final'; clearTimeout(TIMER); TIMER = null; }
    else { askQuestion(G.qIndex + 1); return { ok: true }; }
  } else if (c === 'reset') {
    clearTimeout(TIMER); TIMER = null;
    G.status = 'setup'; G.qIndex = -1;
    Object.keys(PLAYERS).forEach(function (k) {
      PLAYERS[k].score = 0; PLAYERS[k].streak = 0; PLAYERS[k].answers = {};
    });
  } else {
    return { ok: false, error: 'unknown command' };
  }
  broadcast();
  return { ok: true };
}

/* ---------- players ---------- */
function join(body) {
  var name = String(body.name || '').trim().slice(0, 18);
  if (!name) return { ok: false, error: 'a name is needed' };
  var p = body.id && PLAYERS[body.id];
  if (p) { p.name = name; }
  else {
    var id = 'p' + Math.random().toString(36).slice(2, 10);
    p = PLAYERS[id] = { id: id, name: name, score: 0, streak: 0, answers: {} };
  }
  broadcast();
  return { ok: true, id: p.id, score: p.score, streak: p.streak, answers: p.answers };
}
function correct(q, pick) {
  if (Array.isArray(q.c)) {
    if (!Array.isArray(pick)) return false;
    var a = pick.slice().sort(), b = q.c.slice().sort();
    return a.length === b.length && a.every(function (v, i) { return v === b[i]; });
  }
  return pick === q.c;
}
function answer(body) {
  var p = PLAYERS[body.id];
  if (!p) return { ok: false, error: 'not in this game' };
  if (G.status !== 'question' || body.q !== G.qIndex) return { ok: false, error: 'too late' };
  var key = String(G.qIndex);
  if (p.answers[key] !== undefined) return { ok: false, error: 'already answered' };
  var q = question(G.deck[G.qIndex]);
  if (!q) return { ok: false, error: 'no question' };

  var right = correct(q, body.pick);
  var left = Math.max(0, G.qStartAt + G.limit * 1000 - Date.now());
  var frac = Math.max(0, Math.min(1, left / (G.limit * 1000)));
  var points = right ? Math.round(500 + 500 * frac) + Math.min(500, 100 * p.streak) : 0;

  p.answers[key] = { k: body.pick, ok: right ? 1 : 0, p: points };
  p.score += points;
  p.streak = right ? p.streak + 1 : 0;

  if (everyoneIn()) setTimeout(reveal, 400);
  broadcast();
  return { ok: true, right: right, points: points, score: p.score, streak: p.streak };
}

/* ---------- http ---------- */
function readBody(req, done) {
  var chunks = '';
  req.on('data', function (d) { chunks += d; if (chunks.length > 1e5) req.destroy(); });
  req.on('end', function () { try { done(JSON.parse(chunks || '{}')); } catch (e) { done({}); } });
}
function json(res, obj) {
  var s = JSON.stringify(obj);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(s);
}

var server = http.createServer(function (req, res) {
  var url = req.url.split('?')[0];
  var query = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?') + 1) : '';

  if (req.method === 'POST') {
    return readBody(req, function (body) {
      if (url === '/join')   return json(res, join(body));
      if (url === '/answer') return json(res, answer(body));
      if (url === '/cmd')    return json(res, command(body));
      json(res, { ok: false, error: 'unknown request' });
    });
  }

  if (url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    res.write('retry: 2000\n\n');
    res.write('data: ' + snapshot() + '\n\n');
    CLIENTS.push(res);
    req.on('close', function () { drop(res); });
    return;
  }

  if (url === '/host') {
    var key = /(?:^|&)k=([^&]*)/.exec(query);
    if (!key || key[1] !== HOST_KEY) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(page('host', HOST_KEY));
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(page('player', ''));
});

/* keep event streams alive through sleepy phones and routers */
setInterval(function () {
  CLIENTS.slice().forEach(function (res) {
    try { res.write(': ping\n\n'); } catch (e) { drop(res); }
  });
}, 20000);

function addresses() {
  var out = [], nets = os.networkInterfaces();
  Object.keys(nets).forEach(function (name) {
    (nets[name] || []).forEach(function (n) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    });
  });
  out.sort(function (a, b) { return (b.indexOf('192.168.') === 0) - (a.indexOf('192.168.') === 0); });
  return out;
}
function listen(port) {
  server.once('error', function (e) {
    if (e.code === 'EADDRINUSE' && port < PORT_LAST) return listen(port + 1);
    console.error('\n  Could not start: ' + e.message + '\n');
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', function () {
    var ips = addresses(), ip = ips[0] || 'localhost';
    PLAYER_URL = 'http://' + ip + ':' + port;
    var line = '  ' + PLAYER_URL;
    console.log('\n  BULGARIAN QUIZ NIGHT — the room is running.\n');
    console.log('  PLAYERS type this into any browser on the same Wi-Fi:\n');
    console.log('  ' + '='.repeat(line.length + 2));
    console.log(line);
    console.log('  ' + '='.repeat(line.length + 2) + '\n');
    if (ips.length > 1) console.log('  (other addresses on this machine: ' + ips.slice(1).join(', ') + ')\n');
    console.log('  YOU, the host, open this one — keep it to yourself:\n');
    console.log('  http://localhost:' + port + '/host?k=' + HOST_KEY + '\n');
    console.log('  ' + ROUNDS.reduce(function (n, r) { return n + r.qs.length; }, 0) + ' questions loaded.');
    console.log('  Leave this window open for the whole night. Ctrl+C ends the game.\n');
  });
}
listen(PORT_FIRST);

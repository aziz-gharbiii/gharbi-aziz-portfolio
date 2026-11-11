/** @OnlyCurrentDoc */
/**
 * GHARBI AGENCY — réception des formulaires du site (rendez-vous studio + contact)
 * Google Apps Script lié au Sheet "GHARBI AGENCY — Demandes site".
 * Déployé en Web App : exécuter en tant que "Moi", accès "Tout le monde".
 * Chaque demande → une ligne dans l'onglet "Demandes" + un email au propriétaire.
 */
const SHEET_NAME = 'Demandes';
const HEADERS = ['Reçue le', 'Type', 'Statut', 'Nom / Brand', 'WhatsApp', 'Jour', 'Moment', 'Objet / Projet', 'Business', 'Message', 'Source'];
const STATUSES = ['Nouveau', 'Confirmé', 'Fait', 'Annulé'];

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true }); // honeypot: bots fill hidden fields

    const type = d.type === 'contact' ? 'Contact' : 'Rendez-vous studio';
    const r = {
      name: clean_(d.name, 120),
      whatsapp: clean_(d.whatsapp, 40),
      day: clean_(d.day, 60),
      slot: clean_(d.slot, 40),
      topic: clean_(d.topic, 120),
      business: clean_(d.business, 60),
      message: clean_(d.message, 1500),
      source: clean_(d.source, 200),
    };
    if (!r.name || !r.whatsapp) return json_({ ok: false, error: 'missing' });

    // anti-spam: max 3 demandes / 10 min pour un même numéro
    const cache = CacheService.getScriptCache();
    const key = 'rl_' + r.whatsapp.replace(/\D/g, '');
    const n = Number(cache.get(key) || 0);
    if (n >= 3) return json_({ ok: false, error: 'rate' });
    cache.put(key, String(n + 1), 600);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet_().appendRow([new Date(), type, 'Nouveau', r.name, r.whatsapp, r.day, r.slot, r.topic, r.business, r.message, r.source]);
    } finally {
      lock.releaseLock();
    }

    notify_(type, r);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'GHARBI AGENCY — formulaires' });
}

/** À lancer une fois depuis l'éditeur : prépare l'onglet et demande les autorisations. */
function setup() {
  sheet_();
  MailApp.getRemainingDailyQuota();
}

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.getSheets()[0];
    sh.setName(SHEET_NAME);
  }
  if (sh.getLastRow() === 0 || sh.getRange(1, 1).getValue() !== HEADERS[0]) {
    sh.clear();
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#d4ff3a').setFontColor('#0b0d02');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    sh.getRange('C2:C').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build()
    );
    sh.setColumnWidths(1, HEADERS.length, 150);
    sh.setColumnWidth(10, 320);
  }
  return sh;
}

function notify_(type, r) {
  const to = Session.getEffectiveUser().getEmail();
  let digits = r.whatsapp.replace(/\D/g, '');
  if (digits.length === 8) digits = '216' + digits; // numéro tunisien sans indicatif
  const wa = 'https://wa.me/' + digits;
  const subject = (type === 'Contact' ? '🟢 Nouveau contact' : '📅 Nouveau rendez-vous') +
    ' — ' + r.name + (r.day ? ' · ' + r.day + (r.slot ? ' (' + r.slot + ')' : '') : '');
  const rows = [
    ['Type', type], ['Nom / Brand', r.name], ['WhatsApp', r.whatsapp], ['Jour', r.day],
    ['Moment', r.slot], ['Objet / Projet', r.topic], ['Business', r.business], ['Message', r.message],
  ].filter((x) => x[1]);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:520px">' +
    '<h2 style="margin:0 0 14px;font-size:20px">' + esc(subject) + '</h2>' +
    '<table cellpadding="7" style="border-collapse:collapse;width:100%">' +
    rows.map((l) => '<tr style="border-bottom:1px solid #eee"><td style="color:#777;width:130px">' + esc(l[0]) + '</td><td><b>' + esc(l[1]) + '</b></td></tr>').join('') +
    '</table><p style="margin-top:18px">' +
    '<a href="' + wa + '" style="background:#25d366;color:#fff;padding:11px 18px;border-radius:22px;text-decoration:none;font-weight:bold">Répondre sur WhatsApp</a>' +
    '&nbsp;&nbsp;<a href="' + SpreadsheetApp.getActive().getUrl() + '" style="color:#555">Ouvrir le Sheet</a></p></div>';
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'GHARBI AGENCY — Site' });
}

function clean_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max || 200).trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s; // empêche l'injection de formules dans le Sheet
  return s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

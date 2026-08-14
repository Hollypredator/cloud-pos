import http from "node:http";
import net from "node:net";

/**
 * Yerel fis yazicisi ve kasa cekmecesi servisi.
 *
 * Kasa makinesinde calisir. Tarayici localhost'a POST eder, bu servis ESC/POS
 * baytlarini yaziciya gonderir. Internet gerekmez — cevrimdisiyken de fis basar
 * ve cekmece acilir.
 *
 *   POST /print    { businessName, orderNo, customerName, items[], total, openDrawer? }
 *   POST /drawer   { printerIp? }
 *   GET  /health
 *
 * ÖNEMLI: ÖKC (mali kasa) bagli olmadigi surece basilan sey adisyon/bilgi
 * fisidir, mali fis degildir. Basliklar buna gore yazildi.
 */

const PORT = Number(process.env.PRINT_DAEMON_PORT ?? 9100);
/** Ag yazicilarinin standart ham yazdirma portu (RAW / JetDirect). */
const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? 9100);
const PRINTER_TIMEOUT_MS = 5000;
const LINE_WIDTH = 42;

// --- ESC/POS komutlari ------------------------------------------------------

const ESC = "\x1b";
const GS = "\x1d";

const INIT = `${ESC}\x40`;
const ALIGN_LEFT = `${ESC}\x61\x00`;
const ALIGN_CENTER = `${ESC}\x61\x01`;
const ALIGN_RIGHT = `${ESC}\x61\x02`;
const SIZE_NORMAL = `${ESC}\x21\x00`;
const SIZE_DOUBLE = `${ESC}\x21\x30`;
const SIZE_TALL = `${ESC}\x21\x10`;
const CUT = `${GS}\x56\x41\x03`;

/**
 * Cekmece acma komutu: ESC p m t1 t2
 *   m  = 0  -> 2 numarali pin (yaygin standart)
 *   t1 = 25 -> 50ms darbe
 *   t2 = 250 -> 500ms bekleme
 * Cekmece yaziciya RJ11 kablosuyla baglidir; ayri bir cihaz degildir.
 */
const DRAWER_KICK = `${ESC}\x70\x00\x19\xfa`;

// --- Fis metni --------------------------------------------------------------

function line(char = "-") {
  return char.repeat(LINE_WIDTH) + "\n";
}

/** Solda ad, sagda tutar; arasi bosluk. Tasarsa ad kirpilir. */
function row(left, right) {
  const rightText = String(right);
  const maxLeft = LINE_WIDTH - rightText.length - 1;
  const leftText = String(left).length > maxLeft ? String(left).slice(0, maxLeft) : String(left);
  const gap = LINE_WIDTH - leftText.length - rightText.length;
  return `${leftText}${" ".repeat(Math.max(1, gap))}${rightText}\n`;
}

function money(value) {
  return `${Number(value ?? 0).toFixed(2)} TL`;
}

function buildReceipt(data) {
  let out = INIT;

  out += ALIGN_CENTER;
  out += SIZE_DOUBLE + (data.businessName || "ADISYON FISI") + SIZE_NORMAL + "\n";
  if (data.branchName) out += data.branchName + "\n";
  // ÖKC yoksa bu bir mali fis degil; musteriye de acikca yazilir.
  out += "ADISYON FISI - MALI FIS DEGILDIR\n";
  out += line("=");

  out += ALIGN_LEFT;
  out += `Tarih : ${new Date().toLocaleString("tr-TR")}\n`;
  if (data.orderNo) out += `Sira  : ${data.orderNo}\n`;
  if (data.customerName) out += `Musteri: ${data.customerName}\n`;
  if (data.cashierName) out += `Kasiyer: ${data.cashierName}\n`;
  out += line();

  for (const item of Array.isArray(data.items) ? data.items : []) {
    const qty = Number(item.qty ?? 1);
    out += row(`${qty} x ${item.name ?? ""}`, money(item.lineTotal ?? item.price));
    for (const mod of Array.isArray(item.modifiers) ? item.modifiers : []) {
      out += `   + ${mod}\n`;
    }
  }

  out += line();
  if (data.subtotal != null && data.subtotal !== data.total) {
    out += row("Ara Toplam", money(data.subtotal));
  }
  if (data.discount) out += row("Indirim", `-${money(data.discount)}`);

  out += ALIGN_RIGHT;
  out += SIZE_TALL + `TOPLAM: ${money(data.total)}` + SIZE_NORMAL + "\n";
  out += ALIGN_LEFT;
  if (data.paymentLabel) out += row("Odeme", data.paymentLabel);

  out += ALIGN_CENTER;
  out += "\nAfiyet olsun!\n";
  if (data.footerNote) out += data.footerNote + "\n";
  out += "\n\n\n";

  if (data.openDrawer) out += DRAWER_KICK;
  out += CUT;

  // ESC/POS yazicilar tek baytlik kod sayfasi bekler; latin1 Turkce karakterleri
  // bozar ama yazicinin kabul ettigi bayt genisligini korur. Fis metni bu yuzden
  // aksansiz yazildi.
  return Buffer.from(out, "latin1");
}

// --- Yaziciya gonderim ------------------------------------------------------

/**
 * Baytlari yaziciya gonderir.
 *
 * Ag yazicisi: soket acilana ve akis bosalana kadar beklenir; hata veya zaman
 * asiminda reject eder — cagiran taraf basmadigini bilmeli. USB/stdout: senkron.
 */
function sendToPrinter(bytes, printerIp) {
  if (!printerIp) {
    process.stdout.write(bytes);
    return Promise.resolve({ target: "stdout" });
  }

  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      client.destroy();
      reject(err);
    };

    client.setTimeout(PRINTER_TIMEOUT_MS, () => {
      fail(new Error(`Yaziciya baglanti zaman asimina ugradi (${printerIp}:${PRINTER_PORT})`));
    });

    client.on("error", (err) => {
      fail(new Error(`Yaziciya ulasilamadi (${printerIp}:${PRINTER_PORT}): ${err.message}`));
    });

    client.connect(PRINTER_PORT, printerIp, () => {
      client.write(bytes, (writeErr) => {
        if (writeErr) {
          fail(writeErr);
          return;
        }
        client.end(() => {
          if (settled) return;
          settled = true;
          resolve({ target: `${printerIp}:${PRINTER_PORT}` });
        });
      });
    });
  });
}

// --- HTTP sunucusu ----------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Istek govdesi cok buyuk."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        reject(new Error(`Gecersiz JSON: ${err.message}`));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "online", daemon: "CloudPOS-LocalPrint-Daemon", version: 2 });
    return;
  }

  if (req.method === "POST" && req.url === "/print") {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message });
      return;
    }

    try {
      const target = await sendToPrinter(buildReceipt(payload), payload.printerIp);
      sendJson(res, 200, { success: true, target: target.target, drawerOpened: Boolean(payload.openDrawer) });
    } catch (err) {
      // Hata cagirana yansir. Yazici kapaliyken "basildi" demek, kasiyerin
      // fisin ciktigini sanmasina yol acar.
      console.error("[PRINT DAEMON]", err.message);
      sendJson(res, 502, { success: false, error: err.message });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/drawer") {
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch {
      // Govde zorunlu degil; yazici IP'si yoksa stdout'a duser.
    }

    try {
      const target = await sendToPrinter(Buffer.from(INIT + DRAWER_KICK, "latin1"), payload.printerIp);
      sendJson(res, 200, { success: true, target: target.target });
    } catch (err) {
      console.error("[DRAWER]", err.message);
      sendJson(res, 502, { success: false, error: err.message });
    }
    return;
  }

  sendJson(res, 404, { success: false, error: "Bilinmeyen uc nokta." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[Cloud POS Yerel Yazici Servisi] http://127.0.0.1:${PORT}`);
  console.log(`  POST /print   fis bas (openDrawer: true ile cekmeceyi de acar)`);
  console.log(`  POST /drawer  yalnizca cekmeceyi ac`);
  console.log(`  GET  /health  durum`);
});

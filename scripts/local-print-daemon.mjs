import http from "node:http";
import net from "node:net";

const PORT = 9100;

/**
 * Local Print Daemon for Cloud POS / Takeaway POS
 * Receives JSON print payloads via HTTP POST http://localhost:9100/print
 * Forwards ESC/POS byte streams to local printers (USB / Serial / Local IP thermal printer)
 */

function formatReceiptText(data) {
  const title = data.businessName || "POS ADİSYON / FİŞİ";
  const border = "----------------------------------------\n";
  let content = `\x1b\x40`; // ESC @ (Initialize printer)
  content += `\x1b\x61\x01`; // Center align
  content += `\x1b\x21\x30${title}\x1b\x21\x00\n`; // Bold large title
  if (data.headerNote) content += `${data.headerNote}\n`;
  content += border;
  content += `\x1b\x61\x00`; // Left align
  content += `Tarih: ${new Date().toLocaleString("tr-TR")}\n`;
  if (data.orderId) content += `Siparis No: #${data.orderId}\n`;
  if (data.customerName) content += `Musteri: ${data.customerName}\n`;
  if (data.tableName) content += `Masa: ${data.tableName}\n`;
  content += border;

  if (Array.isArray(data.items)) {
    data.items.forEach((item) => {
      const name = String(item.name || item.title || "").padEnd(24, " ").substring(0, 24);
      const qty = String(item.qty || item.quantity || 1).padStart(3, " ");
      const price = item.price ? `${Number(item.price).toFixed(2)} TL`.padStart(10, " ") : "";
      content += `${name} x${qty} ${price}\n`;
      if (item.modifiers && Array.isArray(item.modifiers)) {
        item.modifiers.forEach((m) => {
          content += `  + ${m}\n`;
        });
      }
    });
  }

  content += border;
  if (data.total) {
    content += `\x1b\x61\x02`; // Right align
    content += `\x1b\x21\x20TOPLAM: ${Number(data.total).toFixed(2)} TL\x1b\x21\x00\n`;
  }
  content += `\x1b\x61\x01`; // Center align
  content += `\nAfiyet Olsun!\n\n\n\n`;
  content += `\x1d\x56\x41\x03`; // ESC/POS Paper Cut command

  return Buffer.from(content, "latin1");
}

const server = http.createServer((req, res) => {
  // CORS Headers for PWA / Web access
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "online", daemon: "CloudPOS-LocalPrint-Daemon-v1.0" }));
    return;
  }

  if (req.method === "POST" && req.url === "/print") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const formatted = formatReceiptText(payload);

        // Print output simulator / network printer stream logic
        if (payload.printerIp) {
          const client = new net.Socket();
          client.connect(9100, payload.printerIp, () => {
            client.write(formatted);
            client.end();
          });
          client.on("error", (err) => {
            console.error("[PRINT DAEMON ERROR]", err.message);
          });
        } else {
          // Output to console / stdout fallback for local USB spooler
          process.stdout.write(formatted);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[Cloud POS Local Print Daemon] Active on http://localhost:${PORT}`);
});

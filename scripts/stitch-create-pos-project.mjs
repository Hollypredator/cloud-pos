import http from "node:https";

// Anahtar ortam degiskeninden okunur. Daha once kodda gomuluydu; bu dosya
// depoya girdigi anda anahtar da girecekti.
//   Kullanim: STITCH_API_KEY=... node scripts/stitch-create-pos-project.mjs
const apiKey = process.env.STITCH_API_KEY;

if (!apiKey) {
  console.error("STITCH_API_KEY tanimli degil. Ornek: STITCH_API_KEY=... node scripts/stitch-create-pos-project.mjs");
  process.exit(1);
}

function callMcp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "stitch.googleapis.com",
        path: "/mcp",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      })
    );
    req.end();
  });
}

async function run() {
  const projectId = "10730088554740999679";
  console.log("Generating Red, Black, White POS UI Screen in Stitch Project ID:", projectId);

  const genScreen = await callMcp("tools/call", {
    name: "generate_screen_from_text",
    arguments: {
      projectId: projectId,
      deviceType: "DESKTOP",
      prompt: "Ultra-modern Red (#dc2626), Obsidian Black (#0a0a0c), and Pure White (#ffffff) Takeaway Coffee POS App Launcher Grid with 6 large touch app cards: Fast Cashier, Pickup Board, Recipe Stock, Z-Report Excel, Printer Test, OKC POS Z-Report.",
    },
  });

  console.log("GENERATE SCREEN RESULT:", JSON.stringify(genScreen, null, 2));
}

run();

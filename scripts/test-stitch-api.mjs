import http from "node:https";

// Anahtar ortam degiskeninden okunur. Daha once kodda gomuluydu; bu dosya
// depoya girdigi anda anahtar da girecekti.
//   Kullanim: STITCH_API_KEY=... node scripts/test-stitch-api.mjs
const apiKey = process.env.STITCH_API_KEY;

if (!apiKey) {
  console.error("STITCH_API_KEY tanimli degil. Ornek: STITCH_API_KEY=... node scripts/test-stitch-api.mjs");
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
  const tools = await callMcp("tools/list");
  const genTool = tools?.result?.tools?.find((t) => t.name === "generate_screen_from_text");
  console.log("GENERATE INPUT SCHEMA:", JSON.stringify(genTool?.inputSchema, null, 2));
}

run();

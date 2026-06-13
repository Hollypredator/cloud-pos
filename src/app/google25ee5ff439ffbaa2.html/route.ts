export function GET() {
  return new Response("google-site-verification: google25ee5ff439ffbaa2.html", {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cloud POS",
    short_name: "CloudPOS",
    description: "Web tabanli POS, QR menu ve restoran operasyon sistemi",
    start_url: "/ops",
    scope: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0f172a",
    categories: ["business", "productivity", "food"],
    shortcuts: [
      {
        name: "Operasyon Merkezi",
        short_name: "Ops",
        url: "/ops",
      },
      {
        name: "Masa Takip",
        short_name: "Masalar",
        url: "/tables",
      },
      {
        name: "Kasa",
        short_name: "Kasa",
        url: "/cashier",
      },
    ],
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

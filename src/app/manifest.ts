import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cloud POS",
    short_name: "CloudPOS",
    description: "Web tabanlı POS, QR menü ve restoran operasyon sistemi",
    lang: "tr",
    dir: "ltr",
    start_url: "/m/ops",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f1f5f9",
    theme_color: "#0f172a",
    categories: ["business", "productivity", "food"],
    shortcuts: [
      {
        name: "Operasyon Merkezi",
        short_name: "Operasyon",
        url: "/m/ops",
      },
      {
        name: "Masa Takip",
        short_name: "Masalar",
        url: "/m/tables",
      },
      {
        name: "Adisyon",
        short_name: "Kasa",
        url: "/m/cashier",
      },
      {
        name: "Mutfak",
        short_name: "Mutfak",
        url: "/m/kitchen",
      },
      {
        name: "Teslimat",
        short_name: "Teslimat",
        url: "/m/delivery",
      },
    ],
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
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

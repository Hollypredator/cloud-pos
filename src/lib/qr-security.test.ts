import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * QR imzasi guvenlik siniri: masa tahrifatini engelleyen tek mekanizma.
 * Modul anahtari `process.env`'den okur, bu yuzden her test kendi ortamini
 * kurup modulu yeniden import eder.
 */

const ORIGINAL_ENV = { ...process.env };

async function loadModule(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return import("./qr-security");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("qr-security", () => {
  it("uretilen imzayi dogrular", async () => {
    const { generateQrSignature, verifyQrSignature } = await loadModule({ QR_SECRET: "test-secret" });
    const signature = generateQrSignature("masa-5", "1700000000000");
    expect(verifyQrSignature("masa-5", "1700000000000", signature)).toBe(true);
  });

  it("baska masanin kimligini reddeder", async () => {
    const { generateQrSignature, verifyQrSignature } = await loadModule({ QR_SECRET: "test-secret" });
    const signature = generateQrSignature("masa-5", "1700000000000");
    // Saldiri senaryosu: musteri adres cubugunda masa-5'i masa-12 yapar.
    expect(verifyQrSignature("masa-12", "1700000000000", signature)).toBe(false);
  });

  it("degistirilmis zaman damgasini reddeder", async () => {
    const { generateQrSignature, verifyQrSignature } = await loadModule({ QR_SECRET: "test-secret" });
    const signature = generateQrSignature("masa-5", "1700000000000");
    expect(verifyQrSignature("masa-5", "1700000000001", signature)).toBe(false);
  });

  it("baska anahtarla uretilmis imzayi reddeder", async () => {
    const first = await loadModule({ QR_SECRET: "secret-a" });
    const signature = first.generateQrSignature("masa-5", "1700000000000");
    const second = await loadModule({ QR_SECRET: "secret-b" });
    // Anahtar degistirmek tum basili QR'lari topluca gecersiz kilar.
    expect(second.verifyQrSignature("masa-5", "1700000000000", signature)).toBe(false);
  });

  it("bos imza ve bos zaman damgasini reddeder", async () => {
    const { verifyQrSignature } = await loadModule({ QR_SECRET: "test-secret" });
    expect(verifyQrSignature("masa-5", "1700000000000", "")).toBe(false);
    expect(verifyQrSignature("masa-5", "", "abcdef")).toBe(false);
  });

  it("hex olmayan bozuk imzada patlamaz, reddeder", async () => {
    const { verifyQrSignature } = await loadModule({ QR_SECRET: "test-secret" });
    expect(verifyQrSignature("masa-5", "1700000000000", "not-hex-!!")).toBe(false);
  });

  it("farkli uzunluktaki imzayi reddeder", async () => {
    const { verifyQrSignature } = await loadModule({ QR_SECRET: "test-secret" });
    expect(verifyQrSignature("masa-5", "1700000000000", "abcd")).toBe(false);
  });

  it("uretimde anahtar yoksa imza URETMEZ", async () => {
    // Bos anahtarla HMAC teknik olarak hesaplanir ama sonucu herkes
    // uretebilir; sessizce sahte guvenlik saglamak yerine ariza vermeli.
    const { generateQrSignature } = await loadModule({ QR_SECRET: "", JWT_SECRET: "", NODE_ENV: "production" });
    expect(() => generateQrSignature("masa-5", "1700000000000")).toThrow(/QR_SECRET/);
  });

  it("uretimde anahtar yoksa hicbir imzayi dogrulamaz (fail-closed)", async () => {
    const { verifyQrSignature } = await loadModule({ QR_SECRET: "", JWT_SECRET: "", NODE_ENV: "production" });
    expect(verifyQrSignature("masa-5", "1700000000000", "a".repeat(64))).toBe(false);
  });

  it("gelistirmede anahtar yoksa sabit yedek anahtara duser", async () => {
    const { generateQrSignature, verifyQrSignature, isQrSigningConfigured } = await loadModule({
      QR_SECRET: "",
      JWT_SECRET: "",
      NODE_ENV: "development",
    });
    expect(isQrSigningConfigured()).toBe(true);
    const signature = generateQrSignature("masa-5", "1700000000000");
    expect(verifyQrSignature("masa-5", "1700000000000", signature)).toBe(true);
  });

  it("JWT_SECRET yedek anahtar olarak kullanilir", async () => {
    const { generateQrSignature, verifyQrSignature } = await loadModule({ QR_SECRET: "", JWT_SECRET: "jwt-fallback" });
    const signature = generateQrSignature("masa-5", "1700000000000");
    expect(verifyQrSignature("masa-5", "1700000000000", signature)).toBe(true);
  });
});

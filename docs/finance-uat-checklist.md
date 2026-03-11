# Finans UAT Checklist

Durum: `template`

## Test Ortami
- Tarih:
- Tester:
- Ortam URL:
- Business:
- Branch:

## Senaryolar
1. Gunluk net tutarlilik:
- [ ] `/admin/finance?days=1` ekranindaki `Net` degeri, ayni gun `sales - refunds` ile esit.

2. Odeme yontemi kirilimi:
- [ ] Nakit/Kart/Karma net toplami = `summary.netSales`.
- [ ] Yontem bazli iade toplamlari payments kayitlari ile esit.

3. Saatlik satis:
- [ ] Saatlik grafik toplami = brut satis toplami.
- [ ] Iadeler saatlik satisa eklenmiyor (ayri gider etkisi).

4. Kasa gun sonu mutabakat:
- [ ] `/cashier/session` kapanisinda `expectedCash` hesaplamasi acilis + nakit satis - nakit iade ile uyumlu.
- [ ] Esik ustu farkta `cash_reconciliation_mismatch` dispatch kaydi olusuyor.

5. Iade ve iptal etkisi:
- [ ] Iade sonrasi finans ekrani net satisi dogru dusuruyor.
- [ ] Tahsilat alinmis siparis iptal blokaji aktif.

## Komut Dogrulama
- [ ] `npm run phase3:runtime`
- [ ] `npm run phase4:reconciliation`

## Sonuc
- [ ] UAT passed
- [ ] UAT blocked (issue linkleri eklendi)

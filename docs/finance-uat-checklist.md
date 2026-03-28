# Finans UAT Checklist

Durum: `template`

## Test Ortami
- Tarih:
- Tester:
- Ortam URL:
- Business:
- Branch:

## Senaryolar
1. Gunluk net tutarlılık:
- [ ] `/admin/finance?days=1` ekranindaki `Net` degeri, ayni gun `sales - refunds` ile eşit.

2. Ödeme yöntemi kırılımı:
- [ ] Nakit/Kart/Karma net toplamı = `summary.netSales`.
- [ ] Yöntem bazlı iade toplamları payments kayıtları ile eşit.

3. Saatlik satış:
- [ ] Saatlik grafik toplamı = brüt satış toplamı.
- [ ] Iadeler saatlik satisa eklenmiyor (ayri gider etkisi).

4. Kasa gun sonu mutabakat:
- [ ] `/cashier/session` kapanışında `expectedCash` hesaplaması açılış + nakit satış - nakit iade ile uyumlu.
- [ ] Eşik üstü farkta `cash_reconciliation_mismatch` dispatch kaydı oluşuyor.

5. İade ve iptal etkisi:
- [ ] İade sonrası finans ekrani net satışı doğru düşürüyor.
- [ ] Tahsilat alinmis sipariş iptal blokaji aktif.

## Komut Doğrulama
- [ ] `npm run phase3:runtime`
- [ ] `npm run phase4:reconciliation`

## Sonuç
- [ ] UAT passed
- [ ] UAT blocked (issue linkleri eklendi)

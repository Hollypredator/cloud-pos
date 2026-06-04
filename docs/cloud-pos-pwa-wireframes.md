# Cloud POS PWA Wireframes

## Direction
Mobile order entry should not compress the desktop layout. It should guide the operator through one task at a time:

1. Confirm table
2. Choose category/product
3. Review basket
4. Complete/send order

The basket becomes a bottom sheet on mobile. Categories become a horizontal segmented rail or a compact drawer. The product grid becomes the primary workspace.

## Mobile Order Entry - Recommended

```text
┌────────────────────────────────────┐
│ CLOUD POS                    CANLI │
│ Masa 8                              │
│ Sevdalı Kafe                        │
├────────────────────────────────────┤
│ ← Masalar        Fiş Yazdır   Kasa  │
├────────────────────────────────────┤
│ [ Ürün ara...                 ⌕ ]  │
│                                    │
│ Kahveler  Soğuk  Çay  Tatlı  ...   │
├────────────────────────────────────┤
│ Espresso                           │
│ 110.00 TL                    +     │
│                                    │
│ Doppio                             │
│ 125.00 TL                    +     │
│                                    │
│ Americano                          │
│ 130.00 TL                    +     │
│                                    │
│ Latte                              │
│ 150.00 TL                    +     │
│                                    │
│ Cappuccino                         │
│ 155.00 TL                    +     │
├────────────────────────────────────┤
│ 3 ürün       505.00 TL   Sepeti Aç │
└────────────────────────────────────┘
│ Home       Sipariş      Mutfak     │
└────────────────────────────────────┘
```

### Why
- Product list gets the whole screen width.
- Basket is visible but does not steal space.
- Category selection is one-handed and fast.
- The primary action is always the next operational step.

## Mobile Basket Bottom Sheet

```text
┌────────────────────────────────────┐
│ Sepet                         Kapat│
│ Masa 8                              │
├────────────────────────────────────┤
│ 1x Mocha                170.00 TL  │
│                    -       +       │
│ 1x Cappuccino           155.00 TL  │
│                    -       +       │
│ 1x Caramel Macchiato    180.00 TL  │
│                    -       +       │
├────────────────────────────────────┤
│ Ara Toplam              505.00 TL  │
│ Not / servis notu                 │
│ [ Mutfaga Gonder ]                 │
│ [ Kasa / Tahsilat ]                │
└────────────────────────────────────┘
```

### Why
- Basket appears only when needed.
- Operators can still make quick quantity changes.
- Order send and cashier actions are separated.

## Mobile Category Drawer - Alternate

```text
┌────────────────────────────────────┐
│ Kategoriler                    X   │
├────────────────────────────────────┤
│ ● Kahveler                     17  │
│   Soğuk Kahveler               11  │
│   Çay ve Bitki Çayları          9  │
│   Refresher ve Frozen          13  │
│   Soft İçecekler               15  │
│   Fırından                     12  │
└────────────────────────────────────┘
```

### Why
- Use this only if the horizontal rail becomes too crowded.
- The main screen stays focused on products.

## Tablet Order Entry

```text
┌──────────────────────────────────────────────────────────────┐
│ Masa 8                                  Fiş Yazdır  Kasa     │
├──────────────┬──────────────────────────────┬────────────────┤
│ Kategoriler  │ Ürün Ara                     │ Sipariş Detayı │
│              │                              │                │
│ Kahveler     │ Espresso             +       │ 3 ürün         │
│ Soğuk        │ Doppio               +       │ 505.00 TL      │
│ Çay          │ Americano            +       │                │
│ Tatlı        │ Latte                +       │ Mocha      x1  │
│ Burgerler    │ Cappuccino           +       │ Cappuccino x1  │
│              │ Flat White           +       │ Caramel    x1  │
│              │                              │                │
│              │                              │ Mutfaga Gonder │
└──────────────┴──────────────────────────────┴────────────────┘
```

### Why
- Tablet can keep three zones because there is enough width.
- Categories stay persistent.
- Basket stays persistent.

## Mobile Operation Center

```text
┌────────────────────────────────────┐
│ CLOUD POS                    CANLI │
│ Operasyon Merkezi                  │
├────────────────────────────────────┤
│ Bugün                              │
│ Açık 1   Bekleyen 1   Kritik 1     │
├────────────────────────────────────┤
│ Şimdi ilgilen                      │
│                                    │
│ Kritik mutfak gecikmesi        1 > │
│ Mutfağa geç                        │
│                                    │
│ Tahsilat bekleyen adisyon      0 > │
│ Kasa ekranı                        │
│                                    │
│ Masa talepleri                 0 > │
│ Talepleri yönet                    │
├────────────────────────────────────┤
│ Hızlı işlemler                     │
│ [ Yeni Sipariş ] [ Mutfak ]        │
└────────────────────────────────────┘
```

## Store Screenshot Set

1. Operation center: "Canlı operasyonu tek ekranda izle"
2. Table selection: "Masadan siparişe saniyeler içinde geç"
3. Order entry: "Hızlı ürün seçimi ve sepet kontrolü"
4. Kitchen board: "Geciken siparişleri anında yakala"
5. Cashier/adisyon: "Tahsilat, split ve fiş akışı tek yerde"
6. Reports: "Günlük nakit akışını net gör"

## Visual Rules
- Phone: one primary action per screen.
- Tablet: three-pane layout is acceptable.
- Desktop: keep full operational cockpit.
- Bottom bar: max 4 destinations.
- Avoid partial side panels on phone.
- Keep realtime/sync state visible but small.
- Use orange for primary operational action, red for destructive/critical, green for success/payment.

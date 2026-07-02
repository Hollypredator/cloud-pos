export type SeoLandingLocale = "tr" | "en";
export type SeoLandingMarket = "turkey" | "global";
export type SeoLandingCluster = "pos" | "qr-menü" | "self-service" | "inventory" | "adisyon" | "mobile-waiter";
export type SeoLandingSchemaType = "SoftwareApplication";

export type SeoLandingPage = {
  slug: string;
  locale: SeoLandingLocale;
  market: SeoLandingMarket;
  cluster: SeoLandingCluster;
  canonicalSlug: string;
  hreflangAlternates: Record<string, string>;
  schemaType: SeoLandingSchemaType;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroLead: string;
  primaryKeyword: string;
  relatedKeywords: string[];
  locality?: {
    city: string;
    region: string;
    scenario: string;
  };
  sections: Array<{
    title: string;
    body: string;
    bullets: string[];
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
};

const trCoreAlternates = {
  "tr-TR": "restoran-pos-sistemi",
  "en": "en/restaurant-pos-system",
  "x-default": "en/restaurant-pos-system",
};

export const seoLandingPages: SeoLandingPage[] = [
  {
    slug: "restoran-pos-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "pos",
    canonicalSlug: "restoran-pos-sistemi",
    hreflangAlternates: trCoreAlternates,
    schemaType: "SoftwareApplication",
    title: "Restoran POS Sistemi",
    metaTitle: "Restoran POS Sistemi | Kasa, Adisyon, Mutfak ve Stok",
    description:
      "Cloud POS restoran POS sistemi; masa, adisyon, mutfak ekranı, kasa, stok, QR menü ve raporlamayı tek bulut panelinde toplar.",
    eyebrow: "Restoran operasyonu",
    heroTitle: "Restoran POS sistemiyle masa, mutfak ve kasayı aynı akışta yönetin.",
    heroLead:
      "Garson siparişi, mutfak hazırlığı, adisyon takibi, ödeme ve stok kontrolü aynı sistemde ilerler; ekip hangi siparişin nerede olduğunu net görür.",
    primaryKeyword: "restoran POS sistemi",
    relatedKeywords: ["pos sistemleri", "restoran adisyon programı", "mutfak ekranı", "stok takipli pos"],
    sections: [
      {
        title: "Masa ve adisyon akışı",
        body: "Servis ekibi masa seçer, ürünleri ekler, adisyonu açık tutar ve ödeme anında kasaya temiz bir akış bırakır.",
        bullets: ["Masa bazlı açık adisyon", "Garson ve kasa rolleri", "Parçalı ödeme ve tahsilat takibi"],
      },
      {
        title: "Mutfak ve operasyon görünürlüğü",
        body: "Siparişler durumlarına göre takip edilir; bekleyen, hazırlanan ve servise hazır işler ayrı görünür.",
        bullets: ["Mutfak kuyruğu", "Gecikme ve kritik sipariş takibi", "Canlı operasyon paneli"],
      },
      {
        title: "Stok ve raporlama",
        body: "Satış, stok ve günlük operasyon raporları aynı panelde toplanır; vardiya sonunda kontrol kolaylaşır.",
        bullets: ["Düşük stok uyarıları", "Günlük satış özeti", "Şube ve rol bazlı yönetim"],
      },
    ],
    faq: [
      {
        question: "Restoran POS sistemi sadece kasa için mi kullanılır?",
        answer: "Hayır. Cloud POS masa, adisyon, mutfak, kasa, stok, QR menü ve rapor ekranlarını birlikte çalıştırır.",
      },
      {
        question: "Mutfak ekranı restoran POS içinde var mı?",
        answer: "Evet. Siparişler mutfak tarafında bekleyen, hazırlanan ve hazır durumlarıyla izlenebilir.",
      },
    ],
  },
  {
    slug: "kafe-pos-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "pos",
    canonicalSlug: "kafe-pos-sistemi",
    hreflangAlternates: {
      "tr-TR": "kafe-pos-sistemi",
      "en": "en/cafe-pos-system",
      "x-default": "en/cafe-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Kafe POS Sistemi",
    metaTitle: "Kafe POS Sistemi | Hızlı Sipariş, Kasa ve Stok",
    description:
      "Kafe POS sistemi arayan işletmeler için Cloud POS; hızlı sipariş, paket, gel-al, QR menü, kasa ve stok süreçlerini bulutta yönetir.",
    eyebrow: "Kafe ve pastane",
    heroTitle: "Kafe POS sistemiyle hızlı sipariş ve kasa akışını sadeleştirin.",
    heroLead:
      "Self servis kahve, gel-al sipariş, paket servis ve tezgah satışı gibi yoğun akışlarda ürün, kasa ve stok kontrolünü tek panelden yönetin.",
    primaryKeyword: "kafe POS sistemi",
    relatedKeywords: ["pastane pos sistemi", "kahve dükkanı pos", "gel-al sipariş sistemi", "self servis kafe"],
    sections: [
      {
        title: "Hızlı ürün seçimi",
        body: "Kategori ve ürün akışı yoğun servis anlarında hızlı sipariş girişi için düzenlenir.",
        bullets: ["Mobil POS ekranı", "Kategori bazlı ürünler", "Gel-al ve paket akışı"],
      },
      {
        title: "Self servis ve QR destekli model",
        body: "Müşteri QR menüden ürünü inceler; işletme isterse QR üzerinden sipariş almayı açıp kapatabilir.",
        bullets: ["QR menü", "Opsiyonel QR sipariş", "Self servis operasyon"],
      },
      {
        title: "Gün sonu kontrolü",
        body: "Kasa, stok ve satış özetleri aynı yerde olduğu için vardiya kapanışı daha kontrollü ilerler.",
        bullets: ["Kasa oturumu", "Stok kokpiti", "Satış raporları"],
      },
    ],
    faq: [
      {
        question: "Cloud POS kafe ve kahve işletmeleri için uygun mu?",
        answer: "Evet. Hızlı ürün seçimi, self servis, gel-al, kasa ve stok modülleri kafe operasyonlarına uygundur.",
      },
      {
        question: "QR sipariş zorunlu mu?",
        answer: "Hayır. QR menü ve QR üzerinden sipariş alma işletme ayarlarından açılıp kapatılabilir.",
      },
    ],
  },
  {
    slug: "qr-menü",
    locale: "tr",
    market: "turkey",
    cluster: "qr-menü",
    canonicalSlug: "qr-menü",
    hreflangAlternates: {
      "tr-TR": "qr-menü",
      "en": "en/qr-menü-system",
      "x-default": "en/qr-menü-system",
    },
    schemaType: "SoftwareApplication",
    title: "QR Menü",
    metaTitle: "QR Menü | Dijital Menü ve Masadan Sipariş",
    description:
      "Cloud POS QR menü ile müşteriler ürünleri telefondan görür; işletme isterse masadan sipariş alma özelliğini aktif eder.",
    eyebrow: "Dijital menü",
    heroTitle: "QR menüyle müşteriye hızlı, temiz ve güncel bir menü sunun.",
    heroLead:
      "Ürünler, fiyatlar ve görseller POS panelinden yönetilir; QR menü açık kalabilir, QR sipariş ise operasyon kararına göre kapatılabilir.",
    primaryKeyword: "QR menü",
    relatedKeywords: ["qr menü sistemi", "dijital menü", "masadan sipariş", "qr sipariş"],
    sections: [
      {
        title: "Ürün kataloğu POS ile bağlı",
        body: "Menü içeriği ayrı bir panelde tekrar yazılmaz; ürün ve kategori bilgisi POS kataloğuyla aynı kaynaktan gelir.",
        bullets: ["Kategori filtreleri", "Ürün açıklamaları", "Güncel fiyat yönetimi"],
      },
      {
        title: "Sipariş özelliği opsiyonel",
        body: "QR menü sadece görüntüleme için açık kalabilir; müşterinin sipariş verebilmesi ayrıca kontrol edilir.",
        bullets: ["QR menü aç/kapat", "QR sipariş aç/kapat", "Eski sekmeler için API koruması"],
      },
      {
        title: "Mobil öncelikli deneyim",
        body: "Müşteri menüyü telefonda arar, kategori gezer ve sepet kullanır; işletme deneyimi operasyon durumuna göre ayarlar.",
        bullets: ["Mobil arama", "Kategori çipleri", "Modern sepet akışı"],
      },
    ],
    faq: [
      {
        question: "QR menü ile QR sipariş aynı şey mi?",
        answer: "Hayır. QR menü ürünleri gösterir; QR sipariş ise müşterinin masadan sipariş göndermesini sağlar ve ayrı kapatılabilir.",
      },
      {
        question: "QR menü kapatılınca müşteri ürünleri görür mü?",
        answer: "Hayır. QR menü kapalıysa public QR sayfası menü verisini göstermeden kapalı durum mesajı verir.",
      },
    ],
  },
  {
    slug: "self-servis-siparis-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "self-service",
    canonicalSlug: "self-servis-siparis-sistemi",
    hreflangAlternates: {
      "tr-TR": "self-servis-siparis-sistemi",
      "en": "en/self-service-ordering-system",
      "x-default": "en/self-service-ordering-system",
    },
    schemaType: "SoftwareApplication",
    title: "Self Servis Sipariş Sistemi",
    metaTitle: "Self Servis Sipariş Sistemi | Kafe ve Restoran POS",
    description:
      "Self servis sipariş sistemiyle müşteri, kasa ve mutfak akışını Cloud POS üzerinde yönetin; gel-al, QR ve mobil operasyonları tekleştirin.",
    eyebrow: "Self servis",
    heroTitle: "Self servis sipariş sistemiyle yoğun saatlerde sırayı ve mutfağı rahatlatın.",
    heroLead:
      "Kahve, hızlı servis ve gel-al operasyonlarında siparişin alınması, hazırlanması ve teslim edilmesi aynı durum akışında izlenir.",
    primaryKeyword: "self servis sipariş sistemi",
    relatedKeywords: ["self servis pos", "gel-al sipariş", "kiosk alternatifi", "hızlı servis pos"],
    sections: [
      {
        title: "Siparişten teslimata durum takibi",
        body: "Bekleyen, hazırlanan, hazır ve teslim edilen siparişler ayrı durumlarla izlenir.",
        bullets: ["Pickup sipariş kuyruğu", "Hazırlanıyor ve hazır durumları", "Teslim edildi aksiyonu"],
      },
      {
        title: "Kasa ve mutfak uyumu",
        body: "Kasa, operasyon paneli ve mutfak ekranı aynı sipariş durumlarını kullanır.",
        bullets: ["Tek sipariş kaynağı", "Rol bazlı ekranlar", "Canlı operasyon görünümü"],
      },
      {
        title: "QR ve mobil PWA desteği",
        body: "Müşteri tarafı QR deneyimi ve ekip tarafı mobil PWA ekranları aynı operasyonu destekler.",
        bullets: ["QR menü", "Mobil operasyon merkezi", "PWA destekli saha ekranları"],
      },
    ],
    faq: [
      {
        question: "Self servis sipariş için ayrı cihaz gerekir mi?",
        answer: "Her modelde gerekmez. Cloud POS, QR ve mobil operasyon akışlarıyla self servis senaryolarını destekler.",
      },
      {
        question: "Gel-al siparişler takip edilebilir mi?",
        answer: "Evet. Gel-al siparişler bekleyen, hazırlanıyor, hazır ve teslim edildi durumlarıyla izlenebilir.",
      },
    ],
  },
  {
    slug: "kafe-restoran-yonetim-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "pos",
    canonicalSlug: "kafe-restoran-yonetim-sistemi",
    hreflangAlternates: {
      "tr-TR": "kafe-restoran-yonetim-sistemi",
      "en": "en/restaurant-pos-system",
      "x-default": "en/restaurant-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Kafe Restoran Yönetim Sistemi",
    metaTitle: "Kafe Restoran Yönetim Sistemi | Bulut POS Alternatifi",
    description:
      "Kafe-restoran yönetim sistemi arayan işletmeler için Cloud POS; masa, adisyon, QR menü, mutfak, kasa, stok ve raporu bulutta birleştirir.",
    eyebrow: "Kafe-restoran yönetimi",
    heroTitle: "Kafe-restoran yönetim sistemi arayanlar için bulut tabanlı operasyon paneli.",
    heroLead:
      "Salon, masa, mutfak, kasa, stok ve rapor süreçlerini tek akışta takip ederek kafe-restoran yönetimini daha ölçülebilir hale getirin.",
    primaryKeyword: "kafe-restoran yönetim sistemi",
    relatedKeywords: ["restoran yönetim sistemi", "bulut restoran pos", "kafe pos alternatifi", "cafe restoran yazılımı"],
    sections: [
      {
        title: "Salon ve masa yönetimi",
        body: "Masa durumu, açık adisyonlar ve servis talepleri operasyon panelinden takip edilir.",
        bullets: ["Dolu ve boş masa görünümü", "Açık adisyonlar", "Servis talepleri"],
      },
      {
        title: "Rol bazlı ekip ekranları",
        body: "Garson, mutfak, kasiyer ve yönetici ekranları aynı operasyon verisini kendi işlerine göre gösterir.",
        bullets: ["Mutfak paneli", "Kasa paneli", "Yönetim raporları"],
      },
      {
        title: "Bulut mimari",
        body: "Çok şubeli yapı, merkezi ayarlar ve public QR akışları bulut tabanlı çalışacak şekilde tasarlanır.",
        bullets: ["Çok şube desteği", "Merkezi ayarlar", "Güvenli rol kontrolü"],
      },
    ],
    faq: [
      {
        question: "Cloud POS kafe-restoran yönetim sistemi yerine kullanılabilir mi?",
        answer: "Cloud POS; masa, adisyon, mutfak, kasa, stok, QR menü ve raporlama modülleriyle kafe-restoran yönetimi için kapsamlı bir bulut POS çözümüdür.",
      },
      {
        question: "Çok şubeli kafe ve restoranlar için uygun mu?",
        answer: "Evet. Sistem işletme ve şube kapsamlarıyla çalışacak şekilde tasarlanmıştır.",
      },
    ],
  },
  {
    slug: "stok-takipli-pos-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "inventory",
    canonicalSlug: "stok-takipli-pos-sistemi",
    hreflangAlternates: {
      "tr-TR": "stok-takipli-pos-sistemi",
      "en": "en/cloud-pos-system",
      "x-default": "en/cloud-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Stok Takipli POS Sistemi",
    metaTitle: "Stok Takipli POS Sistemi | Satış, Sayım ve Kritik Stok",
    description:
      "Stok takipli POS sistemiyle ürün stoklarını, düşük stok uyarılarını, satışları ve operasyon raporlarını Cloud POS üzerinde yönetin.",
    eyebrow: "Stok ve satış",
    heroTitle: "Stok takipli POS sistemiyle satıştan sonra stok kontrolünü kaçırmayın.",
    heroLead:
      "Ürün stokları, kritik seviyeler ve operasyon kokpiti aynı sistemde izlenir; yönetici stok riskini servis başlamadan görebilir.",
    primaryKeyword: "stok takipli POS sistemi",
    relatedKeywords: ["stok takip programı", "pos stok yönetimi", "kritik stok uyarısı", "ürün stok takibi"],
    sections: [
      {
        title: "Kritik stok görünürlüğü",
        body: "Düşük stoklu ürünler ops ekranında öne çıkar; servis öncesi kontrol kolaylaşır.",
        bullets: ["Stok kokpiti", "Kritik ürün listesi", "Stokta yok uyarısı"],
      },
      {
        title: "Ürün ve satış bağlantısı",
        body: "Ürün kataloğu, satış akışı ve stok sayıları aynı operasyon modelinde tutulur.",
        bullets: ["Ürün kataloğu", "Stok sayısı", "Satış raporları"],
      },
      {
        title: "Yönetim paneli",
        body: "Stok ekranı, ürün yönetimi ve raporlar birlikte çalışarak günlük kontrolü güçlendirir.",
        bullets: ["Stok ekranı", "Ürün yönetimi", "Günlük rapor"],
      },
    ],
    faq: [
      {
        question: "POS sistemi stok uyarısı verebilir mi?",
        answer: "Evet. Cloud POS düşük ve kritik stoklu ürünleri operasyon ekranında görünür hale getirir.",
      },
      {
        question: "Stok takibi satış raporlarıyla birlikte çalışır mı?",
        answer: "Evet. Ürün, satış ve stok bilgileri aynı panelde yönetilir.",
      },
    ],
  },
  {
    slug: "adisyon-programi",
    locale: "tr",
    market: "turkey",
    cluster: "adisyon",
    canonicalSlug: "adisyon-programi",
    hreflangAlternates: {
      "tr-TR": "adisyon-programi",
      "en": "en/restaurant-pos-system",
      "x-default": "en/restaurant-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Adisyon Programı",
    metaTitle: "Adisyon Programı | Masa, Sipariş ve Kasa Takibi",
    description:
      "Cloud POS adisyon programı; masa siparişi, açık hesap, parçalı ödeme, kasa ve mutfak akışını restoran operasyonu için birleştirir.",
    eyebrow: "Adisyon ve kasa",
    heroTitle: "Adisyon programıyla masa hesabını, siparişi ve tahsilatı netleştirin.",
    heroLead:
      "Açık adisyonlar, masa siparişleri, ödeme durumu ve kasa aksiyonları aynı yerde toplandığı için servis sonu kontrolü kolaylaşır.",
    primaryKeyword: "adisyon programı",
    relatedKeywords: ["restoran adisyon", "masa hesabı programı", "kasa adisyon", "garson sipariş sistemi"],
    sections: [
      {
        title: "Açık adisyon takibi",
        body: "Masa bazlı siparişler adisyon üzerinde takip edilir ve ödeme tamamlanana kadar açık kalır.",
        bullets: ["Masa seçimi", "Açık hesap", "Sipariş kalemleri"],
      },
      {
        title: "Parçalı ödeme ve kasa",
        body: "Kasiyer adisyonu görür, tahsilatı yapar ve ödeme durumunu yönetir.",
        bullets: ["Parçalı ödeme", "Nakit/kart takibi", "Kasa oturumu"],
      },
      {
        title: "QR ve paylaşım akışları",
        body: "İşletme modeline göre QR menü ve müşteri tarafı sipariş seçenekleri adisyon akışını destekler.",
        bullets: ["QR menü", "Masadan sipariş", "Müşteri görünümü"],
      },
    ],
    faq: [
      {
        question: "Adisyon programı masa hesabını takip eder mi?",
        answer: "Evet. Cloud POS masa bazlı sipariş ve açık adisyon takibini destekler.",
      },
      {
        question: "Parçalı ödeme yapılabilir mi?",
        answer: "Evet. Kasa ekranı parçalı ödeme ve ödeme durumu akışlarını destekler.",
      },
    ],
  },
  {
    slug: "garson-el-terminali",
    locale: "tr",
    market: "turkey",
    cluster: "mobile-waiter",
    canonicalSlug: "garson-el-terminali",
    hreflangAlternates: {
      "tr-TR": "garson-el-terminali",
      "en": "en/restaurant-pos-system",
      "x-default": "en/restaurant-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Garson El Terminali",
    metaTitle: "Garson El Terminali | Mobil Sipariş ve Masa Yönetimi",
    description:
      "Garson el terminali alternatifi Cloud POS mobil PWA ile masa seçimi, sipariş girişi, servis talepleri ve operasyon akışı telefondan yönetilir.",
    eyebrow: "Mobil servis",
    heroTitle: "Garson el terminali yerine mobil PWA ile siparişi masada alın.",
    heroLead:
      "Garsonlar mobil ekrandan masa seçer, siparişi girer ve mutfak/kasa akışını aynı sistem içinde başlatır.",
    primaryKeyword: "garson el terminali",
    relatedKeywords: ["mobil garson sipariş", "tablet sipariş sistemi", "garson sipariş programı", "pwa pos"],
    sections: [
      {
        title: "Mobil masa seçimi",
        body: "Telefon veya tablet üzerinden masa listesi görüntülenir ve sipariş akışı doğru masadan başlar.",
        bullets: ["Mobil masa ekranı", "Masa-first sipariş", "PWA kullanım modeli"],
      },
      {
        title: "Hızlı ürün ekleme",
        body: "Ürün kategorileri ve sepet akışı mobil ekranda yoğun servis için sade tutulur.",
        bullets: ["Kategori çipleri", "Ürün kartları", "Mobil sepet"],
      },
      {
        title: "Rol bazlı yönlendirme",
        body: "Garson, mutfak ve kasiyer ekranları kendi görevlerine göre ayrılır.",
        bullets: ["Garson ekranı", "Mutfak ekranı", "Kasa ekranı"],
      },
    ],
    faq: [
      {
        question: "Garson el terminali için ayrı cihaz şart mı?",
        answer: "Hayır. Cloud POS mobil PWA olarak telefon veya tablet üzerinden kullanılacak şekilde tasarlanır.",
      },
      {
        question: "Garson siparişi doğrudan mutfağa düşer mi?",
        answer: "Sipariş akışı mutfak ve operasyon ekranlarıyla aynı sistemde takip edilir.",
      },
    ],
  },
  {
    slug: "bulut-pos-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "pos",
    canonicalSlug: "bulut-pos-sistemi",
    hreflangAlternates: {
      "tr-TR": "bulut-pos-sistemi",
      "en": "en/cloud-pos-system",
      "x-default": "en/cloud-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Bulut POS Sistemi",
    metaTitle: "Bulut POS Sistemi | Çok Şubeli Restoran ve Kafe Yönetimi",
    description:
      "Bulut POS sistemi Cloud POS ile restoran, kafe, self servis, QR menü, kasa, stok ve rapor operasyonlarını internet üzerinden yönetin.",
    eyebrow: "Bulut mimari",
    heroTitle: "Bulut POS sistemiyle şube, ekip ve operasyon ekranlarını merkezi yönetin.",
    heroLead:
      "Kurulum, rol, şube, sipariş, kasa ve rapor süreçleri tek web tabanlı panelde birleşir; ekipler kendi ekranlarından çalışır.",
    primaryKeyword: "bulut POS sistemi",
    relatedKeywords: ["online pos sistemi", "web tabanlı pos", "çok şubeli pos", "cloud restoran pos"],
    sections: [
      {
        title: "Web tabanlı yönetim",
        body: "Yönetici, kasa, mutfak ve mobil PWA ekranları internet üzerinden erişilen aynı sistemde çalışır.",
        bullets: ["Web panel", "Mobil PWA", "Rol bazlı erişim"],
      },
      {
        title: "Çok şube ve kapsam kontrolü",
        body: "İşletme ve şube kapsamlarıyla ekip erişimi daha kontrollü yönetilir.",
        bullets: ["İşletme kapsamı", "Şube erişimi", "Yetki kontrolleri"],
      },
      {
        title: "Public müşteri akışları",
        body: "QR menü ve müşteri siparişi gibi public akışlar aynı ürün ve ayar modeline bağlı kalır.",
        bullets: ["QR menü", "Müşteri siparişi", "Ayar bazlı kontrol"],
      },
    ],
    faq: [
      {
        question: "Bulut POS sistemi yerel kurulum ister mi?",
        answer: "Cloud POS web tabanlı çalışır; ekipler yetkilerine göre ilgili panel veya mobil PWA ekranına girer.",
      },
      {
        question: "Çok şubeli işletmeler desteklenir mi?",
        answer: "Evet. İşletme ve şube kapsamları sistem mimarisinde desteklenir.",
      },
    ],
  },
  {
    slug: "en/restaurant-pos-system",
    locale: "en",
    market: "global",
    cluster: "pos",
    canonicalSlug: "en/restaurant-pos-system",
    hreflangAlternates: trCoreAlternates,
    schemaType: "SoftwareApplication",
    title: "Restaurant POS System",
    metaTitle: "Restaurant POS System | Tables, Kitchen, Payments and Stock",
    description:
      "Cloud POS brings table service, kitchen display, payments, QR menüs, stock and reporting into one cloud restaurant POS system.",
    eyebrow: "Restaurant operations",
    heroTitle: "Run tables, kitchen and checkout from one restaurant POS system.",
    heroLead:
      "Cloud POS connects waiter ordering, open checks, kitchen preparation, payment status and inventory visibility in one operating workflow.",
    primaryKeyword: "restaurant POS system",
    relatedKeywords: ["cloud restaurant POS", "restaurant management system", "kitchen display system", "waiter ordering app"],
    sections: [
      {
        title: "Table and check management",
        body: "Teams can open checks by table, add items, keep orders visible and move the bill cleanly to checkout.",
        bullets: ["Open checks", "Role-based workflows", "Partial payment support"],
      },
      {
        title: "Kitchen visibility",
        body: "Orders move through pending, preparing and ready states so the team knows what needs attention.",
        bullets: ["Kitchen queue", "Delay tracking", "Live operations dashboard"],
      },
      {
        title: "Stock and reporting",
        body: "Daily sales, product activity and low-stock signals stay connected to the same product catalog.",
        bullets: ["Stock cockpit", "Sales reporting", "Multi-branch structure"],
      },
    ],
    faq: [
      {
        question: "Is Cloud POS only a checkout system?",
        answer: "No. It combines table service, kitchen, checkout, inventory, QR menü and reporting workflows.",
      },
      {
        question: "Does it support restaurants with table service?",
        answer: "Yes. The product is designed around table, check, kitchen and cashier flows.",
      },
    ],
  },
  {
    slug: "en/cafe-pos-system",
    locale: "en",
    market: "global",
    cluster: "pos",
    canonicalSlug: "en/cafe-pos-system",
    hreflangAlternates: {
      "tr-TR": "kafe-pos-sistemi",
      "en": "en/cafe-pos-system",
      "x-default": "en/cafe-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Cafe POS System",
    metaTitle: "Cafe POS System | Fast Ordering, Pickup and Inventory",
    description:
      "Cloud POS helps cafes manage fast ordering, pickup, QR menü, checkout, inventory and reporting from one cloud platform.",
    eyebrow: "Cafe operations",
    heroTitle: "A cafe POS system built for fast service and clear daily control.",
    heroLead:
      "Use one platform for counter service, pickup orders, QR menü browsing, stock checks and end-of-day reporting.",
    primaryKeyword: "cafe POS system",
    relatedKeywords: ["coffee shop POS", "pickup ordering system", "self-service cafe", "cloud cafe POS"],
    sections: [
      {
        title: "Fast product selection",
        body: "Category-first ordering keeps busy service moments fast and predictable.",
        bullets: ["Mobile POS screen", "Product categories", "Pickup and takeaway flow"],
      },
      {
        title: "QR and self-service ready",
        body: "Customers can browse the menü from QR, while the business controls whether QR ordering is active.",
        bullets: ["QR menü", "Optional QR ordering", "Self-service scenarios"],
      },
      {
        title: "Daily control",
        body: "Cashier activity, stock signals and sales reports stay close to daily operations.",
        bullets: ["Cashier session", "Stock cockpit", "Sales summary"],
      },
    ],
    faq: [
      {
        question: "Can Cloud POS work for cafes and coffee shops?",
        answer: "Yes. It supports fast ordering, pickup, QR menü, checkout, stock and reporting workflows.",
      },
      {
        question: "Is QR ordering mandatory?",
        answer: "No. QR menü and QR ordering can be controlled separately.",
      },
    ],
  },
  {
    slug: "en/qr-menü-system",
    locale: "en",
    market: "global",
    cluster: "qr-menü",
    canonicalSlug: "en/qr-menü-system",
    hreflangAlternates: {
      "tr-TR": "qr-menü",
      "en": "en/qr-menü-system",
      "x-default": "en/qr-menü-system",
    },
    schemaType: "SoftwareApplication",
    title: "QR Menu System",
    metaTitle: "QR Menu System | Digital Menu and Table Ordering",
    description:
      "Cloud POS QR menü lets customers browse products on their phones while the business controls whether table ordering is enabled.",
    eyebrow: "Digital menü",
    heroTitle: "A QR menü system connected to your POS catalog.",
    heroLead:
      "Product names, prices and categories come from the POS catalog, and QR ordering can be enabled or disabled based on operations.",
    primaryKeyword: "QR menü system",
    relatedKeywords: ["digital menü", "table ordering", "QR ordering", "restaurant QR menü"],
    sections: [
      {
        title: "Catalog-connected menü",
        body: "Menu content follows the product catalog instead of requiring duplicate entry.",
        bullets: ["Category filters", "Product descriptions", "Current prices"],
      },
      {
        title: "Optional ordering",
        body: "Use QR for browsing only, or allow customers to send orders when the team is ready.",
        bullets: ["QR menü toggle", "QR ordering toggle", "Server-side order guard"],
      },
      {
        title: "Mobile-first experience",
        body: "Customers can search, browse categories and use a cart from a phone-first interface.",
        bullets: ["Mobile search", "Category chips", "Modern cart flow"],
      },
    ],
    faq: [
      {
        question: "Is QR menü the same as QR ordering?",
        answer: "No. QR menü shows products; QR ordering lets customers submit orders and can be disabled separately.",
      },
      {
        question: "Can QR menü be turned off?",
        answer: "Yes. If disabled, public QR pages show a closed state instead of menü data.",
      },
    ],
  },
  {
    slug: "en/self-service-ordering-system",
    locale: "en",
    market: "global",
    cluster: "self-service",
    canonicalSlug: "en/self-service-ordering-system",
    hreflangAlternates: {
      "tr-TR": "self-servis-siparis-sistemi",
      "en": "en/self-service-ordering-system",
      "x-default": "en/self-service-ordering-system",
    },
    schemaType: "SoftwareApplication",
    title: "Self-Service Ordering System",
    metaTitle: "Self-Service Ordering System | Cafe and Restaurant POS",
    description:
      "Cloud POS supports self-service and pickup ordering workflows for cafes and restaurants with shared kitchen, cashier and operations screens.",
    eyebrow: "Self-service",
    heroTitle: "A self-service ordering system for busy pickup and cafe workflows.",
    heroLead:
      "Track orders from pending to preparing, ready and delivered while keeping cashier and kitchen teams aligned.",
    primaryKeyword: "self-service ordering system",
    relatedKeywords: ["self-service POS", "pickup ordering", "quick service POS", "QR ordering"],
    sections: [
      {
        title: "Order status tracking",
        body: "Pickup and self-service orders move through clear states from order entry to delivery.",
        bullets: ["Pending queue", "Preparing and ready states", "Delivered action"],
      },
      {
        title: "Kitchen and cashier alignment",
        body: "The same order status is visible from operations, kitchen and cashier screens.",
        bullets: ["Single order source", "Role-based screens", "Live operations view"],
      },
      {
        title: "QR and PWA support",
        body: "Customer QR flows and staff mobile PWA screens support the same operating model.",
        bullets: ["QR menü", "Mobile operations center", "PWA-ready workflows"],
      },
    ],
    faq: [
      {
        question: "Does self-service require a kiosk?",
        answer: "Not always. Cloud POS supports QR and mobile-led self-service scenarios.",
      },
      {
        question: "Can pickup orders be tracked?",
        answer: "Yes. Pickup orders can be tracked through pending, preparing, ready and delivered states.",
      },
    ],
  },
  {
    slug: "en/cloud-pos-system",
    locale: "en",
    market: "global",
    cluster: "pos",
    canonicalSlug: "en/cloud-pos-system",
    hreflangAlternates: {
      "tr-TR": "bulut-pos-sistemi",
      "en": "en/cloud-pos-system",
      "x-default": "en/cloud-pos-system",
    },
    schemaType: "SoftwareApplication",
    title: "Cloud POS System",
    metaTitle: "Cloud POS System | Multi-Branch Restaurant and Cafe Platform",
    description:
      "Cloud POS helps restaurants and cafes manage ordering, QR menü, checkout, inventory, reporting and multi-branch operations from the web.",
    eyebrow: "Cloud platform",
    heroTitle: "A cloud POS system for multi-branch restaurant and cafe operations.",
    heroLead:
      "Manage setup, roles, branches, orders, checkout and reports from one web-based platform with mobile PWA support.",
    primaryKeyword: "cloud POS system",
    relatedKeywords: ["online POS system", "web based POS", "multi-branch POS", "cloud restaurant POS"],
    sections: [
      {
        title: "Web-based management",
        body: "Admin, cashier, kitchen and mobile PWA screens operate from one cloud-oriented system.",
        bullets: ["Web dashboard", "Mobile PWA", "Role-based access"],
      },
      {
        title: "Branch-aware operations",
        body: "Business and branch scopes help teams operate with clearer access boundaries.",
        bullets: ["Business scope", "Branch access", "Permission controls"],
      },
      {
        title: "Customer-facing flows",
        body: "QR menü and customer ordering flows stay connected to the same product and settings model.",
        bullets: ["QR menü", "Customer ordering", "Settings-based controls"],
      },
    ],
    faq: [
      {
        question: "Does a cloud POS require local installation?",
        answer: "Cloud POS is web-based; teams sign in to the relevant panel or mobile PWA screen.",
      },
      {
        question: "Can it support multiple branches?",
        answer: "Yes. The architecture supports business and branch scope concepts.",
      },
    ],
  },
  {
    slug: "istanbul-restoran-pos-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "pos",
    canonicalSlug: "istanbul-restoran-pos-sistemi",
    hreflangAlternates: {
      "tr-TR": "istanbul-restoran-pos-sistemi",
      "x-default": "restoran-pos-sistemi",
    },
    schemaType: "SoftwareApplication",
    title: "İstanbul Restoran POS Sistemi",
    metaTitle: "İstanbul Restoran POS Sistemi | Masa, Mutfak, Kasa ve Stok",
    description:
      "İstanbul restoranları için Cloud POS; yoğun servis, masa yönetimi, mutfak, adisyon, QR menü ve stok süreçlerini tek panelde toplar.",
    eyebrow: "İstanbul restoranları",
    heroTitle: "İstanbul'da yoğun servis yapan restoranlar için bulut POS akışı.",
    heroLead:
      "Çok masalı, hızlı dönen ve ekip koordinasyonu gerektiren İstanbul restoranlarında masa, mutfak, kasa ve stok görünürlüğünü aynı panelde tutun.",
    primaryKeyword: "İstanbul restoran POS sistemi",
    relatedKeywords: ["İstanbul pos sistemi", "İstanbul adisyon programı", "restoran yönetim sistemi İstanbul", "QR menü İstanbul"],
    locality: {
      city: "İstanbul",
      region: "Marmara",
      scenario: "Yoğun masa servisi, çok ekipli salon ve hızlı kasa kapanışı",
    },
    sections: [
      {
        title: "Yoğun salon akışı",
        body: "Masa doluluğu, açık adisyon ve servis talepleri tek operatör ekranında takip edilir.",
        bullets: ["Dolu/boş masa görünümü", "Açık adisyon takibi", "Servis talebi kontrolü"],
      },
      {
        title: "Mutfak ve kasa koordinasyonu",
        body: "Sipariş durumu, hazırlık ve tahsilat süreçleri ekibin aynı veriye bakmasını sağlar.",
        bullets: ["Mutfak kuyruğu", "Kasada bekleyenler", "Gecikme sinyalleri"],
      },
      {
        title: "QR ve stok kontrolü",
        body: "Menü, QR sipariş ve düşük stok riskleri yoğun servis öncesinde yönetilebilir.",
        bullets: ["QR menü", "Opsiyonel QR sipariş", "Stok kokpiti"],
      },
    ],
    faq: [
      {
        question: "İstanbul restoranları için şehir bazlı ayrı kurulum gerekir mi?",
        answer: "Hayır. Cloud POS bulut tabanlıdır; şehir sayfası kullanım senaryosunu açıklar, ürün aynı platformdur.",
      },
      {
        question: "Yoğun servis saatlerinde stok riski görülebilir mi?",
        answer: "Evet. Düşük stoklu ürünler operasyon ve stok ekranlarında öne çıkarılabilir.",
      },
    ],
  },
  {
    slug: "ankara-kafe-pos-sistemi",
    locale: "tr",
    market: "turkey",
    cluster: "pos",
    canonicalSlug: "ankara-kafe-pos-sistemi",
    hreflangAlternates: {
      "tr-TR": "ankara-kafe-pos-sistemi",
      "x-default": "kafe-pos-sistemi",
    },
    schemaType: "SoftwareApplication",
    title: "Ankara Kafe POS Sistemi",
    metaTitle: "Ankara Kafe POS Sistemi | Hızlı Sipariş, Gel-Al ve Kasa",
    description:
      "Ankara kafe ve kahve işletmeleri için Cloud POS; hızlı sipariş, gel-al, QR menü, kasa, stok ve rapor akışlarını bulutta yönetir.",
    eyebrow: "Ankara kafe operasyonu",
    heroTitle: "Ankara'daki kafe ve kahve işletmeleri için hızlı POS yönetimi.",
    heroLead:
      "Tezgah satışı, gel-al sipariş ve self servis modelini tek ürün kataloğu, kasa ve stok akışında birleştirin.",
    primaryKeyword: "Ankara kafe POS sistemi",
    relatedKeywords: ["Ankara kafe pos", "Ankara kahve dükkanı pos", "gel-al sipariş Ankara", "self servis kafe pos"],
    locality: {
      city: "Ankara",
      region: "İç Anadolu",
      scenario: "Kahve, gel-al ve tezgah satışı yoğun kafe operasyonu",
    },
    sections: [
      {
        title: "Hızlı ürün akışı",
        body: "Kategori bazlı ürün seçimi yoğun kafe anlarında sipariş hızını korur.",
        bullets: ["Kategori çipleri", "Mobil sipariş", "Gel-al akışı"],
      },
      {
        title: "Kasa ve gün sonu",
        body: "Kasa oturumu, satış özeti ve stok kontrolü aynı yönetim bakışına bağlanır.",
        bullets: ["Kasa oturumu", "Günlük satış", "Düşük stok"],
      },
      {
        title: "Self servis seçenekleri",
        body: "QR menü görüntüleme ve QR sipariş seçenekleri işletme temposuna göre açılıp kapatılabilir.",
        bullets: ["QR menü", "QR sipariş kontrolü", "Pickup sipariş takibi"],
      },
    ],
    faq: [
      {
        question: "Ankara kafe POS sistemi için yerel sunucu gerekir mi?",
        answer: "Hayır. Cloud POS web tabanlıdır ve ekipler rolüne göre ilgili ekrana giriş yapar.",
      },
      {
        question: "Gel-al sipariş takip edilebilir mi?",
        answer: "Evet. Gel-al siparişler durumlarıyla takip edilebilir.",
      },
    ],
  },
  {
    slug: "izmir-qr-menü",
    locale: "tr",
    market: "turkey",
    cluster: "qr-menü",
    canonicalSlug: "izmir-qr-menü",
    hreflangAlternates: {
      "tr-TR": "izmir-qr-menü",
      "x-default": "qr-menü",
    },
    schemaType: "SoftwareApplication",
    title: "İzmir QR Menü",
    metaTitle: "İzmir QR Menü | Dijital Menü ve Masadan Sipariş",
    description:
      "İzmir restoran ve kafeleri için Cloud POS QR menü; dijital menü, masadan sipariş ve POS bağlantılı ürün yönetimi sunar.",
    eyebrow: "İzmir dijital menü",
    heroTitle: "İzmir'deki restoran ve kafeler için POS bağlantılı QR menü.",
    heroLead:
      "Sahil, kafe ve restoran servislerinde menüyü telefondan gösterin; operasyon hazır olduğunda QR siparişi ayrıca açın.",
    primaryKeyword: "İzmir QR menü",
    relatedKeywords: ["İzmir dijital menü", "İzmir QR sipariş", "QR menü sistemi İzmir", "masadan sipariş İzmir"],
    locality: {
      city: "İzmir",
      region: "Ege",
      scenario: "Kafe, restoran ve sahil işletmelerinde hızlı dijital menü erişimi",
    },
    sections: [
      {
        title: "Dijital menü görünürlüğü",
        body: "Müşteriler ürünleri telefondan görür; fiyat ve kategori bilgisi POS kataloğundan gelir.",
        bullets: ["POS bağlantılı katalog", "Mobil menü", "Kategori filtreleri"],
      },
      {
        title: "Masadan sipariş kontrolü",
        body: "QR sipariş, işletmenin operasyon hazırlığına göre açılıp kapatılabilir.",
        bullets: ["Sipariş toggle", "API koruması", "Sepet akışı"],
      },
      {
        title: "Kafe ve restoran uyumu",
        body: "QR menü, masa servisi veya self servis modelinin yanında çalışacak şekilde tasarlanır.",
        bullets: ["Masa QR", "Self servis", "Gel-al senaryosu"],
      },
    ],
    faq: [
      {
        question: "İzmir QR menü sayfası ayrı ürün mü?",
        answer: "Hayır. Bu sayfa İzmir arama niyetini hedefler; ürün Cloud POS QR menü modülüdür.",
      },
      {
        question: "Sadece menü gösterip siparişi kapatabilir miyim?",
        answer: "Evet. QR menü ve QR sipariş ayrı ayarlanabilir.",
      },
    ],
  },
];

export const primaryHomeSeoLandingPages = seoLandingPages.filter(
  (page) => page.locale === "tr" && page.market === "turkey" && !page.locality,
);

export function getSeoLandingPage(slug: string) {
  return seoLandingPages.find((page) => page.slug === slug) ?? null;
}

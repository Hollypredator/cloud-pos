"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { GeneralSettings } from "@/lib/app-settings";
import type { AppLocale } from "@/lib/i18n";
import { primaryHomeSeoLandingPages } from "@/lib/seo-landing-pages";
import { 
  QrCode, 
  Layers, 
  ChefHat, 
  CreditCard, 
  RefreshCw, 
  BarChart3, 
  ArrowRight,
  Wifi,
  WifiOff,
  Plus,
  Minus,
  Check,
  ChevronDown,
  AlertTriangle,
  Heart
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type ProductLandingPageProps = {
  settings: GeneralSettings;
  leadStatus?: string;
  locale?: AppLocale;
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export function ProductLandingPage({ settings, leadStatus, locale = "tr" }: ProductLandingPageProps) {
  const siteName = settings.siteName || "Quapos Cloud POS";
  const supportEmail = settings.supportEmail || "info@cloudpos.local";
  const phone = settings.contactPhone || settings.whatsappPhone || "+90 555 000 00 00";

  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  // Simulator State
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [totalSales, setTotalSales] = useState<number>(1420);
  const [offlineQueue, setOfflineQueue] = useState<CartItem[][]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [justSynced, setJustSynced] = useState<boolean>(false);

  // Animation Refs
  const headerRef = useRef<HTMLDivElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroCtasRef = useRef<HTMLDivElement>(null);
  const simulatorCardRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const contentSectionRef = useRef<HTMLDivElement>(null);
  const showcaseSectionRef = useRef<HTMLDivElement>(null);

  // Magnetic button refs
  const magneticButton1 = useRef<HTMLAnchorElement>(null);
  const magneticButton2 = useRef<HTMLAnchorElement>(null);

  const menuItems = [
    { id: "latte", name: "Latte Macchiato", price: 120 },
    { id: "americano", name: "Americano", price: 95 },
    { id: "croissant", name: "Butter Croissant", price: 90 },
    { id: "cheesecake", name: "San Sebastian", price: 170 },
  ];

  const faqs = [
    {
      q: "Bulut POS sistemi internet kesildiğinde gerçekten çalışmaya devam eder mi?",
      a: "Evet. Cloud POS, çevrimdışı çalışma (offline redundancy) mimarisiyle tasarlanmıştır. İnternet koptuğu anda kasalarınız kilitlenmez, sipariş almaya ve adisyon basmaya devam edebilirsiniz. İnternet geri geldiğinde biriken tüm işlemler otomatik olarak arka planda bulut veritabanıyla senkronize edilir.",
    },
    {
      q: "Kendi donanımımı (tablet, telefon veya dokunmatik PC) kullanabilir miyim?",
      a: "Evet. PWA (Progressive Web App) standardı sayesinde ek donanım maliyetine katlanmanıza gerek yoktur. Mevcut iPad, Android tablet, akıllı telefon veya Windows masaüstü bilgisayarlarınızı anında birer garson terminali veya kasa ekranına dönüştürebilirsiniz.",
    },
    {
      q: "Kurulum süreci ne kadar sürer ve teknik destek ücretli mi?",
      a: "Bulut tabanlı mimarimiz sayesinde kurulum dakikalar içinde tamamlanır. Herhangi bir yerel sunucu kurulumu veya kablolama gerekmez. Teknik destek ve güncellemeler tamamen ücretsizdir ve buluttan anında cihazlarınıza yansıtılır.",
    },
    {
      q: "Çoklu şube ve franchise yönetimi destekleniyor mu?",
      a: "Evet. Tek bir yönetici hesabından tüm şubelerinizin ciro, stok, personel ve menü yönetimini merkezi olarak yapabilirsiniz. Şubeler arası malzeme transferi ve anlık performans karşılaştırmaları tek ekrandan izlenebilir.",
    },
  ];

  // Simulator Actions
  const addToCart = (item: { id: string; name: string; price: number }) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.id === id) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean) as CartItem[];
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    if (isOnline) {
      const orderTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
      setTotalSales(prev => prev + orderTotal);
      setCart([]);
      
      // Animate receipt print effect
      if (receiptRef.current) {
        gsap.fromTo(receiptRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.5)" }
        );
        gsap.to(receiptRef.current, {
          opacity: 0,
          y: -20,
          delay: 2.2,
          duration: 0.4
        });
      }
    } else {
      setOfflineQueue(prev => [...prev, [...cart]]);
      setCart([]);
      
      gsap.fromTo(".offline-alert",
        { scale: 0.95, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3 }
      );
    }
  };

  // Sync Offline Queue when internet restores
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      setIsSyncing(true);
      
      const timer = setTimeout(() => {
        const queuedTotal = offlineQueue.reduce((sum, order) => {
          return sum + order.reduce((oSum, item) => oSum + item.price * item.quantity, 0);
        }, 0);
        
        setTotalSales(prev => prev + queuedTotal);
        setOfflineQueue([]);
        setIsSyncing(false);
        setJustSynced(true);
        
        setTimeout(() => setJustSynced(false), 3000);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isOnline, offlineQueue]);

  // GSAP Animations setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);

      // Hero line-masked staggers
      gsap.fromTo(".hero-title-line",
        { y: "100%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 0.8, stagger: 0.12, ease: "power4.out" }
      );

      // Other hero staggers
      gsap.fromTo(headerRef.current, 
        { y: -30, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.5, delay: 0.4 }
      );

      gsap.fromTo(heroSubRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.6 }
      );

      gsap.fromTo(heroCtasRef.current,
        { opacity: 0, scale: 0.98 },
        { opacity: 1, scale: 1, duration: 0.5, delay: 0.7 }
      );

      // Initial simulator load transition
      gsap.fromTo(simulatorCardRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.9, delay: 0.5, ease: "power3.out" }
      );

      // 3D Scroll-Linked rotation for Simulator Card
      gsap.to(simulatorCardRef.current, {
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        scale: 1,
        scrollTrigger: {
          trigger: "#urun",
          start: "top top",
          end: "bottom center",
          scrub: 1
        }
      });

      // Drifting organic background blobs
      gsap.to(".blob-1", { x: "120px", y: "60px", duration: 12, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".blob-2", { x: "-140px", y: "90px", duration: 15, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".blob-3", { x: "80px", y: "-100px", duration: 13, repeat: -1, yoyo: true, ease: "sine.inOut" });

      // Scroll animations
      if (contentSectionRef.current) {
        gsap.fromTo(contentSectionRef.current.children,
          { opacity: 0, y: 35 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.7,
            scrollTrigger: {
              trigger: contentSectionRef.current,
              start: "top 80%"
            }
          }
        );
      }

      if (showcaseSectionRef.current) {
        gsap.fromTo(showcaseSectionRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.8,
            scrollTrigger: {
              trigger: showcaseSectionRef.current,
              start: "top 75%"
            }
          }
        );
      }
    }
  }, []);

  // Magnetic button helpers
  useEffect(() => {
    const applyMagnetic = (btn: HTMLAnchorElement | null) => {
      if (!btn) return;
      
      const onMouseMove = (e: MouseEvent) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        gsap.to(btn, {
          x: x * 0.28,
          y: y * 0.28,
          duration: 0.3,
          ease: "power2.out"
        });
      };

      const onMouseLeave = () => {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.4,
          ease: "elastic.out(1, 0.3)"
        });
      };

      btn.addEventListener("mousemove", onMouseMove);
      btn.addEventListener("mouseleave", onMouseLeave);

      return () => {
        btn.removeEventListener("mousemove", onMouseMove);
        btn.removeEventListener("mouseleave", onMouseLeave);
      };
    };

    const cleanup1 = applyMagnetic(magneticButton1.current);
    const cleanup2 = applyMagnetic(magneticButton2.current);

    return () => {
      cleanup1?.();
      cleanup2?.();
    };
  }, []);

  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900 flex flex-col antialiased relative overflow-x-hidden">
      
      {/* Drifting Organic Fluid Mesh Backdrop Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="blob-1 absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-rose-100/40 blur-[130px]"></div>
        <div className="blob-2 absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-amber-100/40 blur-[130px]"></div>
        <div className="blob-3 absolute top-[35%] left-[25%] w-[45%] h-[45%] rounded-full bg-indigo-100/30 blur-[140px]"></div>
      </div>

      {/* Premium Translucent Light Header */}
      <header 
        ref={headerRef}
        className="sticky top-0 z-50 transition-all duration-300 w-full bg-white/75 backdrop-blur-xl border-b border-slate-200/50"
      >
        <nav className="flex justify-between items-center w-full px-6 md:px-12 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2 cursor-pointer" href="/">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md">
                <span className="font-extrabold text-xs">CP</span>
              </div>
              {siteName}
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer" href="#urun">
                Ürün
              </a>
              <a className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" href="#moduller">
                Modüller
              </a>
              <a className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" href="#ekranlar">
                Ekranlar
              </a>
              <a className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" href="#sss">
                SSS
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher locale={locale} label="Dil" compact />
            <Link className="hidden sm:block text-xs font-bold text-slate-500 hover:text-slate-900 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer" href="/demo">
              Demo
            </Link>
            <Link className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-sm cursor-pointer" href="/login">
              Operasyon Paneli
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-grow z-10 relative">
        
        {/* Hero Section with Live POS Simulator & Showcase Animations */}
        <section className="relative py-16 lg:py-24 px-6 md:px-12 max-w-7xl mx-auto" id="urun">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-16 lg:gap-12 items-center">
            
            {/* Hero Left Content with Masked Reveals */}
            <div className="space-y-6 text-left max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">
                <WifiOff className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                Çevrimdışı Çalışma Garantisi
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.15] tracking-tight">
                <div className="overflow-hidden py-1">
                  <span className="hero-title-line block">İnternet Kopsa Bile</span>
                </div>
                <div className="overflow-hidden py-1">
                  <span className="hero-title-line block">Satış Yapmaya</span>
                </div>
                <div className="overflow-hidden py-1">
                  <span className="hero-title-line block text-amber-600">Devam Edin.</span>
                </div>
              </h1>

              <p 
                ref={heroSubRef}
                className="text-base text-slate-600 leading-relaxed"
              >
                Bulut POS sistemlerinin en büyük zayıflığı internet kesintileridir. Cloud POS, PWA altyapısı sayesinde bağlantı koptuğu anda lokalde çalışmaya devam eder ve online olduğunda otomatik senkronize olur.
              </p>
              
              <div 
                ref={heroCtasRef}
                className="flex flex-wrap gap-4 pt-4"
              >
                <Link 
                  ref={magneticButton1}
                  className="bg-slate-900 text-white hover:bg-slate-800 h-12 flex items-center justify-center px-8 rounded-xl font-bold text-xs cursor-pointer shadow-md transition-colors" 
                  href="/login"
                >
                  Operasyon Paneli Giriş
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
                <Link 
                  ref={magneticButton2}
                  className="h-12 flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-8 rounded-xl font-bold text-xs transition-all cursor-pointer" 
                  href="/demo"
                >
                  Demo Ekranları Gör
                </Link>
              </div>
              
              {leadStatus && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Görüşme talebiniz başarıyla kaydedilmiştir.
                </div>
              )}
            </div>
            
            {/* Hero Right Content: Live POS Simulator with 3D Scroll Rotation */}
            <div className="w-full relative">
              {/* Receipt printer mockup slot */}
              <div className="absolute top-16 right-6 w-44 z-0 pointer-events-none">
                <div 
                  ref={receiptRef}
                  className="bg-white border-x border-b border-slate-200 p-3 shadow-md rounded-b-lg text-[10px] font-mono space-y-2 opacity-0 transform translate-y-4"
                >
                  <p className="text-center font-bold border-b border-slate-100 pb-1">CLOUD POS FİŞ</p>
                  <div className="space-y-1">
                    <p>1x Latte Macchiato - 120₺</p>
                    <p>1x Butter Croissant - 90₺</p>
                  </div>
                  <p className="border-t border-slate-100 pt-1 font-bold flex justify-between">
                    <span>Toplam:</span> <span>210₺</span>
                  </p>
                  <p className="text-[8px] text-slate-400 text-center">İşlem Başarılı ✓</p>
                </div>
              </div>

              {/* Cashier Terminal Shell with initial 3D transforms */}
              <div 
                ref={simulatorCardRef}
                style={{ 
                  transformStyle: "preserve-3d", 
                  perspective: "1000px", 
                  transform: "rotateX(18deg) rotateY(-14deg) rotateZ(4deg) scale(0.94)" 
                }}
                className="relative z-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl flex flex-col space-y-4 max-w-lg mx-auto transition-shadow hover:shadow-slate-350 duration-500"
              >
                {/* Terminal Header / Status Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span>
                    <span className="text-xs font-bold text-slate-800">Kasa Terminali Simulatorü</span>
                  </div>
                  
                  {/* Connection Status Button */}
                  <button 
                    onClick={() => setIsOnline(!isOnline)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
                      isOnline 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' 
                        : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {isOnline ? (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                        İnternet: Aktif
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                        İnternet: Kesik
                      </>
                    )}
                  </button>
                </div>

                {/* Main POS Interface Grid */}
                <div className="grid grid-cols-[1.1fr_0.9fr] gap-4 h-64">
                  {/* Product Catalog Column */}
                  <div className="grid grid-cols-2 gap-2 content-start">
                    {menuItems.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-left space-y-1.5 cursor-pointer"
                      >
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] font-semibold text-slate-500">{item.price} ₺</p>
                      </button>
                    ))}
                  </div>

                  {/* Active Ticket / Receipt Column */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 flex flex-col justify-between">
                    <div className="space-y-2 overflow-y-auto max-h-36 pr-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Açık Adisyon</p>
                      {cart.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center">Sepet boş</p>
                      ) : (
                        <div className="space-y-1.5">
                          {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <div>
                                <p className="font-bold text-slate-800 truncate max-w-[90px]">{item.name}</p>
                                <p className="text-[10px] text-slate-400">{item.price * item.quantity} ₺</p>
                              </div>
                              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                                <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"><Minus className="w-2.5 h-2.5" /></button>
                                <span className="text-[10px] font-bold w-3 text-center">{item.quantity}</span>
                                <button onClick={() => addToCart(item)} className="p-0.5 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"><Plus className="w-2.5 h-2.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-2 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span>Adisyon Toplamı:</span>
                        <span>{cartSubtotal} ₺</span>
                      </div>
                      <button 
                        disabled={cart.length === 0}
                        onClick={handleCheckout}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-200 disabled:text-slate-400 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                      >
                        Adisyon Kapat ve Öde
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dashboard Metrics Simulator Footer */}
                <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px]">
                  <div>
                    <p className="text-slate-400 font-semibold">Toplam Ciro (Bulut DB)</p>
                    <p className="text-sm font-extrabold text-slate-800">{totalSales} ₺</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold text-right">Lokal Kuyruk</p>
                    <p className="text-sm font-extrabold text-slate-800 text-right">{offlineQueue.length} adet</p>
                  </div>
                </div>

                {/* Alerts Layer inside simulator */}
                {offlineQueue.length > 0 && !isOnline && (
                  <div className="offline-alert rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Çevrimdışı Mod Aktif</p>
                      <p className="text-[10px] text-amber-700 mt-0.5">Sipariş lokal belleğe kaydedildi. Bağlantı geldiğinde otomatik eşitlenecektir.</p>
                    </div>
                  </div>
                )}

                {isSyncing && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                    <p className="font-bold">Lokal veriler buluta senkronize ediliyor...</p>
                  </div>
                )}

                {justSynced && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <p className="font-bold">Kuyruk Başarıyla Eşleşti! Ciro güncellendi.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Sections - Clean & Asymmetric layouts (Eliminating generic grids) */}
        <section className="py-20 max-w-7xl mx-auto px-6 md:px-12" id="moduller">
          <div className="text-center mb-20 space-y-4">
            <span className="text-amber-800 text-xs font-bold uppercase tracking-widest">Özel Çözümler</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Kafenin Tüm Süreci Tek Panelde</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-xs leading-relaxed">Şablon tasarımlardan uzak, her detayı kafe ve restoran operasyonları için özel olarak kodlanmış araçlar.</p>
          </div>
          
          <div 
            ref={contentSectionRef}
            className="space-y-16"
          >
            {/* Story Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Çevrimdışı Kasa ve Adisyon</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  İnternet arızaları restoranlarda servis akışını durduran en büyük krizdir. Cloud POS lokal önbellek katmanı sayesinde bağlantı koptuğunda kilitlenmez, adisyon yazıcılarına veri aktarmayı sürdürür.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#F4F2EE]/40 p-6 flex items-center justify-center">
                <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 shadow-md">
                  <Image 
                    className="w-full h-auto"
                    alt="POS Garson Sipariş Ekranı"
                    src="/landing-assets/mobil-pos-siparis.png"
                    width={390}
                    height={844}
                  />
                </div>
              </div>
            </div>

            {/* Story Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center md:grid-flow-col-dense">
              <div className="md:col-start-2 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <ChefHat className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Mutfak Otomasyon Ekranı (KDS)</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Garson terminallerinden girilen veya self-servis QR siparişlerden gelen veriler anlık hazırlık istasyonlarına (Barista, Fırın) bölünerek mutfak ekranına düşer. Siparişler gecikmeden masalara ulaşır.
                </p>
              </div>
              <div className="md:col-start-1 rounded-2xl border border-slate-200 bg-[#F4F2EE]/40 p-6 flex items-center justify-center">
                <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 shadow-md">
                  <Image 
                    className="w-full h-auto"
                    alt="Canlı Kasa Takip Ekranı"
                    src="/landing-assets/operasyon-paneli-mobil.png"
                    width={390}
                    height={844}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Solutions Links */}
        <section className="py-20 max-w-7xl mx-auto px-6 md:px-12 border-t border-slate-200/50">
          <div className="mb-12">
            <span className="text-amber-800 text-xs font-bold uppercase tracking-widest">Sektörel Çözümler</span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">İşletmenize Özel POS Yapılandırması</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {primaryHomeSeoLandingPages.map((page) => (
              <Link 
                key={page.slug} 
                href={`/${page.slug}`} 
                className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:border-slate-350 transition-all cursor-pointer flex flex-col justify-between h-44"
              >
                <div>
                  <h4 className="text-base font-bold text-slate-900 mb-2">{page.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{page.description}</p>
                </div>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1">İncele <ArrowRight className="w-3.5 h-3.5" /></span>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ Area */}
        <section className="py-20 border-t border-slate-200/50 bg-[#F4F2EE]/20" id="sss">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight text-center mb-12">Karar Vermeden Önce Sık Sorulanlar</h2>
            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isActive = activeFaqIndex === index;
                return (
                  <div key={index} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <button 
                      onClick={() => setActiveFaqIndex(isActive ? null : index)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="text-sm font-bold text-slate-900">{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transform transition-transform ${isActive ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${isActive ? 'max-h-[200px] border-t border-slate-100' : 'max-h-0'}`}>
                      <p className="px-6 py-5 text-xs text-slate-500 leading-relaxed bg-slate-50/50">{faq.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white border-t border-slate-800 py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <Link className="text-base font-bold tracking-tight text-white flex items-center gap-2 cursor-pointer" href="/">
              <div className="w-6 h-6 rounded bg-white text-slate-900 flex items-center justify-center font-extrabold text-[10px]">Q</div>
              {siteName}
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">Bulut tabanlı, lokal hızında çevrimdışı çalışabilen modern kafe ve restoran otomasyon sistemi.</p>
          </div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-6">Kurumsal</h5>
            <ul className="space-y-4 text-xs">
              <li><Link className="text-slate-400 hover:text-white cursor-pointer" href="#">Hakkımızda</Link></li>
              <li><Link className="text-slate-400 hover:text-white cursor-pointer" href="#">İletişim</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-6">Yasal</h5>
            <ul className="space-y-4 text-xs">
              <li><Link className="text-slate-400 hover:text-white cursor-pointer" href="#">Gizlilik Sözleşmesi</Link></li>
              <li><Link className="text-slate-400 hover:text-white cursor-pointer" href="#">Kullanıcı Koşulları</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-6">İletişim</h5>
            <p className="text-xs text-slate-400">Destek: {phone}</p>
            <p className="text-xs text-slate-400 mt-2">E-posta: {supportEmail}</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-16 pt-8 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <p>© 2026 {siteName}. Tüm hakları saklıdır.</p>
          <p className="flex items-center gap-1">Handcrafted with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for cafe operators.</p>
        </div>
      </footer>
    </div>
  );
}

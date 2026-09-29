# 🧙 Hangi Fantastik Karaktersin?

Fotoğrafını yükle, 11 kadim soruyu cevapla ve içindeki fantastik kahramanı keşfet!
Oyun, cevaplarına ve fotoğrafının aura rengine göre sana bir sınıf, özellik puanları ve
**fotoğrafından üretilmiş stilize bir kahraman portresi** içeren paylaşılabilir bir kart verir.

**▶️ Oyna:** https://antonybo056.github.io/whichCharacter/

```
YOUR CHARACTER

🧙 KARA BÜYÜCÜ · DARK MAGE

Power         39
Intelligence  93
Speed         59
Magic         98
Defense       36
Charisma      57
```

## Özellikler

- **10 sınıf:** Kara Büyücü, Kutsal Şövalye, Elf Okçu, Barbar Savaşçı, Gölge Suikastçı, Kadim Druid,
  Ejderha Şövalyesi, Buz Cadısı, Büyülü Ozan, Nekromant
- **11 soru:** "Cesur musun?", "Risk alır mısın?", "Yalnız çalışmayı sever misin?", kaydırmalı
  "Hız mı, güç mü?" sorusu ve daha fazlası
- **6 özellik:** Güç, Zeka, Hız, Büyü, Dayanıklılık, Karizma — çubuklar ve radar grafiğiyle
- **Fotoğraftan portre:** yüz bulunur (tarayıcı destekliyorsa), fotoğraf sınıfın renk paletine göre
  boyanır, mürekkep çizgileri eklenir ve sınıfa özel efektler (rünler, alevler, kar, yapraklar,
  ruhlar, notalar…) çizilir
- **Aura analizi:** fotoğrafın baskın rengi bir aura belirler ve sonucu hafifçe etkiler
- **Nadirlik ve güç seviyesi:** Nadir, Destansı, Efsanevi, Mitik
- **Ruh haritası:** diğer sınıflarla uyum yüzdelerin
- **Paylaşım:** kartı PNG olarak indir, telefondan doğrudan paylaş veya sonucunu gösteren linki kopyala
- **Kamera desteği**, sürükle-bırak, klavye kısayolları (1–6), mobil uyumlu tasarım

## Gizlilik

Fotoğrafın hiçbir sunucuya yüklenmez; tüm işlem tarayıcında, `<canvas>` üzerinde yapılır.
Paylaşılan linklerde yalnızca sınıf, isim ve puanlar bulunur, fotoğraf bulunmaz.

## Yerelde çalıştırma

Derleme adımı yoktur. Klasörü herhangi bir statik sunucuyla açman yeterli:

```bash
npx serve .
# veya
python -m http.server 8000
```

> Kamera özelliği yalnızca `https` veya `localhost` üzerinde çalışır.

## Proje yapısı

```
index.html        Ekranlar (giriş, fotoğraf, sorular, ritüel, sonuç)
css/style.css     Tema ve animasyonlar
js/data.js        Sınıflar, sorular, özellikler, auralar
js/portrait.js    Fotoğraf analizi, portre stilizasyonu, kart çizimi
js/app.js         Oyun akışı, puanlama, paylaşım
```

Yeni bir sınıf eklemek için `js/data.js` içindeki `CLASSES` nesnesine bir giriş ekleyip
sorulardaki seçeneklerin `w` (sınıf puanı) alanlarında o sınıfa puan vermen yeterli.

## Lisans

MIT

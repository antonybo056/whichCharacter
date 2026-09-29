'use strict';

/* Oyun içeriği: özellikler, sınıflar, sorular ve aura eşleşmeleri. */

const STATS = [
  { key: 'power',    label: 'Güç',          en: 'Power',        icon: '💪', epithet: 'Dağları Yaran' },
  { key: 'intel',    label: 'Zeka',         en: 'Intelligence', icon: '🧠', epithet: 'Yıldızları Okuyan' },
  { key: 'speed',    label: 'Hız',          en: 'Speed',        icon: '⚡', epithet: 'Rüzgârın Gölgesi' },
  { key: 'magic',    label: 'Büyü',         en: 'Magic',        icon: '✨', epithet: 'Kadim Alevin Taşıyıcısı' },
  { key: 'defense',  label: 'Dayanıklılık', en: 'Defense',      icon: '🛡️', epithet: 'Yıkılmaz Kale' },
  { key: 'charisma', label: 'Karizma',      en: 'Charisma',     icon: '👑', epithet: 'Kalplerin Fatihi' },
];

const RARITIES = [
  { min: 455, name: 'Mitik',    en: 'Mythic',    color: '#ff5d8f' },
  { min: 425, name: 'Efsanevi', en: 'Legendary', color: '#ffb640' },
  { min: 395, name: 'Destansı', en: 'Epic',      color: '#b77cff' },
  { min: 0,   name: 'Nadir',    en: 'Rare',      color: '#5aa9ff' },
];

const CLASSES = {
  mage: {
    name: 'Kara Büyücü', en: 'Dark Mage', emoji: '🧙',
    ramp: ['#050208', '#2c0f52', '#8a3ffc', '#f3e3ff'], accent: '#b77cff', particles: 'runes',
    base: { power: 45, intel: 90, speed: 58, magic: 95, defense: 42, charisma: 62 },
    desc: 'Yasak kütüphanelerin tozlu raflarında büyüdün. Gücü kaslarda değil, kelimelerde ve yıldızların arasındaki sessizlikte ararsın. İnsanlar senden biraz korkar — ve bu açıkçası hoşuna gider.',
    motto: 'Bilgi, en keskin bıçaktır.',
    ability: { name: 'Karanlık Tekillik', text: 'Savaş alanının ortasında minik bir kara delik açar, düşmanların büyülerini yutar ve onları sana karşı çevirir.' },
    weapon: 'Obsidyen Rün Asası', element: 'Gölge & Boşluk', companion: 'Üç gözlü kuzgun Nyx',
    strengths: ['Stratejik deha', 'Yıkıcı büyüler', 'Kadim bilgi'],
    weakness: 'Yakın dövüşte kırılgansın ve bazen harekete geçmek yerine fazla düşünürsün.',
  },
  paladin: {
    name: 'Kutsal Şövalye', en: 'Paladin', emoji: '🛡️',
    ramp: ['#0d0a04', '#5a4312', '#e2b64a', '#fffbe8'], accent: '#ffd166', particles: 'rays',
    base: { power: 80, intel: 65, speed: 48, magic: 60, defense: 92, charisma: 78 },
    desc: 'Sözün senettir. Zayıfları korumak için yemin ettin ve o yemini asla bozmazsın. Karanlık ne kadar büyük olursa olsun, sen onun karşısında dimdik duran ışıksın.',
    motto: 'Işık, en karanlık gecede bile yolunu bulur.',
    ability: { name: 'Güneşin Yemini', text: 'Kalkanını yere vurarak tüm müttefiklerini altın bir kubbeyle korur ve yaralarını iyileştirir.' },
    weapon: 'Şafak Kılıcı & Kutsal Kalkan', element: 'Işık', companion: 'Beyaz savaş atı Aurelion',
    strengths: ['Sarsılmaz irade', 'Doğal liderlik', 'Koruyucu aura'],
    weakness: 'Kurallara fazla bağlısın; esnemek ve gri alanları kabul etmek sana zor gelir.',
  },
  ranger: {
    name: 'Elf Okçu', en: 'Elven Ranger', emoji: '🏹',
    ramp: ['#020a05', '#16502b', '#58c46b', '#eaffdf'], accent: '#7ee081', particles: 'leaves',
    base: { power: 58, intel: 72, speed: 92, magic: 50, defense: 55, charisma: 60 },
    desc: 'Rüzgârın yönünü okur, bir yaprağın düşüşünü duyarsın. Ormanın sessiz koruyucususun; oklarının hedefini şaşırdığı hiç görülmedi.',
    motto: 'Sabır, en iyi ok ucudur.',
    ability: { name: 'Yüz Ok Yağmuru', text: 'Tek bir nefeste gökyüzüne yüz ok salar; her biri kendi hedefini bulur.' },
    weapon: 'Ay Işığı Yayı', element: 'Rüzgâr', companion: 'Gümüş tilki Sylva',
    strengths: ['Keskin gözler', 'Çeviklik', 'Hayatta kalma ustalığı'],
    weakness: 'Güvenmekte zorlanırsın; yabancılara karşı hep bir adım mesafelisin.',
  },
  berserker: {
    name: 'Barbar Savaşçı', en: 'Berserker', emoji: '🪓',
    ramp: ['#0f0302', '#6b1409', '#f0522a', '#ffe7c9'], accent: '#ff6b3d', particles: 'embers',
    base: { power: 96, intel: 45, speed: 68, magic: 20, defense: 85, charisma: 55 },
    desc: 'Plan mı? Plan sensin. Savaş narası attığında dağlar titrer, düşmanlar kaçacak yer arar. Kalbin bir yanardağ gibi atar ve asla geri adım atmazsın.',
    motto: 'Geri çekilmek mi? O kelimeyi hiç duymadım.',
    ability: { name: 'Kızıl Öfke', text: 'Öfkeni serbest bırakırsın; on saniye boyunca acı hissetmez ve iki kat güçle saldırırsın.' },
    weapon: 'Çift ağızlı balta “Gökgürültüsü”', element: 'Ateş & Öfke', companion: 'Dev kurt Fenrik',
    strengths: ['Durdurulamaz güç', 'Korkusuzluk', 'Demir gibi beden'],
    weakness: 'Önce vurup sonra düşünürsün — bazen sıranın tersi daha iyi olurdu.',
  },
  assassin: {
    name: 'Gölge Suikastçı', en: 'Shadow Assassin', emoji: '🗡️',
    ramp: ['#020308', '#10213f', '#3f7fd1', '#dff1ff'], accent: '#5aa9ff', particles: 'smoke',
    base: { power: 62, intel: 75, speed: 96, magic: 35, defense: 45, charisma: 58 },
    desc: 'Kimse seni gelirken görmez; sadece gittiğini fark ederler. Sessizlik senin dilin, gölgeler senin evin. Her hareketin hesaplı, her adımın bir amacı var.',
    motto: 'Sessizlik, en ölümcül silahtır.',
    ability: { name: 'Gölge Adımı', text: 'Bir gölgeden diğerine anında ışınlanır ve düşmanının tam arkasında belirirsin.' },
    weapon: 'Zehirli İkiz Hançerler', element: 'Gölge & Zehir', companion: 'Görünmez kara kedi Umbra',
    strengths: ['Işık hızında refleks', 'Kusursuz gizlilik', 'Soğukkanlılık'],
    weakness: 'Duygularını saklamakta o kadar iyisin ki bazen sen bile bulamıyorsun.',
  },
  druid: {
    name: 'Kadim Druid', en: 'Druid', emoji: '🌿',
    ramp: ['#070803', '#3b3a14', '#9bb04a', '#f7f5d6'], accent: '#b5d65a', particles: 'fireflies',
    base: { power: 55, intel: 80, speed: 55, magic: 82, defense: 70, charisma: 65 },
    desc: 'Ağaçlar sana sırlarını fısıldar, hayvanlar senin dilini konuşur. Doğanın dengesini korursun; gerektiğinde bir ayıya, gerektiğinde bir kartala dönüşürsün.',
    motto: 'Her tohum, bir ormanın rüyasını taşır.',
    ability: { name: 'Kadim Kökler', text: 'Toprağın derinliklerinden dev kökler çağırır, düşmanları sarmalar ve müttefiklerini iyileştirirsin.' },
    weapon: 'Yaşayan Meşe Asası', element: 'Toprak & Yaşam', companion: 'Bilge baykuş Orin',
    strengths: ['Şekil değiştirme', 'İyileştirme', 'Sonsuz sabır'],
    weakness: 'Şehirlerde ve kalabalıkta gücünü kaybeder, çabuk yorulursun.',
  },
  dragon: {
    name: 'Ejderha Şövalyesi', en: 'Dragon Knight', emoji: '🐉',
    ramp: ['#0e0303', '#5c0f14', '#d8402a', '#ffe6a8'], accent: '#ff8f3a', particles: 'fire',
    base: { power: 92, intel: 62, speed: 60, magic: 58, defense: 88, charisma: 72 },
    desc: 'Bir ejderhayla bağ kurmak için ateşten geçtin ve yanmadın. Gökyüzü senin savaş alanın, ejderhanın kanatları senin kalkanın. Nereye gitsen efsaneler peşinden gelir.',
    motto: 'Gökyüzü sınır değil, başlangıçtır.',
    ability: { name: 'Ejderha Nefesi', text: 'Ejderhanla birleşir, gökyüzünden alev yağdırarak koca bir orduyu tek başına durdurursun.' },
    weapon: 'Ejderha Pulu Mızrak', element: 'Ateş & Gök', companion: 'Kızıl ejderha Pyraxis',
    strengths: ['Muazzam güç', 'Cesaret', 'Gökyüzü hâkimiyeti'],
    weakness: 'Gururun bazen seni gereksiz risklere sokar.',
  },
  frost: {
    name: 'Buz Cadısı', en: 'Frost Witch', emoji: '❄️',
    ramp: ['#02060c', '#133a5c', '#6fc3f0', '#f4fdff'], accent: '#8fe3ff', particles: 'snow',
    base: { power: 42, intel: 85, speed: 62, magic: 92, defense: 58, charisma: 70 },
    desc: 'Kalbin buz gibi değil — sadece çok derin. Sakinliğin fırtınadan önceki sessizlik gibi. Tek bir bakışınla nehirleri dondurur, zamanı yavaşlatırsın.',
    motto: 'Buz sabırlıdır; en sert kayayı bile çatlatır.',
    ability: { name: 'Mutlak Sıfır', text: 'Etrafındaki her şeyi zamanda dondurursun; yalnızca sen ve müttefiklerin hareket edebilirsiniz.' },
    weapon: 'Kristal Asa “Kışyıldızı”', element: 'Buz', companion: 'Kar leoparı Isveil',
    strengths: ['Soğukkanlı zeka', 'Kontrol büyüleri', 'Zarafet'],
    weakness: 'Başkalarına soğuk ve ulaşılmaz görünebilirsin.',
  },
  bard: {
    name: 'Büyülü Ozan', en: 'Bard', emoji: '🎻',
    ramp: ['#0c030a', '#56164f', '#e0569e', '#fff0f6'], accent: '#ff7ac0', particles: 'notes',
    base: { power: 40, intel: 78, speed: 70, magic: 68, defense: 45, charisma: 97 },
    desc: 'Bir şarkıyla savaşları başlatır, bir ezgiyle bitirirsin. Her meyhanede bir hikâyen, her şehirde bir hayranın var. Kelimeler ve melodiler senin büyün.',
    motto: 'Her kahramanın bir ozana ihtiyacı vardır.',
    ability: { name: 'Kahramanlar Baladı', text: 'Destansı bir şarkı söylersin; müttefiklerin güç ve cesaret kazanır, düşmanlar ise dans etmeden duramaz.' },
    weapon: 'Büyülü Lavta “Yıldızsesi”', element: 'Ses & Büyü', companion: 'Konuşan papağan Maestro',
    strengths: ['Karizma', 'İkna yeteneği', 'Takım ruhu'],
    weakness: 'Dikkatin kolay dağılır; sıkıcı işlerden kaçmanın bir yolunu hep bulursun.',
  },
  necro: {
    name: 'Nekromant', en: 'Necromancer', emoji: '💀',
    ramp: ['#020604', '#123a24', '#4fd18b', '#e6fff0'], accent: '#5cf0a0', particles: 'souls',
    base: { power: 50, intel: 92, speed: 45, magic: 90, defense: 60, charisma: 40 },
    desc: 'Ölüm senin için bir son değil, bir kapı. Ruhların fısıltılarını duyar, unutulmuş sırları geri çağırırsın. İnsanlar seni yanlış anlar; oysa sen sadece kimsenin bakmaya cesaret edemediği yere bakarsın.',
    motto: 'Ölüm sadece başka bir kapıdır.',
    ability: { name: 'Ruh Ordusu', text: 'Kadim savaşçıların ruhlarını uyandırır, yanında savaşan hayalet bir ordu çağırırsın.' },
    weapon: 'Kafatası Grimuarı', element: 'Ruh & Ölüm', companion: 'Hayalet kurt Morrow',
    strengths: ['Yasak bilgi', 'Ölümsüz irade', 'Ruh kontrolü'],
    weakness: 'Yalnızlığa fazla alışkınsın; insanlara açılmak sana zor gelir.',
  },
};

/*
 * Her seçenek: e = emoji, t = metin, w = sınıf puanları, s = özellik bonusları.
 * type: 'slider' olan soru 0 (hız) ile 100 (güç) arasında değer alır.
 */
const QUESTIONS = [
  {
    icon: '🦁', title: 'Cesur musun?',
    sub: 'Karanlık bir mağaranın girişindesin. İçeriden derin bir kükreme yankılanıyor…',
    options: [
      { e: '⚔️', t: 'Kılıcımı çeker, ilk ben dalarım!', w: { berserker: 3, dragon: 2, paladin: 1 }, s: { power: 4, defense: 2 } },
      { e: '📜', t: 'Önce bir plan yaparım, sonra girerim.', w: { mage: 2, frost: 1, necro: 1, ranger: 1 }, s: { intel: 4 } },
      { e: '🌑', t: 'Gölgelere karışır, sessizce sızarım.', w: { assassin: 3, ranger: 1 }, s: { speed: 4 } },
      { e: '📯', t: 'Ekibimi toplar, onlara cesaret veririm.', w: { paladin: 2, bard: 2, druid: 1 }, s: { charisma: 4 } },
    ],
  },
  {
    icon: '🎲', title: 'Risk alır mısın?',
    sub: 'Önünde iki kapı var: biri hazine dolu ama tuzaklı, diğeri güvenli ama belki bomboş.',
    options: [
      { e: '💰', t: 'Tuzak mı? Bayılırım. Hazine benim!', w: { berserker: 2, assassin: 2, dragon: 1 }, s: { speed: 2, power: 2 } },
      { e: '🔮', t: 'Tuzağı çözecek bir büyü bulurum.', w: { mage: 2, frost: 2, necro: 1 }, s: { magic: 4 } },
      { e: '🚪', t: 'Güvenli kapı. Bugün değil, ölüm.', w: { paladin: 2, druid: 2 }, s: { defense: 4 } },
      { e: '🗣️', t: 'Önce kapılarla pazarlık etmeyi denerim.', w: { bard: 3 }, s: { charisma: 3, intel: 1 } },
    ],
  },
  {
    icon: '🐺', title: 'Yalnız çalışmayı sever misin?',
    sub: 'Büyük bir görev seni bekliyor. Yanına kimi alırsın?',
    options: [
      { e: '🌒', t: 'Kimseyi. Yalnız kurt benim.', w: { assassin: 2, ranger: 2, necro: 1 }, s: { speed: 2, intel: 1 } },
      { e: '📚', t: 'Kulemde, kitaplarımla baş başa kalırım.', w: { mage: 3, necro: 1, frost: 1 }, s: { intel: 3, magic: 1 } },
      { e: '🦌', t: 'Doğa ve hayvanlar — insanlara gerek yok.', w: { druid: 3, ranger: 1 }, s: { magic: 2, defense: 1 } },
      { e: '🍻', t: 'Asla! Kalabalık, gürültülü bir ekip isterim.', w: { bard: 2, paladin: 2, dragon: 1 }, s: { charisma: 4 } },
    ],
  },
  {
    icon: '⚖️', title: 'Hız mı, güç mü?', type: 'slider',
    sub: 'Terazinin hangi tarafındasın? Kaydırarak dengeni bul.',
    left: '⚡ Hız', right: '💪 Güç',
  },
  {
    icon: '😤', title: 'Bir düşman seni aşağıladı. Ne yaparsın?',
    sub: 'Tüm meyhane susmuş, herkes sana bakıyor.',
    options: [
      { e: '👊', t: 'Orada, hemen hesaplaşırız.', w: { berserker: 3, dragon: 1 }, s: { power: 3 } },
      { e: '🕯️', t: 'Sessizce not alırım… intikam soğuk yenir.', w: { assassin: 2, necro: 2, mage: 1 }, s: { intel: 2, speed: 1 } },
      { e: '🕊️', t: 'Affederim, ama asla unutmam.', w: { paladin: 2, druid: 1, frost: 1 }, s: { defense: 2, charisma: 1 } },
      { e: '🎶', t: 'Hakkında bir şarkı yazar, tüm krallığa söylerim.', w: { bard: 3 }, s: { charisma: 3 } },
    ],
  },
  {
    icon: '🗺️', title: 'Hangi diyar seni çağırıyor?',
    sub: 'Haritada parmağının durduğu yer, kaderinin başladığı yer.',
    options: [
      { e: '🌲', t: 'Kadim, sisli bir orman', w: { druid: 2, ranger: 2 }, s: { speed: 1, magic: 1 } },
      { e: '🏰', t: 'Yıldızlara uzanan bir büyü kulesi', w: { mage: 2, frost: 1, necro: 1 }, s: { intel: 2 } },
      { e: '🌋', t: 'Volkanik dağlar ve ejderha yuvaları', w: { dragon: 3, berserker: 1 }, s: { power: 2 } },
      { e: '🏔️', t: 'Sonsuz, sessiz buzullar', w: { frost: 3 }, s: { magic: 2 } },
      { e: '🎪', t: 'Işıl ışıl şehirler ve festivaller', w: { bard: 3, assassin: 1 }, s: { charisma: 2 } },
      { e: '🪦', t: 'Terk edilmiş, sisli mezarlıklar', w: { necro: 3, assassin: 1 }, s: { magic: 1, intel: 1 } },
    ],
  },
  {
    icon: '⚔️', title: 'Bir silah seç.',
    sub: 'Demirci ustası tezgâhına altı efsanevi silah dizdi.',
    options: [
      { e: '🪓', t: 'Devasa bir savaş baltası', w: { berserker: 3 }, s: { power: 3 } },
      { e: '🪄', t: 'Rün işlemeli bir asa', w: { mage: 2, necro: 1, frost: 1 }, s: { magic: 3 } },
      { e: '🗡️', t: 'Zehirli çifte hançer', w: { assassin: 3 }, s: { speed: 3 } },
      { e: '🏹', t: 'Hafif bir elf yayı', w: { ranger: 3 }, s: { speed: 2, intel: 1 } },
      { e: '🛡️', t: 'Kutsal kalkan ve kılıç', w: { paladin: 3 }, s: { defense: 3 } },
      { e: '🔱', t: 'Ejderha pulundan mızrak', w: { dragon: 3 }, s: { power: 2, defense: 1 } },
    ],
  },
  {
    icon: '🌗', title: 'Gece mi, gündüz mü?',
    sub: 'Gücünün en yüksek olduğu an hangisi?',
    options: [
      { e: '🌅', t: 'Gün doğumu — ışık benimle.', w: { paladin: 2, druid: 1 }, s: { defense: 1, charisma: 1 } },
      { e: '🌌', t: 'Gece yarısı — karanlık benim evim.', w: { mage: 2, assassin: 2, necro: 2 }, s: { magic: 1, speed: 1 } },
      { e: '🌆', t: 'Alacakaranlık — ikisinin arasında.', w: { ranger: 2, bard: 1, frost: 1 }, s: { intel: 2 } },
      { e: '🔥', t: 'Fark etmez, yeter ki savaş olsun.', w: { berserker: 2, dragon: 2 }, s: { power: 2 } },
    ],
  },
  {
    icon: '🪞', title: 'Arkadaşların seni nasıl tanımlar?',
    sub: 'Dürüst ol, ayna yalan söylemez.',
    options: [
      { e: '🧠', t: 'Zeki ve biraz gizemli', w: { mage: 2, necro: 1, frost: 1 }, s: { intel: 3 } },
      { e: '🤝', t: 'Sadık ve koruyucu', w: { paladin: 2, dragon: 1, druid: 1 }, s: { defense: 3 } },
      { e: '🎭', t: 'Eğlenceli ve karizmatik', w: { bard: 3 }, s: { charisma: 3 } },
      { e: '🌪️', t: 'Hızlı ve öngörülemez', w: { assassin: 2, ranger: 1, berserker: 1 }, s: { speed: 3 } },
      { e: '🍃', t: 'Sakin ve bilge', w: { druid: 2, frost: 1 }, s: { magic: 2, intel: 1 } },
      { e: '❤️‍🔥', t: 'Ateşli ve tutkulu', w: { berserker: 2, dragon: 2 }, s: { power: 3 } },
    ],
  },
  {
    icon: '⏳', title: 'Sana ölümsüzlük teklif edilse?',
    sub: 'Gizemli bir yabancı, elinde parlayan bir iksir tutuyor.',
    options: [
      { e: '🧪', t: 'Kabul ederim, bedeli ne olursa olsun.', w: { necro: 3, mage: 1 }, s: { magic: 3 } },
      { e: '🌸', t: 'Reddederim — hayat sonlu olduğu için güzel.', w: { paladin: 2, druid: 2 }, s: { defense: 2, charisma: 1 } },
      { e: '🔍', t: 'Önce sözleşmenin ince yazılarını okurum.', w: { mage: 1, bard: 1, assassin: 1, frost: 1 }, s: { intel: 3 } },
      { e: '🐲', t: 'Ancak ejderham da ölümsüz olursa.', w: { dragon: 2, ranger: 1 }, s: { power: 2 } },
    ],
  },
  {
    icon: '💎', title: 'Son olarak: bir hazine seç.',
    sub: 'Kadim sandık açıldı. Sadece birini alabilirsin.',
    options: [
      { e: '📕', t: 'Yasak büyüler kitabı', w: { mage: 2, necro: 2 }, s: { magic: 4 } },
      { e: '🥚', t: 'Bir ejderha yumurtası', w: { dragon: 3 }, s: { power: 2, defense: 2 } },
      { e: '🧥', t: 'Görünmezlik pelerini', w: { assassin: 3 }, s: { speed: 4 } },
      { e: '🐺', t: 'Konuşan bir kurt dostu', w: { druid: 2, ranger: 2 }, s: { intel: 2, defense: 2 } },
      { e: '🔷', t: 'Asla erimeyen buz kristali', w: { frost: 3 }, s: { magic: 3 } },
      { e: '🪕', t: 'Kalpleri büyüleyen bir lavta', w: { bard: 3 }, s: { charisma: 4 } },
    ],
  },
];

/* Fotoğrafın baskın renginden aura; hafif bir sınıf bonusu verir. */
const AURAS = {
  shadow:   { name: 'Gölge',      color: '#7a7aa0', bonus: { assassin: 1.5, necro: 1.5, mage: 1 } },
  silver:   { name: 'Gümüş',      color: '#dfe6f0', bonus: { paladin: 1.5, frost: 1.5 } },
  mist:     { name: 'Sis',        color: '#9aa0ad', bonus: { assassin: 1, ranger: 1, mage: 1 } },
  crimson:  { name: 'Kızıl',      color: '#ff4d4d', bonus: { berserker: 1.5, dragon: 1.5 } },
  amber:    { name: 'Kehribar',   color: '#ff9a3d', bonus: { dragon: 1.5, berserker: 1, bard: 0.5 } },
  gold:     { name: 'Altın',      color: '#ffd24d', bonus: { paladin: 2, bard: 1 } },
  emerald:  { name: 'Zümrüt',     color: '#4ddc7a', bonus: { druid: 1.5, ranger: 1.5 } },
  teal:     { name: 'Turkuaz',    color: '#4de0d0', bonus: { frost: 1.5, necro: 1 } },
  sapphire: { name: 'Safir',      color: '#4d8bff', bonus: { frost: 1.5, assassin: 1 } },
  amethyst: { name: 'Ametist',    color: '#a64dff', bonus: { mage: 2, necro: 0.5 } },
  rose:     { name: 'Gül',        color: '#ff4da6', bonus: { bard: 2, mage: 0.5 } },
};

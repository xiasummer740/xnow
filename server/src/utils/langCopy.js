// ============================================================================
// 🌏 多语种落地页文案表
//
// 为什么单独一个文件：
//   seo.js 原本把中文文案写死在各个 route 里，加英文时又整份复制了一遍。
//   再加印尼语、葡语就是第三、第四份重复代码，改一处要改四处 —— 必漂移。
//   这里把「每种语言要说的那些话」集中成数据，渲染逻辑只认 key。
//
// 只覆盖**需要被搜索引擎读到**的落地页文案（首页 / 价格表 / 平台页）。
// 站内 UI（登录后）不在范围内，那是前端 i18n 的事。
//
// 选这两个语种的原因（2026-11-08 定）：
//   id 印尼 — 东南亚最大增量市场，TikTok 用户量全球前列，本地语言搜索竞争极低
//   pt 巴西 — 拉美最大市场，葡语搜索里几乎没有同质站点在争
// ============================================================================

/** 各语种的标识与 hreflang 值 */
export const LANGS = {
  zh: { code: 'zh-CN', locale: 'zh_CN', dir: 'ltr', path: '' },
  en: { code: 'en', locale: 'en_US', dir: 'ltr', path: '/en' },
  id: { code: 'id', locale: 'id_ID', dir: 'ltr', path: '/id' },
  pt: { code: 'pt-BR', locale: 'pt_BR', dir: 'ltr', path: '/pt' },
  vi: { code: 'vi', locale: 'vi_VN', dir: 'ltr', path: '/vi' },
  // ⚠️ 阿拉伯语是 RTL：<html dir="rtl">，页面样式也要跟着镜像。
  ar: { code: 'ar', locale: 'ar_SA', dir: 'rtl', path: '/ar' },
  ru: { code: 'ru', locale: 'ru_RU', dir: 'ltr', path: '/ru' },
};

/** 支持的语言顺序（hreflang 里按这个顺序输出） */
export const LANG_ORDER = ['zh', 'en', 'id', 'pt', 'vi', 'ar', 'ru'];

const C = {
  // ── 印尼语 ──────────────────────────────────────────────────────────
  id: {
    home: {
      title: (b) => `${b} - Panel Pertumbuhan Media Sosial, Harga Mulai ¥0,03`,
      h1: (b) => `${b} · Panel Pertumbuhan Media Sosial`,
      lede: (b, names, cheapest) =>
        `${b} menyediakan pengikut, suka, tayangan, dan komentar untuk ${names}. Harga mulai <b>¥${cheapest} per 1.000</b>, pengiriman otomatis, tanpa perlu kata sandi akun.`,
      platformsHead: 'Platform dan harga awal',
      thPlatform: 'Platform',
      thFrom: 'Mulai dari',
      thServices: 'Layanan',
      faqHead: 'Pertanyaan umum',
      cta: 'Mulai pesan →',
      foot: (b) => `${b} · pengiriman otomatis · bayar sesuai pemakaian`,
      thTypes: 'Jenis',
      faq: (cheapest, total) => [
        { q: 'Bagaimana cara menghitung harganya?', a: `Semua layanan dihitung per 1.000 unit. Masukkan jumlah yang dibutuhkan, halaman pesanan akan menampilkan total sebelum Anda kirim. Harga mulai ¥${cheapest} per 1.000 dan berbeda menurut kualitas serta kecepatan.` },
        { q: 'Apakah perlu memberikan kata sandi akun?', a: 'Tidak. Cukup tautan profil publik atau nama pengguna. Kami tidak pernah meminta kredensial login.' },
        { q: 'Kapan pesanan mulai diproses?', a: 'Pesanan diproses otomatis setelah dikirim. Status setiap pesanan bisa dilihat di riwayat pesanan, dan pesanan yang tidak selesai akan dikembalikan dananya.' },
        { q: 'Platform apa saja yang didukung?', a: 'TikTok, Instagram, YouTube, Telegram, Facebook, X (Twitter) dan lainnya. Setiap halaman platform mencantumkan jenis layanan dan jumlah minimumnya.' },
        { q: 'Bagaimana jika pesanan gagal?', a: 'Jika pesanan dibatalkan atau hanya selesai sebagian, dana yang sesuai otomatis kembali ke saldo Anda dan bisa dipakai untuk pesanan baru.' },
      ],
    },
    price: {
      title: (b, c) => `${b} - Daftar Harga Semua Platform Mulai ¥${c} per 1.000`,
      h1: (b) => `${b} · Daftar Harga`,
      lede: (b, cheapest, total, plats) =>
        `Semua layanan dihitung per 1.000 unit. Harga awal terendah <b>¥${cheapest}</b>. Saat ini tersedia <b>${total}</b> layanan di ${plats} platform. Total pasti ditampilkan di halaman pesanan sebelum Anda kirim.`,
      tableHead: 'Harga awal per platform',
      thPlatform: 'Platform',
      thFrom: 'Mulai dari (per 1.000)',
      thServices: 'Layanan',
      thTypes: 'Jenis',
      rulesHead: 'Cara perhitungan harga',
      rules: [
        'Setiap layanan dihitung per 1.000 unit, jadi harga satuan tidak berubah mengikuti jumlah.',
        'Masukkan jumlah yang dibutuhkan; halaman pesanan mengalikannya dengan harga satuan dan menampilkan total.',
        'Tingkat kualitas lebih tinggi dan pengiriman lebih cepat berbiaya lebih besar; tabel ini menampilkan harga terendah tiap platform.',
        'Jika pesanan dibatalkan atau selesai sebagian, dana yang sesuai kembali ke saldo Anda.',
      ],
      faqHead: 'Pertanyaan umum',
      cta: 'Mulai pesan →',
      foot: (b) => `${b} · pengiriman otomatis · bayar sesuai pemakaian`,
    },
    plat: {
      title: (b, p, c) => `Layanan ${p} Mulai ¥${c} · ${b}`,
      h1: (b, p) => `Layanan Pertumbuhan ${p} · ${b}`,
      lede: (b, p, count, cheapest) =>
        `${b} memiliki <b>${count}</b> layanan ${p}: pengikut, suka, tayangan, komentar, dan lainnya. Dihitung per 1.000 unit, mulai <b>¥${cheapest}</b>. Pesanan diproses otomatis setelah dikirim.`,
      typeTable: 'Jenis layanan',
      typeHead: 'Jenis',
      fromHead: 'Harga awal',
      faqHead: 'Pertanyaan umum',
      otherHead: 'Platform lain',
      cta: 'Mulai pesan →',
      foot: (b) => `${b} · pengiriman otomatis`,
      thCount: 'Pilihan',
      thMinQty: 'Minimum',
      subHead: (p) => `Lihat layanan ${p} menurut jenis`,
      howToChoose: (p) => `Cara memilih layanan ${p}`,
      howToChooseText: 'Pilih berdasarkan jumlah dan tingkat kualitas: untuk volume besar dengan hasil cepat, ambil tingkat harga lebih tinggi; sebaiknya uji jumlah kecil dulu sebelum menambah. Halaman pesanan menghitung total secara langsung sesuai jumlah yang Anda isi.',
    },
    types: { fans: 'Pengikut', likes: 'Suka', views: 'Tayangan', comments: 'Komentar', shares: 'Bagikan', traffic: 'Trafik', live: 'Live', subscribe: 'Langganan', other: 'Lainnya' },
  },

  // ── 巴西葡语 ─────────────────────────────────────────────────────────
  pt: {
    home: {
      title: (b) => `${b} - Painel de Crescimento em Redes Sociais, a partir de ¥0,03`,
      h1: (b) => `${b} · Painel de Crescimento em Redes Sociais`,
      lede: (b, names, cheapest) =>
        `A ${b} oferece seguidores, curtidas, visualizações e comentários para ${names}. Preços a partir de <b>¥${cheapest} por 1.000</b>, entrega automática e sem precisar da senha da conta.`,
      platformsHead: 'Plataformas e preços iniciais',
      thPlatform: 'Plataforma',
      thFrom: 'A partir de',
      thServices: 'Serviços',
      faqHead: 'Perguntas frequentes',
      cta: 'Fazer pedido →',
      foot: (b) => `${b} · entrega automática · pague conforme o uso`,
      thTypes: 'Tipos',
      faq: (cheapest, total) => [
        { q: 'Como o preço é calculado?', a: `Todos os serviços são cobrados por 1.000 unidades. Informe a quantidade desejada e a página do pedido mostra o total antes de enviar. Os preços começam em ¥${cheapest} por 1.000 e variam conforme a qualidade e a velocidade.` },
        { q: 'Preciso informar a senha da conta?', a: 'Não. Basta um link de perfil público ou nome de usuário. Nunca solicitamos credenciais de acesso.' },
        { q: 'Quando o pedido começa a ser processado?', a: 'Os pedidos são processados automaticamente após o envio. O status de cada pedido aparece no histórico, e pedidos não concluídos são reembolsados.' },
        { q: 'Quais plataformas são suportadas?', a: 'TikTok, Instagram, YouTube, Telegram, Facebook, X (Twitter) e outras. Cada página de plataforma lista os tipos de serviço e a quantidade mínima.' },
        { q: 'E se o pedido não for concluído?', a: 'Se o pedido for cancelado ou concluído apenas em parte, o valor correspondente volta automaticamente para o seu saldo e pode ser usado em um novo pedido.' },
      ],
    },
    price: {
      title: (b, c) => `${b} - Tabela de Preços de Todas as Plataformas a partir de ¥${c} por 1.000`,
      h1: (b) => `${b} · Tabela de Preços`,
      lede: (b, cheapest, total, plats) =>
        `Todos os serviços são cobrados por 1.000 unidades. O menor preço inicial é <b>¥${cheapest}</b>. Há atualmente <b>${total}</b> serviços em ${plats} plataformas. O total exato aparece na página do pedido antes do envio.`,
      tableHead: 'Preço inicial por plataforma',
      thPlatform: 'Plataforma',
      thFrom: 'A partir de (por 1.000)',
      thServices: 'Serviços',
      thTypes: 'Tipos',
      rulesHead: 'Como o preço funciona',
      rules: [
        'Cada serviço é cotado por 1.000 unidades, então o preço unitário não muda com a quantidade.',
        'Informe a quantidade necessária; a página do pedido multiplica pelo preço unitário e mostra o total.',
        'Níveis de qualidade mais altos e entrega mais rápida custam mais; esta tabela mostra o menor preço de cada plataforma.',
        'Se o pedido for cancelado ou concluído em parte, o valor correspondente volta para o seu saldo.',
      ],
      faqHead: 'Perguntas frequentes',
      cta: 'Fazer pedido →',
      foot: (b) => `${b} · entrega automática · pague conforme o uso`,
    },
    plat: {
      title: (b, p, c) => `Serviços de ${p} a partir de ¥${c} · ${b}`,
      h1: (b, p) => `Serviços de Crescimento em ${p} · ${b}`,
      lede: (b, p, count, cheapest) =>
        `A ${b} tem <b>${count}</b> serviços de ${p}: seguidores, curtidas, visualizações, comentários e mais. Cobrados por 1.000 unidades, a partir de <b>¥${cheapest}</b>. Os pedidos são processados automaticamente após o envio.`,
      typeTable: 'Tipos de serviço',
      typeHead: 'Tipo',
      fromHead: 'Preço inicial',
      faqHead: 'Perguntas frequentes',
      otherHead: 'Outras plataformas',
      cta: 'Fazer pedido →',
      foot: (b) => `${b} · entrega automática`,
      thCount: 'Opções',
      thMinQty: 'Mínimo',
      subHead: (p) => `Ver serviços de ${p} por tipo`,
      howToChoose: (p) => `Como escolher serviços de ${p}`,
      howToChooseText: 'Escolha pelo volume e pelo nível de qualidade: para grandes volumes com resultado rápido, use um nível de preço mais alto; teste uma quantidade pequena antes de aumentar. A página do pedido calcula o total na hora conforme a quantidade informada.',
    },
    types: { fans: 'Seguidores', likes: 'Curtidas', views: 'Visualizações', comments: 'Comentários', shares: 'Compartilhamentos', traffic: 'Tráfego', live: 'Ao vivo', subscribe: 'Inscritos', other: 'Outros' },
  },

  // ── 越南语 ──────────────────────────────────────────────────────────
  vi: {
    home: {
      title: (b) => `${b} - Bảng điều khiển tăng trưởng mạng xã hội, từ ¥0,03`,
      h1: (b) => `${b} · Tăng trưởng mạng xã hội`,
      lede: (b, names, cheapest) =>
        `${b} cung cấp người theo dõi, lượt thích, lượt xem và bình luận cho ${names}. Giá từ <b>¥${cheapest} mỗi 1.000</b>, giao tự động, không cần mật khẩu tài khoản.`,
      platformsHead: 'Nền tảng và giá khởi điểm',
      thPlatform: 'Nền tảng',
      thFrom: 'Từ',
      thServices: 'Dịch vụ',
      faqHead: 'Câu hỏi thường gặp',
      cta: 'Bắt đầu đặt hàng →',
      foot: (b) => `${b} · giao tự động · trả theo mức dùng`,
      thTypes: 'Loại',
      faq: (cheapest, total) => [
        { q: 'Giá được tính như thế nào?', a: `Mọi dịch vụ tính theo 1.000 đơn vị. Nhập số lượng bạn cần, trang đặt hàng sẽ hiển thị tổng tiền trước khi bạn gửi. Giá từ ¥${cheapest} mỗi 1.000 và khác nhau theo chất lượng và tốc độ.` },
        { q: 'Có cần cung cấp mật khẩu tài khoản không?', a: 'Không. Chỉ cần liên kết hồ sơ công khai hoặc tên người dùng. Chúng tôi không bao giờ yêu cầu thông tin đăng nhập.' },
        { q: 'Đơn hàng bắt đầu xử lý khi nào?', a: 'Đơn hàng được xử lý tự động sau khi gửi. Bạn có thể theo dõi từng đơn trong lịch sử đơn hàng, và các đơn chưa hoàn thành sẽ được hoàn tiền.' },
        { q: 'Hỗ trợ những nền tảng nào?', a: 'TikTok, Instagram, YouTube, Telegram, Facebook, X (Twitter) và nhiều nền tảng khác. Mỗi trang nền tảng liệt kê các loại dịch vụ và số lượng tối thiểu.' },
        { q: 'Nếu đơn hàng không hoàn thành thì sao?', a: 'Nếu đơn bị huỷ hoặc chỉ hoàn thành một phần, số tiền tương ứng sẽ tự động trả về số dư của bạn và có thể dùng cho đơn mới.' },
      ],
    },
    price: {
      title: (b, c) => `${b} - Bảng giá tất cả nền tảng từ ¥${c} mỗi 1.000`,
      h1: (b) => `${b} · Bảng giá`,
      lede: (b, cheapest, total, plats) =>
        `Mọi dịch vụ tính theo 1.000 đơn vị. Giá khởi điểm thấp nhất là <b>¥${cheapest}</b>. Hiện có <b>${total}</b> dịch vụ trên ${plats} nền tảng. Tổng tiền chính xác được hiển thị ở trang đặt hàng trước khi bạn gửi.`,
      tableHead: 'Giá khởi điểm theo nền tảng',
      thPlatform: 'Nền tảng',
      thFrom: 'Từ (mỗi 1.000)',
      thServices: 'Dịch vụ',
      thTypes: 'Loại',
      rulesHead: 'Cách tính giá',
      rules: [
        'Mỗi dịch vụ được báo theo 1.000 đơn vị, nên đơn giá không đổi theo số lượng.',
        'Nhập số lượng bạn cần; trang đặt hàng nhân với đơn giá và hiển thị tổng tiền.',
        'Mức chất lượng cao hơn và giao nhanh hơn có giá cao hơn; bảng này hiển thị mức giá thấp nhất của mỗi nền tảng.',
        'Nếu đơn bị huỷ hoặc hoàn thành một phần, số tiền tương ứng sẽ trả về số dư của bạn.',
      ],
      faqHead: 'Câu hỏi thường gặp',
      cta: 'Bắt đầu đặt hàng →',
      foot: (b) => `${b} · giao tự động · trả theo mức dùng`,
    },
    plat: {
      title: (b, p, c) => `Dịch vụ ${p} từ ¥${c} · ${b}`,
      h1: (b, p) => `Dịch vụ tăng trưởng ${p} · ${b}`,
      lede: (b, p, count, cheapest) =>
        `${b} có <b>${count}</b> dịch vụ ${p}: người theo dõi, lượt thích, lượt xem, bình luận và hơn thế. Tính theo 1.000 đơn vị, từ <b>¥${cheapest}</b>. Đơn hàng được xử lý tự động sau khi gửi.`,
      typeTable: 'Loại dịch vụ',
      typeHead: 'Loại',
      fromHead: 'Giá từ',
      faqHead: 'Câu hỏi thường gặp',
      otherHead: 'Nền tảng khác',
      cta: 'Bắt đầu đặt hàng →',
      foot: (b) => `${b} · giao tự động`,
      thCount: 'Lựa chọn',
      thMinQty: 'Tối thiểu',
      subHead: (p) => `Xem dịch vụ ${p} theo loại`,
      howToChoose: (p) => `Cách chọn dịch vụ ${p}`,
      howToChooseText: 'Chọn theo số lượng và mức chất lượng: với số lượng lớn cần kết quả nhanh, hãy chọn mức giá cao hơn; nên thử số lượng nhỏ trước khi tăng. Trang đặt hàng tính tổng tiền ngay theo số lượng bạn nhập.',
    },
    types: { fans: 'Người theo dõi', likes: 'Lượt thích', views: 'Lượt xem', comments: 'Bình luận', shares: 'Chia sẻ', traffic: 'Truy cập', live: 'Trực tiếp', subscribe: 'Đăng ký', other: 'Khác' },
  },

  // ── 阿拉伯语（RTL）──────────────────────────────────────────────────
  ar: {
    home: {
      title: (b) => `${b} - لوحة نمو وسائل التواصل الاجتماعي، تبدأ من ¥0.03`,
      h1: (b) => `${b} · نمو وسائل التواصل الاجتماعي`,
      lede: (b, names, cheapest) =>
        `تقدّم ${b} متابعين وإعجابات ومشاهدات وتعليقات لـ ${names}. الأسعار تبدأ من <b>¥${cheapest} لكل 1000</b>، مع تسليم تلقائي ودون الحاجة إلى كلمة مرور الحساب.`,
      platformsHead: 'المنصات والأسعار الابتدائية',
      thPlatform: 'المنصة',
      thFrom: 'تبدأ من',
      thServices: 'الخدمات',
      faqHead: 'الأسئلة الشائعة',
      cta: 'ابدأ الطلب ←',
      foot: (b) => `${b} · تسليم تلقائي · الدفع حسب الاستخدام`,
      thTypes: 'النوع',
      faq: (cheapest, total) => [
        { q: 'كيف يتم حساب السعر؟', a: `تُحتسب جميع الخدمات لكل 1000 وحدة. أدخل الكمية المطلوبة وستعرض صفحة الطلب الإجمالي قبل الإرسال. تبدأ الأسعار من ¥${cheapest} لكل 1000 وتختلف حسب الجودة والسرعة.` },
        { q: 'هل أحتاج إلى إعطاء كلمة مرور الحساب؟', a: 'لا. يكفي رابط الملف الشخصي العام أو اسم المستخدم. لا نطلب بيانات تسجيل الدخول أبدًا.' },
        { q: 'متى يبدأ تنفيذ الطلب؟', a: 'تُنفَّذ الطلبات تلقائيًا بعد الإرسال. يمكنك متابعة حالة كل طلب في سجل الطلبات، ويُعاد المبلغ للطلبات غير المكتملة.' },
        { q: 'ما المنصات المدعومة؟', a: 'تيك توك، إنستغرام، يوتيوب، تيليجرام، فيسبوك، إكس (تويتر) وغيرها. تعرض كل صفحة منصة أنواع الخدمات والحد الأدنى للكمية.' },
        { q: 'ماذا يحدث إذا لم يكتمل الطلب؟', a: 'إذا أُلغي الطلب أو اكتمل جزئيًا، يُعاد المبلغ المقابل تلقائيًا إلى رصيدك ويمكن استخدامه في طلب جديد.' },
      ],
    },
    price: {
      title: (b, c) => `${b} - قائمة أسعار جميع المنصات من ¥${c} لكل 1000`,
      h1: (b) => `${b} · قائمة الأسعار`,
      lede: (b, cheapest, total, plats) =>
        `تُحتسب جميع الخدمات لكل 1000 وحدة. أقل سعر ابتدائي هو <b>¥${cheapest}</b>. يتوفر حاليًا <b>${total}</b> خدمة على ${plats} منصة. يظهر الإجمالي الدقيق في صفحة الطلب قبل الإرسال.`,
      tableHead: 'السعر الابتدائي حسب المنصة',
      thPlatform: 'المنصة',
      thFrom: 'تبدأ من (لكل 1000)',
      thServices: 'الخدمات',
      thTypes: 'النوع',
      rulesHead: 'كيف يُحسب السعر',
      rules: [
        'يُسعَّر كل خدمة لكل 1000 وحدة، لذا لا يتغير سعر الوحدة بتغير الكمية.',
        'أدخل الكمية المطلوبة؛ تضربها صفحة الطلب في سعر الوحدة وتعرض الإجمالي.',
        'مستويات الجودة الأعلى والتسليم الأسرع تكلف أكثر؛ يعرض هذا الجدول أقل سعر لكل منصة.',
        'إذا أُلغي الطلب أو اكتمل جزئيًا، يُعاد المبلغ المقابل إلى رصيدك.',
      ],
      faqHead: 'الأسئلة الشائعة',
      cta: 'ابدأ الطلب ←',
      foot: (b) => `${b} · تسليم تلقائي · الدفع حسب الاستخدام`,
    },
    plat: {
      title: (b, p, c) => `خدمات ${p} تبدأ من ¥${c} · ${b}`,
      h1: (b, p) => `خدمات نمو ${p} · ${b}`,
      lede: (b, p, count, cheapest) =>
        `لدى ${b} <b>${count}</b> خدمة ${p}: متابعون وإعجابات ومشاهدات وتعليقات والمزيد. تُحتسب لكل 1000 وحدة، من <b>¥${cheapest}</b>. تُنفَّذ الطلبات تلقائيًا بعد الإرسال.`,
      typeTable: 'أنواع الخدمات',
      typeHead: 'النوع',
      fromHead: 'السعر من',
      faqHead: 'الأسئلة الشائعة',
      otherHead: 'منصات أخرى',
      cta: 'ابدأ الطلب ←',
      foot: (b) => `${b} · تسليم تلقائي`,
      thCount: 'الخيارات',
      thMinQty: 'الحد الأدنى',
      subHead: (p) => `اعرض خدمات ${p} حسب النوع`,
      howToChoose: (p) => `كيف تختار خدمات ${p}`,
      howToChooseText: 'اختر حسب الحجم ومستوى الجودة: للأحجام الكبيرة بنتائج سريعة استخدم مستوى سعر أعلى؛ جرّب كمية صغيرة قبل الزيادة. تحسب صفحة الطلب الإجمالي فورًا حسب الكمية المُدخلة.',
    },
    types: { fans: 'متابعون', likes: 'إعجابات', views: 'مشاهدات', comments: 'تعليقات', shares: 'مشاركات', traffic: 'زيارات', live: 'بث مباشر', subscribe: 'مشتركون', other: 'أخرى' },
  },

  // ── 俄语 ────────────────────────────────────────────────────────────
  ru: {
    home: {
      title: (b) => `${b} - Панель роста в соцсетях, от ¥0,03`,
      h1: (b) => `${b} · Рост в социальных сетях`,
      lede: (b, names, cheapest) =>
        `${b} предоставляет подписчиков, лайки, просмотры и комментарии для ${names}. Цены от <b>¥${cheapest} за 1000</b>, автоматическая выдача, пароль от аккаунта не требуется.`,
      platformsHead: 'Площадки и стартовые цены',
      thPlatform: 'Площадка',
      thFrom: 'От',
      thServices: 'Услуги',
      faqHead: 'Частые вопросы',
      cta: 'Оформить заказ →',
      foot: (b) => `${b} · автоматическая выдача · оплата по факту`,
      thTypes: 'Тип',
      faq: (cheapest, total) => [
        { q: 'Как рассчитывается цена?', a: `Все услуги считаются за 1000 единиц. Укажите нужное количество — страница заказа покажет итог до отправки. Цены начинаются от ¥${cheapest} за 1000 и зависят от качества и скорости.` },
        { q: 'Нужно ли передавать пароль от аккаунта?', a: 'Нет. Достаточно публичной ссылки на профиль или имени пользователя. Мы никогда не запрашиваем данные для входа.' },
        { q: 'Когда начинается выполнение заказа?', a: 'Заказы обрабатываются автоматически после отправки. Статус каждого заказа виден в истории, а незавершённые заказы возвращаются на баланс.' },
        { q: 'Какие площадки поддерживаются?', a: 'TikTok, Instagram, YouTube, Telegram, Facebook, X (Twitter) и другие. На каждой странице площадки перечислены типы услуг и минимальное количество.' },
        { q: 'Что если заказ не выполнен?', a: 'Если заказ отменён или выполнен частично, соответствующая сумма автоматически возвращается на ваш баланс и может быть использована для нового заказа.' },
      ],
    },
    price: {
      title: (b, c) => `${b} - Прайс-лист всех площадок от ¥${c} за 1000`,
      h1: (b) => `${b} · Прайс-лист`,
      lede: (b, cheapest, total, plats) =>
        `Все услуги считаются за 1000 единиц. Минимальная стартовая цена — <b>¥${cheapest}</b>. Сейчас доступно <b>${total}</b> услуг на ${plats} площадках. Точная сумма показывается на странице заказа до отправки.`,
      tableHead: 'Стартовая цена по площадкам',
      thPlatform: 'Площадка',
      thFrom: 'От (за 1000)',
      thServices: 'Услуги',
      thTypes: 'Тип',
      rulesHead: 'Как считается цена',
      rules: [
        'Каждая услуга оценивается за 1000 единиц, поэтому цена за единицу не меняется от объёма.',
        'Укажите нужное количество — страница заказа умножит его на цену за единицу и покажет итог.',
        'Более высокое качество и быстрая выдача стоят дороже; в таблице указана минимальная цена каждой площадки.',
        'Если заказ отменён или выполнен частично, соответствующая сумма возвращается на баланс.',
      ],
      faqHead: 'Частые вопросы',
      cta: 'Оформить заказ →',
      foot: (b) => `${b} · автоматическая выдача · оплата по факту`,
    },
    plat: {
      title: (b, p, c) => `Услуги ${p} от ¥${c} · ${b}`,
      h1: (b, p) => `Услуги роста ${p} · ${b}`,
      lede: (b, p, count, cheapest) =>
        `У ${b} есть <b>${count}</b> услуг ${p}: подписчики, лайки, просмотры, комментарии и другое. Считаются за 1000 единиц, от <b>¥${cheapest}</b>. Заказы обрабатываются автоматически после отправки.`,
      typeTable: 'Типы услуг',
      typeHead: 'Тип',
      fromHead: 'Цена от',
      faqHead: 'Частые вопросы',
      otherHead: 'Другие площадки',
      cta: 'Оформить заказ →',
      foot: (b) => `${b} · автоматическая выдача`,
      thCount: 'Варианты',
      thMinQty: 'Минимум',
      subHead: (p) => `Услуги ${p} по типам`,
      howToChoose: (p) => `Как выбрать услуги ${p}`,
      howToChooseText: 'Выбирайте по объёму и уровню качества: для больших объёмов с быстрым результатом берите более дорогой уровень; сначала протестируйте небольшое количество. Страница заказа сразу считает итог по введённому количеству.',
    },
    types: { fans: 'Подписчики', likes: 'Лайки', views: 'Просмотры', comments: 'Комментарии', shares: 'Репосты', traffic: 'Трафик', live: 'Прямой эфир', subscribe: 'Подписчики', other: 'Другое' },
  },
};

/** 取某语种的文案；zh/en 走原有渲染路径（不在这里），只给 id/pt 用 */
export const copyOfLang = (lang) => C[lang] || null;

/** 是否是需要走多语种渲染的语种（zh/en 已有专用实现） */
export const isMultiLang = (lang) => Object.prototype.hasOwnProperty.call(C, lang);

/**
 * 把内部中文类型标签（platform.js 的 TYPE_RULES 产出）映射到目标语言。
 * ⚠️ 内部标签是中文：订阅 / 粉丝 / 点赞 / 播放 / 评论 / 分享 / 直播 / 流量 / 其他。
 *    不要按英文猜 —— 一开始写错过一版。
 */
export const typeLabelOf = (lang, label) => {
  const map = C[lang]?.types;
  if (!map) return label;
  const KEY = {
    '订阅': 'subscribe', '粉丝': 'fans', '点赞': 'likes', '播放': 'views',
    '评论': 'comments', '分享': 'shares', '直播': 'live', '流量': 'traffic', '其他': 'other',
  };
  const k = KEY[String(label || '').trim()];
  return (k && map[k]) || map.other || label;
};

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
};

/** 支持的语言顺序（hreflang 里按这个顺序输出） */
export const LANG_ORDER = ['zh', 'en', 'id', 'pt'];

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

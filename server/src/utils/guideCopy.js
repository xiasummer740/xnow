// ============================================================================
// 知识库文章（2026-11-07）
// ----------------------------------------------------------------------------
// 为什么要有这一层：
//   产品页（/c/tiktok/fans）拿的是交易词 —— 「TikTok 涨粉 价格」。
//   知识库拿的是问答词 —— 「涨粉会不会掉」「为什么要填主页链接」。
//   后者搜索量更大、竞争更小，而且是 AI 引擎最常引用的形态：
//   AI 被问到「买粉丝会掉吗」时，引用的是有明确判断标准的那一段，
//   不是「我们最好最专业」这种话。
//
// 写作原则（照这个来，别写成广告）：
//   1. 每篇必须回答一个具体问题，前面 80 字内给结论（AI 摘录的就是这段）；
//   2. 给可验证的判断标准（数字、比例、时间），不给形容词；
//   3. 承认服务的边界 —— 哪些做不到、哪些是客户自己的责任。这反而增加可信度。
//
// 客户可见，禁止出现「上游 / 供应商 / 进货」（见 CLAUDE.md 红线）。
// ============================================================================

export const ARTICLES = [
    {
        slug: 'link-format',
        title: '涨粉类服务为什么必须填主页链接，不能填视频链接',
        desc: '涨粉、订阅、群成员这类服务作用于「账号」而不是「单条内容」，所以必须填主页地址。填视频链接是最常见的失败原因，会导致订单直接失败并退款。',
        tag: '下单指南',
        updated: '2026-11-07',
        body: [
            ['先说结论', '涨粉、订阅、群成员、直播场观这类服务，作用对象是**账号或直播间**，所以要填主页链接（或用户名）；点赞、播放、评论、分享这类服务，作用对象是**单条内容**，所以要填内容链接。填错了订单会失败，钱会退回余额。'],
            ['怎么区分', '看这个服务的名字里有没有「粉丝 / 关注 / 成员 / 订阅」这类词 —— 有就是账号级，填主页；有「点赞 / 播放 / 评论 / 分享 / 浏览」就是内容级，填内容链接。拿不准时看下单页那个输入框的提示文字，每个服务都会显示对应格式。'],
            ['各平台主页链接长什么样', 'TikTok：`tiktok.com/@用户名`，或者直接填用户名（不带 @ 也可以）。Instagram：`instagram.com/用户名`。YouTube：`youtube.com/@频道名` 或 `youtube.com/channel/频道ID`。Telegram：`t.me/频道或群名`。Facebook：主页地址或页面 ID。X（Twitter）：`x.com/用户名`。'],
            ['为什么视频链接会失败', '视频链接指向的是一条内容，服务方拿不到「这个账号」，自然无法给账号加关注。系统检测到链接类型不匹配就判定失败，钱原路退回余额。这不是账号问题，也不是平台限制，纯粹是填错了对象。'],
            ['几个容易混的例子', '`tiktok.com/t/xxxxx` 是分享短链，指向具体视频 —— 涨粉类不要用它。`tiktok.com/@name/video/123` 带 `/video/` 的也是视频页。只有 `tiktok.com/@name` 这种以 @ 用户名结尾的才是主页。'],
            ['填错了会怎样', '订单会失败并自动退款到余额，不会扣钱。但会浪费一次下单时间，如果填错的量比较大还可能触发风控。所以第一次用建议先小额试一单，确认格式对了再放量。'],
        ],
    },
    {
        slug: 'will-followers-drop',
        title: '买的粉丝会掉吗？掉多少算正常',
        desc: '会掉，这是所有增长渠道的共同现象。掉粉比例和档位质量直接相关：低价档位掉粉明显、速度快慢不一；带留存保障的档位会在一段时间内补齐。关键看下单页的档位说明。',
        tag: '常见疑问',
        updated: '2026-11-07',
        body: [
            ['先说结论', '会掉。任何渠道增加的粉丝都存在自然流失 —— 一部分是平台清理不活跃账号，一部分是账号本身取关。掉粉比例和「你选的档位」直接相关，便宜的档位通常掉得更明显。'],
            ['为什么会有掉粉', '三个来源：一是平台定期清理僵尸号、异常号，连带把不活跃的粉丝清掉；二是账号内容与粉丝预期不符，真实用户主动取关；三是部分低价渠道的粉丝本身留存就差。前两个任何渠道都躲不掉，第三个可以通过选档位规避。'],
            ['怎么判断一个档位会不会掉', '看三个地方：价格（明显低于同类的档位，通常用低成本渠道）、是否带「留存保障/补粉」说明、标注的起量速度。这三点往往同时出现 —— 便宜、快、不掉，不可能三角。'],
            ['掉多少算正常', '没有统一数字，但有个判断方法：如果是「稳定缓慢增加」的档位，掉粉通常在可接受范围内且曲线平缓；如果是「几分钟内暴涨几千」的，后续掉粉往往也猛。看数据曲线的陡峭程度比看承诺更可靠。'],
            ['掉了怎么办', '优先选带留存保障的档位，在保障期内掉了会补。没保障的档位掉了只能重新下单。所以做长期账号时，宁可单价高一点选稳定档，也不要反复补单 —— 反复补单累计成本更高，而且粉丝画像会乱。'],
            ['一个被忽略的点', '掉粉多不多，很大程度取决于**你的内容**。买来的粉丝如果没有内容留住他们，掉粉是必然的。把增长当成「账号冷启动助推」而不是「粉丝数游戏」，掉粉就不构成问题。'],
        ],
    },
    {
        slug: 'speed-vs-price',
        title: '为什么有的服务 1 小时到账，有的要 3 天',
        desc: '起量速度由服务档位决定，不是平台限制。快速档位用即时渠道、单价高；慢速档位走批量队列、单价低。同一平台同一类型，价格差 5-10 倍很常见，区别就在速度和留存。',
        tag: '怎么选',
        updated: '2026-11-07',
        body: [
            ['先说结论', '同一个平台上，「TikTok 粉丝」可能有十几个档位，价格从几元到几十元 / 1000 个不等，主要差别就是**起量速度**和**留存质量**。快的不便宜，便宜的不快，这是渠道成本决定的，不是谁故意设的。'],
            ['速度档位大概怎么分', '瞬时档：下单后几分钟到 1 小时开始，适合急用（活动、投放配合）。标准档：几小时内开始，匀速增加，最常用。慢速档：24-72 小时才开始，价格最低，适合只要最终数量、不赶时间的场景。'],
            ['速度影响什么', '一是能不能配合你的时间点（比如直播开播前），二是数据曲线自不自然。瞬时灌入大量数据，曲线会非常陡，平台侧看起来突兀；匀速增加更接近自然增长，但你要等。'],
            ['怎么读服务名里的参数', '我们的服务名里通常直接写了参数，例如「[开始时间：1小时][速度：10K/天][补充：30天]」。开始时间 = 下单到起量的间隔；速度 = 每天能交付多少；补充 = 掉粉保障天数。这三个数字比价格更能说明问题。'],
            ['给不同场景的建议', '急着用（几小时内要看到效果）：选开始时间短的档位，别省这个钱。长期养号：选匀速档，价格低、曲线自然。测试内容方向：小量、快速档，测完再放量。纯凑数字：慢速大量档最划算。'],
            ['一个常见误区', '很多人先选最便宜的，结果等了三天还没起量，又急着补一单贵的 —— 总成本比一开始就选对还高。第一次用某个服务，先小额试一单确认实际速度，比看描述靠谱。'],
        ],
    },
    {
        slug: 'is-it-safe',
        title: '用第三方增长服务安全吗？会不会封号',
        desc: '不需要提供账号密码，全程只填公开的主页链接或内容链接。正常使用不会导致封号。真正的风险不在「用不用服务」，而在数据异常和内容违规 —— 这两点可以规避。',
        tag: '安全与风险',
        updated: '2026-11-07',
        body: [
            ['先说结论', '整个流程不需要你的账号密码，也不需要登录授权。你提供的只是公开可见的主页地址或内容链接 —— 这些信息任何人打开浏览器都能看到。从这个角度说，账号本身没有暴露面。'],
            ['真正的风险在哪', '不在「用服务」这个动作，在两件事：一是**数据异常**（短时间内粉丝数暴涨到远超内容能支撑的量级），平台可能降低推荐权重；二是**内容违规**（内容本身被判定违规），这种情况任何增长手段都救不了。'],
            ['怎么规避数据异常', '按账号体量分批做，让粉丝增长曲线接近自然增长；不要一次灌入几十倍于日常的量；配合内容发布节奏（发了新内容再做量，看起来更自然）。'],
            ['哪些做法不要碰', '不要为了省事把账号密码给任何人，包括声称「帮你代运营」的。不要买来路不明的「账号成品」。不要在内容里放导流信息再用增长服务 —— 那是内容违规，不是服务问题。'],
            ['合规边界', '各家平台的服务条款对「第三方增长」态度不一，执行力度也不同。这里不做条款解读 —— 你需要自己判断在所在平台、所在地区的适用性。我们能保证的是技术层面：不接触你的账号凭证，不使用你的登录态。'],
            ['一句话总结', '服务本身不碰你的账号，风险来自「用得多猛」和「内容本身」。控制节奏、专注内容，就没有额外风险。'],
        ],
    },
    {
        slug: 'new-account-guide',
        title: '新账号怎么起步：先做哪个指标',
        desc: '新号不要一上来就堆粉丝。正确顺序是先有内容基础，再用播放量测试内容方向，最后才补粉丝和互动。顺序错了，数据会很不自然。',
        tag: '运营方法',
        updated: '2026-11-07',
        body: [
            ['先说结论', '新号起步的顺序是：**内容 → 播放 → 互动（点赞/评论）→ 粉丝**。反过来做（先买粉丝）最常见的问题是：主页有几千粉丝，但每条内容只有几十播放 —— 这个比例一眼就不对。'],
            ['第一步：先有内容基础', '至少发 6-9 条内容再考虑做量。原因很实际：访客点进主页看到只有 1 条内容，粉丝再多也不会关注。而且平台对新号的判断会参考内容密度。'],
            ['第二步：用播放测方向', '给几条内容分别补少量播放，观察哪条的自然互动（真实点赞、评论、完播）更好。这是最便宜的「内容测试」方式 —— 播放在所有指标里单价最低。找到表现好的方向，再集中资源。'],
            ['第三步：补互动', '给表现好的内容补点赞和评论，注意和播放量的比例。点赞一般不超过播放量的一定比例才自然；评论区有内容比空着好，但文案要贴合主题。'],
            ['第四步：最后才是粉丝', '等内容和互动都有基础了，再补粉丝。这时的粉丝数才有意义 —— 因为它背后有内容承接。如果是为跨过某个功能门槛（比如开收益），可以一次性做到位，但内容还是要跟上。'],
            ['一个实际建议', '整个起步过程控制在 2-3 周内，不要一天做完。数据曲线平缓上升，比一次性跳到目标更安全，也更像自然增长。'],
        ],
    },
    {
        slug: 'duplicate-order',
        title: '为什么同一个链接不能重复下单',
        desc: '同一个目标链接同时存在两个进行中的订单，会导致交付冲突：系统无法确认该按哪个订单执行，最终两单都可能失败。要加量请等前一单完成后再下，或直接下更大数量的一单。',
        tag: '下单指南',
        updated: '2026-11-07',
        body: [
            ['先说结论', '同一个链接不要同时开两单。要么取消一单（如果还没开始），要么等前一单跑完再加。重复下单会导致两单都失败并退款，白等时间。'],
            ['为什么会冲突', '服务执行时会读取「当前已有的数量」作为起点，然后增量交付。如果两单同时进行，它们读到的是同一个起点，交付量会重叠或互相覆盖，最终结果对不上账 —— 系统只能判定失败。'],
            ['正确做法', '要加量：等前一单完成后再下一单。要更快：直接下一单更大的数量，而不是拆成两单。下错了：如果前一单还没开始执行，尽快联系客服处理。'],
            ['我们做了哪些拦截', '下单时系统会检查你和这个链接是否已有进行中的订单，有的话直接拦下并提示是哪一单在进行中。所以正常情况下你不会真的下出重复单 —— 但如果绕过页面（比如接口直接调用）就拦不住了。'],
            ['同类问题的另一个变体', '同一个账号的不同链接（比如同一个 TikTok 账号的主页链接和一个视频链接）分别下单，这个不算重复，可以同时进行。重复指的是「同一个目标对象」。'],
        ],
    },
    {
        slug: 'which-tier-to-choose',
        title: '同一个服务有十几个档位，到底选哪个',
        desc: '看三个参数：开始时间、每天速度、留存保障。这三个决定了价格差异。按你的时间要求倒推 —— 急着用选开始时间短的，长期养号选匀速档，纯凑数量选最便宜的。',
        tag: '怎么选',
        updated: '2026-11-07',
        body: [
            ['先说结论', '档位之间的差异不在「哪个更好」，在「哪个更匹配你的场景」。同类型服务价格差 5-10 倍很正常，多出来的钱买的是速度和留存，不是「更高级的粉丝」。'],
            ['三个关键参数', '**开始时间**：下单到真正开始增加的间隔，从几分钟到 72 小时不等。**速度**：每天能交付多少，决定多久跑完。**留存保障**：掉了之后多少天内补齐。这三个数字通常直接写在服务名里。'],
            ['按场景选', '活动/投放配合（几小时内必须见效）：只看开始时间短的，价格其次。长期养号（不赶时间）：匀速档，单价低、曲线自然，性价比最高。测试内容方向：小量 + 快速档，测完再放量。纯凑数量（比如跨门槛）：最便宜的慢速大量档。'],
            ['怎么判断值不值', '用「单位成本 × 掉粉率」估算实际成本，而不是只看单价。一个 5 元 / 1000 个但掉 30% 的档位，实际成本是 7.1 元 / 1000 个留存；一个 8 元 / 1000 个不掉粉的档位反而更便宜。'],
            ['一个实用习惯', '第一次用某个平台或类型，先下最小数量试一档。看实际起量时间、到账是否完整、观察一周掉粉情况。有了这个数据再决定放量用哪个档 —— 比看任何描述都准。'],
        ],
    },
    {
        slug: 'views-vs-engagement',
        title: '播放量高就代表内容好吗',
        desc: '不代表。播放只是曝光数，完播率、互动率才决定平台是否继续推荐。单纯堆播放而不改善内容，数据会很快回落，而且会拉低账号的推荐权重。',
        tag: '运营方法',
        updated: '2026-11-07',
        body: [
            ['先说结论', '播放量是「有多少人点开」，不是「有多少人看完」。平台推荐算法真正看的是完播率、互动率、停留时长 —— 播放量只是入口指标，不是结果指标。'],
            ['为什么单纯堆播放没用', '数据会说话：如果一条内容有 10 万播放但完播率极低、几乎没互动，平台会判定「这条内容留不住人」，后续推荐反而减少。堆出来的播放量在这种情况下是负资产。'],
            ['真正该关注的三个数', '**完播率**：看完的人占比，最直接的内容质量信号。**互动率**：（点赞+评论+分享）÷ 播放，反映内容是否引发反应。**涨粉转化**：播放带来的新关注比例，反映内容是否对味。'],
            ['播放量什么时候有用', '三个场景：新号冷启动时帮内容跨过「零播放」的门槛；测试内容方向时快速拿到样本量；配合活动需要在短时间内有曝光数据。这三种情况播放是「助推器」，不是「结果」。'],
            ['更划算的做法', '与其把钱全花在播放上，不如：用少量播放测试 5-10 条内容方向 → 找到完播率和互动率明显更好的那条 → 把预算集中在它上面（播放 + 点赞 + 评论一起配）。同样的钱，效果差好几倍。'],
        ],
    },
    {
        slug: 'live-room-data',
        title: '直播间的「在线人数」和「场观」有什么区别',
        desc: '在线人数是此刻有多少人在看，场观是一场直播累计进来过多少人。后者数字通常大 5-20 倍，价格也不同。买错指标等于白花钱。',
        tag: '常见疑问',
        updated: '2026-11-07',
        body: [
            ['先说结论', '**在线人数**（同时在线/PCU）是某一刻直播间显示的数字，会随时间波动。**场观**（PV/累计观看）是从开播到下播一共进来过多少人，只增不减。两者是完全不同的指标，价格差别很大。'],
            ['为什么场观数字大得多', '一个 100 人在线的直播间，播 2 小时，如果观众平均停留 10 分钟，那么累计进来的人可能是 1000+ —— 因为人是在流动的。所以场观通常是同时在线数的 5-20 倍。'],
            ['买错会怎样', '最常见的错误是想「让直播间看起来人多」，却买了场观 —— 结果直播间显示的还是 3 个人在线，但后台数据说进来了 2000 人。钱花了，效果没看到。反过来想「数据好看」，买在线人数又贵很多。'],
            ['该买哪个', '要让访客觉得直播间热闹（影响转化）：买**在线人数**。要冲平台的活动门槛或榜单（看累计数据）：买**场观**。两个都要：分开下单，别在一个档位里指望两个效果。'],
            ['还有一个容易忽略的', '**停留时长**。有些档位带停留，意味着进来的人会待一会儿再走。停留对平台推荐权重的影响比人数更大 —— 因为平台判断的是「内容留不留得住人」。预算够的话，带停留的档位更值。'],
            ['下单时机', '多数档位要求直播间处于开播状态才能开始。开播前下单可能一直不执行。另外注意：服务是按「场」还是按「小时」计的，别买成整场却发现只覆盖了一小时。'],
        ],
    },
    {
        slug: 'how-to-verify',
        title: '怎么判断一次增长服务是否真的执行了',
        desc: '三个观察点：目标数量是否在增长、增长速度是否符合档位说明、订单状态是否从「进行中」变为「已完成」。三者不一致时，以订单状态和实际数据为准。',
        tag: '下单指南',
        updated: '2026-11-07',
        body: [
            ['先说结论', '看三样东西：**实际数据**（粉丝数/播放数有没有涨）、**增长速度**（是否符合档位标注的开始时间和每天速度）、**订单状态**（进行中 → 已完成）。三样一致才算正常执行。'],
            ['数据没涨但订单显示进行中', '可能是还没到开始时间（慢速档常见，24-72 小时才起量）。先对照档位说明的「开始时间」，超过这个时间还没动静再联系客服。'],
            ['数据涨了但订单显示失败', '少见但会发生：数据在途，订单已被判定失败并退款。这种情况按退款处理，不用额外付费。如果后续数据又回落，属于正常。'],
            ['数量对不上', '实际增长少于下单数量，常见于两个原因：一是部分数据被平台清理（掉粉），二是链接填错了导致部分交付失败。看订单的「剩余」字段，如果显示还有剩余未交付，等它跑完。'],
            ['什么时候该联系客服', '超过档位标注的开始时间仍无任何变化；订单显示已完成但实际数量明显不符；同一链接重复下单导致冲突。这几种情况提供订单号和截图，处理起来很快。'],
            ['一个建议', '第一次用某个档位时，下最小数量。观察完整周期（包括一周后的留存），再决定是否放量。这比任何描述都可靠 —— 也是我们自己在选服务时用的方法。'],
        ],
    },
    {
        slug: 'first-1000-followers',
        title: '新号前 1000 粉怎么来：为什么你发了两周只有 200 播放',
        desc: '新号卡在 200-500 播放，绝大多数情况不是内容差。平台对小号的第一轮分发范围本来就极小，互动不够就停止推荐。先把「账号历史」攒起来（连续 3-4 周、20-40 条），再谈内容优化。',
        tag: '起号实操',
        updated: '2026-11-08',
        body: [
            ['先说结论', '新号卡在 200-500 播放，**绝大多数情况不是内容问题**。平台对小号的第一轮分发范围本来就极小，互动不够就停止推荐。先把「账号历史」攒起来 —— 连续发 3-4 周、累计 20-40 条 —— 再谈内容优化。跳过这步直接改内容，等于在没有信号的地方猜答案。'],
            ['为什么新号只有 200 播放', '平台不认识你的账号，不知道该推给谁，所以第一轮只推给很小的测试池。完播率和互动率不达标，推荐就停在这个数字上。这不是惩罚，是冷启动机制的必然结果。同一个视频、同样质量，发在有 5000 粉的号上可能几万播放，发在零粉号上就是 200 —— 差别在分发基数，不在内容。'],
            ['第一件事：连续发，别断', '算法需要历史数据来判断「你的号讲什么、给谁看」。发 3 条就停，永远攒不出这个历史。观察到的规律是 **20-40 条**是大多数账号的分水岭 —— 要么在这个区间里某条爆了，要么明确证明这个选题没有受众。两条都是有用信息。'],
            ['第二件事：只讲一个窄话题', '内容杂的号，算法学不到东西。10 条「桌面收纳」会被推给看过收纳内容的人；10 条「我的生活日常」不会被推给任何人。窄 = 可识别。等账号有了基础量再扩题，顺序不能反。'],
            ['第三件事：前 2 秒决定生死', '不是标题，是**画面**。信息流里你的视频和上下 50 条并排出现，如果第一帧看起来没区别，手指就划过去了。自己刷一遍信息流，看会不会为自己的视频停下 —— 这比任何数据后台都直观。'],
            ['第四件事：拿搜索框当选题库', '在平台搜索框输入你的关键词，看下拉联想。那些是**真实搜索量**。回答一个被搜索的问题，视频能持续几个月带来播放；追一个热点，48 小时就死了。这是新号性价比最高的内容类型。'],
            ['第五件事：第一个月每条评论都回', '评论是分发信号，回复会带来更多评论。这是目前成本最低、最容易被忽略的杠杆 —— 零成本，只是费时间。'],
            ['什么时候才该用加速', '如果你需要的是**社交证明** —— 让点进主页的人觉得这是个正常账号、让品牌方看数据时不觉得是白号 —— 用基础粉丝量快速起步是合理的，成本也低。如果你需要的是**真实客户**，加速来的粉丝不会看、不会买，最终还是得靠内容。把这两件事分开看就不会买错，详见[自然涨粉和加速涨粉](/guide/organic-vs-accelerated)。'],
            ['一个 30 天的节奏', '第 1 周：每天发，只看完播率不看别的。第 2 周：找出完播最高那条，做 3 条同类型的。第 3 周：开始在一小时内回评论，试一条直接回答搜索联想的内容。第 4 周：有单条破 5000 播放就做 5 个变体；一条都没有就改视觉风格，别改选题。看平台档位可以到 [TikTok 增长服务](/c/tiktok)，具体起价在[价格表](/price)。'],
            ['说清楚做不到的部分', '内容能不能爆，任何服务都保证不了 —— 我们也不做这个承诺。加速服务影响的是「账号看起来怎么样」和「分发基数」，改变不了内容本身好不好看。这一点在产品页和下单页都写了。'],
        ],
        en: {
            tag: 'Getting started',
            title: 'Getting your first 1,000 followers: why two weeks of posting got you 200 views',
            desc: 'New accounts plateau at 200-500 views, and it usually has nothing to do with content quality. The first distribution round goes to a tiny test pool; without engagement it stops there. Build account history first — 3-4 weeks, 20-40 posts.',
            body: [
                ['The short version', 'New accounts stuck at 200-500 views are, **in most cases, not a content problem**. The first distribution round for a small account is tiny by design; if engagement is weak, promotion stops right there. Build "account history" first — post consistently for 3-4 weeks, 20-40 posts total — then talk about content optimization. Skipping this step means guessing at answers in a place with no signal.'],
                ['Why a new account gets 200 views', 'The platform does not know your account or who to show it to, so round one goes to a very small test pool. If completion rate and engagement miss the bar, promotion halts at that number. It is not a penalty, it is just how cold start works. The same video at the same quality can get tens of thousands of views on an account with 5,000 followers and 200 on a fresh one — the difference is the distribution base, not the content.'],
                ['First: post consistently, do not stop', 'The algorithm needs history to learn what your account is about and who should see it. Post three videos and quit, and you never build that. The pattern I have seen is **20-40 posts** as the dividing line for most accounts — either something breaks out in that window, or you have clearly proven the topic has no audience. Both are useful information.'],
                ['Second: one narrow topic only', 'A mixed feed teaches the algorithm nothing. Ten videos about desk organization get shown to people who watch desk organization content; ten videos about "my life" get shown to nobody. Narrow means identifiable. Broaden the topic after you have a base, not before.'],
                ['Third: the first 2 seconds decide everything', 'Not the caption — the **visual**. Your video sits between fifty others in a feed, and if the first frame looks the same as the rest, the thumb keeps moving. Scroll your own feed and ask whether you would stop for your own video. That is a better read than any analytics dashboard.'],
                ['Fourth: use the search bar as a topic list', 'Type your keyword into the platform search bar and look at the suggestions. Those are **real search volumes**. A video that answers a searched question keeps bringing views for months. A trend-chasing video is dead in 48 hours. This is the highest-leverage content type for a new account.'],
                ['Fifth: reply to every comment for the first month', 'Comments are a distribution signal, and replies generate more of them. This is the cheapest growth lever that exists — zero cost, only time.'],
                ['When acceleration is the right call', 'If what you need is **social proof** — a profile that looks like a real account to visitors, or numbers that do not read as a blank slate to a brand — starting with a base follower count is reasonable and cheap. If what you need is **real customers**, accelerated followers will not watch and will not buy, and content still does the work. Keeping those two goals separate is how you avoid buying the wrong thing. See [organic vs accelerated growth](/en/guide/organic-vs-accelerated).'],
                ['A realistic 30-day rhythm', 'Week 1: post daily, look only at completion rate. Week 2: take the highest-completion video and make three more like it. Week 3: start replying to comments within the hour, and try one video that directly answers a search suggestion. Week 4: if a single video passed 5,000 views, make five variations; if none did, change the visual style, not the topic. Tiers and starting prices are on the [TikTok services page](/c/tiktok) and the [price list](/price).'],
                ['What this cannot do', 'No service can guarantee a video will take off, and we do not promise it. Acceleration affects how the account looks and what its distribution base is; it does not make the content better. That is stated on the product page and at checkout as well.'],
            ],
        },
    },
    {
        slug: 'shopee-traffic-channels',
        title: '跨境店铺引流：五个渠道按见效速度排，哪个真有用',
        desc: '平台自然流量最慢但最稳，社媒引流看账号起点，网红合作成本高转化最好，付费广告最直接但要会算账，涨粉加速只解决社交证明。按这个顺序做能省掉大部分无效投入。',
        tag: '店铺运营',
        updated: '2026-11-08',
        body: [
            ['先说结论', '预算有限时的正确顺序：**先修标题和主图**（零成本，一周内能验证）→ **把社媒账号做到有基础量** → **发产品内容挂链接** → **小额广告测转化** → **再找网红合作**。最常见的浪费是跳过第二步直接做第三步：零粉号发产品视频，播放量卡在 200-500，白做。'],
            ['一、平台自然流量（最慢，最稳）', 'Shopee、Lazada、亚马逊的搜索流量，本质是选品和关键词。标题别写「高品质收纳盒 多功能 大容量」这种堆词 —— 买家搜的是**具体场景**：`桌面收纳盒 化妆品`、`旅行收纳袋 内衣`。去平台搜索框输入一个词看下拉提示，那就是真实搜索量。主图的影响往往比标题更大：同一个品换一张更干净的主图，点击率能差一倍。代价是慢，新品到有稳定自然流量通常要 3-6 周，还得配合评价积累。'],
            ['二、社媒引流（看账号起点）', 'TikTok、Instagram、Pinterest 挂链接到店铺，这条路很多人走，但有个常被忽略的前提：**账号本身得有点基础量**。零粉号发产品视频，平台不会推给陌生人，播放自然卡住。现实做法分两步：先把账号做到几千粉（有分发基数），再开始挂产品内容。反过来做，前两周基本是白费。具体节奏见[新号前 1000 粉怎么来](/guide/first-1000-followers)。'],
            ['三、网红合作（成本高，转化最好）', '找垂直小网红（1 万-10 万粉）比找大网红划算：大网红报价高、粉丝杂，小网红报价低、粉丝精准。关键是带货能力不是粉丝数 —— 一个 3 万粉但互动率 8% 的号，效果经常好过一个 30 万粉互动率 0.5% 的号。怎么算互动率见[互动率多少算正常](/guide/engagement-rate)。联系方式一般是 Instagram 私信或邮件，准备好样品和报价区间，回复率会高很多。'],
            ['四、付费广告（最直接，要会算账）', 'Meta 和 TikTok 广告出单快，但很容易亏。先算清三个数：**客单价、毛利率、转化率**。客单价 30 美金、毛利 40%，那单笔广告成本超过 12 美金就是在亏。新手常见错误是一上来就投转化目标 —— 应该先跑点击/加购，等像素积累够数据再切。'],
            ['五、涨粉加速（有争议，得说清楚）', '前面第二条提到「账号得有基础量」，这一步很多人会买。**有没有用取决于你拿它干什么**：拿来充门面，让新访客觉得这号不是空的 —— 有用，成本很低；指望这些粉带来互动和转化 —— 没用，它们不会看你的内容也不会下单，只影响「看起来像不像正常账号」。判断标准很简单：**你要的是社交证明，还是要真实客户**。另外服务质量差距很大，同样标「TikTok 粉丝」，真号和机器号掉粉率能差十倍 —— 选的时候看两点：有没有掉粉补、是不是按每 1000 个明码标价。'],
            ['各渠道投入产出一览', '自然流量：零成本、3-6 周见效、长期有效。社媒引流：时间成本为主、2-4 周见效（前提是有基础粉）、长期有效。网红合作：几百到几千美金、1-2 周见效、单次性。付费广告：预算可控、即时见效、停投即停。涨粉加速：几十到几百元、几小时见效、只影响门面不影响销量。'],
            ['一个提醒', '所有渠道都有共同前提：**产品和页面得能承接流量**。流量进来发现主图差、详情页没说服力、没有评价，转化率会低到让所有渠道都亏。先把这步做好再买流量，顺序反了钱就是白花。'],
        ],
        en: {
            tag: 'Store operations',
            title: 'Cross-border store traffic: five channels ranked by how fast they work',
            desc: 'Organic marketplace traffic is slow but durable. Social traffic depends on where the account starts. Influencer deals cost more but convert best. Paid ads are fastest and easiest to lose money on. Acceleration only buys social proof.',
            body: [
                ['The short version', 'With a limited budget, the right order is: **fix titles and cover images first** (free, verifiable within a week) → **get the social account to a base follower count** → **post product content with links** → **test small paid campaigns** → **then approach influencers**. The most common waste is skipping step two: a zero-follower account posting product videos plateaus at 200-500 views and the effort is gone.'],
                ['1. Marketplace organic traffic (slowest, most durable)', 'Search traffic on Shopee, Lazada, and Amazon comes down to product selection and keywords. Do not stuff titles with adjectives like "premium multi-function large-capacity storage box." Buyers search **specific scenarios**: `desk organizer cosmetics`, `travel pouch underwear`. Type a term into the marketplace search bar and read the suggestions — those are real volumes. Cover images often matter more than titles: the same product with a cleaner cover can double click-through. The cost is time: a new listing typically needs 3-6 weeks plus review accumulation before organic traffic stabilizes.'],
                ['2. Social traffic (depends on where the account starts)', 'Linking TikTok, Instagram, or Pinterest to your store is popular, but there is a commonly skipped precondition: **the account needs a base follower count**. A zero-follower account posting product videos will not get pushed to strangers, so views stall. Do it in two steps: get the account to a few thousand followers (a distribution base), then start posting product content. Reverse the order and the first two weeks are wasted. See [getting your first 1,000 followers](/en/guide/first-1000-followers).'],
                ['3. Influencer collaborations (costly, best conversion)', 'Vertical micro-influencers (10k-100k followers) beat large ones on value: big accounts charge more for a broader, less-targeted audience. What matters is sales ability, not follower count — a 30k account with 8% engagement routinely outperforms a 300k account at 0.5%. See [what engagement rate is normal](/en/guide/engagement-rate). Outreach usually goes through Instagram DMs or email; have samples and a price range ready and response rates improve noticeably.'],
                ['4. Paid ads (fastest, requires arithmetic)', 'Meta and TikTok ads produce orders quickly and lose money just as quickly. Work out three numbers first: **average order value, gross margin, conversion rate**. At a $30 AOV and 40% margin, anything above $12 cost per order is a loss. A common beginner mistake is optimizing for conversions immediately — start with clicks or add-to-cart, and switch once the pixel has enough data.'],
                ['5. Follower acceleration (contested, needs a straight answer)', 'Step two above says the account needs a base follower count, and many people buy it. **Whether it works depends entirely on what you want from it.** Using it to look established so visitors do not see a blank profile — yes, and it is cheap. Expecting those followers to engage or buy — no. They will not watch your content and will not order. All it changes is whether the account looks normal. The test is simple: **do you need social proof, or do you need actual customers?** Quality also varies wildly — two services both labelled "TikTok followers" can differ tenfold in drop rate. Check two things: whether drops are refilled, and whether pricing is stated per 1,000 rather than as an opaque package.'],
                ['Cost and speed at a glance', 'Organic: no cash, 3-6 weeks to take effect, durable. Social: mostly time, 2-4 weeks (with a base already in place), durable. Influencers: hundreds to thousands of dollars, 1-2 weeks, one-off. Paid ads: controllable budget, immediate, stops when you stop. Acceleration: tens to hundreds of dollars, hours, affects presentation only.'],
                ['One reminder', 'Every channel shares a precondition: **the product and the page have to be able to receive the traffic.** If visitors land on weak cover images, an unconvincing listing, and no reviews, conversion will be low enough to make every channel unprofitable. Fix that before buying traffic. Reversed order means the money is simply gone.'],
            ],
        },
    },
    {
        slug: 'engagement-rate',
        title: '互动率多少算正常：公式、各平台基准线、怎么判断粉丝质量',
        desc: '互动率 =（点赞+评论+分享+收藏）÷ 播放量（或粉丝数）。TikTok 按播放算，Instagram 按粉丝算，两条基准线完全不同，混用会得出错误结论。低于基准一半，先怀疑粉丝质量或内容匹配度。',
        tag: '数据判断',
        updated: '2026-11-08',
        body: [
            ['先说结论', '互动率 = **（点赞 + 评论 + 分享 + 收藏）÷ 播放量**。TikTok 用播放量做分母，Instagram 和 YouTube 常按粉丝数算 —— **两条基准线完全不同，混用会得出完全错误的结论**。粗略基准：TikTok 3%-8% 算正常，Instagram（按粉丝）1%-3%，YouTube 2%-5%。低于基准一半，先怀疑粉丝质量或内容匹配度，别先怀疑平台限流。'],
            ['TikTok 怎么算', '分母是**播放量**，不是粉丝数：`(点赞+评论+分享) ÷ 播放`。3% 以下说明内容没有引发反应；5%-8% 是健康区间；超过 10% 通常意味着这条内容被精准推给了对的受众。注意播放量很小时（几百）比例会失真，至少要有几千播放再看这个数。'],
            ['Instagram 怎么算', '行业惯例分母是**粉丝数**：`(点赞+评论+收藏) ÷ 粉丝数`。1%-3% 是常见区间，Reels 的播放量单独看更准。粉丝数虚高（比如买过粉）会把这个比例压得很低 —— 这时候低不一定代表内容差，可能是分母不对。'],
            ['为什么这个数字能测出粉丝质量', '真实的粉丝会看、会互动。不活跃的粉丝只增加分母，不增加分子 —— 所以**买粉之后互动率必然下降**，这是数学上的必然，不是平台惩罚。如果你刚做过增长服务，互动率掉了，先看是不是分母变大了，别急着归因到内容或限流。'],
            ['一个更可靠的判断方法', '别只看比例，看**绝对值随时间的变化**。同一条视频第 3 天和第 7 天的互动数差多少？真实流量通常在 48-72 小时内衰减到接近零，如果一周后还在涨，那是搜索流量或推荐长尾，这条内容的质量比表面数据更好。'],
            ['什么时候该警惕', '三个信号：一是互动率突然掉到以前的三分之一以下且持续；二是播放量正常但点赞极少（说明被推给了不匹配的人）；三是评论里出现大量与内容无关的留言（可能是机器互动）。第一种看粉丝构成，第二种看选题，第三种不用管，平台会清。'],
            ['和订单核对', '如果同期做过增长服务，把订单的「下单数量」和后台实际增数对一下，差额就是掉粉量。这个数字结合互动率一起看，能判断是「粉没进去」还是「进去了但都是低质粉」。核对方法见[怎么判断一次增长服务是否真的执行了](/guide/how-to-verify)。'],
        ],
        en: {
            tag: 'Reading data',
            title: 'What engagement rate is normal: the formula, per-platform baselines, and reading follower quality',
            desc: 'Engagement rate = (likes + comments + shares + saves) ÷ views (or followers). TikTok divides by views, Instagram by followers — two different baselines, and mixing them produces wrong conclusions. Below half the baseline, suspect follower quality first.',
            body: [
                ['The short version', 'Engagement rate = **(likes + comments + shares + saves) ÷ views**. TikTok divides by views; Instagram and YouTube are commonly calculated against followers — **these baselines are not the same, and mixing them gives completely wrong answers**. Rough ranges: TikTok 3%-8% is normal, Instagram 1%-3% (against followers), YouTube 2%-5%. Below half the baseline, look at follower quality or content-audience fit before blaming a shadowban.'],
                ['Calculating for TikTok', 'The denominator is **views**, not followers: `(likes + comments + shares) ÷ views`. Below 3% means the content did not provoke a reaction. 5%-8% is a healthy range. Above 10% usually means the video got shown to precisely the right audience. Note that ratios distort at very low view counts (a few hundred) — wait until a video has at least a few thousand before reading it.'],
                ['Calculating for Instagram', 'The industry convention divides by **followers**: `(likes + comments + saves) ÷ followers`. 1%-3% is the usual range; Reels watch numbers are better read separately. An inflated follower count (from a past purchase, for instance) will push this ratio down hard — in that case a low number does not necessarily mean weak content, it may just be the denominator.'],
                ['Why this number reveals follower quality', 'Real followers watch and engage. Inactive followers only increase the denominator without adding to the numerator — so **engagement rate necessarily falls after buying followers**. That is arithmetic, not a platform penalty. If you just ran a growth service and engagement dropped, check whether the denominator grew before attributing it to content or throttling.'],
                ['A more reliable method', 'Do not just read ratios — read **absolute numbers over time**. How much does a video gain between day 3 and day 7? Organic traffic usually decays to near zero within 48-72 hours. If a video is still climbing after a week, that is search or long-tail recommendation traffic, and the content is stronger than the surface numbers suggest.'],
                ['When to worry', 'Three signals. One: engagement drops below a third of its previous level and stays there. Two: views look normal but likes are abnormally low — meaning it was shown to the wrong audience. Three: comments are full of irrelevant replies, which is usually bot engagement and the platform will clean it up on its own.'],
                ['Cross-checking against orders', 'If you ran a growth service in the same period, compare the ordered quantity against the actual follower increase in the backend. The gap is the drop-off. Read that number alongside engagement rate to distinguish "followers never arrived" from "followers arrived but were low quality": the first shows up as an order still marked in progress, the second shows up as delivered quantity holding while your ratio falls.'],
            ],
        },
    },
    {
        slug: 'organic-vs-accelerated',
        title: '自然涨粉和加速涨粉：什么时候用哪个，成本怎么算',
        desc: '两者不是替代关系而是先后关系：加速解决起点，内容解决转化。零粉号发内容等于在没有分发基数的池子里自说自话；只有粉但内容不行，等于把人骗进来然后什么也没给。',
        tag: '策略选择',
        updated: '2026-11-08',
        body: [
            ['先说结论', '这两件事**不是二选一，是先后关系**。加速解决「账号有没有起点」，内容解决「粉丝会不会买」。零粉号发内容等于在没有分发基数的池子里自说自话；只有粉但内容不行，等于把陌生人骗进来然后什么也没给。正确顺序：先补起点，再用内容换真实客户。'],
            ['自然涨粉的成本结构', '金钱成本接近零，**时间成本很高**。按每天发 1-2 条、连续 3-4 周算，大约 30-60 小时投入才能过冷启动期。成功率不是 100% —— 选题不对的话，40 条之后还是没有起色也正常。好处是留下来的粉丝会互动、会转化、会带来口碑。'],
            ['加速涨粉的成本结构', '金钱成本几十到几百元（按每 1000 个计价），**时间成本接近零**。几分钟到几小时完成。缺点很明确：这些粉丝不互动、不转化，互动率会因此下降（分母变大分子不变）。它买的是「社交证明」，不是「客户」。'],
            ['怎么判断自己属于哪种情况', '问一个问题：**你现在缺的是「看起来可信」，还是「真的有人买」？** 缺可信度（要接品牌合作、要给店铺导流、要让人点开主页不觉得是白号）→ 加速能立刻解决。缺销量 → 加速帮不上，得靠内容和选品。两个都缺，先补可信度（快、便宜），再花时间做内容。'],
            ['组合起来的实际做法', '第一步：用加速把账号做到几千粉（解决分发基数和门面）。第二步：按[新号前 1000 粉怎么来](/guide/first-1000-followers)的节奏做内容，这时内容会被推给更多人，因为账号有了基数。第三步：数据稳定后开始挂产品链接。三步加起来约 1 个月，比纯自然涨粉快，比纯买粉有效。'],
            ['一个容易被忽略的账', '很多人只算「买粉多少钱」，没算「买错了损失什么」。如果买来的粉质量太差导致互动率崩了、账号被降权，恢复成本远高于省下的钱。所以选档位看三个东西：**价格是否明显低于同类**（低得离谱通常有原因）、**有没有留存保障**、**起量速度是否合理**（几分钟暴涨几千的，后续掉得也猛）。这三条是不可能三角 —— 便宜、快、不掉，只能占两个。'],
            ['看完之后', '判断自己属于「需要门面」那类，可以直接看[价格表](/price)对比各平台起价；属于「需要真实客户」，先按内容那两篇做一个月再说。两种选择都没有对错，只有适用场景的区别。'],
        ],
        en: {
            tag: 'Strategy',
            title: 'Organic growth vs accelerated growth: when to use which, and what each really costs',
            desc: 'They are not alternatives, they are sequential: acceleration solves the starting point, content solves conversion. A zero-follower account posting content is talking to itself in a pool with no distribution.',
            body: [
                ['The short version', 'These are **not a choice between two options — they are sequential**. Acceleration answers "does the account have a starting point"; content answers "will followers buy." A zero-follower account posting content is talking to itself in a pool with no distribution base. An account with followers but no content is luring strangers in and offering them nothing. Correct order: establish the base, then use content to earn real customers.'],
                ['What organic growth actually costs', 'Cash cost is close to zero; **time cost is high**. At 1-2 posts a day for 3-4 weeks, that is roughly 30-60 hours before clearing the cold-start period. Success is not guaranteed — if the topic is wrong, 40 posts later there may still be nothing, and that is normal. The upside is that followers who stay engage, convert, and refer others.'],
                ['What acceleration actually costs', 'Tens to hundreds of dollars (priced per 1,000), with **almost no time cost**. Minutes to hours. The downside is clear: those followers do not engage and do not convert, and engagement rate falls as a result (bigger denominator, unchanged numerator). What you are buying is social proof, not customers.'],
                ['Working out which situation you are in', 'Ask one question: **do you lack looking credible, or do you lack people actually buying?** Lacking credibility (closing brand deals, driving store traffic, having a profile that does not read as blank) → acceleration solves it immediately. Lacking sales → acceleration does not help; content and product selection do. If you lack both, buy credibility first (fast, cheap), then spend time on content.'],
                ['How to combine them', 'Step one: use acceleration to get the account to a few thousand followers (distribution base plus presentation). Step two: follow the rhythm in [getting your first 1,000 followers](/en/guide/first-1000-followers) — content now reaches more people because the base exists. Step three: start attaching product links once numbers stabilize. About a month end to end, faster than pure organic and more effective than pure purchasing.'],
                ['The cost nobody calculates', 'Most people only compute "what the followers cost," not "what buying the wrong ones costs." If low-quality followers crater your engagement rate and the account gets downranked, recovery costs far more than what you saved. So check three things when choosing a tier: **is the price obviously below comparable listings** (suspiciously cheap usually has a reason), **is there retention or refill coverage**, and **is the delivery speed plausible** (thousands appearing in minutes also disappear fast). This is an impossible triangle — cheap, fast, and no drops: pick two.'],
                ['After reading this', 'If you decided you need presentation, compare starting prices on the [price list](/price). If you need real customers, spend a month on the content articles first. Neither choice is wrong; they simply apply to different situations.'],
            ],
        },
    },
    {
        slug: 'instagram-growth',
        title: 'Instagram 起号：Reels 和图文是两套逻辑，别混着做',
        desc: 'IG 的流量入口有两个：Reels 靠推荐页（和 TikTok 类似），图文靠探索页和标签（完全不同）。同一套内容两边都发，往往两边都不行。hashtag 现在的作用也不是当年那回事了。',
        tag: '起号实操',
        updated: '2026-11-08',
        body: [
            ['先说结论', 'Instagram 有**两个独立的流量入口**：Reels 走推荐页，逻辑接近 TikTok；图文/轮播走探索页 + 标签 + 主页访客。**这两套的分发机制不一样**，同一套内容两边硬发，通常两边数据都不好看。做 IG 之前先决定主攻哪个，别平均用力。'],
            ['Reels 的推荐逻辑', '和 TikTok 最像：完播率、重播率、分享是主要信号。前 3 秒的留存决定它推不推。区别在于 IG 更看重**分享到私信**这个动作 —— 用户把 Reels 转给朋友，权重比点赞高得多。所以「值得发给朋友看」比「好看」更重要。'],
            ['图文的探索页逻辑', '图文不进推荐页，它靠的是**探索页（Explore）和标签页**。决定能不能上探索页的是「谁看过类似的图」和「互动速度」—— 发布后 30 分钟内的点赞评论密度很关键。所以图文发布时机比 Reels 重要得多。'],
            ['hashtag 现在还有没有用', '有，但作用变了。早年是「堆得越多曝光越多」，现在是**帮助算法给内容分类**。10-15 个精准标签的效果通常好过 30 个泛标签 —— 泛标签的竞争太大，你的内容根本排不进去。另外带定位的标签对本地商家仍然有效。'],
            ['两个入口的取舍', '想要快速起量、能持续拍视频 → 主攻 Reels。做产品、做店铺、需要展示细节和排版 → 图文/轮播更合适，而且图文的**收藏率**更高，收藏对转化型内容是有利信号。资源够就分工：Reels 做曝光，图文做转化。'],
            ['常见的错误做法', '三个：一是把 TikTok 的视频直接搬到 Reels（带水印会被降权，且节奏不对）；二是图文和 Reels 发同一个内容；三是发完就不管评论 —— IG 的评论权重比很多人想的高，前 30 分钟尤其。'],
            ['和粉丝基数的关系', 'IG 比 TikTok 更依赖已有粉丝：新号发 Reels 的初始推荐量比 TikTok 小，图文更是几乎完全依赖现有粉丝的互动。这就是为什么很多人做 IG 会先补一个基础粉丝量 —— 不是为了让数据好看，是为了**让新内容有个初始互动池**。判断标准见[自然涨粉和加速涨粉](/guide/organic-vs-accelerated)。'],
            ['数据怎么看', 'IG 的互动率惯例按**粉丝数**算（分母不是播放量，这点和 TikTok 不同），1%-3% 是常见区间。如果你刚做过增长服务导致粉丝数变大，互动率会掉，那是分母的问题不是内容的问题。具体算法见[互动率多少算正常](/guide/engagement-rate)。'],
            ['看档位', 'IG 的粉丝、点赞、播放、故事浏览是分开计价的，档位差异主要在起量速度和留存。可以到 [Instagram 增长服务](/c/instagram) 看当前有哪些类型和起价。'],
        ],
        en: {
            tag: 'Getting started',
            title: 'Instagram growth: Reels and feed posts are two different games',
            desc: 'Instagram has two separate traffic entries — Reels ride the recommendation feed, feed posts rely on Explore and hashtags. Running the same content through both usually means neither works. And hashtags do not do what they did in 2019.',
            body: [
                ['The short version', 'Instagram has **two independent traffic entries**: Reels go through the recommendation feed, which behaves a lot like TikTok. Feed posts and carousels go through Explore, hashtags, and profile visits. **The distribution mechanics are not the same.** Running identical content through both usually means mediocre numbers on both. Pick one to lead with before you start.'],
                ['How Reels get distributed', 'Closest to TikTok: completion rate, replays, and shares are the main signals. The first three seconds decide whether it gets pushed. The difference is that Instagram weights **shares to DMs** much higher than likes. "Worth sending to a friend" beats "looks nice."'],
                ['How feed posts get distributed', 'Feed posts do not enter the recommendation feed. They rely on **Explore and hashtag pages**, which are driven by who has engaged with similar posts and by engagement velocity — likes and comments in the first 30 minutes matter a lot. That makes posting timing far more important for feed posts than for Reels.'],
                ['Do hashtags still work', 'Yes, but the role changed. It used to be "more tags, more reach." Now it is **how the algorithm classifies your content**. 10-15 specific tags usually beat 30 generic ones, because generic tags are too competitive to rank in. Location tags still work for local businesses.'],
                ['Choosing between the two', 'Want fast growth and can produce video consistently → lead with Reels. Selling a product, need to show detail and layout → feed posts and carousels, which also get **more saves**, and saves are a favorable signal for conversion-oriented content. With enough resources, split the work: Reels for reach, feed for conversion.'],
                ['Common mistakes', 'Three: uploading TikTok videos to Reels with the watermark still on (gets downranked, and the pacing is wrong anyway); posting the same thing as both a Reel and a feed post; and ignoring comments — Instagram weighs comments heavily, especially in the first 30 minutes.'],
                ['Why follower count matters more here', 'Instagram depends on existing followers more than TikTok does. New accounts get a smaller initial Reels pool, and feed posts rely almost entirely on current followers engaging. That is why people often start with a base follower count on IG — not to make the numbers look good, but to give new posts **an initial engagement pool**. See [organic vs accelerated growth](/en/guide/organic-vs-accelerated).'],
                ['Reading the numbers', 'Instagram engagement rate is conventionally calculated against **follower count**, not views — this is the opposite of TikTok. 1%-3% is a normal range. If you recently ran a growth service and follower count jumped, engagement rate will drop. That is the denominator, not your content. See [what engagement rate is normal](/en/guide/engagement-rate).'],
                ['Pricing', 'On Instagram, followers, likes, views, and story views are priced separately. Tiers differ mainly in delivery speed and retention. You can check current types and starting prices on the [Instagram services page](/c/instagram).'],
            ],
        },
    },
    {
        slug: 'youtube-subscribers',
        title: 'YouTube 订阅怎么涨：它是搜索平台，不是推荐平台',
        desc: 'YouTube 和 TikTok 的增长逻辑几乎相反：TikTok 靠推荐、YouTube 靠搜索。标题和缩略图决定点击率，观看时长决定推荐，而订阅数是结果不是手段。用短视频那套方法做 YouTube 通常做不起来。',
        tag: '起号实操',
        updated: '2026-11-08',
        body: [
            ['先说结论', '**YouTube 的流量大头来自搜索和「建议视频」，不是首页推荐。** 这意味着选题要按「有人会搜什么」来定，不是按「什么会火」来定。用 TikTok 的思路（追热点、拼前 3 秒）做 YouTube，通常做不起来 —— 两个平台的入口根本不同。'],
            ['第一步是想清楚搜索意图', '在 YouTube 搜索框输入你的关键词，看下拉联想和「其他人还搜了」。这些都是真实搜索量。一个能持续被搜到的问题，视频能在两年里稳定带来播放；一个蹭热点的视频，两周后就没人看了。这是 YouTube 最值钱的地方，也是最容易被忽略的地方。'],
            ['标题和缩略图决定点击率', 'YouTube 的展示形式是「缩略图 + 标题」，用户是主动选择看哪条。同一批推荐位里，点击率差一倍很常见，而点击率直接决定它推不推你。缩略图上别放太多字（手机上看不清），标题里把关键词放前面（搜索结果里会被截断）。'],
            ['观看时长决定推荐', 'YouTube 最看重的信号是**平均观看时长和完播率**，不是点赞。一个 8 分钟的视频有人看 6 分钟，比一个 20 分钟的视频有人看 3 分钟要好得多。所以新号别拍长视频 —— 短一点、把完播率做上去，比堆时长有效。'],
            ['订阅数和播放量的关系', '很多人以为「先涨订阅再涨播放」，实际是反的：**播放量带来订阅**，不是订阅带来播放。一个视频爆了，订阅会跟着涨；订阅涨了但内容没人看，这些订阅也不会给你带来播放。所以别把订阅当成目标，它是个副产品。'],
            ['什么时候该考虑加速', 'YouTube 有个特殊门槛：**1000 订阅 + 4000 小时观看时长**才能开收益。很多人卡在这一步。如果你的目的是开收益或者让频道看起来有基础，用订阅服务能跨过这个门槛；但同样要说清楚 —— 加速来的订阅不会看你的视频，不会贡献观看时长，频道本身的增长还是得靠内容。'],
            ['数据基准', 'YouTube 的互动率惯例按**播放量**算，2%-5% 是常见区间。更该看的是「平均观看时长占比」——超过 50% 说明内容对路，低于 30% 说明标题骗了人或者内容拖沓，两种情况处理方式完全不同。'],
            ['看档位', 'YouTube 的订阅、播放、点赞、观看时长是不同服务，价格差异大（订阅通常比播放贵）。可以到 [YouTube 增长服务](/c/youtube) 看当前类型和起价，或者直接看[价格表](/price)对比。'],
        ],
        en: {
            tag: 'Getting started',
            title: 'Growing on YouTube: it is a search engine, not a recommendation feed',
            desc: 'YouTube grows almost opposite to TikTok. TikTok runs on recommendations; YouTube runs on search. Title and thumbnail decide click-through, watch time decides promotion, and subscriber count is an outcome rather than a lever.',
            body: [
                ['The short version', '**Most YouTube traffic comes from search and suggested videos, not the home feed.** That means picking topics by "what will people search for," not "what will go viral." Taking the TikTok playbook — chase trends, optimize the first 3 seconds — to YouTube usually fails, because the entries are fundamentally different.'],
                ['Start with search intent', 'Type your keyword into the YouTube search bar and look at the suggestions plus the "people also search for" panel. Those are real search volumes. A video that answers a searched question keeps bringing views for two years. A trend-chasing video is dead in two weeks. That longevity is YouTube\'s biggest asset and the most commonly ignored one.'],
                ['Title and thumbnail decide click-through', 'YouTube shows a thumbnail and a title, and users actively choose what to watch. Within the same set of recommendations, a 2x difference in CTR is common — and CTR directly determines promotion. Keep text off the thumbnail (unreadable on phones) and put the keyword early in the title (search results truncate).'],
                ['Watch time decides promotion', 'The signal YouTube cares about most is **average view duration and completion rate**, not likes. An 8-minute video watched for 6 minutes beats a 20-minute video watched for 3. So do not make long videos as a new channel — keep them short, get completion up, then extend.'],
                ['Subscribers are a result, not a lever', 'The intuition is "grow subscribers first, then views." It is actually the reverse: **views bring subscribers.** A video that takes off pulls subscribers with it. Subscribers gained without content that people watch will not bring you views. Do not treat subscriber count as the goal.'],
                ['When acceleration makes sense', 'YouTube has a specific threshold: **1,000 subscribers plus 4,000 watch hours** before monetization. Many channels stall exactly there. If the goal is monetization eligibility or making the channel look established, a subscriber service clears that step. Same caveat as everywhere else — accelerated subscribers do not watch, do not contribute watch hours, and channel growth still depends on content.'],
                ['Baselines', 'YouTube engagement rate is conventionally calculated against **views**; 2%-5% is a common range. The more useful number is average view duration as a percentage — above 50% means the content fits, below 30% means either the title oversold or the video drags. Those two problems need opposite fixes.'],
                ['Pricing', 'Subscribers, views, likes, and watch hours are separate services on YouTube, and the price gap is large — subscribers typically cost several times what views do, because delivering them is harder. Check the [YouTube services page](/c/youtube) or the [full price list](/price).'],
            ],
        },
    },
    {
        slug: 'influencer-pricing',
        title: '网红合作报价怎么谈：CPM、CPS、一口价，哪种不容易被坑',
        desc: '网红报价有四种常见形式：一口价、按播放付费、按销售分成、产品置换。选错形式比谈贵了更亏。判断报价是否合理的锚点不是粉丝数，是历史互动率和同类报价区间。',
        tag: '店铺运营',
        updated: '2026-11-08',
        body: [
            ['先说结论', '四种计价方式：**一口价**（最省事，风险在你）、**按播放/曝光付费**（CPM，风险共担）、**按销售分成**（CPS，最公平但难谈）、**产品置换**（零现金，适合小微网红）。选错形式比价格谈高了更亏 —— 一个 500 美金一口价的合作，如果播放只有 2000，实际 CPM 是 250 美金，贵得离谱。'],
            ['报价的锚点不是粉丝数', '很多网红按粉丝数报价（比如「1 万粉 = 100 美金」），这个算法很粗。更该看**历史互动率**：让他给三条近期视频的后台截图，看播放量和互动数。同样 1 万粉，互动率 8% 和 1% 的号，实际触达能差八倍。'],
            ['怎么判断报价合不合理', '自己算一遍 CPM：**报价 ÷（预估播放量 ÷ 1000）**。快消品类的网红视频 CPM 通常在 10-40 美金之间，超过 60 就要谨慎。预估播放量别信对方说的，看他最近五条的中位数。'],
            ['一口价的风险在哪', '风险全在你这边：付了钱，播多少算多少。适合**已经验证过带货能力**的网红（合作过、或者有明确案例）。第一次合作不建议用一口价，尤其不要预付全款。'],
            ['CPS 为什么难谈', '按销售分成对双方都公平，但网红不愿意接 —— 因为转化取决于你的产品和落地页，不在他控制范围内。想推 CPS 得给两个东西：**有竞争力的分成比例**（快消类 15%-30%）和**现成的转化案例**（让他相信能卖出去）。'],
            ['产品置换的适用场景', '零现金、只寄样品，适合 3000 粉以下的小微网红。回复率其实不低 —— 很多人愿意收样品换一条内容。缺点是内容质量不可控，且对方可能只是想要免费产品。建议同时寄给 10-20 个，看谁的产出真的能用。'],
            ['几个实操细节', '一是在私信里就给清楚：产品是什么、要几条内容、能不能挂链接、什么时候要。二是明确「内容保留期」（有些网红一个月后删视频，那你的流量就断了）。三是合同里写清数据反馈义务，不然合作完拿不到数据。'],
            ['替代方案：自己做账号', '如果预算有限，把同样的钱用在自己账号上往往更划算 —— 网红合作是**一次性流量**，自己账号的粉丝是**可复用资产**。自己起号的节奏见[新号前 1000 粉怎么来](/guide/first-1000-followers)，整个渠道排序见[跨境店铺引流](/guide/shopee-traffic-channels)。'],
        ],
        en: {
            tag: 'Store operations',
            title: 'Negotiating influencer rates: flat fee, CPM, CPS, or product-only',
            desc: 'Four common pricing models, and picking the wrong one hurts more than overpaying. The anchor for a fair rate is not follower count — it is historical engagement and comparable rates in your niche.',
            body: [
                ['The short version', 'Four models: **flat fee** (simplest, all the risk on you), **CPM / pay per view** (risk shared), **CPS / revenue share** (fairest, hardest to negotiate), and **product-only** (no cash, works for micro-influencers). Choosing the wrong model costs more than paying a high rate — a $500 flat fee on a video that gets 2,000 views works out to a $250 CPM, which is absurd.'],
                ['Do not anchor on follower count', 'Many influencers quote by follower count ("10k followers = $100"), which is a crude formula. Look at **historical engagement** instead: ask for screenshots of the backend numbers on their last three videos. Two accounts with the same 10k followers can differ 8x in actual reach depending on whether engagement is 8% or 1%.'],
                ['Check the rate yourself', 'Work out the CPM: **rate ÷ (estimated views ÷ 1,000)**. For fast-moving consumer goods, influencer video CPM typically lands between $10 and $40. Above $60 is worth scrutinizing. Do not trust their estimate of views — take the median of their last five.'],
                ['Where flat fees bite', 'The risk is entirely yours: you pay, and whatever happens happens. Flat fees make sense for influencers with **proven sales ability** — someone you have worked with, or who has a clear case study. Do not use a flat fee for a first collaboration, and especially do not prepay in full.'],
                ['Why CPS is hard to negotiate', 'Revenue share is fair to both sides, but influencers resist it because conversion depends on your product and landing page, not on anything they control. To sell CPS you need to offer two things: **a competitive share** (15%-30% for consumer goods) and **an existing conversion case** so they believe it can sell.'],
                ['When product-only works', 'Zero cash, sample only, suitable for micro-influencers under 3,000 followers. Response rates are actually decent — plenty of people will trade a post for a product. The downside is uncontrolled quality, and some are just after free stuff. Send to 10-20 at once and see whose output is actually usable.'],
                ['Practical details', 'State it all in the first message: what the product is, how many posts, whether links are allowed, and the deadline. Specify a **content retention period** — some influencers delete videos after a month, which cuts off your traffic. Put a data reporting obligation in the agreement, or you will not get numbers afterward.'],
                ['The alternative: build your own account', 'If budget is tight, spending the same money on your own account is often the better trade. Influencer collaborations are **one-time traffic**; your own followers are a **reusable asset**. See [getting your first 1,000 followers](/en/guide/first-1000-followers) and the full channel ranking in [cross-border store traffic](/en/guide/shopee-traffic-channels).'],
            ],
        },
    },
    {
        slug: 'platform-differences',
        title: '五个平台的增长逻辑完全不同，同一套内容别照搬',
        desc: 'TikTok 靠推荐、YouTube 靠搜索、Instagram 两个入口并行、X 靠转发链、Telegram 靠群组扩散。同一套内容原样搬到五个平台，通常每个平台都做不好。差异在哪、怎么调整，这篇讲清楚。',
        tag: '策略选择',
        updated: '2026-11-08',
        body: [
            ['先说结论', '**每个平台的流量入口不一样，所以「什么内容能火」也不一样。** 一条在 TikTok 爆的视频，原样发到 YouTube 可能几十播放。不是内容差，是入口不对。做多平台之前先搞清楚每个平台靠什么分发，再决定内容怎么改 —— 改形式比改选题便宜得多。'],
            ['TikTok：纯推荐驱动', '内容发出去不看粉丝数，直接进推荐池测试，数据好就继续推。所以新号也有机会爆，代价是**内容必须在前 3 秒抓住人**。粉丝的价值主要体现在「初始播放量高一点」，不在于「粉丝会主动来看」。详见[新号前 1000 粉怎么来](/guide/first-1000-followers)。'],
            ['YouTube：搜索 + 建议驱动', '流量大头是搜索和「接下来播放」，用户主动选择看什么。所以**选题要按搜索意图定，标题缩略图决定点击率，观看时长决定推荐**。新号起步慢（没有搜索排名），但一个做对的视频能持续两年带流量。详见[YouTube 订阅怎么涨](/guide/youtube-subscribers)。'],
            ['Instagram：两个入口并行', 'Reels 走推荐页（接近 TikTok），图文走探索页 + 标签（接近 Pinterest）。两个入口的优化方向不同，**混着做通常两边都不行**。详见[Instagram 起号](/guide/instagram-growth)。'],
            ['X（Twitter）：转发链 + 时效', '核心信号是**转发和引用**，不是点赞。内容寿命极短（几小时到一天），但一条被大号转发能带来爆发。所以 X 适合「观点型、可引用、有时效」的内容，不适合精修的长内容。做 X 的关键是**发得多 + 抓住当天话题**。'],
            ['Telegram：群组扩散 + 搜索', '不是推荐平台，是**渠道平台**。增长靠两件事：被别人转发到其他群，和 Telegram 内置搜索（t.me 链接能被搜到）。所以频道内容要「值得转发」，且频道名和简介里要有可被搜索的关键词。列表型、资源型内容在 TG 传得最快。'],
            ['一张对照表', 'TikTok：推荐驱动 / 前 3 秒 / 新号有机会 / 内容寿命 2-3 天。YouTube：搜索驱动 / 标题缩略图 / 新号慢 / 寿命 1-2 年。Instagram：双入口 / 分开优化 / 依赖基础粉 / 寿命 3-7 天。X：转发链 / 有时效 / 需要量 / 寿命 几小时。Telegram：群组扩散 / 值得转发 / 靠搜索 / 寿命 长期存续。'],
            ['实操建议', '预算和精力有限的话，**先做一个平台做透**，别五个平台平均用力。判断标准：你的产品是「冲动消费」→ TikTok/IG Reels；是「搜索解决需求」→ YouTube；是「需要信任和长期关系」→ Telegram 频道。做完一个再加下一个，顺序反了每个都做不深。'],
            ['各平台的档位差异', '不同平台的同类服务价格差很大（比如 YouTube 订阅通常比 TikTok 粉丝贵数倍），因为交付难度不同。想横向对比可以看[价格表](/price)，按每 1000 个统一口径列出来了。'],
        ],
        en: {
            tag: 'Strategy',
            title: 'Five platforms, five completely different growth mechanics',
            desc: 'TikTok runs on recommendations, YouTube on search, Instagram on two parallel entries, X on the repost chain, Telegram on group spread. Copy-pasting the same content everywhere usually means it underperforms everywhere.',
            body: [
                ['The short version', '**Each platform has a different traffic entry, so "what works" is different too.** A video that takes off on TikTok might get a few dozen views posted as-is on YouTube. The content is not bad; the entry is wrong. Before going multi-platform, figure out how each one distributes — adjusting format is cheaper than changing topics.'],
                ['TikTok: pure recommendation', 'Content enters a test pool regardless of follower count. Good numbers mean more distribution. New accounts can break out, at the cost of **having to hook people in the first 3 seconds**. Followers mainly raise your initial view floor; they do not come back to watch on their own. See [getting your first 1,000 followers](/en/guide/first-1000-followers).'],
                ['YouTube: search plus suggested', 'Most traffic is search and "up next" — users actively choose. So **pick topics by search intent, let title and thumbnail drive CTR, and let watch time drive promotion**. New channels start slowly (no search ranking yet), but a well-targeted video brings traffic for two years. See [growing on YouTube](/en/guide/youtube-subscribers).'],
                ['Instagram: two entries in parallel', 'Reels ride the recommendation feed (close to TikTok); feed posts rely on Explore and hashtags (close to Pinterest). The optimization differs, and **mixing them usually means neither works**. See [Instagram growth](/en/guide/instagram-growth).'],
                ['X (Twitter): repost chain plus recency', 'The core signal is **reposts and quote tweets**, not likes. Content lifespan is very short — hours to a day — but one repost from a large account can cause a spike. X suits opinionated, quotable, timely content, not polished long-form. The key is **volume plus catching the day\'s conversation**.'],
                ['Telegram: group spread plus search', 'Not a recommendation platform — a distribution channel. Growth comes from being forwarded into other groups and from Telegram\'s internal search (t.me links are indexable). So channel content must be **worth forwarding**, and the channel name and bio need searchable keywords. Lists and resource dumps travel fastest on Telegram.'],
                ['A side-by-side', 'TikTok: recommendation / first 3 seconds / new accounts viable / content lifespan 2-3 days. YouTube: search / title and thumbnail / slow start / lifespan 1-2 years. Instagram: dual entry / separate optimization / depends on base followers / lifespan 3-7 days. X: repost chain / recency / needs volume / lifespan hours. Telegram: group spread / worth forwarding / search-driven / long-lived.'],
                ['What to actually do', 'With limited time and budget, **pick one platform and go deep** rather than spreading thin across five. Rule of thumb: impulse purchases → TikTok or IG Reels; demand solved by search → YouTube; trust and long-term relationships → Telegram channels. Add the next platform after the first one works; the reverse order means none of them get deep enough.'],
                ['Pricing across platforms', 'The same nominal service costs very different amounts across platforms — YouTube subscribers typically cost several times TikTok followers because delivery is harder. The [price list](/price) normalizes everything per 1,000 for comparison.'],
            ],
        },
    },
];

export const articleOf = (slug) => ARTICLES.find((a) => a.slug === slug) || null;

/**
 * 取某语种下的文章：有对应翻译就用翻译，没有就回退中文。
 *
 * 为什么要回退：18 篇里目前只有运营指南那 8 篇有英文版（下单说明类英文
 * 搜索量低、优先级不高）。回退让 /en/guide/:slug 对任何 slug 都返回 200，
 * 不会出现 404 —— 只是没翻译的那几篇内容是中文。
 *
 * 返回的对象字段名统一成 title/desc/body，渲染层不用关心语言。
 */
export const articleOfLang = (slug, lang = 'zh') => {
    const a = articleOf(slug);
    if (!a) return null;
    const t = lang === 'en' && a.en ? a.en : null;
    if (!t) return a;
    return {
        ...a,
        title: t.title || a.title,
        desc: t.desc || a.desc,
        body: t.body || a.body,
        tag: t.tag || a.tag,
        // 标记这篇到底有没有真正翻译，列表页可以据此只展示有翻译的
        translated: true,
    };
};

/** 该文章是否有指定语种的翻译 */
export const hasLang = (slug, lang) => {
    const a = articleOf(slug);
    if (!a) return false;
    return !!(lang === 'en' && a.en);
};

import Link from 'next/link';

const signalLanes = [
  { label: 'Nguồn public', value: 'RSS · Web/news · Social signals', state: 'đang đọc', tone: 'teal' },
  { label: 'Phân tích', value: 'Sentiment · Risk · Hot keywords', state: 'đang phân lớp', tone: 'sky' },
  { label: 'Phản hồi', value: 'Alerts · Reports · Team workflow', state: 'sẵn sàng', tone: 'amber' },
] as const;

const features = [
  {
    kicker: '01',
    title: 'Theo dõi nguồn public có kiểm soát',
    body: 'Tập trung vào các nguồn đã cấu hình để giảm nhiễu, giữ bối cảnh và tránh đội ngũ phải nối dữ liệu bằng tay.',
  },
  {
    kicker: '02',
    title: 'Đọc tín hiệu trước khi nó thành sự cố',
    body: 'Đặt sentiment, rủi ro và từ khóa nóng vào cùng một luồng quan sát để ưu tiên điều cần xử lý trước.',
  },
  {
    kicker: '03',
    title: 'Từ monitoring sang phản hồi có bối cảnh',
    body: 'Chuyển từ tín hiệu public sang dashboard, báo cáo và quy trình xử lý mà không đánh mất nguồn gốc cuộc thảo luận.',
  },
];

const workflow = ['Lắng nghe', 'Phân lớp', 'Ưu tiên', 'Phản hồi'];

function SignalLane({ item, index }: { item: (typeof signalLanes)[number]; index: number }) {
  const toneClasses = {
    teal: 'border-teal-300/18 bg-teal-300/[0.06] text-teal-100',
    sky: 'border-sky-300/18 bg-sky-300/[0.06] text-sky-100',
    amber: 'border-amber-200/18 bg-amber-200/[0.06] text-amber-100',
  };

  return (
    <div className={`premium-data-row min-w-0 rounded-2xl border p-3.5 ${toneClasses[item.tone]}`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-current/80">{item.state}</span>
      </div>
      <p className="mt-2 break-words text-sm font-medium leading-5 text-slate-100">{item.value}</p>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={`h-1 flex-1 rounded-full ${segment <= index + 1 ? 'bg-current/70' : 'bg-white/[0.08]'}`}
          />
        ))}
      </div>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="premium-preview-stage relative mx-auto w-full max-w-[42rem] min-w-0" aria-label="Conceptual product preview">
      <div className="premium-orbit premium-orbit-one" aria-hidden="true" />
      <div className="premium-orbit premium-orbit-two" aria-hidden="true" />
      <div className="premium-preview-shadow" aria-hidden="true" />

      <div className="premium-product-frame relative min-w-0 rounded-[1.8rem] p-2 sm:rounded-[2.25rem] sm:p-3">
        <div className="premium-product-shell min-w-0 rounded-[1.4rem] p-4 sm:rounded-[1.85rem] sm:p-5">
          <div className="flex min-w-0 flex-col gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-teal-100/70">Nope360 · signal command</p>
              <h2 className="mt-2 break-words text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">Public signal cockpit</h2>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-teal-200/20 bg-teal-200/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-100">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-200 shadow-[0_0_14px_rgba(153,246,228,0.9)]" />
              public signals
            </span>
          </div>

          <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-[1.12fr_0.88fr]">
            <div className="premium-command-map min-w-0 rounded-2xl p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-100">Bản đồ cuộc thảo luận</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">live context</span>
              </div>
              <div className="mt-3 space-y-2.5">
                {signalLanes.map((item, index) => (
                  <SignalLane key={item.label} item={item} index={index} />
                ))}
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="premium-insight-card premium-insight-primary min-w-0 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-teal-100/70">Signal quality</p>
                <p className="mt-3 break-words text-xl font-semibold leading-tight tracking-[-0.035em] text-white">Noise-aware monitoring</p>
                <p className="mt-3 text-sm leading-6 text-teal-50/70">Giữ source context nhìn thấy được trước khi một team hành động.</p>
              </div>
              <div className="premium-insight-card premium-insight-secondary min-w-0 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-100/70">Risk lens</p>
                <p className="mt-3 break-words text-base font-semibold leading-6 text-white">Sentiment · alerts · reports</p>
                <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden="true">
                  <span className="h-1.5 rounded-full bg-teal-200/80" />
                  <span className="h-1.5 rounded-full bg-sky-200/80" />
                  <span className="h-1.5 rounded-full bg-amber-200/80" />
                  <span className="h-1.5 rounded-full bg-rose-200/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PremiumLandingPage() {
  return (
    <main className="premium-landing min-h-[100dvh] bg-[#030812] text-white">
      <div className="premium-decorative-canvas pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="premium-grid-bg absolute inset-0 opacity-35 [mask-image:radial-gradient(circle_at_50%_0%,black,transparent_68%)]" />
        <div className="premium-ambient premium-ambient-top" />
        <div className="premium-ambient premium-ambient-right" />
        <div className="premium-ambient premium-ambient-bottom" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex min-w-0 items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950" aria-label="Nope360 home">
          <span className="premium-logo-mark grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-black text-teal-50">N</span>
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-[0.2em] text-white">NOPE360</span>
            <span className="block text-xs text-slate-400">SocialListening</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex" aria-label="Landing navigation">
          <a href="#signals" className="transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-200">Tín hiệu</a>
          <a href="#workflow" className="transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-200">Quy trình</a>
          <Link href="/login" className="rounded-full border border-white/15 px-4 py-2 font-medium text-white transition hover:border-teal-100/50 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-teal-200">
            Đăng nhập
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pb-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10 lg:px-8 lg:pb-28 lg:pt-16">
        <div className="min-w-0">
          <div className="premium-kicker mb-6 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-teal-50 sm:text-xs">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-200 shadow-[0_0_14px_rgba(153,246,228,0.9)]" />
            Premium public signal intelligence
          </div>
          <h1 className="premium-hero-title max-w-3xl break-words font-black text-white">
            Lắng nghe thị trường trước khi vấn đề thành khủng hoảng.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Nope360 giúp đội ngũ theo dõi mentions, hiểu sắc thái thảo luận và ưu tiên tín hiệu rủi ro từ các nguồn public — trong một không gian làm việc rõ ràng, đáng tin cậy.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <Link href="/login" className="premium-primary-cta inline-flex min-w-0 items-center justify-center rounded-full px-5 py-3.5 text-center text-sm font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950">
              Đăng nhập để bắt đầu
            </Link>
            <Link href="/dashboard" className="premium-secondary-cta inline-flex min-w-0 items-center justify-center rounded-full px-5 py-3.5 text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950">
              Vào dashboard
            </Link>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
            Không cần backend để xem trang giới thiệu. Dữ liệu thật nằm trong workspace sau khi đăng nhập.
          </p>
        </div>

        <ProductPreview />
      </section>

      <section id="signals" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-teal-100/70">Social listening clarity</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Một homepage public, nhưng nói đúng về sản phẩm thật.</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="premium-feature-card min-w-0 rounded-[1.5rem] p-6 sm:p-7">
              <p className="text-xs font-bold tracking-[0.3em] text-teal-100/70">{feature.kicker}</p>
              <h3 className="mt-5 break-words text-xl font-semibold tracking-[-0.025em] text-white">{feature.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-400">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="premium-workflow-shell overflow-hidden rounded-[1.9rem] p-5 sm:rounded-[2.25rem] sm:p-7 lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-100/70">Operating rhythm</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Từ cuộc thảo luận rời rạc đến quyết định có bối cảnh.</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
                Landing page chỉ giới thiệu hướng sản phẩm. Các bước xử lý dữ liệu thật vẫn nằm sau đăng nhập, nơi quyền truy cập và nguồn dữ liệu được kiểm soát.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {workflow.map((step, index) => (
                <div key={step} className="premium-step-card min-w-0 rounded-2xl p-4 text-left sm:p-5 xl:text-center">
                  <div className="premium-step-index grid h-10 w-10 place-items-center rounded-full text-sm font-black text-slate-950 xl:mx-auto">{index + 1}</div>
                  <p className="mt-4 break-words text-sm font-semibold text-slate-100">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Sẵn sàng đưa homepage ra khỏi màn hình đăng nhập?</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
          Bắt đầu bằng đường đăng nhập an toàn hiện có. Không có tính năng giả, không có số liệu bịa, không yêu cầu backend cho phần public landing.
        </p>
        <div className="mx-auto mt-8 grid max-w-md gap-3 sm:grid-cols-2">
          <Link href="/login" className="premium-primary-cta inline-flex items-center justify-center rounded-full px-5 py-3.5 text-sm font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950">
            Đăng nhập
          </Link>
          <Link href="/dashboard" className="premium-secondary-cta inline-flex items-center justify-center rounded-full px-5 py-3.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950">
            Tôi đã có workspace
          </Link>
        </div>
      </section>
    </main>
  );
}

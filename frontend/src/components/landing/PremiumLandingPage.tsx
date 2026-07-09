import Link from 'next/link';

const signals = [
  { label: 'Nguồn public', value: 'RSS · Web/news · Social signals', tone: 'text-cyan-200' },
  { label: 'Phân tích', value: 'Sentiment · Risk · Hot keywords', tone: 'text-violet-200' },
  { label: 'Hành động', value: 'Alerts · Reports · Team workflow', tone: 'text-emerald-200' },
];

const features = [
  {
    kicker: '01',
    title: 'Theo dõi nguồn public có kiểm soát',
    body: 'Tập trung vào các nguồn theo dõi đã cấu hình để giảm nhiễu và giữ bối cảnh nguồn rõ ràng.',
  },
  {
    kicker: '02',
    title: 'Hiểu tín hiệu, không chỉ đếm mentions',
    body: 'Kết hợp sắc thái thảo luận, rủi ro và từ khóa nóng để ưu tiên điều cần xử lý trước.',
  },
  {
    kicker: '03',
    title: 'Từ monitoring sang phản hồi',
    body: 'Giúp team nhìn cùng một bức tranh trước khi chuyển sang dashboard, báo cáo hoặc quy trình xử lý.',
  },
];

const workflow = ['Lắng nghe', 'Phân loại', 'Ưu tiên', 'Báo cáo'];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-2xl lg:max-w-none" aria-label="Conceptual product preview">
      <div className="absolute -inset-8 rounded-[3rem] bg-cyan-400/10 blur-3xl" />
      <div className="absolute -right-8 top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="rounded-[1.45rem] border border-white/10 bg-[#07111f]/95 p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Nope360 Control Room</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Public signal cockpit</h2>
            </div>
            <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
              frontend-only preview
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">Conversation map</span>
                <span className="text-xs text-slate-500">conceptual view</span>
              </div>
              <div className="space-y-3">
                {signals.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</span>
                      <span className={`text-xs font-medium ${item.tone}`}>ready</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Signal quality</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-white">Noise-aware monitoring</p>
                <p className="mt-2 text-sm leading-6 text-cyan-50/70">Designed to keep source context visible before a team acts.</p>
              </div>
              <div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-violet-200/70">Risk lens</p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-white">Sentiment · alerts · reports</p>
                <div className="mt-4 flex gap-2" aria-hidden="true">
                  <span className="h-1.5 flex-1 rounded-full bg-emerald-300/70" />
                  <span className="h-1.5 flex-1 rounded-full bg-cyan-300/70" />
                  <span className="h-1.5 flex-1 rounded-full bg-amber-300/70" />
                  <span className="h-1.5 flex-1 rounded-full bg-rose-300/70" />
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
    <main className="min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80" aria-hidden="true">
        <div className="absolute left-1/2 top-[-12rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-10rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_top,black,transparent_70%)]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="group inline-flex items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950" aria-label="Nope360 home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-950/40">N</span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.2em] text-white">NOPE360</span>
            <span className="block text-xs text-slate-400">SocialListening</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex" aria-label="Landing navigation">
          <a href="#signals" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300">Tín hiệu</a>
          <a href="#workflow" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300">Quy trình</a>
          <Link href="/login" className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:border-cyan-200/60 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300 motion-reduce:transition-none">
            Đăng nhập
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-cyan-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
            Premium public landing
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            Lắng nghe thị trường trước khi vấn đề thành khủng hoảng.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Nope360 giúp đội ngũ theo dõi mentions, hiểu sắc thái thảo luận và ưu tiên tín hiệu rủi ro từ các nguồn public — trong một không gian làm việc rõ ràng, đáng tin cậy.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              Đăng nhập để bắt đầu
            </Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              Vào dashboard
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Không cần backend để xem trang giới thiệu. Dữ liệu thật nằm trong workspace sau khi đăng nhập.
          </p>
        </div>

        <ProductPreview />
      </section>

      <section id="signals" className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/70">Social listening clarity</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Một homepage public, nhưng nói đúng về sản phẩm thật.</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="group rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 backdrop-blur transition hover:-translate-y-1 hover:border-cyan-200/30 hover:bg-white/[0.065] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <p className="text-xs font-semibold tracking-[0.35em] text-cyan-200/70">{feature.kicker}</p>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">{feature.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-400">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-200/70">Operating rhythm</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Từ cuộc thảo luận rời rạc đến quyết định có bối cảnh.</h2>
              <p className="mt-4 text-base leading-7 text-slate-400">
                Landing page chỉ giới thiệu hướng sản phẩm. Các bước xử lý dữ liệu thật vẫn nằm sau đăng nhập, nơi quyền truy cập và nguồn dữ liệu được kiểm soát.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {workflow.map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-semibold text-slate-950">{index + 1}</div>
                  <p className="mt-4 text-sm font-medium text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 text-center lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Sẵn sàng đưa homepage ra khỏi màn hình đăng nhập?</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
          Bắt đầu bằng đường đăng nhập an toàn hiện có. Không có tính năng giả, không có số liệu bịa, không yêu cầu backend cho phần public landing.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-cyan-200 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 motion-reduce:transition-none">
            Đăng nhập
          </Link>
          <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 motion-reduce:transition-none">
            Tôi đã có workspace
          </Link>
        </div>
      </section>
    </main>
  );
}

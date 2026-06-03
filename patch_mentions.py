import re

with open('frontend/src/app/dashboard/mentions/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables near line 250
state_vars = """
  // NEW SCAN STATES
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const [activeScanKeyword, setActiveScanKeyword] = useState<string>('');
  const [scanJobStatus, setScanJobStatus] = useState<any>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);"""
content = re.sub(r'const searchTimeout = useRef<NodeJS.Timeout \| null>\(null\);', state_vars, content, count=1)

# 2. Add handleScanNow and useEffect for polling near line 450
polling_logic = """
  /* ─── SCAN NOW LOGIC ────────────────────────────────────────────────── */
  const handleScanNow = async () => {
    if (!activeProject) {
      toast.error('Vui lòng chọn project trước.');
      return;
    }
    const keyword = searchTerm || 'TTH'; // fallback
    try {
      const res = await crawl.manualScan({
        project_id: activeProject.id,
        keywords: [keyword],
        mode: 'AUTO_DISCOVERY',
        source_ids: [],
      });
      setActiveScanJobId(res.job_id);
      setActiveScanKeyword(keyword);
      setScanJobStatus({ status: 'QUEUED' });
      toast.success(`Đang quét dữ liệu mới cho từ khóa ${keyword}...`);
    } catch (err: any) {
      toast.error('Lỗi khi bắt đầu quét');
    }
  };

  useEffect(() => {
    if (!activeScanJobId) return;

    const interval = setInterval(async () => {
      try {
        const data = await crawl.getJob(activeScanJobId);
        setScanJobStatus(data);
        const status = data.status?.toUpperCase();
        if (['COMPLETED', 'COMPLETED_NO_MENTIONS', 'FAILED', 'PARTIAL_FAILED'].includes(status)) {
          clearInterval(interval);
          if (status === 'FAILED') {
            toast.error(`Lượt quét thất bại: ${data.error_message || ''}`);
          } else {
            // Refetch with this job_id
            setFilters((prev) => ({ ...prev, sentiment: null, source_type: null, min_risk_score: null, min_influence_score: null }));
            const newParams = new URLSearchParams(searchParams?.toString() || '');
            newParams.set('job_id', activeScanJobId.toString());
            router.push(`/dashboard/mentions?${newParams.toString()}`);
            toast.success('Quét hoàn tất!');
            fetchMentions(); // Refresh mentions to ensure job_id is caught
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeScanJobId, router, searchParams]);

  /* ─── PROJECT / SCAN ACTIONS ─────────────────────────────────────────── */
"""
content = content.replace('/* ─── PROJECT / SCAN ACTIONS ─────────────────────────────────────────── */', polling_logic)


# 3. Add Job filter chip to toolbar near "Clear All" button
filter_chip = """
            {initialJobId && (
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams?.toString() || '');
                  newParams.delete('job_id');
                  router.push(`/dashboard/mentions?${newParams.toString()}`);
                  setPage(1);
                  fetchMentions();
                }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
              >
                Lượt quét #{initialJobId}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
"""
content = content.replace('<button\n              onClick={() => { setFilters({ sentiment: null', filter_chip + '              <button\n              onClick={() => { setFilters({ sentiment: null')


# 4. Modify the Scan Now button to call handleScanNow instead of Link to /dashboard/scan
old_scan_btn = """{/* Scan Now Button */}
          <Link
            href="/dashboard/scan"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 hover:text-emerald-200 transition-all"
          >
            <Scan className="w-4 h-4" />
            Scan Now
          </Link>"""

new_scan_btn = """{/* Scan Now Button */}
          <button
            onClick={handleScanNow}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 hover:text-emerald-200 transition-all disabled:opacity-50"
            disabled={activeScanJobId !== null && scanJobStatus?.status !== 'COMPLETED' && scanJobStatus?.status !== 'FAILED'}
          >
            {activeScanJobId !== null && scanJobStatus?.status !== 'COMPLETED' && scanJobStatus?.status !== 'FAILED' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
            Scan Now
          </button>"""
content = content.replace(old_scan_btn, new_scan_btn)

# 5. Add inline status block ABOVE the Mentions List
status_block = """
      {/* ─── LIVE SCAN STATUS ─────────────────────────────────────────────── */}
      {activeScanJobId && (
        <div className="bg-[#1E293B] border border-emerald-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-emerald-400 font-semibold flex items-center gap-2">
              {['COMPLETED', 'FAILED'].includes(scanJobStatus?.status) ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              Job #{activeScanJobId} - {['COMPLETED', 'FAILED'].includes(scanJobStatus?.status) ? 'Hoàn tất' : 'Đang quét'}
            </h3>
            {['COMPLETED', 'FAILED'].includes(scanJobStatus?.status) && (
              <button onClick={() => {setActiveScanJobId(null); setScanJobStatus(null);}} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[#0F172A] rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">SerpAPI</span>
              <span className="text-lg text-white font-medium">{scanJobStatus?.summary?.serpapi_result_count || 0}</span>
            </div>
            <div className="bg-[#0F172A] rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">Đã crawl URL</span>
              <span className="text-lg text-white font-medium">{scanJobStatus?.summary?.urls_crawled || 0}</span>
            </div>
            <div className="bg-[#0F172A] rounded-lg p-3">
              <span className="text-xs text-emerald-500 block mb-1">Mentions mới</span>
              <span className="text-lg text-emerald-400 font-medium">{scanJobStatus?.summary?.new_mentions_created || 0}</span>
            </div>
            <div className="bg-[#0F172A] rounded-lg p-3">
              <span className="text-xs text-orange-500 block mb-1">Trùng lặp (bỏ qua)</span>
              <span className="text-lg text-orange-400 font-medium">{scanJobStatus?.summary?.duplicates_skipped || 0}</span>
            </div>
            <div className="bg-[#0F172A] rounded-lg p-3">
              <span className="text-xs text-rose-500 block mb-1">Lỗi</span>
              <span className="text-lg text-rose-400 font-medium">{scanJobStatus?.summary?.errors?.length || 0}</span>
            </div>
          </div>
          
          {scanJobStatus?.status === 'COMPLETED' && scanJobStatus?.summary?.new_mentions_created > 0 && (
            <p className="mt-4 text-emerald-400 font-medium">Đã tạo {scanJobStatus.summary.new_mentions_created} mentions mới từ lượt quét này.</p>
          )}
          {scanJobStatus?.status === 'COMPLETED' && scanJobStatus?.summary?.new_mentions_created === 0 && scanJobStatus?.summary?.duplicates_skipped > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-orange-400 font-medium">Không có mentions mới. Hệ thống tìm lại {scanJobStatus.summary.duplicates_skipped} kết quả đã tồn tại trước đó.</p>
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams?.toString() || '');
                  newParams.delete('job_id');
                  router.push(`/dashboard/mentions?${newParams.toString()}`);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Xem tất cả mentions của project
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MAIN LAYOUT ─────────────────────────────────────────────────── */}
"""
content = content.replace('{/* ─── MAIN LAYOUT ─────────────────────────────────────────────────── */}', status_block)

# 6. Change no results text
old_no_results = """<p className="text-gray-400 font-medium">Không tìm thấy mentions nào</p>
                  <p className="text-gray-500 text-sm mt-2">Thử thay đổi bộ lọc hoặc chạy quét mới</p>"""
new_no_results = """<p className="text-gray-400 font-medium">Không tìm thấy bài viết/web page phù hợp với từ khóa này.</p>
                  <p className="text-gray-500 text-sm mt-2">Thử thay đổi bộ lọc hoặc chạy quét mới</p>"""
content = content.replace(old_no_results, new_no_results)

with open('frontend/src/app/dashboard/mentions/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated mentions page.tsx")

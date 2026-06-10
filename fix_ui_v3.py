import re

filepath = "frontend/src/app/dashboard/mentions/page.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Fix total label
content = content.replace(
    """{loading ? 'Đang tải...' : totalMentions >= 0 ? `${totalMentions.toLocaleString()} kết quả ${searchTerm ? `cho '${searchTerm}'` : ''}` : 'Đang tải...'}""",
    """{loading && !mentionsList.length ? 'Đang tải...' : totalMentions >= 0 ? `${totalMentions.toLocaleString()} kết quả ${searchTerm ? `cho '${searchTerm}'` : ''}` : 'Đang tải...'}"""
)

# We will replace from {loading && !mentionsList.length && ... ? ( up to {/* Bulk Action Bar */}
start_marker = "          {loading && !mentionsList.length && searchState !== 'AUTO_SCAN_STARTING' && searchState !== 'AUTO_SCAN_RUNNING' ? ("
end_marker = "              {/* Bulk Action Bar */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

new_code = """          {loading && !mentionsList.length ? (
            <div className="py-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col sm:flex-row gap-4 p-5 bg-white dark:bg-[#050A15] border border-gray-200 dark:border-white/10 rounded-xl">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-xl"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : mentionsList.length === 0 ? (
            searchState === 'TYPING' ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
              </div>
            ) : searchState === 'SEARCHING_DB' ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-500">Đang tìm mentions hiện có liên quan đến '{searchTerm}'...</p>
              </div>
            ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</h3>
                <p className="text-gray-500 dark:text-gray-500 mb-4">Hệ thống đang quét Web Search, YouTube và các nguồn đã cấu hình.</p>
                {activeProject && searchTerm.toLowerCase().trim() !== activeProject.name.toLowerCase().trim() && !activeProject.name.toLowerCase().trim().includes(searchTerm.toLowerCase().trim()) && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs px-3 py-1.5 rounded-md mb-4 border border-yellow-200 dark:border-yellow-800/30">
                    <span className="font-semibold">Lưu ý:</span> Đang tìm '{searchTerm}' trong project '{activeProject.name}'
                  </div>
                )}
                {scanJobStatus?.status && (
                   <div className="flex flex-col items-center text-sm text-gray-400 gap-1">
                     <span>Trạng thái: {scanJobStatus.status} {activeScanJobId && `(Lượt quét #${activeScanJobId})`}</span>
                   </div>
                )}
              </div>
            ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
              <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-4 mb-6 text-sm text-gray-500 dark:text-gray-400 max-w-md text-left w-full space-y-2">
                   <p className="font-semibold text-gray-700 dark:text-gray-300">Kết quả quét ({scanJobStatus?.job_id}):</p>
                   <p>• Web Search: {scanJobStatus?.summary?.web?.called ? `${scanJobStatus.summary.web.raw_results_count} kết quả thô, ${scanJobStatus.summary.web.results_after_keyword_match} phù hợp` : 'Bỏ qua'}</p>
                   <p>• YouTube: {scanJobStatus?.summary?.youtube?.called ? `${scanJobStatus.summary.youtube.raw_results_count} video` : 'Bỏ qua'}</p>
                   <p>• Trùng lặp đã bỏ qua: {scanJobStatus?.summary?.duplicates_skipped || 0}</p>
                </div>
                <div className="flex gap-3">
                   <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                   <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
                </div>
              </div>
            ) : searchState === 'NO_LOCAL_RESULTS' ? (
              <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
                {searchTerm.length < 2 && (
                  <p className="text-gray-500 dark:text-gray-500 mb-6 max-w-sm">Từ khóa quá ngắn để tự động quét internet (cần ít nhất 2 ký tự).</p>
                )}
                <button 
                  onClick={handleScanClick}
                  disabled={activeScanJobId !== null || searchTerm.length < 2}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  Scan Now
                </button>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
                <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {loading && (
                <div className="flex items-center justify-center py-2 text-blue-500 text-sm font-medium gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu...
                </div>
              )}
              {searchState === 'TYPING' && !loading && (
                <div className="flex items-center justify-center py-2 text-gray-500 text-sm font-medium gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang nhập từ khóa...
                </div>
              )}
              {['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 mb-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                    Hệ thống đang tự động quét thêm kết quả mới cho '{searchTerm}' ở chế độ nền...
                  </span>
                </div>
              )}
              {searchState === 'AUTO_SCAN_COMPLETED' && scanJobStatus && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3 border-b border-emerald-200/50 dark:border-emerald-800/30 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm text-emerald-800 dark:text-emerald-300 font-bold">
                        Quét hoàn tất (Job #{scanJobStatus.job_id})
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-800 dark:text-emerald-200/80">
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Query gốc:</span> {scanJobStatus.meta_data?.query || searchTerm}</div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Nguồn quét:</span> {scanJobStatus.summary?.adapters_ready?.join(', ') || 'Tất cả'}</div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Kết quả (Raw):</span> {scanJobStatus.summary?.serpapi_result_count || 0}</div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Tạo mới:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{scanJobStatus.summary?.new_mentions_created || 0} mentions</span></div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Bỏ qua (Duplicate):</span> {scanJobStatus.summary?.duplicates_skipped || 0}</div>
                  </div>
                </div>
              )}
"""

content = content[:start_idx] + new_code + content[end_idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("UI Fixed Correctly.")

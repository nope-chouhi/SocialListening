import re

with open("frontend/src/app/dashboard/mentions/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Update polling logic
pattern_polling = r"if \(\['COMPLETED', 'COMPLETED_NO_MENTIONS', 'FAILED', 'PARTIAL_FAILED'\]\.includes\(status\)\) \{"
replacement_polling = r"if (['COMPLETED', 'COMPLETED_NO_RESULTS', 'FAILED', 'PARTIAL_FAILED', 'TIMEOUT'].includes(status)) {"
content = re.sub(pattern_polling, replacement_polling, content)

# Update UI block for finished states
pattern_ui = r"\{activeScanJobId && scanJobStatus && scanJobStatus\.status === 'COMPLETED' && \("
replacement_ui = r"{activeScanJobId && scanJobStatus && ['COMPLETED', 'COMPLETED_NO_RESULTS', 'FAILED', 'PARTIAL_FAILED', 'TIMEOUT'].includes(scanJobStatus.status) && ("
content = re.sub(pattern_ui, replacement_ui, content)

# Update UI block for hiding when not completed
pattern_ui2 = r"\{activeScanJobId && scanJobStatus && scanJobStatus\.status !== 'COMPLETED' && scanJobStatus\.status !== 'FAILED' && \("
replacement_ui2 = r"{activeScanJobId && scanJobStatus && !['COMPLETED', 'COMPLETED_NO_RESULTS', 'FAILED', 'PARTIAL_FAILED', 'TIMEOUT'].includes(scanJobStatus.status) && ("
content = re.sub(pattern_ui2, replacement_ui2, content)

# Also update the text inside the COMPLETED block to show specific messages
def replacer(match):
    return """{activeScanJobId && scanJobStatus && ['COMPLETED', 'COMPLETED_NO_RESULTS', 'FAILED', 'PARTIAL_FAILED', 'TIMEOUT'].includes(scanJobStatus.status) && (
            <div className={`bg-[#111827] border rounded-xl p-5 mb-6 shadow-sm ${scanJobStatus.status === 'FAILED' || scanJobStatus.status === 'TIMEOUT' ? 'border-rose-500/30 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]' : 'border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'}`}>
               <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${scanJobStatus.status === 'FAILED' || scanJobStatus.status === 'TIMEOUT' ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>
                   {scanJobStatus.status === 'FAILED' || scanJobStatus.status === 'TIMEOUT' ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                 </div>
                 <div>
                   <h3 className={`text-sm font-semibold ${scanJobStatus.status === 'FAILED' || scanJobStatus.status === 'TIMEOUT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                     {scanJobStatus.status === 'COMPLETED' ? 'Quét hoàn tất!' : 
                      scanJobStatus.status === 'COMPLETED_NO_RESULTS' ? 'Hoàn tất (Không có kết quả)' :
                      scanJobStatus.status === 'PARTIAL_FAILED' ? 'Hoàn tất (Có lỗi)' :
                      scanJobStatus.status === 'TIMEOUT' ? 'Lượt quét quá lâu' : 'Quét thất bại'}
                   </h3>
                   <p className="text-xs text-gray-400 mt-1">
                     {scanJobStatus.status === 'TIMEOUT' ? 'Lượt quét quá lâu. Kiểm tra backend job hoặc API provider.' :
                      scanJobStatus.error_message ? scanJobStatus.error_message :
                      scanJobStatus.summary?.new_mentions_created > 0 
                       ? `Đã tạo ${scanJobStatus.summary.new_mentions_created} mentions mới từ lượt quét này.` 
                       : scanJobStatus.summary?.duplicates_skipped > 0 
                         ? `Không có mentions mới. Hệ thống tìm lại ${scanJobStatus.summary.duplicates_skipped} kết quả đã tồn tại trước đó.`
                         : `Không tìm thấy bài viết/web page phù hợp với từ khóa này.`
                     }
                   </p>
                 </div>
                 <button onClick={() => { setActiveScanJobId(null); setScanJobStatus(null); }} className="ml-auto text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
               </div>
            </div>
          )}"""

pattern_replace_box = r"\{activeScanJobId && scanJobStatus && \['COMPLETED', 'COMPLETED_NO_RESULTS', 'FAILED', 'PARTIAL_FAILED', 'TIMEOUT'\]\.includes\(scanJobStatus\.status\) && \([\s\S]*?<button onClick=\{\(\) => \{ setActiveScanJobId\(null\); setScanJobStatus\(null\); \}\}.*?</div>\s*</div>\s*\)\}"

content = re.sub(pattern_replace_box, replacer, content)

with open("frontend/src/app/dashboard/mentions/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Frontend patch done.")

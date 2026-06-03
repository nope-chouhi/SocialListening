import re

file_path = "frontend/src/app/dashboard/mentions/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# First, remove the auto-trigger useEffect
bad_use_effect = """  const scannedKeywordsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && totalMentions === 0 && searchTerm && !initialJobId && !activeScanJobId) {
      const keywordLower = searchTerm.toLowerCase().trim();
      if (!scannedKeywordsRef.current.has(keywordLower)) {
        scannedKeywordsRef.current.add(keywordLower);
        executeScan(searchTerm);
      }
    }
  }, [loading, totalMentions, searchTerm, initialJobId, activeScanJobId]);"""

content = content.replace(bad_use_effect, "  const scannedKeywordsRef = useRef<Set<string>>(new Set());")

# Now, add it inside fetchMentions
bad_fetch = """      const data = await mentionsApi.list(params);
      setMentionsList(data.items);
      setTotalMentions(data.total);
      setTotalPages(data.total_pages);
    } catch (error: any) {"""

good_fetch = """      const data = await mentionsApi.list(params);
      setMentionsList(data.items);
      setTotalMentions(data.total);
      setTotalPages(data.total_pages);

      // Auto-trigger scan if 0 results
      if (data.total === 0 && params.q && !initialJobId && !activeScanJobId) {
        const keywordLower = params.q.toLowerCase().trim();
        if (!scannedKeywordsRef.current?.has(keywordLower)) {
          scannedKeywordsRef.current?.add(keywordLower);
          
          // Call scan immediately
          if (activeProject) {
            try {
              toast.success(`Đang tự động quét mạng cho từ khóa: ${params.q}...`);
              const res = await crawl.manualScan({
                project_id: activeProject.id,
                keywords: [params.q],
                mode: 'AUTO_DISCOVERY',
                source_ids: [],
              });
              setActiveScanJobId(res.job_id);
              setActiveScanKeyword(params.q);
              setScanJobStatus({ status: 'QUEUED' });
            } catch (err) {
              console.error('Scan error:', err);
              toast.error('Lỗi khi tự động quét dữ liệu');
            }
          }
        }
      }
    } catch (error: any) {"""

content = content.replace(bad_fetch, good_fetch)

# Also fix the empty state UI to just show a button that says "Thử quét lại" if there is no activeScanJobId
bad_ui = """                activeScanJobId ? (
                  <>
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-white font-medium text-lg">Đang tự động quét toàn mạng cho từ khóa '{searchTerm}'...</p>
                    <p className="text-gray-500 text-sm mt-2">Vui lòng đợi trong giây lát, hệ thống đang thu thập dữ liệu từ đa nền tảng.</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 font-medium text-lg">Không có mentions hiện có trong project {activeProject?.name} khớp với từ khóa '{searchTerm}'.</p>
                    <p className="text-gray-500 text-sm mt-2 mb-6">Hệ thống đang tự động kích hoạt tiến trình quét dữ liệu mới từ internet...</p>
                    <button
                      onClick={handleScanClick}
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                    >
                      <Scan className="w-4 h-4" />
                      Scan dữ liệu mới cho từ khóa {searchTerm}
                    </button>
                  </>
                )"""

good_ui = """                activeScanJobId ? (
                  <>
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-white font-medium text-lg">Đang tự động quét toàn mạng cho từ khóa '{searchTerm}'...</p>
                    <p className="text-gray-500 text-sm mt-2">Vui lòng đợi trong giây lát, hệ thống đang thu thập dữ liệu từ đa nền tảng.</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 font-medium text-lg">Chưa có dữ liệu cho '{searchTerm}' trong cơ sở dữ liệu.</p>
                    <p className="text-gray-500 text-sm mt-2 mb-6">Bạn có thể ép hệ thống quét lại mạng lưới nếu tiến trình tự động bị lỗi.</p>
                    <button
                      onClick={handleScanClick}
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                    >
                      <Scan className="w-4 h-4" />
                      Thử quét lại trên internet
                    </button>
                  </>
                )"""

content = content.replace(bad_ui, good_ui)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Mentions scan patched")

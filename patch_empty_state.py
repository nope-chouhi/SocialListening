import re

file_path = "frontend/src/app/dashboard/mentions/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

bad_block = """          ) : mentionsList.length === 0 ? (
            <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              {searchTerm ? (
                <>
                  <p className="text-gray-400 font-medium text-lg">Không có mentions hiện có trong project {activeProject?.name} khớp với từ khóa '{searchTerm}'.</p>
                  <p className="text-gray-500 text-sm mt-2 mb-6">Bạn có thể dùng nút Scan Now để quét dữ liệu mới từ internet cho từ khóa này.</p>
                  <button
                    onClick={handleScanClick}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    <Scan className="w-4 h-4" />
                    Scan dữ liệu mới cho từ khóa {searchTerm}
                  </button>
                </>
              ) : ("""

good_block = """          ) : mentionsList.length === 0 ? (
            <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
              {!activeScanJobId && <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />}
              {searchTerm ? (
                activeScanJobId ? (
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
                )
              ) : ("""

content = content.replace(bad_block, good_block)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Mentions empty state UI patched")

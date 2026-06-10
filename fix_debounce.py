import re

filepath = "frontend/src/app/dashboard/mentions/page.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: TopBar search effect
old_search_effect = """  useEffect(() => {
    const q = searchParams?.get('q') || searchParams?.get('keyword') || '';
    if (q !== searchTerm) {
      setSearchTerm(q);
      setSearchInput(q);
      setPage(1);
      // Reset scanned keywords when query changes so new scan triggers
      if (q) {
        scannedKeywordsRef.current?.clear();
        setSearchState('SEARCHING_DB');
      } else {
        setSearchState('IDLE');
      }
    }
  }, [searchParams]);"""

new_search_effect = """  useEffect(() => {
    const q = searchParams?.get('q') || searchParams?.get('keyword') || '';
    if (q !== searchTerm) {
      setSearchTerm(q);
      setSearchInput(q);
      setPage(1);
      // Reset scanned keywords when query changes so new scan triggers
      if (q) {
        scannedKeywordsRef.current?.clear();
        setSearchState('SEARCHING_DB');
      } else {
        setSearchState('IDLE');
      }
    } else {
      setSearchState(prev => prev === 'TYPING' ? (q ? 'LOCAL_RESULTS_FOUND' : 'IDLE') : prev);
    }
  }, [searchParams, searchTerm]);"""

content = content.replace(old_search_effect, new_search_effect)

# Fix 2: handleSearchChange
old_handle_search = """  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setSearchState('TYPING');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(val);
      if (val) {
        scannedKeywordsRef.current?.clear();
      }
    }, 400);
  };"""

new_handle_search = """  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setSearchState('TYPING');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (val !== searchTerm) {
        setSearchTerm(val);
        if (val) {
          scannedKeywordsRef.current?.clear();
        }
      } else {
        setSearchState(val ? 'LOCAL_RESULTS_FOUND' : 'IDLE');
      }
    }, 400);
  };"""

content = content.replace(old_handle_search, new_handle_search)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Debounce fix applied.")

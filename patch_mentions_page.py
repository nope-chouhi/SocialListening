import re

mentions_page_path = "frontend/src/app/dashboard/mentions/page.tsx"
with open(mentions_page_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the project change effect
old_effect = """  useEffect(() => {
    // Reset state on project change to prevent stale data
    setMentionsList([]);
    setPage(1);
    // Note: We don't reset searchTerm here because user might be typing before switching,
    // or we might want to keep the filter. But we must clear stale job_id to prevent showing wrong job.
    const newParams = new URLSearchParams(searchParams?.toString() || '');
    if (newParams.has('job_id')) {
      newParams.delete('job_id');
      router.push(`/dashboard/mentions?${newParams.toString()}`);
    }
  }, [activeProject?.id]);"""

new_effect = """  useEffect(() => {
    // Reset state on project change to prevent stale data
    setMentionsList([]);
    setPage(1);
    
    // Always sync the URL project_id with activeProject.id so that navigations work properly
    const newParams = new URLSearchParams(searchParams?.toString() || '');
    let urlChanged = false;
    if (newParams.has('job_id')) {
      newParams.delete('job_id');
      urlChanged = true;
    }
    if (activeProject && activeProject.id.toString() !== newParams.get('project_id')) {
      newParams.set('project_id', activeProject.id.toString());
      urlChanged = true;
    }
    if (urlChanged) {
      router.replace(`/dashboard/mentions?${newParams.toString()}`);
    }
    
    // Force a fetch when project changes
    fetchMentions();
  }, [activeProject?.id, searchParams]); // add searchParams to safely read it, but wait, then it runs on any URL change!
"""

# Let's write a safer effect
safer_effect = """  useEffect(() => {
    // Reset state on project change to prevent stale data
    setMentionsList([]);
    setPage(1);
    
    const newParams = new URLSearchParams(searchParams?.toString() || '');
    if (newParams.has('job_id')) {
      newParams.delete('job_id');
      router.replace(`/dashboard/mentions?${newParams.toString()}`);
    }
    
    // Explicitly call fetchMentions here to ensure it loads immediately on project switch
    fetchMentions();
  }, [activeProject?.id]); // DO NOT add searchParams to deps of this effect
"""

if "fetchMentions();\n  }, [activeProject?.id]);" not in content:
    content = content.replace(old_effect, safer_effect)

with open(mentions_page_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Mentions page patched")

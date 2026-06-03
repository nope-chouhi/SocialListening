import re

file_path = "frontend/src/contexts/ProjectContext.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

bad_block_1 = """  const [activeProject, setActiveProject] = useState<KeywordGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await keywordsApi.listGroups();
      setProjects(data);
      
      // If we have projects but no active project, we could auto-select the first one.
      // But let's leave it null to mean "All Projects" or prompt user to select.
      // Actually, Brand24 requires a project to be selected. Let's auto-select the first one if none selected.
      if (data.length > 0) {
        setActiveProject((prev) => {
          if (!prev) return data[0];
          const stillExists = data.find((p: KeywordGroup) => p.id === prev.id);
          return stillExists || data[0];
        });
      } else {
        setActiveProject(null);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);"""

good_block_1 = """  const [activeProject, setActiveProject] = useState<KeywordGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const setAndSaveActiveProject = useCallback((project: KeywordGroup | null) => {
    setActiveProject(project);
    if (project) {
      localStorage.setItem('nope_active_project_id', project.id.toString());
    } else {
      localStorage.removeItem('nope_active_project_id');
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await keywordsApi.listGroups();
      setProjects(data);
      
      if (data.length > 0) {
        setActiveProject((prev) => {
          if (prev) {
            const stillExists = data.find((p: KeywordGroup) => p.id === prev.id);
            return stillExists || data[0];
          }
          const savedId = localStorage.getItem('nope_active_project_id');
          if (savedId) {
             const found = data.find((p: KeywordGroup) => p.id.toString() === savedId);
             if (found) return found;
          }
          return data[0];
        });
      } else {
        setActiveProject(null);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);"""

content = content.replace(bad_block_1, good_block_1)

content = content.replace(
    "setActiveProject,",
    "setActiveProject: setAndSaveActiveProject,"
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("ProjectContext patched")

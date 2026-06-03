'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { keywords as keywordsApi } from '@/lib/api';

export interface KeywordGroup {
  id: number;
  name: string;
  description: string | null;
  priority: number;
  alert_threshold: number;
  is_active: boolean;
  keyword_count?: number;
  created_at: string;
}

interface ProjectContextType {
  projects: KeywordGroup[];
  activeProject: KeywordGroup | null;
  loading: boolean;
  setActiveProject: (project: KeywordGroup | null) => void;
  fetchProjects: () => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<KeywordGroup[]>([]);
  const [activeProject, setActiveProject] = useState<KeywordGroup | null>(null);
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
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      loading,
      setActiveProject: setAndSaveActiveProject,
      fetchProjects,
      refreshProjects: fetchProjects
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

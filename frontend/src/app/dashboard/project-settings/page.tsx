'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, RefreshCcw, Save, Tag, Search } from 'lucide-react';
import { keywords as keywordsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';

interface KeywordGroup {
  id: number;
  name: string;
  description?: string;
  keywords?: Keyword[];
}

interface Keyword {
  id: number;
  keyword: string;
  is_active: boolean;
  keyword_type: string;
}

export default function ProjectSettingsPage() {
  const { activeProject, projects } = useProject();
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newKeywords, setNewKeywords] = useState<Record<number, string>>({});
  const [addingGroup, setAddingGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [activeProject?.id]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const groupList: KeywordGroup[] = await keywordsApi.listGroups();
      // Load keywords for each group
      const withKeywords = await Promise.all(
        groupList.map(async (g) => {
          try {
            const kws = await keywordsApi.listKeywordsInGroup(g.id);
            return { ...g, keywords: kws };
          } catch {
            return { ...g, keywords: [] };
          }
        })
      );
      setGroups(withKeywords);
    } catch {
      toast.error('Lỗi tải keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) { toast.error('Vui lòng nhập tên nhóm'); return; }
    try {
      setAddingGroup(true);
      await keywordsApi.createGroup({ name });
      setNewGroupName('');
      toast.success(`Đã tạo nhóm "${name}"`);
      fetchGroups();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Lỗi tạo nhóm');
    } finally {
      setAddingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!window.confirm(`Xóa nhóm "${groupName}" và tất cả keywords bên trong?`)) return;
    try {
      await keywordsApi.deleteGroup(groupId);
      toast.success('Đã xóa nhóm');
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Lỗi xóa nhóm');
    }
  };

  const handleAddKeyword = async (groupId: number) => {
    const rawInput = (newKeywords[groupId] || '').trim();
    if (!rawInput) { toast.error('Vui lòng nhập từ khóa'); return; }
    const kwList = rawInput.split(',').map(k => k.trim()).filter(Boolean);
    if (kwList.length === 0) { toast.error('Không có từ khóa hợp lệ'); return; }
    try {
      if (kwList.length === 1) {
        await keywordsApi.createKeyword({ group_id: groupId, keyword: kwList[0] });
      } else {
        await keywordsApi.createKeywordsBulk({ group_id: groupId, keywords: kwList });
      }
      setNewKeywords({ ...newKeywords, [groupId]: '' });
      toast.success(`Đã thêm ${kwList.length} từ khóa`);
      fetchGroups();
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '';
      if (detail.toLowerCase().includes('duplicate') || detail.toLowerCase().includes('already exists')) {
        toast.error('Từ khóa đã tồn tại trong nhóm này');
      } else {
        toast.error(detail || 'Lỗi thêm từ khóa');
      }
    }
  };

  const handleDeleteKeyword = async (keywordId: number, keyword: string) => {
    try {
      await keywordsApi.deleteKeyword(keywordId);
      toast.success(`Đã xóa "${keyword}"`);
      fetchGroups();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Lỗi xóa từ khóa');
    }
  };

  const handleToggleKeyword = async (kw: Keyword) => {
    try {
      await keywordsApi.updateKeyword(kw.id, { is_active: !kw.is_active });
      fetchGroups();
    } catch {
      toast.error('Lỗi cập nhật trạng thái từ khóa');
    }
  };

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-wide flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-500" />
          Project Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Quản lý keyword groups, từ khóa theo dõi
          {activeProject ? ` cho project: ${activeProject.name}` : ''}.
        </p>
      </div>

      {/* Keyword Groups */}
      <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" />
            Keyword Groups
          </h2>
          <button
            onClick={fetchGroups}
            disabled={loading}
            className="text-gray-400 hover:text-indigo-500 transition-colors"
            title="Làm mới"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Add Group */}
        <div className="flex gap-3 mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
            placeholder="Tên nhóm từ khóa mới..."
            className="flex-1 bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAddGroup}
            disabled={addingGroup}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {addingGroup ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Tạo nhóm
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCcw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Đang tải...
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Chưa có keyword group. Tạo nhóm đầu tiên bên trên.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-gray-900 dark:text-white">{group.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                      {(group.keywords || []).length} từ khóa
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id, group.name); }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Xóa nhóm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-gray-400 text-xs">{expandedGroup === group.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expandedGroup === group.id && (
                  <div className="p-4 space-y-3">
                    {/* Add keyword */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeywords[group.id] || ''}
                        onChange={e => setNewKeywords({ ...newKeywords, [group.id]: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleAddKeyword(group.id)}
                        placeholder="Nhập từ khóa, cách nhau bởi dấu phẩy..."
                        className="flex-1 bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleAddKeyword(group.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Thêm
                      </button>
                    </div>

                    {/* Keywords list */}
                    {(group.keywords || []).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">Nhóm chưa có từ khóa nào</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(group.keywords || []).map((kw) => (
                          <div
                            key={kw.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                              kw.is_active
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                                : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-500 opacity-60'
                            }`}
                          >
                            <span
                              className="cursor-pointer hover:opacity-70"
                              onClick={() => handleToggleKeyword(kw)}
                              title={kw.is_active ? 'Click để tắt' : 'Click để bật'}
                            >
                              {kw.keyword}
                            </span>
                            <button
                              onClick={() => handleDeleteKeyword(kw.id, kw.keyword)}
                              className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { keywords as keywordsApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Keyword {
  id: number;
  keyword: string;
  keyword_type: string;
  is_active: boolean;
  created_at: string;
  group_id: number;
}

interface KeywordGroup {
  id: number;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  keyword_count: number;
  created_at: string;
}

export default function KeywordsPage() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [groupKeywords, setGroupKeywords] = useState<Record<number, Keyword[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showAddKeywordModal, setShowAddKeywordModal] = useState(false);
  const [showEditKeywordModal, setShowEditKeywordModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<{ isOpen: boolean; groupId: number | null; groupName: string }>({
    isOpen: false,
    groupId: null,
    groupName: ''
  });
  const [deleteKeywordConfirm, setDeleteKeywordConfirm] = useState<{ isOpen: boolean; keywordId: number | null; keyword: string; groupId: number | null }>({
    isOpen: false,
    keywordId: null,
    keyword: '',
    groupId: null
  });
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    priority: 3
  });
  
  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    keyword_type: 'general'
  });
  const [showBulkKeywordModal, setShowBulkKeywordModal] = useState(false);
  const [bulkKeyword, setBulkKeyword] = useState({
    keywords_text: '',
    keyword_type: 'general'
  });

  const KEYWORD_TYPES = [
    { value: 'general', label: 'Chung' },
    { value: 'brand', label: 'Thương hiệu' },
    { value: 'competitor', label: 'Đối thủ' },
    { value: 'person', label: 'Cá nhân' },
    { value: 'service', label: 'Dịch vụ' },
    { value: 'location', label: 'Địa điểm' },
    { value: 'hashtag', label: 'Hashtag' },
    { value: 'negative_phrase', label: 'Cụm tiêu cực' },
    { value: 'positive_phrase', label: 'Cụm tích cực' },
  ];

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await keywordsApi.listGroups();
      setGroups(data);
      // Pre-fetch keywords for global search
      data.forEach((g: KeywordGroup) => {
        keywordsApi.listKeywordsInGroup(g.id).then((kws) => {
          setGroupKeywords(prev => ({ ...prev, [g.id]: kws }));
        }).catch(() => {});
      });
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      toast.error('Lỗi khi tải danh sách nhóm từ khóa');
    } finally {
      setLoading(false);
    }
  };

  const fetchKeywordsInGroup = async (groupId: number) => {
    try {
      const data = await keywordsApi.listKeywordsInGroup(groupId);
      setGroupKeywords(prev => ({ ...prev, [groupId]: data }));
    } catch (error: any) {
      console.error('Error fetching keywords:', error);
      toast.error('Lỗi khi tải từ khóa');
    }
  };

  const toggleGroup = async (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
      if (!groupKeywords[groupId]) {
        await fetchKeywordsInGroup(groupId);
      }
    }
    setExpandedGroups(newExpanded);
  };

  const handleAddGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error('Vui lòng nhập tên nhóm');
      return;
    }

    try {
      await keywordsApi.createGroup({
        name: newGroup.name,
        description: newGroup.description || undefined,
        priority: newGroup.priority,
        is_active: true
      } as any);
      
      setShowAddGroupModal(false);
      setNewGroup({ name: '', description: '', priority: 3 });
      toast.success('Thêm nhóm thành công!');
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding group:', error);
      toast.error('Lỗi khi thêm nhóm');
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.keyword.trim() || !selectedGroupId) {
      toast.error('Vui lòng nhập từ khóa');
      return;
    }

    try {
      await keywordsApi.createKeyword({
        keyword: newKeyword.keyword,
        keyword_type: newKeyword.keyword_type,
        group_id: selectedGroupId,
        is_active: true,
      });
      
      setShowAddKeywordModal(false);
      setNewKeyword({ keyword: '', keyword_type: 'general' });
      toast.success('Thêm từ khóa thành công!');
      
      await fetchKeywordsInGroup(selectedGroupId);
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding keyword:', error);
      if (error.response?.status === 409) {
        toast('Từ khóa đã tồn tại trong nhóm này', { icon: 'ℹ️' });
      } else {
        toast.error(error.response?.data?.detail || 'Lỗi khi thêm từ khóa');
      }
    }
  };

  const handleAddBulkKeyword = async () => {
    if (!bulkKeyword.keywords_text.trim() || !selectedGroupId) {
      toast.error('Vui lòng nhập từ khóa');
      return;
    }
    const lines = bulkKeyword.keywords_text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast.error('Vui lòng nhập ít nhất 1 từ khóa');
      return;
    }

    try {
      const result = await keywordsApi.createKeywordsBulk({
        group_id: selectedGroupId,
        keywords: lines,
        keyword_type: bulkKeyword.keyword_type,
        is_active: true
      });
      
      setShowBulkKeywordModal(false);
      setBulkKeyword({ keywords_text: '', keyword_type: 'general' });
      toast.success(`Đã thêm ${result.created_count} từ khóa, bỏ qua ${result.skipped_count} từ khóa trùng`);
      
      await fetchKeywordsInGroup(selectedGroupId);
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding bulk keywords:', error);
      toast.error(error.response?.data?.detail || 'Lỗi khi thêm từ khóa hàng loạt');
    }
  };

  const handleEditKeyword = async () => {
    if (!selectedKeyword || !selectedKeyword.keyword.trim()) {
      toast.error('Vui lòng nhập từ khóa');
      return;
    }

    try {
      await keywordsApi.updateKeyword(selectedKeyword.id, {
        keyword: selectedKeyword.keyword,
        keyword_type: selectedKeyword.keyword_type,
        is_active: selectedKeyword.is_active,
      });
      
      setShowEditKeywordModal(false);
      setSelectedKeyword(null);
      toast.success('Cập nhật từ khóa thành công!');
      
      await fetchKeywordsInGroup(selectedKeyword.group_id);
      fetchGroups();
    } catch (error: any) {
      console.error('Error updating keyword:', error);
      toast.error('Lỗi khi cập nhật từ khóa');
    }
  };

  const openEditKeywordModal = (keyword: Keyword) => {
    setSelectedKeyword({ ...keyword });
    setShowEditKeywordModal(true);
  };

  const handleDeleteKeyword = async () => {
    if (!deleteKeywordConfirm.keywordId || !deleteKeywordConfirm.groupId) return;

    try {
      await keywordsApi.deleteKeyword(deleteKeywordConfirm.keywordId);
      toast.success('Xóa từ khóa thành công!');
      
      await fetchKeywordsInGroup(deleteKeywordConfirm.groupId);
      fetchGroups();
    } catch (error: any) {
      console.error('Error deleting keyword:', error);
      toast.error('Lỗi khi xóa từ khóa');
    }
  };

  const handleToggleKeywordActive = async (keyword: Keyword) => {
    try {
      await keywordsApi.updateKeyword(keyword.id, {
        is_active: !keyword.is_active
      });
      
      await fetchKeywordsInGroup(keyword.group_id);
    } catch (error: any) {
      console.error('Error toggling keyword:', error);
      toast.error('Lỗi khi cập nhật từ khóa');
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupConfirm.groupId) return;

    try {
      await keywordsApi.deleteGroup(deleteGroupConfirm.groupId);
      toast.success('Xóa nhóm thành công!');
      fetchGroups();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error('Lỗi khi xóa nhóm');
    }
  };

  const openAddKeywordModal = (groupId: number) => {
    setSelectedGroupId(groupId);
    setShowAddKeywordModal(true);
  };

  const openBulkKeywordModal = (groupId: number) => {
    setSelectedGroupId(groupId);
    setShowBulkKeywordModal(true);
  };

  const filteredGroups = groups.filter(g => {
    const term = searchTerm.toLowerCase();
    if (g.name.toLowerCase().includes(term)) return true;
    if (groupKeywords[g.id]) {
      return groupKeywords[g.id].some(k => k.keyword.toLowerCase().includes(term));
    }
    return false;
  });

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'bg-red-100 text-red-800';
    if (priority >= 3) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getPriorityText = (priority: number) => {
    if (priority >= 4) return 'Cao';
    if (priority >= 3) return 'Trung bình';
    return 'Thấp';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-500 dark:text-gray-400 font-medium tracking-wide">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Quản lý từ khóa</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Quản lý các nhóm từ khóa và từ khóa để giám sát
          </p>
        </div>
        <button
          onClick={() => setShowAddGroupModal(true)}
          className="flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-sm shadow-indigo-500/20 font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm nhóm
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm nhóm từ khóa hoặc từ khóa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 shadow-sm transition-shadow"
        />
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-10 text-center text-slate-500 dark:text-gray-400 font-medium tracking-wide">
            <div className="w-16 h-16 rounded-xl bg-white dark:bg-[#1E293B] flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-gray-800 shadow-sm">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            {searchTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Không có nhóm từ khóa nào. Hãy tạo nhóm đầu tiên!'}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id} className="bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden transition-all duration-200">
              {/* Group Header */}
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/30 hover:bg-white dark:bg-[#1E293B]/50 transition-colors">
                <div className="flex items-start sm:items-center space-x-4 flex-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="p-1 mt-1 sm:mt-0 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-700 transition-colors"
                  >
                    {expandedGroups.has(group.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-wide truncate">{group.name}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md border ${
                        group.priority >= 4 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        group.priority >= 3 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {getPriorityText(group.priority)}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md border ${
                        group.is_active ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700'
                      }`}>
                        {group.is_active ? 'Hoạt động' : 'Đang tắt'}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-slate-500 dark:text-gray-400 mt-1.5 line-clamp-2">{group.description}</p>
                    )}
                  </div>
                  
                  <div className="hidden sm:flex flex-col items-end text-sm text-slate-500 dark:text-gray-400">
                    <div className="font-semibold text-slate-900 dark:text-white bg-white dark:bg-[#1E293B] px-3 py-1 rounded-lg border border-slate-200 dark:border-gray-800 shadow-sm">
                      {group.keyword_count} <span className="font-normal text-slate-500 dark:text-gray-400 ml-1">từ khóa</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 pl-12 lg:pl-0">
                  <button
                    onClick={() => openBulkKeywordModal(group.id)}
                    className="flex-1 lg:flex-none px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 rounded-lg hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Thêm nhiều
                  </button>
                  <button
                    onClick={() => openAddKeywordModal(group.id)}
                    className="flex-1 lg:flex-none px-3 py-1.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Thêm 1
                  </button>
                  <button
                    onClick={() => setDeleteGroupConfirm({ isOpen: true, groupId: group.id, groupName: group.name })}
                    className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                    title="Xóa nhóm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Keywords List */}
              {expandedGroups.has(group.id) && (
                <div className="p-0 sm:p-2 bg-slate-50 dark:bg-[#0B1220]">
                  {!groupKeywords[group.id] ? (
                    <div className="text-center text-gray-500 py-8 text-sm">Đang tải từ khóa...</div>
                  ) : groupKeywords[group.id].length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">
                      Chưa có từ khóa nào trong nhóm này.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {groupKeywords[group.id].map((keyword) => (
                        <div
                          key={keyword.id}
                          className="flex items-center justify-between p-3 sm:px-5 hover:bg-white dark:bg-[#1E293B]/50 transition-colors group"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-medium text-gray-200">{keyword.keyword}</span>
                            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-gray-400 px-2 py-0.5 bg-white dark:bg-[#111827] shadow-sm rounded-md border border-slate-200 dark:border-gray-800">
                              {KEYWORD_TYPES.find(t => t.value === keyword.keyword_type)?.label || keyword.keyword_type}
                            </span>
                            {keyword.created_at && (
                              <span className="text-xs text-gray-500 font-medium hidden sm:inline-block">
                                {new Date(keyword.created_at).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditKeywordModal(keyword)}
                              className="p-1.5 text-slate-500 dark:text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                              title="Sửa từ khóa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleKeywordActive(keyword)}
                              className={`px-2 py-1 text-[10px] font-bold tracking-wider rounded border transition-colors ${
                                keyword.is_active
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-gray-800 text-gray-500 border-slate-300 dark:border-gray-700 hover:bg-gray-700'
                              }`}
                            >
                              {keyword.is_active ? 'ON' : 'OFF'}
                            </button>
                            <button
                              onClick={() => setDeleteKeywordConfirm({ isOpen: true, keywordId: keyword.id, keyword: keyword.keyword, groupId: group.id })}
                              className="p-1.5 text-slate-500 dark:text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Xóa từ khóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Thêm nhóm từ khóa mới</h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Tên nhóm *
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  placeholder="Ví dụ: Chất lượng sản phẩm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  placeholder="Mô tả về nhóm từ khóa này..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Độ ưu tiên (1-5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newGroup.priority}
                  onChange={(e) => setNewGroup({ ...newGroup, priority: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddGroup}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                Thêm Nhóm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteGroupConfirm.isOpen}
        onClose={() => setDeleteGroupConfirm({ isOpen: false, groupId: null, groupName: '' })}
        onConfirm={handleDeleteGroup}
        title="Xóa nhóm từ khóa"
        message={`Bạn có chắc muốn xóa nhóm "${deleteGroupConfirm.groupName}"? Tất cả từ khóa trong nhóm cũng sẽ bị xóa.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />

      {/* Delete Keyword Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteKeywordConfirm.isOpen}
        onClose={() => setDeleteKeywordConfirm({ isOpen: false, keywordId: null, keyword: '', groupId: null })}
        onConfirm={handleDeleteKeyword}
        title="Xóa từ khóa"
        message={`Bạn có chắc muốn xóa từ khóa "${deleteKeywordConfirm.keyword}"?`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />

      {/* Add Keyword Modal */}
      {showAddKeywordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Thêm từ khóa mới</h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Từ khóa *
                </label>
                <input
                  type="text"
                  value={newKeyword.keyword}
                  onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  placeholder="Nhập từ khóa..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Loại từ khóa
                </label>
                <select
                  value={newKeyword.keyword_type}
                  onChange={(e) => setNewKeyword({ ...newKeyword, keyword_type: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                >
                  <option value="" disabled className="text-gray-500">-- Chọn loại --</option>
                  {KEYWORD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddKeywordModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddKeyword}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Keyword Modal */}
      {showBulkKeywordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Thêm nhiều từ khóa</h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Danh sách từ khóa (mỗi dòng một từ khóa) *
                </label>
                <textarea
                  value={bulkKeyword.keywords_text}
                  onChange={(e) => setBulkKeyword({ ...bulkKeyword, keywords_text: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 custom-scrollbar"
                  placeholder="Ví dụ:&#10;TTH&#10;TTH Group&#10;Bệnh viện TTH"
                  rows={6}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Loại từ khóa chung
                </label>
                <select
                  value={bulkKeyword.keyword_type}
                  onChange={(e) => setBulkKeyword({ ...bulkKeyword, keyword_type: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                >
                  <option value="" disabled className="text-gray-500">-- Chọn loại --</option>
                  {KEYWORD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50 flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkKeywordModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddBulkKeyword}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                Thêm Hàng Loạt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Keyword Modal */}
      {showEditKeywordModal && selectedKeyword && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sửa từ khóa</h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Từ khóa *
                </label>
                <input
                  type="text"
                  value={selectedKeyword.keyword}
                  onChange={(e) => setSelectedKeyword({ ...selectedKeyword, keyword: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  placeholder="Nhập từ khóa..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Loại từ khóa
                </label>
                <select
                  value={selectedKeyword.keyword_type}
                  onChange={(e) => setSelectedKeyword({ ...selectedKeyword, keyword_type: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                >
                  <option value="" disabled className="text-gray-500">-- Chọn loại --</option>
                  {KEYWORD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center mt-2 p-3 bg-white dark:bg-[#1E293B]/50 border border-slate-300 dark:border-gray-700 rounded-xl">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={selectedKeyword.is_active}
                  onChange={(e) => setSelectedKeyword({ ...selectedKeyword, is_active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-gray-800 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-900"
                />
                <label htmlFor="edit_is_active" className="ml-3 text-sm font-medium text-slate-700 dark:text-gray-300 cursor-pointer select-none">
                  Kích hoạt từ khóa
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0B1220]/50 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditKeywordModal(false);
                  setSelectedKeyword(null);
                }}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleEditKeyword}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

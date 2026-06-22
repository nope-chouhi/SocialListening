'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, FileText, DollarSign } from 'lucide-react';
import { services as servicesApi, serviceRequests as serviceRequestsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

interface ServiceCategory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface Service {
  id: number;
  category_id: number;
  code: string;
  name: string;
  description: string;
  service_type: string;
  platform: string;
  legal_basis?: string;
  workflow_template?: any;
  deliverables?: any;
  estimated_duration: string;
  sla_hours: number;
  base_price: number;
  min_quantity?: number;
  unit: string;
  risk_level: string;
  requires_approval: boolean;
  is_active: boolean;
  category: ServiceCategory;
  created_at?: string;
  updated_at?: string;
}

interface ServiceRequest {
  id: number;
  service_id: number;
  status: string;
  priority: string;
  approval_status: string;
  quoted_price: number;
  final_price: number;
  deadline: string;
  created_at: string;
  service: Service;
}

interface DashboardSummary {
  total_active_services: number;
  open_service_requests: number;
  pending_approvals: number;
  completed_requests: number;
  high_risk_requests: number;
  monthly_estimated_cost: number;
}

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'requests'>('overview');
  const [services, setServices] = useState<Service[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [showServiceDetail, setShowServiceDetail] = useState(false);
  const [showRequestDetail, setShowRequestDetail] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  
  // Form state for creating service request
  const [requestForm, setRequestForm] = useState({
    service_id: 0,
    priority: 'medium',
    request_reason: '',
    evidence_summary: '',
    desired_outcome: '',
    quoted_price: 0,
    deadline: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicesData, requestsData, summaryData] = await Promise.allSettled([
        servicesApi.list({ is_active: true }),
        serviceRequestsApi.list({ limit: 50 }),
        servicesApi.getDashboardSummary()
      ]);
      
      if (servicesData.status === 'fulfilled') setServices(servicesData.value);
      if (requestsData.status === 'fulfilled') setServiceRequests(requestsData.value);
      if (summaryData.status === 'fulfilled') setDashboardSummary(summaryData.value);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Lỗi khi tải dữ liệu dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setShowServiceDetail(true);
  };

  const handleRequestClick = (request: ServiceRequest) => {
    setSelectedRequest(request);
    setShowRequestDetail(true);
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      await serviceRequestsApi.approve(requestId, {});
      toast.success('Đã phê duyệt yêu cầu!');
      fetchData();
      setShowRequestDetail(false);
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi phê duyệt');
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    
    try {
      await serviceRequestsApi.reject(requestId, { note: reason });
      toast.success('Đã từ chối yêu cầu!');
      fetchData();
      setShowRequestDetail(false);
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi từ chối');
    }
  };

  const handleCompleteRequest = async (requestId: number) => {
    const summary = prompt('Tóm tắt kết quả:');
    if (!summary) return;
    
    try {
      await serviceRequestsApi.complete(requestId, { result_summary: summary });
      toast.success('Đã hoàn thành yêu cầu!');
      fetchData();
      setShowRequestDetail(false);
    } catch (error: any) {
      console.error('Error completing request:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi hoàn thành');
    }
  };

  const handleCreateRequest = (service: Service) => {
    setSelectedService(service);
    setRequestForm({
      service_id: service.id,
      priority: 'medium',
      request_reason: '',
      evidence_summary: '',
      desired_outcome: '',
      quoted_price: service.base_price || 0,
      deadline: ''
    });
    setShowCreateRequest(true);
  };
  
  const handleSubmitRequest = async () => {
    if (!requestForm.request_reason || !requestForm.desired_outcome) {
      toast.error('Vui lòng điền đầy đủ lý do và kết quả mong muốn');
      return;
    }
    try {
      await serviceRequestsApi.create(requestForm);
      toast.success('Tạo yêu cầu dịch vụ thành công!');
      setShowCreateRequest(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating request:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi tạo yêu cầu dịch vụ');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700',
      'submitted': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'pending_approval': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'in_progress': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'waiting_external_response': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'rejected': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      'cancelled': 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700'
    };
    return `${colors[status] || 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700'} border`;
  };

  const getApprovalStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'not_required': 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700',
      'pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'rejected': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      'revision_required': 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    };
    return `${colors[status] || 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700'} border`;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'medium': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'high': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'urgent': 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    };
    return `${colors[priority] || 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700'} border`;
  };

  const getRiskLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'medium': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'high': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'critical': 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    };
    return `${colors[level] || 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700'} border`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Dịch Vụ</h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Quản lý các gói dịch vụ bảo vệ danh tiếng và xử lý khủng hoảng
        </p>
      </div>

      {/* Compliance Notice */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <strong className="text-amber-900 dark:text-amber-400">Lưu ý tuân thủ:</strong> Tất cả quy trình dịch vụ trong hệ thống được thiết kế cho việc bảo vệ danh tiếng hợp pháp, 
            thu thập bằng chứng, soạn thảo phản hồi chính thức, báo cáo chính sách nền tảng và chuẩn bị yêu cầu gỡ bỏ/sửa chữa hợp pháp. 
            Hệ thống không hỗ trợ hack, DDoS, spam report, truy cập trái phép, chiếm đoạt tài khoản, scraping riêng tư hoặc thao túng nền tảng.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { key: 'overview', label: 'Tổng Quan', icon: DollarSign },
            { key: 'catalog', label: 'Danh Mục Dịch Vụ', icon: FileText },
            { key: 'requests', label: 'Yêu Cầu Dịch Vụ', icon: Clock }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-3 px-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardSummary && (
        <div className="space-y-6">
          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md p-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Dịch vụ hoạt động</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{dashboardSummary.total_active_services}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-3 rounded-xl">
                  <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md p-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Yêu cầu đang mở</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{dashboardSummary.open_service_requests}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3 rounded-xl">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md p-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Chờ phê duyệt</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{dashboardSummary.pending_approvals}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 p-3 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md p-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Đã hoàn thành</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{dashboardSummary.completed_requests}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 p-3 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md p-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Rủi ro cao</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{dashboardSummary.high_risk_requests}</p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl">
                  <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md p-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Chi phí tháng này</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{formatPrice(dashboardSummary.monthly_estimated_cost)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 p-3 rounded-xl">
                  <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Catalog Tab */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm dịch vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>

          {/* Services Table */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-white dark:bg-[#1E293B]/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Dịch vụ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Danh mục
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Nền tảng
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Giá cơ bản
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      SLA
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Rủi ro
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Phê duyệt
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="hover:bg-white dark:bg-[#1E293B]/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{service.name}</div>
                          <div className="text-sm text-slate-500 dark:text-gray-400 truncate max-w-xs mt-0.5">{service.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{service.category.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300 capitalize">{service.platform.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {service.base_price ? formatPrice(service.base_price) : 'Thỏa thuận'}
                        </span>
                        {service.unit && (
                          <span className="text-xs text-gray-500 ml-1">/{service.unit}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">
                          {service.sla_hours ? `${service.sla_hours}h` : service.estimated_duration}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${getRiskLevelColor(service.risk_level)}`}>
                          {service.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {service.requires_approval ? (
                          <CheckCircle className="w-5 h-5 text-amber-500" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleServiceClick(service)}
                          className="p-2 text-slate-500 dark:text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCreateRequest(service)}
                          className="p-2 text-slate-500 dark:text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20"
                          title="Tạo yêu cầu"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Service Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Service Requests Table */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-white dark:bg-[#1E293B]/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Dịch vụ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Ưu tiên
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Phê duyệt
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Giá
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Tạo lúc
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {serviceRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-white dark:bg-[#1E293B]/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-400">
                        #{request.id}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{request.service.name}</div>
                          <div className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">{request.service.category.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${getPriorityColor(request.priority)}`}>
                          {request.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${getApprovalStatusColor(request.approval_status)}`}>
                          {request.approval_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                        {request.final_price ? formatPrice(request.final_price) : 
                         request.quoted_price ? formatPrice(request.quoted_price) : 'Chưa báo giá'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                        {new Date(request.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleRequestClick(request)}
                          className="p-2 text-slate-500 dark:text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Service Detail Modal */}
      {showServiceDetail && selectedService && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowServiceDetail(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-4">{selectedService.name}</h2>
                  <button
                    onClick={() => setShowServiceDetail(false)}
                    className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors shrink-0"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Thông tin cơ bản</h3>
                    <div className="space-y-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mã dịch vụ</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedService.code}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Danh mục</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedService.category.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Loại dịch vụ</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">{selectedService.service_type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nền tảng</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">{selectedService.platform.replace('_', ' ')}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mức rủi ro</span>
                        <div className="mt-1">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${getRiskLevelColor(selectedService.risk_level)}`}>
                            {selectedService.risk_level}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Giá và SLA</h3>
                    <div className="space-y-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Giá cơ bản</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {selectedService.base_price ? formatPrice(selectedService.base_price) : 'Thỏa thuận'}
                          {selectedService.unit && <span className="text-gray-500 ml-1 font-medium">/{selectedService.unit}</span>}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Thời gian ước tính</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedService.estimated_duration}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">SLA</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedService.sla_hours}h</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Số lượng tối thiểu</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedService.min_quantity || 1} {selectedService.unit}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Yêu cầu phê duyệt</span>
                        <div className="mt-1">
                          {selectedService.requires_approval ? (
                            <span className="inline-flex items-center text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded text-xs font-medium">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Bắt buộc
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-xs font-medium">
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Không yêu cầu
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-200 dark:border-gray-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Mô tả</h3>
                  <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed bg-white dark:bg-[#1E293B] p-4 rounded-xl border border-slate-200 dark:border-gray-800">{selectedService.description}</p>
                </div>
                
                {selectedService.legal_basis && (
                  <div className="pt-4 border-t border-slate-200 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Cơ sở pháp lý</h3>
                    <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed bg-white dark:bg-[#1E293B] p-4 rounded-xl border border-slate-200 dark:border-gray-800">{selectedService.legal_basis}</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 flex justify-end space-x-3 shrink-0">
                <button
                  onClick={() => setShowServiceDetail(false)}
                  className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#111827] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors font-medium"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setShowServiceDetail(false);
                    handleCreateRequest(selectedService);
                  }}
                  className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm shadow-indigo-500/20"
                >
                  Tạo yêu cầu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Service Request Detail Modal */}
      {showRequestDetail && selectedRequest && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowRequestDetail(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chi Tiết Yêu Cầu Dịch Vụ <span className="text-indigo-400">#{selectedRequest.id}</span></h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{selectedRequest.service.name}</p>
                  </div>
                  <button
                    onClick={() => setShowRequestDetail(false)}
                    className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-8 overflow-y-auto">
                {/* Status Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Trạng thái</p>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded ${getStatusColor(selectedRequest.status)}`}>
                      {selectedRequest.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ưu tiên</p>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded ${getPriorityColor(selectedRequest.priority)}`}>
                      {selectedRequest.priority}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Phê duyệt</p>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded ${getApprovalStatusColor(selectedRequest.approval_status)}`}>
                      {selectedRequest.approval_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Service Info & Pricing Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Service Info */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Thông tin dịch vụ</h3>
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl space-y-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dịch vụ</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedRequest.service.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Danh mục</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{selectedRequest.service.category.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nền tảng</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">{selectedRequest.service.platform.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Timeline */}
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Giá cả</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Giá báo</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {selectedRequest.quoted_price ? formatPrice(selectedRequest.quoted_price) : 'Chưa báo giá'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-[#1E293B] border border-indigo-500/30 p-5 rounded-xl shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]">
                          <p className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-1">Giá cuối cùng</p>
                          <p className="text-lg font-bold text-indigo-400">
                            {selectedRequest.final_price ? formatPrice(selectedRequest.final_price) : 'Chưa xác định'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Thời gian</h3>
                      <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl space-y-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tạo lúc</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{new Date(selectedRequest.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                        {selectedRequest.deadline && (
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Deadline</span>
                            <span className="text-sm font-medium text-rose-400">{new Date(selectedRequest.deadline).toLocaleString('vi-VN')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Request Details */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Chi tiết yêu cầu</h3>
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lý do yêu cầu</p>
                      <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">{(selectedRequest as any).request_reason || 'N/A'}</p>
                    </div>
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tóm tắt bằng chứng</p>
                      <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">{(selectedRequest as any).evidence_summary || 'N/A'}</p>
                    </div>
                    <div className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 p-5 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kết quả mong muốn</p>
                      <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">{(selectedRequest as any).desired_outcome || 'N/A'}</p>
                    </div>
                    {(selectedRequest as any).result_summary && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-xl">
                        <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider mb-2">Kết quả thực tế</p>
                        <p className="text-sm text-emerald-100 leading-relaxed">{(selectedRequest as any).result_summary}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 shrink-0">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowRequestDetail(false)}
                    className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#111827] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors font-medium"
                  >
                    Đóng
                  </button>
                  
                  <div className="flex space-x-3">
                    {selectedRequest.approval_status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleRejectRequest(selectedRequest.id)}
                          className="px-5 py-2.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-colors font-medium"
                        >
                          Từ chối
                        </button>
                        <button
                          onClick={() => handleApproveRequest(selectedRequest.id)}
                          className="px-5 py-2.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors font-medium"
                        >
                          Phê duyệt
                        </button>
                      </>
                    )}
                    
                    {(selectedRequest.status === 'in_progress' || selectedRequest.status === 'waiting_external_response') && (
                      <button
                        onClick={() => handleCompleteRequest(selectedRequest.id)}
                        className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm shadow-indigo-500/20"
                      >
                        Hoàn thành
                      </button>
                    )}
                    
                    {selectedRequest.status === 'approved' && (
                      <button
                        onClick={async () => {
                          try {
                            await serviceRequestsApi.update(selectedRequest.id, { status: 'in_progress' });
                            toast.success('Đã chuyển sang trạng thái đang xử lý!');
                            fetchData();
                            setShowRequestDetail(false);
                          } catch (error: any) {
                            toast.error('Lỗi khi cập nhật trạng thái');
                          }
                        }}
                        className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm shadow-indigo-500/20"
                      >
                        Bắt đầu xử lý
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Service Request Modal */}
      {showCreateRequest && selectedService && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowCreateRequest(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tạo Yêu Cầu Dịch Vụ</h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{selectedService.name}</p>
                  </div>
                  <button
                    onClick={() => setShowCreateRequest(false)}
                    className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Service Info */}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5">
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-1">Danh mục</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedService.category.name}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-1">Giá cơ bản</span>
                      <span className="font-bold text-indigo-400">
                        {selectedService.base_price ? formatPrice(selectedService.base_price) : 'Thỏa thuận'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-1">Thời gian ước tính</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedService.estimated_duration}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-1">SLA</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedService.sla_hours}h</span>
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Mức độ ưu tiên <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={requestForm.priority}
                    onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="urgent">Khẩn cấp</option>
                  </select>
                </div>

                {/* Request Reason */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Lý do yêu cầu <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={requestForm.request_reason}
                    onChange={(e) => setRequestForm({ ...requestForm, request_reason: e.target.value })}
                    rows={3}
                    placeholder="Mô tả lý do cần dịch vụ này..."
                    className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 resize-none"
                  />
                </div>

                {/* Evidence Summary */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Tóm tắt bằng chứng
                  </label>
                  <textarea
                    value={requestForm.evidence_summary}
                    onChange={(e) => setRequestForm({ ...requestForm, evidence_summary: e.target.value })}
                    rows={3}
                    placeholder="Tóm tắt các bằng chứng, mentions, alerts liên quan..."
                    className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 resize-none"
                  />
                </div>

                {/* Desired Outcome */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Kết quả mong muốn <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={requestForm.desired_outcome}
                    onChange={(e) => setRequestForm({ ...requestForm, desired_outcome: e.target.value })}
                    rows={3}
                    placeholder="Mô tả kết quả mong muốn từ dịch vụ này..."
                    className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Quoted Price */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Giá báo (VND)
                    </label>
                    <input
                      type="number"
                      value={requestForm.quoted_price}
                      onChange={(e) => setRequestForm({ ...requestForm, quoted_price: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Thời hạn
                    </label>
                    <input
                      type="datetime-local"
                      value={requestForm.deadline}
                      onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Compliance Notice */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-200/80">
                      <strong className="text-amber-400">Lưu ý:</strong> Yêu cầu này sẽ được xem xét và phê duyệt trước khi thực hiện. 
                      Tất cả dịch vụ phải tuân thủ pháp luật và chính sách nền tảng.
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 flex justify-end space-x-3 shrink-0">
                <button
                  onClick={() => setShowCreateRequest(false)}
                  className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#111827] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSubmitRequest}
                  disabled={!requestForm.request_reason || !requestForm.desired_outcome}
                  className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed font-medium shadow-sm shadow-indigo-500/20"
                >
                  Tạo yêu cầu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
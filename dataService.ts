import { 
  Project, User, PortalDocument, Message, Notification,
  ProjectStatus, UserRole, MasterPackage, MessageCategory 
} from './types';
import { GoogleGenAI } from "@google/genai";
import { supabase } from './src/supabaseClient';

export interface DashboardData {
  totalProjects: number;
  projectsByStatus: Record<string, number>;
  totalApartments: number;
  customersPerProject: Record<string, number>;
  totalCustomers: number;
  assignedApartments: number;
  customerTrend: { month: string; count: number }[];
  chats: {
    open: number;
    resolved: number;
  };
}

class DataService {
  async translateText(text: string, targetLang: string): Promise<string> {
    if (targetLang === 'nl' || !text.trim()) return text;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following customer portal message to ${targetLang}. Only return the translated text, no explanation: "${text}"`,
      });
      return response.text || text;
    } catch (e) {
      console.error("AI Translation error:", e);
      return text;
    }
  }

  async ensureSeeded() {
    // No-op for Supabase implementation as we want to avoid mock data
    console.log('Supabase mode active. Skipping local seeding.');
  }

  async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*');
    
    if (error) throw error;
    return (data || []).map(p => ({
      ...p,
      availableOptionIds: typeof p.available_option_ids === 'string' ? JSON.parse(p.available_option_ids) : (p.available_option_ids || []),
      additionalPhotos: typeof p.additional_photos === 'string' ? JSON.parse(p.additional_photos) : (p.additional_photos || []),
      homesCount: p.homes_count,
      postalCode: p.postal_code,
      internalRemarks: p.internal_remarks,
      deliveryDate: p.delivery_date,
      logoUrl: p.logo_url
    }));
  }

  async getDashboardStats(projectId?: string): Promise<DashboardData> {
    const [projects, allUsers, allMessages] = await Promise.all([
      this.getProjects(),
      this.getUsers(),
      this.getAllMessages()
    ]);

    const filteredProjects = projectId ? projects.filter(p => p.id === projectId) : projects;
    const filteredUsers = projectId ? allUsers.filter(u => u.projectId === projectId) : allUsers;
    const customers = filteredUsers.filter(u => u.role === UserRole.CUSTOMER);
    
    const statusMap: Record<string, number> = {};
    filteredProjects.forEach(p => {
      statusMap[p.status] = (statusMap[p.status] || 0) + 1;
    });

    const custProjMap: Record<string, number> = {};
    customers.forEach(c => {
      const pName = projects.find(p => p.id === c.projectId)?.name || 'Onbekend';
      custProjMap[pName] = (custProjMap[pName] || 0) + 1;
    });

    const activeCustomerIdsWithUnarchived = new Set(
      allMessages.filter(m => !m.isArchived).map(m => m.customerId)
    );
    const activeCustomerIdsWithArchived = new Set(
      allMessages.filter(m => m.isArchived).map(m => m.customerId)
    );

    const visibleCustomerIds = new Set(customers.map(c => c.id));
    let openChats = 0;
    let resolvedChats = 0;

    visibleCustomerIds.forEach(id => {
      if (activeCustomerIdsWithUnarchived.has(id)) openChats++;
      else if (activeCustomerIdsWithArchived.has(id)) resolvedChats++;
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const now = new Date();
    const trend = [];
    
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const targetMonth = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();
      
      const count = customers.filter(c => {
        const dateStr = c.createdAt;
        if (!dateStr) return false;
        
        const cDate = new Date(dateStr);
        return !isNaN(cDate.getTime()) && 
               cDate.getMonth() === targetMonth && 
               cDate.getFullYear() === targetYear;
      }).length;
      
      trend.push({ month: months[targetMonth].toUpperCase(), count });
    }

    return {
      totalProjects: filteredProjects.length,
      projectsByStatus: statusMap,
      totalApartments: filteredProjects.reduce((sum, p) => sum + (p.homesCount || 0), 0),
      customersPerProject: custProjMap,
      totalCustomers: customers.length,
      assignedApartments: customers.filter(c => !!c.apartmentId).length,
      customerTrend: trend,
      chats: {
        open: openChats,
        resolved: resolvedChats
      }
    };
  }

  async createProject(data: Partial<Project>) {
    const id = `p${Math.random().toString(36).substr(2, 5)}`;
    const { error } = await supabase
      .from('projects')
      .insert([{
        id,
        name: data.name,
        status: data.status,
        address: data.address,
        homes_count: data.homesCount,
        postal_code: data.postalCode,
        city: data.city,
        manager: data.manager,
        available_option_ids: JSON.stringify(data.availableOptionIds || []),
        additional_photos: JSON.stringify(data.additionalPhotos || []),
        internal_remarks: data.internalRemarks,
        delivery_date: data.deliveryDate,
        logo_url: data.logoUrl
      }]);
    
    if (error) throw error;
    return { success: true };
  }

  async updateProject(id: string, updates: Partial<Project>) {
    const { error } = await supabase
      .from('projects')
      .update({
        name: updates.name,
        status: updates.status,
        address: updates.address,
        homes_count: updates.homesCount,
        postal_code: updates.postalCode,
        city: updates.city,
        manager: updates.manager,
        available_option_ids: updates.availableOptionIds ? JSON.stringify(updates.availableOptionIds) : undefined,
        additional_photos: updates.additionalPhotos ? JSON.stringify(updates.additionalPhotos) : undefined,
        internal_remarks: updates.internalRemarks,
        delivery_date: updates.deliveryDate,
        logo_url: updates.logoUrl
      })
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }

  async deleteProject(id: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;
    return (data || []).map(u => ({
      ...u,
      firstName: u.first_name,
      lastName: u.last_name,
      caseNumber: u.case_number,
      plotNumber: u.plot_number,
      isPasswordSet: u.is_password_set,
      projectId: u.project_id,
      apartmentId: u.apartment_id,
      isActive: u.is_active,
      masterPackageId: u.master_package_id,
      createdAt: u.created_at,
      apartmentDetails: typeof u.apartment_details === 'string' ? JSON.parse(u.apartment_details) : (u.apartment_details || {}),
      constructionProgress: typeof u.construction_progress === 'string' ? JSON.parse(u.construction_progress) : (u.construction_progress || {}),
      exceptions: typeof u.exceptions === 'string' ? JSON.parse(u.exceptions) : (u.exceptions || [])
    }));
  }

  async createUser(userData: Partial<User>) {
    const id = `u${Math.random().toString(36).substr(2, 9)}`;
    const { error } = await supabase
      .from('users')
      .insert([{
        id,
        email: userData.email,
        name: userData.name || `${userData.firstName} ${userData.lastName}`,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone,
        case_number: userData.caseNumber,
        plot_number: userData.plotNumber,
        role: userData.role,
        password: userData.password,
        is_active: userData.isActive,
        is_password_set: userData.isPasswordSet || false,
        project_id: userData.projectId,
        apartment_id: userData.apartmentId,
        master_package_id: userData.masterPackageId,
        apartment_details: JSON.stringify(userData.apartmentDetails || {}),
        construction_progress: JSON.stringify(userData.constructionProgress || {}),
        remarks: userData.remarks,
        exceptions: JSON.stringify(userData.exceptions || []),
        created_at: new Date().toISOString()
      }]);
    
    if (error) throw error;
    return { success: true };
  }

  async updateUser(id: string, updates: Partial<User>) {
    const { error } = await supabase
      .from('users')
      .update({
        email: updates.email,
        name: updates.name || (updates.firstName && updates.lastName ? `${updates.firstName} ${updates.lastName}` : updates.name),
        first_name: updates.firstName,
        last_name: updates.lastName,
        phone: updates.phone,
        case_number: updates.caseNumber,
        plot_number: updates.plotNumber,
        role: updates.role,
        password: updates.password,
        is_active: updates.isActive,
        is_password_set: updates.isPasswordSet,
        project_id: updates.projectId,
        apartment_id: updates.apartmentId,
        master_package_id: updates.masterPackageId,
        apartment_details: updates.apartmentDetails ? JSON.stringify(updates.apartmentDetails) : undefined,
        construction_progress: updates.constructionProgress ? JSON.stringify(updates.constructionProgress) : undefined,
        remarks: updates.remarks,
        exceptions: updates.exceptions ? JSON.stringify(updates.exceptions) : undefined
      })
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }

  async deleteUser(id: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }

  async getAllMessages(): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('date', { ascending: true });
    
    if (error) throw error;
    return (data || []).map(m => ({
      ...m,
      projectId: m.project_id,
      customerId: m.customer_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      isEscalated: m.is_escalated,
      isArchived: m.is_archived
    }));
  }

  async getMessages(userId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', userId)
      .order('date', { ascending: true });
    
    if (error) throw error;
    return (data || []).map(m => ({
      ...m,
      projectId: m.project_id,
      customerId: m.customer_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      isEscalated: m.is_escalated,
      isArchived: m.is_archived
    }));
  }

  async sendMessage(projectId: string, customerId: string, senderId: string, senderName: string, role: UserRole, text: string, category?: MessageCategory): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .insert([{
        id: `m${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectId,
        customer_id: customerId,
        sender_id: senderId,
        sender_name: senderName,
        role: role,
        text: text,
        date: new Date().toISOString(),
        category: category,
        is_escalated: false,
        is_archived: false
      }]);
    
    if (error) throw error;

    // Notifications are now handled by database triggers for maximum speed
  }

  async createNotification(userId: string, text: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        id: `n${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        text,
        date: new Date().toISOString(),
        is_read: false
      }]);
    if (error) throw error;
  }

  async escalateChat(customerId: string, isEscalated: boolean): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ is_escalated: isEscalated })
      .eq('customer_id', customerId);
    
    if (error) throw error;
  }

  async deescalateChat(customerId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ is_escalated: false })
      .eq('customer_id', customerId);
    
    if (error) throw error;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(n => ({
      ...n,
      userId: n.user_id,
      isRead: n.is_read
    }));
  }

  async markNotificationsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);
    
    if (error) throw error;
  }

  async getMasterPackages(projectId?: string): Promise<MasterPackage[]> {
    let query = supabase.from('master_packages').select('*');
    if (projectId) query = query.eq('project_id', projectId);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(p => ({
      ...p,
      projectId: p.project_id,
      optionIds: typeof p.option_ids === 'string' ? JSON.parse(p.option_ids) : (p.option_ids || []),
      inclusions: typeof p.inclusions === 'string' ? JSON.parse(p.inclusions) : (p.inclusions || []),
      photos: typeof p.photos === 'string' ? JSON.parse(p.photos) : (p.photos || [])
    }));
  }

  async createMasterPackage(pkg: Partial<MasterPackage>) {
    const id = `mp${Math.random().toString(36).substr(2, 5)}`;
    const { error } = await supabase
      .from('master_packages')
      .insert([{
        id,
        name: pkg.name,
        project_id: pkg.projectId,
        price: pkg.price,
        category: pkg.category,
        inclusions: JSON.stringify(pkg.inclusions || []),
        photos: JSON.stringify(pkg.photos || []),
        option_ids: JSON.stringify(pkg.optionIds || [])
      }]);
    
    if (error) throw error;
    return { success: true };
  }

  async updateMasterPackage(id: string, updates: Partial<MasterPackage>) {
    const { error } = await supabase
      .from('master_packages')
      .update({
        name: updates.name,
        project_id: updates.projectId,
        price: updates.price,
        category: updates.category,
        inclusions: updates.inclusions ? JSON.stringify(updates.inclusions) : undefined,
        photos: updates.photos ? JSON.stringify(updates.photos) : undefined,
        option_ids: updates.optionIds ? JSON.stringify(updates.optionIds) : undefined
      })
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }

  async deleteMasterPackage(id: string) {
    const { error } = await supabase
      .from('master_packages')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }

  async getDocuments(userId: string): Promise<PortalDocument[]> {
    const { data, error } = await supabase
      .from('portal_documents')
      .select('*')
      .eq('customer_id', userId);
    
    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      projectId: d.project_id,
      customerId: d.customer_id,
      uploadedBy: d.uploaded_by,
      externalUrl: d.external_url
    }));
  }

  async uploadDocument(projectId: string, customerId: string, fileName: string, uploadedBy: string, role: UserRole, size: string, base64Data: string): Promise<void> {
    const { error } = await supabase
      .from('portal_documents')
      .insert([{
        id: `d${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectId,
        customer_id: customerId,
        file_name: fileName,
        uploaded_by: uploadedBy,
        role: role,
        date: new Date().toLocaleDateString(),
        size: size,
        external_url: base64Data
      }]);
    
    if (error) throw error;

    // Notifications are now handled by database triggers for maximum speed
  }

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
      .from('portal_documents')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
}

export const dataService = new DataService();

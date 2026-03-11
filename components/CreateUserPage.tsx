import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useTranslation } from '../App';
import { dataService } from '../dataService';
import { Project, MasterPackage, UserRole } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import html2pdf from 'html2pdf.js';

const generateRandomPassword = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
};

const CreateUserPage: React.FC = () => {
  const { user, setActiveView } = useAuth();
  const { t } = useTranslation();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [masterPackages, setMasterPackages] = useState<MasterPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedPass, setGeneratedPass] = useState('');
  const [createdUserEmail, setCreatedUserEmail] = useState('');
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: UserRole.CUSTOMER,
    project_id: '',
    master_package_id: '',
    case_number: '',
    plot_number: ''
  });

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [p, mp] = await Promise.all([
          dataService.getProjects(),
          dataService.getMasterPackages()
        ]);
        setProjects(p);
        setMasterPackages(mp);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    fetchData();
  }, []);

  // Filter packages based on selected project
  const availablePackages = masterPackages.filter(p => p.projectId === formData.project_id);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Reset package if project changes
    if (name === 'project_id') {
      setFormData(prev => ({ ...prev, master_package_id: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const pass = generateRandomPassword();
    
    try {
      // Create user via dataService
      await dataService.createUser({
        email: formData.email,
        name: `${formData.first_name} ${formData.last_name}`,
        role: formData.role as UserRole,
        password: pass,
        isActive: true,
        projectId: formData.project_id || undefined,
        apartmentId: formData.plot_number || undefined, // Using plot_number as apartmentId for now
        masterPackageId: formData.master_package_id || undefined,
        firstName: formData.first_name,
        lastName: formData.last_name,
        phone: formData.phone,
        caseNumber: formData.case_number,
        plotNumber: formData.plot_number
      } as any);
      
      setGeneratedPass(pass);
      setCreatedUserEmail(formData.email);
      setIsSuccess(true);
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Er is een fout opgetreden bij het aanmaken van de gebruiker.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const selectedProject = projects.find(p => p.id === formData.project_id);
    const selectedPackage = masterPackages.find(p => p.id === formData.master_package_id);
    const text = `Website: https://www.globalinteriorconcepts.com/\nProject: ${selectedProject?.name || '-'}\nPakket: ${selectedPackage?.name || '-'}\nEmail: ${createdUserEmail}\nWachtwoord: ${generatedPass}`;
    navigator.clipboard.writeText(text);
    alert("Inloggegevens gekopieerd naar klembord.");
  };

  const handleSavePDF = () => {
    const element = printRef.current;
    if (!element) return;
    
    // Hide buttons temporarily for PDF generation if they are inside the ref
    // (They are currently inside the ref but have print:hidden, html2pdf might not respect print media queries perfectly)
    const buttonsDiv = element.querySelector('.print\\:hidden');
    if (buttonsDiv) {
      (buttonsDiv as HTMLElement).style.display = 'none';
    }

    const opt = {
      margin:       10,
      filename:     `Inloggegevens_${formData.first_name}_${formData.last_name}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
      // Restore buttons
      if (buttonsDiv) {
        (buttonsDiv as HTMLElement).style.display = '';
      }
    });
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: UserRole.CUSTOMER,
      project_id: '',
      master_package_id: '',
      case_number: '',
      plot_number: ''
    });
    setIsSuccess(false);
    setGeneratedPass('');
    setCreatedUserEmail('');
  };

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return <div className="p-8 text-center text-slate-500">Geen toegang.</div>;
  }

  if (isSuccess) {
    const selectedProject = projects.find(p => p.id === formData.project_id);
    const selectedPackage = masterPackages.find(p => p.id === formData.master_package_id);

    return (
      <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden" ref={printRef}>
          <div className="p-12 text-center border-b border-slate-50 print:border-none">
             <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-8 text-3xl shadow-xl print:shadow-none">
                ✓
             </div>
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4">Account Aangemaakt</h1>
             <p className="text-sm text-slate-400 font-medium">Uw account is gereed voor gebruik.</p>
          </div>
          
          <div className="p-12 bg-slate-50/50 print:bg-white">
             <div className="max-w-md mx-auto space-y-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm print:shadow-none print:border-slate-300">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Inloggegevens</h3>
                   
                   <div className="space-y-6">
                      <div>
                         <span className="text-[10px] font-black text-slate-300 uppercase block mb-2">Website</span>
                         <a href="https://www.globalinteriorconcepts.com/" target="_blank" rel="noreferrer" className="text-sm font-bold text-[#8C7864] hover:underline">
                            https://www.globalinteriorconcepts.com/
                         </a>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <span className="text-[10px] font-black text-slate-300 uppercase block mb-2">Project</span>
                            <p className="text-sm font-bold text-slate-900">{selectedProject?.name || '-'}</p>
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-slate-300 uppercase block mb-2">Pakket</span>
                            <p className="text-sm font-bold text-slate-900">{selectedPackage?.name || '-'}</p>
                         </div>
                      </div>
                      <div>
                         <span className="text-[10px] font-black text-slate-300 uppercase block mb-2">E-mailadres</span>
                         <p className="text-sm font-bold text-slate-900">{createdUserEmail}</p>
                      </div>
                      <div>
                         <span className="text-[10px] font-black text-slate-300 uppercase block mb-2">Wachtwoord</span>
                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-lg font-black text-slate-900 tracking-widest text-center print:border-slate-300">
                            {generatedPass}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm print:shadow-none print:border-slate-300">
                   <span className="text-[10px] font-black text-slate-300 uppercase block mb-4">Scan om in te loggen</span>
                   <QRCodeSVG value="https://www.globalinteriorconcepts.com/" size={120} level="H" />
                </div>
             </div>
          </div>

          <div className="p-8 border-t border-slate-50 bg-white flex flex-wrap justify-center gap-4 print:hidden">
             <button onClick={handlePrint} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                🖨️ Printen
             </button>
             <button onClick={handleCopy} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                📋 Kopiëren
             </button>
             <button onClick={handleSavePDF} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                📄 Opslaan als PDF
             </button>
             <button onClick={resetForm} className="px-6 py-3 bg-[#8C7864] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#8C7864]/20 hover:bg-[#7A6855] transition-all flex items-center gap-2">
                ➕ Nieuwe Klant
             </button>
          </div>
        </div>
        
        {/* Print Styles */}
        <style>{`
          @media print {
            body {
              background-color: white !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Nieuwe Klant Aanmaken</h1>
        <button onClick={() => setActiveView('Gebruikers')} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
          Annuleren
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Voornaam *</label>
                <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all" placeholder="Voornaam" />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Achternaam *</label>
                <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all" placeholder="Achternaam" />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mailadres *</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all" placeholder="naam@voorbeeld.nl" />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefoonnummer</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all" placeholder="+31 6 12345678" />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol *</label>
                <select required name="role" value={formData.role} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all">
                   <option value={UserRole.CUSTOMER}>Klant</option>
                   <option value={UserRole.PROJECT_ADMIN}>Project Admin</option>
                   <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project</label>
                <select name="project_id" value={formData.project_id} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all">
                   <option value="">Geen project geselecteerd</option>
                   {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pakket</label>
                <select 
                  name="master_package_id" 
                  value={formData.master_package_id} 
                  onChange={handleChange} 
                  disabled={!formData.project_id || availablePackages.length === 0}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all disabled:opacity-50"
                >
                   <option value="">{formData.project_id ? (availablePackages.length > 0 ? 'Selecteer een pakket' : 'Geen pakketten voor dit project') : 'Selecteer eerst een project'}</option>
                   {availablePackages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bouwnummer / Plot</label>
                <input type="text" name="plot_number" value={formData.plot_number} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all" placeholder="Bijv. BNR 12" />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dossiernummer</label>
                <input type="text" name="case_number" value={formData.case_number} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#8C7864]/10 transition-all" placeholder="Bijv. DOS-2026-001" />
             </div>
          </div>

          <div className="pt-8 border-t border-slate-50 flex justify-end">
             <button 
                type="submit" 
                disabled={isLoading}
                className="px-10 py-4 bg-[#8C7864] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#8C7864]/20 hover:bg-[#7A6855] active:scale-95 transition-all disabled:opacity-50"
             >
                {isLoading ? 'Bezig met opslaan...' : 'Klant Aanmaken'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserPage;

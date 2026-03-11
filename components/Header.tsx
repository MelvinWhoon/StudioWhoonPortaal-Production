
import React, { useState, useEffect } from 'react';
import { useAuth, useTranslation } from '../App';
import { dataService } from '../dataService';
import { UserRole, Project } from '../types';

const Header: React.FC = () => {
  const { user, activeProject, setActiveProject, setSidebarOpen } = useAuth();
  const { lang, setLang, t } = useTranslation();
  
  // Fix: Initialize projects as an empty array and fetch them asynchronously
  const [projects, setProjects] = useState<Project[]>([]);

  // Fix: Fetch projects when user changes or component mounts
  useEffect(() => {
    const fetchProjects = async () => {
      if (user?.role === UserRole.SUPER_ADMIN) {
        try {
          const data = await dataService.getProjects();
          setProjects(data);
        } catch (error) {
          console.error("Error loading projects for header:", error);
        }
      }
    };
    fetchProjects();
  }, [user]);

  useEffect(() => {
    const initGoogleTranslate = () => {
      if ((window as any).google && (window as any).google.translate && (window as any).google.translate.TranslateElement) {
        const gtElements = document.querySelectorAll('.google_translate_element');
        gtElements.forEach(el => {
          if (el.innerHTML.trim() === '') {
            try {
              new (window as any).google.translate.TranslateElement(
                { pageLanguage: 'nl', autoDisplay: false },
                el
              );
            } catch (e) {
              console.error('Error initializing Google Translate in Header:', e);
            }
          }
        });
      }
    };

    if ((window as any).google && (window as any).google.translate) {
      initGoogleTranslate();
    } else {
      setTimeout(initGoogleTranslate, 500);
    }
  }, []);

  return (
    <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 md:px-10 flex-shrink-0 z-30">
      <style>{`
        .translate-icon-wrapper {
          position: relative;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .google_translate_element {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.001;
          z-index: 10;
        }
        .google_translate_element .goog-te-gadget {
          width: 100%;
          height: 100%;
        }
        .google_translate_element .goog-te-combo {
          width: 100%;
          height: 100%;
          cursor: pointer;
          position: absolute;
          top: 0;
          left: 0;
        }
      `}</style>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-3 -ml-3 text-slate-400 hover:bg-slate-50 rounded-2xl md:hidden transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h2 className="text-base md:text-lg font-black text-slate-900 truncate max-w-[150px] md:max-w-none uppercase tracking-tighter flex items-center gap-3">
          {activeProject?.logoUrl && (
            <img src={activeProject.logoUrl} alt="Logo" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
          )}
          {activeProject?.name || 'Portal'}
        </h2>

        {user?.role === UserRole.SUPER_ADMIN && (
          <div className="hidden xl:flex items-center gap-3 ml-10">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t('project')}:</span>
            <select
              className="bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-[#8C7864]/5 transition-all cursor-pointer"
              value={activeProject?.id || ''}
              onChange={(e) => {
                // Fix: projects is now an array from state
                const p = projects.find(p => p.id === e.target.value);
                setActiveProject(p || null);
              }}
            >
              <option value="">GLOBAAL</option>
              {/* Fix: projects is now an array from state */}
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Language Switcher Small */}
        <div className="hidden sm:flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
           {/* Google Translate Icon */}
           <div className="translate-icon-wrapper opacity-40 hover:opacity-80 mx-1" title="Translate to other languages">
             <span className="text-sm">🌐</span>
             <div className="google_translate_element"></div>
           </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border border-slate-100">
          <span className="w-2 h-2 rounded-full bg-[#8C7864] animate-pulse" />
          <span className="hidden sm:inline">v1.8</span>
        </div>
      </div>
    </header>
  );
};

export default Header;

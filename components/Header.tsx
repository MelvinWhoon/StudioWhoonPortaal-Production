
import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useTranslation, triggerGoogleTranslate } from '../App';
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

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    if (langMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [langMenuOpen]);

  return (
    <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 md:px-10 flex-shrink-0 z-30">
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

      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setLangMenuOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all"
            title="Taal wisselen"
          >
            <span className="text-sm leading-none">
              {lang === 'nl' ? '🇳🇱' : lang === 'en' ? '🇬🇧' : '🇪🇸'}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 hidden sm:inline">
              {lang.toUpperCase()}
            </span>
            <svg className={`w-3 h-3 text-slate-400 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {langMenuOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-black/10 py-1.5 z-50 min-w-[110px] overflow-hidden">
              {([
                { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
                { code: 'en', flag: '🇬🇧', label: 'English' },
                { code: 'es', flag: '🇪🇸', label: 'Español' },
              ] as const).map(({ code, flag, label }) => (
                <button
                  key={code}
                  onClick={() => { setLang(code); triggerGoogleTranslate(code); setLangMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    lang === code
                      ? 'bg-[#8C7864]/10 text-[#8C7864]'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-sm">{flag}</span>
                  <span>{label}</span>
                  {lang === code && <span className="ml-auto text-[#8C7864]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border border-slate-100">
          <span className="w-2 h-2 rounded-full bg-[#8C7864] animate-pulse" />
          <span className="hidden sm:inline">v1.8</span>
        </div>
      </div>
    </header>
  );
};

export default Header;

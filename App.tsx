
import React, { useState, createContext, useContext, useEffect } from 'react';
import { User, UserRole, Project, Message } from './types';
import { dataService } from './dataService';
import { translations, Language } from './translations';
import Login from './components/Login';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import ProjectAdminDashboard from './components/ProjectAdminDashboard';
import CustomerPortal from './components/CustomerPortal';
import DemoPage from './components/DemoPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Converts a Vimeo URL to an embeddable iframe src
export const getVimeoEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/)?(\d+)/);
  return match
    ? `https://player.vimeo.com/video/${match[1]}?title=0&byline=0&portrait=0&dnt=1`
    : null;
};

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => void;
  logout: () => void;
  activeProject: Project | null;
  setActiveProject: (p: Project | null) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

interface TranslationContextType {
  t: (key: string) => string;
  lang: Language;
  setLang: (l: Language) => void;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) throw new Error('useTranslation must be used within TranslationProvider');
  return context;
};

export const useMessageTranslation = (messages: Message[], targetLang: Language) => {
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translateAll = async () => {
      if (targetLang === 'nl' || messages.length === 0) {
        setTranslatedMessages({});
        return;
      }
      setIsTranslating(true);
      const newTranslations: Record<string, string> = { ...translatedMessages };
      let changed = false;
      for (const m of messages) {
        const cacheKey = `${m.id}_${targetLang}`;
        if (!newTranslations[cacheKey]) {
          try {
            const translated = await dataService.translateText(m.text, targetLang);
            newTranslations[cacheKey] = translated;
            changed = true;
          } catch (e) {
            console.error("Translation error:", e);
          }
        }
      }
      if (changed) setTranslatedMessages(newTranslations);
      setIsTranslating(false);
    };
    translateAll();
  }, [messages, targetLang]);

  return { translatedMessages, isTranslating };
};

/**
 * Programmatically trigger Google Translate for full-page translation.
 *
 * The actual widget lives in the hidden #google_translate_element div
 * (initialised in index.html before React boots, no race conditions).
 * We just find the combo <select> it renders and drive it.
 */
export const triggerGoogleTranslate = (targetLang: string) => {
  const apply = (): boolean => {
    const sel = document.querySelector<HTMLSelectElement>('select.goog-te-combo');
    if (!sel) return false;

    if (targetLang === 'nl') {
      // Strategy 1: use the GT widget's own restore() method (no cross-origin needed)
      try {
        const gt = (window as any).google?.translate?.TranslateElement;
        const instance = gt?.getInstance?.() ?? gt?.instances?.[0];
        if (instance?.restore) { instance.restore(); return true; }
      } catch (_) {}

      // Strategy 2: click the "show original" button in the GT banner iframe
      // (the iframe is off-screen but still in DOM, so its document is accessible
      //  on the same origin in newer GT versions; cross-origin catch handles the rest)
      try {
        const banner = document.querySelector<HTMLIFrameElement>('.goog-te-banner-frame');
        const doc = banner?.contentDocument ?? banner?.contentWindow?.document;
        if (doc) {
          const btn = doc.querySelector<HTMLElement>(
            '.goog-close-link, .VIpgJd-ZVi9od-ORHb-OEVmcd-ibnC6b, [onclick*="restore"]'
          );
          if (btn) { btn.click(); return true; }
        }
      } catch (_) { /* cross-origin – silently ignored */ }

      // Strategy 3: clear the googtrans cookie and reset the combo to ""
      const exp = new Date(0).toUTCString();
      document.cookie = `googtrans=; path=/; expires=${exp}`;
      document.cookie = `googtrans=; path=/; domain=.${window.location.hostname}; expires=${exp}`;
      document.cookie = `googtrans=; path=/; domain=${window.location.hostname}; expires=${exp}`;
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      sel.value = targetLang;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  };

  // If the widget combo isn't in the DOM yet (still loading), retry every 400 ms
  if (!apply()) {
    let n = 0;
    const id = setInterval(() => {
      if (apply() || ++n >= 20) clearInterval(id); // give up after ~8 s
    }, 400);
  }
};

const buildLabel = (() => {
  try {
    const d = new Date(__BUILD_TIME__);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `v${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  } catch {
    return '';
  }
})();

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeView, setActiveView] = useState('Default');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>('nl');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await dataService.ensureSeeded();
        const projects = await dataService.getProjects();
        if (projects.length > 0) setActiveProject(projects[0]);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
    // Google Translate is now initialised in index.html before React boots — no work needed here.
  }, []);

  useEffect(() => {
    if (user?.role === UserRole.SUPER_ADMIN && window.location.pathname === '/create-user') {
      setActiveView('Nieuwe Klant');
    }
  }, [user]);

  // Re-apply translation whenever the user navigates to a different view.
  // React re-renders replace GT's <font> wrappers, so we must re-trigger.
  useEffect(() => {
    if (lang !== 'nl') {
      const t = setTimeout(() => triggerGoogleTranslate(lang), 150);
      return () => clearTimeout(t);
    }
  }, [activeView, user]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = async (email: string, password?: string) => {
    setIsLoggingIn(true);
    try {
      console.log('Attempting login for:', email);
      const users = await dataService.getUsers();
      console.log('Users fetched:', users.length);
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (found) {
        if (found.password && found.password !== password) {
          alert('Onjuist wachtwoord.');
          return;
        }
        setUser(found);
        
        // Log the login
        dataService.logUserLogin(found.id, 'unknown', navigator.userAgent).catch(console.error);

        const projects = await dataService.getProjects();
        if (found.role === UserRole.SUPER_ADMIN) {
          if (window.location.pathname === '/create-user') {
            setActiveView('Nieuwe Klant');
          } else {
            setActiveView('Statistieken');
          }
          if (projects.length > 0) {
            setActiveProject(projects[0]);
          }
        } else if (found.role === UserRole.PROJECT_ADMIN) {
          setActiveView('Dashboard');
          const p = projects.find(proj => proj.id === found.projectId);
          setActiveProject(p || null);
        } else {
          setActiveView('Overzicht');
          const p = projects.find(proj => proj.id === found.projectId);
          setActiveProject(p || null);
        }
      } else {
        alert('Onbekend emailadres.');
      }
    } catch (error) {
      console.error("Login error:", error);
      alert('Er is een fout opgetreden bij het inloggen. Controleer uw verbinding.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    setUser(null);
    setActiveProject(null);
    setActiveView('Default');
  };

  const t = (key: string) => (translations[lang] as any)[key] || key;

  // Public demo page — no auth required
  const demoMatch = window.location.pathname.match(/^\/demo\/([^/]+)/);
  if (demoMatch) {
    return <DemoPage projectId={demoMatch[1]} />;
  }

  if (isInitializing || isLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#edeae6]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8C7864] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C7864]">Aligning the blueprints for your future....</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, activeProject, setActiveProject, activeView, setActiveView, isSidebarOpen, setSidebarOpen }}>
      <TranslationContext.Provider value={{ t, lang, setLang }}>
        {!user ? (
          <Login onLogin={login} isLoggingIn={isLoggingIn} />
        ) : (
          <div className="flex h-screen font-inter overflow-hidden relative" style={{ backgroundColor: activeProject?.backgroundColor || '#edeae6' }}>
            <div
              className="absolute inset-0 z-0 bg-cover bg-center opacity-20 pointer-events-none print:hidden"
              style={{ backgroundImage: `url(https://www.whoon.com/wp-content/uploads/2026/02/2e51ae92f59d5cb308c03b8dd6b83d91.jpg)` }}
            />
            <div className="print:hidden h-full flex flex-shrink-0">
              <Sidebar />
            </div>
            <div className="flex-1 flex flex-col min-w-0 z-10 relative">
              <div className="print:hidden">
                <Header />
              </div>
              <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar print:p-0 print:overflow-visible">
                {user.role === UserRole.SUPER_ADMIN && <SuperAdminDashboard />}
                {user.role === UserRole.PROJECT_ADMIN && <ProjectAdminDashboard />}
                {user.role === UserRole.CUSTOMER && <CustomerPortal />}
              </main>
            </div>
          </div>
        )}
        {buildLabel && (
          <div className="fixed bottom-2 right-3 z-[9999] pointer-events-none print:hidden select-none">
            <span className="text-[9px] font-mono text-slate-500 opacity-25 tracking-tight">{buildLabel}</span>
          </div>
        )}
      </TranslationContext.Provider>
    </AuthContext.Provider>
  );
};

export default App;

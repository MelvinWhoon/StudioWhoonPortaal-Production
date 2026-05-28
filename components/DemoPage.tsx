
import React, { useEffect, useState } from 'react';
import { dataService } from '../dataService';
import { MasterPackage, Project } from '../types';
import { getVimeoEmbedUrl } from '../App';

interface DemoPageProps {
  projectId: string;
}

const DemoPage: React.FC<DemoPageProps> = ({ projectId }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [packages, setPackages] = useState<MasterPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<MasterPackage | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [allProjects, pkgs] = await Promise.all([
          dataService.getProjects(),
          dataService.getMasterPackages(projectId),
        ]);
        const found = allProjects.find(p => p.id === projectId);
        if (!found) { setNotFound(true); return; }
        setProject(found);
        setPackages(pkgs);
      } catch (e) {
        console.error('DemoPage load error:', e);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [projectId]);

  // Group packages by category
  const categories = Array.from(new Set(packages.map(p => p.category)));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#edeae6]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#8C7864] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C7864]">Laden...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#edeae6] p-6">
        <div className="bg-white rounded-[2rem] p-12 text-center max-w-md shadow-xl">
          <div className="text-5xl mb-6">🏗️</div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-3">Project niet gevonden</h1>
          <p className="text-slate-400 text-sm font-medium">De link die je hebt ontvangen lijkt niet meer geldig te zijn. Neem contact op met Studio Whoon.</p>
          <a href="https://www.whoon.com" className="mt-8 inline-block px-8 py-4 bg-[#8C7864] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#8C7864]/20">
            Naar Whoon.com
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-inter" style={{ backgroundColor: project?.backgroundColor || '#edeae6' }}>
      {/* Background texture */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-10 pointer-events-none"
        style={{ backgroundImage: `url(https://www.whoon.com/wp-content/uploads/2026/02/2e51ae92f59d5cb308c03b8dd6b83d91.jpg)` }}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {project?.logoUrl && (
                <img src={project.logoUrl} alt={project.name} className="h-9 w-auto object-contain" referrerPolicy="no-referrer" />
              )}
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <span className="text-sm font-black uppercase tracking-tighter text-slate-900 hidden sm:block">
                {project?.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:block">
                Pakketoverzicht
              </span>
              <span className="w-2 h-2 rounded-full bg-[#8C7864] animate-pulse" />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 md:px-10 py-12 space-y-16">
          {/* Project info block */}
          <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            {project?.additionalPhotos?.[0] && (
              <div className="relative h-64 md:h-80 overflow-hidden">
                <img
                  src={project.additionalPhotos[0]}
                  className="w-full h-full object-cover"
                  alt={project.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-8">
                  <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none">
                    {project.name}
                  </h1>
                  {(project.city || project.address) && (
                    <p className="text-white/70 font-bold text-sm mt-2 uppercase tracking-wide">
                      📍 {[project.address, project.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="p-8">
              {!project?.additionalPhotos?.[0] && (
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4">{project?.name}</h1>
              )}
              <div className="flex flex-wrap gap-6">
                {project?.address && (
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Adres</span>
                    <span className="text-sm font-bold text-slate-700">{project.address}{project.city ? `, ${project.city}` : ''}</span>
                  </div>
                )}
                {project?.deliveryDate && (
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Verwachte oplevering</span>
                    <span className="text-sm font-bold text-slate-700">{project.deliveryDate}</span>
                  </div>
                )}
                {project?.homesCount ? (
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Woningen</span>
                    <span className="text-sm font-bold text-slate-700">{project.homesCount} units</span>
                  </div>
                ) : null}
                {project?.status && (
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Status</span>
                    <span className="text-sm font-bold text-[#8C7864]">{project.status}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Packages */}
          {packages.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-slate-100 p-16 text-center">
              <div className="text-4xl mb-4 opacity-30">📦</div>
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Geen pakketten beschikbaar</p>
            </div>
          ) : (
            <section className="space-y-12">
              <div className="flex items-baseline gap-4">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Beschikbare Pakketten</h2>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{packages.length} opties</span>
              </div>

              {categories.map(cat => {
                const catPackages = packages.filter(p => p.category === cat);
                return (
                  <div key={cat} className="space-y-6">
                    {categories.length > 1 && (
                      <div className="flex items-center gap-4">
                        <span className="px-4 py-1.5 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded-xl shadow-sm">
                          {cat}
                        </span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {catPackages.map(pkg => (
                        <PackageCard key={pkg.id} pkg={pkg} onSelect={() => setSelectedPackage(pkg)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </main>

      </div>

      {/* Package detail modal */}
      {selectedPackage && (
        <PackageModal pkg={selectedPackage} onClose={() => setSelectedPackage(null)} />
      )}
    </div>
  );
};

/* ─── Package card ─────────────────────────────────────────── */
const PackageCard: React.FC<{ pkg: MasterPackage; onSelect: () => void }> = ({ pkg, onSelect }) => {
  const hasVideo = Boolean(pkg.vimeoUrl && getVimeoEmbedUrl(pkg.vimeoUrl));
  const mainPhoto = pkg.photos?.[0];

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden cursor-pointer group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative h-52 bg-slate-100 overflow-hidden">
        {mainPhoto ? (
          <img src={mainPhoto} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={pkg.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20 text-4xl">🏠</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Category badge */}
        <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 text-[9px] font-black uppercase tracking-widest text-slate-700 rounded-lg shadow-sm">
          {pkg.category}
        </span>

        {/* Video indicator */}
        {hasVideo && (
          <div className="absolute top-4 right-4 w-9 h-9 bg-white/90 rounded-xl flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-[#8C7864]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 mb-4 leading-none">{pkg.name}</h3>
        {(pkg.inclusions || []).length > 0 && (
          <ul className="space-y-2 flex-1 mb-5">
            {(pkg.inclusions || []).slice(0, 4).map((inc, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[11px] font-bold text-slate-600">
                <span className="w-1.5 h-1.5 bg-[#8C7864] rounded-full shrink-0" />
                {inc}
              </li>
            ))}
            {(pkg.inclusions || []).length > 4 && (
              <li className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">
                +{(pkg.inclusions || []).length - 4} meer
              </li>
            )}
          </ul>
        )}
        <button
          onClick={onSelect}
          className="w-full py-3 border-2 border-slate-100 text-[#8C7864] rounded-[1rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 hover:border-[#8C7864] transition-all"
        >
          Meer info →
        </button>
      </div>
    </div>
  );
};

/* ─── Package detail modal ─────────────────────────────────── */
const PackageModal: React.FC<{ pkg: MasterPackage; onClose: () => void }> = ({ pkg, onClose }) => {
  const embedUrl = pkg.vimeoUrl ? getVimeoEmbedUrl(pkg.vimeoUrl) : null;

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-8 overflow-y-auto"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-200 my-4 relative overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 w-11 h-11 bg-slate-100 hover:bg-slate-200 rounded-2xl flex items-center justify-center text-slate-600 transition-colors font-black"
        >
          ✕
        </button>

        <div className="p-8 md:p-12">
          <div className="flex items-start gap-4 mb-8">
            <div>
              <span className="px-3 py-1 bg-[#8C7864]/10 text-[#8C7864] text-[9px] font-black uppercase tracking-widest rounded-lg">
                {pkg.category}
              </span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 mt-2 leading-none">
                {pkg.name}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left: media */}
            <div className="space-y-5">
              {/* Vimeo embed */}
              {embedUrl && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sfeerfilm</h3>
                  <div className="relative w-full rounded-2xl overflow-hidden bg-slate-100 shadow-lg" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={embedUrl}
                      className="absolute inset-0 w-full h-full"
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title={`Sfeerfilm ${pkg.name}`}
                    />
                  </div>
                </div>
              )}

              {/* Photo grid */}
              {(pkg.photos || []).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Foto's</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {(pkg.photos || []).map((url, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden aspect-video bg-slate-100 border border-slate-100">
                        <img src={url} className="w-full h-full object-cover" alt={`${pkg.name} ${i + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!embedUrl && (pkg.photos || []).length === 0 && (
                <div className="rounded-2xl aspect-video bg-slate-50 border border-slate-100 flex items-center justify-center opacity-30">
                  <span className="font-black uppercase text-xs text-slate-400">Geen media beschikbaar</span>
                </div>
              )}
            </div>

            {/* Right: details */}
            <div className="space-y-8">
              {(pkg.inclusions || []).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-3 mb-5">
                    Inbegrepen in dit pakket
                  </h3>
                  <ul className="space-y-3">
                    {(pkg.inclusions || []).map((inc, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                        <span className="w-2 h-2 bg-[#8C7864] rounded-full shrink-0" />
                        {inc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(pkg.extras || []).length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-5">
                    Optionele Extra's
                  </h3>
                  <ul className="space-y-3">
                    {(pkg.extras || []).map(extra => (
                      <li key={extra.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-2 h-2 bg-slate-300 rounded-full shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-slate-700 block">{extra.name}</span>
                            {extra.description && <span className="text-[10px] text-slate-400">{extra.description}</span>}
                          </div>
                        </div>
                        <span className="text-sm font-black text-[#8C7864] shrink-0">+€{extra.price.toLocaleString('nl-NL')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pkg.description && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Omschrijving</h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{pkg.description}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoPage;

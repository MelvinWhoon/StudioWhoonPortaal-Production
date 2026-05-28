
import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useTranslation, useMessageTranslation, getVimeoEmbedUrl } from '../App';
import { dataService } from '../dataService';
import { PortalDocument, Message, Notification, UserRole, MasterPackage, MessageCategory } from '../types';
import { downloadFile } from '../downloadUtils';

const InteractiveGallery: React.FC<{ photos: string[] }> = ({ photos }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  if (!photos || photos.length === 0) return (
    <div className="w-full aspect-video bg-slate-100 rounded-[2rem] flex items-center justify-center text-[10px] font-black text-slate-300 uppercase">Geen afbeeldingen</div>
  );
  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="relative rounded-[2.5rem] overflow-hidden bg-slate-100 aspect-video border border-slate-100 shadow-sm">
        <img src={photos[activeIndex]} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" alt="Gallery" />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
          {photos.map((url, i) => (
            <button key={i} onClick={() => setActiveIndex(i)} className={`relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 transition-all border-2 ${i === activeIndex ? 'border-[#8C7864] scale-95' : 'border-transparent opacity-60'}`}>
              <img src={url} className="w-full h-full object-cover" alt="Thumb" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CustomerPortal: React.FC = () => {
  const { user, activeProject, activeView, setActiveView } = useAuth();
  const { t, lang } = useTranslation();
  const [docs, setDocs] = useState<PortalDocument[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const { translatedMessages, isTranslating } = useMessageTranslation(messages, lang);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [packages, setPackages] = useState<MasterPackage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasShownAutoReply = useRef(false);
  const [systemMessages, setSystemMessages] = useState<Array<{id: string; text: string; date: string}>>([]);
  const [showPackageVideo, setShowPackageVideo] = useState(false);

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [payments, setPayments] = useState<any[]>([]);
  useEffect(() => {
    if (user && activeView === 'Financieel') {
      dataService.getPayments(user.projectId, user.id).then(setPayments);
    }
  }, [user, activeView]);

  const refreshDocs = async () => {
    if (user) {
      const allDocs = await dataService.getDocuments(user.id);
      setDocs(allDocs);
    }
  };

  useEffect(() => {
    if (user) {
      setIsInitialLoading(true);
      Promise.all([
        refreshDocs(),
        dataService.getMessages(user.id).then(setMessages),
        dataService.getNotifications(user.id).then(setNotifications),
        dataService.getMasterPackages(activeProject?.id).then(setPackages)
      ])
      .catch(console.error)
      .finally(() => setIsInitialLoading(false));
    }
  }, [user, activeView, activeProject]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (isInitialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8C7864] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C7864]">Aligning the blueprints for your future....</p>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProjectId = activeProject?.id || user?.projectId;
    if (!newMessage.trim() || !user || !targetProjectId || isSending) return;

    setIsSending(true);
    try {
      await dataService.sendMessage(targetProjectId, user.id, user.id, user.name, user.role, newMessage);
      const updatedMessages = await dataService.getMessages(user.id);
      setMessages(updatedMessages);
      setNewMessage('');

      // Eénmalige auto-reply per sessie
      if (!hasShownAutoReply.current) {
        hasShownAutoReply.current = true;
        setTimeout(() => {
          setSystemMessages(prev => [...prev, {
            id: `sys-${Date.now()}`,
            text: 'Uw bericht is ontvangen. Deze chat wordt niet realtime bijgehouden — uw projectbegeleider reageert zo snel mogelijk.',
            date: new Date().toISOString()
          }]);
        }, 1000);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Er is een fout opgetreden bij het verzenden van uw bericht.");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeProject) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        await dataService.uploadDocument(
          activeProject.id,
          user.id,
          uploadFileName || file.name,
          user.name,
          UserRole.CUSTOMER,
          sizeMb,
          base64Data
        );
        setUploadFileName('');
        await refreshDocs();
        alert('Bestand succesvol geüpload!');
      } catch (err) {
        alert(t('error_generic'));
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
  };

  const currentPackage = packages.find(mp => mp.id === user?.masterPackageId);
  const selectedExtras = (currentPackage?.extras || []).filter(ex => (user?.selectedExtraIds || []).includes(ex.id));
  const extrasTotal = selectedExtras.reduce((sum, ex) => sum + ex.price, 0);

  if (activeView === 'Financieel') {
    const totalCosts = user?.agreedPackagePrice || 0;
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = totalCosts - totalPaid;

    return (
      <div className="space-y-6 animate-in fade-in">
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Financieel Overzicht</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Totale Kosten</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-slate-900 tracking-tighter">€{totalCosts.toLocaleString('nl-NL')}</span>
              <span className="text-xl opacity-20">💰</span>
            </div>
          </div>
          <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Totaal Betaald</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-green-600 tracking-tighter">€{totalPaid.toLocaleString('nl-NL')}</span>
              <span className="text-xl opacity-20">✅</span>
            </div>
          </div>
          <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Openstaand Bedrag</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-orange-500 tracking-tighter">€{outstanding.toLocaleString('nl-NL')}</span>
              <span className="text-xl opacity-20">⏳</span>
            </div>
          </div>
        </div>

        {selectedExtras.length > 0 && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Kostenopbouw</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 font-bold">Basispakket — {currentPackage?.name}</span>
                <span className="text-sm font-black text-slate-900">€{(currentPackage?.price || 0).toLocaleString('nl-NL')}</span>
              </div>
              {selectedExtras.map(extra => (
                <div key={extra.id} className="flex justify-between items-center pl-4">
                  <span className="text-sm text-slate-500 font-bold">+ {extra.name}</span>
                  <span className="text-sm font-black text-[#8C7864]">€{extra.price.toLocaleString('nl-NL')}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Afgesproken Totaalprijs</span>
                <span className="text-lg font-black text-slate-900">€{(user?.agreedPackagePrice || 0).toLocaleString('nl-NL')}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Betalingshistorie</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[440px]">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Datum</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Bedrag</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Notitie</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500 font-bold">{new Date(p.date).toLocaleDateString('nl-NL')}</td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900 tracking-tight">€{Number(p.amount).toLocaleString('nl-NL')}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{p.note || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">Betaald</span>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-[10px] font-black uppercase text-slate-300 italic">Geen betalingen gevonden</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'Berichten') {
    // Merge real messages with local system messages, sorted by date
    const chatItems = [
      ...messages.map(m => ({ kind: 'msg' as const, data: m, date: m.date })),
      ...systemMessages.map(s => ({ kind: 'sys' as const, data: s, date: s.date }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
      <div className="flex flex-col lg:flex-row gap-5 h-auto lg:h-[calc(100vh-120px)] animate-in fade-in">
        <div className="flex-1 min-h-[380px] bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Project Chat</h2>
            {isTranslating && <span className="text-[8px] font-black text-[#8C7864] animate-pulse">Vertaald door AI...</span>}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar bg-slate-50/20">
            {chatItems.map(item => {
              // System / auto-reply message
              if (item.kind === 'sys') {
                return (
                  <div key={item.data.id} className="flex justify-center my-2 animate-in fade-in duration-500">
                    <div className="bg-slate-100/90 border border-slate-200/60 rounded-2xl px-4 py-2.5 max-w-[85%] flex items-start gap-2">
                      <span className="text-slate-400 text-[12px] mt-0.5 shrink-0">💬</span>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{item.data.text}</p>
                    </div>
                  </div>
                );
              }

              // Regular chat message
              const m = item.data;
              const isMe = m.senderId === user?.id;
              const text = translatedMessages[m.id] || m.text;
              // "Read" heuristic: admin has replied after this message
              const isRead = isMe && messages.some(
                msg => msg.role !== UserRole.CUSTOMER && new Date(msg.date) > new Date(m.date)
              );

              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[72%] px-4 py-3 rounded-2xl shadow-sm ${
                    isMe
                      ? 'bg-[#8C7864] text-white rounded-br-sm'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm shadow-none'
                  }`}>
                    <p className="text-sm leading-snug">{text}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                      <span className={`text-[9px] ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
                        {new Date(m.date).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'})}
                      </span>
                      {isMe && (
                        <span className={`text-[10px] leading-none tracking-[-2px] transition-colors duration-300 ${
                          isRead ? 'text-blue-200' : 'text-white/40'
                        }`}>✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {chatItems.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-16">
                <p className="text-[10px] font-black uppercase text-slate-300 italic">Nog geen berichten</p>
              </div>
            )}
            <div ref={msgEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="px-5 py-4 border-t border-slate-50 bg-white flex gap-3">
            <input
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm focus:border-[#8C7864] transition-colors"
              placeholder={t('type_message')}
              value={newMessage}
              onChange={e=>setNewMessage(e.target.value)}
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              className={`px-8 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 ${
                isSending || !newMessage.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#8C7864] text-white shadow-lg shadow-[#8C7864]/20'
              }`}
            >
              {isSending ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                  <span>Verzenden</span>
                </span>
              ) : 'Verzend'}
            </button>
          </form>
        </div>

        <div className="w-full lg:w-64 bg-white rounded-[2rem] border border-slate-100 p-5 shrink-0">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-3">Meldingen</h3>
           <div className="space-y-3 max-h-48 lg:max-h-none lg:h-[calc(100%-52px)] overflow-y-auto custom-scrollbar">
              {notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 rounded-xl border ${n.isRead ? 'bg-white border-slate-50 opacity-50' : 'bg-[#8C7864]/5 border-[#8C7864]/10'}`}>
                  <p className="text-[11px] font-bold text-slate-700 leading-snug">{n.text}</p>
                </div>
              ))}
              {notifications.length === 0 && <div className="text-center text-[10px] font-black uppercase text-slate-300 py-8 italic">Geen nieuwe meldingen</div>}
           </div>
        </div>
      </div>
    );
  }

  if (activeView === 'Documenten') {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Documenten</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Beheer uw bestanden en uploads</p>
          </div>
          <div className="bg-white px-4 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Naam van bestand (optioneel)"
              className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-[#8C7864] transition-all flex-1"
              value={uploadFileName}
              onChange={e => setUploadFileName(e.target.value)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-2.5 bg-[#8C7864] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-[#8C7864]/20 active:scale-95 transition-all whitespace-nowrap"
            >
              {isUploading ? 'Uploaden...' : 'Uploaden'}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[440px]">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Bestand</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Datum</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Grootte</th>
                  <th className="px-6 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{doc.fileName}</div>
                      <div className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">Door: {doc.uploadedBy}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-bold">{doc.date}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-bold">{doc.size}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                         <button onClick={() => downloadFile(doc.externalUrl || '', doc.fileName)} className="w-9 h-9 bg-slate-900 text-white rounded-xl hover:bg-[#8C7864] transition-all flex items-center justify-center text-sm">📥</button>
                         {doc.uploadedBy === user?.name && (
                           <button onClick={() => dataService.deleteDocument(doc.id).then(refreshDocs)} className="w-9 h-9 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center text-sm">🗑️</button>
                         )}
                      </div>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-[10px] font-black uppercase text-slate-300 italic">Nog geen documenten aanwezig in uw dossier</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'Mijn Pakket') {
    return (
      <div className="space-y-6 animate-in fade-in">
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Mijn Geselecteerde Pakket</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            {/* Sfeerfilm */}
            {currentPackage?.vimeoUrl && getVimeoEmbedUrl(currentPackage.vimeoUrl) && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sfeerfilm</h3>
                <div className="relative w-full rounded-[1.5rem] overflow-hidden bg-slate-100 shadow-sm" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={getVimeoEmbedUrl(currentPackage.vimeoUrl)!}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Sfeerfilm pakket"
                  />
                </div>
              </div>
            )}

            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alle Pakket-afbeeldingen</h3>
            <div className="grid grid-cols-1 gap-5">
              {(currentPackage?.photos || []).map((photo, i) => (
                <div key={i} className="relative rounded-[1.5rem] overflow-hidden bg-slate-100 aspect-video border border-slate-100 shadow-sm">
                  <img src={photo} className="w-full h-full object-cover" alt={`Package view ${i}`} />
                </div>
              ))}
              {(currentPackage?.photos || []).length === 0 && (
                <div className="bg-white rounded-[1.5rem] border border-slate-100 p-14 text-center opacity-20 italic uppercase font-black text-xs">Geen foto's beschikbaar</div>
              )}
            </div>
          </div>
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm text-slate-900 h-fit sticky top-6">
             <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter mb-1">{currentPackage?.name || 'Pakket laden...'}</h2>
             <div className="space-y-6 mt-6">
                <div>
                   <h3 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-50 pb-3 tracking-widest mb-4">Inbegrepen Inhoud</h3>
                   <ul className="space-y-3">
                      {currentPackage?.inclusions?.map((inc, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                           <span className="w-1.5 h-1.5 bg-[#8C7864] rounded-full shrink-0" />
                           {inc}
                        </li>
                      ))}
                   </ul>
                </div>
                {selectedExtras.length > 0 && (
                  <div className="pt-5 border-t border-slate-50">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Uw Extra's</h3>
                    <ul className="space-y-3">
                      {selectedExtras.map(extra => (
                        <li key={extra.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-1.5 h-1.5 bg-[#8C7864] rounded-full shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-slate-700 block truncate">{extra.name}</span>
                              {extra.description && <span className="text-[10px] text-slate-400 block truncate">{extra.description}</span>}
                            </div>
                          </div>
                          <span className="text-sm font-black text-[#8C7864] shrink-0">€{extra.price.toLocaleString('nl-NL')}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Totaal Extra's</span>
                      <span className="text-base font-black text-slate-900">€{extrasTotal.toLocaleString('nl-NL')}</span>
                    </div>
                  </div>
                )}

                {currentPackage?.description && (
                  <div className="pt-5 border-t border-slate-50">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Pakketomschrijving</h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{currentPackage.description}</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start gap-3">
        <div>
           <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Welkom, {user?.name}</h1>
           <p className="text-[10px] text-[#8C7864] font-bold uppercase mt-2 tracking-widest">Uw persoonlijk dossier voor {activeProject?.name}</p>
        </div>
        <div className="bg-white px-4 py-2.5 rounded-[1rem] border border-slate-100 shadow-sm flex items-center gap-3">
           <div className="w-7 h-7 bg-[#8C7864]/10 rounded-lg flex items-center justify-center text-base">📄</div>
           <div>
              <span className="text-[8px] font-black text-slate-400 uppercase block leading-none mb-0.5">Dossier Nummer</span>
              <span className="text-xs font-black text-slate-900">{user?.apartmentId || 'N.v.t.'}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Apartment Card */}
        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="p-5 sm:p-7">
             <div className="h-48 sm:h-56 rounded-[1.5rem] overflow-hidden mb-5 shadow-lg relative">
                <img src={activeProject?.additionalPhotos?.[0]} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <h3 className="absolute bottom-4 left-5 text-base font-black text-white uppercase tracking-tighter">Uw Nieuwe Thuis</h3>
             </div>

             <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                   <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Bouwvoortgang</span>
                      <div className="text-2xl font-black text-slate-900 tracking-tighter">{user?.constructionProgress?.total || 0}%</div>
                      <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8C7864] transition-all duration-1000" style={{ width: `${user?.constructionProgress?.total || 0}%` }} />
                      </div>
                   </div>
                   <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1 tracking-widest">Verwachte Oplevering</span>
                      <div className="text-2xl font-black text-slate-900 tracking-tighter">{user?.apartmentDetails?.deliveryDate || 'T.b.a.'}</div>
                      <div className="mt-2 text-[9px] font-black text-[#8C7864] uppercase">{activeProject?.status}</div>
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-50 space-y-1">
                   <div className="flex justify-between items-center bg-slate-50/60 px-3 py-2.5 rounded-xl">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Adres Project</span>
                      <span className="text-[11px] font-bold text-slate-700">{activeProject?.address || 'Niet beschikbaar'}</span>
                   </div>
                   <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Woonoppervlakte</span>
                      <span className="text-[11px] font-bold text-slate-700">{user?.apartmentDetails?.surface || 0} m²</span>
                   </div>
                   <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aantal Kamers</span>
                      <span className="text-[11px] font-bold text-slate-700">{user?.apartmentDetails?.rooms || 0}</span>
                   </div>
                   <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Etage / Verdieping</span>
                      <span className="text-[11px] font-bold text-slate-700">{user?.apartmentDetails?.floor || 0}e etage</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Package Card */}
        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden group hover:shadow-xl transition-all duration-500 flex flex-col">
          <div className="p-5 sm:p-7 flex flex-col flex-1">
             <div className="h-48 sm:h-56 rounded-[1.5rem] overflow-hidden mb-5 shadow-lg relative">
                {showPackageVideo && currentPackage?.vimeoUrl && getVimeoEmbedUrl(currentPackage.vimeoUrl) ? (
                  <div className="w-full h-full bg-black">
                    <iframe
                      src={`${getVimeoEmbedUrl(currentPackage.vimeoUrl)}&autoplay=1`}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      title="Sfeerfilm"
                    />
                    <button
                      onClick={() => setShowPackageVideo(false)}
                      className="absolute top-3 right-3 w-8 h-8 bg-black/60 text-white rounded-xl flex items-center justify-center text-xs font-black hover:bg-black/80 transition-colors z-10"
                    >✕</button>
                  </div>
                ) : (
                  <>
                    <img src={currentPackage?.photos?.[0]} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <h3 className="absolute bottom-4 left-5 text-base font-black text-white uppercase tracking-tighter">Geselecteerd Pakket</h3>
                    {currentPackage?.vimeoUrl && getVimeoEmbedUrl(currentPackage.vimeoUrl) && (
                      <button
                        onClick={() => setShowPackageVideo(true)}
                        className="absolute top-3 right-3 w-10 h-10 bg-white/90 rounded-xl flex items-center justify-center shadow-lg hover:bg-white hover:scale-110 transition-all"
                        title="Sfeerfilm bekijken"
                      >
                        <svg className="w-5 h-5 text-[#8C7864] ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </button>
                    )}
                  </>
                )}
             </div>
             <h3 className="text-lg font-black uppercase tracking-tighter mb-4 text-slate-900">{currentPackage?.name || 'Nog geen pakket gekozen'}</h3>

             <div className="space-y-2 mb-5 flex-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hoogtepunten van selectie</span>
                {(currentPackage?.inclusions || []).slice(0,6).map((inc, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50/60 px-3 py-2.5 rounded-xl border border-slate-50">
                    <span className="w-1.5 h-1.5 bg-[#8C7864] rounded-full shrink-0" />
                    <span className="text-[11px] font-bold text-slate-700 leading-snug">{inc}</span>
                  </div>
                ))}
                {(currentPackage?.inclusions || []).length === 0 && (
                  <div className="text-center py-8 text-[10px] text-slate-300 uppercase font-black italic">Geen informatie beschikbaar</div>
                )}
             </div>

             <button
               onClick={() => setActiveView('Mijn Pakket')}
               className="w-full py-3.5 border-2 border-slate-100 text-[#8C7864] rounded-[1rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 hover:border-[#8C7864] transition-all"
             >
               Volledig pakket inzien
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerPortal;

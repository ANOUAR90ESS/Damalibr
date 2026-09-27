import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { SEED_BOOKS, SEED_ADAPTATIONS, SEED_EPISODES } from '../../data/seedBooks';
import { TopNavBar } from '../navigation/TopNavBar';
import { Bookmark, Play, CheckCircle2, Download, Trash2, BookOpen } from 'lucide-react';

export const LibraryScreen: React.FC = () => {
  const navigate = useNavigate();
  const { items, progress, setBookState, removeOfflineDownload } = useLibraryStore();
  const { playEpisode } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<'started' | 'to_watch' | 'finished' | 'downloads'>('started');

  // Map library items to books
  const startedBooks = Object.values(items)
    .filter(i => i.state === 'started')
    .map(i => SEED_BOOKS.find(b => b.id === i.book_id))
    .filter((b): b is typeof SEED_BOOKS[0] => Boolean(b));

  const toWatchBooks = Object.values(items)
    .filter(i => i.state === 'to_watch' || i.is_bookmarked)
    .map(i => SEED_BOOKS.find(b => b.id === i.book_id))
    .filter((b): b is typeof SEED_BOOKS[0] => Boolean(b));

  const finishedBooks = Object.values(items)
    .filter(i => i.state === 'finished')
    .map(i => SEED_BOOKS.find(b => b.id === i.book_id))
    .filter((b): b is typeof SEED_BOOKS[0] => Boolean(b));

  const downloadedBooks = Object.values(items)
    .filter(i => i.is_downloaded)
    .map(i => ({
      book: SEED_BOOKS.find(b => b.id === i.book_id),
      size: i.download_size_mb || 35.4
    }))
    .filter((e): e is { book: typeof SEED_BOOKS[0]; size: number } => Boolean(e.book));

  const handleResume = (bookId: string) => {
    const book = SEED_BOOKS.find(b => b.id === bookId);
    if (!book) return;

    const bookAdaptations = SEED_ADAPTATIONS[book.id] || [];
    const dramaAdapt = bookAdaptations.find(a => a.format === 'drama') || bookAdaptations[0];
    if (!dramaAdapt) return;

    const episodes = SEED_EPISODES[dramaAdapt.id] || [];
    const userProg = Object.values(progress).find(p => p.book_id === book.id && !p.completed);
    const targetEp = episodes.find(e => e.id === userProg?.episode_id) || episodes[0];

    if (targetEp) {
      playEpisode(book, dramaAdapt, targetEp, userProg?.seconds || 0);
    } else {
      navigate(`/book/${book.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <TopNavBar />

      <div className="px-4 space-y-5 pt-3">
        {/* Title */}
        <div>
          <h1 className="font-display text-xl font-black text-slate-100">
            Tu Biblioteca Personal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Progreso sincronizado, listas guardadas y descargas offline
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'started', label: 'Viendo ahora', count: startedBooks.length },
            { id: 'to_watch', label: 'Por ver', count: toWatchBooks.length },
            { id: 'finished', label: 'Terminados', count: finishedBooks.length },
            { id: 'downloads', label: 'Descargas offline', count: downloadedBooks.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-amber-400 text-slate-950 font-bold shadow'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 rounded-full ${
                activeTab === tab.id ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tab 1: Started (Viendo) */}
        {activeTab === 'started' && (
          <div className="space-y-3">
            {startedBooks.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-bold text-sm text-slate-200">Aún no has empezado ningún libro</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Explora el catálogo o abre el feed vertical "Para Ti" para descubrir tu primer microdrama clásico.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Explorar Clásicos
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {startedBooks.map(book => {
                  const userProg = Object.values(progress).find(p => p.book_id === book.id && !p.completed);

                  return (
                    <div
                      key={book.id}
                      className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3.5 group hover:border-slate-700 transition-all"
                    >
                      <div 
                        onClick={() => handleResume(book.id)}
                        className="relative w-16 h-20 rounded-xl overflow-hidden bg-slate-950 shrink-0 cursor-pointer"
                      >
                        <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                          {book.era}
                        </span>
                        <h4 
                          onClick={() => handleResume(book.id)}
                          className="font-bold text-xs text-slate-100 truncate cursor-pointer hover:text-amber-300"
                        >
                          {book.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {book.author}
                        </p>

                        {/* Progress Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 w-2/5 rounded-full" />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-500">
                            <span>En progreso</span>
                            <span className="font-mono">Capítulo 2</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleResume(book.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold shrink-0 transition-colors"
                      >
                        Reanudar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: To Watch (Por ver) */}
        {activeTab === 'to_watch' && (
          <div className="space-y-3">
            {toWatchBooks.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                <Bookmark className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-bold text-sm text-slate-200">Tu lista está vacía</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Guarda libros pulsando el icono de marcapáginas en cualquier obra para verlos más tarde.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {toWatchBooks.map(book => (
                  <div
                    key={book.id}
                    onClick={() => navigate(`/book/${book.id}`)}
                    className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer space-y-2 transition-all"
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-950">
                      <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-100 truncate">{book.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate">{book.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Finished */}
        {activeTab === 'finished' && (
          <div className="space-y-3">
            {finishedBooks.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-bold text-sm text-slate-200">Aún no has completado ninguna obra</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Cuando termines todos los episodios de una adaptación, aparecerá aquí con tus logros de lectura.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {finishedBooks.map(book => (
                  <div key={book.id} className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                    <img src={book.cover_url} alt={book.title} className="w-12 h-16 rounded-xl object-cover" />
                    <div className="flex-1">
                      <h4 className="font-bold text-xs text-slate-100">{book.title}</h4>
                      <p className="text-[11px] text-slate-400">{book.author}</p>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3 h-3" /> Obra completada
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Downloads Offline */}
        {activeTab === 'downloads' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-300 block">Almacenamiento Local (Capacitor)</span>
                <span className="text-[10px] text-slate-400">
                  {downloadedBooks.reduce((acc, d) => acc + d.size, 0).toFixed(1)} MB en el dispositivo
                </span>
              </div>
              <Download className="w-5 h-5 text-emerald-400" />
            </div>

            {downloadedBooks.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                <Download className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-bold text-sm text-slate-200">Sin descargas sin conexión</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Descarga tus episodios favoritos para verlos en el metro o en viajes sin gastar datos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloadedBooks.map(({ book, size }) => (
                  <div 
                    key={book.id}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3"
                  >
                    <img src={book.cover_url} alt={book.title} className="w-12 h-16 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-slate-100 truncate">{book.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate">{book.author}</p>
                      <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                        {size.toFixed(1)} MB · Listo offline
                      </span>
                    </div>

                    <button
                      onClick={() => handleResume(book.id)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
                    >
                      Ver
                    </button>

                    <button
                      onClick={() => removeOfflineDownload(book.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Eliminar descarga"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

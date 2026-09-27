import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEED_BOOKS } from '../../data/seedBooks';
import { Book } from '../../types';
import { Search, Trophy, Filter, Star, Clock, Sparkles } from 'lucide-react';
import { TopNavBar } from '../navigation/TopNavBar';
import { useAuthStore } from '../../stores/useAuthStore';

export const CategoriesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'catalogo' | 'rankings'>('catalogo');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('todos');
  const [selectedEra, setSelectedEra] = useState<string>('todas');
  const [rankingTimeframe, setRankingTimeframe] = useState<'dia' | 'semana' | 'mes' | 'ano'>('semana');

  const genres = ['todos', 'Aventura', 'Tragedia', 'Romance', 'Drama', 'Gótico', 'Sátira', 'Realismo'];
  const eras = ['todas', 'Siglo de Oro', 'Renacimiento', 'Romanticismo', 'Realismo'];

  const filteredBooks = useMemo(() => {
    let list = user.kids_mode_enabled 
      ? SEED_BOOKS.filter(b => b.kids_friendly) 
      : SEED_BOOKS;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.author.toLowerCase().includes(q) ||
        b.synopsis.toLowerCase().includes(q) ||
        b.genres.some(g => g.toLowerCase().includes(q))
      );
    }

    if (selectedGenre !== 'todos') {
      list = list.filter(b => b.genres.includes(selectedGenre));
    }

    if (selectedEra !== 'todas') {
      list = list.filter(b => b.era === selectedEra);
    }

    return list;
  }, [searchQuery, selectedGenre, selectedEra, user.kids_mode_enabled]);

  // Sorted books for rankings
  const rankedBooks = useMemo(() => {
    return [...SEED_BOOKS].sort((a, b) => {
      if (rankingTimeframe === 'dia') return b.total_views * 0.08 - a.total_views * 0.08;
      if (rankingTimeframe === 'semana') return b.total_views * 0.25 - a.total_views * 0.25;
      if (rankingTimeframe === 'mes') return b.total_views * 0.6 - a.total_views * 0.6;
      return b.total_views - a.total_views;
    });
  }, [rankingTimeframe]);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <TopNavBar />

      <div className="px-4 space-y-5 pt-3">
        {/* Toggle between Explorar Catálogo and Rankings */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('catalogo')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'catalogo'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Explorar y Filtros</span>
          </button>

          <button
            onClick={() => setActiveTab('rankings')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'rankings'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Rankings de Audiencia</span>
          </button>
        </div>

        {activeTab === 'catalogo' ? (
          <>
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por título, autor, personajes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Multi-Level Filter Chips */}
            <div className="space-y-2">
              {/* Géneros */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Géneros Literarios
                </span>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {genres.map(g => (
                    <button
                      key={g}
                      onClick={() => setSelectedGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap capitalize ${
                        selectedGenre === g
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Épocas */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Época Histórica
                </span>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {eras.map(e => (
                    <button
                      key={e}
                      onClick={() => setSelectedEra(e)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap capitalize ${
                        selectedEra === e
                          ? 'bg-purple-600 text-white font-bold'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>{filteredBooks.length} obras encontradas</span>
              </div>

              {filteredBooks.length === 0 ? (
                <div className="text-center py-12 space-y-2 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
                  <p className="text-sm font-semibold text-slate-300">No se encontraron clásicos con estos filtros</p>
                  <p className="text-xs text-slate-500">Prueba a limpiar la búsqueda o cambiar de género.</p>
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedGenre('todos'); setSelectedEra('todas'); }}
                    className="mt-2 px-4 py-2 rounded-xl bg-slate-800 text-xs text-amber-400 font-semibold"
                  >
                    Restablecer filtros
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {filteredBooks.map(book => (
                    <div
                      key={book.id}
                      onClick={() => navigate(`/book/${book.id}`)}
                      className="group cursor-pointer space-y-1.5"
                    >
                      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 group-hover:border-amber-500/50 transition-all shadow-lg">
                        <img 
                          src={book.cover_url} 
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        
                        <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-amber-300">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>{book.rating}</span>
                        </div>

                        <div className="absolute bottom-2 left-2 right-2 text-white">
                          <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider block">
                            {book.era}
                          </span>
                          <h4 className="font-display font-bold text-xs truncate">
                            {book.title}
                          </h4>
                        </div>
                      </div>

                      <h4 className="font-semibold text-xs text-slate-200 truncate group-hover:text-amber-300 transition-colors">
                        {book.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {book.author}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Rankings Tab View */
          <div className="space-y-4">
            {/* Timeframe Chips */}
            <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-semibold">
              {[
                { id: 'dia', label: 'Hoy' },
                { id: 'semana', label: 'Esta Semana' },
                { id: 'mes', label: 'Este Mes' },
                { id: 'ano', label: 'Histórico' },
              ].map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setRankingTimeframe(tf.id as any)}
                  className={`flex-1 py-1.5 rounded-lg transition-colors ${
                    rankingTimeframe === tf.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Ranked List */}
            <div className="space-y-2.5">
              {rankedBooks.map((book, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
                const rankBadgeColors = [
                  'bg-amber-400 text-slate-950 border-amber-300', // Gold
                  'bg-slate-300 text-slate-950 border-slate-200', // Silver
                  'bg-amber-700 text-white border-amber-600',     // Bronze
                ];

                return (
                  <div
                    key={book.id}
                    onClick={() => navigate(`/book/${book.id}`)}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 flex items-center gap-3 cursor-pointer group transition-all"
                  >
                    {/* Rank Badge */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-sm border shadow shrink-0 ${
                      isTop3 ? rankBadgeColors[idx] : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      #{rank}
                    </div>

                    {/* Book Thumbnail */}
                    <div className="w-12 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0">
                      <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                    </div>

                    {/* Book Info & Views */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                          {book.title}
                        </h4>
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5 shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-400" /> {book.rating}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {book.author} · {book.era}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                        <span className="font-mono text-amber-300">
                          {(book.total_views / (rankingTimeframe === 'dia' ? 20 : rankingTimeframe === 'semana' ? 4 : 1)).toLocaleString()} vistas
                        </span>
                        <span>·</span>
                        <span className="text-emerald-400 font-medium">🔥 En tendencia</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

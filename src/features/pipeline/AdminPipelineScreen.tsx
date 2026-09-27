import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePipelineStore } from '../../stores/usePipelineStore';
import { TopNavBar } from '../navigation/TopNavBar';
import type { PipelineJob, PipelineStep } from '../../types';
import {
  Wand2, Play, CheckCircle2, RotateCcw, AlertTriangle,
  FileText, Users, Clapperboard, Mic, Image, Video, CheckSquare,
  Terminal, ShieldCheck, BookOpen
} from 'lucide-react';

const STEPS: Array<{ id: PipelineStep; title: string; desc: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'ingest', title: 'Ingesta', desc: 'Importar el texto (pegado, Gutenberg o Wikisource), limpiarlo y segmentarlo en capítulos', icon: FileText },
  { id: 'analyze', title: 'Análisis LLM', desc: 'Extraer personajes, sinopsis, época y asignar una voz a cada personaje', icon: Users },
  { id: 'adapt', title: 'Guiones', desc: 'Microdrama 9:16 con cliffhangers, cortometraje 16:9 y video-resumen narrado', icon: Clapperboard },
  { id: 'voices', title: 'Voces TTS', desc: 'Generar el audio de cada línea con la voz y la emoción del personaje', icon: Mic },
  { id: 'visuals', title: 'Visuales', desc: 'Portada, fondo y una imagen por escena', icon: Image },
  { id: 'render', title: 'Render & HLS', desc: 'FFmpeg: Ken Burns, subtítulos quemados, MP4 y HLS', icon: Video },
  { id: 'review', title: 'Revisión', desc: 'Revisa los vídeos y aprueba la publicación en el catálogo', icon: CheckSquare },
];

const stepIndex = (step: PipelineStep) => (step === 'published' ? STEPS.length : STEPS.findIndex(s => s.id === step));

const SAMPLES = [
  {
    label: 'La vida es sueño',
    title: 'La vida es sueño',
    author: 'Pedro Calderón de la Barca',
    text: `JORNADA PRIMERA
ROSAURA: Hipogrifo violento, que corriste parejas con el viento, ¿dónde, rayo sin llama, pájaro sin matiz, pez sin escama, y bruto sin instinto natural, al confuso laberinto de esas desnudas peñas te desbocas, te arrastras y despeñas?
CLARÍN: ¿Qué hemos de hacer, señora, sino bajar a pie por esta sierra?
SEGISMUNDO: ¡Ay mísero de mí, y ay infelice! Apurar, cielos, pretendo, ya que me tratáis así, qué delito cometí contra vosotros naciendo.

JORNADA SEGUNDA
BASILIO: Segismundo, que aquella prisión sufrió, se verá hoy en palacio como príncipe heredero.
SEGISMUNDO: ¿Qué es la vida? Un frenesí. ¿Qué es la vida? Una ilusión, una sombra, una ficción, y el mayor bien es pequeño.`,
  },
  {
    label: 'Fuenteovejuna',
    title: 'Fuenteovejuna',
    author: 'Lope de Vega',
    text: `ACTO PRIMERO
FERNÁN GÓMEZ: ¿Sabe el Maestre que estoy en la villa?
FLORES: Ya lo sabe, señor, y vendrá a veros.
LAURENCIA: ¡Nunca yo más le viera, ni a él ni a sus vanas razones de amor!
PASCUALA: Pues déjale, Laurencia, que es comendador y manda en la villa.

ACTO SEGUNDO
ESTEBAN: ¿Quién mató al Comendador?
PUEBLO: Fuenteovejuna, señor. Todos a una.`,
  },
];

const formatTime = (ts: string) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleTimeString('es-ES');
};

const formatMinutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

const NewJobForm: React.FC = () => {
  const { createJob, busy } = usePipelineStore();
  const [title, setTitle] = useState(SAMPLES[0].title);
  const [author, setAuthor] = useState(SAMPLES[0].author);
  const [sourceType, setSourceType] = useState<PipelineJob['source_type']>('custom_text');
  const [text, setText] = useState(SAMPLES[0].text);
  const [url, setUrl] = useState('https://www.gutenberg.org/ebooks/2000');
  const [episodes, setEpisodes] = useState(12);
  const [visualMode, setVisualMode] = useState<'economic' | 'premium'>('economic');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createJob({
      title,
      author,
      source_type: sourceType,
      ...(sourceType === 'custom_text' ? { raw_text: text } : { source_url: url }),
      drama_episodes: episodes,
      visual_mode: visualMode,
    });
  };

  const input = 'w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-amber-400 focus:outline-none';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-slate-300 block mb-1">Título de la obra</span>
          <input required value={title} onChange={e => setTitle(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-300 block mb-1">Autor / dramaturgo</span>
          <input required value={author} onChange={e => setAuthor(e.target.value)} className={input} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {([['custom_text', 'Pegar texto'], ['gutenberg', 'Project Gutenberg'], ['wikisource', 'Wikisource']] as const).map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => setSourceType(id)}
            className={`px-3 py-1.5 rounded-xl border font-semibold ${sourceType === id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {sourceType === 'custom_text' ? (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-slate-300">Texto fuente</span>
            <div className="flex gap-2 text-[10px]">
              {SAMPLES.map(s => (
                <button
                  type="button"
                  key={s.label}
                  onClick={() => { setTitle(s.title); setAuthor(s.author); setText(s.text); }}
                  className="text-amber-400 hover:underline"
                >
                  Cargar "{s.label}"
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={7}
            required
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:border-amber-400 focus:outline-none leading-relaxed"
          />
        </div>
      ) : (
        <label className="block">
          <span className="text-xs font-bold text-slate-300 block mb-1">
            URL de {sourceType === 'gutenberg' ? 'Project Gutenberg (p. ej. https://www.gutenberg.org/ebooks/2000)' : 'Wikisource (p. ej. https://es.wikisource.org/wiki/...)'}
          </span>
          <input required type="url" value={url} onChange={e => setUrl(e.target.value)} className={input} />
        </label>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-slate-300 block mb-1">Episodios del microdrama (1–40)</span>
          <input type="number" min={1} max={40} value={episodes} onChange={e => setEpisodes(Number(e.target.value))} className={input} />
        </label>
        <div>
          <span className="text-xs font-bold text-slate-300 block mb-1">Modo visual</span>
          <div className="flex gap-2">
            {(['economic', 'premium'] as const).map(m => (
              <button
                type="button"
                key={m}
                onClick={() => setVisualMode(m)}
                className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold ${visualMode === m ? 'bg-amber-500/10 border-amber-500 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
              >
                {m === 'economic' ? 'Económico (imágenes + Ken Burns)' : 'Premium (Veo, próximamente)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
      >
        <Play className="w-3.5 h-3.5 fill-slate-950" />
        <span>{busy ? 'Creando…' : 'Crear trabajo e iniciar ingesta'}</span>
      </button>
    </form>
  );
};

const ScriptPreview: React.FC<{ job: PipelineJob }> = ({ job }) => {
  const drama = job.adaptations?.find(a => a.format === 'drama');
  const episode = drama ? job.episodes?.[drama.id]?.[0] : undefined;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(job.adaptations || []).map(a => (
          <div key={a.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <strong className="text-slate-100 capitalize block">{a.format === 'drama' ? 'Microdrama' : a.format === 'film' ? 'Cortometraje' : 'Resumen'} · {a.aspect_ratio}</strong>
            <span className="text-slate-400">{a.episode_count} episodio(s) · {formatMinutes(a.total_duration)} min</span>
          </div>
        ))}
      </div>
      {episode && (
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-400">Episodio 1: {episode.title}</span>
            <span className="text-[10px] text-slate-500">{formatMinutes(episode.duration)} min</span>
          </div>
          <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-850 max-h-64 overflow-y-auto">
            {episode.script_json.scenes.map(scene => (
              <div key={scene.id} className="space-y-1">
                <p className="text-slate-500 italic">[{scene.setting}]</p>
                {scene.lines.map(line => (
                  <p key={line.id}>
                    <strong className="text-amber-300">{line.character_name.toUpperCase()} ({line.emotion}):</strong> {line.text}
                    {line.audio_url && <audio controls preload="none" src={line.audio_url} className="h-6 mt-1 w-full" />}
                  </p>
                ))}
              </div>
            ))}
            {episode.cliffhanger && <p className="text-rose-400 font-bold pt-1">[CLIFFHANGER: {episode.cliffhanger}]</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const StepBody: React.FC<{ job: PipelineJob }> = ({ job }) => {
  const { setVisualMode } = usePipelineStore();
  const step = job.current_step;

  if (step === 'ingest') {
    return (
      <p className="text-xs text-slate-400">
        Fuente: {job.source_type === 'custom_text' ? `texto pegado (${(job.raw_text || '').length.toLocaleString('es-ES')} caracteres)` : job.source_url}
      </p>
    );
  }

  if (step === 'analyze') {
    return (
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-300">{job.chapters?.length || 0} capítulos / segmentos detectados</span>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-400 max-h-48 overflow-y-auto">
          {(job.chapters || []).map((c, i) => (
            <li key={i} className="px-2 py-1 rounded bg-slate-950 border border-slate-850 flex justify-between gap-2">
              <span className="truncate">{c.title}</span>
              <span className="font-mono text-slate-600 shrink-0">{c.length.toLocaleString('es-ES')}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (step === 'adapt') {
    return (
      <div className="space-y-4">
        {job.book && (
          <div className="text-xs text-slate-300 space-y-1">
            <p><strong className="text-slate-100">Sinopsis:</strong> {job.book.synopsis}</p>
            <p className="text-slate-400">{job.book.era} · {job.book.year} · {job.book.genres.join(', ') || 'Sin géneros'}</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(job.characters || []).map(c => (
            <div key={c.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2.5">
                <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-amber-500/30" />
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-slate-100 truncate">{c.name}</h4>
                  <span className="text-[10px] text-amber-400 capitalize">{c.role}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{c.description}</p>
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-850 flex justify-between gap-2">
                <span className="truncate">{c.personality}</span>
                <span className="font-mono shrink-0 flex items-center gap-1"><Mic className="w-3 h-3" />{c.voice_name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'visuals') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(['economic', 'premium'] as const).map(m => (
            <button
              key={m}
              onClick={() => setVisualMode(m)}
              className={`p-4 rounded-2xl border text-left transition-all ${job.visual_mode === m ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-950 border-slate-800'}`}
            >
              <strong className="text-sm block text-slate-100">{m === 'economic' ? 'Modo Económico' : 'Modo Premium (Veo)'}</strong>
              <p className="text-xs text-slate-400 mt-1">
                {m === 'economic'
                  ? 'Imágenes generadas con IA + movimiento Ken Burns + subtítulos sincronizados.'
                  : 'Vídeo por escena con Veo. Aún no disponible: se usará el modo económico.'}
              </p>
            </button>
          ))}
        </div>
        <ScriptPreview job={job} />
      </div>
    );
  }

  if (step === 'review' || step === 'published') {
    const firsts = (job.adaptations || []).map(a => ({ a, ep: job.episodes?.[a.id]?.[0] })).filter(x => x.ep?.video_url);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {firsts.map(({ a, ep }) => (
            <div key={a.id} className="space-y-1">
              <video
                controls
                preload="metadata"
                poster={ep!.thumbnail_url}
                src={ep!.video_url}
                className={`w-full rounded-xl bg-black border border-slate-800 ${a.aspect_ratio === '16:9' ? 'aspect-video' : 'aspect-[9/16] max-h-80'}`}
              />
              <p className="text-[11px] text-slate-400">{a.format === 'drama' ? 'Microdrama' : a.format === 'film' ? 'Cortometraje' : 'Resumen'} · Ep. 1 · {formatMinutes(ep!.duration)} min</p>
            </div>
          ))}
        </div>
        <ScriptPreview job={job} />
      </div>
    );
  }

  // voices, render
  return <ScriptPreview job={job} />;
};

export const AdminPipelineScreen: React.FC = () => {
  const navigate = useNavigate();
  const { job, jobs, simulated, busy, error, init, selectJob, runCurrentStep, publish, newJob } = usePipelineStore();
  const [publishFeedback, setPublishFeedback] = useState<{ message: string; bookId?: string } | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const current = job ? stepIndex(job.current_step) : 0;
  const running = job?.status === 'running';
  const activeStep = STEPS[Math.min(current, STEPS.length - 1)];

  const handlePublish = async () => {
    const res = await publish();
    if (res.ok) setPublishFeedback({ message: res.message, bookId: res.bookId });
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <TopNavBar />

      <div className="px-4 space-y-6 pt-3 max-w-4xl mx-auto">
        {/* Banner Header */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/30 shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Wand2 className="w-4 h-4" />
            <span>Estudio de Producción Automatizada</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-black text-slate-100">
            Pipeline de IA para Clásicos en Dominio Público
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Convierte una obra en microdramas verticales (9:16), un cortometraje y un video-resumen con voces, imágenes, subtítulos y HLS.
          </p>
        </div>

        {simulated && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Modo simulado: el servidor no tiene <code>GEMINI_API_KEY</code>. Los guiones se construyen con frases del propio texto, sin voces ni imágenes; el render genera vídeos reales con subtítulos sobre fondo liso.</span>
          </div>
        )}

        {/* Job picker */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={job?.id || ''}
            onChange={e => (e.target.value ? selectJob(e.target.value) : newJob())}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
            aria-label="Trabajo del pipeline"
          >
            <option value="">— Nuevo trabajo —</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.book_title} · {j.current_step} · {j.progress}%</option>
            ))}
          </select>
          <button
            onClick={newJob}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Nuevo</span>
          </button>
        </div>

        {/* Step progress */}
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-[700px]">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isPast = current > idx;
              const isCurrent = current === idx;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : isPast
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-950 text-slate-500 border border-slate-850'
                  }`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{idx + 1}. {s.title}</span>
                  </div>
                  {idx < STEPS.length - 1 && <div className={`h-0.5 w-3 rounded-full ${isPast ? 'bg-emerald-500' : 'bg-slate-800'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Workspace */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                {job ? (job.current_step === 'published' ? 'Publicado' : `Paso ${current + 1} de ${STEPS.length}`) : 'Nuevo trabajo'}
                {job && ` · ${job.book_title}`}
              </span>
              <h2 className="font-display text-lg font-bold text-slate-100">{job ? activeStep.title : 'Elige la obra'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{job ? activeStep.desc : STEPS[0].desc}</p>
            </div>

            {job && job.current_step !== 'published' && (
              <div className="shrink-0">
                {job.current_step === 'review' ? (
                  <button
                    disabled={busy}
                    onClick={handlePublish}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Aprobar y publicar en el catálogo</span>
                  </button>
                ) : (
                  <button
                    disabled={busy || running}
                    onClick={runCurrentStep}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {running ? (
                      <span className="flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5 animate-spin" /> Procesando…</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        {job.status === 'failed' ? `Reintentar: ${activeStep.title}` : `Ejecutar: ${activeStep.title}`}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {job && (
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full transition-all ${job.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${job.progress}%` }} />
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {job?.status === 'failed' && (
            <p className="text-xs text-rose-300">El paso falló. Revisa el registro y vuelve a intentarlo.</p>
          )}

          {publishFeedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{publishFeedback.message}</span>
              {publishFeedback.bookId && (
                <button onClick={() => navigate(`/book/${publishFeedback.bookId}`)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 flex items-center gap-1 shrink-0">
                  <BookOpen className="w-3.5 h-3.5" /> Ver ficha
                </button>
              )}
            </div>
          )}

          {job ? <StepBody job={job} /> : <NewJobForm />}

          {/* Logs */}
          {job && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">Registro de ejecución del pipeline</span>
              </div>
              <div className="p-3 rounded-2xl bg-black/90 border border-slate-850 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto no-scrollbar">
                {job.logs.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600 shrink-0">[{formatTime(l.timestamp)}]</span>
                    <span className={
                      l.type === 'success' ? 'text-emerald-400' :
                      l.type === 'warn' ? 'text-amber-400' :
                      l.type === 'error' ? 'text-rose-400' : 'text-slate-300'
                    }>
                      {l.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

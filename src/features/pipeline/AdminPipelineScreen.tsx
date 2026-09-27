import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePipelineStore } from '../../stores/usePipelineStore';
import { TopNavBar } from '../navigation/TopNavBar';
import { 
  Wand2, Play, CheckCircle2, RotateCcw, AlertTriangle, 
  FileText, Users, Clapperboard, Mic, Image, Video, CheckSquare,
  Sparkles, Layers, ChevronRight, Terminal, ArrowRight, ShieldCheck
} from 'lucide-react';

export const AdminPipelineScreen: React.FC = () => {
  const navigate = useNavigate();
  const { 
    currentJob, 
    activeStepIndex, 
    isProcessing, 
    runStep, 
    setBookInput, 
    resetJob,
    publishBookToCatalog,
    updateJobData
  } = usePipelineStore();

  const [inputTitle, setInputTitle] = useState(currentJob.book_title);
  const [inputAuthor, setInputAuthor] = useState(currentJob.author);
  const [inputText, setInputText] = useState(currentJob.raw_text || '');
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  const steps = [
    { id: 'ingest', title: '1. Ingesta & Limpieza', desc: 'Importar texto (Gutenberg/Wikisource) y segmentar en actos', icon: FileText },
    { id: 'analyze', title: '2. Análisis LLM', desc: 'Extraer personajes, personalidad, edad y arco dramático', icon: Users },
    { id: 'adapt', title: '3. Adaptación Guiones', desc: 'Microdramas con cliffhanger, corto 16:9 y video resumen', icon: Clapperboard },
    { id: 'voices', title: '4. Voces TTS & Emoción', desc: 'Asignar voces actorales por personaje y generar audio línea por línea', icon: Mic },
    { id: 'visuals', title: '5. Visuales Cinemáticos', desc: 'Modo Económico (Ken Burns) o Premium (Veo text-to-video)', icon: Image },
    { id: 'render', title: '6. Render & HLS', desc: 'Composición FFmpeg 9:16 / 16:9, subtítulos quemados y HLS', icon: Video },
    { id: 'review', title: '7. Revisión Humana', desc: 'Control de calidad editorial antes de publicar en catálogo', icon: CheckSquare },
  ];

  const handleStartIngest = () => {
    setBookInput(inputTitle, inputAuthor, 'custom_text', inputText);
    runStep('ingest');
  };

  const handleNextStep = () => {
    const nextStepId = steps[activeStepIndex]?.id as any;
    if (nextStepId) {
      runStep(nextStepId);
    }
  };

  const handlePublish = () => {
    const res = publishBookToCatalog();
    setPublishFeedback(res.message);
    setTimeout(() => {
      setPublishFeedback(null);
      navigate('/');
    }, 2500);
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
            Convierte cualquier obra maestra literaria en microdramas verticales (9:16), cortometrajes y video-resúmenes con diálogos actorales, síntesis de voz y transcodificación HLS.
          </p>
        </div>

        {/* 7-Step Horizontal Progress Stepper */}
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-[700px]">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isPast = activeStepIndex > idx;
              const isCurrent = activeStepIndex === idx;

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
                    <span>{idx + 1}. {s.title.split('. ')[1]}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`h-0.5 w-3 rounded-full ${isPast ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Active Step Interactive Workspace */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                Paso Activo {activeStepIndex + 1} de 7
              </span>
              <h2 className="font-display text-lg font-bold text-slate-100">
                {steps[activeStepIndex]?.title}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {steps[activeStepIndex]?.desc}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={resetJob}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reiniciar</span>
              </button>

              {activeStepIndex < 6 ? (
                <button
                  disabled={isProcessing}
                  onClick={activeStepIndex === 0 ? handleStartIngest : handleNextStep}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 animate-spin" /> Procesando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 fill-slate-950" /> 
                      {activeStepIndex === 0 ? 'Iniciar Ingesta' : 'Ejecutar Siguiente Paso'}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  disabled={isProcessing}
                  onClick={handlePublish}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Aprobar y Publicar en Catálogo</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback banner */}
          {publishFeedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{publishFeedback}</span>
            </div>
          )}

          {/* Workspace Body Per Step */}
          {activeStepIndex === 0 && (
            /* STEP 1: Ingest */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Título de la Obra</label>
                  <input
                    type="text"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Autor / Dramaturgo</label>
                  <input
                    type="text"
                    value={inputAuthor}
                    onChange={(e) => setInputAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300">Texto Fuente o Enlace Gutenberg</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInputTitle('La vida es sueño');
                        setInputAuthor('Pedro Calderón de la Barca');
                        setInputText(`JORNADA PRIMERA.
(En lo alto de un monte, Rosaura en traje de hombre, desciende por las peñas.)
ROSAURA: Hipogrifo violento que corriste parejas con el viento...
SEGISMUNDO: ¡Ay mísero de mí, y ay infelice!
Apurar, cielos, pretendo ya que me tratáis así, qué delito cometí contra vosotros naciendo.`);
                      }}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Cargar "La vida es sueño"
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setInputTitle('Fuenteovejuna');
                        setInputAuthor('Lope de Vega');
                        setInputText(`ACTO PRIMERO.
FERNÁN GÓMEZ: ¿Sabe el Maestre que estoy en la villa?
FLORES: Ya lo sabe.
LAURENCIA: ¡Nunca yo más le viera, ni a él ni a sus vanas razones de amor!
PASCUALA: Pues déjale, Laurencia, que es comendador.`);
                      }}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Cargar "Fuenteovejuna"
                    </button>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:border-amber-400 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeStepIndex === 1 && (
            /* STEP 2: Character Analysis */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold">Personajes Identificados por el Modelo de IA</span>
                <span className="text-amber-400 font-mono font-semibold">{currentJob.characters?.length || 3} personajes</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(currentJob.characters || []).map((c) => (
                  <div key={c.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <img src={c.avatar_url} alt={c.name} className="w-10 h-10 rounded-xl object-cover border border-amber-500/30" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-100 truncate">{c.name}</h4>
                        <span className="text-[10px] text-amber-400 capitalize">{c.role}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {c.description}
                    </p>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-850 flex justify-between">
                      <span>Personalidad: {c.personality}</span>
                      <span className="font-mono">{c.age_range}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeStepIndex === 2 && (
            /* STEP 3: Script Adaptation */
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400">Guión Generado para Microdrama 9:16 (Episodio 1)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold">Cliffhanger Activo</span>
                </div>
                <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-850">
                  <p className="text-slate-500 italic">[Escena 1: Cocina andaluza al atardecer. Polvo y calor asfixiante.]</p>
                  <p><strong className="text-amber-300">MADRE (Doliente):</strong> ¿Llevas la navaja encima? ¡Dímelo!</p>
                  <p><strong className="text-cyan-300">NOVIO (Tenso):</strong> Para las uvas, madre. Solo para cortar racimos.</p>
                  <p><strong className="text-amber-300">MADRE (Furiosa):</strong> ¡La navaja, la navaja! Cien años que yo viviera no hablaría de otra cosa. Primero tu padre, que me olía a clavel y me lo mataron; luego tu hermano... Y ahora tú.</p>
                  <p className="text-rose-400 font-bold pt-1">[CLIFFHANGER: Se escucha un relincho bronco fuera: es Leonardo Félix rondando en su caballo negro.]</p>
                </div>
              </div>
            </div>
          )}

          {activeStepIndex === 3 && (
            /* STEP 4: Voices */
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">Asignación de Voces TTS y Perfiles Emocionales</span>
              <div className="space-y-2">
                {[
                  { char: 'La Madre', voice: 'Charon (Grave / Teatral)', style: 'Dolor y presagio trágico', sample: 'Pista de audio 24kHz lista' },
                  { char: 'Leonardo Félix', voice: 'Fenrir (Barítono rasgado)', style: 'Pasión indómita y desafío', sample: 'Pista de audio 24kHz lista' },
                  { char: 'La Novia', voice: 'Kore (Lírica rota)', style: 'Duda desgarradora y fuego interior', sample: 'Pista de audio 24kHz lista' },
                ].map((v, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <Mic className="w-4 h-4 text-amber-400" />
                      <div>
                        <strong className="text-slate-200">{v.char}</strong>
                        <span className="text-slate-400 ml-2 font-mono text-[11px]">→ {v.voice}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded">
                      {v.sample}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeStepIndex === 4 && (
            /* STEP 5: Visuals mode */
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-300 block">Modo de Generación Visual</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateJobData({ visual_mode: 'economic' })}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    currentJob.visual_mode === 'economic'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <strong className="text-sm block text-slate-100">Modo Económico</strong>
                  <p className="text-xs text-slate-400 mt-1">
                    Imágenes generadas con IA + movimiento Ken Burns dinámico + subtítulos sincronizados. Ideal para producción masiva y bajo coste.
                  </p>
                </button>

                <button
                  onClick={() => updateJobData({ visual_mode: 'premium' })}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    currentJob.visual_mode === 'premium'
                      ? 'bg-purple-500/10 border-purple-500 text-purple-300'
                      : 'bg-slate-950 border-slate-850 text-slate-400'
                  }`}
                >
                  <strong className="text-sm block text-slate-100">Modo Premium (Veo Video)</strong>
                  <p className="text-xs text-slate-400 mt-1">
                    Text-to-video por escena cinemática con coherencia de personaje y tomas en movimiento continuo 9:16 y 16:9.
                  </p>
                </button>
              </div>
            </div>
          )}

          {activeStepIndex === 5 && (
            /* STEP 6: Render & HLS */
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">Especificaciones de Salida FFmpeg & HLS</span>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span>Resoluciones Master:</span>
                  <span className="text-amber-400">360p, 720p, 1080p (VIP)</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span>Relación de aspecto:</span>
                  <span className="text-amber-400">9:16 (Microdrama) / 16:9 (Cortometraje)</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span>Subtítulos Quemados:</span>
                  <span className="text-emerald-400">Sí (Nombre de personaje + Color de emoción)</span>
                </div>
                <div className="flex justify-between">
                  <span>Formato de Transmisión:</span>
                  <span className="text-purple-400">HLS Adaptive Bitrate (.m3u8)</span>
                </div>
              </div>
            </div>
          )}

          {activeStepIndex === 6 && (
            /* STEP 7: Human Review */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Control de Calidad Humana Aprobado
                </span>
                <p className="text-xs text-slate-300">
                  Los 16 episodios del microdrama, el cortometraje 16:9 y el resumen guiado han sido ensamblados con éxito. Pulsa el botón "Aprobar y Publicar en Catálogo" para hacer la obra visible inmediatamente para todos los usuarios.
                </p>
              </div>
            </div>
          )}

          {/* Real-Time Pipeline Terminal Logs */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">Registro de ejecución del Pipeline</span>
            </div>
            <div className="p-3 rounded-2xl bg-black/90 border border-slate-850 font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto no-scrollbar">
              {currentJob.logs.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-600 shrink-0">[{l.timestamp}]</span>
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
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Users, Clapperboard, Image as ImageIcon } from 'lucide-react';

const api=async(path:string, options:RequestInit={})=>{
 const token=localStorage.getItem('access_token');
 const res=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.error||'Error de servidor');
 return data;
};

export const CreatorEpisodeScreen:React.FC=()=>{
 const {projectId,episodeId}=useParams();
 const [episode,setEpisode]=useState<any>(null),[script,setScript]=useState(''),[sceneTitle,setSceneTitle]=useState(''),[sceneScript,setSceneScript]=useState(''),[characterName,setCharacterName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [scenes,setScenes]=useState<any[]>([]),[characters,setCharacters]=useState<any[]>([]);
 const load=async()=>{try{const [e,c,ch]=await Promise.all([api(`/api/creator/episodes/${episodeId}`),api(`/api/creator/episodes/${episodeId}/scenes`),api(`/api/creator/projects/${projectId}/characters`)]);setEpisode(e.episode);setScript(e.episode.script?.text||'');setScenes(c.scenes||[]);setCharacters(ch.characters||[])}catch(e){setError(e instanceof Error?e.message:'Error')}};
 useEffect(()=>{load()},[episodeId,projectId]);
 const save=async()=>{setBusy(true);try{await api(`/api/creator/episodes/${episodeId}`,{method:'PATCH',body:JSON.stringify({script:{text:script}})});setBusy(false)}catch(e){setError(e instanceof Error?e.message:'Error');setBusy(false)}};
 const addScene=async(e:React.FormEvent)=>{e.preventDefault();if(!sceneTitle)return;setBusy(true);try{await api(`/api/creator/episodes/${episodeId}/scenes`,{method:'POST',body:JSON.stringify({title:sceneTitle,script:sceneScript})});setSceneTitle('');setSceneScript('');await load()}catch(e){setError(e instanceof Error?e.message:'Error')}finally{setBusy(false)}};
 const addCharacter=async(e:React.FormEvent)=>{e.preventDefault();if(!characterName)return;setBusy(true);try{await api(`/api/creator/projects/${projectId}/characters`,{method:'POST',body:JSON.stringify({name:characterName})});setCharacterName('');await load()}catch(e){setError(e instanceof Error?e.message:'Error')}finally{setBusy(false)}};
 return <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-24"><div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
  <Link to={`/studio/project/${projectId}`} className="inline-flex items-center gap-2 text-xs text-slate-400"><ArrowLeft className="w-4 h-4"/>Proyecto</Link>
  {error&&<div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300">{error}</div>}
  {episode&&<><div><p className="text-amber-400 text-xs font-bold uppercase">Episodio</p><h1 className="text-3xl font-black">{episode.title}</h1></div>
  <section className="grid lg:grid-cols-2 gap-5">
   <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3"><div className="flex items-center justify-between"><h2 className="font-bold flex gap-2 items-center"><Save className="w-4 h-4"/>Guion</h2><button onClick={save} disabled={busy} className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm">Guardar</button></div><textarea value={script} onChange={e=>setScript(e.target.value)} rows={14} placeholder="Escribe el guion del episodio..." className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 outline-none"/></div>
   <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4"><h2 className="font-bold flex gap-2 items-center"><Clapperboard className="w-4 h-4"/>Escenas</h2><form onSubmit={addScene} className="space-y-2"><input value={sceneTitle} onChange={e=>setSceneTitle(e.target.value)} placeholder="Título de escena" className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800"/><textarea value={sceneScript} onChange={e=>setSceneScript(e.target.value)} placeholder="Texto / acción de la escena" rows={4} className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800"/><button disabled={busy} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-950 font-bold flex gap-2 items-center"><Plus className="w-4 h-4"/>Añadir escena</button></form><div className="space-y-2">{scenes.map((s,i)=><div key={s.id} className="p-3 rounded-xl bg-slate-950"><b>{i+1}. {s.title}</b><p className="text-xs text-slate-400 mt-1">{s.script?.text||''}</p></div>)}</div></div>
  </section>
  <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4"><h2 className="font-bold flex gap-2 items-center"><Users className="w-4 h-4"/>Personajes</h2><form onSubmit={addCharacter} className="flex gap-2"><input value={characterName} onChange={e=>setCharacterName(e.target.value)} placeholder="Nombre del personaje" className="flex-1 p-3 rounded-xl bg-slate-950 border border-slate-800"/><button disabled={busy} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold"><Plus className="w-4 h-4"/></button></form><div className="grid sm:grid-cols-3 gap-3">{characters.map(c=><div key={c.id} className="p-4 rounded-xl bg-slate-950"><b>{c.name}</b><p className="text-xs text-slate-400 mt-1">{c.description||'Sin descripción'}</p></div>)}</div></section>
  <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800"><h2 className="font-bold flex gap-2 items-center"><ImageIcon className="w-4 h-4"/>Biblioteca multimedia</h2><p className="text-sm text-slate-400 mt-2">Imágenes, audio, vídeo, subtítulos y miniaturas se registrarán aquí. La subida física al almacenamiento privado llegará con la capa de storage.</p></section>
  </>}
 </div></div>;
};
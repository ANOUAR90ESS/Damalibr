import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Film, ArrowRight } from 'lucide-react';

type Project={id:string;title:string;type:string;status:string;description?:string};
const api=async(path:string, options:RequestInit={})=>{
 const token=localStorage.getItem('access_token');
 const res=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.error||'Error de servidor');
 return data;
};

export const CreatorStudioScreen:React.FC=()=>{
 const [projects,setProjects]=useState<Project[]>([]);
 const [title,setTitle]=useState('');
 const [type,setType]=useState('story');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const load=()=>api('/api/creator/projects').then(d=>setProjects(d.projects||[])).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault(); setBusy(true); setError('');
  try{await api('/api/creator/projects',{method:'POST',body:JSON.stringify({title,type,language:'es'})});setTitle('');load()}
  catch(e){setError(e instanceof Error?e.message:'Error')}
  finally{setBusy(false)}
 };
 return <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-24">
  <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
   <div><p className="text-amber-400 text-xs font-bold uppercase tracking-wider">Creator Studio</p><h1 className="text-2xl font-black mt-1">Mis proyectos</h1><p className="text-sm text-slate-400 mt-1">Crea contenido manualmente primero; la IA se añadirá después como acelerador.</p></div>
   <form onSubmit={create} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row gap-3">
    <input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={200} placeholder="Nombre del proyecto" className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 outline-none focus:border-amber-500"/>
    <select value={type} onChange={e=>setType(e.target.value)} className="px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800">
      <option value="story">Historia</option><option value="book">Libro</option><option value="series">Serie</option><option value="short_film">Cortometraje</option><option value="microdrama">Microdrama</option><option value="audiobook">Audiolibro</option>
    </select>
    <button disabled={busy} className="px-5 py-3 rounded-2xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center gap-2"><Plus className="w-4 h-4"/>{busy?'Creando…':'Nuevo proyecto'}</button>
   </form>
   {error&&<div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
   <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {projects.map(p=><Link key={p.id} to={`/studio/project/${p.id}`} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition">
      <BookOpen className="w-5 h-5 text-amber-400"/><h2 className="font-bold mt-4">{p.title}</h2><p className="text-xs text-slate-500 mt-1 capitalize">{p.type} · {p.status}</p><p className="text-xs text-slate-400 mt-3 line-clamp-2">{p.description||'Sin descripción'}</p><ArrowRight className="w-4 h-4 text-slate-600 mt-4"/>
    </Link>)}
   </div>
   {!projects.length&&!error&&<div className="text-center py-16 text-slate-500"><Film className="w-8 h-8 mx-auto mb-3"/><p>Aún no tienes proyectos.</p></div>}
  </div>
 </div>
};

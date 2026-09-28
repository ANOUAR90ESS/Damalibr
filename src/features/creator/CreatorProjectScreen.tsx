import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, FileText } from 'lucide-react';

const api=async(path:string, options:RequestInit={})=>{
 const token=localStorage.getItem('access_token');
 const res=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.error||'Error de servidor');
 return data;
};

export const CreatorProjectScreen:React.FC=()=>{
 const {projectId}=useParams();
 const [project,setProject]=useState<any>(null);
 const [episodeTitle,setEpisodeTitle]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const load=()=>api(`/api/creator/projects/${projectId}`).then(d=>setProject(d.project)).catch(e=>setError(e.message));
 useEffect(()=>{load()},[projectId]);
 const create=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await api(`/api/creator/projects/${projectId}/episodes`,{method:'POST',body:JSON.stringify({title:episodeTitle})});setEpisodeTitle('');load()}catch(e){setError(e instanceof Error?e.message:'Error')}finally{setBusy(false)}};
 return <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-24"><div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
  <Link to="/studio" className="inline-flex items-center gap-2 text-xs text-slate-400"><ArrowLeft className="w-4 h-4"/>Mis proyectos</Link>
  {error&&<div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300">{error}</div>}
  {project&&<><div><p className="text-amber-400 text-xs font-bold uppercase">{project.type}</p><h1 className="text-3xl font-black mt-1">{project.title}</h1><p className="text-sm text-slate-400 mt-2">{project.description||'Sin descripción'}</p></div>
  <form onSubmit={create} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex gap-3"><input value={episodeTitle} onChange={e=>setEpisodeTitle(e.target.value)} required placeholder="Título del episodio" className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800"/><button disabled={busy} className="px-5 py-3 rounded-2xl bg-amber-500 text-slate-950 font-bold flex items-center gap-2"><Plus className="w-4 h-4"/>Nuevo episodio</button></form>
  <div className="grid sm:grid-cols-2 gap-4">{(project.creator_episodes||[]).map((e:any)=><Link to={`/studio/project/${projectId}/episode/${e.id}`} key={e.id} className="block p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-500/50"><FileText className="w-5 h-5 text-amber-400"/><h2 className="font-bold mt-3">{e.title}</h2><p className="text-xs text-slate-500 mt-1">{e.status}</p></Link>)}</div></>}
 </div></div>

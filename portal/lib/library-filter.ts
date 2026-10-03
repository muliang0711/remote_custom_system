import type {Doc,LibraryFolder} from './demo-store';
export function filterLibrary(documents:Doc[],folderId:string,query='',type='all'){
 return documents.filter(d=>(folderId==='all'||d.parentIds?.includes(folderId))&&(type==='all'||d.type===type||(type==='DOC'&&d.type==='DOCX'))&&d.name.toLowerCase().includes(query.toLowerCase()));
}
export function folderChoices(folders:LibraryFolder[]){
 const lookup=new Map(folders.map(f=>[f.id,f]));
 const choices=folders.map(folder=>{const names=[folder.name],visited=new Set([folder.id]);let parent=folder.parentIds?.[0];while(parent&&!visited.has(parent)&&names.length<30){visited.add(parent);const f=lookup.get(parent);if(!f)break;names.unshift(f.name);parent=f.parentIds?.[0]}return {id:folder.id,label:names.join(' / ')};});
 const counts=new Map<string,number>();for(const c of choices)counts.set(c.label,(counts.get(c.label)||0)+1);
 return choices.map(c=>({...c,label:counts.get(c.label)!>1?`${c.label} (${c.id.slice(-8)})`:c.label})).sort((a,b)=>a.label.localeCompare(b.label));
}

import {Children,Fragment,useSyncExternalStore} from 'react';
import './styles/ResponsiveTable.css';

const query='(max-width: 767px)';
const snapshot=()=>typeof window!=='undefined' && window.matchMedia(query).matches;
const subscribe=fn=>{
 const media=window.matchMedia(query);
 media.addEventListener('change',fn);
 return ()=>media.removeEventListener('change',fn);
};
function flatten(nodes,prefix=''){
 return Children.toArray(nodes).flatMap((node,index)=>{
  const key=prefix+'/'+(node.key??index);
  return node.type===Fragment?flatten(node.props.children,key):[{node,key}];
 });
}
const parts=node=>Children.toArray(node?.props.children);
const label=cell=>cell?.props['data-mobile-label']??cell?.props.children;

export default function ResponsiveTable({children,primary=[0,1],selection,headerActions=false,...props}){
 const mobile=useSyncExternalStore(subscribe,snapshot,()=>false);
 if(!mobile)return <table {...props}>{children}</table>;
 const sections=parts({props:{children}});
 const headers=parts(parts(sections.find(n=>n.type==='thead'))[0]);
 const rows=flatten(sections.find(n=>n.type==='tbody')?.props.children);
 return <div className="responsive-table">
  {headerActions&&<details className="responsive-table-row"><summary>Categorías de tonelaje</summary><div className="responsive-table-fields">{headers.filter(h=>h.props['data-mobile-label']).map(h=><div key={h.key}>{h.props.children}</div>)}</div></details>}
  {rows.map(({node,key})=>{
   const cells=parts(node);
   if(cells.length===1&&cells[0].props.colSpan)return <p className="responsive-table-group" key={key}>{cells[0].props.children}</p>;
   const summary=primary.filter(i=>i<cells.length&&i!==selection);
   const remainder=cells.map((_,i)=>i).filter(i=>i!==selection&&!summary.includes(i));
   return <article key={key} className="responsive-table-row">
    <div className="responsive-table-overview">
     {selection!=null&&cells[selection]&&<div className="responsive-table-check">{cells[selection].props.children}</div>}
     <div className="responsive-table-primary">{summary.map((i,k)=><div key={i} className={k===0?'responsive-table-title':undefined}>{cells[i].props.children}</div>)}</div>
    </div>
    {remainder.length>0&&<details><summary>Más detalles</summary><dl className="responsive-table-fields">{remainder.map(i=><div key={i}><dt>{label(headers[i])}</dt><dd>{cells[i].props.children}</dd></div>)}</dl></details>}
   </article>;
  })}
 </div>;
}

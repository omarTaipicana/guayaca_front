import {cached,pendingOperations} from './queue.js';
export const distance=(a,b)=>{const rad=x=>x*Math.PI/180,dy=rad(Number(b.latitude)-Number(a.latitude)),dx=rad(Number(b.longitude)-Number(a.longitude)),h=Math.sin(dy/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dx/2)**2;return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))};
export function projectOperations(server,places,operations){
 const data=JSON.parse(JSON.stringify(server||{stops:[],samples:[]}));if(!data.stops?.length)data.stops=places.map((place,position)=>({id:'local-'+position,position,place,candidate_count:0,exception_resolved:true}));
 let last=+new Date(data.last_observed_at||data.samples?.at(-1)?.device_at||0);const transitions=[];
 const done=s=>(s.arrival_file_id||s.document_waived)&&s.arrival_odometer!=null;
 const document=(s,op)=>{s.arrival_file_id='pending-'+op.id;s.arrival_file_ids=(op.files||[op.file].filter(Boolean)).map((_,i)=>'pending-'+op.id+'-'+i);s.arrival_odometer=op.body.odometer;s.local_pending=true;if(s.position>0&&!['partial','rejected','failed'].includes(s.outcome)){s.received_at=op.captured_at;if(s.outside_at){s.departed_at=s.outside_at;s.exit_state='delivered'}}};
 const exit=(s,op)=>{s.exit_state=op.body.choice;s.exit_reason=op.body.reason;s.local_pending=true;if(['delivered','incident'].includes(op.body.choice)){s.departed_at=s.outside_at;if(op.body.choice==='delivered')s.received_at=s.outside_at}};
 for(const op of operations){
  if(op.kind==='point'){const s=data.stops[op.position];if(s){if(s.arrived_at)document(s,op);else s.waitingDocument=op;}continue;}
  if(op.kind==='exit'){if(['conflict','auth'].includes(op.state))continue;const s=data.stops[op.position];if(s){if(s.outside_at)exit(s,op);else s.waitingExit=op;}continue;}
  if(op.kind==='outcome'){const s=data.stops[Number(op.body.position)];if(s){s.outcome=op.body.outcome;s.exception_resolved=false;s.outcome_note=op.body.reason;s.delivered_tons=op.body.delivered_tons;s.received_at=null;s.local_pending=true;}continue;}
  if(op.kind!=='gps')continue;const at=+new Date(op.body.timestamp);if(at<=last)continue;const s=data.stops.find(s=>!s.departed_at);if(!s)break;
  const accuracy=Number(op.body.accuracy),radius=Number(s.place.radius_m||150),limit=Math.max(25,Math.min(100,radius/2));if(accuracy>limit)continue;
  data.samples??=[];if(op.body.route_point!==false)data.samples.push({latitude:op.body.latitude,longitude:op.body.longitude,accuracy,device_at:op.body.timestamp,local_pending:true});
  if(last&&at-last>90000){s.candidate_type=null;s.candidate_at=null;s.candidate_count=0;}last=at;data.last_observed_at=op.body.timestamp;
  const d=distance(op.body,s.place),inside=d<=radius,outside=d>=radius+Math.max(50,accuracy),kind=!s.arrived_at?(inside?'arrival':null):s.outside_at?(inside?'return':null):(outside?'departure':null);
  if(!kind){s.candidate_type=null;s.candidate_at=null;s.candidate_count=0;continue;}
  if(s.candidate_type!==kind||!s.candidate_at){s.candidate_type=kind;s.candidate_at=new Date(at).toISOString();s.candidate_count=1;continue;}
  s.candidate_count=(s.candidate_count||0)+1;if(at-new Date(s.candidate_at)<20000||s.candidate_count<2)continue;
  const detected=s.candidate_at;s.candidate_type=null;s.candidate_at=null;s.candidate_count=0;s.local_pending=true;
  if(kind==='arrival'){s.arrived_at=detected;if(s.waitingDocument){document(s,s.waitingDocument);delete s.waitingDocument;}}
  if(kind==='departure'){s.outside_at=detected;if(s.position===0||done(s)&&s.exception_resolved!==false)s.departed_at=detected;else{s.exit_state='pending';if(s.waitingExit){exit(s,s.waitingExit);delete s.waitingExit;}}}
  if(kind==='return'){s.outside_at=null;s.exit_state=null;}
  transitions.push({phase:kind,position:s.position,name:s.place.name,at:detected});
 }
 data.local_projection=operations.length>0;data.local_transitions=transitions;data.route_complete=data.stops.length>0&&data.stops.every(s=>s.departed_at);return data;
}
export async function projectedTrip(tripId,server){const base=server||(await cached('/trips/'+tripId+'/gps-state'))?.data,detail=(await cached('/trips/'+tripId))?.data;if(!detail?.trip?.metadata?.origin_place)return base||null;const metadata=detail.trip.metadata,ops=(await pendingOperations()).filter(o=>String(o.trip_id)===String(tripId));return projectOperations(base,[metadata.origin_place,...metadata.destination_places],ops);}

const {AsyncLocalStorage}=require('node:async_hooks');
const {randomUUID}=require('node:crypto');
const storage=new AsyncLocalStorage();
function metadata(req){
 const trusted=process.env.VERCEL==='1';
 return {requestId:randomUUID(),ip:trusted?String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||req.socket?.remoteAddress||'unavailable').split(',')[0].trim():req.socket?.remoteAddress||'unavailable',agent:req.headers['user-agent']||'unavailable',location:trusted?[req.headers['x-vercel-ip-country'],req.headers['x-vercel-ip-country-region'],req.headers['x-vercel-ip-city']].filter(Boolean).join(', ')||'unavailable':'unavailable'};
}
function contextualFetch(url,options={}) {
 const store=storage.getStore();
 if(!store)return fetch(url,options);
 const user=store.req.user||store.actor||{role:'system',email:'System'};
 const headers=new Headers(options.headers||{});
 headers.set('x-clinic-audit-context',Buffer.from(JSON.stringify({...store.meta,id:user.id||user.email,email:user.email,role:user.role})).toString('base64'));
 return fetch(url,{...options,headers});
}
const columns=['created_at','actor_id','actor_email','actor_role','ip_address','user_agent','action','module','resource','before_state','after_state','outcome','error_reason','security_event','location','request_id','details'];
function eventAction(req) {
 const path=req.auditPath||req.route?.path||req.path, body=req.body||{}, user=req.user||{};
 const patient=body.patient?.name||body.appointment?.patientName||body.note?.patientName||'patient not recorded';
 const appointment=body.appointment||{};
 const actions={
 '/login':'Signed In', '/register':`Created account: ${body.name||'name not recorded'}`,
 '/verify-email':'Verified email address', '/verify-otp':'Verified email address',
 '/forgot-password':'Requested password reset', '/reset-password':'Changed password',
 '/api/account':body.newPassword?'Changed password':`Updated own profile: ${['name','mobile','profileTitle'].filter(k=>k in body).join(', ')||'profile details'}`,
 '/api/account/verification-code':'Requested password-change verification code',
 '/api/account/verify-password':'Verified current password',
 '/api/appointments/book':`Booked appointment: ${appointment.service||'service not recorded'} — ${appointment.date||''} ${appointment.time||''}`,
 '/api/clinical-notes':`Recorded treatment: ${patient} — ${body.note?.treatment||'procedure not recorded'}, Tooth #${body.note?.tooth||'not specified'}`,
 '/api/patients-with-appointment':`Created patient record: ${patient}`,
 '/api/walk-ins':`Added walk-in patient: ${patient}`,
 '/api/clinic-db':'Attempted clinic record update', '/api/patient-db':'Attempted own record update'
 };
 return actions[path]||`${req.method==='GET'?'Viewed':'Attempted'} ${path.replace(/^\/api\//,'').replace(/\//g,' ')}`;
}

function middleware(db,verify){return (req,res,next)=>{
 const actor=verify?.(String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||req.body?.sessionToken);
 req.auditPath=req.path;
 const store={req,actor,meta:metadata(req)};
 return storage.run(store,()=>{
  const original=res.json.bind(res);let sending=false;
  res.json=payload=>{
   if(sending)return original(payload);sending=true;
   (async()=>{
    const status=res.statusCode;
    const user=req.user||(req.path==='/login'&&status<400?payload?.user:actor)||{email:String(req.body?.email||'unidentified'),role:'system'};
    const failure=status>=400,login=req.path==='/login';
    if(db&&(failure||login)){
     const denied=status===401||status===403;
     const row={created_at:new Date().toISOString(),actor_id:user.id||user.email,actor_email:user.email||'unidentified',actor_role:user.role||'system',ip_address:store.meta.ip,user_agent:store.meta.agent,request_id:store.meta.requestId,location:store.meta.location,action:eventAction(req),module:login?'Users':req.path.includes('appointment')?'Appointments':req.path.includes('account')?'Users':'Settings',resource:String(req.params?.id||req.path),before_state:{},after_state:{},outcome:denied?'Denied':failure?'Failed':'Success',error_reason:failure?String(payload?.message||payload?.error||`HTTP ${status}`):null,security_event:denied,details:{description:failure?`${eventAction(req)}: ${payload?.message||`HTTP ${status}`}`:`Signed in account ${user.email}`}};
     const {error}=await db.from('clinic_audit_log').insert(row);if(error)throw error;
    }
    // Snapshot polling is transport, not a user opening each returned record.
    // Explicit view/export interactions are recorded through /api/audit-events.
    if(db&&!failure&&!res.locals?.auditChanged&&['PUT','PATCH','POST'].includes(req.method)&&['/api/clinic-db','/api/patient-db','/api/clinical-notes','/api/account'].includes(req.path)){
     const {data,error}=await db.from('clinic_audit_log').select('id').eq('request_id',store.meta.requestId).limit(1);if(error)throw error;
     if(!data?.length){res.status(304);return res.end();}
    }
    original(payload);
   })().catch(error=>{console.error('Audit persistence failed',error.code||error.message);res.status(503);original({message:'The operation could not be confirmed because the audit service is unavailable. Refresh before retrying.'});});
   return res;
  };
  next();
 });
};}
function filters(query,params){
 for(const [key,col,op] of [['from','created_at','gte'],['to','created_at','lt'],['user','actor_email','eq'],['role','actor_role','eq'],['action','action','eq'],['outcome','outcome','eq']]){
  if(!params[key])continue;let value=String(params[key]);if(key==='from'||key==='to'){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw Error('Invalid date range.');value=date.toISOString();}query=query[op](col,value);
 }return query;
}
function csvCell(value){let s=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function listHandler(db){return async(req,res)=>{
 if(req.user?.role!=='admin')return res.status(403).json({message:'Administrator access required.'});
 try{
  res.set('Cache-Control','private, no-store');
  if(req.query.export==='csv'){
   let offset=0,rows=[];for(;;){const result=await filters(db.from('clinic_audit_feed').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}),req.query).range(offset,offset+999);if(result.error)throw result.error;rows.push(...result.data);if(result.data.length<1000)break;offset+=1000;}
   res.set('Content-Type','text/csv; charset=utf-8');res.set('Content-Disposition','attachment; filename="user-audit-log.csv"');return res.send([columns.map(csvCell).join(','),...rows.map(row=>columns.map(k=>csvCell(row[k])).join(','))].join('\r\n'));
  }
  const offset=Math.max(0,parseInt(req.query.offset,10)||0);
  const {data,error}=await filters(db.from('clinic_audit_feed').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}),req.query).range(offset,offset+199);if(error)throw error;
  const alerts=await db.from('clinic_audit_alerts').select('*').order('created_at',{ascending:false}).limit(50);if(alerts.error)throw alerts.error;
  res.json({rows:data,hasMore:data.length===200,alerts:alerts.data});
 }catch(error){res.status(400).json({message:error.message||'Unable to load audit log.'});}
};}
module.exports={eventAction,middleware,listHandler,contextualFetch,metadata,csvCell,storage};

function validateRefunds(record, saved, role) {
 if (!record.refunds && !saved?.refunds) return;
 const previous = Array.isArray(saved?.refunds) ? saved.refunds : [];
 const incoming = Array.isArray(record.refunds) ? record.refunds : [];
 const fail = message => { const error = new Error(message); error.status=403; throw error; };
 const added = incoming.filter(r => !previous.some(p => String(p.id) === String(r.id)));
 for (const old of previous) {
   const match=incoming.find(r=>String(r.id)===String(old.id));
   if(match && JSON.stringify(match)!==JSON.stringify(old)) fail('Saved refunds cannot be modified.');
 }
 if(added.length) {
   if(role!=='staff') fail('Only staff can record refunds.');
   if(!/^(cancelled|canceled)$/i.test(saved?.status || '')) fail('Only cancelled appointments can be refunded.');
   let remaining=Number(saved.totalCollected ?? saved.paid ?? 0)-previous.reduce((s,r)=>s+Number(r.amount||0),0);
   const ids=new Set(previous.map(r=>String(r.id)));
   for(const refund of added) {
     const amount=Number(refund.amount);
     if(!refund.id || ids.has(String(refund.id)) || !Number.isFinite(amount) || amount<=0 || Math.abs(amount*100-Math.round(amount*100))>0.00001 || amount>remaining+.001) fail('Invalid or duplicate refund amount.');
     if(!['Cash','GCash'].includes(refund.method) || (saved.preferredRefundMethod && saved.preferredRefundMethod!==refund.method)) fail('Use the patient-selected refund method.');
     if(refund.method==='GCash' && (!String(refund.reference||'').trim() || typeof refund.proofImage!=='string' || refund.proofImage.length>600000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(refund.proofImage))) fail('GCash refunds require an image receipt and reference.');
     ids.add(String(refund.id));remaining-=amount;
   }
 }
 record.refunds=[...previous,...added];
}
module.exports={validateRefunds};

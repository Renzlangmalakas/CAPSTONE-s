const crypto = require('node:crypto');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
function invitationData(value) {
  try { return value?.startsWith('dentist-invite:') ? JSON.parse(value.slice(15)) : null; } catch { return null; }
}
function createDentistInvitations({read, savePending, complete, hashPassword, sendMail, from, setupUrl, now = Date.now}) {
  const emailOf = value => String(value || '').trim().toLowerCase();
  const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return {
    async invite(req,res) {
      if(req.user?.role !== 'admin') return res.status(403).json({message:'Administrator access is required.'});
      const role = req.body?.role || 'dentist';
      if (!['dentist', 'staff'].includes(role)) return res.status(400).json({message:'Choose Dentist or Staff.'});
      const email=emailOf(req.body?.email);
      if(!validEmail(email)) return res.status(400).json({message:'Enter the new account email address.'});
      try {
        const old=await read(email);
        if(old && (old.is_verified || !invitationData(old.verification_token) || old.role && old.role !== role)) return res.status(409).json({message:'This email already has an account or a registration in progress. Use a new account email.'});
        const token=crypto.randomBytes(32).toString('hex');
        const marker='dentist-invite:'+JSON.stringify({hash:digest(token),role,expires:now()+24*60*60*1000});
        const saved=await savePending({email,role,id:old?.id || crypto.randomUUID(),password:await hashPassword(crypto.randomBytes(32).toString('hex')),marker},old);
        if(!saved) return res.status(409).json({message:'This invitation changed. Please try again.'});
        const url=`${setupUrl}#email=${encodeURIComponent(email)}&token=${token}`;
        const delivery=await sendMail({from,to:email,subject:`You are invited to join G-M Dental as ${role}`,text:`You have been invited to create a ${role} account for G-M Dental.\n\nSet your name, password and contact details here:\n${url}\n\nThis link expires in 24 hours and can only be used once. If you did not expect this invitation, ignore this email.`});
        if(delivery?.rejected?.length || Array.isArray(delivery?.accepted) && !delivery.accepted.length) throw new Error('Delivery rejected');
        return res.json({message:`Invitation sent to ${email}. The recipient can enter their details and choose a password using the link.`,email});
      } catch { return res.status(503).json({message:'Could not send the invitation. Please try again. Resending replaces the previous setup link.'}); }
    },
    async accept(req,res) {
      const email=emailOf(req.body?.email), token=String(req.body?.token || '');
      const name=String(req.body?.name || '').trim(), mobile=String(req.body?.mobile || '').trim(), address=String(req.body?.address || '').trim();
      const password=req.body?.password;
      if(!validEmail(email) || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({message:'Invalid invitation link.'});
      if(!name || name.length>150 || typeof password!=='string' || password.length<8 || Buffer.byteLength(password)>72 || mobile && !/^\d{7,12}$/.test(mobile) || address.length>500) return res.status(400).json({message:'Enter your name, a password of at least 8 characters (maximum 72 bytes), and a valid contact number of 7 to 12 digits if provided.'});
      try {
        const old=await read(email), invite=invitationData(old?.verification_token);
        if(!old || old.is_verified || !invite || invite.expires<=now() || invite.hash!==digest(token)) return res.status(410).json({message:'This invitation has expired or has already been used. Ask the admin for a new invitation.'});
        const role = invite.role || 'dentist';
        if (!['dentist','staff'].includes(role) || old.role && old.role !== role) return res.status(410).json({message:'Invalid invitation role.'});
        const saved=await complete(old,{name,mobile,address,role,password:await hashPassword(password)});
        if(!saved) return res.status(410).json({message:'This invitation has already been used or replaced.'});
        return res.json({message:'Your account is ready. You can now sign in with your email and password.'});
      } catch { return res.status(503).json({message:'Could not finish account setup. Please try again.'}); }
    }
  };
}
module.exports={createDentistInvitations,invitationData};

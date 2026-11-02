function createDentistCredentialsHandler({ findUser, verifyPassword, sendMail, from, loginUrl }) {
  return async (req, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({message:'Administrator access is required.'});
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || !password || password.length > 256) {
      return res.status(400).json({message:'Enter the dentist’s account email and password.'});
    }
    try {
      const user = await findUser(email);
      if (!user || user.role !== 'dentist') return res.status(404).json({message:'Create the dentist account with this email before sending credentials.'});
      if (!await verifyPassword(password, user.password)) return res.status(400).json({message:'The entered password does not match this dentist account. Enter the correct password before sending.'});
      const delivery = await sendMail({ from, to:user.email,
        subject:'Your G-M Dental dentist login credentials',
        text:`Hello ${user.name || 'Doctor'},\n\nYour G-M Dental dentist account is ready.\n\nSign in: ${loginUrl}\nLogin email: ${user.email}\nPassword: ${password}\n\nPlease change your password in Account Settings after signing in. Keep these credentials private.\n\nG-M Dental Clinic` });
      if (delivery?.rejected?.length || Array.isArray(delivery?.accepted) && !delivery.accepted.length) {
        return res.status(502).json({message:'The email provider did not accept the message. The account is unchanged; you can retry sending.'});
      }
      return res.json({message:`Login credentials sent to ${user.email}.`,email:user.email});
    } catch {
      // Never log request bodies, plaintext credentials, or SMTP message data.
      return res.status(503).json({message:'Could not send credentials. The account is unchanged. Check the email service and try again.'});
    }
  };
}
module.exports = {createDentistCredentialsHandler};

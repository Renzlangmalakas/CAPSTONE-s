(function (root) {
  'use strict';
  const imageFields = {
    "/Images/logo.jpg": "Clinic Logo",
    "/Images/infection_control.jpg": "Enhanced Infection Control",
    "/Images/consultation.jpg": "Consultation",
    "/Images/Prophylaxis.jpg": "Oral Prophylaxis",
    "/Images/Restorative.jpg": "Restorative Treatment",
    "/Images/extraction.jpg": "Tooth Extraction",
    "/Images/odontectomy.jpg": "Odontectomy",
    "/Images/rootcanal.jpg": "Root Canal Treatment",
    "/Images/complete_denture.jpg": "Complete Denture",
    "/Images/stayplate.jpg": "Partial Denture Stayplate",
    "/Images/casted.jpg": "Partial Denture Casted",
    "/Images/flexible.jpg": "Flexible Denture",
    "/Images/crowns.jpg": "Crowns and Bridges",
    "/Images/orthodontic.jpg": "Orthodontic Treatment",
    "/Images/retainers.jpg": "Retainers",
    "/Images/mouth_guard.jpg": "Mouth Guard",
    "/Images/whitening.jpg": "Whitening",
    "/Images/periapical.jpg": "Periapical X-Ray",
    "/Images/panoramic.jpg": "Panoramic X-Ray"
};
  function serviceImageKey(service) {
    const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = Object.entries(imageFields).find(([path, label]) => path !== '/Images/logo.jpg' && normalize(label) === normalize(service.name));
    return match ? match[0] : `service:${service.id}`;
  }
  const defaults = {
    footerText: 'Your trusted partner for healthier teeth and more confident smiles.',
    faqs: [{"question": "How do I book an appointment?", "answer": "Click any Book Appointment button, then log in or register to continue through your appointment workflow."}, {"question": "Can I browse services before logging in?", "answer": "Yes. Patients can explore services, pricing, and clinic information first before signing in."}, {"question": "Does the system support registration and verification?", "answer": "Yes. The current flow includes account registration, verification messaging, and login handling."}],
    heroTitle: 'Thoughtful care. A more confident smile.',
    heroDescription: 'Discover dental care shaped around your needs, with clear guidance from your first consultation.',
    aboutTitle: 'About Our Clinic',
    aboutText: 'At Ganal-Mappala Dental Clinic, we believe every patient deserves high-quality dental care in a safe, warm, and professional setting.\n\nWe offer preventive, restorative, orthodontic, and cosmetic treatments using modern equipment and careful treatment planning.\n\nOur goal is not only to treat dental concerns but also to help patients maintain healthy smiles for life through education and prevention.',
    clinicName: 'Ganal-Mappala Dental Clinic',
    phone: '+63 922 872 4320 / +63 949 468 7363',
    hours: 'Mon - Sat | 9:00 AM - 5:00 PM',
    email: 'ganalmappaladentalclinic@gmail.com',
    address: '147 M. L. Quezon Ave, Antipolo, 1870 Rizal',
    openingTime: '09:00', closingTime: '17:00', workingDays: 'Monday - Saturday',
    gcashName: 'XA***R LO***Z Z.',
    gcashNumber: '09475518396',
    images: Object.fromEntries(Object.keys(imageFields).map(path => [path, path])),
    fontFamily: 'default', textSize: 'default', headingSize: 'default',
    gcashQr: ''
  };
  const limits = { footerText: 800, email: 160, address: 400, openingTime: 5, closingTime: 5, workingDays: 30, heroTitle: 160, heroDescription: 800, aboutTitle: 160, aboutText: 4000, clinicName: 160, phone: 100, hours: 160, gcashName: 120, gcashNumber: 11, gcashQr: 2800000 };
  const typographyOptions = {
    fontFamily: { default: 'Original website font', system: 'Modern sans serif', arial: 'Arial', georgia: 'Georgia', verdana: 'Verdana' },
    textSize: { default: 'Original size', '14': 'Small ? 14 px', '16': 'Standard ? 16 px', '18': 'Large ? 18 px', '20': 'Extra large ? 20 px' },
    headingSize: { default: 'Original size', small: 'Compact', medium: 'Standard', large: 'Large' }
  };
  function typographyCss(content = {}) {
    const fonts = { system: 'system-ui, sans-serif', arial: 'Arial, sans-serif', georgia: 'Georgia, serif', verdana: 'Verdana, sans-serif' };
    const scope = 'body :is(section, footer)';
    let css = '';
    if (fonts[content.fontFamily]) css += `${scope} :is(h1,h2,h3,h4,h5,h6,p,a,button,label,input,select,textarea,span,strong,summary,li) { font-family:${fonts[content.fontFamily]} !important; }`;
    if (['14','16','18','20'].includes(content.textSize)) css += `${scope} :is(p,li,label,.faq-question,.faq-answer,.btn,.contact-list,.contact-mini-card span) { font-size:${content.textSize}px !important; line-height:1.6; }`;
    const sizes = { small: [28,44,24,30,18], medium: [32,56,28,38,20], large: [36,64,32,44,24] }[content.headingSize];
    if (sizes) css += `${scope} h1 { font-size:clamp(${sizes[0]}px,4.5vw,${sizes[1]}px) !important; } ${scope} h2 { font-size:clamp(${sizes[2]}px,3.2vw,${sizes[3]}px) !important; } ${scope} :is(h3,h4,h5,h6) { font-size:${sizes[4]}px !important; } ${scope} :is(h1,h2,h3,h4,h5,h6) { line-height:1.2; overflow-wrap:break-word; }`;
    return css;
  }
  function withDefaults(input = {}) {
    const content = { ...defaults, ...input, images: { ...defaults.images, ...input?.images } };
    for (const key of Object.keys(limits)) {
      if (key !== 'gcashQr' && (typeof content[key] !== 'string' || !content[key].trim())) content[key] = defaults[key];
    }
    return content;
  }
  function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Content must be an object.');
    input = withDefaults(input);
    const result = {};
    for (const [key, options] of Object.entries(typographyOptions)) {
      if (!Object.hasOwn(options, input[key])) throw new Error(`Choose a valid ${key}.`);
      result[key] = input[key];
    }
    for (const [key, max] of Object.entries(limits)) {
      if (typeof input[key] !== 'string' || input[key].length > max) throw new Error(`Invalid ${key}. Maximum length: ${max}.`);
      result[key] = input[key].trim();
      if (key !== 'gcashQr' && !result[key]) throw new Error(`${key} is required.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Enter a valid clinic email.');
    if (![result.openingTime,result.closingTime].every(t => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)) || result.openingTime >= result.closingTime) throw new Error('Closing time must be later than opening time.');
    if (result.openingTime < '09:00' || result.closingTime > '17:00') throw new Error('Clinic hours must stay within 9:00 AM to 5:00 PM.');
    if (!['Monday - Friday','Monday - Saturday'].includes(result.workingDays)) throw new Error('Choose Monday - Friday or Monday - Saturday.');
    const display = t => { const [h,m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`; };
    result.hours = `${result.workingDays} | ${display(result.openingTime)} - ${display(result.closingTime)}`;
    if (!/^09\d{9}$/.test(result.gcashNumber)) throw new Error('Enter an 11-digit GCash number starting with 09.');
    if (result.gcashQr && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(result.gcashQr)) throw new Error('Upload a PNG, JPG or WebP QR image.');
    if (input.images != null && (typeof input.images !== 'object' || Array.isArray(input.images))) throw new Error('Invalid landing images.');
    if (!Array.isArray(input.faqs) || input.faqs.length > 20) throw new Error('Use up to 20 FAQ questions.');
    result.faqs = input.faqs.map(item => {
      if (!item || typeof item.question !== 'string' || typeof item.answer !== 'string' || !item.question.trim() || !item.answer.trim() || item.question.length > 200 || item.answer.length > 2000) throw new Error('Each FAQ needs a question (up to 200 characters) and answer (up to 2000 characters).');
      return { question: item.question.trim(), answer: item.answer.trim() };
    });
    result.images = {};
    for (const path of Object.keys(imageFields)) {
      const value = input.images?.[path] ?? path;
      if (typeof value !== 'string' || value.length > 400000 || (value !== path && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))) throw new Error(`Invalid image for ${imageFields[path]}.`);
      result.images[path] = value;
    }
    const extraImages = Object.entries(input.images || {}).filter(([key]) => key.startsWith('service:'));
    if (extraImages.length > 100) throw new Error('Use up to 100 service photos.');
    for (const [key, value] of extraImages) {
      if (!/^service:[a-zA-Z0-9_-]{1,100}$/.test(key) || typeof value !== 'string' || value.length > 400000 || (value !== '' && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))) throw new Error('Invalid service photo. Upload a PNG, JPG or WebP image.');
      result.images[key] = value;
    }
    if (JSON.stringify(result).length > 3800000) throw new Error('The selected images are too large together. Use smaller pictures.');
    return result;
  }
  root.GMSiteContent = { defaults, limits, imageFields, serviceImageKey, withDefaults, validate, typographyOptions, typographyCss };
  if (typeof module !== 'undefined') module.exports = root.GMSiteContent;
})(typeof window !== 'undefined' ? window : globalThis);

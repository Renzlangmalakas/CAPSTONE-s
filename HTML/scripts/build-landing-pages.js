const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '../Landing');
const template = fs.readFileSync(path.join(directory, 'landing.template.html'), 'utf8');
const pages = { home: 'landing.html', services: 'services.html', about: 'about.html', contact: 'contact.html' };
for (const [page, filename] of Object.entries(pages)) {
  let html = template.replace(/<section\b[^>]*>[\s\S]*?<\/section>/g, section => {
    const id = section.match(/^<section[^>]*\bid="([^"]+)"/)?.[1];
    return id === page || !id && page === 'home' ? section : '';
  });
  html = html.replace(/<body([^>]*)>/, `<body$1 data-landing-page="${page}">`);
  html = html.replace(/href="#(home|services|about|contact)"/g, (_, target) => `href="${pages[target]}" data-page="${target}"`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${page[0].toUpperCase() + page.slice(1)} | G-M Dental Clinic</title>`);
  html = html.replace(/(<p class="service-price mt-auto">)[\s\S]*?<\/p>/g, '$1Loading current price…</p>');
  fs.writeFileSync(path.join(directory, filename), html);
}
console.log('Generated Home, Services, About and Contact pages.');

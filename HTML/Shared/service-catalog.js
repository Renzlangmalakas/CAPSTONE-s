(function(root) {
'use strict';
const defaults = [
    {
        name: "Consultation",
        price: 500,
        chairMinutes: 20,
        displayDuration: "20 min",
        description: "A thorough evaluation of your current oral health, including a visual exam and professional advice on necessary treatments or preventive care.",
        includes: ["Dental examination", "Oral health assessment", "Treatment planning"]
    },
    {
        name: "Oral Prophylaxis",
        price: 1000,
        chairMinutes: 45,
        displayDuration: "45 min",
        description: "A professional cleaning session to remove stubborn plaque and tartar buildup that regular brushing cannot reach, finished with a high-shine polish.",
        includes: ["Teeth cleaning", "Plaque & tartar removal", "Polishing"]
    },
    {
        name: "Restorative Treatment",
        price: 800,
        chairMinutes: 60,
        displayDuration: "1 hr",
        description: "Commonly known as a filling, this procedure repairs a decayed or damaged tooth using tooth-colored composite resin to restore its strength and appearance.",
        includes: ["Cavity cleaning", "Tooth filling", "Tooth restoration"]
    },
    {
        name: "Tooth Extraction",
        price: 1000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "Safe and gentle removal of a damaged or problematic tooth under local anesthesia to prevent further pain or infection.",
        includes: ["Local anesthesia", "Tooth removal", "Post-extraction care"]
    },
    {
        name: "Odontectomy",
        price: 10000,
        chairMinutes: 150,
        displayDuration: "2.5 hrs",
        description: "A specialized surgical procedure typically used for impacted wisdom teeth that are trapped under the gum line or bone.",
        includes: ["Surgical extraction", "Wisdom tooth removal", "Sutures if needed"]
    },
    {
        name: "Root Canal Treatment",
        price: 6000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "An advanced procedure designed to save a severely decayed or infected tooth by removing the damaged pulp and sealing the internal canal.",
        includes: ["Infection removal", "Canal cleaning", "Tooth sealing"]
    },
    {
        name: "Complete Denture",
        price: 15000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "A full-coverage prosthetic solution for patients missing all teeth in an arch, custom-molded for a natural look and comfortable fit.",
        includes: ["Full denture fitting", "Custom molding", "Bite adjustment"]
    },
    {
        name: "Partial Denture (Stayplate)",
        price: 6500,
        chairMinutes: 90,
        displayDuration: "1.5 hrs",
        description: "An affordable, removable acrylic plate used to replace one or several missing teeth, ideal for temporary or budget-friendly restoration.",
        includes: ["Partial denture creation", "Lightweight material", "Basic fitting"]
    },
    {
        name: "Partial Denture (Casted)",
        price: 12000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "A high-durability partial denture featuring a metal framework for superior strength, stability, and a thinner, more comfortable profile.",
        includes: ["Metal framework denture", "Precise fitting", "Durable design"]
    },
    {
        name: "Flexible Denture",
        price: 16000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "The most comfortable denture option, made from a premium nylon material that adapts to the shape of your gums and lacks visible metal clasps.",
        includes: ["Flexible material denture", "Comfort fit design", "Aesthetic finish"]
    },
    {
        name: "Crowns and Bridges",
        price: 6000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "Fixed prosthetic devices used to cover a damaged tooth (Crown) or bridge the gap created by one or more missing teeth.",
        includes: ["Tooth restoration", "Crown or bridge placement", "Bite alignment"]
    },
    {
        name: "Orthodontic Treatment",
        price: 60000,
        chairMinutes: 60,
        displayDuration: "1 hr",
        description: "Comprehensive alignment correction using traditional braces. This price typically covers the installation and start of your journey to a perfect smile.",
        includes: ["Braces installation", "Alignment correction", "Monthly adjustments"]
    },
    {
        name: "Retainers",
        price: 6000,
        chairMinutes: 30,
        displayDuration: "30 min",
        description: "Custom-made appliances worn after orthodontic treatment to prevent teeth from shifting back to their original positions.",
        includes: ["Custom retainer", "Teeth alignment support", "Post-braces maintenance"]
    },
    {
        name: "Mouth Guard",
        price: 6000,
        chairMinutes: 30,
        displayDuration: "30 min",
        description: "A custom-fitted protective device for athletes or patients who grind their teeth (bruxism) at night to prevent dental wear and injury.",
        includes: ["Custom mouth guard", "Protection for teeth", "Comfort fit"]
    },
    {
        name: "Whitening",
        price: 12000,
        chairMinutes: 90,
        displayDuration: "1.5 hrs",
        description: "A high-strength professional bleaching treatment that removes deep stains caused by food, coffee, or smoking, brightening your smile by several shades.",
        includes: ["Teeth bleaching", "Stain removal", "Shade enhancement"]
    },
    {
        name: "Periapical X-Ray",
        price: 500,
        chairMinutes: 10,
        displayDuration: "10 min",
        description: "A focused X-ray that shows the entire tooth from the crown to the end of the root, essential for diagnosing infections or root issues.",
        includes: ["Tooth imaging", "Root analysis", "Diagnostic results"]
    },
    {
        name: "Panoramic X-Ray",
        price: 1000,
        chairMinutes: 15,
        displayDuration: "15 min",
        description: "A wide-angle X-ray of the entire jaw, providing a comprehensive view of all teeth, jawbones, and sinuses in a single image.",
        includes: ["Full mouth scan", "Jaw imaging", "Comprehensive diagnosis"]
    }
];
const aliases = { 'oral prophylaxis teeth cleaning':'oral prophylaxis', 'teeth cleaning':'oral prophylaxis', 'cleaning':'oral prophylaxis', 'dental fillings':'restorative treatment', 'teeth whitening':'whitening', 'orthodontic treatment braces':'orthodontic treatment', 'extraction':'tooth extraction' };
function key(name) { const normalized = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); return aliases[normalized] || normalized; }
function compareNames(a, b) { return String(a.name || '').trim().localeCompare(String(b.name || '').trim(), 'en', { sensitivity: 'base', numeric: true }); }
defaults.sort(compareNames);
function merge(records = []) {
  const map = new Map();
  for (const row of records) {
    if (!row || !String(row.name || '').trim()) continue;
    const nameKey = key(row.name), old = map.get(nameKey);
    const stamp = value => Date.parse(value.updatedAt || value.updated_at || value.createdAt || '') || 0;
    if (!old || stamp(row) >= stamp(old)) map.set(nameKey, row);
  }
  return [...map.values()].sort(compareNames).map(row => {
    const base = defaults.find(service => key(service.name) === key(row.name)) || {};
    return { ...base, ...row, price: Number(row.price), description: row.description || base.description || '',
      includes: row.includes || base.includes || [], displayDuration: row.duration || row.displayDuration || base.displayDuration || '',
      archived: row.archived === true || row.archived === 'true' };
  });
}
const api = { defaults, aliases, key, merge, compareNames };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.GMServiceCatalog = api;
})(typeof window !== 'undefined' ? window : globalThis);

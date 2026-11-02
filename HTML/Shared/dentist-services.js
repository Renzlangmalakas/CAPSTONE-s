(function(root) {
const SERVICE_SPECIALTY_MAP = {
  "Enhanced Infection Control": ["ANY"],
  "Consultation": ["ANY"],
  "Oral Prophylaxis": ["General Dentist", "Pediatric Dentist", "Periodontist"],
  "Restorative Treatment": ["General Dentist", "Cosmetic Dentist"],
  "Tooth Extraction": ["General Dentist", "Oral Surgeon"],
  "Odontectomy": ["Oral Surgeon"],
  "Root Canal Treatment": ["Endodontist"],
  "Complete Denture": ["Prosthodontist"],
  "Partial Denture (Stayplate)": ["General Dentist", "Prosthodontist"],
  "Partial Denture (Casted)": ["Prosthodontist"],
  "Flexible Denture": ["Prosthodontist"],
  "Crowns and Bridges": ["Prosthodontist"],
  "Orthodontic Treatment": ["Orthodontist"],
  "Retainers": ["Orthodontist"],
  "Mouth Guard": ["General Dentist", "Orthodontist"],
  "Whitening": ["Cosmetic Dentist"],
  "Periapical X-Ray": ["ANY"],
  "Panoramic X-Ray": ["ANY"]
};

const SERVICE_SPECIALTY_ALIASES = {
  "oral prophylaxis teeth cleaning": "Oral Prophylaxis",
  "teeth cleaning": "Oral Prophylaxis",
  "dental fillings": "Restorative Treatment",
  "filling": "Restorative Treatment",
  "tooth filling": "Restorative Treatment",
  "teeth whitening": "Whitening",
  "orthodontic treatment braces": "Orthodontic Treatment",
  "braces": "Orthodontic Treatment",
  "partial denture stayplate": "Partial Denture (Stayplate)",
  "partial denture casted": "Partial Denture (Casted)",
  "root canal": "Root Canal Treatment",
  "xray": "Periapical X-Ray",
  "x ray": "Periapical X-Ray",
  "periapical x ray": "Periapical X-Ray",
  "panoramic x ray": "Panoramic X-Ray"
};

function normalizeSpecialtyToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpecialty(value = "") {
  const raw = normalizeSpecialtyToken(value);

  if (["general dentist", "general dentistry", "dentist"].includes(raw)) return "general dentist";
  if (["orthodontist", "orthodontics", "ortho"].includes(raw)) return "orthodontist";
  if (["pediatric dentist", "pediatric dentistry", "pedo"].includes(raw)) return "pediatric dentist";
  if (["endodontist", "endodontics"].includes(raw)) return "endodontist";
  if (["prosthodontist", "prosthodontics"].includes(raw)) return "prosthodontist";
  if (["oral surgeon", "oral surgery"].includes(raw)) return "oral surgeon";
  if (["cosmetic dentist", "cosmetic dentistry"].includes(raw)) return "cosmetic dentist";
  if (["periodontist", "periodontics"].includes(raw)) return "periodontist";

  return raw;
}

function getDentistSpecialtyTokens(dentist = {}) {
  const rawValues = [
    dentist.specialty,
    dentist.specialization,
    dentist.role,
    ...(Array.isArray(dentist.specialties) ? dentist.specialties : [])
  ];

  return rawValues
    .flatMap(value => String(value || "").split(/[,/|;]/))
    .map(normalizeSpecialty)
    .filter(Boolean);
}

function normalizeServiceSpecialtyKey(serviceName = "") {
  const normalized = normalizeSpecialtyToken(serviceName);
  if (!normalized) return "";

  if (SERVICE_SPECIALTY_ALIASES[normalized]) {
    return SERVICE_SPECIALTY_ALIASES[normalized];
  }

  const directMatch = Object.keys(SERVICE_SPECIALTY_MAP).find(
    name => normalizeSpecialtyToken(name) === normalized
  );

  return directMatch || String(serviceName || "").trim();
}

function getAllowedSpecialtiesForService(serviceName = "") {
  const serviceKey = normalizeServiceSpecialtyKey(serviceName);
  return SERVICE_SPECIALTY_MAP[serviceKey] || ["General Dentist"];
}

function dentistCanPerformService(dentist = {}, serviceName = "") {
  if (getDentistSpecialtyTokens(dentist).includes("all services")) return true;
  const allowed = getAllowedSpecialtiesForService(serviceName);

  if (allowed.includes("ANY")) return true;

  const normalizedAllowed = allowed.map(normalizeSpecialty);
  const dentistSpecialties = getDentistSpecialtyTokens(dentist);

  return dentistSpecialties.some(specialty => normalizedAllowed.includes(specialty));
}

const api = { canPerform: dentistCanPerformService };
if (typeof module === 'object' && module.exports) module.exports = api;
else root.GMDentistServices = api;
})(typeof globalThis === 'object' ? globalThis : this);

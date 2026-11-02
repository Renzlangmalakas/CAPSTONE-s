require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// On Vercel every cold start begins with an empty process, so the work that used
// to happen inside app.listen() has to run once per instance before the first
// route handler touches Supabase-derived state (see ensureBootstrapped below).
app.use(async (_req, _res, next) => {
  if (await ensureBootstrapped() === false) {
    _res.set('Retry-After', '60');
    return _res.status(503).json({ message: 'The database is temporarily unavailable. Please retry in a minute.' });
  }
  next();
});

// The auth routes below are defined at the top level (/login, /register, ...) but
// on Vercel the whole app is served from the /api/* function, so those requests
// arrive prefixed. Strip the prefix for those paths only — /api/admin/users and
// friends must keep theirs.
const TOP_LEVEL_ROUTES = [
  "/register",
  "/login",
  "/verify-otp",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verification-status"
];

app.use((req, _res, next) => {
  if (req.url.startsWith("/api/")) {
    const stripped = req.url.slice("/api".length);
    const path = stripped.split("?")[0];
    if (TOP_LEVEL_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) {
      req.url = stripped;
    }
  }
  next();
});

const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const sessions = require("./_session").createSessions(process.env.SESSION_SECRET || supabaseServiceRoleKey || crypto.randomBytes(32));

app.use((req,res,next)=>require('./_audit-v2').middleware(supabase, token=>sessions.verify(token))(req,res,next));

app.use("/api", async (req, res, next) => {
  if (req.method === "GET" && ["/site-content", "/services"].includes(req.path)) return next();
  if (req.path === "/cron/appointment-reminders") return next();
  if (req.method === "POST" && req.path === "/dentist-invitations/accept") return next();
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.body?.sessionToken;
  const user = sessions.verify(token);
  if (!user) return res.status(401).json({ message: "Please sign in again." });
  req.user = user;
  if (req.path.startsWith("/admin/") && user.role !== "admin") return res.status(403).json({ message: "Administrator access is required." });
  // Recheck revocation on every request, including tokens issued before a merge.
  if (supabase) {
    try {
      const { data, error } = await require('./_account-access').readAccountAccess(supabase, user);
      if (error) {
        console.error('[account-access]', error.code || 'UNKNOWN', error.message);
        return res.status(503).json({ message: 'Account access could not be verified. Please retry.' });
      }
      if (!data || data.archived || data.merged_into) return res.status(401).json({ message: 'This account is inactive. Please sign in with your replacement account.' });
      user.id = data.id;
    } catch (error) {
      console.error('[account-access]', error.code || error.name || 'UNKNOWN', error.message);
      return res.status(503).json({ message: 'Account access could not be verified. Please retry.' });
    }
  }
  req.user = user;
  next();
});

function decodeJwtPayload(jwt) {
  try {
    const parts = String(jwt || "").split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getSupabaseKeyRole(key) {
  if (!key) return null;

  const payload = decodeJwtPayload(key);
  if (payload?.role) return payload.role;

  if (String(key).startsWith("sb_secret_")) return "service_role";
  if (String(key).startsWith("sbp_")) return "anon";

  return null;
}

const supabaseServiceRoleKeyRole = getSupabaseKeyRole(supabaseServiceRoleKey);
const hasValidSupabaseServiceRoleKey = supabaseServiceRoleKeyRole === "service_role" || String(supabaseServiceRoleKey || "").startsWith("sb_secret_");

const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {fetch:require("./_audit-v2").contextualFetch}
    })
  : null;


require('./_patient-merge')(app, supabase);
require('./_audit-events')(app, supabase, async (user, key) => {
  const db = await readClinicDbFromSupabase(['dentists','appointments','archivedAppointments']);
  const access = require('../Shared/dentist-access');
  const scoped = access.scope(db,user);
  const appointment = [...scoped.appointments,...scoped.archivedAppointments].find(row => String(row.patientKey||row.patientId||row.patientEmail||row.patientName||row.patient||'').trim().toLowerCase() === key.toLowerCase());
  return appointment ? appointment.patientName||appointment.patient||key : null;
});
app.get('/api/admin/audit-log', require('./_audit-v2').listHandler(supabase));
app.get('/api/admin/audit-alerts', async(req,res)=>{
 try {const {data,error}=await supabase.from('clinic_audit_alerts').select('*').order('id',{ascending:false}).limit(50);if(error)throw error;res.set('Cache-Control','private, no-store');res.json({alerts:data});}
 catch(error){res.status(503).json({message:'Audit alerts are unavailable.'});}
});
app.get('/api/admin/discounted-prices', async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  if (!supabase) return res.status(503).json({ message: 'Database unavailable.' });
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
  const { data, error } = await supabase.from('discounted_prices').select('*')
    .order('appointment_id').range(offset, offset + 199);
  if (error) return res.status(500).json({ message: 'Unable to load discounted prices.' });
  res.set('Cache-Control', 'no-store');
  return res.json({ rows: data, hasMore: data.length === 200 });
});


const cms = require('./_cms').createCmsHandlers(supabase);
app.get('/api/site-content', cms.published);
app.get('/api/services', require('./_public-services').createPublicServicesHandler(supabase));
app.get('/api/admin/site-content', cms.get);
app.put('/api/admin/site-content', cms.save);

if (supabase && !hasValidSupabaseServiceRoleKey) {
  console.warn(`Supabase service key detected as role=${supabaseServiceRoleKeyRole || 'unknown'}. ` +
    `Clinic writes require a true service_role key from the Supabase dashboard, not the anon key.`);
}

const defaultAccounts = require("../Shared/default-accounts");
const seedUsers = defaultAccounts.accounts.map(account => ({
  ...account,
  password: bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10),
  isVerified: true
}));

const pendingUsers = [];
const users = [...seedUsers];
const passwordResetCodes = new Map();
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

async function saveResetCode(email, entry) {
  if (!supabase) {
    if (entry) passwordResetCodes.set(email, entry); else passwordResetCodes.delete(email);
    return;
  }
  const { error } = await supabase.from("users")
    .update({ verification_token: entry ? `reset:${JSON.stringify(entry)}` : null })
    .eq("email", email).eq("is_verified", true);
  if (error) throw error;
}

async function readResetCode(email) {
  if (!supabase) return passwordResetCodes.get(email);
  const { data, error } = await supabase.from("users").select("verification_token")
    .eq("email", email).eq("is_verified", true).maybeSingle();
  if (error) throw error;
  const token = data?.verification_token;
  if (!String(token || "").startsWith("reset:")) return null;
  try { return JSON.parse(token.slice(6)); } catch { return null; }
}

const PORT = process.env.PORT || 3000;
// VERCEL_URL is the per-deployment hostname; set BACKEND_PUBLIC_URL to a custom
// domain so verification links keep working across deployments.
const BACKEND_PUBLIC_URL =
  process.env.BACKEND_PUBLIC_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`);
const APPOINTMENT_REMINDER_SCAN_MS = Number(process.env.APPOINTMENT_REMINDER_SCAN_MS || 5 * 60 * 1000);

const transporter = nodemailer.createTransport({
  service: "gmail",
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
const mailer = require('./_mailer').createMailer(transporter);

const clinicTableMap = {
  patients: { table: "patients", keyColumn: "sync_key" },
  dentists: { table: "dentists", keyColumn: "sync_key" },
  staff: { table: "staffs", keyColumn: "sync_key" },
  appointments: { table: "clinic_appointments", fallbackTable: "appointments", keyColumn: "id" },
  dentistSchedules: { table: "dentist_schedules", keyColumn: "sync_key" },
  services: { table: "services", keyColumn: "sync_key" },
  additionalFees: { table: "clinic_additional_fees", keyColumn: "id" },
  payments: { table: "payments", keyColumn: "sync_key" },
  archivedAppointments: { table: "clinic_archived_appointments", keyColumn: "id" },
  rescheduleRequests: { table: "clinic_reschedule_requests", keyColumn: "id" },
  patientClinicalNotes: { table: "clinic_patient_clinical_notes", keyColumn: "id" },
  treatmentPlans: { table: "clinic_treatment_plans", keyColumn: "id" },
  history: { table: "treatment_logs", fallbackTable: "clinic_history", keyColumn: "id", derived: true }
};

const rawTableColumns = {
  patients: ["id", "name", "contact", "email", "condition", "address", "age", "gender", "archived", "deleted_at", "created_at", "updated_at"],
  dentists: ["id", "name", "specialty", "contact", "email", "archived", "created_at", "updated_at"],
  staffs: ["id", "position", "created_at"],
  dentist_schedules: ["id", "dentist_id", "day_of_week", "start_time", "end_time", "is_active", "created_at", "updated_at"],
  services: ["id", "name", "price", "archived", "description", "duration", "created_at", "updated_at"],
  payments: ["id", "amount", "created_at"],
  notifications: ["id", "user_id", "role_target", "title", "body", "is_read", "created_at", "data"],
  treatment_logs: ["id", "created_at"]
};

const notificationTargets = ["admin", "dentist", "patient", "staff"];

function snakeToCamel(value = "") {
  return String(value).replace(/_([a-z])/g, (_match, char) => char.toUpperCase());
}

function camelToSnake(value = "") {
  return String(value).replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
}

function normalizeRawRow(row = {}) {
  return Object.entries(row).reduce((normalized, [key, value]) => {
    const camelKey = snakeToCamel(key);
    normalized[camelKey] = value;
    return normalized;
  }, {});
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

// The browser generates local ids with Math.random().toString(36), which are not
// UUIDs, so those rows used to miss the upsert and get blind-inserted on every
// sync — one duplicate per push, forever. Map any non-UUID identity onto a
// deterministic UUIDv5 instead, so the same logical record always resolves to
// the same primary key and upsert can do its job.
function deterministicUuid(namespace, seed) {
  const hash = crypto.createHash("sha1").update(`${namespace}:${seed}`).digest("hex");
  const variant = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(17, 20)}`,
    hash.slice(20, 32)
  ].join("-");
}

// Fallbacks for records that reach us with no id at all (e.g. the placeholder
// "Assigned Dentist" rows). Matching on a natural key keeps them from
// multiplying too, at the cost of collapsing genuine same-name records.
const NATURAL_KEY_FIELDS = ["syncKey", "sync_key", "email", "name", "title"];

function stableRowId(record = {}, tableName) {
  if (isUuid(record.id)) return record.id;

  const seed = [record.id, ...NATURAL_KEY_FIELDS.map((field) => record[field])]
    .find((value) => value != null && String(value).trim() !== "");

  return seed == null ? null : deterministicUuid(tableName, String(seed));
}

function buildRawRow(record = {}, tableName) {
  if (tableName === "notifications") return require('./_notifications').notificationRow(record, stableRowId(record, tableName));
  const columns = rawTableColumns[tableName] || [];
  const row = {};
  const id = stableRowId(record, tableName);
  if (id) {
    row.id = id;
  }
  columns.forEach((col) => {
    if (col === "id") return;
    const camelKey = snakeToCamel(col);
    if (record.hasOwnProperty(camelKey)) {
      row[col] = record[camelKey];
    } else if (record.hasOwnProperty(col)) {
      row[col] = record[col];
    }
  });
  // Legacy browser snapshots use empty strings for unknown dates. Omit them
  // so Postgres can retain an existing value or apply its insert default.
  for (const col of ["created_at", "updated_at"]) {
    if (col in row && (row[col] == null || String(row[col]).trim() === "")) delete row[col];
  }
  if (tableName === "patients" && "age" in row) {
    row.age = row.age == null || String(row.age).trim() === "" ? null : Number(row.age);
    if (row.age !== null && (!Number.isInteger(row.age) || row.age < 0)) throw new Error("Patient age must be a non-negative whole number or empty.");
  }
  if (tableName === "dentist_schedules") {
    row.dentist_id = isUuid(record.dentistId || record.dentist_id) ? (record.dentistId || record.dentist_id) : stableRowId({ id: record.dentistId || record.dentist_id }, "dentists");
    row.day_of_week = record.dayOfWeek ?? record.day_of_week ?? ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(String(record.day || "").toLowerCase());
    row.start_time = record.startTime || record.start_time || record.start;
    row.end_time = record.endTime || record.end_time || record.end;
    row.is_active = record.isActive ?? record.is_active ?? !record.archived;
  }
  return row;
}

function requireSupabase(res) {
  if (supabase) return true;

  const baseMessage = supabaseUrl
    ? `Supabase URL is configured (${supabaseUrl}), but the Supabase service-role key is missing. Add SUPABASE_SERVICE_ROLE_KEY in the server environment.`
    : "Supabase is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.";

  res.status(500).json({
    message: baseMessage
  });
  return false;
}

function requireServiceRoleKey(res) {
  if (!supabaseServiceRoleKey) {
    res.status(500).json({
      message: supabaseUrl
        ? `SUPABASE_SERVICE_ROLE_KEY is missing for project ${supabaseUrl}. Copy the service_role key from Supabase Dashboard → Project Settings → Data API / API keys and set it in the server environment.`
        : "SUPABASE_SERVICE_ROLE_KEY is not configured. Add the service_role key from the Supabase dashboard to the Vercel project environment variables (or HTML/.env locally)."
    });
    return false;
  }

  if (!hasValidSupabaseServiceRoleKey) {
    res.status(500).json({
      message: "SUPABASE_SERVICE_ROLE_KEY appears to be the anon key, not the service_role key. Use the service_role key from the Supabase dashboard.",
      detectedRole: supabaseServiceRoleKeyRole || "unknown"
    });
    return false;
  }

  return true;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "patient",
    sex: user.sex || "",
    dob: user.dob || "",
    mobile: user.mobile || "",
    profileTitle: user.profileTitle || "",
    address: user.address || "",
    condition: user.condition || ""
  };
}

function nullableDate(value) {
  const text = String(value || "").trim();
  return text || null;
}

// Schema capability flags — probed at startup by detectUsersSchema().
// If `role` column is missing, we fall back to encoding the role into the
// `condition` column with an `__role:xxx__|` prefix so admin-created users
// still persist and can log in.
const ROLE_PREFIX_RE = /^__role:([a-z]+)__\|?/;
let usersHasRoleColumn = true;

async function detectUsersSchema() {
  if (!supabase) return;
  const { error } = await supabase.from("users").select("role").limit(1);
  usersHasRoleColumn = !error;
  if (!usersHasRoleColumn) {
    console.log("[schema] users.role column not present — using condition-field fallback (admin Create User works either way).");
  } else {
    console.log("[schema] users.role column present.");
  }
}

function encodeConditionWithRole(condition, role) {
  const cleanCondition = String(condition || "").replace(ROLE_PREFIX_RE, "");
  return `__role:${role}__|${cleanCondition}`;
}

function decodeConditionRole(condition) {
  const text = String(condition || "");
  const m = ROLE_PREFIX_RE.exec(text);
  if (!m) return { role: null, condition: text };
  return { role: m[1], condition: text.replace(ROLE_PREFIX_RE, "") };
}

function toDbUser(user) {
  const role = user.role || "patient";
  const row = {
    id: user.id || crypto.randomUUID(),
    name: user.name || "",
    email: String(user.email || "").trim().toLowerCase(),
    password: user.password_hash || user.password,
    is_verified: user.is_verified ?? user.isVerified ?? true,
    sex: user.sex || "",
    dob: nullableDate(user.dob),
    mobile: user.mobile || "",
    address: user.address || "",
    condition: user.condition || ""
  };
  if (usersHasRoleColumn) {
    row.role = role;
  } else {
    row.condition = encodeConditionWithRole(row.condition, role);
  }
  return row;
}

function fromDbUser(row) {
  if (!row) return null;
  const seededRole = seedUsers.find((user) =>
    String(user.email).toLowerCase() === String(row.email).toLowerCase()
  )?.role;

  const { role: encodedRole, condition: cleanCondition } = decodeConditionRole(row.condition);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password || row.password_hash,
    role: row.role || encodedRole || seededRole || "patient",
    isVerified: row.is_verified,
    archived: Boolean(row.archived),
    mergedInto: row.merged_into || null,
    sex: row.sex || "",
    dob: row.dob || "",
    mobile: row.mobile || "",
    profileTitle: row.profile_title || "",
    address: row.address || "",
    condition: cleanCondition
  };
}

function isMissingSupabaseTable(error) {
  return error?.code === "42P01"
    || error?.code === "PGRST205"
    || /does not exist|could not find the table|column .* does not exist|could not find .* column/i.test(error?.message || "");
}

function isSupabaseRlsError(error) {
  return error?.code === "42501"
    || /row-level security|permission denied|blocked the insert|blocked the update|blocked the delete/i.test(error?.message || "");
}

async function seedSupabaseUsers() {
  if (!supabase) return;
  const { data: existing, error } = await supabase.from("users").select("*");
  if (error) throw error;
  for (const user of seedUsers) {
    const matches = existing.filter(row => {
      const role = row.role || decodeConditionRole(row.condition).role;
      return (!role || role === user.role) && defaultAccounts.match(row, user.role)?.email === user.email;
    });
    const keeper = matches.find(row => String(row.email).toLowerCase() === user.email) || matches[0];
    if (!keeper) {
      const { error } = await supabase.from("users").upsert(toDbUser({ ...user, id: deterministicUuid("default-user", user.email) }), { onConflict: "email", ignoreDuplicates: true });
      if (error) throw error;
      continue;
    }
    const changes = { name: user.name, email: user.email };
    if (usersHasRoleColumn) changes.role = user.role;
    else changes.condition = encodeConditionWithRole(keeper.condition, user.role);
    // Preserve existing credentials and profile information.
    if (Object.entries(changes).some(([field, value]) => keeper[field] !== value)) {
      const { error: updateError } = await supabase.from("users").update(changes).eq("id", keeper.id);
      if (updateError) throw updateError;
    }
    for (const duplicate of matches.filter(row => row.id !== keeper.id)) {
      const { error: deleteError } = await supabase.from("users").delete().eq("id", duplicate.id);
      if (deleteError) throw deleteError;
    }
  }
}

async function findVerifiedUserByEmail(email) {
  if (!supabase) {
    return users.find((u) => u.email.toLowerCase() === email) || null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("is_verified", true)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTable(error)) {
      console.warn("Supabase users table is missing; using in-memory auth fallback.");
      return users.find((u) => u.email.toLowerCase() === email) || null;
    }
    throw error;
  }
  return fromDbUser(data);
}

async function findPendingUserByEmail(email) {
  if (!supabase) {
    return pendingUsers.find((u) => u.email.toLowerCase() === email) || null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("is_verified", false)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTable(error)) {
      console.warn("Supabase users table is missing; using in-memory pending user fallback.");
      return pendingUsers.find((u) => u.email.toLowerCase() === email) || null;
    }
    throw error;
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    password: data.password || data.password_hash,
    sex: data.sex || "",
    dob: data.dob || "",
    mobile: data.mobile || "",
    address: data.address || "",
    role: data.role || "patient",
    isVerified: false,
    verificationToken: data.verification_token
  };
}

async function findPendingUserByToken(token) {
  if (!supabase) {
    const index = pendingUsers.findIndex((u) => u.verificationToken === token);
    return { user: index >= 0 ? pendingUsers[index] : null, index };
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("verification_token", token)
    .eq("is_verified", false)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTable(error)) {
      console.warn("Supabase users table is missing; using in-memory token fallback.");
      const index = pendingUsers.findIndex((u) => u.verificationToken === token);
      return { user: index >= 0 ? pendingUsers[index] : null, index };
    }
    throw error;
  }
  return {
    user: data
      ? {
          id: data.id,
          name: data.name,
          email: data.email,
          password: data.password || data.password_hash,
          sex: data.sex || "",
          dob: data.dob || "",
          mobile: data.mobile || "",
          address: data.address || "",
          role: data.role || "patient",
          isVerified: false,
          verificationToken: data.verification_token
        }
      : null,
    index: -1
  };
}

async function upsertPendingUser(user) {
  if (!supabase) {
    const index = pendingUsers.findIndex((u) => u.email.toLowerCase() === user.email);
    if (index >= 0) pendingUsers[index] = { ...pendingUsers[index], ...user };
    else pendingUsers.push(user);
    return;
  }

  const row = toDbUser({ ...user, isVerified: false });
  row.verification_token = user.verificationToken;

  const { error } = await supabase
    .from("users")
    .upsert(row, { onConflict: "email" });

  if (error) {
    if (isMissingSupabaseTable(error)) {
      const index = pendingUsers.findIndex((u) => u.email.toLowerCase() === user.email);
      if (index >= 0) pendingUsers[index] = { ...pendingUsers[index], ...user };
      else pendingUsers.push(user);
      return;
    }
    throw error;
  }
}

async function verifyPendingUser(user, index = -1) {
  if (!supabase) {
    user.isVerified = true;
    user.verificationToken = null;
    users.push(user);
    if (index >= 0) pendingUsers.splice(index, 1);
    return user;
  }

  const verifiedRow = toDbUser({ ...user, isVerified: true });
  const { error: insertError } = await supabase
    .from("users")
    .upsert(verifiedRow, { onConflict: "email" });

  if (insertError) {
    if (isMissingSupabaseTable(insertError)) {
      user.isVerified = true;
      user.verificationToken = null;
      users.push(user);
      if (index >= 0) pendingUsers.splice(index, 1);
      return user;
    }
    throw insertError;
  }

  const { error: deleteError } = await supabase
    .from("users")
    .update({ verification_token: null, is_verified: true })
    .eq("id", user.id);

  if (deleteError) throw deleteError;

  return { ...user, isVerified: true, verificationToken: null };
}

function ensureId(record = {}) {
  return String(record.id || record.appointmentId || crypto.randomUUID());
}

function isUsableAppointment(record = {}) {
  const patient = String(record.patientName || record.patient || record.patientId || "").trim();
  const service = String(record.service || "").trim();
  const schedule = String(record.schedule || "").trim();
  const date = String(record.date || "").trim();
  return Boolean(patient && (service || schedule || date) && service.toLowerCase() !== "no appointment yet" && record.record_type !== "profile" && record.recordType !== "profile");
}

const nativeClinicTables = new Set();
async function readJsonTable(tableName, keyColumn = "sync_key", fallbackTable) {
  const attempt = async (table) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(`${keyColumn},data,updated_at${tableName === "patients" ? ",created_at" : ""}`)
        .not(keyColumn, "is", null)
        .order("updated_at", { ascending: false });

      if (error) {
        if (isMissingSupabaseTable(error)) return { data: [], missing: true };
        throw error;
      }
      return { data: data || [], missing: false };
    } catch (error) {
      if (isMissingSupabaseTable(error)) return { data: [], missing: true };
      throw error;
    }
  };

  const result = nativeClinicTables.has(tableName) ? { missing: true } : await attempt(tableName);
  if (result.missing && fallbackTable) {
    const fallbackResult = await attempt(fallbackTable);
    if (!fallbackResult.missing) {
      return fallbackResult.data.map((row) => ({
        id: row.data?.id || row[keyColumn],
        ...(row.data || {}),
        ...(tableName === "patients" ? { createdAt: row.data?.createdAt || row.data?.created_at || row.created_at || "" } : {}),
        updatedAt: row.data?.updatedAt || row.updated_at
      }));
    }
    return [];
  }

  if (result.missing) {
    const rawFields = rawTableColumns[tableName] || [];
    if (rawFields.length) {
      let rawData;
      let rawError;

      ({ data: rawData, error: rawError } = await supabase
        .from(tableName)
        .select(rawFields.join(','))
        .order('id', { ascending: true })
        .limit(1000));

      if (rawError && isMissingSupabaseTable(rawError)) {
        ({ data: rawData, error: rawError } = await supabase
          .from(tableName)
          .select('*')
          .order('id', { ascending: true })
          .limit(1000));
      }

      if (!rawError && Array.isArray(rawData)) {
        nativeClinicTables.add(tableName);
        return rawData.map((row) => {
          const normalized = normalizeRawRow(row);
          return {
            id: normalized.id,
            ...normalized,
            updatedAt: normalized.updatedAt || normalized.createdAt
          };
        });
      }
    }
    return [];
  }

  return result.data.map((row) => ({
    id: row.data?.id || row[keyColumn],
    ...(row.data || {}),
        ...(tableName === "patients" ? { createdAt: row.data?.createdAt || row.data?.created_at || row.created_at || "" } : {}),
    updatedAt: row.data?.updatedAt || row.updated_at
  }));
}

async function replaceJsonTable(tableName, records, keyColumn = "sync_key", fallbackTable, mergeOnly = false) {
  const { uniqueRecords } = require('./_sync-records');
  const safeRecords = uniqueRecords(Array.isArray(records) ? records : []);

  // Clinical history is additive: an absent note in an older snapshot is not a deletion.
  if (tableName === "clinic_patient_clinical_notes") {
    const { data: existing, error } = await supabase.from(tableName).select("id,data");
    if (error) throw error;
    const byId = new Map((existing || []).map(row => [String(row.id), row]));
    for (const record of safeRecords) {
      const id = ensureId(record), old = byId.get(String(id));
      if (old) {
        // Treatment entries are saved as new records. Never overwrite history
        // from an older full-database snapshot.
        Object.assign(record, old.data);
        continue;
      }
      const { error: insertError } = await supabase.from(tableName).insert({ id, data: { ...record, id } });
      if (insertError && insertError.code !== '23505') throw insertError;
    }
    return;
  }

  if (tableName === "patients") {
    const { data: existing, error } = await supabase.from(tableName).select("id,name,deleted_at");
    if (error) throw error;
    const byId = new Map((existing || []).map(row => [String(row.id), row]));
    const deletedDb = { deletedPatients: (existing || []).filter(row => row.deleted_at) };
    for (const record of safeRecords) {
      const id = stableRowId(record, tableName);
      if (!id || record.deletedAt || record.deleted_at || defaultAccounts.isDeletedPatient(deletedDb, { ...record, id })) continue;
      const payload = buildRawRow({ ...record, id }, tableName);
      delete payload.deleted_at;
      // The conditional update also protects against deletion during this sync.
      const result = byId.has(String(id))
        ? await supabase.from(tableName).update(payload).eq("id", id).is("deleted_at", null)
        : await supabase.from(tableName).insert(payload);
      if (result.error && result.error.code !== '23505') throw result.error;
    }
    return;
  }

  // Catalog snapshots merge by ID; absence is never a deletion instruction.
  if (tableName === "clinic_additional_fees") {
    const { data: existing, error } = await supabase.from(tableName).select("id,data,updated_at");
    if (error) throw error;
    const byId = new Map((existing || []).map(row => [String(row.id), row]));
    for (const record of safeRecords) {
      const id = ensureId(record);
      const old = byId.get(String(id));
      if (old) {
        if (!(Date.parse(record.updatedAt) > Date.parse(old.data?.updatedAt || old.updated_at))) continue;
        const { error: updateError } = await supabase.from(tableName)
          .update({ data: { ...record, id }, updated_at: new Date().toISOString() })
          .eq("id", id).eq("updated_at", old.updated_at);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from(tableName).insert({ id, data: { ...record, id } });
        if (insertError && insertError.code !== '23505') throw insertError;
      }
    }
    return;
  }

  // Never delete all appointments during a snapshot save. A stale browser must
  // not reopen a completed visit or remove records missing from its snapshot.
  if (["clinic_appointments", "clinic_archived_appointments", "clinic_treatment_plans"].includes(tableName)) {
    const { data: existing, error } = await supabase.from(tableName).select("id,data,updated_at");
    if (error) throw error;
    const byId = new Map((existing || []).map(row => [String(row.id), row.data]));
    const { preserveCompletion } = require("./_appointments");
    const rows = safeRecords.map(record => {
      const id = ensureId(record);
      const data = require("./_payment-state").preservePaymentState(preserveCompletion({ ...record, id }, byId.get(id)), byId.get(id));
      const previousArrival = byId.get(id);
      for (const key of ['autoCancelled','lateArrivalAt','reinstatementHistory']) {
        if (previousArrival?.[key] !== undefined) data[key] = previousArrival[key]; else delete data[key];
      }
      if (previousArrival?.reinstatementHistory?.length && JSON.stringify(record.reinstatementHistory) !== JSON.stringify(previousArrival.reinstatementHistory)) {
        for (const key of ['status','lifecycleStatus','visitStatus','date','time','schedule','durationMinutes','endTime','cancelledAt']) data[key] = previousArrival[key];
      }
      // Arrival is written only by the staff check-in endpoint, never by snapshots.
      if (byId.get(id)?.arrivedAt) data.arrivedAt = byId.get(id).arrivedAt;
      else delete data.arrivedAt;
      Object.assign(record, data);
      return { id, data, updated_at: data.updatedAt || new Date().toISOString() };
    });
    for (const row of rows) {
      const previous = (existing || []).find(item => String(item.id) === row.id);
      if (previous) {
        const { sameAppointment: isDeepStrictEqual } = require('./_sync-records');
        if (isDeepStrictEqual(previous.data, row.data)) {
          Object.assign(safeRecords.find(record => String(record.id) === String(row.id)), previous.data);
          continue;
        }
        let query = supabase.from(tableName).update({ data: row.data, updated_at: row.updated_at }).eq("id", row.id);
        if (previous.updated_at) query = query.eq("updated_at", previous.updated_at);
        const { data: saved, error: writeError } = await query.select("id").maybeSingle();
        if (writeError) { writeError.appointmentId = row.id; throw writeError; }
        if (!saved) {
          const { data: latest, error: readError } = await supabase.from(tableName).select('id,data,updated_at').eq('id', row.id).maybeSingle();
          if (readError) throw readError;
          // Another request may already have saved exactly this change.
          if (latest && isDeepStrictEqual(latest.data, row.data)) {
            Object.assign(safeRecords.find(record => String(record.id) === String(row.id)), latest.data);
            continue;
          }
          const conflict = new Error("Appointment changed during synchronization. Your local changes are still saved on this device. Close other editing tabs and retry.");
          conflict.code = 'SYNC_CONFLICT';
          conflict.appointmentId = row.id;
          throw conflict;
        }
      } else {
        const { error: writeError } = await supabase.from(tableName).insert(row);
        if (writeError) { writeError.appointmentId = row.id; throw writeError; }
      }
    }
    return;
  }

  if (rawTableColumns[tableName]) {
    const rows = safeRecords.map((record) => buildRawRow(record, tableName));
    if (tableName === "services" && rows.length) {
      const { data, error } = await supabase.from("services").select("id,name,updated_at");
      if (error) throw error;
      const catalog = require('../Shared/service-catalog');
      for (const row of rows) {
        const existing = (data || []).find(saved => saved.id === row.id) ||
          (data || []).find(saved => catalog.key(saved.name) === catalog.key(row.name));
        if (existing) {
          if (!(Date.parse(row.updated_at) > Date.parse(existing.updated_at))) continue;
          const { error: updateError } = await supabase.from('services').update({ ...row, id: existing.id })
            .eq('id', existing.id).eq('updated_at', existing.updated_at);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from('services').insert(row);
          if (insertError && insertError.code !== '23505') throw insertError;
        }
      }
      return;
    }
    // Service names can map multiple legacy IDs onto one database ID.
    const rowsWithId = uniqueRecords(rows.filter((row) => row.id && isUuid(row.id)));
    const rowsWithoutId = rows.filter((row) => !row.id || !isUuid(row.id));
    const debugContext = {
      tableName,
      records: safeRecords.length,
      rowsWithId: rowsWithId.length,
      rowsWithoutId: rowsWithoutId.length
    };

    if (rowsWithId.length) {
      const { error } = await supabase.from(tableName).upsert(rowsWithId, { onConflict: 'id' });
      if (error) {
        if (isMissingSupabaseTable(error)) return;
        console.error(`[clinic-sync] raw upsert failed`, debugContext, { error });
        throw error;
      }
    }

    if (rowsWithoutId.length) {
      const { error } = await supabase.from(tableName).insert(rowsWithoutId);
      if (error) {
        if (isMissingSupabaseTable(error)) return;
        console.error(`[clinic-sync] raw insert failed`, debugContext, { error });
        throw error;
      }
    }

    return;
  }

  const attemptDelete = async (table) => {
    const { error } = await supabase
      .from(table)
      .delete()
      .not(keyColumn, "is", null);
    return error;
  };

  let deleteError = mergeOnly ? null : await attemptDelete(tableName);
  if (deleteError && isMissingSupabaseTable(deleteError) && fallbackTable) {
    deleteError = await attemptDelete(fallbackTable);
  }

  if (deleteError) {
    if (isMissingSupabaseTable(deleteError)) return;
    throw deleteError;
  }

  if (!safeRecords.length) return;

  const rows = uniqueRecords(safeRecords.map((record) => {
    const id = ensureId(record);
    return { [keyColumn]: id, data: { ...record, id } };
  }), keyColumn);

  const attemptUpsert = async (table) => {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: keyColumn });
    return error;
  };

  let upsertError = await attemptUpsert(tableName);
  if (upsertError && isMissingSupabaseTable(upsertError) && fallbackTable) {
    upsertError = await attemptUpsert(fallbackTable);
  }

  if (upsertError) {
    if (isMissingSupabaseTable(upsertError)) return;
    throw upsertError;
  }
}

function normalizeHistoryStatus(status = "") {
  const text = String(status || "").trim().toLowerCase();
  if (text === "completed") return "Completed";
  if (text === "cancelled" || text === "canceled") return "Cancelled";
  if (text === "rejected") return "Rejected";
  if (text === "archived") return "Archived";
  return String(status || "").trim();
}

function buildHistoryRecords(db = {}) {
  const rowsById = new Map();
  const sourceRows = [
    ...(Array.isArray(db.appointments) ? db.appointments : []),
    ...(Array.isArray(db.archivedAppointments) ? db.archivedAppointments : [])
  ];

  sourceRows.forEach((item) => {
    const status = normalizeHistoryStatus(item.status);
    const isHistory =
      ["Completed", "Cancelled", "Rejected", "Archived"].includes(status) ||
      item.archived === true ||
      item.archivedForDentist === true ||
      item.archivedForPatient === true;

    if (!isHistory) return;

    const id = ensureId(item);
    rowsById.set(id, {
      id,
      appointmentId: id,
      patientId: item.patientId || "",
      patientName: item.patientName || item.patient || "Unknown Patient",
      dentist: item.dentist || item.dentistName || "",
      service: item.service || "",
      schedule: item.schedule || [item.date, item.time].filter(Boolean).join(" "),
      date: item.date || "",
      time: item.time || "",
      status,
      paymentStatus: item.paymentStatus || "",
      total: Number(item.total ?? item.price ?? 0),
      paid: Number(item.paid ?? item.totalCollected ?? 0),
      archived: item.archived === true || item.archivedForDentist === true || item.archivedForPatient === true,
      archivedBy: item.archivedBy || "",
      archivedAt: item.archivedAt || "",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || item.archivedAt || item.createdAt || new Date().toISOString()
    });
  });

  return [...rowsById.values()].sort((a, b) =>
    new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  );
}

async function readClinicDbFromSupabase(collections = null) {
  const db = {
    appointments: [],
    archivedAppointments: [],
    patientClinicalNotes: [],
    treatmentPlans: [],
    rescheduleRequests: [],
    notifications: { admin: [], dentist: [], patient: [], staff: [] },
    dentists: [],
    staff: [],
    patients: [],
    dentistSchedules: [],
    services: [],
    additionalFees: [],
    payments: []
  };

  const notificationRead = collections ? Promise.resolve([]) : readJsonTable("notifications", "sync_key");
  await Promise.all(Object.entries(clinicTableMap).filter(([key]) => !collections || collections.includes(key)).map(async ([key, config]) => {
    db[key] = await readJsonTable(config.table, config.keyColumn, config.fallbackTable);
  }));

  db.appointments = db.appointments.filter(isUsableAppointment);
  db.archivedAppointments = db.archivedAppointments.filter(isUsableAppointment);

  const notificationsRows = await notificationRead;

  notificationTargets.forEach((target) => {
    db.notifications[target] = [];
  });

  (notificationsRows || []).forEach((row) => {
    const item = require('./_notifications').normalizeNotification(row);
    if (item) db.notifications[item.target].push(item);
  });

  return require("./_automatic-archive").applyAutomaticArchive(defaultAccounts.normalizeDb(db));
}

async function writeClinicDbToSupabase(db = {}, role = "") {
  require("./_automatic-archive").applyAutomaticArchive(db);
  db = require("./_admin-read-only").writableSnapshot(db, role);
  defaultAccounts.normalizeDb(db);
  // Validate discount changes against persisted records before writing any tables.
  if (Array.isArray(db.appointments) || Array.isArray(db.archivedAppointments)) {
    const appointmentRecords = [...(db.appointments || []), ...(db.archivedAppointments || [])];
    const { data: savedDiscountRows, error: discountReadError } = await supabase.from(clinicTableMap.appointments.table).select('id,data');
    if (discountReadError) throw discountReadError;
    const { data: archivedRows, error: archivedError } = await supabase.from(clinicTableMap.archivedAppointments.table).select('id,data');
    if (archivedError) throw archivedError;
    const savedDiscounts = new Map([...(savedDiscountRows || []), ...(archivedRows || [])].map(row => [String(row.id), row.data]));
    for (const record of appointmentRecords) require('./_refunds').validateRefunds(record, savedDiscounts.get(String(record.id)), role);
    const needsAssignmentCheck = appointmentRecords.some(record => role === 'staff' || JSON.stringify(record.dentistIds || []) !== JSON.stringify(savedDiscounts.get(String(record.id))?.dentistIds || []));
    if (needsAssignmentCheck) {
      const roster = defaultAccounts.merge(await readJsonTable(clinicTableMap.dentists.table, clinicTableMap.dentists.keyColumn), 'dentist');
      for (const record of appointmentRecords) require('./_appointment-assignment').validateAssignment(record, savedDiscounts.get(String(record.id)), role, roster);
    }
    const changedDiscounts = appointmentRecords.filter(record => JSON.stringify(record.discount || null) !== JSON.stringify(savedDiscounts.get(String(record.id))?.discount || null));
    if (changedDiscounts.length) {
      const dentists = defaultAccounts.merge(await readJsonTable(clinicTableMap.dentists.table, clinicTableMap.dentists.keyColumn), 'dentist');
      for (const record of changedDiscounts) require('./_discounts').validateDiscount(record, savedDiscounts.get(String(record.id)), role, dentists);
    }
  }
  const historyRecords = buildHistoryRecords(db);

  // Check reviews before any table is written, so an unauthorized approval
  // cannot partially save other parts of the submitted snapshot.
  if (!['admin', 'staff'].includes(role)) {
    const { validateCashReview } = require('./_cash-payments');
    for (const key of ['appointments', 'treatmentPlans']) {
      const records = db[key];
      if (!Array.isArray(records)) continue;
      const { data: saved, error } = await supabase.from(clinicTableMap[key].table).select('id,data');
      if (error) throw error;
      const byId = new Map((saved || []).map(row => [String(row.id), row.data]));
      for (const record of records) {
        Object.assign(record, require('./_payment-state').preservePaymentState(record, byId.get(String(record.id))));
        validateCashReview(record, byId.get(String(record.id)), role);
      }
    }
  }

  for (const [key, config] of Object.entries(clinicTableMap)) {
    if (role === "patient" && !["appointments","archivedAppointments","treatmentPlans","rescheduleRequests","history"].includes(key)) continue;
    if (role === "dentist" && !["appointments", "archivedAppointments", "patientClinicalNotes", "treatmentPlans", "rescheduleRequests", "history"].includes(key)) continue;
    if (key === "additionalFees" && role !== "admin") continue;
    if (key === "services" && role !== "admin") continue;
    if (!config.derived && !Object.prototype.hasOwnProperty.call(db, key)) continue;
    if (config.derived && (!Array.isArray(db.appointments) || !Array.isArray(db.archivedAppointments))) continue;
    const records = config.derived ? historyRecords : db[key];
    await replaceJsonTable(config.table, records, config.keyColumn, config.fallbackTable, ["dentist","patient"].includes(role));
  }

  if (!Object.prototype.hasOwnProperty.call(db, "notifications")) return;
  const notifications = db.notifications || {};
  const rows = [];
  notificationTargets.forEach((target) => {
    const list = Array.isArray(notifications[target]) ? notifications[target] : [];
    list.forEach((item) => {
      item = require('./_notifications').normalizeNotification(item, target);
      if (!item) return;
      const id = ensureId(item);
      rows.push({
        id,
        target,
        ...item,
        createdAt: item.createdAt || item.created_at || new Date().toISOString()
      });
    });
  });

  if (rawTableColumns.notifications) {
    const rawRows = require('./_sync-records').uniqueRecords(rows.map((record) => buildRawRow(record, "notifications")).filter(Boolean));
    // Postgres rejects an unfiltered DELETE ("DELETE requires a WHERE clause"),
    // so match every row explicitly the same way the keyed tables above do.
    const { error: deleteError } = ["dentist","patient"].includes(role) ? {} : await supabase
      .from("notifications")
      .delete()
      .not("id", "is", null);
    if (deleteError) {
      if (isMissingSupabaseTable(deleteError)) return;
      throw deleteError;
    }
    if (rawRows.length) {
      const { error } = await supabase.from("notifications").upsert(rawRows, { onConflict: "id" });
      if (error) {
        if (isMissingSupabaseTable(error)) return;
        throw error;
      }
    }
    return;
  }

  const { error: deleteError } = ["dentist","patient"].includes(role) ? {} : await supabase
    .from("notifications")
    .delete()
    .not("sync_key", "is", null);

  if (deleteError) {
    if (isMissingSupabaseTable(deleteError)) return;
    throw deleteError;
  }

  if (rows.length) {
    const { error } = await supabase
      .from("notifications")
      .upsert(require('./_sync-records').uniqueRecords(rows, 'sync_key'), { onConflict: "sync_key" });

    if (error) {
      if (isMissingSupabaseTable(error)) return;
      throw error;
    }
  }
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

async function sendVerificationEmail(name, email, otp) {
  const safeOtp = String(otp || "").trim();

  await mailer.sendMail({
    from: `"Dental System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your G-M Dental verification code: ${safeOtp}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Verification Code</title>
      </head>
      <body style="margin:0; padding:0; background:#eef4fb; font-family:Arial, Helvetica, sans-serif; color:#16324f;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef4fb; margin:0; padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:760px; background:#ffffff; border-radius:26px; overflow:hidden; box-shadow:0 18px 50px rgba(15, 43, 77, 0.12);">

                <!-- HEADER -->
                <tr>
                  <td style="
                    background:
                      linear-gradient(135deg, #081f4d 0%, #0d2f73 60%, #123d8d 100%);
                    padding:34px 38px 26px 38px;
                    color:#ffffff;
                    position:relative;
                  ">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="left" style="vertical-align:top;">
                          <div style="font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#d7e7ff; font-weight:700;">
                            G-M Dental Clinic
                          </div>
                          <div style="font-size:34px; line-height:1.15; font-weight:800; margin-top:10px;">
                            Your Verification Code
                          </div>
                          <div style="font-size:15px; line-height:1.7; color:#dbe8ff; margin-top:12px; max-width:460px;">
                            Enter this code on the registration page to activate your dental appointment account.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- HERO CARD -->
                <tr>
                  <td style="padding:34px 34px 18px 34px; background:#ffffff;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="
                      background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
                      border:1px solid #e3edf8;
                      border-radius:22px;
                      box-shadow:0 10px 28px rgba(16, 43, 78, 0.06);
                    ">
                      <tr>
                        <td style="padding:34px 30px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td align="center" style="padding-bottom:18px;">
                                <div style="
                                  width:84px;
                                  height:84px;
                                  line-height:84px;
                                  text-align:center;
                                  font-size:36px;
                                  border-radius:50%;
                                  background:#edf4ff;
                                  color:#1d4ed8;
                                  display:inline-block;
                                ">
                                  🔐
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="font-size:30px; line-height:1.2; font-weight:800; color:#102a4d; padding-bottom:10px;">
                                Welcome, ${name}!
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="font-size:16px; line-height:1.8; color:#58708d; padding:0 6px 8px 6px;">
                                Thank you for registering at <strong style="color:#17365c;">Ganal-Mappala Dental Clinic</strong>.<br>
                                Use the one-time code below to verify your email address.
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding:26px 0 18px 0;">
                                <div style="
                                  display:inline-block;
                                  background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%);
                                  color:#ffffff;
                                  font-size:38px;
                                  font-weight:800;
                                  letter-spacing:10px;
                                  padding:18px 34px;
                                  border-radius:14px;
                                  box-shadow:0 14px 30px rgba(37, 99, 235, 0.28);
                                  font-family: 'Courier New', Courier, monospace;
                                ">
                                  ${safeOtp}
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="font-size:13px; line-height:1.7; color:#7a8ea8;">
                                This code is valid for a limited time and only for your account.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- INSTRUCTIONS -->
                <tr>
                  <td style="padding:8px 34px 8px 34px; background:#ffffff;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="
                      border:1px solid #e4edf7;
                      border-radius:18px;
                      background:#fbfdff;
                    ">
                      <tr>
                        <td style="padding:22px 24px;">
                          <div style="font-size:15px; font-weight:700; color:#17365c; margin-bottom:10px;">
                            How to verify
                          </div>
                          <div style="font-size:14px; line-height:1.8; color:#5e7692;">
                            1. Go back to the Ganal-Mappala Dental Clinic registration page.<br>
                            2. Type the 6-digit code shown above into the verification field.<br>
                            3. Click <strong>Verify Account</strong> to complete your registration.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- FEATURES -->
                <tr>
                  <td style="padding:24px 34px 10px 34px; background:#ffffff;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="33.33%" style="padding:10px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="
                            border:1px solid #e6eef8;
                            border-radius:18px;
                            background:#f9fbff;
                          ">
                            <tr>
                              <td align="center" style="padding:22px 14px;">
                                <div style="font-size:26px; margin-bottom:8px;">🔒</div>
                                <div style="font-size:15px; font-weight:700; color:#17365c; margin-bottom:6px;">Secure Access</div>
                                <div style="font-size:13px; line-height:1.7; color:#6a8099;">Your account verification helps protect your information.</div>
                              </td>
                            </tr>
                          </table>
                        </td>

                        <td width="33.33%" style="padding:10px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="
                            border:1px solid #e6eef8;
                            border-radius:18px;
                            background:#f9fbff;
                          ">
                            <tr>
                              <td align="center" style="padding:22px 14px;">
                                <div style="font-size:26px; margin-bottom:8px;">📅</div>
                                <div style="font-size:15px; font-weight:700; color:#17365c; margin-bottom:6px;">Easy Booking</div>
                                <div style="font-size:13px; line-height:1.7; color:#6a8099;">Manage appointments faster once your account is active.</div>
                              </td>
                            </tr>
                          </table>
                        </td>

                        <td width="33.33%" style="padding:10px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="
                            border:1px solid #e6eef8;
                            border-radius:18px;
                            background:#f9fbff;
                          ">
                            <tr>
                              <td align="center" style="padding:22px 14px;">
                                <div style="font-size:26px; margin-bottom:8px;">🦷</div>
                                <div style="font-size:15px; font-weight:700; color:#17365c; margin-bottom:6px;">Premium Care</div>
                                <div style="font-size:13px; line-height:1.7; color:#6a8099;">Your smile and comfort remain our top priority.</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="
                    background:linear-gradient(135deg, #081a3b 0%, #0c2858 100%);
                    padding:28px 34px 34px 34px;
                    color:#d8e6ff;
                  ">
                    <div style="font-size:18px; font-weight:700; color:#ffffff; margin-bottom:8px;">
                      Ganal-Mappala Dental Clinic
                    </div>
                    <div style="font-size:14px; line-height:1.8; color:#c7d8f7; margin-bottom:14px;">
                      Thank you for trusting our clinic. We’re excited to welcome you.
                    </div>
                    <div style="font-size:12px; line-height:1.8; color:#aebfdf;">
                      This verification email was sent to ${email}. If you did not create this account, you may safely ignore this message.
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isStrongPassword(password = "") {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

async function sendPasswordResetEmail(name, email, otp) {
  const safeOtp = String(otp || "").trim();
  const safeName = escapeEmailHtml(name || "User");

  await mailer.sendMail({
    from: `"Dental System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your G-M Dental password reset code: ${safeOtp}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /></head>
      <body style="margin:0; padding:0; background:#eef4fb; font-family:Arial, Helvetica, sans-serif; color:#16324f;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef4fb; margin:0; padding:32px 16px;">
          <tr><td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 18px 50px rgba(15, 43, 77, 0.12);">
              <tr>
                <td style="background:linear-gradient(135deg, #7c2d12 0%, #b45309 60%, #d97706 100%); padding:30px 32px; color:#ffffff;">
                  <div style="font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#fde68a; font-weight:700;">G-M Dental Clinic</div>
                  <div style="font-size:28px; line-height:1.2; font-weight:800; margin-top:8px;">Password Reset Code</div>
                  <div style="font-size:14px; line-height:1.7; color:#fef3c7; margin-top:10px;">
                    Use the one-time code below to reset your account password.
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 14px; font-size:16px;">Hi ${safeName},</p>
                  <p style="margin:0 0 22px; font-size:15px; line-height:1.7; color:#5e7692;">
                    We received a request to reset the password for your G-M Dental account. Enter this 6-digit code on the reset page to choose a new password.
                  </p>
                  <div style="text-align:center; padding:18px 0 22px 0;">
                    <div style="display:inline-block; background:linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%); color:#ffffff; font-size:36px; font-weight:800; letter-spacing:10px; padding:18px 32px; border-radius:14px; box-shadow:0 14px 30px rgba(217, 119, 6, 0.28); font-family:'Courier New', Courier, monospace;">
                      ${safeOtp}
                    </div>
                  </div>
                  <p style="margin:0 0 8px; font-size:13px; line-height:1.7; color:#7a8ea8; text-align:center;">
                    This code expires in 15 minutes.
                  </p>
                  <div style="margin-top:22px; padding:16px 18px; border-radius:14px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:13px; line-height:1.7;">
                    If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background:#081a3b; padding:20px 32px; color:#c7d8f7; font-size:12px; line-height:1.7;">
                  This password reset email was sent to ${email} by Ganal-Mappala Dental Clinic.
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });
}

async function updateUserPasswordByEmail(email, hashedPassword) {
  if (!supabase) {
    const target = users.find((u) => u.email.toLowerCase() === email);
    if (!target) return false;
    target.password = hashedPassword;
    return true;
  }

  const { error } = await supabase
    .from("users")
    .update({ password: hashedPassword })
    .eq("email", email);

  if (error) {
    if (isMissingSupabaseTable(error)) {
      const target = users.find((u) => u.email.toLowerCase() === email);
      if (!target) return false;
      target.password = hashedPassword;
      return true;
    }
    throw error;
  }
  return true;
}

function escapeEmailHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeReminderTime(time = "") {
  const text = String(time || "").trim();
  if (!text) return "";

  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  const twelveHour = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] || "0");
    const meridiem = twelveHour[3].toUpperCase();
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      if (meridiem === "PM" && hour < 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return "";
}

function parseReminderSchedule(appointment = {}) {
  let date = String(appointment.date || "").trim();
  let time = normalizeReminderTime(appointment.time || appointment.timeDisplay || "");

  if ((!date || !time) && appointment.schedule) {
    const parts = String(appointment.schedule)
      .split(/\s*\u2022\s*|\s+-\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (!date && parts[0]) date = parts[0];
    if (!time && parts[1]) time = normalizeReminderTime(parts[1]);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) return null;

  const scheduledAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(scheduledAt.getTime())) return null;

  return { date, time, scheduledAt };
}

function formatReminderDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatReminderTime(time24) {
  const [hourText, minute = "00"] = String(time24 || "").split(":");
  let hour = Number(hourText);
  if (Number.isNaN(hour)) return time24 || "";
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute.padStart(2, "0")} ${meridiem}`;
}

function isReminderEligibleStatus(status = "") {
  const normalized = String(status || "").trim().toLowerCase();
  return ["approved", "confirmed", "paid", "upcoming", "ongoing", "in progress", "reschedule rejected"].includes(normalized);
}

function findPatientEmail(appointment = {}, patients = []) {
  const directEmail = appointment.patientEmail || appointment.email;
  if (isValidEmail(directEmail)) return String(directEmail).trim();

  const patientId = String(appointment.patientId || "").trim();
  const patientName = String(appointment.patientName || appointment.patient || "").trim().toLowerCase();
  const match = (Array.isArray(patients) ? patients : []).find((patient) => {
    const sameId = patientId && String(patient.id || patient.patientId || "").trim() === patientId;
    const sameName = patientName && String(patient.name || patient.patientName || patient.patient || "").trim().toLowerCase() === patientName;
    return sameId || sameName;
  });

  return isValidEmail(match?.email) ? String(match.email).trim() : "";
}

function reminderScheduleKey(appointment = {}, schedule = {}) {
  return [
    appointment.id || appointment.appointmentId || "",
    schedule.date || "",
    schedule.time || "",
    schedule.patientEmail || appointment.patientEmail || appointment.email || ""
  ].join("|");
}

async function sendAppointmentReminderEmail(appointment, patientEmail, schedule, reminderType) {
  const patientName = escapeEmailHtml(appointment.patientName || appointment.patient || "Patient");
  const service = escapeEmailHtml(appointment.service || "your dental appointment");
  const dentist = escapeEmailHtml(appointment.dentist || appointment.dentistName || "");
  const dateText = formatReminderDate(schedule.scheduledAt);
  const timeText = formatReminderTime(schedule.time);
  const leadText = reminderType === "dayBefore"
    ? "This is a friendly reminder that your appointment is scheduled for tomorrow."
    : "This is a friendly reminder that your appointment is scheduled in about 3 hours.";

  await mailer.sendMail({
    from: `"G-M Dental Clinic" <${process.env.EMAIL_USER}>`,
    to: patientEmail,
    subject: `Appointment Reminder: ${service} on ${dateText}`,
    html: `
      <div style="font-family:Arial, Helvetica, sans-serif; background:#eef4fb; padding:28px; color:#16324f;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #dfeaf7;">
          <div style="background:#0d2f73; color:#ffffff; padding:24px 28px;">
            <div style="font-size:13px; letter-spacing:1.5px; text-transform:uppercase; color:#d7e7ff; font-weight:700;">G-M Dental Clinic</div>
            <h1 style="margin:10px 0 0; font-size:26px; line-height:1.25;">Appointment Reminder</h1>
          </div>
          <div style="padding:28px;">
            <p style="font-size:16px; line-height:1.7; margin:0 0 16px;">Hello ${patientName},</p>
            <p style="font-size:15px; line-height:1.7; margin:0 0 22px;">${leadText}</p>
            <div style="background:#f8fbff; border:1px solid #e5edf8; border-radius:14px; padding:18px 20px; margin-bottom:22px;">
              <div style="font-size:14px; color:#5e7692; margin-bottom:8px;">Service</div>
              <div style="font-size:18px; font-weight:700; margin-bottom:16px;">${service}</div>
              <div style="font-size:14px; color:#5e7692; margin-bottom:8px;">Schedule</div>
              <div style="font-size:18px; font-weight:700;">${dateText} at ${timeText}</div>
              ${dentist ? `<div style="font-size:14px; color:#5e7692; margin-top:16px;">Dentist</div><div style="font-size:16px; font-weight:700;">${dentist}</div>` : ""}
            </div>
            <p style="font-size:14px; line-height:1.7; color:#5e7692; margin:0;">
              Please arrive on time. If you need help with your appointment, contact the clinic directly.
            </p>
          </div>
        </div>
      </div>
    `
  });
}

async function processAppointmentEmailReminders(sourceDb = null, options = {}) {
  const shouldPersist = options.persist !== false;
  if (!sourceDb && !supabase) return { sent: 0, db: sourceDb || null };

  const db = sourceDb || await readClinicDbFromSupabase();
  if (!db || typeof db !== "object") return { sent: 0, db: sourceDb || null };
  const appointments = Array.isArray(db.appointments) ? db.appointments : [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let sent = 0;

  for (const appointment of appointments) {
    if (!appointment || appointment.archived || !isReminderEligibleStatus(appointment.status || appointment.lifecycleStatus)) continue;

    const schedule = parseReminderSchedule(appointment);
    if (!schedule) continue;

    const patientEmail = findPatientEmail(appointment, db.patients);
    if (!patientEmail) continue;

    const msUntilAppointment = schedule.scheduledAt.getTime() - now.getTime();
    if (msUntilAppointment <= 0) continue;

    const scheduleDayStart = new Date(
      schedule.scheduledAt.getFullYear(),
      schedule.scheduledAt.getMonth(),
      schedule.scheduledAt.getDate()
    );
    const daysUntilAppointment = Math.round(
      (scheduleDayStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)
    );

    const rawSentState = appointment.reminderEmailsSent && typeof appointment.reminderEmailsSent === "object"
      ? appointment.reminderEmailsSent
      : {};
    const scheduleKey = reminderScheduleKey(appointment, { ...schedule, patientEmail });
    const sentState = rawSentState.scheduleKey && rawSentState.scheduleKey !== scheduleKey ? {} : rawSentState;

    let reminderType = "";
    if (daysUntilAppointment === 0 && msUntilAppointment <= 3 * 60 * 60 * 1000 && !sentState.threeHoursBefore) {
      reminderType = "threeHoursBefore";
    } else if (daysUntilAppointment === 1 && !sentState.dayBefore) {
      reminderType = "dayBefore";
    }

    if (!reminderType) continue;

    appointment.reminderEmailsSent = { ...sentState, scheduleKey };

    try {
      await sendAppointmentReminderEmail(appointment, patientEmail, schedule, reminderType === "dayBefore" ? "dayBefore" : "threeHoursBefore");
    } catch (error) {
      // Preserve markers for earlier successful sends before aborting a batch.
      if (sent > 0 && shouldPersist && supabase) await writeClinicDbToSupabase(db);
      throw error;
    }
    appointment.reminderEmailsSent[reminderType] = new Date().toISOString();
    appointment.updatedAt = new Date().toISOString();
    sent += 1;
  }

  if (sent > 0 && shouldPersist && supabase) {
    await writeClinicDbToSupabase(db);
  }

  return { sent, db };
}

let reminderScanInProgress = false;

async function runAppointmentReminderScan(sourceDb = null) {
  if (reminderScanInProgress) return;
  reminderScanInProgress = true;
  try {
    const result = await processAppointmentEmailReminders(sourceDb, { persist: !sourceDb });
    if (result.sent) {
      console.log(`Appointment reminder emails sent: ${result.sent}`);
    }
  } catch (error) {
    console.error("Appointment reminder scan error:", error.message || error);
  } finally {
    reminderScanInProgress = false;
  }
}

// ==============================
// REGISTER
// ==============================
app.post("/register", async (req, res) => {
  try {
    let { name, email, password, sex, dob, mobile, address } = req.body || {};

    name = String(name || "").trim();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");
    sex = String(sex || "");
    dob = String(dob || "");
    mobile = String(mobile || "").trim();
    address = String(address || "").trim();

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    const nameError = require('../Shared/name-validation').validate(name);
    if (nameError) return res.status(400).json({ message: nameError });
    if (!/^[0-9]{1,12}$/.test(mobile)) {
      return res.status(400).json({ message: "Contact number must contain numbers only, maximum 12 digits." });
    }
    if (!address || address.length > 300) {
      return res.status(400).json({ message: "Enter an address of up to 300 characters." });
    }
    if (!isValidEmail(email) || !isStrongPassword(password)) {
      return res.status(400).json({ message: "Enter a valid email and a password with at least 8 characters, uppercase, lowercase, a number, and a special character." });
    }

    const verifiedUser = await findVerifiedUserByEmail(email);

    if (verifiedUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const existingPending = await findPendingUserByEmail(email);

    mailer.available();

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateOtp();

    if (existingPending) {
      existingPending.name = name;
      existingPending.password = hashedPassword;
      existingPending.sex = sex;
      existingPending.dob = dob;
      existingPending.mobile = mobile;
      existingPending.address = address;
      existingPending.verificationToken = verificationToken;

      await upsertPendingUser(existingPending);
      await sendVerificationEmail(name, email, verificationToken);

      return res.status(200).json({
        message: "Verification email resent. Please check your inbox.",
        email
      });
    }

    const pendingUser = {
      id: crypto.randomUUID(),
      name,
      email,
      password: hashedPassword,
      sex,
      dob,
      mobile,
      address,
      role: "patient",
      isVerified: false,
      verificationToken
    };

    await upsertPendingUser(pendingUser);
    await sendVerificationEmail(name, email, verificationToken);

    return res.status(201).json({
      message: "Registration successful. Verification email sent.",
      email
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error.code === 'EMAIL_COOLDOWN' || error.code === 'EAUTH' || Number(error.responseCode) === 454) {
      res.set('Retry-After', String(error.retryAfter || 900));
      return res.status(503).json({ message: "Our verification email service is temporarily unavailable. Your account is not verified yet. Please wait before trying again or contact the clinic." });
    }
    return res.status(500).json({
      message: "Could not send verification email. Please try again."
    });
  }
});

// ==============================
// VERIFY EMAIL
// ==============================
async function handleVerifyEmail(req, res) {
  try {
    const token = Array.isArray(req.query.token)
      ? req.query.token[0]
      : req.query.token || req.query.v || req.params.token || "";
    const normalizedToken = String(token || "").trim();

    if (!normalizedToken) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verification Link</title>
        </head>
        <body>
          <h2>Invalid or expired verification link.</h2>
          <p>Please open the newest verification email and click the full verification button.</p>
          <script>
            (function () {
              var params = new URLSearchParams(window.location.search || "");
              var hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
              var recoveredToken = params.get("token") || params.get("v") || hashParams.get("token") || hashParams.get("v");

              if (recoveredToken) {
                window.location.replace("/verify-email/" + encodeURIComponent(recoveredToken.trim()));
              }
            })();
          </script>
        </body>
        </html>
      `);
    }

    const { user: pendingUser, index: pendingIndex } = await findPendingUserByToken(normalizedToken);

    if (!pendingUser) {
      return res.status(400).send(`
        <h2>Invalid or expired verification link.</h2>
        <p>Please request a new verification email, then use the latest link from your inbox.</p>
      `);
    }

    const verifiedUser = await verifyPendingUser(pendingUser, pendingIndex);

    return res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email Verified</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: Arial, Helvetica, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 30%),
          radial-gradient(circle at bottom right, rgba(14,165,233,0.16), transparent 30%),
          linear-gradient(180deg, #eef4fb 0%, #e9f1fb 100%);
        color: #16324f;
      }

      .verify-wrap {
        width: 100%;
        max-width: 560px;
        background: #ffffff;
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(16, 42, 77, 0.14);
        border: 1px solid #dfeaf7;
      }

      .verify-header {
        padding: 32px 34px;
        background: linear-gradient(135deg, #081f4d 0%, #123d8d 100%);
        color: #ffffff;
      }

      .verify-header h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.2;
      }

      .verify-header p {
        margin: 10px 0 0;
        color: #d6e5ff;
        line-height: 1.7;
      }

      .verify-body {
        padding: 36px 34px 34px;
        text-align: center;
      }

      .icon {
        width: 92px;
        height: 92px;
        margin: 0 auto 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #dcfce7, #ecfdf5);
        color: #16a34a;
        font-size: 42px;
        box-shadow: 0 12px 28px rgba(22,163,74,0.14);
      }

      .verify-body h2 {
        margin: 0 0 12px;
        font-size: 28px;
        color: #102a4d;
      }

      .verify-body p {
        margin: 0 0 12px;
        font-size: 15px;
        line-height: 1.8;
        color: #5e7692;
      }

      .email-pill {
        display: inline-block;
        margin-top: 10px;
        padding: 12px 16px;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        font-weight: 700;
        word-break: break-word;
      }

      .note {
        margin-top: 22px;
        padding: 16px 18px;
        border-radius: 16px;
        background: #f8fbff;
        border: 1px solid #e5edf8;
        color: #6a8099;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="verify-wrap">
      <div class="verify-header">
        <h1>Email Successfully Verified</h1>
        <p>Your account has been confirmed. You may now return to the system and log in.</p>
      </div>

      <div class="verify-body">
        <div class="icon">✔</div>
        <h2>Welcome to G-M Dental</h2>
        <p>Your email has been verified successfully.</p>
        <div class="email-pill">${escapeEmailHtml(verifiedUser.email)}</div>
        <div class="note">
          You can now close this page and continue logging in to your account.
        </div>
      </div>
    </div>
  </body>
  </html>
`);
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).send("<h2>Server error during verification.</h2>");
  }
}

app.get("/verify-email", handleVerifyEmail);
app.get("/verify-email/:token", handleVerifyEmail);

// ==============================
// VERIFICATION STATUS
// ==============================
app.get("/verification-status", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const verifiedUser = await findVerifiedUserByEmail(email);

    if (verifiedUser) {
      return res.json({
        verified: true,
        registered: true,
        email
      });
    }

    const pendingUser = await findPendingUserByEmail(email);

    if (pendingUser) {
      return res.json({
        verified: false,
        registered: false,
        pending: true,
        email
      });
    }

    return res.json({
      verified: false,
      registered: false,
      pending: false,
      email
    });
  } catch (error) {
    console.error("Verification status error:", error);
    return res.status(500).json({
      message: "Server error checking verification status."
    });
  }
});

// ==============================
// VERIFY OTP
// ==============================
app.post("/verify-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and verification code are required." });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Verification code must be 6 digits." });
    }

    const alreadyVerified = await findVerifiedUserByEmail(email);
    if (alreadyVerified) {
      return res.json({ message: "Email is already verified.", verified: true, email });
    }

    const pendingUser = await findPendingUserByEmail(email);
    if (!pendingUser) {
      return res.status(404).json({ message: "No pending registration found for this email." });
    }

    if (String(pendingUser.verificationToken || "").trim() !== otp) {
      return res.status(400).json({ message: "Invalid verification code." });
    }

    const pendingIndex = supabase
      ? -1
      : pendingUsers.findIndex((u) => u.email.toLowerCase() === email);

    await verifyPendingUser(pendingUser, pendingIndex);

    return res.json({ message: "Email verified successfully.", verified: true, email });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ message: "Server error during verification." });
  }
});

// ==============================
// FORGOT PASSWORD (request OTP)
// ==============================
app.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const user = await findVerifiedUserByEmail(email);

    if (!user) {
      return res.status(200).json({
        message: "If an account exists with this email, a reset code was sent.",
        email
      });
    }

    const otp = generateOtp();
    await saveResetCode(email, {
      otpHash: await bcrypt.hash(otp, 10),
      attempts: 0,
      expiresAt: Date.now() + PASSWORD_RESET_TTL_MS
    });

    await sendPasswordResetEmail(user.name || "User", email, otp);

    return res.json({
      message: "Password reset code sent. Please check your inbox.",
      email
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: "Could not send password reset email. Please try again."
    });
  }
});

// ==============================
// RESET PASSWORD (verify OTP + set new password)
// ==============================
app.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, code, and new password are required." });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Verification code must be 6 digits." });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters with uppercase, lowercase, a number, and a special character."
      });
    }

    const entry = await readResetCode(email);

    if (!entry || entry.purpose === 'account-change') {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }

    if (Date.now() > entry.expiresAt) {
      await saveResetCode(email, null);
      return res.status(400).json({ message: "Reset code has expired. Please request a new one." });
    }

    if ((entry.attempts || 0) >= 5) {
      await saveResetCode(email, null);
      return res.status(400).json({ message: "Too many attempts. Please request a new reset code." });
    }
    if (!entry.otpHash || !(await bcrypt.compare(otp, entry.otpHash))) {
      entry.attempts = (entry.attempts || 0) + 1;
      await saveResetCode(email, entry);
      return res.status(400).json({ message: "Invalid reset code." });
    }

    const user = await findVerifiedUserByEmail(email);
    if (!user) {
      await saveResetCode(email, null);
      return res.status(404).json({ message: "Account not found for this email." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await updateUserPasswordByEmail(email, hashedPassword);

    if (!updated) {
      return res.status(500).json({ message: "Could not update password. Please try again." });
    }

    await saveResetCode(email, null);

    return res.json({
      message: "Password reset successful. You can now log in with your new password.",
      email
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Server error during password reset." });
  }
});

// ==============================
// LOGIN
// ==============================
app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};

    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    const user = await findVerifiedUserByEmail(email);

    if (!user || user.archived || user.mergedInto) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.json({
      message: "Login successful.",
      sessionToken: sessions.issue(user),
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login." });
  }
});

const account = require('./_account').createAccountHandlers({
  findUser: findVerifiedUserByEmail, readCode: readResetCode, publicUser, sessions,
  strongPassword: isStrongPassword,
  async saveCode(email, entry, previous) {
    if (!supabase) {
      if (JSON.stringify(passwordResetCodes.get(email) || null) !== JSON.stringify(previous || null)) return false;
      await saveResetCode(email, entry);
      return true;
    }
    let query = supabase.from('users').update({ verification_token: entry ? `reset:${JSON.stringify(entry)}` : null })
      .eq('email', email).eq('is_verified', true);
    query = previous ? query.eq('verification_token', `reset:${JSON.stringify(previous)}`) : query.is('verification_token', null);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    return !!data;
  },
  async commit(user, changes, entry) {
    if (!supabase) {
      const target = users.find(item => item.email === user.email && item.password === user.password);
      if (!target || (entry && JSON.stringify(passwordResetCodes.get(user.email)) !== JSON.stringify(entry))) return null;
      Object.assign(target, changes);
      if ('profile_title' in changes) target.profileTitle = changes.profile_title;
      if (entry) passwordResetCodes.delete(user.email);
      return target;
    }
    let query = supabase.from('users').update(changes).eq('email', user.email).eq('password', user.password).eq('is_verified', true);
    if (entry) query = query.eq('verification_token', `reset:${JSON.stringify(entry)}`);
    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw error;
    return fromDbUser(data);
  },
  sendCode(user, otp) {
    if (!String(process.env.EMAIL_USER || '').trim() || !String(process.env.EMAIL_PASS || '').trim()) {
      const error = new Error('Email delivery is not configured.');
      error.code = 'EMAIL_NOT_CONFIGURED';
      throw error;
    }
    return mailer.sendMail({ from: `"Dental System" <${process.env.EMAIL_USER}>`, to: user.email,
      subject: 'Verify your password change',
      text: `Your G-M Dental password change code is ${otp}. It expires in 10 minutes. Enter it along with your current password in Account Settings. If you did not request this, do not share the code.` });
  }
});
app.post('/api/account/verification-code', account.requestCode);
app.post('/api/account/verify-password', account.verifyPassword);
app.patch('/api/account', account.update);

// ==============================
// ADMIN USER CREATION
// ==============================
const dentistInvitations = require('./_dentist-invitations').createDentistInvitations({
  async read(email) {
    if (!supabase) throw new Error('Database unavailable');
    const {data,error}=await supabase.from('users').select('*').eq('email',email).maybeSingle();
    if(error) throw error;
    return data;
  },
  async savePending(invite, old) {
    const row={...toDbUser({id:invite.id,email:invite.email,name:`Invited ${invite.role}`,role:invite.role,password:invite.password,isVerified:false}),verification_token:invite.marker};
    const query=old ? supabase.from('users').update(row).eq('id',old.id).eq('is_verified',false).eq('verification_token',old.verification_token) : supabase.from('users').insert(row);
    const {data,error}=await query.select('id').maybeSingle();
    if(error) throw error;
    return data;
  },
  async complete(old, fields) {
    const row={...toDbUser({...fields,id:old.id,email:old.email,role:fields.role,isVerified:true}),verification_token:null};
    const {data,error}=await supabase.from('users').update(row).eq('id',old.id).eq('is_verified',false).eq('verification_token',old.verification_token).select('id').maybeSingle();
    if(error) throw error;
    return data;
  },
  hashPassword: password => bcrypt.hash(password,10),
  sendMail: message => mailer.sendMail(message),
  from: `"G-M Dental Clinic" <${process.env.EMAIL_USER}>`,
  setupUrl: 'https://gm-dental-smoky.vercel.app/Landing/dentist-setup.html'
});
app.post('/api/admin/users/invite-dentist', dentistInvitations.invite);
app.post('/api/dentist-invitations/accept', dentistInvitations.accept);
// Password emailing is replaced by dentist-owned setup.
app.post('/api/admin/users/send-dentist-credentials', (_req,res) => res.status(410).json({message:'Use Send dentist invitation. The dentist now sets their own password.'}));

app.post("/api/admin/users", async (req, res) => {
  try {
    let { role, name, email, password, mobile, contact, address } = req.body || {};

    role = String(role || "dentist").trim().toLowerCase();
    name = String(name || "").trim();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");
    mobile = String(mobile || contact || "").trim();
    address = String(address || "").trim();

    const allowedRoles = new Set(["admin", "dentist", "staff", "patient"]);

    if (!allowedRoles.has(role)) {
      return res.status(400).json({ message: "Invalid role selected." });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const existingUser = await findVerifiedUserByEmail(email);
    const pendingUser = await findPendingUserByEmail(email);

    if (existingUser || pendingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const user = {
      id: crypto.randomUUID(),
      role,
      name,
      email,
      password: await bcrypt.hash(password, 10),
      mobile,
      address,
      isVerified: true
    };

    if (!supabase) {
      users.push(user);
      console.warn(`[admin/users] Supabase not configured — user ${email} stored in memory only.`);
      return res.status(201).json({
        message: "User account created (in-memory; Supabase not configured).",
        user: publicUser(user),
        persisted: "memory"
      });
    }

    const row = toDbUser(user);
    const selectCols = usersHasRoleColumn
      ? "id,email,role,is_verified,condition"
      : "id,email,is_verified,condition";
    const { data: inserted, error } = await supabase
      .from("users")
      .insert(row)
      .select(selectCols)
      .single();

    if (error) {
      console.error(`[admin/users] Supabase insert failed for ${email}:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === "23505") {
        return res.status(409).json({ message: "Email is already registered." });
      }
      if (error.code === "42501" || /row-level security|permission denied/i.test(error.message || "")) {
        return res.status(500).json({
          message: "Supabase blocked the insert (row-level security). Use the service-role key in SUPABASE_SERVICE_ROLE_KEY or add an insert policy on public.users.",
          code: error.code
        });
      }
      if (isMissingSupabaseTable(error)) {
        const isRoleColumnIssue = /role/i.test(error.message || "");
        return res.status(500).json({
          message: isRoleColumnIssue
            ? "Supabase is missing the 'role' column on public.users. Open the Supabase Dashboard → SQL Editor and run the SQL in HTML/Landing/supabase/migrations/20260513120000_users_rls_policies.sql, then retry."
            : "The public.users table or required column is missing. Run the Supabase migration in HTML/Landing/supabase/migrations.",
          code: error.code,
          detail: error.message,
          fixFile: "HTML/Landing/supabase/migrations/20260513120000_users_rls_policies.sql"
        });
      }
      return res.status(500).json({
        message: `Supabase error: ${error.message || "unknown"}`,
        code: error.code
      });
    }

    const { data: verifyRow, error: verifyErr } = await supabase
      .from("users")
      .select(selectCols)
      .eq("email", email)
      .maybeSingle();

    if (verifyErr || !verifyRow) {
      console.error(`[admin/users] Insert returned no error but readback failed for ${email}:`, verifyErr);
      return res.status(500).json({
        message: "User insert reported success but could not be read back from Supabase.",
        detail: verifyErr?.message
      });
    }

    const effectiveRole = verifyRow.role
      || decodeConditionRole(verifyRow.condition).role
      || user.role;
    console.log(`[admin/users] Created ${email} (${effectiveRole}) id=${verifyRow.id} via=${usersHasRoleColumn ? "role-col" : "condition-fallback"}`);
    return res.status(201).json({
      message: "User account created.",
      user: publicUser({ ...user, role: effectiveRole }),
      persisted: "supabase",
      db: { ...verifyRow, role: effectiveRole }
    });
  } catch (error) {
    console.error("Admin user creation error:", error);
    return res.status(500).json({ message: `Could not create user account: ${error.message || error}` });
  }
});

// ==============================
// ADMIN USER LIST (for verifying DB persistence)
// ==============================
app.get("/api/admin/users", async (_req, res) => {
  try {
    if (!supabase) {
      return res.json({
        source: "memory",
        users: users.map(publicUser)
      });
    }
    const listCols = usersHasRoleColumn
      ? "id,name,email,role,mobile,sex,dob,address,is_verified,condition,created_at,archived,merged_into"
      : "id,name,email,mobile,sex,dob,address,is_verified,condition,created_at,archived,merged_into";
    let { data, error } = await supabase
      .from("users")
      .select(listCols)
      .order("created_at", { ascending: false });

    if (error?.code === '42703' || error?.code === 'PGRST204') {
      ({ data, error } = await supabase.from('users').select(listCols.replace(',archived,merged_into', '')).order('created_at', { ascending: false }));
    }

    if (error) {
      console.error("[admin/users GET] Supabase error:", error);
      return res.status(500).json({ message: error.message, code: error.code });
    }
    const { data: patientLinks, error: patientLinkError } = await supabase.from('patients').select('id,user_id,email');
    if (patientLinkError) throw patientLinkError;
    const rows = (data || []).map((row) => {
      const { role: encodedRole, condition: cleanCondition } = decodeConditionRole(row.condition);
      const seededRole = seedUsers.find((u) => u.email.toLowerCase() === String(row.email).toLowerCase())?.role;
      return {
        ...row,
        patientIds: (patientLinks || []).filter(p => p.user_id === row.id || String(p.email || '').toLowerCase() === String(row.email).toLowerCase()).map(p => p.id),
        role: row.role || encodedRole || seededRole || "patient",
        condition: cleanCondition
      };
    });
    return res.json({ source: "supabase", users: rows });
  } catch (error) {
    console.error("[admin/users GET] error:", error);
    return res.status(500).json({ message: "Could not list users." });
  }
});

// ==============================
// SUPABASE CLINIC TABLE SYNC
// ==============================
app.delete("/api/admin/patients/:id", async (req, res) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Administrator access is required." });
    if (!requireSupabase(res) || !requireServiceRoleKey(res)) return;
    const id = stableRowId({ id: String(req.params.id || "").trim() }, "patients");
    const { data: existing, error } = await supabase.from("patients").select("id,name,deleted_at").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!existing) return res.status(404).json({ message: "Patient record was not found. Refresh the list and try again." });
    const marker = { id, name: existing.name || "", deletedAt: existing.deleted_at || new Date().toISOString() };
    const { error: writeError } = await supabase.from("patients").update({ archived: true, deleted_at: marker.deletedAt, updated_at: marker.deletedAt }).eq("id", id);
    if (writeError) throw writeError;
    res.json({ message: "Patient record deleted.", deletedPatient: marker });
  } catch (error) {
    console.error("Patient deletion failed:", error.code || error.message);
    res.status(500).json({ message: "Patient could not be deleted. Please try again." });
  }
});

// Availability does not need profiles, clinical notes, billing or notifications.
app.get('/api/booking-availability', async (req,res) => {
  try {
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const [reservations,services] = await Promise.all([
      supabase.from('clinic_appointments').select('id,data').gte('data->>date',today), readJsonTable('services','sync_key')
    ]);
    if (reservations.error) throw reservations.error;
    const appointments = (reservations.data || []).map(row=>({...row.data,id:row.id}));
    const fields = ['id','date','time','schedule','durationMinutes','endTime','status','lifecycleStatus','dentistId','dentistIds','dentist','dentistName','dentistEmail','services','service','archived'];
    res.set('Cache-Control','private, no-store');
    res.json({db:{appointments:appointments.map(a=>{
      const safe=Object.fromEntries(fields.filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
      safe.services=(a.services || []).map(service=>typeof service==='string'?service:Object.fromEntries(['serviceName','name','duration','durationMinutes','chairMinutes','quantity'].filter(k=>service[k]!==undefined).map(k=>[k,service[k]])));
      if (String(a.patientEmail || '').toLowerCase() === String(req.user.email || '').toLowerCase()) { safe.patientEmail=a.patientEmail; safe.patientName=a.patientName || a.patient; }
      return safe;
    }),services}});
  } catch(error) {res.status(503).json({message:'Could not refresh availability.'});}
});

app.post('/api/clinical-notes', async (req,res) => {
  if(req.user?.role!=='dentist')return res.status(403).json({message:'Dentist access required.'});
  try {
    const input=req.body?.note;
    if(!input || !String(input.id||'').match(/^[a-zA-Z0-9_-]{1,100}$/) || !input.patientKey || !String(input.condition||'').trim() || !String(input.treatment||'').trim())return res.status(400).json({message:'Enter a patient, condition and treatment.'});
    const date=String(input.recordDate||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)return res.status(400).json({message:'Choose a valid treatment date.'});
    if(['condition','treatment'].some(key=>typeof input[key]!=='string'||input[key].trim().length>200)||['before','after'].some(key=>input[key]!=null&&(typeof input[key]!=='string'||input[key].length>4000)))return res.status(400).json({message:'Condition and treatment must be text up to 200 characters; before and after notes up to 4,000 characters.'});
    const db={};
    let old;
    const readOld=async()=>{const result=await supabase.from('clinic_patient_clinical_notes').select('data').eq('id',input.id).maybeSingle();if(result.error)throw result.error;old=result.data;};
    if(req.body.authorizationAppointmentId){
      // Fetch only the appointment authorizing this patient and the actor's roster IDs.
      const id=String(req.body.authorizationAppointmentId);
      await Promise.all([readOld(),(async()=>{
        const result=await supabase.from('dentists').select('id,name,email').eq('email',req.user.email);
        if(result.error)throw result.error;db.dentists=result.data||[];
      })(),...['appointments','archivedAppointments'].map(async key=>{
        const result=await supabase.from(clinicTableMap[key].table).select('data').eq('id',id).maybeSingle();
        if(result.error)throw result.error;db[key]=result.data?[result.data.data]:[];
      })]);
    }else{
      // Compatibility for previously loaded browsers.
      await Promise.all([readOld(),...['appointments','archivedAppointments','dentists'].map(async key=>{
        const config=clinicTableMap[key];db[key]=await readJsonTable(config.table,config.keyColumn,config.fallbackTable);
      })]);
    }
    db.patientClinicalNotes=old?[old.data]:[];
    const access=require('../Shared/dentist-access');
    const note=access.writable({patientClinicalNotes:[input]},db,req.user).patientClinicalNotes[0];
    note.createdBy=req.user.name || req.user.email;
    note.createdAt=old?.data?.createdAt || new Date().toISOString();
    if(old && require('./_sync-records').sameAppointment(note,old.data))return res.status(304).end();
    note.updatedAt=new Date().toISOString();
    const {data,error}=await supabase.from('clinic_patient_clinical_notes').upsert({id:note.id,data:note,updated_at:note.updatedAt},{onConflict:'id'}).select('data').single();
    if(error)throw error;
    res.locals ||= {};
    res.locals.auditChanged=true;
    res.json({note:data.data});
  }catch(error){res.status(error.status||500).json({message:error.status===403?error.message:'Could not save the tooth record. Please retry.'});}
});

app.get('/api/patient-db', async(req,res)=>{
 if(req.user.role!=='patient')return res.status(403).json({message:'Patient account required.'});
 try {res.set('Cache-Control','private, no-store');res.json({db:require('../Shared/patient-access').scope(await readClinicDbFromSupabase(),req.user)});}
 catch(error){res.status(500).json({message:'Could not load patient records.'});}
});
async function handlePatientWrite(req,res){
 if(req.user.role!=='patient')return res.status(403).json({message:'Patient account required.'});
 try {
  const access=require('../Shared/patient-access'), saved=await readClinicDbFromSupabase();
  const permitted=access.writable(req.body.db||{},saved,req.user);
  require('./_history-permissions').validateHistoryChanges(permitted,access.scope(saved,req.user),'patient');
  await writeClinicDbToSupabase(permitted,'patient');
  res.json({db:access.scope(await readClinicDbFromSupabase(),req.user)});
 }catch(error){res.status(error.status||400).json({message:error.message||'Could not update patient records.'});}
}
app.put('/api/patient-db',handlePatientWrite);
app.post('/api/patient-db',handlePatientWrite);

app.get("/api/clinic-db", async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    if(req.user.role==='patient')return res.status(403).json({message:"Patients cannot access the clinic database. Use your patient records endpoint."});
    const db = await readClinicDbFromSupabase();
    res.set("Cache-Control", "private, no-store");
    if (req.user.role === "dentist") {
      const user = await findVerifiedUserByEmail(req.user.email);
      if (!user || user.role !== "dentist") return res.status(403).json({message:"Dentist access required."});
      return res.json({db: require('../Shared/dentist-access').scope(db,user)});
    }
    return res.json({ db });
  } catch (error) {
    console.error("Clinic DB read error:", error);
    return res.status(500).json({
      message: "Could not read clinic tables from Supabase. Run the Supabase migration first."
    });
  }
});

async function handleClinicDbWrite(req, res) {
  if(req.user.role==='patient')return res.status(403).json({message:"Patients cannot modify clinic-wide data."});
  try {
    const db = req.body?.db;
    if (!db || typeof db !== "object" || Array.isArray(db) || !Object.keys(db).length ||
        Object.keys(clinicTableMap).some(key => key in db && (!Array.isArray(db[key]) || db[key].some(row => !row || typeof row !== "object" || Array.isArray(row)))) ||
        ("notifications" in db && (!db.notifications || typeof db.notifications !== "object" || Array.isArray(db.notifications) || notificationTargets.some(key => !Array.isArray(db.notifications[key]))))) {
      return res.status(400).json({ message: "A valid clinic database snapshot is required." });
    }
    if (!requireSupabase(res) || !requireServiceRoleKey(res)) return;
    require("./_automatic-archive").applyAutomaticArchive(db);
    // Database sync must never initiate email or depend on SMTP availability.
    if (req.user.role === "dentist") {
      const user = await findVerifiedUserByEmail(req.user.email);
      if (!user || user.role !== "dentist") return res.status(403).json({message:"Dentist access required."});
      const access = require('../Shared/dentist-access');
      const saved = await readClinicDbFromSupabase();
      const permitted = access.writable(db, saved, user);
      require("./_history-permissions").validateHistoryChanges(permitted, access.scope(saved, user), "dentist");
      await writeClinicDbToSupabase(permitted, "dentist");
      return res.json({message:"Clinic tables synced.", db:access.scope(await readClinicDbFromSupabase(),user)});
    }
    if (req.user.role !== "admin") require("./_history-permissions").validateHistoryChanges(db, await readClinicDbFromSupabase(), req.user.role);
    await writeClinicDbToSupabase(req.body?.db || {}, req.user?.role);
    return res.json({ message: "Clinic tables synced.", db: req.user.role === "admin" ? await readClinicDbFromSupabase() : req.body?.db || {} });
  } catch (error) {
    console.error("Clinic DB write error:", {
      message: error?.message || error,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    });

    if (error?.status === 403) return res.status(403).json({ message: error.message });

    if (error?.code === '23P01') return res.status(409).json({ message: 'Appointment overlaps an existing reservation. Choose another time.', code: error.code, appointmentId: error.appointmentId });

    if (error?.code === 'SYNC_CONFLICT') return res.status(409).json({ message: error.message, code: error.code, appointmentId: error.appointmentId });

    if (isSupabaseRlsError(error)) {
      return res.status(500).json({
        message: "Supabase blocked clinic sync due to row-level security. Use the service-role key in SUPABASE_SERVICE_ROLE_KEY or add write policies for the clinic tables.",
        code: error?.code,
        detail: error?.message
      });
    }

    if (isMissingSupabaseTable(error)) {
      return res.status(500).json({
        message: "Supabase clinic sync schema is mismatched or required clinic tables are missing. Run the SQL in HTML/Landing/supabase/migrations or create the missing clinic tables and retry.",
        code: error?.code,
        detail: error?.message,
        fixFile: "HTML/Landing/supabase/migrations"
      });
    }

    return res.status(500).json({
      message: `Supabase error: ${error?.message || "Could not write clinic tables."}`,
      code: error?.code
    });
  }
}

app.post("/api/appointments/:id/manage", async (req, res) => {
  if (!["admin", "staff"].includes(req.user.role)) return res.status(403).json({message:"Admin or staff access required."});
  try {
    const db = await readClinicDbFromSupabase();
    const record = db.appointments.find(row => String(row.id) === req.params.id);
    if (!record) return res.status(404).json({message:"Appointment not found."});
    let updated;
    if (req.body.action === "archive") {
      if (req.user.role !== "admin") return res.status(403).json({message:"Only an administrator can archive appointments."});
      if (!require('./_appointment-actions').terminal(record)) return res.status(400).json({message:"Only finished appointment history can be archived."});
      updated = {...record, archived:true, archivedForPatient:true, archivedForDentist:true, archivedAt:new Date().toISOString(), archivedBy:req.user.email};
    } else if (req.body.action === "reschedule") {
      const {data, error} = await supabase.from('clinic_site_content').select('published').eq('id','website').maybeSingle();
      if (error) throw error;
      updated = require('./_appointment-actions').reschedule(record,req.body,db.dentists,db.appointments,data?.published || {},req.user);
    } else return res.status(400).json({message:"Unknown appointment action."});
    const {error} = await supabase.from('clinic_appointments').update({data:updated,updated_at:new Date().toISOString()}).eq('id',record.id);
    if (error) throw error;
    return res.json({appointment:updated});
  } catch(error) { return res.status(error.code === '23P01' ? 409 : error.status || 500).json({message:error.code === '23P01' ? 'That time is no longer available.' : error.status ? error.message : 'Could not update appointment. Please retry.'}); }
});

app.put("/api/clinic-db", handleClinicDbWrite);
app.post("/api/clinic-db", handleClinicDbWrite);
app.post("/api/appointments/book", require("./_booking").createBookingHandler({ supabase, getClinicHours: async () => { const { data, error } = await supabase.from('clinic_site_content').select('published').eq('id','website').maybeSingle(); if (error) throw error; return require('../Shared/site-content').withDefaults(data?.published || {}); } }));
app.post("/api/payments/cash-review", require("./_cash-payments").createCashReviewHandler({ supabase }));
app.post("/api/appointments/:id/arrive", async (req, res) => {
  if (req.user?.role !== "staff") return res.status(403).json({message:"Only staff can mark a patient arrived."});
  const {data,error} = await supabase.rpc("record_staff_arrival", {appointment_id:req.params.id});
  if (error) return res.status(409).json({message:error.message || "Could not record arrival."});
  return res.json(data);
});
app.post("/api/appointments/:id/reinstate", async (req,res) => {
  if (req.user?.role !== "staff") return res.status(403).json({message:"Only staff can reinstate late arrivals."});
  try {
    const db=await readClinicDbFromSupabase();
    const record=db.appointments.find(a=>String(a.id)===req.params.id);
    if (!record?.autoCancelled || !req.body.dentistAgreed) return res.status(400).json({message:"Dentist agreement is required for an auto-cancelled appointment."});
    const ids=record.dentistIds?.length ? record.dentistIds.map(String) : [String(record.dentistId)];
    if (!ids.includes(String(req.body.approvedBy))) return res.status(400).json({message:"Approval must be from an assigned dentist."});
    const now=new Date(Date.now()+60000);
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
    const date=`${parts.year}-${parts.month}-${parts.day}`, time=`${parts.hour}:${parts.minute}`;
    if(date!==record.date) return res.status(400).json({message:"Reinstatement is available only on the appointment date."});
    const {data:content,error:contentError}=await supabase.from('clinic_site_content').select('published').eq('id','website').maybeSingle();
    if(contentError) throw contentError;
    const proposed=require('./_appointment-actions').reschedule({...record,status:'Approved',lifecycleStatus:'Approved',archived:false}, {date,time,reason:req.body.reason},db.dentists,db.appointments,content?.published||{},req.user);
    const {data,error}=await supabase.rpc('reinstate_late_appointment',{appointment_id:record.id,proposed,approved_by:String(req.body.approvedBy),reason:String(req.body.reason).trim(),staff_email:req.user.email});
    if(error) throw error;
    return res.json({appointment:data});
  } catch(error) {return res.status(error.code==='23P01'?409:error.status||400).json({message:error.code==='23P01'?'Not enough free time remains for the complete treatment.':error.message||'Could not reinstate appointment.'});}
});
// Patient creation is atomic with the first appointment for all clinical roles.
app.post('/api/patients-with-appointment', async (req, res) => {
  if (!['admin','staff','dentist'].includes(req.user?.role)) return res.status(403).json({message:'Clinical account required.'});
  try {
    const db = await readClinicDbFromSupabase(['dentists','dentistSchedules','services','appointments','archivedAppointments']);
    const {patientDetails, walkInAppointment} = require('./_walk-in');
    const patient = patientDetails(req.body.patient);
    const appointment = walkInAppointment(req.body.appointment || {}, patient, db);
    if (!/^[0-9a-f-]{36}$/i.test(appointment.id)) throw new Error('Invalid booking reference.');
    if (req.user.role === 'dentist') {
      const access = require('../Shared/dentist-access');
      if (!access.assigned(appointment, access.identity(db,req.user))) return res.status(403).json({message:'You can only create appointments assigned to your own dentist account.'});
    }
    const existing = db.appointments.find(a => a.id === appointment.id);
    if (existing) {
      if (existing.patientId !== patient.id || existing.createdBy !== req.user.email) return res.status(409).json({message:'Booking reference already used.'});
      return res.json({appointment:existing});
    }
    const {data:content,error:contentError} = await supabase.from('clinic_site_content').select('published').eq('id','website').maybeSingle();
    if (contentError) throw contentError;
    const validated = require('./_appointment-actions').validateSchedule(appointment,
      {date:appointment.date,time:appointment.time,reason:'Initial patient appointment'},db.dentists,
      [...db.appointments,...db.archivedAppointments],content?.published || {},req.user);
    delete validated.rescheduleHistory;
    delete validated.walkIn;
    validated.createdBy = req.user.email;
    const {data,error} = await supabase.rpc('create_patient_with_login',{patient_record:patient,appointment_record:validated,password_hash:await bcrypt.hash('patient123',10),is_walk_in:false});
    if (error) throw error;
    return res.status(201).json({appointment:data});
  } catch(error) {
    return res.status(error.code === '23P01' ? 409 : 400).json({message:error.code === '23P01' ? 'That time was just booked. Choose another time.' : error.message || 'Could not create patient and appointment.'});
  }
});

app.post("/api/walk-ins", async (req,res) => {
  if(req.user?.role!=="staff") return res.status(403).json({message:"Staff access required."});
  try {
    const db=await readClinicDbFromSupabase(['dentists','dentistSchedules','services','appointments','archivedAppointments']);
    const {patientDetails,walkInAppointment}=require('./_walk-in');
    const patient=patientDetails(req.body.patient);
    const appointment=walkInAppointment(req.body.appointment||{},patient,db);
    if(!appointment.id || appointment.id.length>100) throw new Error('Invalid booking reference.');
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(appointment.date!==today) throw new Error('Walk-ins must be booked for today.');
    const existing=db.appointments.find(a=>a.id===appointment.id);
    if(existing?.walkIn && existing.patientId===patient.id) return res.json({appointment:existing});
    const {data:content,error:contentError}=await supabase.from('clinic_site_content').select('published').eq('id','website').maybeSingle();
    if(contentError) throw contentError;
    const validated=require('./_appointment-actions').reschedule(appointment,{date:appointment.date,time:appointment.time,reason:'Walk-in booking'},db.dentists,db.appointments,content?.published||{},req.user);
    delete validated.rescheduleHistory;
    const {data,error}=await supabase.rpc('create_patient_with_login',{patient_record:patient,appointment_record:validated,password_hash:await bcrypt.hash('patient123',10),is_walk_in:true});
    if(error) throw error;
    return res.status(201).json({appointment:data});
  } catch(error){return res.status(error.code==='23P01'?409:400).json({message:error.code==='23P01'?'That time was just reserved. Choose another slot.':error.message||'Could not save walk-in.'});}
});

app.post("/api/appointments/:id/complete", require("./_appointments").createCompleteAppointmentHandler({ supabase, findUser: async email => { const user = await findVerifiedUserByEmail(email); return user ? require("../Shared/dentist-access").identity(await readClinicDbFromSupabase(), user) : null; } }));

app.post("/api/appointment-reminders", async (req, res) => {
  // Legacy browsers may still call this route after each save. Only the
  // authenticated scheduler (or local server timer) may send reminders.
  return res.status(410).json({ message: "Appointment reminders are handled by the clinic scheduler." });
});

// ==============================
// GEMINI PATIENT CHAT
// ==============================
app.post("/api/patient-chat", async (req, res) => {
  try {
    const {
      message,
      currentSection,
      selectedService,
      selectedPrice,
      appointmentStatus,
      paymentStatus,
      patientName
    } = req.body;

    if (typeof message !== "string" || !message.trim() || message.length > 2000) {
      return res.status(400).json({ reply: "Please enter a question of up to 2,000 characters." });
    }
    const chatModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    const numericPrice = Number(selectedPrice || 0);

    const systemPrompt = `
You are G-M Dental Patient Assistant for the G-M Dental patient portal.

Your job is to answer ONLY as the website assistant for this clinic system.

IMPORTANT BEHAVIOR:
- Be friendly, short, clear, and specific to this portal.
- Do not sound generic.
- Do not give broad "it depends on the clinic" answers when the clinic rule is already known.
- Use the actual clinic rules below.
- If the answer is not in the clinic rules or patient context, say: "Please contact the clinic directly for that detail."
- Do not diagnose diseases.
- Do not prescribe medicine.
- Give only general oral health guidance.
- If the user mentions severe pain, swelling, fever, pus, heavy bleeding, infection, or emergency symptoms, advise them to contact the clinic directly as soon as possible.

CLINIC SERVICES AND SAMPLE PRICES:
- Enhanced Infection Control — ₱300
- Consultation — ₱500
- Oral Prophylaxis — ₱1,000
- Restorative Treatment — ₱800
- Tooth Extraction — ₱1,000
- Odontectomy — ₱10,000
- Root Canal Treatment — ₱6,000
- Complete Denture — ₱15,000
- Partial Denture (Stayplate) — ₱6,500
- Partial Denture (Casted) — ₱12,000
- Flexible Denture — ₱16,000
- Crowns and Bridges — ₱6,000
- Orthodontic Treatment — ₱60,000
- Retainers — ₱6,000
- Mouth Guard — ₱6,000
- Whitening — ₱12,000
- Periapical X-Ray — ₱500
- Panoramic X-Ray — ₱1,000

BOOKING FLOW:
1. Select service
2. Choose date and time
3. Confirm booking
4. Pay downpayment if required

PAYMENT RULE:
- If selected service price is ₱3000 or higher, downpayment is required.
- If selected service price is below ₱3000, downpayment is not required.
- Payment methods available: GCash and Cash.

APPOINTMENT STATUS GUIDE:
- Pending = waiting for clinic approval
- Approved = accepted by clinic
- Upcoming = confirmed upcoming appointment
- Completed = finished appointment
- Cancelled = cancelled appointment
- Rejected = clinic did not approve the appointment
- Reschedule Requested = a request to move appointment date/time is being reviewed

CURRENT PATIENT CONTEXT:
- Patient name: ${patientName || "Patient"}
- Current section: ${currentSection || "unknown"}
- Selected service: ${selectedService || "none"}
- Selected price: ₱${numericPrice}
- Appointment status: ${appointmentStatus || "unknown"}
- Payment status: ${paymentStatus || "unknown"}

SPECIAL RESPONSE RULES:
- If the user asks whether downpayment is needed, answer directly using the selected price if available.
- If selected price is 3000 or higher, clearly say that downpayment is required.
- If selected price is below 3000 and greater than 0, clearly say that downpayment is not required.
- If no service is selected yet, explain the rule: downpayment is required only for services worth ₱3000 and above.
- If the user asks about status, explain the exact meaning of the current status if available.
- If the user asks about booking, guide them using the actual booking flow above.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chatModel)}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(25000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nPatient message: ${message}`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res.status(500).json({
        reply: "Sorry, the chatbot is temporarily unavailable."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I could not answer that right now.";

    return res.json({ reply });
  } catch (error) {
    console.error("Gemini chatbot error:", error);
    return res.status(500).json({
      reply: "Sorry, the chatbot is temporarily unavailable."
    });
  }
});

// ==============================
// SCHEDULED APPOINTMENT REMINDERS
// ==============================
// Serverless instances are torn down between requests, so the local setInterval
// scan is replaced in production by the Vercel cron entry in vercel.json.
app.get("/api/cron/appointment-reminders", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: "Unauthorized." });
  }
  try {
    await runAppointmentReminderScan();
    return res.json({ message: "Appointment reminder scan completed." });
  } catch (error) {
    console.error("Appointment reminder cron error:", error);
    return res.status(500).json({ message: "Appointment reminder scan failed." });
  }
});

// ==============================
// STARTUP
// ==============================
// API errors must remain JSON, including missing routes and parser failures.
app.use('/api', (_req, res) => res.status(404).json({ message: 'This API endpoint is unavailable. Restart the local preview or update the deployment, then retry.' }));
app.use((error, req, res, next) => {
  if (!req.path.startsWith('/api/')) return next(error);
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ message: status === 413 ? 'The submitted record is too large.' : status === 400 ? 'The submitted record could not be read. Please refresh and retry.' : 'The server could not complete this request. Please retry.' });
});

let bootstrapPromise = null;
let bootstrapRetryAt = 0;

async function bootstrap() {
  if (supabase) {
    await detectUsersSchema();
    await seedSupabaseUsers();
    console.log("Supabase is connected.");
  } else {
    console.warn("Supabase is not configured; using in-memory auth fallback.");
  }
}

function ensureBootstrapped() {
  if (!bootstrapPromise && Date.now() < bootstrapRetryAt) return Promise.resolve(false);
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((error) => {
      // Retry on the next request instead of poisoning the instance.
      bootstrapPromise = null;
      bootstrapRetryAt = Date.now() + 60000;
      console.error("Startup error:", error.message || error);
      return false;
    });
  }
  return bootstrapPromise;
}

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);

    await ensureBootstrapped();

    try {
      await transporter.verify();
      console.log("Mailer is ready.");
    } catch (err) {
      console.error("Mailer error:", err.message);
    }

    if (supabase) {
      runAppointmentReminderScan();
      setInterval(runAppointmentReminderScan, APPOINTMENT_REMINDER_SCAN_MS);
    }
  });
}

module.exports = app;

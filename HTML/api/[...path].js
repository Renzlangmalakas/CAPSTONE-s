// Catch-all Vercel Function: every backend path is served by the one Express app.
//
// Vercel's zero-config filesystem routing only matches this catch-all one segment
// deep (/api/clinic-db), so vercel.json adds an explicit rewrite for deeper paths
// like /api/admin/users. Requests therefore arrive two different ways, and a
// rewritten one may carry the function's own name in req.url instead of the real
// path. Vercel always injects the matched segments as the `path` param, so rebuild
// the URL from that and hand Express the path it actually declares routes for.
const app = require("./_app.js");

module.exports = (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const segments = url.searchParams.getAll("path").filter(Boolean);

  if (segments.length) {
    url.searchParams.delete("path");
    const query = url.searchParams.toString();
    req.url = `/api/${segments.join("/")}${query ? `?${query}` : ""}`;
  }

  return app(req, res);
};

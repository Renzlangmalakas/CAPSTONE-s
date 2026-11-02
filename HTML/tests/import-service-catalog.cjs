// Add only missing services. Existing prices, IDs and archived rows are preserved.
const { defaults, aliases, key } = require('../Shared/service-catalog');
const quote = value => "'" + String(value).replace(/'/g, "''") + "'";
function sql() {
  const rows = defaults.map(service => {
    const names = [key(service.name), ...Object.keys(aliases).filter(alias => aliases[alias] === key(service.name))];
    return `(${quote(service.name)}, ${Number(service.price)}, ${quote(service.displayDuration)}, ${quote(service.description)}, ARRAY[${names.map(quote).join(',')}])`;
  });
  return `WITH wanted(name,price,duration,description,names) AS (VALUES ${rows.join(',\n')})
INSERT INTO public.services (name,price,duration,description,archived)
SELECT w.name,w.price,w.duration,w.description,false FROM wanted w
WHERE NOT EXISTS (SELECT 1 FROM public.services s
  WHERE trim(regexp_replace(lower(s.name),'[^a-z0-9]+',' ','g')) = ANY(w.names))
RETURNING name;`;
}
module.exports = { sql };
if (require.main === module) process.stdout.write(sql());

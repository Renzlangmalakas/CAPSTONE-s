# G-M Dental Clinic

The clinic website and portals for patients, dentists, staff, and administrators.

## Where to work

| Folder | Contents |
| --- | --- |
| `HTML/Landing` | Public website, sign-in, and registration |
| `HTML/Patient` | Patient dashboard and appointment booking |
| `HTML/Dentist` | Dentist dashboard, schedules, and patient records |
| `HTML/Staff` | Front-desk operations |
| `HTML/Admin` | Clinic administration |
| `HTML/Shared` | Shared styles and browser utilities |
| `HTML/Images` | Website images |
| `HTML/api` | Backend API |
| `HTML/scripts` | Build and maintenance tools |
| `HTML/tests` | Automated regression tests |
| `HTML/migrations`, `supabase` | Database configuration and migrations |

## Editing the public website

Edit `HTML/Landing/landing.template.html`, then run:

```powershell
cd HTML
npm run build
```

This generates `landing.html`, `services.html`, `about.html`, and `contact.html`.
These generated pages are required for deployment. Explorer nests them under
the template so the source is easier to find.

## Checks and backend

From `HTML`, run `npm test` for regression tests. `npm start` starts the API;
it does not serve the static website on its own.

Keep environment files private. Local configuration is in `HTML/.env`.
Deployment routing is in `HTML/vercel.json`.

## Explorer organization

Related HTML, CSS, and JavaScript files are nested together. Dependencies,
deployment metadata, local account configuration, logs, and `.verification`
are hidden from Explorer by `.vscode/settings.json`; hiding does not delete them.
The `.verification` folder retains local browser checks and reference images.
Generated screenshots, reports, downloaded page copies, and logs can be recreated.

`REVIEW.md` contains historical review notes; it is not a current status report.

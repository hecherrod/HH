# Héctor Herrera

La portada existente está en `index.html`. La aplicación de subastas está en [subasta/](subasta/).

## Desarrollo de la subasta

Con Node.js 22.13 o posterior, ejecuta estos comandos desde `subasta/`:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_needy_ronan.sql
npm run dev
```

La aplicación requiere un servidor con Cloudflare D1 y autenticación de Sites para registrar pujas en línea. GitHub Pages puede servir la portada estática. Para desplegar la aplicación, usa `subasta/` como raíz en Sites y vincula su propio proyecto.

El catálogo de demostración, los precios en MXN y el cierre se editan en `subasta/lib/catalog.ts`. La edición registra pujas de prueba sin cobros ni adjudicaciones.

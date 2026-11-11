# Configuración — Fases 1 y 2

## 1. Proyecto local

```bash
npm install
cp .env.example .env.local   # luego completa los dos valores
npm run dev                  # http://localhost:5173
```

Comandos:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Verificación de tipos + compilación a `dist/` |
| `npm test` | Pruebas (incluye las de base de datos sobre Postgres real en WASM) |
| `npm run test:db` | Solo pruebas de base de datos: migraciones, RLS, roles, horario |

Sin `.env.local` el sitio funciona y muestra “Configuración pendiente” donde irían datos de Supabase.

## 2. Crear el proyecto Supabase

1. En supabase.com → **New project**. Región: `South America (São Paulo)` (la más cercana a Valledupar).
2. Guarda la contraseña de la base de datos en un gestor de contraseñas (no por chat).
3. **Project Settings → API**: copia *Project URL* y *anon public key* a `.env.local`.
   - La **service_role key no se usa en el frontend.** Solo irá en *Edge Functions → Secrets* en la Fase 6.

## 3. Aplicar las migraciones

Opción A — CLI (recomendada, deja historial de versiones):

```bash
npx supabase login
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

Opción B — SQL Editor: ejecuta en orden cada archivo de `supabase/migrations/` (de `…000001` a `…000006`).

## 4. Autenticación (Dashboard → Authentication)

- **Providers → Email**: activado, con *Confirm email* **activado** (obligatorio: la vinculación de pedidos de invitado depende de la confirmación).
- **URL Configuration**:
  - *Site URL*: `http://localhost:5173` mientras desarrollas; luego `https://alitasnelcy.com`.
  - *Redirect URLs*: `http://localhost:5173/**` y `https://alitasnelcy.com/**`.
- **Passwords**: longitud mínima 8.
- Correos con la marca y remitente propio (SMTP de Resend): se configuran en la Fase 6. Hasta entonces Supabase usa su remitente por defecto, con límite de pocos correos por hora — suficiente para pruebas, **no para producción**.

## 5. Primer superadministrador

1. Regístrate en `/registro` con el correo del dueño y confirma el correo.
2. En el SQL Editor:

```sql
select public.bootstrap_superadmin('correo-del-dueno@dominio.com');
```

Solo funciona una vez (si ya existe un superadmin, falla). Los demás roles se asignan desde el panel (Fase 3).

## 6. Datos que se cargan desde el panel (no hay datos inventados)

| Qué | Estado actual |
|---|---|
| Nombre, teléfono, WhatsApp, dirección, Instagram | Cargados (confirmados en 3 fuentes) |
| Horario | **Vacío** → el sitio dice “Horario por confirmar” y `is_open_now()` responde cerrado |
| Métodos de pago | Creados **inactivos** y sin instrucciones |
| Zonas de domicilio | Vacías |
| Catálogo | Vacío → el menú dice “Estamos actualizando el menú” |

Hasta que exista el panel (Fase 3), se pueden cargar desde *Table Editor* de Supabase.

## 7. Verificar

- `npm test` → 32 pruebas en verde.
- Con `.env.local` puesto: el pie de página muestra dirección y teléfono leídos de Supabase; el menú muestra el estado vacío (no error).
- Registro → llega el correo → enlace → `/ingresar?verificado=1` → `/cuenta` muestra tus datos.

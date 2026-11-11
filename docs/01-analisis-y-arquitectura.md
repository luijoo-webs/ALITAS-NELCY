# Alitas Nelcy — Análisis, arquitectura y modelo de datos

Versión 0.2 · 2026-11-11 · Estado: **propuesta para aprobación** (no hay código todavía)

> **Cambio v0.2:** Vinapp queda fuera del proyecto. Sin botones, enlaces, integraciones ni dependencias. La web propia gestiona los pedidos de principio a fin (ver §6). Se añaden zonas de cobertura, tarifas de domicilio, métodos de pago configurables, WhatsApp opcional y la investigación de pasarelas en Colombia (§7).

---

## 1. Lo que encontré en las fuentes

### 1.1 Datos comerciales confirmados (aparecen en 2+ fuentes)

| Dato | Valor | Fuentes |
|---|---|---|
| Dirección | Transversal 26 # 18D-02, Barrio Los Fundadores, Valledupar, Cesar | web, Vinapp, Instagram |
| Teléfono / WhatsApp | +57 321 891 8754 | web (wa.me), Vinapp |
| Instagram | @alitasnelcyvalledupar | web, Vinapp |
| Desde | 2022 | web (inicio y nosotros) |
| Salsas de la casa (5) | BBQ, BBQ Picante, BBQ Maracuyá, BBQ Tamarindo, Miel Mostaza — adicional $1.000 | web, Vinapp |
| Categorías | Combos, Almuerzos, Adicionales, Bebidas (+ Salsas en la web) | web, Vinapp |
| Almuerzos incluyen | frijol o lenteja, tajada amarilla, ensalada, arroz blanco o de coco | web, Vinapp |
| Historia | Empezó con almuerzos caseros, pocas mesas, luego alitas | web /nosotros |

El menú que tenía publicado en Vinapp quedó guardado solo como **referencia histórica** para la carga inicial en [fuentes/menu-vinapp-2026-11-11.json](fuentes/menu-vinapp-2026-11-11.json). No es una dependencia: el catálogo vivirá en Supabase y se administrará desde el panel. Las URLs de fotos de ese archivo apuntan al CDN de Vinapp y **no se enlazarán**; las fotos que sirvan se suben a Supabase Storage.

### 1.2 Contradicciones que **debe resolver el restaurante** antes de cargar datos

**Precios (web vs Vinapp):**

| Producto | alitasnelcy.com | Vinapp |
|---|---|---|
| Combo #1 (5 presas) | $14.000 | $15.000 |
| Combo #2 (7) | $20.000 | $21.000 |
| Combo #3 (11) | $27.000 | $29.000 |
| Combo #4 (14) | $32.000 | $34.000 |
| Combo #5 (21) | $42.000 | $44.000 |
| Combo #6 (28) | $52.000 | $54.000 |
| Combo #7 (36) | $62.000 | $64.000 |
| Rabo guisado | $18.000 | $20.000 |
| Sobrebarriga | $15.000 | $16.000 |
| Carne/Pechuga/Chuleta asada | $15.000 | $18.000 |
| Pollo frito/guisado, carnes desmechada/molida/guisada | $15.000 | $16.000 |
| Arroz de coco | $6.000 | $6.000 |

Las fotos de Vinapp tienen nombres “ALITAS_NELCY_2026”, así que **Vinapp parece más reciente**, pero no lo asumo.

**Productos solo en una fuente:**
- Solo en la web: *Muchacho en salsa de coco* ($18.000).
- Solo en Vinapp: *Pechuga de Nelcy* ($22.000, 250 g pechuga apanada + papas), *Crunchy de Nelcy* ($20.000), *Tenders de Nelcy* ($20.000), *Soda Hatsu Rosada* ($5.000).

**Horarios:**
- Web e Instagram: L–V 11:00–22:00, S–D 11:00–23:00.
- Vinapp: todos los días 10:30–23:00.

**Cifras sociales:** la web dice 16,8 K seguidores; Instagram hoy muestra 20,5 mil. La web dice 4,7★ / 54 reseñas en Google (no verificado). → No las escribiré fijas en el código; irán en configuración o se omiten.

### 1.3 Identidad visual existente

- Sitio actual: Next.js, fondo negro `#111111`, naranja `#FF7701` (color dominante de marca), rojo `#E2000A` (acento), blanco.
- Tipografías: **Lilita One** (títulos, redondeada y gruesa) + **Poppins** (texto).
- Logo blanco en webp (`/logo/alitas-nelcy-logo-white.webp`).
- Fotos: local con neón naranja y tapicería naranja (muy fotogénico, oscuro, cinematográfico), combos en primer plano, salsas en recipientes. Hospedadas en Cloudflare R2 y en Vinapp.
- Tono de comunicación: cercano, costeño, frases cortas (“La salsa la elegís vos”, “Nada de genérico”).
- Instagram: destacadas “Premios Alitas”, “Combos”, “Clientes”, “Modo festival”. Las publicaciones no se pueden leer sin sesión; necesito fotos originales directamente del cliente.

### 1.4 Referencia: maonoseattle.com

Lo que tomo: alternancia de bloques de color sólido (fondo oscuro ↔ fondo claro cálido), fotografía grande sin marcos, banda tipográfica en movimiento (marquee), tarjetas de ubicación con foto, navegación mínima con un CTA fuerte (“Order online”), footer de tres columnas.
Lo que **no** tomo: titulares de 76 px en mayúsculas condensadas, su paleta (azul marino + mostaza) y sus fuentes.

### 1.5 Vinapp — descartado

- Decisión del cliente (v0.2): **Vinapp no se usa.** El sistema no tiene enlaces, botones, integraciones ni datos en vivo de Vinapp.
- Al migrar, hay que retirar el enlace a Vinapp de la bio de Instagram y reemplazarlo por `alitasnelcy.com/menu` (tarea del restaurante).
- Los pedidos que lleguen por WhatsApp, teléfono o mostrador se registran en el panel como **venta manual** (§6.4) y siguen el mismo flujo de descuento de inventario que los pedidos web.

---

## 2. Decisiones de tecnología

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Lo pidió el cliente |
| Router | React Router 6 (rutas con carga diferida) | El panel solo se descarga al entrar en `/admin` |
| Estilos / UI | Tailwind + **shadcn/ui** (Radix) | Componentes accesibles, código propio (no es una dependencia cerrada), coherentes en público y admin |
| Iconos | Lucide | Lo pidió el cliente; es el set de shadcn |
| Datos | TanStack Query + supabase-js | Caché, reintentos, invalidación con Realtime |
| Formularios | react-hook-form + zod | Los mismos esquemas zod validan en el cliente y en las Edge Functions |
| Gráficos | Recharts | Ligero, suficiente para el dashboard |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) | Lo pidió el cliente |
| Correo | **Resend** (SMTP para Auth + API desde Edge Functions) | Plan gratis de 3.000/mes, plantillas HTML, dominio propio verificado |
| Pagos en línea | **Ninguno por ahora.** Arquitectura preparada para una pasarela (§7.3) | Falta definir proveedor y credenciales |
| WhatsApp | Enlaces `wa.me` (fase 1) · WhatsApp Cloud API opcional (fase 6) | Contacto y avisos; nunca es el registro del pedido |
| Hosting | **Cloudflare Pages** en lugar de GitHub Pages | GitHub Pages no admite rutas SPA (`/admin/pedidos` da 404 sin trucos) ni cabeceras de seguridad (CSP). Cloudflare Pages sí, es gratis, y el negocio **ya usa Cloudflare R2** para sus fotos |
| Pruebas | Vitest (lógica), **pgTAP** (funciones SQL de inventario), Playwright (flujo de compra) | El inventario se prueba en la base de datos, donde vive la lógica |

**SEO — riesgo a decidir:** el sitio actual es Next.js, que entrega HTML desde el servidor. Una SPA de Vite no lo hace y Google indexa peor. Mitigación propuesta: **prerenderizar** las páginas públicas (inicio, menú, nosotros, contacto) al compilar, con metadatos y JSON-LD `Restaurant`; el menú se refresca desde Supabase al cargar. Si el SEO local es prioritario, la alternativa es Next.js, pero el cliente pidió Vite.

**Una sola aplicación, no dos.** Público y panel comparten tipos, cliente de Supabase y componentes. El panel se carga solo bajo `/admin` (code-splitting). La seguridad no depende de que el código esté separado: depende de RLS y de las funciones SQL.

---

## 3. Propuesta de diseño

### 3.1 Paleta (derivada de la marca actual, no impuesta)

| Token | Hex | Uso |
|---|---|---|
| `carbon` | `#141210` | Fondo de secciones oscuras, texto principal sobre claro (negro cálido en vez de `#111` frío) |
| `nelcy` | `#FF7701` | Color de marca: CTA principal, precios, detalles. **Uno solo** por pantalla dominante |
| `nelcy-700` | `#C95A00` | Hover y texto naranja sobre fondo claro (contraste AA) |
| `crema` | `#F5EFE6` | Fondo de secciones claras editoriales (aporta la alternancia estilo Ma‘ono) |
| `hueso` | `#FFFBF5` | Tarjetas sobre crema |
| `piedra` | `#7A716A` | Texto secundario |
| `chile` | `#D7261E` | Solo promociones y estados de error/alerta (el rojo actual, relegado a acento) |

Panel administrativo: neutros (blanco, grises cálidos) + `nelcy` solo para la acción principal y estados activos; verde/ámbar/rojo para estados de stock.

### 3.2 Tipografía

- **Lilita One** para títulos (continuidad con la marca), con tamaños controlados: H1 `clamp(2.25rem, 4vw, 3.5rem)` (máx. 56 px), H2 `clamp(1.75rem, 3vw, 2.5rem)`. Sin mayúsculas sostenidas.
- **DM Sans** para texto e interfaz (más editorial y legible que Poppins en tamaños pequeños; números tabulares para precios y tablas).
- Panel: solo DM Sans.

### 3.3 Lenguaje visual

- Esquinas de 6–10 px (nada de tarjetas tipo píldora).
- Fotos a sangre, oscurecidas con un velo plano (sin gradientes de colores).
- Banda en movimiento con las 5 salsas entre secciones (lenta, se pausa con `prefers-reduced-motion`).
- Animaciones: aparición suave al hacer scroll (opacidad + 12 px), 200–300 ms, microinteracción al agregar al carrito.
- Iconos Lucide con trazo de 1,75 px en todo el sitio.

### 3.4 Mapa del sitio público

```
/                 Inicio
  Hero (foto real del local con neón) · “Pedir ahora” · “Ver menú”
  Banda de salsas
  Destacados (productos marcados en el panel)
  Alitas: combos por tamaño (Para uno · Para compartir · Para el grupo)
  Almuerzos: comida corriente, “qué incluye”
  Promociones (solo si hay activas)
  Historia breve → /nosotros
  Ubicación + horarios + mapa
/menu             Menú completo, filtros por categoría, buscador, ficha de producto con opciones
/nosotros         Historia
/contacto         Dirección, mapa, WhatsApp, redes
/carrito          (panel lateral, no página; persiste en el navegador)
/checkout         Entrega (domicilio/recogida) → datos → pago → resumen → confirmar
/pedido/:token    Seguimiento en vivo del pedido (sin necesidad de cuenta)
/cuenta/*         Perfil, direcciones, historial
/auth/*           Ingreso, registro, recuperación
/admin/*          Panel
```

---

## 4. Estructura de carpetas

```
alitas-nelcy/
├─ docs/                          análisis, decisiones, manual de configuración
├─ public/                        favicon, logo, robots.txt, _redirects, _headers
├─ src/
│  ├─ app/                        router.tsx, providers.tsx, layouts (Public, Admin, Account)
│  ├─ config/                     env.ts (variables validadas con zod), constants.ts
│  ├─ lib/                        supabase.ts, queryClient.ts, format.ts (COP, fechas Bogotá), units.ts
│  ├─ types/                      database.types.ts (generado con supabase gen types), domain.ts
│  ├─ components/
│  │  ├─ ui/                      shadcn (button, dialog, table, toast…)
│  │  └─ shared/                  Logo, Price, EmptyState, ConfirmDialog, DataTable, DateRangePicker
│  ├─ contexts/                   AuthContext, CartContext
│  ├─ hooks/                      useAuth, usePermission, useRealtime, useDebounce
│  └─ features/                   cada módulo con pages/, components/, hooks/, services/, schemas.ts
│     ├─ site/                    inicio, nosotros, contacto
│     ├─ menu/                    catálogo público y ficha de producto
│     ├─ cart/                    carrito y cálculo (solo vista previa; el total real lo calcula el servidor)
│     ├─ checkout/
│     ├─ order-tracking/
│     ├─ auth/
│     ├─ account/
│     └─ admin/
│        ├─ dashboard/
│        ├─ orders/               tablero por estados + venta manual/mostrador
│        ├─ catalog/              categorías, productos, opciones, promociones
│        ├─ inventory/            ingredientes, existencias, kardex, ajustes, mermas, alertas
│        ├─ recipes/              fichas técnicas y costeo
│        ├─ purchasing/           proveedores, órdenes de compra, recepciones
│        ├─ customers/
│        ├─ expenses/
│        ├─ reports/
│        ├─ users/                usuarios, roles y permisos
│        └─ settings/
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                 0001_extensions_y_tipos.sql, 0002_auth_roles.sql, 0003_catalogo.sql,
│  │                              0004_inventario.sql, 0005_compras.sql, 0006_pedidos.sql,
│  │                              0007_funciones_inventario.sql, 0008_rls.sql, 0009_reportes.sql …
│  ├─ functions/                  send-email/, order-events/, _shared/ (cors, zod, plantillas)
│  ├─ templates/                  plantillas HTML de Auth (confirmación, recuperación)
│  ├─ seed/                       roles y permisos base; catálogo SOLO tras confirmación del cliente
│  └─ tests/                      pgTAP: consumo, cancelación, idempotencia, concurrencia, RLS
├─ tests/e2e/                     Playwright
└─ .env.example                   solo VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
```

---

## 5. Modelo de base de datos

Convenciones: `uuid` como PK, `created_at/updated_at timestamptz`, dinero en `numeric(12,2)` COP, cantidades en `numeric(14,3)`, zona horaria de negocio `America/Bogota`. Todo con RLS activado.

### 5.1 Usuarios, roles y auditoría

| Tabla | Columnas clave |
|---|---|
| `profiles` | id (= auth.users.id), full_name, phone, avatar_url, is_staff |
| `roles` | id, code (`superadmin`, `admin`, `inventory`, `staff`, `kitchen`), name, is_system |
| `permissions` | id, code (`orders.read`, `orders.update_status`, `inventory.adjust`, `purchases.receive`, `reports.read`, `users.manage`…), module |
| `role_permissions` | role_id, permission_id (PK compuesta) |
| `user_roles` | user_id, role_id |
| `audit_logs` | id, actor_id, action, table_name, record_id, old_data jsonb, new_data jsonb, created_at |

`has_permission(code)` es una función SQL `security definer stable` usada en **todas** las políticas RLS. Los permisos se editan desde el panel; los roles de sistema no se pueden borrar.

### 5.2 Clientes

| Tabla | Columnas clave |
|---|---|
| `customers` | id, user_id (nullable, único), full_name, phone, email, email_verified, notes |
| `customer_addresses` | id, customer_id, label, address, neighborhood, reference, delivery_zone_id, is_default |

Un pedido de invitado crea/reutiliza un `customer` sin `user_id`. Cuando un usuario **verifica** su correo, un trigger vincula los `customers` con ese mismo correo a su cuenta. Nunca antes de la verificación (si no, cualquiera podría registrar el correo ajeno y ver su historial).

### 5.3 Catálogo

| Tabla | Columnas clave |
|---|---|
| `categories` | id, name, slug, description, sort_order, is_active |
| `products` | id, category_id, name, slug, description, base_price, is_available, availability_mode (`manual` / `auto_by_stock`), is_featured, is_archived, allergens text[], sort_order |
| `product_images` | id, product_id, storage_path, alt, sort_order |
| `product_variants` | id, product_id, name (ej. “Personal 400 ml”), price, sku, is_default, is_active |
| `modifier_groups` | id, name (“Elige tu salsa”, “Principio”, “Arroz”), min_select, max_select |
| `modifier_options` | id, group_id, name, price_delta, is_active |
| `product_modifier_groups` | product_id, group_id, sort_order |
| `promotions` | id, name, type (`percent`/`fixed`/`label`), value, starts_at, ends_at, is_active |
| `promotion_products` | promotion_id, product_id |

Los “adicionales” del pedido (salsa extra, presa adicional, porta comida) son `modifier_options` con precio. Así “frijol o lenteja” y “arroz blanco o de coco” se modelan igual, sin tablas especiales.

### 5.4 Inventario (el núcleo)

| Tabla | Columnas clave |
|---|---|
| `units` | code (`g`, `kg`, `ml`, `l`, `unit`), dimension (`mass`/`volume`/`count`), factor_to_base |
| `ingredient_categories` | id, name |
| `ingredients` | id, category_id, name, description, base_unit (`g`/`ml`/`unit`), stock_qty, min_stock, avg_cost (por unidad base), main_supplier_id, last_purchase_at, tracks_expiry, is_critical, is_active |
| `ingredient_unit_conversions` | ingredient_id, unit_name (“paquete”, “caja”, “bulto”), qty_in_base_unit — ej. paquete de servilletas = 100 unit |
| `ingredient_lots` | id, ingredient_id, receipt_item_id, qty_remaining, expires_at (solo si tracks_expiry) |
| `recipes` | id, product_id **o** variant_id **o** modifier_option_id, yield_portions, waste_pct, notes, version, is_active |
| `recipe_items` | id, recipe_id, ingredient_id, quantity, unit_code, qty_base (calculada al guardar) |
| `inventory_movements` | id, ingredient_id, type, qty_base (con signo), balance_before, balance_after, unit_cost, order_id, receipt_id, reason, created_by, created_at |
| `inventory_alerts` | id, ingredient_id, type (`low_stock`/`out_of_stock`/`expiring`/`count_difference`), status (`open`/`resolved`), message, created_at, resolved_by |
| `stock_counts` + `stock_count_items` | conteos físicos: cantidad del sistema vs contada → genera ajustes y alerta de diferencia |

`type` de movimiento: `purchase_receipt`, `sale_consumption`, `sale_reversal`, `adjustment_in`, `adjustment_out`, `waste`, `expired`, `supplier_return`, `correction`.

La tabla pedida `inventory` se reemplaza por `ingredients.stock_qty`: una sola fila por ingrediente con su saldo, protegida por bloqueo de fila. Tener saldo en dos tablas invita a descuadres.

**Unidades:** todo se guarda en unidad base (g, ml, unidad). Las recetas y compras aceptan kg, l, paquetes, etc., y se convierten al guardar con `units.factor_to_base` o `ingredient_unit_conversions`. Convertir masa ↔ volumen está prohibido (lanza error).

**Costo:** costo promedio ponderado, recalculado en cada recepción de compra:
`nuevo_promedio = (stock × promedio + cant_recibida × costo_unit) / (stock + cant_recibida)`.
El costo de receta = Σ(qty_base × avg_cost) × (1 + merma%) / porciones. Se guarda un historial de costos para mostrar variaciones.

### 5.5 Compras

| Tabla | Columnas clave |
|---|---|
| `suppliers` | id, name, nit, contact_name, phone, email, notes, is_active |
| `purchase_orders` | id, number, supplier_id, status (`draft`/`sent`/`partially_received`/`received`/`cancelled`), expected_at, total, created_by |
| `purchase_order_items` | id, po_id, ingredient_id, quantity, unit_name, unit_price, line_total |
| `stock_receipts` | id, po_id (nullable: compras de contado sin orden), received_at, received_by, invoice_number, notes |
| `stock_receipt_items` | id, receipt_id, po_item_id, ingredient_id, quantity, unit_name, qty_base, unit_cost_base, expires_at |

Crear la orden **no** toca el inventario. Solo `receive_stock(receipt)` suma existencias, recalcula el promedio y escribe el kardex. Admite recepciones parciales.

### 5.6 Pedidos y pagos

| Tabla | Columnas clave |
|---|---|
| `order_statuses` | code, label, sort_order, kind (`new`/`confirmed`/`in_progress`/`ready`/`out_for_delivery`/`delivered`/`cancelled`), is_active, notify_customer |
| `orders` | id, number (secuencial legible), public_token, idempotency_key (único), customer_id, channel (`web`/`counter`/`phone`/`whatsapp`), fulfillment (`delivery`/`pickup`), status, address snapshot, delivery_zone_id, subtotal, delivery_fee, discount, total, payment_method_id, cash_change_for (efectivo: “pago con”), payment_status, notes, scheduled_for (null = lo antes posible), inventory_state (`none`/`consumed`/`reversed`), created_by (personal, en ventas manuales), confirmed_at, cancelled_at |
| `order_items` | id, order_id, product_id, variant_id, name_snapshot, unit_price, quantity, line_total, notes |
| `order_item_modifiers` | id, order_item_id, modifier_option_id, name_snapshot, price_delta |
| `order_status_history` | id, order_id, from_status, to_status, changed_by, created_at |
| `payment_methods` | id, code (`cash`, `transfer`, `nequi`, `daviplata`, `breb`, `card_on_delivery`, `online_gateway`), label, instructions (ej. “Llave Bre-B: …”), requires_proof, available_for (`delivery`/`pickup`/ambos), is_online, is_active, sort_order |
| `payments` | id, order_id, payment_method_id, amount, status (`pending`/`paid`/`failed`/`refunded`), reference, proof_path (comprobante subido), provider, provider_tx_id (único), registered_by |
| `payment_events` | id, provider, provider_tx_id, payload jsonb, signature_ok, processed_at — reservada para webhooks de la pasarela futura |
| `delivery_zones` | id, name, fee, min_order, eta_minutes, free_from (domicilio gratis desde $X, opcional), is_active, sort_order |
| `delivery_zone_neighborhoods` | zone_id, neighborhood (barrio de Valledupar), único por barrio |
| `business_hours` + `business_closures` | horario semanal por día y cierres/fechas especiales; `restaurant_settings.orders_paused` para pausar pedidos con un clic |
| `expenses` + `expense_categories` | gastos operativos (arriendo, servicios, nómina…) — separados de compras de insumos |

Los nombres y precios se copian al pedido (snapshot) para que cambiar el menú no altere pedidos pasados.

### 5.7 Comunicación y configuración

| Tabla | Columnas clave |
|---|---|
| `notifications` | id, user_id o role_code, type, title, body, link, read_at |
| `email_logs` | id, to_email, template, order_id, provider_id, status, error, created_at |
| `restaurant_settings` | fila única: nombre, logo, teléfono, WhatsApp, dirección, redes, políticas, correo remitente, `orders_paused`, `auto_confirm_orders`, tiempo estimado de preparación, parámetros de inventario (auto-desactivar productos, días de aviso de vencimiento) |
| `whatsapp_logs` | id, to_phone, template, order_id, provider_msg_id, status — solo si se activa la WhatsApp Cloud API |

---

## 6. Flujo de pedidos de principio a fin (sin plataformas externas)

### 6.1 Recorrido

```
CLIENTE (alitasnelcy.com)                         RESTAURANTE (/admin/pedidos)
─────────────────────────                         ─────────────────────────────
Explora el menú (Supabase, en vivo)
Abre un producto → elige variante,
  salsa, principio, adicionales
Agrega al carrito (se guarda en el navegador)
Checkout:
  1. Domicilio o recogida
  2. Si domicilio: dirección + barrio
     → zona → tarifa y pedido mínimo
  3. Datos (invitado o sesión iniciada)
  4. Método de pago
  5. Resumen con total recalculado
     por el servidor
  6. Confirmar ─────► create_order() ──────────►  Aparece en “Nuevos” al instante
                       (precios, horario,         (Realtime + sonido + aviso del navegador)
                        zona, idempotencia)
Pantalla “Pedido #0123 recibido”                  Verifica pago si aplica → Confirmar
  + correo de confirmación                          → confirm_order(): descuenta inventario
/pedido/:token se actualiza en vivo  ◄──────────  En preparación → Listo
  + correo en cada cambio relevante                 → En camino (domicilio)
                                                      o Listo para recoger (recogida)
                                                  → Entregado / Finalizado
```

Estados por defecto (renombrables, con `kind` fijo para la lógica): **Nuevo → Confirmado → En preparación → Listo → En camino | Listo para recoger → Entregado**, más **Cancelado**. Las transiciones válidas se validan en SQL (no se puede pasar de Nuevo a Entregado ni retroceder desde Entregado).

### 6.2 Reglas del checkout (validadas en el servidor)

- **Horario:** fuera de horario, en un cierre especial o con `orders_paused` el botón de confirmar se desactiva y `create_order` también lo rechaza.
- **Cobertura:** el cliente elige su barrio de una lista. Barrio → zona → tarifa, pedido mínimo y tiempo estimado. Si el barrio no está cubierto: se ofrece recogida o contacto por WhatsApp. (Polígonos sobre un mapa se pueden añadir después; para un solo local, la lista de barrios es más precisa y fácil de administrar.)
- **Recogida:** sin tarifa; muestra dirección y botón “Cómo llegar”.
- **Precios:** el navegador solo muestra una vista previa; `create_order` recalcula todo desde la base.
- **Invitado:** nombre, teléfono y correo (para confirmación y seguimiento). Si luego crea cuenta y verifica el mismo correo, sus pedidos se vinculan (§5.2).
- **Registrado:** direcciones guardadas, datos precargados, historial.
- **Doble envío:** `idempotency_key` generada al abrir el checkout; reintentar devuelve el mismo pedido.

### 6.3 Panel de pedidos en tiempo real

- Vista tablero (columnas por estado) y vista lista con filtros por fecha, estado, canal, cliente.
- Supabase Realtime sobre `orders` (respeta RLS: solo personal con `orders.read`). Si la conexión cae, consulta cada 30 s y muestra un indicador “sin conexión en vivo”.
- Sonido y notificación del navegador en pedidos nuevos; contador en la pestaña.
- Vista de cocina simplificada (rol `kitchen`): ítems, opciones y notas en letra grande, botones “En preparación” y “Listo”.
- Ticket imprimible por pedido (CSS de impresión, papel de 80 mm).
- Botón de WhatsApp al cliente con mensaje precargado (“Tu pedido #0123 va en camino”).

### 6.4 Venta manual (WhatsApp, teléfono, mostrador)

Pantalla tipo punto de venta en el panel: buscar productos, elegir opciones, cliente opcional (o “consumidor final”), entrega/recogida/en el local, método de pago. Usa **la misma** función `create_order` con `channel` = `whatsapp`/`phone`/`counter` y `created_by` = empleado, y se puede confirmar en el mismo paso. Así toda venta descuenta inventario y aparece en los reportes, sin importar por dónde llegó.

### 6.5 WhatsApp (opcional, nunca obligatorio)

- **Fase 1 — sin integración:** enlaces `wa.me` con texto precargado: botón flotante de contacto, “consultar por mi pedido #0123” en la página de seguimiento, y mensajes del personal al cliente desde el panel. Cero costo, cero credenciales.
- **Fase 6 — opcional:** WhatsApp Cloud API de Meta para avisos automáticos de estado desde una Edge Function. Requiere cuenta de WhatsApp Business verificada, número dedicado, plantillas aprobadas por Meta y tiene costo por conversación. Si falla, el pedido sigue igual: el correo y la página de seguimiento son el canal garantizado.

---

## 7. Pagos

### 7.1 Métodos sin pasarela (disponibles desde el día uno)

Configurables en `payment_methods` (nombre, instrucciones, si aplica a domicilio o recogida, si pide comprobante):

| Método | Cómo funciona en el sistema |
|---|---|
| Efectivo contra entrega / en el local | Campo “¿Con cuánto pagas?” para llevar el cambio |
| Datáfono contra entrega | Solo si el restaurante tiene datáfono móvil |
| Nequi / Daviplata / transferencia bancaria | Se muestran número o cuenta e instrucciones; el cliente puede subir el comprobante; el personal verifica en su app y marca **pagado** antes de confirmar |
| Bre-B (llave o QR) | Sistema de pagos inmediatos del Banco de la República, interoperable entre bancos y billeteras. Se muestra la llave del negocio o su QR. Misma verificación manual |

Riesgo de los pagos manuales: comprobantes falsos. Mitigación: el pedido no pasa a “Confirmado” hasta que alguien con permiso `payments.verify` revise el ingreso en la cuenta.

### 7.2 Pasarelas viables en Colombia (investigación, **no integradas**)

| Proveedor | Métodos relevantes | Notas |
|---|---|---|
| **Wompi** (Grupo Bancolombia) | Tarjetas, PSE, Nequi, botón Bancolombia, QR | Integración más fuerte con Nequi; anunció tarifa de QR al 1 % (sept. 2026). Buena opción si la cuenta es Bancolombia |
| **Bold** | Tarjetas, PSE, Nequi, enlaces de pago, datáfonos | Conveniente si ya usan datáfono Bold: una sola conciliación |
| **Mercado Pago** | Tarjetas, PSE, cuotas | Marca conocida; checkout robusto |
| **ePayco** | Tarjetas, PSE, Nequi, efectivo (Efecty, etc.) | Buena cobertura de pagos en efectivo |
| **PayU** | Tarjetas, PSE, efectivo, cuotas | Veterano en el país; integración más pesada |

Las comisiones efectivas que reportan blogs comparativos rondan el **2,5 %–2,9 % + IVA** según la mezcla de métodos; **no son tarifas oficiales** y se deben confirmar con cada proveedor antes de decidir. Para un restaurante con pedidos de $15.000–$65.000 y pago contra entrega muy común, recomiendo arrancar con efectivo + transferencias/Bre-B y evaluar Wompi o Bold cuando haya volumen.

### 7.3 Cómo quedará preparada la arquitectura para una pasarela

- `payment_methods.is_online`, tablas `payments` y `payment_events` ya en el esquema.
- Edge Function `payments-create`: toma el total **desde la base** y crea la sesión de pago en el proveedor.
- Edge Function `payments-webhook`: verifica la firma del proveedor, es idempotente por `provider_tx_id`, marca el pago y (si está configurado) confirma el pedido.
- El pedido nunca se marca pagado por la redirección del navegador, solo por el webhook verificado.
- Llaves privadas solo en Supabase Secrets.

Nada de esto se implementa hasta definir proveedor y credenciales.

---

## 8. Lógica transaccional del inventario

### 8.1 Cuándo se descuenta (definición)

- **No hay reserva.** Al crear el pedido solo se **verifica** disponibilidad (aviso, no bloqueo de stock).
- **Se consume al confirmar el pedido** (estado de tipo `confirmed`). Es el momento en que cocina se compromete a prepararlo.
- **Cancelar antes de confirmar:** no toca inventario.
- **Cancelar después de confirmar:** el responsable elige *“reintegrar”* (no se preparó → `sale_reversal`) o *“registrar merma”* (se preparó → los insumos quedan perdidos y se registra `waste` informativo; el stock no vuelve).

Justificación: la reserva tiene sentido con pagos en línea o pedidos programados; aquí los pedidos se preparan en minutos y una reserva solo añade estados intermedios que se desincronizan.

### 8.2 Funciones SQL (todas `security definer`, con verificación de permisos dentro)

1. **`create_order(payload, idempotency_key)`** — recalcula precios desde la base (ignora totales del navegador), valida disponibilidad y horario, calcula domicilio por zona, inserta todo en una transacción. Si la `idempotency_key` ya existe, devuelve el pedido existente (doble clic, reintento de red).
2. **`confirm_order(order_id)`** — en una transacción:
   1. `SELECT … FOR UPDATE` del pedido; si `inventory_state <> 'none'` → no hace nada (idempotente).
   2. Expande receta de cada ítem + variante + modificadores × cantidad, con merma.
   3. Bloquea las filas de ingredientes **en orden por id** (evita interbloqueos entre dos confirmaciones simultáneas).
   4. Escribe un movimiento por ingrediente con saldo antes/después y usuario.
   5. Actualiza `stock_qty` y marca `inventory_state = 'consumed'`.
   6. Abre alertas de stock bajo/agotado si corresponde.
   7. Si un ingrediente `is_critical` queda en 0, marca no disponibles los productos `auto_by_stock` que lo usan.
   - Índice único `(order_id, ingredient_id, type)` en movimientos como segunda barrera contra el doble descuento.
   - **Stock negativo:** permitido pero genera alerta de diferencia. Bloquear la venta porque el sistema dice 0 cuando en la cocina sí hay producto frena la operación; la diferencia se corrige con un conteo. (Configurable.)
3. **`cancel_order(order_id, mode)`** — reintegro o merma según 8.1, idempotente.
4. **`receive_stock(receipt_payload)`** — suma stock, recalcula costo promedio, crea lotes con vencimiento, actualiza la orden de compra.
5. **`adjust_stock(ingredient_id, qty, type, reason)`** — requiere permiso `inventory.adjust` y motivo obligatorio.
6. **`apply_stock_count(count_id)`** — convierte diferencias en ajustes.

Las tablas de inventario **no** tienen permisos de INSERT/UPDATE directos para ningún rol del navegador: solo se modifican mediante estas funciones. El kardex es de solo inserción.

Un trabajo programado diario (`pg_cron`) revisa lotes próximos a vencer y abre alertas.

---

## 9. Seguridad

- RLS en todas las tablas. Público anónimo: solo lectura de catálogo activo y configuración pública.
- Clientes: solo sus `customers`, direcciones y pedidos (`customers.user_id = auth.uid()`).
- Seguimiento sin cuenta: RPC `get_order_by_token(token)` que devuelve campos limitados (estado, ítems, total), nunca teléfono ni dirección completa.
- Personal: según `has_permission()`.
- `service_role` solo en Edge Functions (Supabase Secrets). El navegador solo conoce la `anon key`.
- Anti-spam en pedidos de invitados: límite por teléfono/IP en `create_order` + **Cloudflare Turnstile** (opcional, recomendado).
- Cabeceras CSP, HSTS y `X-Frame-Options` vía `_headers` de Cloudflare Pages.
- Subida de imágenes: bucket `product-images` con política de escritura solo para `catalog.manage`, tipos y tamaño validados.
- Comprobantes de pago: bucket **privado** `payment-proofs`; el cliente solo sube al suyo, el personal con `payments.verify` lo ve mediante URL firmada temporal.
- Auditoría por trigger en precios, recetas, permisos, ajustes y cancelaciones.

## 10. Correos

- Supabase Auth → SMTP de Resend con plantillas propias: verificación, recuperación, cambio de correo.
- Edge Function `send-email` (llamada desde `order-events`, disparada por Database Webhook al cambiar estado): bienvenida, confirmación de pedido, cambio de estado, entregado, alertas de stock al personal.
- Cada envío queda en `email_logs`. Plantillas HTML con tablas (compatibles con Gmail/Outlook), logo y colores de marca.

## 11. Reportes

Funciones SQL con rango de fechas (zona Bogotá) y exportación CSV desde el navegador. Términos fijos en toda la app:

- **Ventas brutas** = Σ total de pedidos entregados.
- **Costo de insumos (CMV)** = Σ costo de movimientos `sale_consumption` − reintegros.
- **Margen bruto** = ventas − CMV.
- **Gastos operativos** = tabla `expenses`.
- **Utilidad operativa estimada** = margen bruto − gastos operativos − mermas.

Nunca se llama “ganancia neta” (no incluye impuestos ni todo lo contable).

---

## 12. Plan por fases (ajustado)

| Fase | Entregable | Prueba de cierre |
|---|---|---|
| 1 | Proyecto Vite, sistema de diseño, sitio público con menú **leído de Supabase** (sin datos inventados: catálogo vacío o cargado tras confirmación) | Lighthouse ≥ 90 móvil, revisión en 375 px |
| 2 | Migraciones 0001–0008, Auth, roles, RLS | pgTAP de RLS: un cliente no ve pedidos de otro |
| 3 | Shell del panel, dashboard con datos reales | Dashboard vacío sin errores; datos tras pedidos de prueba |
| 4 | Ingredientes, unidades, recetas, kardex, compras, proveedores, alertas, conteos | pgTAP: doble confirmación, cancelación, concurrencia, conversión |
| 5 | Catálogo admin, zonas y tarifas, métodos de pago, horarios, carrito, checkout, seguimiento, pedidos en tiempo real, vista de cocina, venta manual, clientes y direcciones | Playwright: pedido de invitado a domicilio → confirmar → stock descontado; barrio fuera de cobertura rechazado; doble clic = un solo pedido |
| 6 | Correos, notificaciones internas, enlaces de WhatsApp; WhatsApp Cloud API solo si se aprueba | Envío real a un buzón de prueba |
| 7 | Reportes (incluye ventas por canal y por método de pago), CSV, configuración | Cifras cruzadas contra SQL manual |
| — | Pasarela de pago | Solo tras elegir proveedor y recibir credenciales de prueba |
| 8 | Auditoría de seguridad, rendimiento, despliegue en Cloudflare Pages + dominio | Checklist de producción |

Propongo hacer **la Fase 2 (esquema) junto con la 1**, porque el menú público debe leer de Supabase desde el primer día.

---

## 13. Lo que necesito del restaurante / de ti

1. **Precios vigentes**: ¿valen los últimos que tenían en Vinapp o los de la web actual?
2. **Productos**: ¿sigue *Muchacho en salsa de coco*? ¿Pechuga/Crunchy/Tenders de Nelcy y Soda Hatsu van en el menú?
3. **Horario real** (web dice 11–22/23; Vinapp decía 10:30–23). ¿Hasta qué hora reciben pedidos a domicilio?
4. **Salsas**: ¿el combo incluye una salsa a elegir sin costo? ¿cuántas según el tamaño? ¿o toda salsa cuesta $1.000?
5. **Domicilios**: ¿reparto propio? ¿Qué barrios cubren, agrupados en zonas con su tarifa? ¿pedido mínimo? ¿domicilio gratis desde algún valor? ¿tiempo estimado?
6. **Métodos de pago** aceptados (efectivo, Nequi, Daviplata, transferencia, Bre-B, datáfono contra entrega). ¿En qué banco está la cuenta del negocio? (Influye en elegir pasarela más adelante.)
7. **Confirmación de pedidos**: ¿el personal confirma cada pedido web a mano (recomendado al inicio) o se confirman solos?
8. **Recetas y cantidades reales** por producto (gramos de alitas por presa, papas por porción, ml de salsa, empaques). Es el dato que hace funcionar el inventario; puedo darles una plantilla de hoja de cálculo.
9. **Inventario inicial**: lista de insumos, unidades, existencias y costos actuales; proveedores.
10. **Fotos originales** en alta resolución (las de Vinapp no se reutilizan desde su CDN). Logo en vector (SVG/AI/PDF).
11. **Dominio** alitasnelcy.com: ¿quién lo administra y quién hospeda el sitio actual? Necesitaremos acceso al DNS para correo (Resend) y despliegue.
12. **Supabase**: crea el proyecto (región `us-east-1` o `sa-east-1` São Paulo, más cercana) y compárteme solo la URL y la `anon key`. La `service_role` va directo a Supabase Secrets, nunca por chat.
13. Correo remitente deseado (ej. `pedidos@alitasnelcy.com`) y correo/WhatsApp donde el personal recibe alertas.
14. ¿Pedidos para comer en el local (mesa) además de domicilio y recogida?
15. **WhatsApp**: ¿basta con enlaces `wa.me` o quieren avisos automáticos (requiere WhatsApp Business API de Meta, verificación y costo por conversación)?
16. ¿Tienen impresora térmica para tickets de cocina? (modelo y ancho de papel)

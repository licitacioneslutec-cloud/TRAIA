# TRIA Capital — Reporte de Compra de Oro

## Qué es
App web mobile-first (HTML único) para registrar compras de oro, con sistema de cierre de transacciones, dashboard analítico y gestión de usuarios. Desplegada en Netlify via GitHub. Usa Firebase Realtime Database. Instalable como PWA.

## Stack
- **Frontend:** HTML + CSS + JS vanilla (un solo archivo `index.html`)
- **DB:** Firebase Realtime Database → `https://traia-capital-default-rtdb.firebaseio.com/`
- **CDN:** `xlsx.full.min.js` (export Excel), `Chart.js 4.4.1` (dashboard), Firebase compat SDK 10.12.0
- **APIs externas:**
  - Oro spot: `https://api.gold-api.com/price/XAU`
  - TRM oficial: `https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1`
- **Deploy:** GitHub repo (`licitacioneslutec-cloud/TRAIA`) → Netlify (auto-deploy)
- **PWA:** `manifest.json` + `sw.js` (cache offline) + `icon.svg`

## Diseño
- Paleta: azul marino oscuro `#070e1a` (bg), `#0f1f35` (cards), `#e8ecf2` (texto)
- Logo SVG inline: 3 paralelogramos blanco/gris (recreación del logo TRIA Capital)
- Mobile-first, max-width 480px, tab bar fija abajo
- Tema dark con acentos verdes para utilidades positivas, rojos para negativas

## Seguridad
- **Firebase Authentication (email/password):** La app ya no maneja hashes ni compara PINs. Firebase Auth guarda credenciales con bcrypt interno, aplica lockout nativo tras intentos fallidos, y expide tokens de sesión.
- **Email interno sintético:** `slug(nombre)@tria.local` (invisible al usuario — la UI sigue siendo "nombre + PIN"). `slug` normaliza tildes y caracteres especiales.
- **Password interna:** `<pin>TRIA` (sufijo para cumplir el mínimo de 6 chars que exige Firebase; el PIN de 4 dígitos sigue siendo lo que el usuario digita).
- **`mustChangePin` flag:** Usuarios recién creados o migrados tienen este flag → pantalla full-screen que bloquea el acceso hasta que cambien el PIN temporal.
- **Firebase rules aplicadas:** `firebase-rules.json` restringe lectura/escritura a `auth != null`; escritura a `/users` solo por admin.
- **XSS:** Función `esc()` aplicada en todo innerHTML que interpola datos de usuario.
- **Session timeout:** Auto-logout tras 15 min de inactividad (llama `firebase.auth().signOut()`).
- **Admin agrega usuarios sin perder sesión:** App secundaria `firebase.initializeApp(cfg, 'adm')` para crear cuentas sin que el admin autenticado pierda su sesión.

## Usuarios (Firebase Auth + `/users/<auth.uid>`)
- **Autenticación:** cuenta en Firebase Authentication con email `slug(nombre)@tria.local`.
- **Perfil en RTDB:** `/users/<auth.uid>` guarda `{name, role, mustChangePin?}` — sin PIN, sin hash.
- **Nombres inmutables:** la app no permite cambiar nombre (requeriría mover la cuenta de Auth). Admin usa Firebase Console para renombrar/borrar.
- **Reset de PIN de otro / eliminar usuario:** Firebase Console → Authentication (la app NO tiene estos botones; aviso al pie de la pestaña Admin con link directo).
- **Login:** dos campos (nombre + PIN de 4 dígitos). Firebase Auth hace lockout automático.

## Permisos
- **Todos** ven reportes de **todos** los operadores (gracias a `.read: "auth != null"` en reglas).
- **Reglas de escritura en reports:** solo el dueño (`odId === auth.uid`) o un admin puede modificar; cualquier usuario autenticado puede crear.
- **Admin** además: crear reportes a nombre de cualquier operador, agregar usuarios desde la app, ver dashboard completo, editar/deshacer cierres de cualquier operador.
- **Admin NO puede** desde la app: resetear PIN ajeno, eliminar usuarios, renombrar — todo eso va por Firebase Console.

## Fórmula de cálculo
```
CIERRE       = DÓLAR (TRM) × ONZA (USD)
GRAMO 100%   = CIERRE ÷ 31.1035
GRAMO CIERRE = GRAMO 100% × (% REGALÍAS / 100)     ← default 95%
P CIERRE     = GRAMOS FINO × GRAMO CIERRE
V COMPRA     = GRAMOS FINO × PRECIO COMPRA POR GRAMO
U BRUTA      = P CIERRE − V COMPRA
U TRIA       = U BRUTA × (100 − % OPERADOR) / 100
U OPERADOR   = U BRUTA × % OPERADOR / 100 − GASTOS
U NETA       = U TRIA + U OPERADOR
```
- Factor conversión onza→gramo: **31.1035** (fijo)
- Regalías: % minero (~5%), por eso se aplica 95% al gramo. Editable por transacción.
- **% Operador:** Configurable (default 50%). Los gastos se deducen SOLO de la utilidad del operador, no de TRIA.
- **Referencia bruto×ley:** Si `gramosBruto` y `ley` están ingresados, se muestra el fino calculado como referencia. Alerta si difiere ±10g del fino ingresado.

## Campos de peso
- **Gramos Bruto** (`gramosBruto`): Peso bruto de la compra
- **Ley** (`ley`): Pureza del oro (0-1, ej: 0.850)
- **Gramos Fino** (`gramos`): Peso fino real (el que se usa en todos los cálculos)
- Referencia: `bruto × ley` se muestra como hint. Alerta si |fino − bruto×ley| > 10g

## Estructura Firebase
```
/users/<auth.uid>   → { name, role, mustChangePin? }
/reports/{reportId} → { id, odId, operador, creadoPor, fecha, hora, proveedor,
                        comentarios, gramosBruto, ley, gramos, dolar, onza,
                        pCompra, gastos, porcRegalias, pctOperador,
                        cierre, gr100, grCierre, pCierre, vCompra,
                        uBruta, uNeta, uOperador, uTria,
                        closingId, createdAt }
/closings/{id}      → { id, ley, leyMixed, reportIds[], totalGramosBruto,
                        totalGramosFino, totalVCompra, totalUNeta,
                        totalUTria, totalUOperador, creadoPor, fecha, createdAt }
/alerts/{id}        → { id, reportId, bruto, ley, finoCalculado, finoIngresado,
                        diferencia, fecha, operador, odId, timestamp }
```
- `odId` = `auth.uid` del operador dueño del reporte
- `creadoPor` = nombre de quien creó (puede ser admin creando a nombre de otro)
- `closingId` = referencia al cierre (null si el reporte está abierto)
- `pctOperador` = porcentaje de utilidad para el operador (default 50)
- `leyMixed` = true si el cierre mezcla reportes con diferentes leyes

## Tabs por rol

### Operador (5 tabs)
1. **Apertura** — precios en vivo + formulario (bruto/ley/fino, compra, gastos, regalías, % operador) + cálculo en tiempo real + guardar
2. **Cierre** — seleccionar reportes abiertos para cerrar, agrupados por ley. Warning informativo si <1kg. Permite mezclar leyes. Deshacer cierres.
3. **Historial** — todos los reportes (filtrables por operador), totales, exportar Excel, detalle modal con split de utilidad
4. **Dash** — KPIs + 5 gráficos (utilidad neta, spread, ROI, acumulados, por operador) + tabla resumen por operador. Filtros por fecha y operador.
5. **Perfil** — cambiar PIN, ver fuentes de datos

### Admin (6 tabs)
1. **Apertura** — igual + selector "registrar a nombre de" (elige operador)
2. **Cierre** — ve, cierra y **edita** cierres de cualquier operador
3. **Historial** — igual
4. **Dash** — igual
5. **Admin** — Lista usuarios (nombre + rol + badge "PIN TEMPORAL" si aplica). Agregar usuario (nombre + PIN inicial + rol). Reset/eliminar van por Firebase Console (aviso con link).
6. **Perfil** — igual

## Dashboard (5 gráficos)
1. **Utilidad Neta por Operación** — barras verdes/rojas según ganancia/pérdida
2. **Precio Compra vs Gramo Cierre** — barras agrupadas mostrando margen por gramo
3. **Margen % por Operación (ROI)** — línea con fill, línea cero de referencia
4. **Inversión vs Utilidad Acumulada** — dos líneas acumulativas
5. **Distribución por Operador** — barras horizontales stacked (U. Operador + U. TRIA)
- Tabla resumen por operador: #operaciones, gramos, U. Neta, U. TRIA
- Filtros: rango de fechas + chips por operador

## Cierre de transacciones
- Reportes sin `closingId` aparecen como abiertos, agrupados visualmente por ley
- Se pueden mezclar reportes con diferentes leyes (warning informativo, no bloqueante)
- Warning informativo si la selección no alcanza 1kg (no bloqueante)
- Cierre crea registro atómico en `/closings` y marca cada reporte con `closingId`
- Reportes cerrados muestran badge "CERRADO" en historial y modal, y **bloquean edición y eliminación** desde el detalle (aviso para gestionar desde la pestaña Cierre)
- Admin y creador del cierre pueden deshacerlo (borra closing + limpia closingId de reportes)
- **Editar cierre** (admin / creador): reusa la pestaña Cierre en modo edición — pre-marca los reportes incluidos, permite agregar reportes abiertos o quitar los existentes, botón pasa a "Actualizar cierre". Recalcula totales y remapea `closingId` de los reportes afectados en una sola transacción.
- Durante edición, los listeners de Firebase no re-renderizan la pestaña (evita perder la selección si otro usuario modifica datos en vivo). Reanudan al guardar o cancelar.

## Export Excel
- Columnas: FECHA, HORA, OPERADOR, PROVEEDOR, GR BRUTO, LEY, GR FINO, ONZAS_TROY, DOLAR, ONZA, CIERRE, CONVERSION, GR 100%, % REGALIAS, GR CIERRE, P CIERRE, P COMPRA, V COMPRA, U BRUTA, GASTOS, % OP, U NETA, U OPERADOR, U TRIA, CERRADO, COMENTARIOS
- Exporta solo los reportes visibles (según filtro activo)
- Usa Blob + `URL.createObjectURL` (compatible móvil)

## PWA
- `manifest.json` — app standalone, orientación portrait, tema `#070e1a`
- `sw.js` — service worker con estrategia network-first (app) + cache-first (CDN libs)
- `icon.svg` — ícono SVG con "TRIA CAPITAL"
- Registrado al final del JS: `navigator.serviceWorker.register('sw.js')`
- Apple meta tags para iOS (capable, status bar, title)

## Precios en vivo
- Se cargan automáticamente al entrar
- Botón refresh manual con hora de última actualización
- Ambos editables manualmente para ajustar al dólar real del Banco de Bogotá
- La TRM oficial ≠ tasa Banco de Bogotá (spread del banco ~$20-$80 COP)

## Archivos del proyecto
```
index.html          — App completa (HTML + CSS + JS)
manifest.json       — Manifiesto PWA
sw.js               — Service worker (cache offline)
icon.svg            — Ícono de la app
firebase-rules.json — Reglas de seguridad (ACTIVAS, requieren Firebase Auth)
migrate.html        — Página one-shot de migración de auth custom → Firebase Auth (histórica)
SECURITY_AUDIT.md   — Reporte estático de auditoría (findings 1, 3, 4, 5 resueltos con la migración a Firebase Auth)
TRIA_CAPITAL_BRIEF.md — Este archivo
```

## Pendiente por implementar
1. **Íconos PNG** — Generar `icon-192.png` e `icon-512.png` desde `icon.svg` para mejor compatibilidad PWA.
2. **Push notifications** — Con el service worker instalado, se pueden agregar notificaciones de alertas ±10g.
3. **Spread offset automático:** Campo en ajustes para configurar un spread fijo (ej: +$50) que se sume a la TRM.
4. **SRI en scripts CDN** — Finding 7 del SECURITY_AUDIT.md (menor).

## Bugs conocidos resueltos
- Firebase RTDB abierto al mundo → reglas `auth != null` aplicadas tras migrar a Firebase Auth
- Hash FNV-1a crackeable para PINs de 4 dígitos → delegado a Firebase Auth (bcrypt interno)
- PINs semilla visibles en el código fuente → eliminados; cuentas creadas vía Firebase Auth
- Reportes dentro de un cierre podían editarse/eliminarse desde Historial → bloqueado con aviso
- Edición de cierre: la selección se perdía si otro usuario modificaba datos en paralelo → listener omite re-render durante edición
- PINs en texto plano → hasheados con FNV-1a → (ahora) delegado a Firebase Auth
- XSS en innerHTML → función `esc()` aplicada
- `prompt()` para editar nombre → modal reutilizado → (ahora) nombres inmutables, gestión en Firebase Console
- Session sin timeout → auto-logout 15 min
- Login sin rate limiting → lockout tras 5 intentos → (ahora) lockout nativo de Firebase Auth
- IDs con espacio (`porcRegaliasDis play`) → corregido
- `XLSX.writeFile` falla en móvil → Blob + createObjectURL
- `xlsx.min.js` incompleto → `xlsx.full.min.js`
- `window.storage` no persiste → migrado a Firebase

## Historia de migraciones
- **2026-10 — Migración a Firebase Auth:** `migrate.html` creó cuentas en Firebase Authentication para los 4 usuarios existentes (ADMINISTRADOR, DANIEL GIRALDO, DANIEL HERRERA, FELIPE GUTIERREZ), remapeó `reports.odId` y `alerts.odId` de los IDs viejos (`u1..u4`) a los nuevos `auth.uid`, y limpió los nodos viejos. PIN temporal post-migración: `0000` (cada usuario forzado a cambiarlo al primer login vía `mustChangePin`).

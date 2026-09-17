# TRIA Capital — Reporte de Compra de Oro

## Qué es
App web mobile-first (HTML único) para registrar compras de oro. Desplegada en Netlify via GitHub. Usa Firebase Realtime Database para sincronización entre dispositivos.

## Stack
- **Frontend:** HTML + CSS + JS vanilla (un solo archivo `index.html`)
- **DB:** Firebase Realtime Database → `https://traia-capital-default-rtdb.firebaseio.com/`
- **CDN:** `xlsx.full.min.js` (export Excel), Firebase compat SDK 10.12.0
- **APIs externas:**
  - Oro spot: `https://api.gold-api.com/price/XAU`
  - TRM oficial: `https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1`
- **Deploy:** GitHub repo → Netlify (auto-deploy)

## Diseño
- Paleta: azul marino oscuro `#0d1b2e` (header/login), fondo claro `#f3f5f8` (body)
- Logo SVG inline: 3 paralelogramos blanco/gris (recreación del logo TRIA Capital)
- Mobile-first, max-width 480px, tab bar fija abajo

## Usuarios (Firebase `/users`)
| ID | Nombre | PIN | Rol |
|----|--------|-----|-----|
| u1 | ADMINISTRADOR | 0000 | admin |
| u2 | DANIEL GIRALDO | 1234 | operador |
| u3 | OPERADOR 2 | 5678 | operador |
| u4 | OPERADOR 3 | 9012 | operador |

- Login: dos campos de texto (nombre + PIN), NO dropdown
- Nombres se comparan en uppercase

## Permisos
- **Todos** ven reportes de **todos** los operadores
- **Solo pueden eliminar** los propios, excepto admin que elimina cualquiera
- **Admin** además: crear reportes a nombre de cualquier operador, gestionar usuarios (CRUD + cambiar PINs)

## Fórmula de cálculo (cadena completa)
```
CIERRE       = DÓLAR (TRM) × ONZA (USD)
GRAMO 100%   = CIERRE ÷ 31.1035
GRAMO CIERRE = GRAMO 100% × (% REGALÍAS / 100)     ← default 95%, editable por transacción
P CIERRE     = GRAMOS × GRAMO CIERRE
V COMPRA     = GRAMOS × PRECIO COMPRA POR GRAMO
U BRUTA      = P CIERRE − V COMPRA
U NETA       = U BRUTA − GASTOS
U OPERADOR   = U NETA / 2
U TRIA       = U NETA / 2
```
- Factor conversión onza→gramo: **31.1035** (fijo)
- Regalías: % minero pagado al Estado (~5%), por eso se aplica 95% al gramo. **Editable por transacción.**

## Estructura Firebase
```
/users/{userId}    → { id, name, pin, role }
/reports/{reportId} → { id, odId, operador, creadoPor, fecha, hora, proveedor,
                         comentarios, gramos, dolar, onza, pCompra, gastos,
                         porcRegalias, cierre, gr100, grCierre, pCierre, vCompra,
                         uBruta, uNeta, uOperador, uTria, createdAt }
```
- `odId` = ID del operador dueño del reporte
- `creadoPor` = nombre de quien creó (puede ser admin creando a nombre de otro)

## Tabs por rol

### Operador (3 tabs)
1. **Calcular** — precios en vivo + formulario + cálculo en tiempo real + guardar
2. **Historial** — todos los reportes (filtrables por operador), totales, exportar Excel, detalle modal
3. **Perfil** — cambiar PIN, ver fuentes de datos

### Admin (4 tabs)
1. **Calcular** — igual + selector "registrar a nombre de" (elige operador)
2. **Historial** — igual
3. **Admin** — CRUD usuarios, ver/cambiar PINs
4. **Perfil** — igual

## Export Excel
- Usa `xlsx.full.min.js` (NO `xlsx.min.js` — falla en móvil)
- Descarga con Blob + `URL.createObjectURL` (NO `XLSX.writeFile` — falla en móvil)
- Columnas: FECHA, HORA, OPERADOR, PROVEEDOR, GRAMOS, DOLAR, ONZA, CIERRE, CONVERSION, GR 100%, % REGALIAS, GR CIERRE, P CIERRE, P COMPRA, V COMPRA, U BRUTA, GASTOS, U NETA, U OPERADOR, U TRIA, COMENTARIOS
- Exporta solo los reportes visibles (según filtro activo)

## Precios en vivo
- Se cargan automáticamente al entrar
- Botón refresh manual con hora de última actualización
- Ambos editables manualmente (✏️) para ajustar al dólar real del Banco de Bogotá
- La TRM oficial ≠ tasa Banco de Bogotá (spread del banco ~$20-$80 COP)

## Pendiente por implementar
1. **Spread offset automático:** Campo en ajustes donde se configure un spread fijo (ej: +$50) que se sume a la TRM para aproximar la tasa Banco de Bogotá sin editar manualmente cada vez.

## Bugs conocidos resueltos
- IDs con espacio (`porcRegaliasDis play`) → corregido a `porcRegaliasDisplay`
- ID mismatch (`operatorDisplay` vs `operadorDisplay`) → unificado
- `XLSX.writeFile` falla en móvil → cambiado a Blob + createObjectURL
- `xlsx.min.js` incompleto → cambiado a `xlsx.full.min.js`
- `window.storage` no persiste en hosting real → migrado a Firebase

## Archivo fuente
El archivo actual es `tria_reporte_oro.html` (o `index.html` en el repo). Todo está en un solo archivo HTML autocontenido.

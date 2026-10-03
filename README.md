# Spendly – Control de gastos privado

App de control de gastos **rápida, sin conexión, sin cuenta, sin servidor y sin rastreo**. Se instala en la pantalla de inicio del iPhone como una app nativa. HTML/CSS/JavaScript puro: sin dependencias ni compilación. **Tus datos se quedan en tu teléfono.**

## Funciones

Revisé las funciones típicas de YNAB, Monarch, Copilot, PocketGuard, Spendee, Wallet, Goodbudget y Money Manager, e incluí lo que es posible sin conexión bancaria automática. Todo es gratis.

| Área | Qué incluye |
|---|---|
| **Resumen mensual (nuevo)** | Tabla **categoría × mes** con totales y **promedio por categoría** (ej. supermercado en junio, julio, agosto y septiembre). Mapa de calor, rango de fechas libre, gastos e ingresos, exportar a CSV. Puedes **ingresar a mano un mes completo** aunque no tengas las compras registradas una por una |
| **Registro** | Gastos, ingresos y transferencias · varias cuentas · categorías propias · etiquetas · notas · **división de una compra en varias categorías** · **fotos de recibos** |
| **Entrada inteligente** | **Reglas** de categoría automática · recuerda la última categoría por comercio · opción "Repetir" |
| **Presupuestos** | Límite mensual por categoría · avisos al 80 % y 100 % · **acumulación** de lo no gastado |
| **Pagos recurrentes** | Arriendo, suscripciones, salario… se registran solos al vencer · próximos pagos · costo mensual/anual |
| **Ideas** | **Disponible para gastar por día** · **proyección** a fin de mes · alertas de categorías sobre tu promedio · tasa de ahorro · días sin gastos |
| **Informes** | Ingresos vs gastos · patrimonio · categorías · comercios principales · etiquetas · día de la semana · imprimir/PDF |
| **Metas** | Metas de ahorro con aporte mensual sugerido |
| **Deudas** | Plan de pago: solo mínimos vs **avalancha** vs **bola de nieve** |
| **Multimoneda** | Cuentas en cualquier moneda, convertidas a tu moneda principal |
| **Datos** | Importar CSV bancario (columnas en español o inglés, `1.234,56` o `1,234.56`, detecta duplicados) · exportar CSV · copia de seguridad JSON · deshacer al borrar |
| **Privacidad** | PIN · modo privado (oculta montos) · claro/oscuro · funciona sin internet |

**No incluye** (requiere servidor o servicios de pago): conexión automática con el banco, sincronización entre dispositivos, cuentas compartidas, notificaciones push. Para pasar datos a otro teléfono usa Copia/Restaurar.

## Instalar en el iPhone (paso a paso)

1. **Publica los archivos** (una sola vez, gratis):
   1. Crea una cuenta en GitHub → **New repository** → nombre `spendly` → **Public** → **Create repository**.
   2. Clic en **uploading an existing file**, arrastra **todos los archivos de esta carpeta** (`index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `README.md`, `LICENSE`, `.gitignore`) → **Commit changes**.
   3. **Settings → Pages** → *Source:* **Deploy from a branch** → *Branch:* `main` y `/ (root)` → **Save**.
   4. En ~1 minuto tu app estará en `https://TU-USUARIO.github.io/spendly/`.
2. **Instala**: abre ese enlace en **Safari** → botón **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.
3. Desde ahora abre Spendly **solo con el ícono de la pantalla de inicio**.

> ⚠️ Safari y el ícono de inicio guardan los datos **por separado**. Usa siempre el ícono.

## Primeros pasos

1. **Ajustes** → elige tu **moneda principal**. (Puedes probar con **Cargar datos de ejemplo** y luego **Borrar todo**.)
2. **Cuentas → ＋ Agregar**: crea tus cuentas con su saldo actual (negativo para deudas de tarjeta).
3. Botón **＋** para registrar gastos, ingresos o transferencias.
4. **Presupuesto → ＋ Agregar**: define límites por categoría.
5. **Pagos → ＋ Agregar**: arriendo, suscripciones, salario.

## Ver cuánto gastas por categoría cada mes (lo nuevo)

1. Abre la pestaña **Mensual**.
2. Arriba elige **Gastos** o **Ingresos**, y el rango: **3 / 6 / 12 meses**, **Este año**, o tus fechas en **Desde / Hasta** (ej. junio a septiembre).
3. Verás cada categoría por mes, con **Total** y **Promedio** al final de cada fila, y el promedio mensual general arriba.
4. **Registrar meses pasados sin cargar cada compra**: toca **✏️ Ingresar los gastos de un mes completo**, elige el mes (ej. junio) y escribe el total de cada categoría (supermercado 420, entretenimiento 90…). Repite con julio, agosto, septiembre.
5. **Corregir un solo dato**: toca la celda (categoría + mes) y cambia el total.
6. Toca el **nombre de una categoría** para ver sus movimientos del rango.
7. **⬇️ Exportar tabla (CSV)** la abre en Excel/Numbers.

Notas:
- Si un mes ya tiene transacciones y escribes un total mayor, la diferencia se guarda como **ajuste manual**. No puede ser menor que lo ya registrado.
- Los ajustes manuales cuentan en presupuestos, informes y promedios, pero **no cambian los saldos de tus cuentas**.
- Promedio = total ÷ cantidad de meses del rango (incluye meses en cero).
- Los meses sin datos aparecen como "–"; por defecto el rango termina en el mes anterior para no distorsionar el promedio con un mes incompleto.

## Uso diario

- **Dividir una compra** (parte supermercado, parte hogar): *Dividir entre categorías*.
- **Recibo**: *Agregar recibo* → foto o galería.
- **Editar/borrar**: toca el movimiento. Al borrar puedes **Deshacer**.
- **Buscar**: pestaña *Movimientos* con filtros.
- **Ocultar montos**: el ojo 👁️ de arriba.
- **Importar CSV del banco**: *Movimientos → Importar CSV*; elige cuenta y formato de fecha (por defecto DD/MM/AAAA). Si tu banco usa "1.234" para mil, se interpreta como 1234.

## Copias de seguridad (importante)

**Ajustes → Copia (JSON)** → en el iPhone elige **Guardar en Archivos**. Hazlo cada semana. Para restaurar: **Ajustes → Restaurar**. La app te avisa si tu última copia es antigua.

## Actualizar la app

Edita o vuelve a subir los archivos en GitHub y cambia `VERSION` en `sw.js` (ej. `spendly-v3`). Cierra y abre la app dos veces.

## Probar en tu computador (opcional)

```bash
python -m http.server 8000
# abre http://localhost:8000
```

## Límites

- El PIN evita miradas curiosas pero **no cifra** los datos.
- Se usa `localStorage` (~5 MB). Los recibos se comprimen, pero muchas fotos pueden llenarlo; la app avisa.
- Tasas de cambio manuales, o botón *Obtener tasas actuales* (usa open.er-api.com, única llamada a internet).

## Licencia
MIT

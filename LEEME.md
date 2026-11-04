# Libro a Dúo

Una app para leer un libro en conjunto con otra persona. Cada uno lo lee en su pantalla (celular o PC) y ven en vivo en qué página está el otro. Pueden dejar postits de texto y de voz pegados a una frase. Acepta PDF, Word (.docx), TXT y Markdown, y arma el texto como un libro con páginas.

Es una PWA: se abre con un link, se instala como app y no usa tiendas. Todo es gratis.

- La app es una página web (GitHub Pages).
- La sincronía, los libros y las notas viven en tu proyecto de Supabase.
- Los dos entran con el mismo **código de sala**. No hay cuentas ni contraseñas.

---

## Puesta en marcha (unos 15 minutos)

### 1. Crear el proyecto en Supabase

1. Entrá a https://supabase.com y creá una cuenta (podés usar GitHub).
2. Tocá **New project**. Poné cualquier nombre, elegí una región cercana (por ejemplo São Paulo) y una contraseña de base de datos (guardala, aunque la app no la usa).
3. Esperá a que termine de crearse.

### 2. Crear las tablas

1. En Supabase, abrí **SQL Editor** y tocá **New query**.
2. Abrí el archivo `supabase/schema.sql` de esta carpeta, copiá todo su contenido, pegalo y tocá **Run**.
3. Tiene que decir **Success**. Se puede correr más de una vez sin problema.

### 3. Pegar tus datos en `config.js`

1. En Supabase, andá a **Project Settings → API**.
2. Copiá la **Project URL** y la clave **anon public**.
3. Abrí `config.js` y reemplazá los dos textos entre comillas.

La clave `anon public` está pensada para ir en el código de una página web. No copies la `service_role`, esa sí es secreta.

### 4. Publicar en GitHub Pages

1. Creá un repositorio nuevo en GitHub (puede ser público).
2. Subí todo el contenido de esta carpeta (`index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.webmanifest`, `icons/`, `supabase/` y `.nojekyll`).
3. En el repositorio: **Settings → Pages → Build and deployment**. En *Source* elegí **Deploy from a branch**, rama **main**, carpeta **/ (root)**, y guardá.
4. A los 1 o 2 minutos aparece el link, con la forma `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

### 5. Usarla

1. Abrí el link, escribí un código de sala (tocá **Crear uno** para generar uno) y tu nombre.
2. En la pantalla de la biblioteca tocá tu nombre arriba a la derecha y después **Copiar enlace de invitación**. Mandáselo a la otra persona: al abrirlo entra directo a tu sala.
3. Subí un libro. Los dos lo ven en la biblioteca y lo abren.

### Instalarla como app

- **Android (Chrome):** botón **Instalar como app** en la biblioteca, o menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**.
- **PC (Chrome o Edge):** ícono de instalar en la barra de direcciones.

---

## Cómo se usa

- **Pasar de página:** botones de abajo, flechas del teclado, tocar el borde de la página o deslizar el dedo. La barra inferior sirve para saltar a cualquier parte.
- **Ver al otro:** abajo aparece su página y si está leyendo ahora. **Ir ahí** te lleva a su página y **Seguir** hace que pases de página junto con él. Una cinta de su color marca en qué página está, y un punto en la barra marca su avance.
- **Postits:** tocá una frase y elegí **Nota** (texto) o **Voz**. La nota queda pegada a esa frase, se ve como una pestaña en el borde de la página y se lista en **Notas**. Solo quien escribió una nota puede borrarla.
- **Voz:** grabás desde la app (el navegador pide permiso para el micrófono) o elegís un audio que ya tengas. Máximo 5 minutos grabando o 4 MB de archivo.
- **Sin conexión:** los libros que ya abriste quedan guardados en el dispositivo y se pueden leer sin internet. Las notas nuevas y la página del otro se actualizan cuando vuelve la conexión.
- **Letra:** botones A− y A+ arriba. Cada uno elige su tamaño.

Las páginas se calculan en cada dispositivo según el tamaño de su pantalla, así que el "pág. 12" de un celular no es el mismo texto que el "pág. 12" de una PC. Lo que se sincroniza es el lugar del texto, y cada pantalla lo traduce a su propio número de página.

## Sobre los archivos

| Formato | Qué esperar |
|---|---|
| TXT / Markdown | Funciona muy bien. Los párrafos se separan por líneas en blanco. |
| Word (.docx) | Toma títulos, párrafos y listas. Se pierden imágenes y formato. Los `.doc` viejos hay que guardarlos como `.docx`. |
| PDF | Toma el texto seleccionable. Detecta títulos, párrafos y palabras cortadas por guion, y descarta números de página y encabezados repetidos. Es una estimación: en PDFs con columnas, tablas o notas al pie puede mezclar cosas. Los escaneos (imágenes) no tienen texto y no se pueden leer. |

Límite: unos 4 millones de caracteres por libro (una novela larga ronda 1 millón) y 30 libros por sala.

## Privacidad

- Nadie puede leer las tablas directamente. La app solo habla con funciones que exigen el código de sala.
- El servidor no guarda tu código: guarda un hash. Quien no conozca el código no puede ver la sala.
- Cualquiera que tenga el código entra. Usá uno largo y no lo publiques.
- Los libros y los audios se guardan en tu proyecto de Supabase, que es tuyo.

## Límites del plan gratis

- **Supabase pausa los proyectos gratis después de 1 semana sin uso.** Si te pasa, entrá al panel de Supabase y tocá **Restore project**. No se pierden los datos.
- La base gratis tiene 500 MB. Un libro de texto ocupa pocos cientos de KB comprimido; los audios son lo que más pesa (un minuto de voz son unos 250 KB).
- GitHub Pages es gratis para repositorios públicos.

## Si algo falla

- **"Falta conectar la sala":** no pegaste bien la URL y la clave en `config.js`, o no subiste el archivo actualizado. Después de subirlo, recargá la página (en el celular, cerrá la app y abrila de nuevo).
- **No aparecen las notas o la página del otro al instante:** la app sincroniza en vivo y además consulta cada 12 segundos. Si el en vivo no anda, en Supabase revisá **Realtime → Settings** y que esté activo "Allow public access". Aunque falle, todo se actualiza con unos segundos de demora.
- **No funciona el micrófono:** revisá el permiso del sitio en el navegador. Mientras tanto, **Elegir audio** deja usar una nota de voz que ya tengas.
- **Subí una versión nueva y no cambia:** cerrá y abrí la app. Si sigue igual, en el navegador borrá los datos del sitio.
- **Error al ejecutar el SQL:** copiá el archivo completo, sin cortar el principio ni el final.

## Contenido de la carpeta

```
index.html            la página
app.js                la lógica
styles.css            el diseño
config.js             TUS datos de Supabase (lo único que editás)
sw.js                 funcionamiento sin conexión
manifest.webmanifest  datos para instalarla como app
icons/                íconos
supabase/schema.sql   tablas y funciones para pegar en Supabase
.nojekyll             le indica a GitHub Pages que sirva los archivos tal cual
```

La primera vez que se abre, la app descarga tres librerías de internet (Supabase, lector de PDF y lector de Word) y las guarda en el dispositivo.

## Actualización 2 (lista de lectura, porcentaje, buscador, "Seguir")
1. Copiá los archivos nuevos encima de tu carpeta (NO se toca `config.js`).
2. En la terminal, dentro de la carpeta: `npx supabase db push` (crea la tabla de la lista y la columna del porcentaje).
3. `git add -A`, `git commit -m "actualizacion"`, `git push`.
4. En Supabase: Project Settings > Realtime: dejá activado "Allow public access". Si está apagado, la app sigue andando pero con unos segundos de demora (se ve "Con demora" abajo).
Los libros subidos antes de esta versión muestran el porcentaje aproximado hasta que se vuelven a subir.

## Actualización 3 (contraseña opcional, administrador, música)
1. Copiá los archivos encima de tu carpeta (no se toca `config.js`).
2. Base de datos: `npx supabase db push --remote` (o pegá `supabase/migrations/20261104000000_sala_admin.sql` en el SQL Editor de Supabase y tocá Run).
3. `git add -A`, `git commit -m "sala admin y musica"`, `git push`. Recargá la app dos veces.
4. Las salas nuevas (con "Crear uno") quedan con administrador desde el principio. Para reclamar una sala que ya existía, abrí la app con la dirección terminada en `#admin` (por ejemplo `https://reddragonstoe.github.io/libro-a-duo/#admin`), entrá a "Tu sala" y tocá "Ser el administrador". Sin ese enlace el botón no aparece.
- Cuando se crea una sala nueva con "Crear uno", la app pregunta si querés contraseña (por defecto no).
- El administrador lo es en ese dispositivo: si borrás los datos del navegador, perdés la administración.
- Quitar a alguien lo saca de la sala; para que no vuelva con otro dispositivo, ponele contraseña.
- Música: botón ♪. Pegá el enlace de una lista de YouTube o YouTube Music (con `list=`).

## Actualización 5 (código y país visibles en el administrador local)
1. Copiá los archivos encima de tu carpeta (no se toca `config.js`).
2. En el SQL Editor de Supabase, pegá y corré, en este orden, los archivos `supabase/migrations/20261105000000_codigo_sala.sql` y `supabase/migrations/20261106000000_pais.sql`.
3. `git add -A`, `git commit -m "codigo y pais"`, `git push`, y recargá la app dos veces.
- Desde ahora, cada vez que alguien entra a una sala la app guarda en la base el código de la sala y el país aproximado (solo el código de 2 letras, sin IP), para que el dueño del proyecto los vea en el administrador local. Las salas aparecen con su código cuando alguien entra a ellas con la versión nueva.

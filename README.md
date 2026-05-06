# Mi Entrenamiento — PWA Fitness Tracker

Aplicación web progresiva (PWA) para personal trainers. Funciona offline y es instalable en Android e iOS.

## Estructura de archivos

```
mi-entrenamiento/
├── index.html
├── styles.css
├── app.js
├── manifest.json
├── service-worker.js
└── icons/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    └── icon-512.png
```

## Despliegue en GitHub Pages

1. Crear un repositorio nuevo en GitHub (ej: `mi-entrenamiento`)
2. Subir todos los archivos a la rama `main`
3. Ir a **Settings → Pages → Source: Deploy from branch → main → / (root)**
4. La app estará disponible en: `https://TU-USUARIO.github.io/mi-entrenamiento/`

## Instalar como PWA

### Android (Chrome)
1. Abrí la URL en Chrome
2. Tocá el menú (⋮) → "Agregar a pantalla de inicio" o esperá el banner automático
3. Confirmá la instalación

### iPhone/iPad (Safari)
1. Abrí la URL en Safari
2. Tocá el botón Compartir (□↑)
3. Seleccioná "Agregar a pantalla de inicio"
4. Confirmá

## Características

- ✅ Registro de entrenamientos con tipo, series, reps, peso y notas
- ✅ Gráficos de actividad semanal y peso máximo por ejercicio
- ✅ Configuración de nombre, objetivo y días de entrenamiento
- ✅ Datos guardados en localStorage (sin servidor)
- ✅ Funciona offline (Service Worker + cache estático)
- ✅ Instalable como app nativa en Android e iOS
- ✅ Diseño responsive optimizado para celulares

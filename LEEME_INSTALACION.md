# GUAYACA Transport · front v0.1.2 de prueba

Requiere Node.js LTS. En la carpeta del front:

```bash
npm ci
cp .env.example .env
npm run dev
```

En desarrollo, `VITE_API_URL=http://localhost:8080/api` funciona si navegador y API están en la misma computadora. Cuando acceda desde un teléfono, `localhost` se refiere al teléfono. Para producción con Nginx en el mismo dominio use `VITE_API_URL=/api`, compile y publique la carpeta dist:

```bash
npm run build
```

Las variables VITE se incorporan al código público; no coloque contraseñas ni secretos. Recompile después de cambiar .env. El backend debe configurar `APP_URL` con el origen exacto del front. La ubicación necesita HTTPS y permiso del usuario; el mapa solo une puntos registrados. Revise las limitaciones y los pasos completos en el LEEME del back. El logo circular es provisional de acuerdo con el paquete suministrado.

## Organización del código

La estructura sigue la organización de Kafer: `src/App.jsx` y `src/main.jsx`; `src/pages/` contiene las pantallas, `src/components/` los componentes de interfaz, `src/services/` las solicitudes y formatos, y `src/styles/` los estilos.

## Cambios de esta versión

Menú lateral con iconos SVG y opción de contraer, menú móvil con botón hamburguesa, y vista de avance con gráficos circulares y porcentajes estimados. Compatible con el back v0.2.1; no incluye ni reemplaza el back.

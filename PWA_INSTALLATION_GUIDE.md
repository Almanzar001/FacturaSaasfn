# Guía de Instalación de PWA - FacturaSaaS

## ¿Qué es una PWA?

Una Progressive Web App (PWA) es una aplicación web que se comporta como una aplicación nativa cuando se instala en tu dispositivo móvil. Ofrece:

- **Instalación en pantalla de inicio**: Se ve como cualquier otra app
- **Funciona offline**: Acceso básico sin conexión a internet
- **Notificaciones push**: (si se implementan en el futuro)
- **Experiencia nativa**: Sin barras de navegador del browser

## Cómo Instalar FacturaSaaS en tu Celular

### En Android (Chrome/Edge):

1. **Abre el navegador** Chrome o Microsoft Edge en tu celular
2. **Navega a tu sitio web** (ejemplo: `https://tu-dominio.com`)
3. **Busca el ícono de instalación** en la barra de direcciones (generalmente un ícono de "+" o "instalar")
4. **Toca "Instalar"** o "Agregar a pantalla de inicio"
5. **Confirma la instalación** tocando "Instalar" en el popup
6. **¡Listo!** La app aparecerá en tu pantalla de inicio

### En iPhone (Safari):

1. **Abre Safari** en tu iPhone
2. **Navega a tu sitio web**
3. **Toca el botón de compartir** (ícono de cuadrado con flecha hacia arriba)
4. **Desplázate hacia abajo** y toca "Agregar a pantalla de inicio"
5. **Personaliza el nombre** si deseas y toca "Agregar"
6. **¡Listo!** La app aparecerá en tu pantalla de inicio

### En Desktop (Chrome/Edge):

1. **Abre Chrome o Edge** en tu computadora
2. **Navega a tu sitio web**
3. **Busca el ícono de instalación** en la barra de direcciones
4. **Haz clic en "Instalar"**
5. **La app se abrirá** en una ventana independiente

## Características de la PWA

### ✅ Funcionalidades Implementadas:

- **Manifest configurado**: Define cómo se ve y comporta la app
- **Service Worker**: Permite funcionalidad offline básica
- **Iconos optimizados**: Para diferentes tamaños de pantalla
- **Meta tags móviles**: Optimización para dispositivos móviles
- **Tema personalizado**: Colores que coinciden con tu marca
- **Shortcuts**: Accesos rápidos a secciones importantes:
  - Nueva Factura
  - Clientes
  - Dashboard

### 🎨 Configuración Visual:

- **Nombre**: FacturaSaaS - Sistema de Facturación
- **Nombre corto**: FacturaSaaS
- **Color de tema**: Azul (#3b82f6)
- **Fondo**: Blanco (#ffffff)
- **Orientación**: Vertical (portrait)

## Verificar que la PWA Funciona

### Indicadores de que la PWA está funcionando:

1. **En el navegador**: Deberías ver un ícono de instalación en la barra de direcciones
2. **Después de instalar**: La app se abre sin barras de navegador
3. **En la pantalla de inicio**: Aparece con el ícono y nombre personalizados
4. **Funcionalidad offline**: Páginas visitadas funcionan sin internet

### Para Desarrolladores - Verificar en DevTools:

1. **Abre DevTools** (F12)
2. **Ve a la pestaña "Application"**
3. **Revisa "Manifest"**: Debe mostrar toda la configuración
4. **Revisa "Service Workers"**: Debe mostrar el SW activo
5. **Lighthouse**: Ejecuta una auditoría PWA para verificar el score

## Solución de Problemas

### Si no aparece el botón de instalación:

1. **Verifica HTTPS**: La PWA requiere conexión segura
2. **Revisa el manifest**: Debe estar accesible en `/manifest.json`
3. **Service Worker**: Debe estar registrado correctamente
4. **Iconos**: Deben estar disponibles en las rutas especificadas

### Si la app no funciona offline:

1. **Visita las páginas** al menos una vez con internet
2. **El Service Worker** necesita tiempo para cachear recursos
3. **Revisa la consola** para errores del Service Worker

## Próximos Pasos (Opcional)

Para mejorar aún más la PWA, podrías considerar:

- **Notificaciones Push**: Para alertas de nuevas facturas
- **Sincronización en background**: Para enviar datos cuando vuelva la conexión
- **Más funcionalidad offline**: Permitir crear facturas sin internet
- **App Shortcuts dinámicos**: Basados en las acciones más frecuentes del usuario

## Soporte

La PWA es compatible con:
- ✅ Chrome (Android/Desktop)
- ✅ Edge (Android/Desktop)
- ✅ Safari (iOS/macOS) - con limitaciones
- ✅ Firefox (Desktop) - con limitaciones
- ❌ Internet Explorer (no soportado)

---

¡Tu webapp ahora funciona como una aplicación nativa! 🎉
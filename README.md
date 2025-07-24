# 📊 FacturaSaaS

Una aplicación SaaS moderna para gestión de facturas, cotizaciones y clientes, construida con Next.js 15 y Supabase.

## 🚀 Características

- ✅ **Gestión de Facturas**: Crea, edita y gestiona facturas profesionales
- ✅ **Cotizaciones**: Sistema completo de cotizaciones con conversión a facturas
- ✅ **Gestión de Clientes**: Base de datos de clientes con información completa
- ✅ **Productos y Servicios**: Catálogo de productos con precios y descripciones
- ✅ **Control de Gastos**: Seguimiento de gastos empresariales
- ✅ **Dashboard Analytics**: Métricas y estadísticas en tiempo real
- ✅ **Gestión de Equipos**: Invitaciones y roles de usuario
- ✅ **Generación de PDFs**: Facturas y cotizaciones en formato PDF
- ✅ **Autenticación Segura**: Sistema de login con Supabase Auth
- ✅ **Responsive Design**: Optimizado para móviles y desktop

## 🛠️ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **PDF Generation**: jsPDF
- **Email**: Resend
- **Icons**: Lucide React
- **Deployment**: Vercel

## 📦 Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/factura-saas.git
cd factura-saas
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
RESEND_API_KEY=tu_clave_de_resend
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Ejecutar en desarrollo**
```bash
npm run dev
```

## 🚀 Despliegue en Vercel

1. **Conectar con GitHub**: Importa tu repositorio en Vercel
2. **Configurar variables de entorno** en el dashboard de Vercel
3. **Deploy automático**: Cada push a main despliega automáticamente

### Variables de Entorno para Producción
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
RESEND_API_KEY=tu_clave_de_resend
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

## 📁 Estructura del Proyecto

```
factura-saas/
├── src/
│   ├── app/                 # App Router (Next.js 15)
│   │   ├── (app)/          # Rutas protegidas
│   │   ├── api/            # API Routes
│   │   ├── login/          # Autenticación
│   │   └── register/       # Registro
│   ├── components/         # Componentes reutilizables
│   │   ├── ui/            # Componentes UI base
│   │   └── layout/        # Componentes de layout
│   ├── lib/               # Utilidades y configuración
│   │   └── supabase/      # Cliente de Supabase
│   └── types/             # Tipos de TypeScript
├── supabase/              # Migraciones de base de datos
└── public/                # Archivos estáticos
```

## 🔧 Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Linting
```

## 📊 Rendimiento

- **First Load JS**: ~100 kB
- **Páginas estáticas**: 8 páginas pre-renderizadas
- **Bundle optimizado**: Compresión y minificación habilitadas
- **Imágenes optimizadas**: WebP y AVIF support

## 🔒 Seguridad

- ✅ Autenticación con Supabase Auth
- ✅ Row Level Security (RLS) en base de datos
- ✅ Variables de entorno protegidas
- ✅ Headers de seguridad configurados
- ✅ Logs de debug removidos en producción

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 📞 Soporte

Si tienes alguna pregunta o necesitas ayuda, no dudes en abrir un issue en GitHub.

---

**¡Hecho con ❤️ para simplificar la gestión de facturas!**

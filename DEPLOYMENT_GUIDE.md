# 🚀 Guía de Despliegue - FacturaSaaS

## ✅ Estado Actual
- ✅ Código limpio y optimizado para producción
- ✅ Repositorio Git inicializado
- ✅ Commit inicial realizado (54 archivos)
- ✅ README.md profesional creado
- ✅ .gitignore configurado
- ✅ Variables de entorno documentadas

## 📋 Pasos Restantes

### 1. 🐙 Crear Repositorio en GitHub

1. **Ve a GitHub.com** y haz login
2. **Clic en "New repository"** (botón verde)
3. **Configurar el repositorio:**
   - **Repository name**: `factura-saas` (o el nombre que prefieras)
   - **Description**: `Sistema SaaS para gestión de facturas y cotizaciones`
   - **Visibility**: Private o Public (según prefieras)
   - **NO marques** "Add a README file" (ya tenemos uno)
   - **NO marques** "Add .gitignore" (ya tenemos uno)
4. **Clic en "Create repository"**

### 2. 📤 Subir Código a GitHub

Después de crear el repositorio, ejecuta estos comandos en tu terminal:

```bash
# Agregar el remote origin (reemplaza TU-USUARIO con tu username de GitHub)
git remote add origin https://github.com/TU-USUARIO/factura-saas.git

# Cambiar el nombre de la rama principal a main (si es necesario)
git branch -M main

# Subir el código
git push -u origin main
```

### 3. 🚀 Desplegar en Vercel

#### Opción A: Desde GitHub (Recomendado)
1. **Ve a [vercel.com](https://vercel.com)** y haz login
2. **Clic en "New Project"**
3. **Import Git Repository:**
   - Selecciona tu repositorio `factura-saas`
   - Clic en "Import"
4. **Configure Project:**
   - **Project Name**: `factura-saas`
   - **Framework Preset**: Next.js (se detecta automáticamente)
   - **Root Directory**: `./` (por defecto)
   - **Build Command**: `npm run build` (por defecto)
   - **Output Directory**: `.next` (por defecto)
   - **Install Command**: `npm install` (por defecto)

#### Opción B: Desde CLI de Vercel
```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel

# Seguir las instrucciones interactivas
```

### 4. 🔧 Configurar Variables de Entorno en Vercel

En el dashboard de Vercel, ve a tu proyecto → Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://fubdratmgsjigdeacjqf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YmRyYXRtZ3NqaWdkZWFjanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMDExNDIsImV4cCI6MjA2Nzc3NzE0Mn0.hdGTkSVlKTTjxX1BOgi83tLMfRAs-2H4Tig1YUIzbKc
RESEND_API_KEY=re_UX19XxfX_MxTtpXiwqj5Nn7cZjU3CdtfU
NEXT_PUBLIC_APP_URL=https://tu-proyecto.vercel.app
```

**⚠️ IMPORTANTE**: 
- Reemplaza `https://tu-proyecto.vercel.app` con tu URL real de Vercel
- Asegúrate de que todas las variables estén configuradas antes del primer deploy

### 5. 🎯 Verificar Despliegue

1. **Vercel automáticamente desplegará** tu aplicación
2. **Recibirás una URL** como `https://factura-saas-xxx.vercel.app`
3. **Verifica que todo funcione:**
   - ✅ Página de login carga correctamente
   - ✅ Registro de usuarios funciona
   - ✅ Dashboard se muestra después del login
   - ✅ Todas las funcionalidades principales funcionan

### 6. 🔄 Configurar Despliegue Automático

Una vez conectado con GitHub:
- ✅ **Cada push a `main`** desplegará automáticamente
- ✅ **Preview deployments** para otras ramas
- ✅ **Rollback automático** si hay errores

## 🌐 Configuración de Dominio Personalizado (Opcional)

Si tienes un dominio propio:

1. **En Vercel**: Settings → Domains
2. **Agregar tu dominio**: `tudominio.com`
3. **Configurar DNS** según las instrucciones de Vercel
4. **Actualizar variable de entorno**: `NEXT_PUBLIC_APP_URL=https://tudominio.com`

## 📊 Monitoreo Post-Despliegue

### Métricas a Verificar:
- ✅ **Performance**: Core Web Vitals en Vercel Analytics
- ✅ **Errores**: Function logs en Vercel dashboard
- ✅ **Base de datos**: Métricas en Supabase dashboard
- ✅ **Emails**: Logs en Resend dashboard

### Comandos Útiles:
```bash
# Ver logs en tiempo real
vercel logs

# Ver información del proyecto
vercel ls

# Hacer redeploy
vercel --prod
```

## 🎉 ¡Listo para Producción!

Una vez completados estos pasos, tu aplicación FacturaSaaS estará:
- 🚀 **Desplegada en Vercel** con SSL automático
- 🔄 **Auto-deploy** configurado desde GitHub
- 📊 **Monitoreo** y analytics habilitados
- 🔒 **Segura** con todas las optimizaciones aplicadas
- ⚡ **Súper rápida** con bundle optimizado

---

**¿Necesitas ayuda?** Revisa los logs en Vercel o contacta soporte si encuentras algún problema.
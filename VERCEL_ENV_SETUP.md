# Configuración de Variables de Entorno en Vercel

## Variables Requeridas

Para que la aplicación funcione correctamente en Vercel, necesitas configurar las siguientes variables de entorno:

### 1. Variables de Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://fubdratmgsjigdeacjqf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YmRyYXRtZ3NqaWdkZWFjanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMDExNDIsImV4cCI6MjA2Nzc3NzE0Mn0.hdGTkSVlKTTjxX1BOgi83tLMfRAs-2H4Tig1YUIzbKc
```

### 2. Variable de Resend (para correos)
```
RESEND_API_KEY=re_UX19XxfX_MxTtpXiwqj5Nn7cZjU3CdtfU
```

### 3. URL de la aplicación
```
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

## Métodos de Configuración

### Método 1: Dashboard de Vercel (Recomendado)

1. **Accede a tu proyecto en Vercel:**
   - Ve a [vercel.com](https://vercel.com)
   - Inicia sesión y selecciona tu proyecto

2. **Navega a Settings:**
   - Haz clic en la pestaña "Settings"
   - En el menú lateral, selecciona "Environment Variables"

3. **Agrega cada variable:**
   - Haz clic en "Add New"
   - **Name:** Nombre de la variable (ej: `RESEND_API_KEY`)
   - **Value:** Valor de la variable
   - **Environments:** Selecciona Production, Preview, y Development
   - Haz clic en "Save"

4. **Repite para todas las variables:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL`

### Método 2: Vercel CLI

Si tienes Vercel CLI instalado:

```bash
# Instalar Vercel CLI si no lo tienes
npm i -g vercel

# Agregar variables una por una
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add RESEND_API_KEY
vercel env add NEXT_PUBLIC_APP_URL

# O importar desde archivo .env
vercel env pull .env.production
```

### Método 3: Archivo vercel.json (No recomendado para secretos)

```json
{
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "https://fubdratmgsjigdeacjqf.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "tu_anon_key_aqui"
  }
}
```

**⚠️ IMPORTANTE:** No pongas secretos como `RESEND_API_KEY` en vercel.json ya que se subirá al repositorio.

## Configuración Específica por Entorno

### Para Producción:
- `NEXT_PUBLIC_APP_URL`: Tu dominio de producción (ej: `https://facturasaas.vercel.app`)

### Para Preview/Development:
- `NEXT_PUBLIC_APP_URL`: Puede usar la URL automática de Vercel o localhost

## Verificación

Después de configurar las variables:

1. **Redeploy tu aplicación:**
   - Ve a la pestaña "Deployments"
   - Haz clic en "Redeploy" en el último deployment

2. **Verifica en los logs:**
   - Revisa los logs de build y runtime para confirmar que las variables se cargan correctamente

3. **Prueba la funcionalidad:**
   - Envía una invitación desde la aplicación
   - Verifica que el correo llegue con la URL correcta

## Solución de Problemas

### Error: "undefined/accept-invitation"
- **Causa:** `NEXT_PUBLIC_APP_URL` no está configurada
- **Solución:** Configura la variable con tu dominio de Vercel

### Error: "RESEND_API_KEY no está configurada"
- **Causa:** La API key de Resend no está configurada o es incorrecta
- **Solución:** Verifica que la variable esté configurada y comience con "re_"

### Error: "Cannot connect to Supabase"
- **Causa:** Variables de Supabase incorrectas
- **Solución:** Verifica las URLs y keys de Supabase

## Notas Importantes

1. **Variables públicas:** Las que empiezan con `NEXT_PUBLIC_` son visibles en el cliente
2. **Variables privadas:** Como `RESEND_API_KEY` solo están disponibles en el servidor
3. **Redeploy requerido:** Después de cambiar variables de entorno, necesitas hacer redeploy
4. **Seguridad:** Nunca expongas API keys privadas en el código o en variables públicas
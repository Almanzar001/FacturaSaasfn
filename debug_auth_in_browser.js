// Script para debugear autenticación en el browser
// Copia y pega este código en la consola del browser (F12)

console.log('🔍 Debugeando autenticación en el browser...');

// 1. Verificar si hay sesión en localStorage
const supabaseSession = localStorage.getItem('sb-fubdratmgsjigdeacjqf-auth-token');
console.log('📦 Sesión en localStorage:', supabaseSession ? 'EXISTS' : 'NOT FOUND');

if (supabaseSession) {
    try {
        const sessionData = JSON.parse(supabaseSession);
        console.log('👤 Datos de sesión:', {
            access_token: sessionData.access_token ? 'EXISTS' : 'MISSING',
            refresh_token: sessionData.refresh_token ? 'EXISTS' : 'MISSING',
            expires_at: sessionData.expires_at,
            user: sessionData.user ? {
                id: sessionData.user.id,
                email: sessionData.user.email
            } : 'NO USER'
        });
        
        // Verificar si el token ha expirado
        const now = Math.floor(Date.now() / 1000);
        const expired = sessionData.expires_at && sessionData.expires_at < now;
        console.log('⏰ Token expirado:', expired ? 'YES' : 'NO');
        
    } catch (e) {
        console.log('❌ Error parseando sesión:', e);
    }
}

// 2. Verificar cookies de autenticación
const cookies = document.cookie.split(';').filter(cookie => 
    cookie.includes('sb-') || cookie.includes('auth')
);
console.log('🍪 Cookies de auth encontradas:', cookies);

// 3. Si tienes acceso al cliente Supabase en el browser
if (typeof window !== 'undefined' && window.supabase) {
    console.log('🔌 Cliente Supabase disponible, verificando usuario...');
    
    window.supabase.auth.getUser().then(({ data: { user }, error }) => {
        if (error) {
            console.log('❌ Error obteniendo usuario:', error);
        } else {
            console.log('👤 Usuario autenticado:', user ? {
                id: user.id,
                email: user.email,
                role: user.role
            } : 'NO USER');
        }
    });
    
    // Verificar sesión activa
    window.supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
            console.log('❌ Error obteniendo sesión:', error);
        } else {
            console.log('🔑 Sesión activa:', session ? {
                access_token: session.access_token ? 'EXISTS' : 'MISSING',
                expires_at: session.expires_at,
                user_id: session.user?.id
            } : 'NO SESSION');
        }
    });
}

// 4. Probar una consulta directa
if (typeof window !== 'undefined' && window.supabase) {
    console.log('🧪 Probando consulta directa...');
    
    window.supabase
        .from('inventory_settings')
        .select('*')
        .eq('organization_id', '79620cfb-c28b-4d70-98e3-aa932237b88e')
        .then(({ data, error }) => {
            if (error) {
                console.log('❌ Error en consulta directa:', error);
            } else {
                console.log('✅ Consulta directa exitosa:', data);
            }
        });
}

console.log('📋 Debug completado. Revisa los resultados arriba.');
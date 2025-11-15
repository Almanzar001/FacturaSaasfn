// Test directo de conexión a Supabase
// Ejecutar con: node test_supabase_connection.js

const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://fubdratmgsjigdeacjqf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YmRyYXRtZ3NqaWdkZWFjanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMDExNDIsImV4cCI6MjA2Nzc3NzE0Mn0.hdGTkSVlKTTjxX1BOgi83tLMfRAs-2H4Tig1YUIzbKc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log('🔍 Probando conexión a Supabase...');
    
    try {
        // Test 1: Verificar conexión básica
        console.log('\n1️⃣ Test de conexión básica...');
        const { data: organizations, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .limit(1);
            
        if (orgError) {
            console.log('❌ Error en organizaciones:', orgError);
        } else {
            console.log('✅ Organizaciones accesibles:', organizations?.length || 0);
        }
        
        // Test 2: Probar acceso a branches
        console.log('\n2️⃣ Test de acceso a branches...');
        const { data: branches, error: branchError } = await supabase
            .from('branches')
            .select('*')
            .eq('organization_id', '79620cfb-c28b-4d70-98e3-aa932237b88e');
            
        if (branchError) {
            console.log('❌ Error en branches:', branchError);
        } else {
            console.log('✅ Branches encontradas:', branches?.length || 0);
        }
        
        // Test 3: Probar acceso a inventory_settings
        console.log('\n3️⃣ Test de acceso a inventory_settings...');
        const { data: settings, error: settingsError } = await supabase
            .from('inventory_settings')
            .select('*')
            .eq('organization_id', '79620cfb-c28b-4d70-98e3-aa932237b88e');
            
        if (settingsError) {
            console.log('❌ Error en inventory_settings:', settingsError);
        } else {
            console.log('✅ Settings encontradas:', settings?.length || 0);
        }
        
        // Test 4: Probar funciones RPC
        console.log('\n4️⃣ Test de funciones RPC...');
        const { data: stats, error: statsError } = await supabase
            .rpc('get_inventory_stats', { org_id: '79620cfb-c28b-4d70-98e3-aa932237b88e' });
            
        if (statsError) {
            console.log('❌ Error en get_inventory_stats:', statsError);
        } else {
            console.log('✅ Stats obtenidas:', stats);
        }
        
        // Test 5: Verificar estado de autenticación
        console.log('\n5️⃣ Test de estado de autenticación...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.log('❌ Error obteniendo usuario:', userError);
        } else {
            console.log('👤 Usuario actual:', user ? user.email : 'No autenticado');
        }
        
        // Test 6: Probar vista de prueba
        console.log('\n6️⃣ Test de vista pública...');
        const { data: viewData, error: viewError } = await supabase
            .from('public_inventory_test')
            .select('*');
            
        if (viewError) {
            console.log('❌ Error en vista pública:', viewError);
        } else {
            console.log('✅ Vista pública accesible:', viewData);
        }
        
    } catch (error) {
        console.log('❌ Error general:', error);
    }
}

// Ejecutar test
testConnection().then(() => {
    console.log('\n🏁 Test completado');
    process.exit(0);
});
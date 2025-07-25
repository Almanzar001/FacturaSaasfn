import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar si la tabla invitations existe
    const { data: invitationsTable, error: invitationsError } = await supabase
      .from('invitations')
      .select('*')
      .limit(1)
    
    // Verificar si las funciones RPC existen
    const { data: rpcTest, error: rpcError } = await supabase
      .rpc('invite_user_to_organization', {
        p_organization_id: '00000000-0000-0000-0000-000000000000',
        p_email: 'test@test.com',
        p_role: 'vendedor'
      })
    
    return NextResponse.json({
      invitationsTable: {
        exists: !invitationsError,
        error: invitationsError?.message,
        data: invitationsTable
      },
      rpcFunction: {
        exists: !rpcError || rpcError.code !== '42883', // 42883 = function does not exist
        error: rpcError?.message,
        code: rpcError?.code
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
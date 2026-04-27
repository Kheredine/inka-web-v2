import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, usernameToEmail, generatePin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Configuration manquante — ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local' },
      { status: 503 }
    )
  }

  try {
    const { username } = await req.json() as { username: string }

    if (!username?.trim()) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }

    const clean = username.trim()

    // Look up the user ID via the profiles table (avoids paginated listUsers)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', clean)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Aucun compte trouvé pour ce nom' }, { status: 404 })
    }

    // Verify auth user exists
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(profile.id)
    if (getUserError || !user) {
      return NextResponse.json({ error: 'Aucun compte trouvé pour ce nom' }, { status: 404 })
    }

    const newPin = generatePin()

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPin + '00',
    })

    if (error) {
      console.error('[reset-code] updateUser error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ pin: newPin, username: clean })
  } catch (e) {
    console.error('[reset-code] unexpected error:', e)
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 })
  }
}

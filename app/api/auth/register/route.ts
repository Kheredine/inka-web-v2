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

    // Check username uniqueness
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', clean)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Ce nom est déjà pris' }, { status: 409 })
    }

    const email = usernameToEmail(clean)
    const pin = generatePin()

    // Create Supabase auth user (email auto-confirmed, no email sent)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin + '00',
      email_confirm: true,
      user_metadata: { username: clean },
    })

    if (error) {
      console.error('[register] createUser error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create profile row
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: data.user.id,
      username: clean,
      display_name: clean,
    })

    if (profileError) {
      console.error('[register] profile insert error:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
      return NextResponse.json({ error: 'Erreur lors de la création du profil' }, { status: 500 })
    }

    return NextResponse.json({ pin, username: clean })
  } catch (e) {
    console.error('[register] unexpected error:', e)
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 })
  }
}

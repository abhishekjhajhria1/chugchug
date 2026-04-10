import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://drvkwhaqjbfubeuawlvr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydmt3aGFxamJmdWJldWF3bHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjQzMDUsImV4cCI6MjA4Nzk0MDMwNX0.sS38kJ0TpeYFH6M1yQDCRq4JjKTUdtl6r9wE3WLaGsU'
const TEST_EMAIL = '12214057@nitkkr.ac.in'
const TEST_PASS = 'ChugChug$2109'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function run() {
  console.log("1. Authenticating as", TEST_EMAIL)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASS
  })

  if (authErr) {
    console.error("Auth Error:", authErr.message)
    return
  }

  const userId = authData.user.id
  console.log("Authenticated User ID:", userId)

  console.log("2. Checking 'profiles' read access...")
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (profileErr) {
    console.error("Profile Fetch Error:", profileErr.code, profileErr.message)
  } else {
    console.log("Profile Data:", profile)
  }

  console.log("3. Checking 'groups' read access...")
  const { data: groups, error: groupsErr } = await supabase.from('groups').select('*').limit(1)
  if (groupsErr) console.error("Groups Fetch Error:", groupsErr.message)
  else console.log("Groups successful, count:", groups.length)

  console.log("4. Attempting to update bio in 'profiles'...")
  const { error: updateErr } = await supabase.from('profiles').update({ bio: "Scratch test " + Date.now() }).eq('id', userId)
  if (updateErr) console.error("Profile Update Error:", updateErr.message)
  else console.log("Profile Update: Success")
}

run()

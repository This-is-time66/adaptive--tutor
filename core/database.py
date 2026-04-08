import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Public client (uses anon key — respects Row Level Security)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Admin client (uses service key — bypasses RLS, for admin ops like delete user)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
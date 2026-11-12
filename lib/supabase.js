const { createClient } = require("@supabase/supabase-js");

let publicClient;
let serviceClient;

function getClient(serviceRole = false) {
  const url = process.env.SUPABASE_URL;
  const key = serviceRole
    ? process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      `Configuration Supabase ${serviceRole ? "serveur" : "publique"} absente.`,
    );
  }

  if (serviceRole) {
    if (!serviceClient) {
      serviceClient = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    }
    return serviceClient;
  }

  if (!publicClient) {
    publicClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return publicClient;
}

module.exports = {
  getPublicSupabaseClient: () => getClient(),
  getServiceSupabaseClient: () => getClient(true),
};

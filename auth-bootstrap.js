import { supabase } from "./supabase-client.js?v=20261116-auth-bootstrap-v1";

// Start restoring the saved session before the large main application module runs.
// Do not await here: app.js should initialize in parallel with the session restore.
window.__mersalAuthBootstrapPromise = supabase.auth.getSession()
  .then(({ error }) => {
    if (error) throw error;
    return true;
  })
  .catch(error => {
    console.warn("Early Mersal session restoration failed; the main app will retry through its auth listener:", error);
    return false;
  });

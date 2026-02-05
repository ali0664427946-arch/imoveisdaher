import { createClient } from "npm:@supabase/supabase-js@2.91.1";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the requester
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    // Create a client with the user's token to verify they're an admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user
    const {
      data: { user: currentUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !currentUser) {
      throw new Error("Unauthorized: User not authenticated");
    }

    // Check if the current user is an admin
    const { data: isAdmin, error: roleError } = await userClient.rpc(
      "has_role",
      {
        _user_id: currentUser.id,
        _role: "admin",
      }
    );

    if (roleError) {
      console.error("Role check error:", roleError);
      throw new Error("Failed to verify admin status");
    }

    if (!isAdmin) {
      throw new Error("Forbidden: Only admins can create users");
    }

    // Parse the request body
    const { email, password, full_name, role } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    if (role && !["admin", "agent"].includes(role)) {
      throw new Error("Invalid role. Must be 'admin' or 'agent'");
    }

    // Create the admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the new user
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm the email
        user_metadata: {
          full_name: full_name || null,
        },
      });

    if (createError) {
      console.error("Create user error:", createError);
      throw new Error(createError.message || "Failed to create user");
    }

    if (!newUser.user) {
      throw new Error("User creation failed");
    }

    // Create the user's profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        full_name: full_name || email.split("@")[0],
      });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Don't throw, just log - the user is still created
    }

    // Assign the role to the new user
    const { error: roleInsertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role || "agent",
      });

    if (roleInsertError) {
      console.error("Role assignment error:", roleInsertError);
      // Try to clean up by deleting the user if role assignment fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error("Failed to assign role to user");
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        email: newUser.user.email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in create-user function:", error);

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
      ? 403
      : 400;

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});

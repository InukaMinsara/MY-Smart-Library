import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only the Super Admin can manage employees");
}

const permsSchema = z.array(z.string()).default([]);
const roleSchema = z.enum(["admin", "librarian", "manager", "other", "pending"]);
const statusSchema = z.enum(["pending", "active", "disabled"]);

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        full_name: z.string().min(1),
        phone: z.string().optional().nullable(),
        job_title: z.string().min(1),
        job_name: z.string().optional().nullable(),
        role: roleSchema,
        status: statusSchema.default("active"),
        permissions: permsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create employee");
    const uid = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      job_title: data.job_title,
      job_name: data.job_name ?? null,
      status: data.status,
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role as any });
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", uid);
    if (data.permissions.length) {
      await supabaseAdmin
        .from("user_permissions")
        .insert(data.permissions.map((p) => ({ user_id: uid, permission: p })));
    }
    return { id: uid };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().min(1),
        phone: z.string().optional().nullable(),
        job_title: z.string().min(1),
        job_name: z.string().optional().nullable(),
        role: roleSchema,
        status: statusSchema,
        permissions: permsSchema,
        password: z.string().min(8).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        job_title: data.job_title,
        job_name: data.job_name ?? null,
        status: data.status,
      })
      .eq("id", data.id);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role as any });
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", data.id);
    if (data.permissions.length) {
      await supabaseAdmin
        .from("user_permissions")
        .insert(data.permissions.map((p) => ({ user_id: data.id, permission: p })));
    }
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    if (data.id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id);
    if ((roles ?? []).some((r: any) => r.role === "super_admin")) {
      throw new Error("The Super Admin account is permanent and cannot be deleted");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, job_title, job_name, avatar_url, status, created_at")
      .order("created_at");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: perms } = await supabaseAdmin.from("user_permissions").select("user_id, permission");

    return (profiles ?? []).map((p: any) => ({
      ...p,
      role: (roles ?? []).find((r: any) => r.user_id === p.id)?.role ?? "pending",
      permissions: (perms ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.permission),
    }));
  });

/** Quick status flip (approve / disable / re-enable) without opening the full editor. */
export const setEmployeeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: statusSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    if (data.id === context.userId) throw new Error("You cannot change your own account status");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id);
    if ((roles ?? []).some((r: any) => r.role === "super_admin")) {
      throw new Error("The Super Admin account cannot be disabled");
    }
    const { error } = await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
/**
 * Promote a Library Member to a Staff Employee.
 */
export const promoteToEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      member_id: z.string().uuid(),
      source: z.enum(["member", "profile", "auth"]).default("member"),
      job_title: z.string().min(1),
      role: roleSchema,
      permissions: permsSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let uid = data.member_id;

    if (data.source === "profile" || data.source === "auth") {
      let email = null;
      let full_name = null;
      let phone = null;
      
      if (data.source === "auth") {
        const { data: userObj } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (!userObj?.user) throw new Error("Auth user not found");
        email = userObj.user.email;
        full_name = userObj.user.user_metadata?.full_name || email?.split('@')[0] || "Unknown";
      } else {
        const { data: p } = await supabaseAdmin.from("profiles").select("full_name, email, phone").eq("id", uid).single();
        if (p) { full_name = p.full_name; email = p.email; phone = p.phone; }
      }

      await supabaseAdmin.from("profiles").upsert({
        id: uid, full_name: full_name || "Unknown", email, phone: phone ?? null,
        job_title: data.job_title, status: "active"
      });
      
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role as any });
      
      await supabaseAdmin.from("user_permissions").delete().eq("user_id", uid);
      if (data.permissions.length) {
        await supabaseAdmin.from("user_permissions")
          .insert(data.permissions.map((p: string) => ({ user_id: uid, permission: p })));
      }
      return { ok: true };
    }

    // Source is "member"
    const { data: member, error: mErr } = await supabaseAdmin
      .from("members").select("full_name, email, phone").eq("id", data.member_id).single();
    if (mErr || !member) throw new Error("Member not found");

    // Check if they already have an auth account by email
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuth = authData?.users?.find(u => u.email === member.email);
    
    uid = existingAuth?.id;

    if (!uid) {
      if (!member.email) {
        throw new Error("This member does not have an email address. Please add an email to their member profile first.");
      }
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: member.email,
        password: "Password123!",
        email_confirm: true,
        user_metadata: { full_name: member.full_name },
      });
      if (createErr || !created.user) {
        throw new Error(createErr?.message ?? "Could not create auth account for member");
      }
      uid = created.user.id;
    }

    await supabaseAdmin.from("profiles").upsert({
      id: uid, full_name: member.full_name, email: member.email,
      phone: (member as any).phone ?? null, job_title: data.job_title, job_name: null, status: "active",
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role as any });
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", uid);
    if (data.permissions.length) {
      await supabaseAdmin.from("user_permissions")
        .insert(data.permissions.map((p: string) => ({ user_id: uid, permission: p })));
    }
    
    // We intentionally leave user_id on the members table so if they are demoted later, they retain their member profile.
    const _ = await supabaseAdmin.from("members").update({ status: "inactive" }).eq("id", data.member_id);
    
    return { ok: true };
  });

/**
 * Demote a Staff Employee back to a Library Member.
 */
export const demoteToMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ employee_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    if (data.employee_id === context.userId) throw new Error("You cannot demote your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name, email").eq("id", data.employee_id).maybeSingle();
    await supabaseAdmin.from("profiles").delete().eq("id", data.employee_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.employee_id);
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", data.employee_id);
    // Check if they already have a member row by user_id
    const { data: existingMember } = await supabaseAdmin
      .from("members").select("id").eq("user_id", data.employee_id).maybeSingle();
      
    if (existingMember) {
      await supabaseAdmin.from("members").update({ status: "active" }).eq("id", existingMember.id);
    } else {
      // Fallback: try to find by email
      const { data: byEmail } = await supabaseAdmin
        .from("members").select("id").eq("email", profile?.email ?? "").maybeSingle();
        
      if (byEmail) {
        await supabaseAdmin.from("members").update({ user_id: data.employee_id, status: "active" }).eq("id", byEmail.id);
      } else {
        await supabaseAdmin.from("members").insert({
          user_id: data.employee_id, full_name: profile?.full_name ?? "",
          email: profile?.email ?? "", status: "active",
          registration_date: new Date().toISOString().split("T")[0],
        });
      }
    }

    await supabaseAdmin.from("user_roles")
      .upsert({ user_id: data.employee_id, role: "member" as any }, { onConflict: "user_id,role" });
    return { ok: true };
  });

/**
 * List members that can be promoted to employees.
 */
export const listMembersForPromotion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // 1. Fetch ALL users from auth.users to act as the ultimate source of truth for logged-in users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const allUsers = authData?.users ?? [];

    // 2. Fetch all staff profiles
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, status");
    const activeStaffIds = new Set((profiles ?? []).filter((p: any) => p.status !== "pending").map((p: any) => p.id));
    const pendingStaffIds = new Set((profiles ?? []).filter((p: any) => p.status === "pending").map((p: any) => p.id));

    // 3. Fetch all members
    const { data: members } = await supabaseAdmin.from("members").select("id, user_id, full_name, email, member_number").order("full_name");
    
    const list = [];
    const memberAuthIds = new Set();
    
    // Add existing members from the members table
    for (const m of (members ?? [])) {
      if (m.user_id) {
        if (activeStaffIds.has(m.user_id)) continue; // Already an active staff member
        memberAuthIds.add(m.user_id);
      }
      list.push({ ...m, source: "member" });
    }
    
    // Add users from auth.users who are NOT active staff AND NOT in the members table yet
    // This perfectly captures users who logged in but got lost due to broken triggers!
    for (const u of allUsers) {
      if (activeStaffIds.has(u.id)) continue; // Already an active staff member
      if (memberAuthIds.has(u.id)) continue; // Already added from members table
      
      let source = pendingStaffIds.has(u.id) ? "profile" : "auth";
      
      list.push({
        id: u.id,
        user_id: u.id,
        full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || "Unknown",
        email: u.email,
        member_number: "NEW SIGNUP",
        source: source
      });
    }

    return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  });
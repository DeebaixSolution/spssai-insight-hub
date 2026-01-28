

## Summary

Your user **dibalkerdieh@tg-kw.com already has the admin role** - I verified this in the database. You should now be able to access the admin panel at `/admin`.

For the second request, I'll create a **User Management** feature in the admin panel that allows you to:
- View all users with their current plan (free/pro)
- Search and filter users
- Change user plans between free and pro with one click

---

## Implementation Plan

### 1. Create User Management Page (`src/pages/admin/UserManager.tsx`)

A new admin page with:
- **User list table** showing: email, full name, plan, created date
- **Search functionality** to find users by email or name
- **Plan toggle buttons** (Free/Pro) for each user - similar to the AnalysisManager pattern
- **Bulk save functionality** for pending changes
- **Stats summary** showing total users, free users, pro users

### 2. Update Admin Navigation (`src/pages/Admin.tsx`)

- Enable the "User Management" card on the admin home page (currently disabled/grayed out)
- Add route for `/admin/users` pointing to the new UserManager component
- Add "Users" to the sidebar navigation

---

## Technical Details

### Database Access
- The `profiles` table already has a `plan` column that accepts `'free'` or `'pro'`
- RLS policy "Admins can update all profiles" already exists, so admins can modify user plans
- Will use `has_role(auth.uid(), 'admin')` check via existing RLS

### UI Components (following existing patterns)
```text
+--------------------------------------------------+
|  User Management                        [Refresh]|
|  Manage user accounts and subscription plans     |
+--------------------------------------------------+
|  [Search users...]        Plan: [All v]          |
+--------------------------------------------------+
| Email           | Name    | Plan   | Created    |
|-----------------|---------|--------|------------|
| user@email.com  | John    | [Free][Pro] | Jan 1 |
| admin@test.com  | Admin   | [Free][Pro] | Jan 2 |
+--------------------------------------------------+
| Total: 5 users | Free: 3 | Pro: 2               |
+--------------------------------------------------+
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/admin/UserManager.tsx` | Create | New user management component |
| `src/pages/Admin.tsx` | Modify | Add route and enable Users nav item |

### Security Considerations
- All plan changes go through Supabase RLS policies
- Only admins (verified by `has_role` function) can access this page
- The Admin page already checks for admin role before rendering


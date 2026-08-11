export const PERMISSIONS = [
  { key: "dashboard", label: "Dashboard Access", group: "General" },
  { key: "books", label: "Book View", group: "Books" },
  { key: "add_book", label: "Add Book", group: "Books" },
  { key: "edit_book", label: "Edit Book", group: "Books" },
  { key: "delete_book", label: "Delete Book", group: "Books" },
  { key: "members", label: "Member View", group: "Members" },
  { key: "register_members", label: "Member Registration", group: "Members" },
  { key: "member_edit", label: "Member Edit", group: "Members" },
  { key: "member_delete", label: "Member Delete", group: "Members" },
  { key: "loans", label: "Loan Access", group: "Circulation" },
  { key: "issue_books", label: "Create Loan", group: "Circulation" },
  { key: "cancel_loan", label: "Cancel Loan", group: "Circulation" },
  { key: "returns", label: "Return Access", group: "Circulation" },
  { key: "return_books", label: "Process Returns", group: "Circulation" },
  { key: "reservations", label: "Reservation Access", group: "Circulation" },
  { key: "fine_management", label: "Fine Management", group: "Finance" },
  { key: "notification_management", label: "Notification Management", group: "Finance" },
  { key: "reports", label: "Reports Access", group: "Reports" },
  { key: "export_reports", label: "Export Reports", group: "Reports" },
  { key: "settings", label: "Settings Access", group: "Administration" },
  { key: "user_management", label: "User Management", group: "Administration" },
  { key: "activity_logs", label: "Audit Log Access", group: "Administration" },
  { key: "backup_database", label: "Backup Database", group: "Administration" },
  { key: "restore_database", label: "Restore Database", group: "Administration" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

export const JOB_TITLES = ["Admin", "Librarian", "Manager", "Other"] as const;

export const ACCOUNT_STATUSES = ["pending", "active", "disabled"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type JobTitle = (typeof JOB_TITLES)[number];

/** Default permission presets per job title. */
export const JOB_PRESETS: Record<string, PermissionKey[]> = {
  Admin: PERMISSIONS.filter((p) => p.key !== "backup_database" && p.key !== "restore_database").map((p) => p.key),
  Librarian: [
    "dashboard", "books", "add_book", "edit_book", "members", "register_members", "member_edit",
    "loans", "issue_books", "cancel_loan", "returns", "return_books", "reservations",
    "fine_management", "notification_management", "reports",
  ],
  Manager: [
    "dashboard", "books", "members", "loans", "returns", "reservations",
    "fine_management", "reports", "export_reports", "activity_logs",
  ],
  Other: [],
};
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { canAccessPage } from "@/lib/access";
import { getRoleConfigViewAsync, getUserAccountViewAsync } from "@/lib/demo-store";
import type { ApprovalPermissionSet, ConfigPermissionSet, PageAccessKey, UserAccountRecord, UserRoleKey } from "@/lib/types";

const AUTH_COOKIE = "tea_finance_session";
const AUTH_SECRET = process.env.TEA_FINANCE_AUTH_SECRET || "tea-finance-demo-secret";

export type AuthSession = {
  userId: string;
  username: string;
  displayName: string;
  role: UserRoleKey;
  organizationScope: string[];
  pageAccess: PageAccessKey[];
  configPermissions: ConfigPermissionSet;
  approvalPermissions: ApprovalPermissionSet;
  dataScope: "all" | "organization" | "own";
};

function toBase64Url(input: string) {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", AUTH_SECRET).update(value).digest("base64url");
}

function serialize(payload: AuthSession) {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function parse(token: string): AuthSession | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }
  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as AuthSession;
  } catch {
    return null;
  }
}

export async function authenticateUser(username: string, password: string) {
  const [users, roles] = await Promise.all([getUserAccountViewAsync(), getRoleConfigViewAsync()]);
  const account = users.find((item) => item.isActive && item.username === username && item.password === password);
  if (!account) {
    return null;
  }
  const role = roles.find((item) => item.id === account.role);
  if (!role) {
    return null;
  }
  return {
    userId: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    organizationScope: account.organizationScope,
    pageAccess: role.pageAccess,
    configPermissions: role.configPermissions,
    approvalPermissions: role.approvalPermissions,
    dataScope: role.dataScope
  } satisfies AuthSession;
}

export async function setSession(session: AuthSession) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, serialize(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
}

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return parse(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requirePageAccess(page: PageAccessKey) {
  const session = await requireSession();
  if (!canAccessPage(session, page)) {
    redirect("/dashboard");
  }
  return session;
}

export function canManageConfig(session: AuthSession, key: keyof ConfigPermissionSet) {
  return session.configPermissions[key];
}

export function canDoApproval(session: AuthSession, key: keyof ApprovalPermissionSet) {
  return session.approvalPermissions[key];
}

export function canAccessOwningUser(session: AuthSession, request: Pick<UserAccountRecord, "displayName"> | { applicantName: string }) {
  const applicantName = "applicantName" in request ? request.applicantName : request.displayName;
  return session.dataScope !== "own" || applicantName === session.displayName;
}

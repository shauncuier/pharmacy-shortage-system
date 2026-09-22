import { SignJWT, jwtVerify } from 'jose'

import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { Role } from '@prisma/client'

const SECRET_STRING = process.env.SESSION_SECRET || 'pharmacy-local-secret-fallback-minimum-32-chars!'
const ENCODED_KEY = new TextEncoder().encode(SECRET_STRING)
const COOKIE_NAME = 'pharmacy_session'

export interface SessionPayload {
  userId: string
  employeeId: string
  name: string
  role: Role
  expiresAt: string
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10)
}

export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed)
}

export async function signSession(payload: Omit<SessionPayload, 'expiresAt'>, days = 14): Promise<string> {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  return new SignJWT({ ...payload, expiresAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(ENCODED_KEY)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ENCODED_KEY, {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function setSessionCookie(payload: Omit<SessionPayload, 'expiresAt'>, days = 14) {
  const token = await signSession(payload, days)
  const cookieStore = await cookies()
  const isSecure = process.env.COOKIE_SECURE === 'true'

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure, // Local pharmacy LAN uses HTTP, so false by default
    sameSite: 'lax',
    path: '/',
    maxAge: days * 24 * 60 * 60,
  })
}

export async function clearSessionCookie() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
  } catch {
    // Next.js throws when modifying cookies during Server Component rendering.
    // Safely ignore here; Route Handlers (e.g. /api/auth/logout) will handle deletion.
  }
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const session = await verifySession(token)
  if (!session) return null

  // Ensure user still exists and is active in database
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, employeeId: true, name: true, role: true, isActive: true },
  })

  if (!user || !user.isActive) {
    await clearSessionCookie()
    return null
  }

  return {
    userId: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
    expiresAt: session.expiresAt,
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireAdmin(): Promise<SessionPayload> {
  const user = await requireAuth()
  if (user.role !== Role.ADMIN) {
    throw new Error('FORBIDDEN')
  }
  return user
}

export interface RoleInfo {
  label: string
  description: string
  badgeColor: string
  defaultPath: string
}

export {
  ROLE_CONFIGS,
  ROLE_CONFIGS as ROLE_METADATA,
  STAFF_ROLES,
  isAdministrativeRole,
  canManageEmployees,
  canAccessPos,
  canManageWholesale,
} from './roles'

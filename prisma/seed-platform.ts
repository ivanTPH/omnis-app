/**
 * prisma/seed-platform.ts
 *
 * Seeds platform-level data:
 *   - 1 platform_admin User (platform@omnis.edu)
 *   - 3 School records (Oakfield Academy, Riverside Primary, Hillside All-Through)
 *   - 5 SchoolFeatureFlags for Oakfield Academy
 *   - 5 PlatformAuditLog entries
 *
 * Idempotent: safe to run multiple times.
 * Run with: npm run platform:seed
 */

import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

async function main() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  Platform Seed — Omnis Platform Admin')
  console.log('═══════════════════════════════════════════\n')

  // ── 1. Platform school (for the platform admin user to belong to) ─────────────
  const ps = await prisma.school.upsert({
    where:  { urn: '000000' },
    update: {},
    create: {
      name:    'Omnis Platform',
      urn:     '000000',
      phase:   'secondary',
      isActive: true,
    },
  })
  console.log(`✓ Platform school: ${ps.name} (${ps.id})`)

  // ── 2. Platform admin user ────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 12)
  const adminUser = await prisma.user.upsert({
    where:  { email: 'platform@omnis.edu' },
    update: {},
    create: {
      email:       'platform@omnis.edu',
      passwordHash,
      role:        Role.PLATFORM_ADMIN,
      firstName:   'Omnis',
      lastName:    'Admin',
      schoolId:    ps.id,
      isActive:    true,
    },
  })
  console.log(`✓ Platform admin user: ${adminUser.email}`)

  // ── 3. Demo schools ───────────────────────────────────────────────────────────
  const SCHOOLS = [
    {
      id:            'SCHOOL-OAKFIELD',
      name:          'Oakfield Academy',
      urn:           '123456',
      phase:         'secondary',
      localAuthority: 'Essex',
      region:        'East of England',
      isActive:      true,
      onboardedAt:   new Date('2026-01-15'),
    },
    {
      id:            'SCHOOL-RIVERSIDE',
      name:          'Riverside Primary',
      urn:           '234567',
      phase:         'primary',
      localAuthority: 'Tower Hamlets',
      region:        'London',
      isActive:      true,
      onboardedAt:   new Date('2026-02-01'),
    },
    {
      id:            'SCHOOL-HILLSIDE',
      name:          'Hillside All-Through',
      urn:           '345678',
      phase:         'all_through',
      localAuthority: 'Manchester City',
      region:        'North West',
      isActive:      false,
      onboardedAt:   null,
    },
  ]

  for (const s of SCHOOLS) {
    // Check if a school with this URN already exists; if so, update its platform fields
    const existing = await prisma.school.findFirst({ where: { OR: [{ urn: s.urn }, { id: s.id }] } })
    if (existing) {
      await prisma.school.update({
        where: { id: existing.id },
        data: {
          urn:           s.urn,
          phase:         s.phase,
          localAuthority: s.localAuthority,
          region:        s.region,
          isActive:      s.isActive,
          onboardedAt:   s.onboardedAt,
        },
      })
      console.log(`✓ Updated school: ${s.name}`)
    } else {
      await prisma.school.create({ data: s })
      console.log(`✓ Created school: ${s.name}`)
    }
  }

  // ── 4. Feature flags for Oakfield Academy ─────────────────────────────────────
  const oakfield = await prisma.school.findFirst({ where: { urn: '123456' } })
  if (oakfield) {
    const FLAGS = [
      { flag: 'send_scorer',   enabled: true  },
      { flag: 'oak_resources', enabled: true  },
      { flag: 'gdpr_portal',   enabled: true  },
      { flag: 'parent_portal', enabled: true  },
      { flag: 'wonde_sync',    enabled: false },
    ]
    for (const f of FLAGS) {
      await prisma.schoolFeatureFlag.upsert({
        where:  { schoolId_flag: { schoolId: oakfield.id, flag: f.flag } },
        update: { enabled: f.enabled },
        create: { schoolId: oakfield.id, flag: f.flag, enabled: f.enabled, setBy: adminUser.id },
      })
    }
    console.log(`✓ ${FLAGS.length} feature flags set for ${oakfield.name}`)
  }

  // ── 5. Platform audit log entries ─────────────────────────────────────────────
  const now = new Date()
  const AUDIT = [
    {
      id:        'PAL-SEED-1',
      actorId:   adminUser.id,
      action:    'school.created',
      target:    SCHOOLS[0].id,
      metadata:  { name: 'Oakfield Academy', urn: '123456' },
      createdAt: new Date(now.getTime() - 14 * 86400_000),
    },
    {
      id:        'PAL-SEED-2',
      actorId:   adminUser.id,
      action:    'school.created',
      target:    SCHOOLS[1].id,
      metadata:  { name: 'Riverside Primary', urn: '234567' },
      createdAt: new Date(now.getTime() - 10 * 86400_000),
    },
    {
      id:        'PAL-SEED-3',
      actorId:   adminUser.id,
      action:    'flag.toggled',
      target:    SCHOOLS[0].id,
      metadata:  { flag: 'send_scorer', enabled: true },
      createdAt: new Date(now.getTime() - 7 * 86400_000),
    },
    {
      id:        'PAL-SEED-4',
      actorId:   adminUser.id,
      action:    'school.created',
      target:    SCHOOLS[2].id,
      metadata:  { name: 'Hillside All-Through', urn: '345678' },
      createdAt: new Date(now.getTime() - 3 * 86400_000),
    },
    {
      id:        'PAL-SEED-5',
      actorId:   adminUser.id,
      action:    'flag.toggled',
      target:    SCHOOLS[0].id,
      metadata:  { flag: 'gdpr_portal', enabled: true },
      createdAt: new Date(now.getTime() - 1 * 86400_000),
    },
  ]

  for (const entry of AUDIT) {
    await prisma.platformAuditLog.upsert({
      where:  { id: entry.id },
      update: {},
      create: entry,
    })
  }
  console.log(`✓ ${AUDIT.length} PlatformAuditLog entries`)

  console.log('\n═══════════════════════════════════════════')
  console.log('  Platform seed complete')
  console.log(`  Admin:   platform@omnis.edu / Demo1234!`)
  console.log('═══════════════════════════════════════════\n')
}

main()
  .catch(err => { console.error('\nFATAL:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())

import { PrismaClient, Role, StreamStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding process...');

  // Clear existing records to ensure a fresh, clean slate
  await prisma.payout.deleteMany({});
  await prisma.stream.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log('🧹 Cleaned existing database records.');

  // 1. Create a premium default tenant (The workspace the landing page points to!)
  const defaultTenant = await prisma.tenant.create({
    data: {
      slug: 'gaming-legend',
      displayName: 'Gaming Legend Live',
      customDomain: 'live.gaminglegend.com',
    },
  });

  // Create an alternative testing tenant
  const secondaryTenant = await prisma.tenant.create({
    data: {
      slug: 'dev-streamer',
      displayName: 'TypeScript & Chill',
    },
  });

  console.log(`🏢 Created Tenants: "${defaultTenant.slug}" and "${secondaryTenant.slug}"`);

  // 2. Create the Streamer User accounts mapped to their respective isolated Tenants
  const streamerOne = await prisma.user.create({
    data: {
      email: 'creator@gaminglegend.com',
      password: 'hashed_secure_password_123', // In production, hash with bcrypt!
      role: Role.STREAMER,
      tenantId: defaultTenant.id,
    },
  });

  const streamerTwo = await prisma.user.create({
    data: {
      email: 'coder@devstreamer.com',
      password: 'hashed_secure_password_456',
      role: Role.STREAMER,
      tenantId: secondaryTenant.id,
    },
  });

  console.log('👤 Generated secure user profiles for isolated workspace owners.');

  // 3. Create active live streams for the tenants so the frontend live player lights up!
  const activeStreamOne = await prisma.stream.create({
    data: {
      title: 'Full-Stack Platform Architecture Coding Session',
      description: 'Building a premium multi-tenant live streaming network under dynamic PostgreSQL row isolation constraints. Ask your tech questions in chat!',
      status: StreamStatus.LIVE,
      viewerCount: 1240,
      streamKey: 'live_ingest_key_gaming_legend_99',
      tenantId: defaultTenant.id,
    },
  });

  await prisma.stream.create({
    data: {
      title: 'Writing Custom Subdomain Routers in Next.js 15',
      description: 'Quick afternoon coding session on dynamically binding top level domains.',
      status: StreamStatus.LIVE,
      viewerCount: 45,
      streamKey: 'live_ingest_key_dev_streamer_11',
      tenantId: secondaryTenant.id,
    },
  });

  console.log('📺 Broadcast lines established. Live channels are now transmitting.');

  // 4. Seed initial payout transactions
  await prisma.payout.createMany({
    data: [
      { amount: 25.00, currency: 'USD', status: 'COMPLETED', tenantId: defaultTenant.id },
      { amount: 100.00, currency: 'USD', status: 'COMPLETED', tenantId: defaultTenant.id },
      { amount: 5.00, currency: 'USD', status: 'COMPLETED', tenantId: defaultTenant.id },
      { amount: 50.00, currency: 'USD', status: 'COMPLETED', tenantId: secondaryTenant.id },
    ],
  });

  console.log('💰 Seeded historical micro-transaction logs.');
  console.log('✅ Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error while seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

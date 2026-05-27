import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding process...');

  // Clear existing records to ensure a fresh, clean slate
  await prisma.donation.deleteMany({});
  await prisma.widgetSettings.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧹 Cleaned existing database records.');

  // Create our test streamer with a hardcoded ID so it's easy to test!
  const testStreamer = await prisma.user.create({
    data: {
      id: 'kamal-test-123', // Hardcoded ID for easy testing
      username: 'kamal',
      email: 'kamal@protip.live',
      password: 'password123',
      widgetSettings: {
        create: {
          alertImage: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3poMWxhNndnZnkyZm1waHkzbDczZXNweW95ZmhpZW94Z3FkYmljdCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LdOyjZ7io5Msw/giphy.gif', // Mr Krabs Money GIF
          alertSound: 'https://www.myinstants.com/media/sounds/cash-register-kaching-sound-effect-audio-library.mp3', // Cha-Ching sound!
          alertDuration: 5000,
          minDonation: 1.00,
          textColor: '#22c55e', // Neon Green
        }
      }
    },
  });

  console.log(`👤 Created test streamer: ${testStreamer.username}`);
  console.log(`📺 Tipping URL: /tip/${testStreamer.id}`);
  console.log(`📺 OBS Widget URL: /widget/${testStreamer.id}`);
  
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

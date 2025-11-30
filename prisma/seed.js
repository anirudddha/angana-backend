// prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // ============================================
    // SEED STATIC DATA (Always needed)
    // ============================================

    // 1. Seed Report Reasons
    console.log('Seeding report reasons...');
    const reportReasons = [
        { id: 1, reason: 'Spam', description: 'This is spam or a scam.' },
        { id: 2, reason: 'Hate Speech', description: 'This is harassment or hate speech.' },
        { id: 3, reason: 'Misinformation', description: 'This contains false information.' },
        { id: 4, reason: 'Inappropriate Content', description: 'This is not appropriate for the neighborhood.' },
        { id: 5, reason: 'Other', description: 'The reason is not listed.' },
    ];

    for (const reasonData of reportReasons) {
        await prisma.reportReason.upsert({
            where: { reason: reasonData.reason },
            update: {},
            create: reasonData,
        });
        console.log(`  ✓ Seeded report reason: ${reasonData.reason}`);
    }

    // 2. Seed Notification Types
    console.log('Seeding notification types...');
    const notificationTypes = [
        { id: 1, name: 'New Post', description: 'Notification for new posts in your neighborhood.' },
        { id: 2, name: 'New Comment on My Post', description: 'Notification when someone comments on your post.' },
        { id: 3, name: 'New Direct Message', description: 'Notification when you receive a new direct message.' },
        { id: 4, name: 'Event Reminder', description: 'Reminder for events you are attending.' },
        { id: 5, name: 'Urgent Alert', description: 'High-priority alerts from your neighborhood.' },
    ];

    for (const typeData of notificationTypes) {
        await prisma.notificationType.upsert({
            where: { name: typeData.name },
            update: {},
            create: typeData,
        });
        console.log(`  ✓ Seeded notification type: ${typeData.name}`);
    }

    // 3. Seed Service Categories
    console.log('Seeding service categories...');
    const serviceCategories = [
        { id: 1, name: 'Plumbing' },
        { id: 2, name: 'Landscaping' },
        { id: 3, name: 'Tutoring' },
        { id: 4, name: 'Pet Sitting' },
        { id: 5, name: 'House Cleaning' },
        { id: 6, name: 'Electrician' },
        { id: 7, name: 'Painting' }
    ];

    for (const categoryData of serviceCategories) {
        await prisma.serviceCategory.upsert({
            where: { name: categoryData.name },
            update: {},
            create: categoryData,
        });
        console.log(`  ✓ Seeded category: ${categoryData.name}`);
    }

    // 4. Seed Sample Neighborhood with Geographic Data
    console.log('Seeding neighborhoods...');

    // Using raw SQL for geographic data since Prisma doesn't support geography type directly
    await prisma.$executeRaw`
        INSERT INTO "public"."neighborhoods" ("id", "name", "description", "created_at", "boundaries", "center_point") 
        VALUES (
            1::bigint, 
            'Sample Neighborhood', 
            '10km radius around given location', 
            '2025-10-12 08:10:05.021'::timestamp,
            '0103000020E61000000100000021000000FBD3F1F03E3D52408415A6A1214C334089A2C994243D5240E7A1E18E9D47334042A7B25BCF3C5240364A4D3A4343334069437190423C5240C2CC47733D3F33401C2B509F833B5240A15F56C6B33B33404A964CE0993A52401BF208F9C83833408E849D4E8E3952409D552BB599363340314C67306B385240461F2B703B353340E58AFDB13B3752405A0C4699BB343340A9A285780B365240243B60161F353340855F1830E634524047936614623633402970A819D73352403D09FC2C783833405F3FF49CE83252401BB6FCDF4C3B3340E2A2A4E2233252402EDB3C5CC43E334009CF6F7A903152409BFCEF8FBC4233402706AB1034315240B3FF6F760E4733404171283612315240654AC6968F4B33404452953C2C315240672577A4135033407732CC288131524092A9B4326E543340CCCBBCBB0D3252407CDE586974583340D93EAF91CC325240C658E0AAFE5B334087BCC956B6335240433B1C1BEA5E33403DF6E70EC234524002A972F71961334085AC0B6EE53552403DA13FB378623340A5C7FE3D15375240124D2FCDF8623340881932CD45385240B8AF2855956233403F857F626B395240230A791D52613340013940B17A3A524046B544953B5F3340DFF82249693B524072E4AD4D665C334049935BFD2D3C524093517F2EEE583340A531213FC13C5240DB7F5362F5543340BE82F8671D3D52404FE20605A3503340FBD3F1F03E3D52408415A6A1214C3340'::geography,
            '0101000020E61000003FA7C58528375240EA584A3BDA4B3340'::geography
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            boundaries = EXCLUDED.boundaries,
            center_point = EXCLUDED.center_point
    `;
    console.log('  ✓ Seeded Sample Neighborhood with geographic boundaries');

    // ============================================
    // OPTIONAL: Seed Sample Data (for development/testing)
    // ============================================

    console.log('\nChecking for existing user to create sample data...');

    // Find the first user (if any exists)
    const user = await prisma.profile.findFirst();

    if (!user) {
        console.log('  ⚠ No user found. Skipping sample data creation.');
        console.log('  → Sign in at least once to create sample posts and comments.');
    } else {
        console.log(`  ✓ Found user: ${user.full_name}`);

        // Get the Sample Neighborhood
        const sampleNeighborhood = await prisma.neighborhood.findUnique({
            where: { id: 1n },
        });

        if (sampleNeighborhood) {
            // Make the user a member of Sample Neighborhood
            await prisma.neighborhoodMembership.upsert({
                where: {
                    user_id_neighborhood_id: {
                        user_id: user.user_id,
                        neighborhood_id: sampleNeighborhood.id
                    }
                },
                update: {},
                create: {
                    user_id: user.user_id,
                    neighborhood_id: sampleNeighborhood.id,
                },
            });
            console.log(`  ✓ ${user.full_name} is now a member of ${sampleNeighborhood.name}`);

            // Create sample posts
            const existingPosts = await prisma.post.count({
                where: {
                    author_id: user.user_id,
                    neighborhood_id: sampleNeighborhood.id
                }
            });

            if (existingPosts === 0) {
                const post1 = await prisma.post.create({
                    data: {
                        content: 'Hello neighbors! Just moved in. Looking for recommendations for the best local coffee shop.',
                        author_id: user.user_id,
                        neighborhood_id: sampleNeighborhood.id,
                    },
                });
                console.log('  ✓ Created sample post 1');

                const post2 = await prisma.post.create({
                    data: {
                        content: 'Has anyone seen a lost black cat with a blue collar? Responds to "Shadow".',
                        author_id: user.user_id,
                        neighborhood_id: sampleNeighborhood.id,
                    },
                });
                console.log('  ✓ Created sample post 2');

                // Add a comment to the first post
                await prisma.postComment.create({
                    data: {
                        content: "Welcome to the neighborhood! 'The Daily Grind' on Main St is fantastic.",
                        author_id: user.user_id,
                        post_id: post1.id,
                    },
                });
                console.log('  ✓ Added sample comment');
            } else {
                console.log('  ⚠ Sample posts already exist, skipping...');
            }
        }
    }

    console.log('\n✅ Seeding finished successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

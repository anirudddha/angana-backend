import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // Find the first user (assuming you created one in Sprint 1)
    const user = await prisma.profile.findFirst();
    if (!user) {
        console.error('Could not find a user to seed data for. Please sign in at least once.');
        return;
    }
    console.log(`Found user: ${user.full_name}`);

    // 1. Create a Neighborhood
    const neighborhood = await prisma.neighborhood.upsert({
        where: { id: 1 },
        update: {},
        create: {
            name: 'Sunnyvale Springs',
            description: 'A friendly community of neighbors.',
        },
    });
    console.log(`Created neighborhood: ${neighborhood.name}`);

    // 2. Make the user a member of this neighborhood
    await prisma.neighborhoodMembership.upsert({
        where: { user_id_neighborhood_id: { user_id: user.user_id, neighborhood_id: neighborhood.id } },
        update: {},
        create: {
            user_id: user.user_id,
            neighborhood_id: neighborhood.id,
        },
    });

    console.log(`${user.full_name} is now a member of ${neighborhood.name}`);

    // 3. Create a Post in that neighborhood by the user
    const post1 = await prisma.post.create({
        data: {
            content: 'Hello neighbors! Just moved in. Looking for recommendations for the best local coffee shop.',
            author_id: user.user_id,   // ✅ FIXED
            neighborhood_id: neighborhood.id,
        },
    });
    console.log('Created a sample post.');

    // 4. Create another post
    const post2 = await prisma.post.create({
        data: {
            content: 'Has anyone seen a lost black cat with a blue collar? Responds to "Shadow".',
            author_id: user.user_id,   // ✅ FIXED
            neighborhood_id: neighborhood.id,
        },
    });
    console.log('Created a second sample post.');

    // 5. Add a comment to the first post
    await prisma.postComment.create({
        data: {
            content: "Welcome to the neighborhood! 'The Daily Grind' on Main St is fantastic.",
            author_id: user.user_id,   // ✅ FIXED
            post_id: post1.id,
        },
    });
    console.log('Added a comment.');

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

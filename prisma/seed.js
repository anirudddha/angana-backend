// prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // Find the first user (assuming you created one)
    const user = await prisma.profile.findFirst();
    if (!user) {
        console.error('Could not find a user to seed data for. Please sign in at least once.');
        return;
    }
    console.log(`Found user: ${user.full_name}`);

    // 1. Create a Neighborhood
    let neighborhood = await prisma.neighborhood.findUnique({
        where: { name: 'Sunnyvale Springs' },
    });

    if (!neighborhood) {
        neighborhood = await prisma.neighborhood.create({
            data: {
                name: 'Sunnyvale Springs',
                description: 'A friendly community of neighbors.',
            },
        });
    }
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
            author_id: user.user_id,
            neighborhood_id: neighborhood.id,
        },
    });
    console.log('Created a sample post.');

    // 4. Create another post
    const post2 = await prisma.post.create({
        data: {
            content: 'Has anyone seen a lost black cat with a blue collar? Responds to "Shadow".',
            author_id: user.user_id,
            neighborhood_id: neighborhood.id,
        },
    });
    console.log('Created a second sample post.');

    // 5. Add a comment to the first post
    await prisma.postComment.create({
        data: {
            content: "Welcome to the neighborhood! 'The Daily Grind' on Main St is fantastic.",
            author_id: user.user_id,
            post_id: post1.id,
        },
    });
    console.log('Added a comment.');

    // 6. Seed service categories
    const categories = [
        'Plumbing',
        'Landscaping',
        'Tutoring',
        'Pet Sitting',
        'House Cleaning',
        'Electrician',
        'Painting'
    ];

    for (const name of categories) {
        await prisma.serviceCategory.upsert({
            where: { name },
            update: {},
            create: { name },
        });
        console.log(`Seeded category: ${name}`);
    }

    // 7. Seed report reasons
    const reportReasons = [
        { reason: 'Spam', description: 'This is spam or a scam.' },
        { reason: 'Hate Speech', description: 'This is harassment or hate speech.' },
        { reason: 'Misinformation', description: 'This contains false information.' },
        { reason: 'Inappropriate Content', description: 'This is not appropriate for the neighborhood.' },
        { reason: 'Other', description: 'The reason is not listed.' },
    ];

    for (const reasonData of reportReasons) {
        await prisma.reportReason.upsert({
            where: { reason: reasonData.reason },
            update: {},
            create: reasonData,
        });
        console.log(`Seeded report reason: ${reasonData.reason}`);
    }

    // 8. Seed notification types
    const notificationTypes = [
        { name: 'New Post', description: 'Notification for new posts in your neighborhood.' },
        { name: 'New Comment on My Post', description: 'Notification when someone comments on your post.' },
        { name: 'New Direct Message', description: 'Notification when you receive a new direct message.' },
        { name: 'Event Reminder', description: 'Reminder for events you are attending.' },
        { name: 'Urgent Alert', description: 'High-priority alerts from your neighborhood.' },
    ];

    for (const typeData of notificationTypes) {
        await prisma.notificationType.upsert({
            where: { name: typeData.name },
            update: {},
            create: typeData,
        });
        console.log(`Seeded notification type: ${typeData.name}`);
    }

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

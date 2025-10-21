// src/services/pet.service.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Creates a new pet profile for a user.
 * @param {string} ownerUserId - The UUID of the user.
 * @param {object} petData - The details of the pet.
 */
export const createPet = async (ownerUserId, petData) => {
    // ... (This function is correct and remains unchanged)
    const { name, species, breed, bio, mediaUrls = [] } = petData;

    const profile = await prisma.profile.findUnique({ where: { user_id: ownerUserId } });
    if (!profile) {
        throw new Error('Creator profile does not exist');
    }

    return prisma.$transaction(async (tx) => {
        const pet = await tx.pet.create({
            data: {
                owner_id: profile.id,
                name,
                species,
                breed,
                bio,
            },
        });

        if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
            const mediaData = mediaUrls.map((url) => ({
                uploader_id: profile.user_id,
                url,
                pet_id: pet.id,
            }));
            await tx.media.createMany({ data: mediaData });
        }

        return tx.pet.findUnique({
            where: { id: pet.id },
            include: { media: true },
        });
    });
};

/**
 * MODIFIED: Updates a pet's profile. Ensures the user is the owner atomically.
 * This is more secure and efficient as it combines the find and update operation.
 * @param {BigInt} petId
 * @param {BigInt} ownerId - The ID of the owner's profile.
 * @param {object} updateData - The new data for the pet.
 */
export const updatePet = async (petId, ownerId, updateData) => {
    // Destructure all possible fields, including the mediaUrls from the frontend
    const { name, species, breed, bio, status, mediaUrls } = updateData;

    return prisma.$transaction(async (tx) => {
        // Step 1: Update the pet's main details and verify ownership.
        const updatedPetResult = await tx.pet.updateMany({
            where: {
                id: petId,
                owner_id: ownerId, // Authorization check!
            },
            data: { name, species, breed, bio, status },
        });

        // If count is 0, the pet wasn't found or the user is not the owner.
        if (updatedPetResult.count === 0) {
            const petExists = await tx.pet.findUnique({ where: { id: petId } });
            if (!petExists) throw new Error("Pet not found.");
            throw new Error("Forbidden: You are not the owner of this pet.");
        }

        // Step 2: If new mediaUrls are provided, update the pet's media.
        // This is the critical new piece of logic.
        if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
            // We need the user's UUID (user_id) for the Media table.
            const profile = await tx.profile.findUnique({ where: { id: ownerId } });
            if (!profile) {
                throw new Error("Owner profile not found during media update.");
            }
            
            // First, delete all existing media for this pet.
            await tx.media.deleteMany({
                where: { pet_id: petId },
            });

            // Then, create the new media records from the provided URLs.
            const newMediaData = mediaUrls.map(url => ({
                url,
                pet_id: petId,
                uploader_id: profile.user_id, // Links the upload to the User
            }));
            
            await tx.media.createMany({
                data: newMediaData,
            });
        }

        // Step 3: Return the fully updated pet profile with the new media.
        return tx.pet.findUnique({
            where: { id: petId },
            include: { media: true },
        });
    });
};

/**
 * MODIFIED: Deletes a pet's profile. Also verifies ownership atomically.
 * @param {BigInt} petId
 * @param {BigInt} ownerId - The ID of the owner's profile.
 */
export const deletePet = async (petId, ownerId) => {
    // Similar to update, we use a compound `where` to ensure ownership.
    const deleteResult = await prisma.pet.deleteMany({
        where: {
            id: petId,
            owner_id: ownerId, // Authorization check happens here!
        },
    });

    if (deleteResult.count === 0) {
        const petExists = await prisma.pet.findUnique({ where: { id: petId } });
        if (!petExists) throw new Error("Pet not found.");
        throw new Error("Forbidden: You are not the owner of this pet.");
    }

    // No need to return anything on successful delete.
};

/**
 * Gets the profile for a single pet.
 * @param {BigInt} petId
 */
export const getPetDetails = async (petId) => {
    // ... (This function is correct and remains unchanged)
    const pet = await prisma.pet.findUnique({
        where: { id: petId },
        include: {
            media: { select: { id: true, url: true } },
            owner: { select: { id: true, full_name: true, avatar_url: true } },
        },
    });

    if (!pet) throw new Error("Pet not found.");

    return pet;
};

/**
 * ADDED: Gets all pets for the currently logged-in user.
 * @param {BigInt} ownerId - The ID of the owner's profile.
 */
export const getMyPets = async (ownerId) => {
    return prisma.pet.findMany({
        where: { owner_id: ownerId },
        include: {
            media: {
                select: { url: true },
                take: 1 // Get one cover image for the list view
            },
        },
        orderBy: {
            created_at: 'desc'
        },
    });
};

/**
 * Gets a directory of pets whose owners are in a specific neighborhood.
 * @param {BigInt} neighborhoodId
 * @param {string} status - 'safe' or 'lost'
 */
export const getPetsForNeighborhood = async (neighborhoodId, status = 'safe') => {
    // ... (This function is correct and remains unchanged)
    return prisma.pet.findMany({
        where: {
            status,
            owner: {
                memberships: {
                    some: { neighborhood_id: neighborhoodId },
                },
            },
        },
        include: {
            media: { select: { url: true }, take: 1 }, // just cover image
            owner: { select: { full_name: true } },
        },
        orderBy: { created_at: 'desc' },
    });
};
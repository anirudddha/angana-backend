// src/services/pet.service.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Creates a new pet profile for a user.
 * @param {string} ownerId - The UUID of the user.
 * @param {object} petData - The details of the pet.
 */
export const createPet = async (ownerUserId, petData) => {
    const { name, species, breed, bio, mediaUrls = [] } = petData;

    // Resolve profile (we store owner_id as Profile.id, not Profile.user_id)
    const profile = await prisma.profile.findUnique({ where: { user_id: ownerUserId } });
    if (!profile) {
        throw new Error('Creator profile does not exist');
    }

    return prisma.$transaction(async (tx) => {
        // create pet with owner_id = profile.id (PRIMARY KEY)
        const pet = await tx.pet.create({
            data: {
                owner_id: profile.id,
                name,
                species,
                breed,
                bio,
            },
        });

        // media.uploader_id should be profile.user_id (because Media.uploader relation references user_id)
        if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
            const mediaData = mediaUrls.map((url) => ({
                uploader_id: profile.user_id, // NOTE: references Profile.user_id
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
 * Updates a pet's profile. Ensures the user is the owner.
 * @param {BigInt} petId
 * @param {string} ownerId - The UUID of the user.
 * @param {object} updateData - The new data for the pet.
 */
export const updatePet = async (petId, ownerId, updateData) => {
    const pet = await prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
        throw new Error("Pet not found.");
    }
    if (pet.owner_id !== ownerId) {
        throw new Error("Forbidden: You are not the owner of this pet.");
    }

    const { name, species, breed, bio, status } = updateData;
    return prisma.pet.update({
        where: { id: petId },
        data: { name, species, breed, bio, status },
    });
};

/**
 * Deletes a pet's profile. Also verifies ownership.
 * @param {BigInt} petId
 * @param {string} ownerId
 */
export const deletePet = async (petId, ownerId) => {
    const pet = await prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
        throw new Error("Pet not found.");
    }
    if (pet.owner_id !== ownerId) {
        throw new Error("Forbidden: You are not the owner of this pet.");
    }

    return prisma.pet.delete({ where: { id: petId } });
};

/**
 * Gets the profile for a single pet.
 * @param {BigInt} petId
 */
export const getPetDetails = async (petId) => {
    const pet = await prisma.pet.findUnique({
        where: { id: petId },
        include: {
            media: { select: { id: true, url: true } },
            owner: { select: { id: true, user_id: true, full_name: true, avatar_url: true } },
        },
    });

    if (!pet) throw new Error("Pet not found.");

    return pet;
};

/**
 * Gets a directory of pets whose owners are in a specific neighborhood.
 * @param {BigInt} neighborhoodId
 * @param {string} status - 'safe' or 'lost'
 */
export const getPetsForNeighborhood = async (neighborhoodId, status = 'safe') => {
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

// src/controllers/pets.controller.js
import asyncHandler from 'express-async-handler';
import * as petService from '../services/pet.service.js';
import { getUserNeighborhood } from '../services/user.service.js';

// Helper to convert BigInt to string for JSON
const serializeBigInt = (obj) =>
  JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));

// Create a new pet
export const createPetController = asyncHandler(async (req, res) => {
  // user_id is a UUID string — no BigInt conversion needed
  const pet = await petService.createPet(req.user.user_id, req.body);
  res.status(201).json(serializeBigInt(pet));
});

// Get all pets for the logged-in user
export const getMyPetsController = asyncHandler(async (req, res) => {
  // req.user.id might be numeric (profile id)
  const ownerId = isNaN(req.user.id) ? req.user.id : BigInt(req.user.id);
  const pets = await petService.getMyPets(ownerId);
  res.status(200).json(serializeBigInt(pets));
});

// Update a pet
export const updatePetController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let petId;
  let ownerId;

  try {
    // petId is numeric
    petId = BigInt(id);

    // ownerId can be numeric or string
    ownerId = isNaN(req.user.id) ? req.user.id : BigInt(req.user.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid pet or user ID' });
  }

  const updatedPet = await petService.updatePet(petId, ownerId, req.body);
  res.status(200).json(serializeBigInt(updatedPet));
});

// Delete a pet
export const deletePetController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let petId;
  let ownerId;

  try {
    petId = BigInt(id);
    ownerId = isNaN(req.user.id) ? req.user.id : BigInt(req.user.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid pet or user ID' });
  }

  await petService.deletePet(petId, ownerId);
  res.status(204).send();
});

// Get pet details
export const getPetDetailsController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let petId;
  try {
    petId = BigInt(id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid pet ID' });
  }

  const pet = await petService.getPetDetails(petId);
  res.status(200).json(serializeBigInt(pet));
});

// Get safe pets in a neighborhood
export const getNeighborhoodPetsController = asyncHandler(async (req, res) => {
  const neighborhoodId = await getUserNeighborhood(req.user.user_id);

  if (!neighborhoodId) {
    return res.status(400).json({ message: 'User is not part of any neighborhood' });
  }

  const pets = await petService.getPetsForNeighborhood(neighborhoodId, 'safe');
  res.status(200).json(serializeBigInt(pets));
});

// Get lost pets in a neighborhood
export const getLostNeighborhoodPetsController = asyncHandler(async (req, res) => {
  const neighborhoodId = await getUserNeighborhood(req.user.user_id);

  if (!neighborhoodId) {
    return res.status(400).json({ message: 'User is not part of any neighborhood' });
  }

  const pets = await petService.getPetsForNeighborhood(neighborhoodId, 'lost');
  res.status(200).json(serializeBigInt(pets));
});

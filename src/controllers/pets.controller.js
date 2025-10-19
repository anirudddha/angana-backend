import asyncHandler from 'express-async-handler';
import * as petService from '../services/pet.service.js';

// Helper to convert BigInt to string for JSON
const serializeBigInt = (obj) =>
  JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));

// Create a new pet
export const createPetController = asyncHandler(async (req, res) => {
  const pet = await petService.createPet(req.user.user_id, req.body);
  res.status(201).json(serializeBigInt(pet));
});

// Update a pet
export const updatePetController = asyncHandler(async (req, res) => {
  let petId;
  try {
    petId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid pet ID' });
  }

  const updatedPet = await petService.updatePet(petId, req.user.id, req.body);
  res.status(200).json(serializeBigInt(updatedPet));
});

// Delete a pet
export const deletePetController = asyncHandler(async (req, res) => {
  let petId;
  try {
    petId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid pet ID' });
  }

  await petService.deletePet(petId, req.user.id);
  res.status(204).send();
});

// Get pet details
export const getPetDetailsController = asyncHandler(async (req, res) => {
  let petId;
  try {
    petId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid pet ID' });
  }

  const pet = await petService.getPetDetails(petId);
  res.status(200).json(serializeBigInt(pet));
});

// Get safe pets in a neighborhood
export const getNeighborhoodPetsController = asyncHandler(async (req, res) => {
  let neighborhoodId;
  try {
    neighborhoodId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid neighborhood ID' });
  }

  const pets = await petService.getPetsForNeighborhood(neighborhoodId, 'safe');
  res.status(200).json(serializeBigInt(pets));
});

// Get lost pets in a neighborhood
export const getLostNeighborhoodPetsController = asyncHandler(async (req, res) => {
  let neighborhoodId;
  try {
    neighborhoodId = BigInt(req.params.id);
  } catch (e) {
    return res.status(400).json({ message: 'Invalid neighborhood ID' });
  }

  const pets = await petService.getPetsForNeighborhood(neighborhoodId, 'lost');
  res.status(200).json(serializeBigInt(pets));
});

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createCategory = async ({ name, icon, color }) => {
  return prisma.category.create({
    data: {
      name,
      icon,
      color,
    },
  });
};

export const getCategories = async () => {
  return prisma.category.findMany({
    orderBy: {
      name: 'asc',
    },
  });
};

export const getCategoryById = async (id) => {
  return prisma.category.findUnique({
    where: { id },
  });
};

export const updateCategory = async (id, { name, icon, color }) => {
  return prisma.category.update({
    where: { id },
    data: {
      name,
      icon,
      color,
    },
  });
};

export const deleteCategory = async (id) => {
  return prisma.category.delete({
    where: { id },
  });
};
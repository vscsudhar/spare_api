import mongoose from 'mongoose';

/**
 * Clears all MongoDB collections to ensure a clean state before each test run.
 */
export const cleanDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
    try {
      await collections[name].dropIndexes();
    } catch (err) {
      // Ignore if index drop fails (e.g. collection doesn't exist yet)
    }
  }
};

export default cleanDatabase;

import mongoose from 'mongoose';

/**
 * Runs a function within a Mongoose database transaction.
 * If the MongoDB daemon is running in standalone mode (no replica set),
 * it falls back to executing the operations sequentially without a session.
 * @param {Function} workFn Function to execute: (session) => Promise<any>
 */
export const runInTransaction = async (workFn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    
    const result = await workFn(session);
    
    await session.commitTransaction();
    session.endSession();
    return result;
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // Ignore abort failure logs
      }
      session.endSession();
    }

    // Detect if error was triggered due to missing Replica Set configurations
    const isReplicaSetError =
      error.message.includes('replica set') ||
      error.message.includes('ReplicaSet') ||
      error.message.includes('transaction') ||
      error.message.includes('sessions are not supported') ||
      error.code === 20; // IllegalOperation on standalone

    if (isReplicaSetError) {
      console.log('📡 Standalone MongoDB detected. Falling back to sequential execution...');
      return workFn(null);
    }

    throw error;
  }
};

export default runInTransaction;

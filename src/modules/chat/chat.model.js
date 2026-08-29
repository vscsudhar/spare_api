import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    // TODO: Define schema fields matching Flutter VoltSpare models
  },
  {
    timestamps: true,
  }
);

export const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
export default Chat;

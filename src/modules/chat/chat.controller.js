import chatService from './chat.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class ChatController {
  getAll = catchAsync(async (req, res) => {
    const data = await chatService.getAll();
    return sendResponse(res, 200, 'Chat retrieved successfully', data);
  });
}

export default new ChatController();

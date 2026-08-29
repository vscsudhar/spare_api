/**
 * Formats and sends a unified success response.
 * @param {object} res Express response object
 * @param {number} statusCode HTTP Status Code
 * @param {string} message Description message of the result
 * @param {object} data Primary resource data returned
 * @param {object} meta Pagination / sorting meta metadata
 */
export const sendResponse = (
  res,
  statusCode,
  message = 'Request completed',
  data = {},
  meta = {}
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
};

export default sendResponse;

import AppError from '../errors/AppError.js';

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Assign back sanitized/validated inputs
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;

      return next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const errorDetails = error.errors.map((err) => ({
          field: err.path.join('.').replace(/^(body|query|params)\./, ''),
          message: err.message,
        }));

        return next(new AppError('Validation failed', 400, errorDetails));
      }
      return next(error);
    }
  };
};

export default validate;

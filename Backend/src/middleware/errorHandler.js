/**
 * Global Express error-handling middleware.
 * Captures and formats all server errors consistently.
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle common PostgreSQL error codes
  if (err.code === '23505') {
    // Unique constraint violation
    statusCode = 409;
    message = 'Duplicate entry. Record already exists.';
  } else if (err.code === '23503') {
    // Foreign key violation
    statusCode = 400;
    message = 'Foreign key constraint violation.';
  } else if (err.code === '23502') {
    // Not-null violation
    statusCode = 400;
    message = 'Required field missing.';
  }

  // Handle validation errors (e.g., from Joi, Mongoose, or custom validators)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map(e => e.message)
      .join(', ');
  }

  // Send JSON response
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;

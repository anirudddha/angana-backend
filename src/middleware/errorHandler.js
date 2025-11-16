// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // If Mongoose not found error, set to 404 and change message
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Handle Prisma errors
  if (err.code) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409; // Conflict
        message = `Duplicate field value: ${err.meta.target.join(', ')}`;
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Resource not found';
        break;
      // Add more specific Prisma error codes as needed
      default:
        statusCode = 500;
        message = 'Something went wrong with the database';
        break;
    }
  }

  // Joi validation errors
  if (err.isJoi) {
    statusCode = 400; // Bad Request
    message = err.details.map(d => d.message).join(', ');
  }


  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export { errorHandler };

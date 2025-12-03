const STATUS = {
  OK: 200,          // General success
  CREATED: 201,     // Resource created
  BUS: 400,         // Business / Validation / Bad Request
  UNAUTH: 401,      // Unauthorized
  AUTH: 403,        // Forbidden / Not allowed
  EXT: 409,         // Conflict / Already exists
  NOT_FOUND: 404,   // Resource not found
  INVALID: 422,     // Invalid input / Unprocessable Entity
  ERROR: 500        // Internal Server Error
};

export default STATUS;

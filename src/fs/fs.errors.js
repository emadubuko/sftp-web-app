class PathTraversalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathTraversalError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message = 'Already exists') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class InvalidNameError extends Error {
  constructor(message = 'Invalid name') {
    super(message);
    this.name = 'InvalidNameError';
    this.statusCode = 400;
  }
}

class UnsupportedFileTypeError extends Error {
  constructor(message = 'Unsupported file type') {
    super(message);
    this.name = 'UnsupportedFileTypeError';
    this.statusCode = 415;
  }
}

class InsufficientStorageError extends Error {
  constructor(message = 'Not enough free storage space for this upload') {
    super(message);
    this.name = 'InsufficientStorageError';
    this.statusCode = 507;
  }
}

module.exports = {
  PathTraversalError,
  NotFoundError,
  ConflictError,
  InvalidNameError,
  UnsupportedFileTypeError,
  InsufficientStorageError,
};

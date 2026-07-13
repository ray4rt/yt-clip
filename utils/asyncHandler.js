/**
 * utils/asyncHandler.js
 * Membungkus async route handler agar error otomatis diteruskan ke next()
 * tanpa perlu menulis try/catch di setiap controller.
 *
 * @param {Function} fn - async (req, res, next) => {}
 * @returns {Function}
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

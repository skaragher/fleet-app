export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (err.message === "ValidationError") {
    return res.status(status).json({ message: "Validation error", issues: err.issues || [] });
  }
  console.error(err);
  res.status(status).json({ message: err.message || "Server error" });
}

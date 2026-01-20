export function performanceLogger(req, res, next) {
  const start = Date.now();
  const SLOW_API_LIMIT = 200; // ms

  res.on("finish", () => {
    const timeTaken = Date.now() - start;

    const log = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      timeTaken: `${timeTaken}ms`,
    };

    if (timeTaken > SLOW_API_LIMIT) {
      // console.warn("🐌 SLOW API:", log);
    } else {
      // console.log("⚡ API:", log);
    }
  });

  next();
}

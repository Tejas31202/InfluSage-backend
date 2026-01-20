export function responseTimeLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const timeTaken = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} - ${res.statusCode} - ${timeTaken}ms`
    );
  });

  next();
}

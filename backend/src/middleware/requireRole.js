function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

function requireOwnZone(req, res, next) {
  const { zoneId } = req.params;
  if (req.user.role === "ADMIN") return next(); // Admin xem hết
  if (req.user.zoneId !== zoneId) {
    return res.status(403).json({ error: "Not your zone" });
  }
  next();
}

module.exports = { requireRole, requireOwnZone };


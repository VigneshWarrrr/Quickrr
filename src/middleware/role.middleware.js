function requireRole(...allowedRoles) {

    return (req, res, next) => {

        if (!req.session || !req.session.user) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }

        if (!allowedRoles.includes(req.session.user.role)) {

            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this resource."
            });

        }

        next();

    };

}

module.exports = requireRole;
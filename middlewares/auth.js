const jwt = require("jsonwebtoken");

const isAuthorized = async (req, res, next) => {
    const authHeader = req.get('Authorization')
    if (!authHeader) {
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
    }
    const token = authHeader.split(' ')[1];
    let decodedToken
    try {
        decodedToken = jwt.verify(token, process.env.SECRET_KEY)
    } catch (error) {
        next(error)
    }
    if (!decodedToken) {
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
    }
    req.userId = decodedToken.userId;
    next();
}

module.exports = isAuthorized;
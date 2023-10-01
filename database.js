const {Pool} = require("pg");

const postURL = process.env.POSTGRES_URL;

const pool = new Pool({
    connectionString: postURL + "?sslmode=require",
});

module.exports = pool;
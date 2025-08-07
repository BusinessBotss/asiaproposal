"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
require("dotenv/config");
const fs_1 = require("fs");
const path_1 = require("path");
async function run() {
    const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const sql = (0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, './db.sql'), 'utf8');
    await pool.query(sql);
    await pool.end();
}
run().then(() => {
    // eslint-disable-next-line no-console
    console.log('Migration complete');
    process.exit(0);
}).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});

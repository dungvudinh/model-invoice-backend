import dotenv from 'dotenv'
// const dotenv = require('dotenv')
dotenv.config();
export const env = {
    MONGODB_URI: process.env.MONGODB_URI, 
    APP_PORT: process.env.APP_PORT || 10000,
    DATABASE_NAME: process.env.DATABASE_NAME || 'hoa-don-pc',
}
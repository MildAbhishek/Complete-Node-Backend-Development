// require ('dotenv').config({path:'./env'})

import dotenv from 'dotenv';
import { connectDB } from "./db/index.js";
import { app } from './app.js';

dotenv.config({
    path:'./.env'
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})

























/* 
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";




async function connectDB(){}

connectDB()

iffy syntax
A JavaScript IIFE (Immediately Invoked Function Expression) is a function that runs the moment it is invoked or called in the JavaScript event loop. 

import express from "express";
const app = express();

;( async ()=>{
    try {
       await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

       app.on("error", (error) =>{
        console.log("ERROR: ", error);
        throw error;
       })
    } catch (error) {
        console.error("ERROR:: ", error);
        throw error;
    }
})()

*/

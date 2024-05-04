import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

// To Handle JSON Data
app.use(express.json({
    limit:"16kb"
}))

// To Handle Data from URL
app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))

// To Handle static assets
app.use(express.static("public"))

// To Handle cookie from server
app.use(cookieParser())

export {app}
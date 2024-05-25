import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async(req, _, next)=>{ // underscore inplace of res as res is not used below.
    try {
        const token = req.cookies?.accessToken || req.header('Authorization')?.replace("Bearer ", "");
        if(!token){
            throw new ApiError(401, 'Unauthorised Request')
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user){
            // Frontend
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user;
    
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token")
    }


})
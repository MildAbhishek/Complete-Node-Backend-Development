import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerUser = asyncHandler( async (req, res, next) =>{
    // console.log(req)
    
    // Get User Details
    const {userName, email, fullName, password} = req.body;
    // console.log(userName + "--" + email);

    // Validate Data
    if([userName, email, fullName, password].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required")
    }

    // Check If User Already Exist
    // User.findOne({email})
    const existedUser = await User.findOne({
        $or: [{userName}, {email}]
    })
    if(existedUser){
        throw new ApiError(409, "User with same email or username already exits.")
    }

    // Check For Images and Avatar
    // console.log(req.files?.avatar[0]?.path)

    // files: [Object: null prototype] {
    //     avatar: [ [Object] ],
    //     coverImage: [ [Object] ]
    //   },
    const avatarLocalPath = req.files?.avatar?.avatar[0]?.path;
    const coverImageLocalPath  = req.files?.coverImage?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }

    // Upload to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
   
    if(!avatar) {
        throw new ApiError(400, "Avatar image is mandatory");
    }

    // Create User Object - create entry in DB
    const user = await User.create({
        userName: userName.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    })

    
    // Remove Password and Refresh Token Field From Response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // Check For User Creation
    if(!createdUser) {
        throw new ApiError(500, "Somethig went wrong while registering the user")
    }

    // Return Response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered sucessfully")
    );
})

export {registerUser};
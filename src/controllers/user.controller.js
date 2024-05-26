import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        // if (!user) {
        //     throw new ApiError(404, "User does not exist")
        // }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false }) // As we are only updating only one field

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res, next) => {
    // console.log(req)

    // Get User Details
    const { userName, email, fullName, password } = req.body;
    // console.log(userName + "--" + email);

    // Validate Data
    if ([userName, email, fullName, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    // Check If User Already Exist
    // User.findOne({email})
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with same email or username already exits.")
    }

    // Check For Images and Avatar
    // console.log(req.files?.avatar[0]?.path)

    // files: [Object: null prototype] {
    //     avatar: [ [Object] ],
    //     coverImage: [ [Object] ]
    //   },
    const avatarLocalPath = req.files?.avatar?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar image is required");
    }

    // Upload to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);


    if (!avatar) {
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
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // Return Response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered sucessfully")
    );
})

const loginUser = asyncHandler(async (req, res) => {
    // req.body -> data
    const { username, email, password } = req.body;

    if (!(email || username)) {
        throw new ApiError(400, "Username or Email is required")
    }
    // username or email
    // Find user 
    // const user = User.findOne({email})
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User credential")
    }

    // access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookie

    const options = {
        httpOnly: true,
        // secure: true //cookie will only be sent to the https:// not http:// path,
    } // By default cookie can be modified by frontend but by pasing these options cookie can only be modified from the server, not frontend

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken // we are sending access and refresh token again apart from cookie as if user is consuming this API from mobile
                },
                "User logged In Successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    // start here
    const userId = req.user?._id // coming from middleware

    await User.findByIdAndUpdate(
        userId,
        {
            // $set: {
            //     refreshToken: undefined
            // } // undefined will not logout properly.

            // $set: {
            //     refreshToken: null
            // }

            $unset: {
                refreshToken: 1 // removes this field from the document
            }
        },
        {
            new: true
        } // new value will be returned
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id);
    
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is Expired or invoked");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
    
        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken}
                )
            )
    
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh TOken Passed");
    }
})

const changeCurrentPassword = asyncHandler(async(req, res)=>{
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;

    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));

})

const getCurrentUser = asyncHandler(async(req, res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user is found successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res)=>{
    const {fullName, email} = req.body;
    if(!fullName || !email){
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName, // key name is same, then no need to write it
                email:email 
            }
        },
        {
            new: true // latest value will be returned after update, so we need to store it in a variable
        }
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req, res)=>{
    const avatarLocalPath  = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
               avatar: avatar.url 
            }
        },
        {
            new: true
        }
    ).select("-password")

    res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar is updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req, res)=>{
    const coverImageLocalPath  = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading cover image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image is updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req, res)=>{
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"Subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                subscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                coverImage: 1,
                avatar: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    // console.log(channel)

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)  // we need to make id same as mongoDB id, req.user?._id gives only string part of id but here we need the whole id object. So can't write simply  _id: req.user?._id
            }
        },
        {
            $lookup: {
                from: "Videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "Users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [ // sub-pipeline
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner" // destructuring the array returned by previous pipeline
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};